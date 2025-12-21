#!/usr/bin/env node
console.log(`
Available root npm scripts (examples):

  npm run dev          # Start host dev stack (uses PowerShell on Windows or bash on Unix)
  npm run docker:up    # Start full dockerized stack (app + worker + infra)
  npm run docker:down  # Stop full dockerized stack
  npm run app:dev      # Start only Next.js dev server (in coreader-app)
  npm run app:start    # Start Next.js app (production)
  npm run worker:run   # Run Go worker locally (requires Go installed)
  npm run lint         # Run frontend linter
  npm run format       # Run frontend formatter

Note: On Windows you can also run the native PS scripts in ./scripts directly (e.g. pwsh ./scripts/dev.ps1).
`);
