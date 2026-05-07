
# Architecture (v1.5 compliant)

**Chat UI:** Microsoft 365 Agents Playground (recommended).  
**Agent runtime:** `AgentApplication` hosted in Node.js.

## End-to-end flow

1. User sends `upload <filename>`
2. Bot stores conversation using `app.proactive.storeConversation(ctx)`
3. Bot calls Backend API `/upload` with `{ fileName, convId }`
4. API calls Worker `/process` (mock)
5. Worker returns a random result: `success` | `warning` OR fails with HTTP 500
6. API calls Bot webhook `/api/notify` with `{ convId, result, fileName }`
7. Bot uses `app.proactive.sendActivity(adapter, convId, ...)` to send a proactive message

## Observability
All components export OTLP traces (and worker metrics) to Aspire Dashboard.
