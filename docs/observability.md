# Distributed Tracing with OpenTelemetry and Aspire Dashboard

This document explains how distributed tracing is implemented across the three services
(`bot`, `api`, `worker`) in this project, and why the approach taken is necessary.

---

## Goal

When a user sends `upload <file>` in the Playground, the following async flow is triggered:

```
User message
  └── bot:  receives message, stores conversation, fires upload request
        └── api:  receives upload, calls worker synchronously
              └── worker:  simulates processing (1–3 s)
              └── api:    calls bot /api/notify when done
                    └── bot:  sends proactive message to user
```

All of these spans — across three separate Node.js processes — should appear in Aspire
Dashboard as a **single trace waterfall** sharing one `traceId`.

---

## Why Auto-Instrumentation Alone Is Not Enough

`@opentelemetry/auto-instrumentations-node` patches Node's `http` module to:
- **Inject** `traceparent` headers into outbound HTTP requests
- **Extract** `traceparent` from incoming HTTP requests and set an active context

However, the extraction side only works if the active context survives the full async
call chain through Express middleware. In practice, when using `async` route handlers
with `await`, the `AsyncLocalStorage` scope can be broken by intermediate middleware,
causing `startActiveSpan` to see no active parent and mint a new root `traceId`.

The result is exactly what was observed: **three separate, independent traces** in
Aspire Dashboard, even though the HTTP headers carrying the trace context were present
on every request.

---

## The Fix: Explicit Propagation

Rather than relying on auto-instrumentation's ambient context propagation, each service
explicitly handles context at every service boundary.

### Pattern

**On the sending side** (injecting trace context into an outbound call):

```typescript
import { context, propagation } from '@opentelemetry/api';

// Capture the active span context and write it as HTTP headers.
const traceHeaders: Record<string, string> = {};
propagation.inject(context.active(), traceHeaders);

await axios.post(url, body, { headers: traceHeaders });
```

**On the receiving side** (extracting trace context from an incoming request):

```typescript
import { context, propagation } from '@opentelemetry/api';

app.post('/endpoint', async (req, res) => {
  // Rebuild the parent context from the incoming headers.
  const parentContext = propagation.extract(context.active(), req.headers);

  // Pass it explicitly to startActiveSpan so this span becomes a child.
  await tracer.startActiveSpan('my.span', {}, parentContext, async (span) => {
    // ...
    span.end();
  });
});
```

For cases where you don't start a new span but need downstream calls (like
`app.proactive.sendActivity`) to inherit the context, use `context.with()`:

```typescript
const parentContext = propagation.extract(context.active(), req.headers);

await context.with(parentContext, async () => {
  await app.proactive.sendActivity(adapter, convId, activity);
});
```

---

## Where Each Pattern Is Applied

### `apps/bot/src/index.ts` — Upload handler

Injects the active bot span into the fire-and-forget `/upload` call to the API:

```typescript
const traceHeaders: Record<string, string> = {};
propagation.inject(context.active(), traceHeaders);

void axios
  .post(`${apiBaseUrl}/upload`, { fileName, convId }, { headers: traceHeaders })
  .catch((err) => console.error('[upload] API call failed:', err?.message));
```

The call is **fire-and-forget** (`void`, no `await`) so the bot responds to the user
immediately without waiting for the worker to finish.

### `apps/bot/src/index.ts` — Notify handler

Extracts the trace context forwarded by the API and runs `sendActivity` inside
`context.with()` so the proactive send span joins the same trace:

```typescript
const parentContext = propagation.extract(context.active(), req.headers);

await context.with(parentContext, async () => {
  await app.proactive.sendActivity(adapter, convId, activity);
});
```

### `apps/api/src/index.ts` — Upload handler

Extracts the bot's trace context to become a child of the bot span, then re-injects
its own span context into both downstream calls:

```typescript
const parentContext = propagation.extract(context.active(), req.headers);

await tracer.startActiveSpan('api.upload_received', {}, parentContext, async (span) => {
  const traceHeaders: Record<string, string> = {};
  propagation.inject(context.active(), traceHeaders);

  await axios.post(`${workerBaseUrl}/process`, body, { headers: traceHeaders });
  await axios.post(botNotifyUrl, body, { headers: traceHeaders });
});
```

### `apps/worker/src/index.ts` — Process handler

Extracts the API's trace context to become a child of the API span:

```typescript
const parentContext = propagation.extract(context.active(), req.headers);

await tracer.startActiveSpan('worker.process_document', {}, parentContext, async (span) => {
  // simulate work ...
  span.end();
});
```

---

## Resulting Trace Shape in Aspire Dashboard

After a successful `upload <file>` command, a single trace entry appears with this
waterfall structure:

```
[agents-demo-bot]   agents route handler
  └── [HTTP POST /upload]
        └── [agents-demo-api]   api.upload_received
              ├── [HTTP POST /process]
              │     └── [agents-demo-worker]   worker.process_document  (~1–3 s)
              └── [HTTP POST /api/notify]
                    └── [agents-demo-bot]   proactive send
```

The `traceId` is the same on every span. Clicking any span in Aspire shows the full
waterfall, duration breakdown, and any recorded exceptions.

---

## W3C Trace Context Standard

The propagation format used is **W3C Trace Context** (`traceparent` / `tracestate`
headers), which is the default in `@opentelemetry/api`. It is vendor-neutral and
supported by Aspire Dashboard, Azure Monitor, Jaeger, Zipkin, and every other
OpenTelemetry-compatible backend.

A `traceparent` header looks like:

```
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
              ^^ version  ^^ traceId (128-bit)              ^^ spanId   ^^ flags
```

All three services share the same `traceId` (`4bf92f3...`) because each one receives
the header and creates its span as a child of the previous one.
