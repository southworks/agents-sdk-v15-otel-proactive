
# End-to-End Observability for Bots with Agents SDK v1.5 and OpenTelemetry

## Why this matters
Modern agents orchestrate workflows across services. Without distributed tracing, a single user action becomes hard to debug.

Agents SDK **v1.5** helps in two key ways:

1. **New: OpenTelemetry support** via `@microsoft/agents-telemetry` — SDK components are instrumented out-of-the-box; you only need to wire OpenTelemetry exporters early.
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

## OpenTelemetry (v1.5)
The bot wires OTLP exporters early (before SDK code runs). Agents SDK emits spans through `@microsoft/agents-telemetry`.

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
