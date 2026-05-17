
# End-to-End Observability for Bots with Agents SDK v1.5 and OpenTelemetry

## Why this matters
Modern agents orchestrate workflows across services. Without distributed tracing, a single user action becomes hard to debug.

Agents SDK **v1.5** helps in two key ways:

1. **New: Manual OTel bootstrap** — each service preloads an `instrumentation.ts` module via `node --import` that configures gRPC OTLP exporters for traces, metrics, and logs, with a console fallback for local development.
2. **New: Proactive messaging via `AgentApplication.proactive`** — proactive is now first-class with helpers to store a conversation during a live turn and message later by stored ID.

## Demo goal
Track one operation end-to-end:

> `upload <file>` → API → Worker → **proactive notification**

…and observe it in the **Aspire Dashboard**.

## Architecture
- **Bot:** `AgentApplication` (v1.5)
- **API:** Express backend
- **Worker:** Express worker simulating processing
- **Dashboard:** Aspire Dashboard (standalone container)

## Proactive messaging (v1.5)
During the user turn the bot stores the conversation:

- `const convId = await app.proactive.storeConversation(ctx)`

Later, out-of-turn, the bot sends a message by stored ID:

- `await app.proactive.sendActivity(adapter, convId, { text: '...' })`

## OpenTelemetry bootstrap
Each service (`bot`, `api`, `worker`) preloads a dedicated `instrumentation.ts` module
via `node --import ./dist/instrumentation.js ./dist/index.js`. The module creates a
`NodeSDK` instance with:

- **gRPC OTLP exporters** for traces, metrics, and logs when `OTEL_EXPORTER_OTLP_ENDPOINT` is set (targeting Aspire's gRPC port 18889).
- **Console exporters** as a fallback for local development without a collector.
- **Configurable export intervals** via `OTEL_METRICS_EXPORT_INTERVAL` and `OTEL_LOGS_EXPORT_INTERVAL`.
- **Graceful shutdown** — `SIGTERM`/`SIGINT` handlers flush the SDK and call `process.exit()`.

`@microsoft/agents-telemetry` and auto-instrumentation are **not used**. W3C trace
context is propagated explicitly across every HTTP boundary using
`propagation.inject()` on the sending side and `propagation.extract()` on the
receiving side (see `docs/observability.md` for details).

## Failure scenario (for real-world debugging)
To illustrate error handling, the worker sometimes fails (HTTP 500) and records an exception on the span.
Try:

- `upload fail-demo.pdf`

In Aspire, this produces **ERROR spans** across the boundary.

## One metric: processing duration histogram
The worker records `demo.worker.processing.duration.ms` as a histogram metric for each job.
This helps demonstrate that traces + metrics together give a clearer view of performance.

## How to run
```bash
docker compose up --build
```

## How to test
Use Agents Playground:

```bash
agentsplayground -e "http://localhost:3978/api/messages" -c "emulator"
```

## What you will see in Aspire
- Bot → API → Worker spans
- A proactive send path after worker completion
- ERROR spans when the worker fails
- The processing duration metric histogram

## Takeaways
- v1.5 makes observability and proactive messaging first-class.
- A small demo can prove production-grade patterns: trace propagation, async processing, proactive notifications.
