# AGENTS.md

Default instructions for AI agents working in this repository.
Nested AGENTS.md files override this one.

## General rules

- Keep changes focused and minimal
- Do not add dependencies or refactor unrelated code unless asked
- Never commit secrets, credentials, or real tokens
- Prefer existing tooling and conventions

## Repo structure

- coreader-app/ → Frontend (NextJs)
- coreader-worker/ → Go worker
- infra/, scripts/ → Infra and utilities

## Frontend (coreader-app/)

- Use NextJs (React + TypeScript)
- Mark client components only when required
- Use existing Tailwind patterns; let Prettier handle formatting
- Shared UI goes in `ui/`, route logic stays close to pages
- Run lint/build only when changes affect them

## Worker (coreader-worker/)

- Use gofmt
- Avoid panics; return explicit errors
- Use context.Context for external calls
- Add tests only when behavior changes

## Infra & scripts

- Avoid infra changes unless explicitly requested
- Document env vars in scripts
- Validate docker-compose changes when touched

## Handoff

- Summarize changes
- List commands run (or say why not)

## Commit messages

- Use `[type]: (AI:{ainame}) description` format
- Types: feat, fix, docs, style, refactor, test, chore
- Example: `feat: (AI:Codex) add new API endpoint for user data`
- Add detailed description if needed
- Reference issues/PRs if applicable
