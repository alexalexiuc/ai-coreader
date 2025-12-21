# Starts or stops the fully dockerized stack (app + worker + Mongo + LLM) using the compose stack profile.
[CmdletBinding()]
param(
    [switch] $Down
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $repoRoot "infra/docker-compose.yaml"

if ($Down) {
    Write-Host "Stopping dockerized stack..." -ForegroundColor Cyan
    docker compose -f $composeFile --profile stack down
    return
}

Write-Host "Building and starting dockerized stack..." -ForegroundColor Cyan
docker compose -f $composeFile --profile stack up -d --build --remove-orphans

Write-Host ""
Write-Host "Stack is starting. Check status with:" -ForegroundColor Yellow
Write-Host "  docker compose -f $composeFile --profile stack ps"
Write-Host "App: http://localhost:3000"
Write-Host "LLM: http://localhost:11434"
Write-Host "Mongo: mongodb://localhost:27017"
