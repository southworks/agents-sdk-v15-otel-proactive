# Getting Started

This repository runs as three Node.js services plus the Aspire Dashboard, orchestrated through Docker Compose.

## Prerequisites

- Docker Desktop or a compatible Docker engine with Compose support
- A registered **Azure Bot** (Single-tenant, client secret) — see [Provision agent resources using client secret](https://learn.microsoft.com/en-us/microsoft-365/agents-sdk/azure-bot-create-single-secret) for the exact portal steps
  (Multi-tenant was deprecated July 31, 2025; User-assigned Managed Identity does not work in local Docker)
- Microsoft 365 Agents Playground if you want the chat UI

Optional local tools for editing or manual runs:

- Node.js 20+
- npm

## Configure credentials

Copy `.env.example` to `.env` and fill in your Azure Bot values:

```bash
cp .env.example .env
```

Edit `.env`:

```
BOT_CLIENT_ID=<your-app-id>
BOT_CLIENT_SECRET=<your-client-secret>
BOT_TENANT_ID=<your-tenant-id>
```

## Start the Full Demo

From the repository root:

```bash
docker compose up --build
```

When the containers are ready, these endpoints should be available:

- Bot: `http://localhost:3978/api/messages`
- API: `http://localhost:3001/upload`
- Worker: `http://localhost:3002/process`
- Aspire Dashboard: `http://localhost:18888`

## Run the Chat UI

Install Agents Playground:

```bash
winget install agentsplayground
```

or

```bash
npm install -g @microsoft/m365agentsplayground
```

Then use the helper script (reads credentials from `.env`):

```powershell
# Windows — bypass is needed because the script is unsigned
pwsh -ExecutionPolicy Bypass -File .\scripts\run-playground.ps1
```
```bash
# macOS / Linux
./scripts/run-playground.sh
```

See `docs/playground.md` for full details and manual command options.

## Try the Sample Flow

In the Playground chat window, send one of these commands:

- `upload demo.pdf`
- `upload fail-demo.pdf`

Expected behavior:

- The bot acknowledges the upload immediately.
- The API forwards the request to the worker.
- The worker emits spans and a metric.
- The bot later sends a proactive completion message.

If you use `fail-demo.pdf`, the worker forces a failure so the trace shows an error path.

## Observe Telemetry

Open Aspire Dashboard at `http://localhost:18888` and inspect:

- traces flowing across bot, API, worker, and proactive send
- error spans for the forced failure case
- the `demo.worker.processing.duration.ms` metric

## Stop the Demo

```bash
docker compose down
```

Add `-v` if you also want to remove any attached volumes created by your environment.
