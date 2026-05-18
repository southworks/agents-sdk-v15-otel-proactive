# Agents SDK v1.5 — Distributed Tracing and Proactive Messaging

This sample demonstrates **distributed tracing across three services** using OpenTelemetry and the Agents SDK v1.5. A bot, an API, and a worker each run in separate containers; a single user action produces one connected trace waterfall visible in the Aspire Dashboard.

It also showcases `AgentApplication.proactive` — the v1.5 first-class API for sending messages outside of an active user turn — and wires the proactive send into the same trace.

## End-to-end flow

1. User sends `upload <filename>` to the bot.
2. The bot stores the conversation via `app.proactive.storeConversation(ctx)` and fires a request to the API.
3. The API forwards work to the worker.
4. The worker simulates processing (1–3 s) and may fail (HTTP 500).
5. The API notifies the bot with the result.
6. The bot sends a proactive completion message via `app.proactive.sendActivity(...)`.

All spans — across all three processes — share one `traceId` through explicit W3C Trace Context propagation.

## What the Sample Shows

- **Distributed tracing across three services** — bot, API, and worker share one `traceId` via explicit W3C Trace Context propagation
- **Proactive messaging** via `AgentApplication.proactive` — store a conversation reference during a user turn, send a message back after async work completes
- Manual OpenTelemetry bootstrap via preloaded `instrumentation.ts` modules (traces, metrics, logs) for all three services
- A failure path that records exceptions and surfaces ERROR spans across service boundaries
- A custom histogram metric: `demo.worker.processing.duration.ms`

## Quick Start

Run the full stack with Docker:

```bash
docker compose up --build
```

Useful local endpoints:

- Bot endpoint: `http://localhost:3978/api/messages`
- API endpoint: `http://localhost:3001/upload`
- Worker endpoint: `http://localhost:3002/process`
- Aspire Dashboard UI: `http://localhost:18888`

For a fuller local setup flow, see [GETTING_STARTED.md](./GETTING_STARTED.md).

## Test with Agents Playground

Install Microsoft 365 Agents Playground:

- Windows: `winget install agentsplayground`
- npm: `npm install -g @microsoft/m365agentsplayground`

Connect Playground to the bot:

```bash
agentsplayground -e "http://localhost:3978/api/messages" -c "emulator"
```

Commands to try:

- `upload demo.pdf`
- `upload fail-demo.pdf`

More detail: [docs/playground.md](./docs/playground.md)

## Documentation

- [GETTING_STARTED.md](./GETTING_STARTED.md) for setup and local workflow
- [docs/architecture.md](./docs/architecture.md) for the service flow
- [docs/observability.md](./docs/observability.md) for the distributed tracing implementation — explicit W3C propagation across all three services
- [docs/article.md](./docs/article.md) for the longer-form write-up / blog post
- [docs/playground.md](./docs/playground.md) for playground usage and troubleshooting

## Repository Layout

- `apps/bot` for the Agents SDK v1.5 `AgentApplication`
- `apps/api` for the Express upload API
- `apps/worker` for the mock processing worker
- `docs` for architecture notes and narrative docs
- `scripts` for local helper scripts

## Contributing

Contributions are welcome. Use [CONTRIBUTING.md](./CONTRIBUTING.md) for the repository workflow and contribution expectations.

## Code of Conduct

Project participation is governed by [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## License

This repository is covered by the [MIT License](./LICENSE).
