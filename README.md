# Agents SDK v1.5 OpenTelemetry Proactive Demo

This repository started from an open source project template and now hosts a focused sample for **Agents SDK v1.5**, **OpenTelemetry**, and **proactive messaging**. The repo has been cleaned up so the template's standard project docs remain useful while the sample-specific implementation and walkthroughs stay front and center.

## Goals

This sample demonstrates one end-to-end agent workflow:

1. A user sends `upload <filename>` to the bot.
2. The bot stores the conversation using `AgentApplication.proactive`.
3. The API forwards work to a worker service.
4. The worker emits traces, metrics, and optional failures.
5. The bot sends a proactive completion message back to the user.

The repo is intended as an educational baseline you can extend incrementally.

## What the Sample Shows

- Manual OpenTelemetry bootstrap via preloaded `instrumentation.ts` modules (traces, metrics, logs) for all three services
- Proactive messaging through `AgentApplication.proactive`
- A multi-service trace path across bot, API, and worker
- A failure path that records exceptions and surfaces error spans
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
- [docs/decisions.md](./docs/decisions.md) for design choices
- [docs/article.md](./docs/article.md) for the longer-form write-up
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
