# Getting Started

This guide covers everything you need to run the sample: creating the required Azure resources, configuring credentials, starting the services, and observing the traces.

## Prerequisites

- **Docker Desktop** (or any Docker engine with Compose support)
- An **Azure subscription** (free tier is sufficient) to register an Azure Bot
- **Microsoft 365 Agents Playground** — installed in Step 4

Optional, for editing code locally: Node.js 20+

---

## Step 1 — Create an Azure Bot Service

The Agents SDK requires a registered Azure Bot for authentication. Multi-tenant registrations were deprecated on July 31, 2025; this sample requires **Single-tenant** with a client secret.

Follow the official guide: [Provision agent resources using client secret](https://learn.microsoft.com/en-us/microsoft-365/agents-sdk/azure-bot-create-single-secret)

Summary of portal steps:
1. Azure portal → **Create a resource** → **Azure Bot**
2. Under **Microsoft App ID**: Type of App → **Single-tenant**, Create new Microsoft App ID
3. After deployment: **Settings → Configuration → Manage Password**
4. On the app registration **Overview** blade: copy **Application (client) ID** and **Directory (tenant) ID**
5. **Certificates & secrets → New client secret** → copy the **Value** (shown only once)

You will need three values from this step: `BOT_CLIENT_ID`, `BOT_CLIENT_SECRET`, and `BOT_TENANT_ID`.

> **Note:** User-assigned Managed Identity does not work for local development — there is no Azure IMDS endpoint available inside Docker containers.

---

## Step 2 — Configure credentials

Copy the example env file and fill in the three values from Step 1:

```bash
cp .env.example .env
```

Edit `.env`:

```
BOT_CLIENT_ID=<your-app-id>
BOT_CLIENT_SECRET=<your-client-secret>
BOT_TENANT_ID=<your-tenant-id>
```

Docker Compose reads these values and passes them to the bot container using the Agents SDK v1.5 connection settings format:

```yaml
- connections__serviceConnection__settings__clientId=${BOT_CLIENT_ID}
- connections__serviceConnection__settings__clientSecret=${BOT_CLIENT_SECRET}
- connections__serviceConnection__settings__tenantId=${BOT_TENANT_ID}
```

The double-underscore (`__`) notation is how the v1.5 SDK maps environment variables to nested configuration objects. If you see authentication errors in the bot logs, this is the first thing to check.

---

## Step 3 — Start the stack

From the repository root:

```bash
docker compose --env-file .env up --build
```

This starts four services:

| Service  | Port                          | Role                                              |
|----------|-------------------------------|---------------------------------------------------|
| `aspire` | 18888 (UI), 4317 (OTLP gRPC)  | Aspire Dashboard — receives all OTLP telemetry    |
| `bot`    | 3978                          | Agents SDK bot — `/api/messages` + `/api/notify`  |
| `api`    | 3001                          | Express API — `/upload` endpoint                  |
| `worker` | 3002                          | Express mock worker — `/process` endpoint         |

All three app services point `OTEL_EXPORTER_OTLP_ENDPOINT` at the `aspire` container so their traces, metrics, and logs flow to one place. Each service is identified by its `OTEL_SERVICE_NAME` (`agents-demo-bot`, `agents-demo-api`, `agents-demo-worker`).

The `aspire` service is declared first in `docker-compose.yml` — it is the telemetry backend the other services depend on.

---

## Step 4 — Install and connect Agents Playground

Agents Playground provides a local chat UI. No dev tunnel or Microsoft 365 tenant is required.

**Install:**

```bat
REM Windows
winget install agentsplayground
```

```bash
# macOS / Linux / Windows (npm)
npm install -g @microsoft/m365agentsplayground
```

**Connect using the helper script** (reads credentials from `.env` automatically):

```powershell
# Windows — bypass needed because the script is unsigned
pwsh -ExecutionPolicy Bypass -File .\scripts\run-playground.ps1
```

```bash
# macOS / Linux
./scripts/run-playground.sh
```

Or connect manually:

```bash
agentsplayground -e "http://localhost:3978/api/messages" -c "msteams" \
  --client-id $BOT_CLIENT_ID \
  --client-secret $BOT_CLIENT_SECRET \
  --tenant-id $BOT_TENANT_ID
```

> **Why `msteams` and not `emulator`?** The `msteams` channel generates a locally-signed JWT that includes `claims.aud`. The Agents SDK uses that claim when storing the conversation reference — a prerequisite for the proactive messaging flow. The `emulator` channel omits `aud`, which causes `storeConversation` to fail silently.

---

## Step 5 — Try the sample

In the Playground chat window:

- `upload demo.pdf` — starts a trace; worker returns success or warning (random)
- `upload fail-demo.pdf` — forces a worker failure; the trace shows ERROR spans

Expected sequence:
1. Bot acknowledges the upload immediately: _"Processing started."_
2. The worker processes for 1–3 seconds.
3. The bot sends a proactive message with the result.

---

## Step 6 — Observe in Aspire Dashboard

Open `http://localhost:18888` in a browser.

### Traces

Select **Traces** from the left menu. After an `upload` command you will see a trace entry spanning all three services. Click it to open the waterfall:

```
[agents-demo-bot]    demo.bot.upload.route_handler
  └── [agents-demo-api]    api.upload_received
        ├── [agents-demo-worker]  worker.process_document  (~1–3 s)
        └── [agents-demo-bot]    bot.proactive_send
```

All four spans share the same `traceId`. Click any span to inspect its duration, attributes (`demo.file.name`, `demo.conversation.id`, `demo.result`), and — for failed runs — the recorded exception and ERROR status.

> **Tip:** The Agents SDK emits internal spans for message processing. To focus on the cross-service boundaries, filter by service name (`agents-demo-api` or `agents-demo-worker`) or collapse the internal children in the waterfall view.

### Failure path

Send `upload fail-demo.pdf`. The `worker.process_document` span appears in red with ERROR status and a recorded exception. The `bot.proactive_send` span still completes — the proactive notification is sent regardless of worker outcome.

### Metrics

Select **Metrics** and look for `demo.worker.processing.duration.ms` — a histogram recorded by the worker for each job. Expand it to see the distribution of processing times across runs.

---

## Stop the demo

```bash
docker compose down
```

Add `-v` to also remove any volumes your environment created.

---

## Troubleshooting

- **Port 3978 already in use:** stop the conflicting process or change the `PORT` mapping in `docker-compose.yml`
- **Playground can't reach the endpoint:** verify the bot container is running (`docker ps`) and listening on port 3978
- **No proactive message received:** check bot logs (`docker compose logs bot`) — if `storeConversation` failed, the `convId` will be missing from the notify call
- **Traces not appearing in Aspire:** wait 5–10 seconds; export intervals default to 5000 ms. If still missing, confirm all four containers are running (`docker compose ps`)
