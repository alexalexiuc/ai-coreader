# Starts dev stack on host: Mongo + LLM via Docker Compose, then Next.js and Go worker locally.
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$composeFile = Join-Path $repoRoot "infra/docker-compose.yaml"

$pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
$shell = if ($pwsh) { $pwsh.Source } else { "powershell" }

Write-Host "Ensuring dockerized app/worker stack is stopped to avoid duplicates..." -ForegroundColor Yellow
$prevErrorPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
docker compose -f $composeFile --profile stack down 2>$null | Out-Null
$ErrorActionPreference = $prevErrorPreference

Write-Host "Starting MongoDB + LLM containers in a separate PowerShell window (logs visible)..." -ForegroundColor Cyan
Start-Process $shell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$repoRoot'; docker compose -f '$composeFile' --profile infra up"
)

function Start-DevProcess {
    param(
        [Parameter(Mandatory = $true)] [string] $Name,
        [Parameter(Mandatory = $true)] [string] $WorkingDir,
        [Parameter(Mandatory = $true)] [string] $Command
    )

    Write-Host "Launching $Name..." -ForegroundColor Green
    Start-Process $shell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$WorkingDir'; $Command"
    )
}

Start-DevProcess -Name "Next.js dev server" -WorkingDir (Join-Path $repoRoot "coreader-app") -Command "npm run dev"
Start-DevProcess -Name "Go worker" -WorkingDir (Join-Path $repoRoot "coreader-worker") -Command "go run ."

Write-Host ""
Write-Host "Dev services started:" -ForegroundColor Yellow
Write-Host "  - MongoDB + LLM containers: docker compose -f $composeFile --profile infra ps"
Write-Host "  - Next.js: http://localhost:3000"
Write-Host "  - LLM: http://localhost:11434"
Write-Host ""
Write-Host "Stop infra when done: docker compose -f $composeFile --profile infra down" -ForegroundColor Yellow
