# Reset script for AI CoReader infrastructure
# Optionally wipes MongoDB and/or Qdrant data

param(
    [switch]$Mongo,
    [switch]$Qdrant,
    [switch]$All,
    [switch]$Help
)

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$composeFile = Join-Path $repoRoot "infra\docker-compose.yaml"
$storageDir = Join-Path $repoRoot "storage"

function Show-Usage {
    Write-Host @"
Usage: .\scripts\reset-infra.ps1 [OPTIONS]

Reset infrastructure data for AI CoReader.

OPTIONS:
  -Mongo          Reset MongoDB data only
  -Qdrant         Reset Qdrant data only
  -All            Reset all data (MongoDB, Qdrant) [default]
  -Help           Show this help message

EXAMPLES:
  .\scripts\reset-infra.ps1 -All        # Reset all data
  .\scripts\reset-infra.ps1 -Qdrant     # Reset only Qdrant data
  .\scripts\reset-infra.ps1 -Mongo      # Reset only MongoDB data
"@
}

if ($Help) {
    Show-Usage
    exit 0
}

# Default: reset all if no specific option provided
$resetMongo = $Mongo -or $All -or (-not $Mongo -and -not $Qdrant)
$resetQdrant = $Qdrant -or $All -or (-not $Mongo -and -not $Qdrant)

Write-Host "AI CoReader Infrastructure Reset"
Write-Host "================================="
Write-Host ""

# Stop all containers first
Write-Host "Stopping all containers..."
docker compose -f $composeFile --profile infra down 2>$null
docker compose -f $composeFile --profile stack down 2>$null

if ($resetMongo) {
    Write-Host ""
    Write-Host "Resetting MongoDB data..."
    $mongoDir = Join-Path $storageDir "mongo"
    if (Test-Path $mongoDir) {
        Remove-Item -Path $mongoDir -Recurse -Force
        Write-Host "  ✓ MongoDB data removed"
    } else {
        Write-Host "  ℹ MongoDB data directory does not exist"
    }
}

if ($resetQdrant) {
    Write-Host ""
    Write-Host "Resetting Qdrant data..."
    $qdrantDir = Join-Path $storageDir "qdrant"
    if (Test-Path $qdrantDir) {
        Remove-Item -Path $qdrantDir -Recurse -Force
        Write-Host "  ✓ Qdrant data removed"
    } else {
        Write-Host "  ℹ Qdrant data directory does not exist"
    }
}

Write-Host ""
Write-Host "================================="
Write-Host "Reset complete!"
Write-Host ""
Write-Host "To start services again:"
Write-Host "  - Dev mode (host): pwsh .\scripts\dev.ps1"
Write-Host "  - Docker stack: pwsh .\scripts\up-docker.ps1"
