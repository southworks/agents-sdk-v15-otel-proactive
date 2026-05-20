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

## OTel Bootstrap: Manual Preloaded Instrumentation

Each service bootstraps OpenTelemetry through a dedicated `instrumentation.ts` module
that is **preloaded before `index.ts`** using Node's `--import` flag:

```
node --import ./dist/instrumentation.js ./dist/index.js
```

The module configures a `NodeSDK` instance with:

| Signal  | Exporter (when `OTEL_EXPORTER_OTLP_ENDPOINT` is set) | Fallback (local dev) |
|---------|------------------------------------------------------|----------------------|
| Traces  | `OTLPTraceExporter` (gRPC)                           | `ConsoleSpanExporter` |
| Metrics | `OTLPMetricExporter` (gRPC)                          | `ConsoleMetricExporter` |
| Logs    | `OTLPLogExporter` (gRPC)                             | `ConsoleLogRecordExporter` |

Export intervals are configurable via `OTEL_METRICS_EXPORT_INTERVAL` and
`OTEL_LOGS_EXPORT_INTERVAL` (defaults: 5000 ms). The module also registers
`SIGTERM`/`SIGINT` handlers that flush the SDK and call `process.exit()`.

`@microsoft/agents-telemetry` and `@opentelemetry/auto-instrumentations-node` are **not
used**. Instead, each service explicitly propagates W3C trace context across HTTP
boundaries (see below).

---

## Why Explicit Propagation Is Required

Rather than relying on a framework to inject/extract context automatically, each service
explicitly handles trace context at every service boundary.

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

Creates the root span `demo.bot.upload.route_handler` and injects trace context into
the fire-and-forget `/upload` call to the API:

```typescript
await BotTelemetry.tracer.startActiveSpan('demo.bot.upload.route_handler', async (span) => {
  try {
    span.setAttribute('demo.file.name', fileName);
    span.setAttribute('demo.conversation.id', convId);

    const traceHeaders: Record<string, string> = {};
    propagation.inject(context.active(), traceHeaders);

    void axios
      .post(`${apiBaseUrl}/upload`, { fileName, convId }, { headers: traceHeaders })
      .catch((err: unknown) => { /* log */ });

    span.setStatus({ code: SpanStatusCode.OK });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    span.recordException(err);
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    throw error;
  } finally {
    span.end();
  }
});
```

The call is **fire-and-forget** (`void`, no `await`) so the bot responds to the user
immediately without waiting for the worker to finish.

### `apps/bot/src/index.ts` — Notify handler

Extracts the trace context forwarded by the API and opens a `bot.proactive_send` span
inside `context.with()` so it joins the same trace as the original bot turn:

```typescript
const parentContext = propagation.extract(context.active(), req.headers);

await context.with(parentContext, async () => {
  await BotTelemetry.tracer.startActiveSpan('bot.proactive_send', async (span) => {
    try {
      span.setAttribute('demo.conversation.id', convId);
      span.setAttribute('demo.result', result ?? 'unknown');
      await app.proactive.sendActivity(adapter, convId, activity);
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error: unknown) {
      const exception = error instanceof Error ? error : new Error(String(error));
      span.recordException(exception);
      span.setStatus({ code: SpanStatusCode.ERROR, message: exception.message });
      throw error;
    } finally {
      span.end();
    }
  });
});
```

### `apps/api/src/index.ts` — Upload handler

Extracts the bot's trace context to become a child of the bot span, then re-injects
its own span context into both downstream calls:

```typescript
const parentContext = propagation.extract(context.active(), req.headers);

await ApiTelemetry.tracer.startActiveSpan('api.upload_received', {}, parentContext, async (span) => {
  const traceHeaders: Record<string, string> = {};
  propagation.inject(context.active(), traceHeaders);

  try {
    await axios.post(`${workerBaseUrl}/process`, body, { headers: traceHeaders });
    await axios.post(botNotifyUrl, body, { headers: traceHeaders });
  } finally {
    span.end();
  }
});
```

### `apps/worker/src/index.ts` — Process handler

Extracts the API's trace context to become a child of the API span:

```typescript
const parentContext = propagation.extract(context.active(), req.headers);

await WorkerTelemetry.tracer.startActiveSpan('worker.process_document', {}, parentContext, async (span) => {
  // simulate work ...
  span.end();
});
```

---

## Resulting Trace Shape in Aspire Dashboard

After a successful `upload <file>` command, a single trace entry appears with this
waterfall structure:

```
[agents-demo-bot]   demo.bot.upload.route_handler
  └── [agents-demo-api]   api.upload_received
        ├── [agents-demo-worker]   worker.process_document  (~1–3 s)
        └── [agents-demo-bot]     bot.proactive_send
```

Both `worker.process_document` and `bot.proactive_send` are children of
`api.upload_received`. The API awaits them sequentially: worker first, then the notify
call to the bot. The `bot.proactive_send` span carries `demo.conversation.id` and
`demo.result` attributes.

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
