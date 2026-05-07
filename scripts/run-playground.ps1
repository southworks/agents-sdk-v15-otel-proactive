
param(
  [string]$Endpoint = "http://localhost:3978/api/messages",
  [string]$Channel = "msteams",
  [string]$ClientId,
  [string]$ClientSecret,
  [string]$TenantId
)

# Load .env from repo root when credentials are not already in the session or passed as params.
# Docker Compose reads .env automatically; PowerShell does not.
$envFile = Join-Path $PSScriptRoot ".." ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object {
    $k, $v = $_ -split '=', 2
    $k = $k.Trim(); $v = $v.Trim()
    switch ($k) {
      'BOT_CLIENT_ID'     { if (-not $ClientId)     { $ClientId     = $v } }
      'BOT_CLIENT_SECRET' { if (-not $ClientSecret) { $ClientSecret = $v } }
      'BOT_TENANT_ID'     { if (-not $TenantId)     { $TenantId     = $v } }
    }
  }
}

# Fall back to session environment variables.
if (-not $ClientId)     { $ClientId     = $env:BOT_CLIENT_ID }
if (-not $ClientSecret) { $ClientSecret = $env:BOT_CLIENT_SECRET }
if (-not $TenantId)     { $TenantId     = $env:BOT_TENANT_ID }

Write-Host "Starting Agents Playground" -ForegroundColor Cyan
Write-Host "  endpoint : $Endpoint"
Write-Host "  channel  : $Channel"
Write-Host "  client-id: $ClientId"

$playgroundArgs = @("-e", $Endpoint, "-c", $Channel)
if ($ClientId)     { $playgroundArgs += @("--client-id",     $ClientId) }
if ($ClientSecret) { $playgroundArgs += @("--client-secret", $ClientSecret) }
if ($TenantId)     { $playgroundArgs += @("--tenant-id",     $TenantId) }

agentsplayground @playgroundArgs
