
# Architecture

This document describes the components that make up the sample and how they connect.

---

## Components

### Bot (`apps/bot`) — port 3978

An `AgentApplication` built with Agents SDK v1.5. It exposes two HTTP endpoints:

- **`POST /api/messages`** — the main bot endpoint, used by Agents Playground to deliver user messages. The `onActivity('message')` handler stores the conversation reference and fires a fire-and-forget request to the API.
- **`POST /api/notify`** — an internal webhook the API calls when the worker finishes. The bot extracts the trace context from the incoming headers and sends a proactive message to the stored conversation.

The bot is the entry and exit point of every trace: it creates the root span on `/api/messages` and closes the trace with `bot.proactive_send` on `/api/notify`.

### API (`apps/api`) — port 3001

A plain Express service with one endpoint:

- **`POST /upload`** — receives the upload request from the bot, calls the worker synchronously, then calls the bot's `/api/notify` with the result. It is the middle layer that connects the bot to the worker and propagates trace context in both directions.

### Worker (`apps/worker`) — port 3002

A plain Express service that simulates document processing:

- **`POST /process`** — waits 1–3 seconds, then returns `success`, `warning`, or fails with HTTP 500 based on a configurable `FAIL_RATE` (default 20%). It records a histogram metric (`demo.worker.processing.duration.ms`) and creates the deepest span in the trace.

The worker is intentionally minimal — its role is to provide a real service boundary with a non-trivial duration and an observable failure mode.

### Aspire Dashboard — port 18888

The [.NET Aspire Dashboard](https://learn.microsoft.com/en-us/dotnet/aspire/fundamentals/dashboard/overview) is run as a standalone Docker container (no .NET project required). It acts as an OTLP-compatible telemetry backend that receives traces, metrics, and logs from all three services over gRPC (container port 18889, mapped to host port 4317).

It is the first service declared in `docker-compose.yml`. All other services point `OTEL_EXPORTER_OTLP_ENDPOINT` at it.

### Microsoft 365 Agents Playground

An external CLI tool that provides a local chat UI for testing bots without a Microsoft 365 tenant or a dev tunnel. It connects directly to `http://localhost:3978/api/messages`.

The `msteams` channel is required (not `emulator`). It generates a locally-signed JWT that includes `claims.aud`, which the Agents SDK needs when calling `app.proactive.storeConversation()`.

See [getting-started.md](./getting-started.md) for install and connect instructions.

### Azure Bot Service

A Single-tenant Azure Bot registration is required for the Agents SDK to authenticate incoming requests. It provides three values that the bot container receives as environment variables:

| Variable | Source |
|---|---|
| `BOT_CLIENT_ID` | Application (client) ID |
| `BOT_CLIENT_SECRET` | Client secret value |
| `BOT_TENANT_ID` | Directory (tenant) ID |

Multi-tenant and User-assigned Managed Identity are not supported for local Docker development. See [getting-started.md](./getting-started.md) for registration steps.

---

## Service interaction flow

```
Playground
    │  POST /api/messages
    ▼
  [Bot]  ── stores conversation (proactive.storeConversation)
    │  POST /upload  (fire-and-forget, trace context in headers)
    ▼
  [API]
    │  POST /process  (trace context in headers)
    ▼
  [Worker]  ── simulates work, emits histogram metric
    │  returns result (success | warning | HTTP 500)
    ▼
  [API]
    │  POST /api/notify  (trace context in headers)
    ▼
  [Bot]  ── sends proactive message (proactive.sendActivity)
    │
    ▼
Playground  (proactive notification delivered to user)
```

All HTTP calls carry W3C `traceparent` headers so every span joins the same trace. See [observability.md](./observability.md) for the propagation implementation.

---

## Trace shape

A successful `upload` produces this span waterfall in Aspire Dashboard:

```
[agents-demo-bot]    demo.bot.upload.route_handler
  └── [agents-demo-api]    api.upload_received
        ├── [agents-demo-worker]  worker.process_document  (~1–3 s)
        └── [agents-demo-bot]    bot.proactive_send
```
