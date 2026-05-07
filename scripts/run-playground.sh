
#!/usr/bin/env bash
set -euo pipefail

ENDPOINT=${1:-"http://localhost:3978/api/messages"}
CHANNEL=${2:-"msteams"}
CLIENT_ID=${BOT_CLIENT_ID:-""}
CLIENT_SECRET=${BOT_CLIENT_SECRET:-""}
TENANT_ID=${BOT_TENANT_ID:-""}

echo "Starting Agents Playground"
echo "  endpoint : ${ENDPOINT}"
echo "  channel  : ${CHANNEL}"
echo "  client-id: ${CLIENT_ID}"

ARGS=("-e" "${ENDPOINT}" "-c" "${CHANNEL}")
[ -n "${CLIENT_ID}" ]     && ARGS+=("--client-id"     "${CLIENT_ID}")
[ -n "${CLIENT_SECRET}" ] && ARGS+=("--client-secret" "${CLIENT_SECRET}")
[ -n "${TENANT_ID}" ]     && ARGS+=("--tenant-id"     "${TENANT_ID}")

agentsplayground "${ARGS[@]}"
