Infra-specific guidance (inherits root AGENTS.md).

## Schemas, types, and migrations

- Source of truth: `infra/db/schemas/*.schema.json`. Update these first for DB shape changes.
- Regenerate everything from repo root with `npm run db:types` (runs `infra/db/scripts/generate-types.js`):
  - BSON validators → `infra/db/validators/*.schema.json`
  - TS types → `coreader-app/lib/db/generated/db-types.ts`
  - Go types → `coreader-worker/dbtypes.go`
- Apply/create collections: `npm run db:migrate` (uses `infra/db/scripts/migrate.js` + migrations under `infra/db/migrations/`). Migration `20251221235500-init.js` reads validators to enforce schemas.
- Reset/seed helpers: `npm run db:reset` (drop + migrate), `npm run db:seed`, `npm run db:drop`. Ensure `MONGODB_URI` and `MONGODB_DB_NAME` are set (dotenv handled via `dotenv-mono`).

## When editing infra

- Prefer adding a migration over mutating existing ones. Keep validator/migration changes in sync with schema updates and regenerated types.
- Docker Compose lives in `infra/docker-compose.yaml`; avoid changing ports/services unless required by the task.
