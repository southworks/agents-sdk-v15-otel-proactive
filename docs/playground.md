
# Testing with Microsoft 365 Agents Playground

Agents Playground provides a chat UI for local agents without requiring a tenant or tunneling.

## Prerequisites

- A registered **Azure Bot** (Single-tenant, client secret).
  Follow the official guide: [Provision agent resources using client secret](https://learn.microsoft.com/en-us/microsoft-365/agents-sdk/azure-bot-create-single-secret)

  Summary of steps:
  1. Azure portal → **Create a resource** → **Azure Bot**
  2. Under **Microsoft App ID** → Type of App: **Single-tenant**, Create new Microsoft App ID
  3. After deployment: **Settings** → **Configuration** → **Manage Password**
  4. On the app registration **Overview** blade: copy **Application (client) ID** and **Directory (tenant) ID**
  5. **Certificates & secrets** → **New client secret** → copy the **Value** (shown once)

  > **Note:** Multi-tenant bot creation was deprecated on July 31, 2025. Use Single-tenant or User-assigned Managed Identity for new registrations. User-assigned Managed Identity does not work for local development (no Azure IMDS endpoint available in Docker).

## Install Playground

### Windows
```bat
winget install agentsplayground
```

### macOS/Linux/Windows (npm)
```bash
npm install -g @microsoft/m365agentsplayground
```

## Configure credentials

Copy `.env.example` to `.env` and fill in your Azure Bot values:

```
BOT_CLIENT_ID=<your-app-id>
BOT_CLIENT_SECRET=<your-client-secret>
BOT_TENANT_ID=<your-tenant-id>
```

## Run the demo (Docker)
```bash
docker compose up --build
```

## Start Playground and connect

Use the helper script (reads credentials from your `.env` automatically):

```powershell
# Windows — bypass is needed because the script is unsigned
pwsh -ExecutionPolicy Bypass -File .\scripts\run-playground.ps1
```
```bash
# macOS / Linux
./scripts/run-playground.sh
```

Or run directly:

```bash
agentsplayground -e "http://localhost:3978/api/messages" -c "msteams" \
  --client-id $BOT_CLIENT_ID \
  --client-secret $BOT_CLIENT_SECRET \
  --tenant-id $BOT_TENANT_ID
```

The `msteams` channel is required. It generates a locally-signed JWT that includes `claims.aud`, which the SDK needs to store the conversation reference during a live turn — a prerequisite for proactive messaging.

## Commands to try
- `upload demo.pdf` → success or warning (random)
- `upload fail-demo.pdf` → forces worker failure (ERROR trace)

## Troubleshooting
- If port 3978 is busy, stop the conflicting process or change the `PORT` mapping in `docker-compose.yml`.
- If Playground can't reach the endpoint, verify the bot is listening on `http://localhost:3978/api/messages`.
- No dev tunnel is required — Playground connects directly to `localhost:3978`.
