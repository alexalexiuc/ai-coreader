# AGENTS

This file defines default instructions for the entire repository. If you work inside a subdirectory that contains its own `AGENTS.md`, follow the more specific guidance there as well.

## Scope and priorities
- Applies repo-wide unless a nested `AGENTS.md` overrides it.
- Keep diffs focused and well-explained; prefer small, purposeful commits.
- Avoid committing secrets or test credentials; scrub sample values from logs and docs.

## Development workflow
- Check for nested `AGENTS.md` files before editing.
- Keep the codebase lint- and format-clean. Use existing project tooling instead of ad-hoc formatters.
- When adding behavior, include targeted tests where practical and document noteworthy design decisions in code comments or commit messages.

## Frontend (`coreader-app/`)
- Use TypeScript-first React components; mark client components only when necessary.
- Favor Tailwind utility classes already in use and let Prettier + `prettier-plugin-tailwindcss` manage class order.
- Keep shared UI in `ui/`; keep route-specific logic inside `app/` pages or associated server actions.
- Validate changes with `npm run lint`; run `npm run build` for build-sensitive changes; format with `npm run format` instead of manual edits.

## Worker (`coreader-worker/`)
- Format Go changes with `gofmt` (or `go fmt ./...`); organize imports automatically.
- Use `context.Context` for external calls and avoid panics in favor of explicit errors.
- Add or update tests near the code under `./...`; run `go test ./...` after behavior changes.

## Infra and scripts (`infra/`, `scripts/`)
- Keep scripts POSIX-friendly where possible; mirror changes in PowerShell equivalents when both exist.
- Document required environment variables and defaults at the top of scripts.
- For Compose changes, sanity check with `docker compose -f infra/docker-compose.yaml config` when feasible.

## Validation and handoff
- Before handing off work, summarize the changes and the commands you ran (or explain why checks were skipped).
- If you add new files or workflows, mention any setup steps needed for future contributors.
