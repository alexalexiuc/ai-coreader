# GitHub Copilot Instructions for ai-coreader

## Project Overview

ai-coreader is a full-stack application for collaborative document reading and analysis powered by AI. The project consists of:
- **Frontend**: Next.js 16+ app with React 19, TypeScript, and Tailwind CSS
- **Backend Worker**: Go 1.22+ worker for document processing and AI integration
- **Infrastructure**: MongoDB database and Ollama LLM service

## Repository Structure

```
ai-coreader/
├── coreader-app/          # Next.js frontend application
│   ├── app/               # Next.js app directory (pages, layouts, routes)
│   ├── ui/                # Shared UI components
│   ├── lib/               # Utility libraries and helpers
│   ├── hooks/             # Custom React hooks
│   ├── e2e/               # Playwright e2e tests
│   └── scripts/           # App-specific scripts
├── coreader-worker/       # Go worker for document processing
│   ├── main.go            # Worker entry point
│   ├── db.go              # Database operations
│   ├── llm.go             # LLM integration
│   ├── processFile.go     # File processing logic
│   └── *.go               # Other Go modules
├── infra/                 # Docker Compose and infrastructure
│   ├── docker-compose.yaml
│   └── db/                # Database migrations and scripts
├── scripts/               # Development and deployment scripts
└── AGENTS.md             # AI agent instructions (legacy)
```

## General Coding Principles

### Core Rules
- **Minimal changes**: Keep changes focused and minimal - only modify what's necessary
- **No refactoring**: Don't refactor unrelated code unless explicitly requested
- **Use existing patterns**: Follow established patterns and conventions in the codebase
- **No secrets**: Never commit secrets, credentials, or real tokens
- **Preserve functionality**: Don't remove or modify working code unless absolutely necessary

### When Changes Are Needed
- If you identify additional needed changes during your work, add them to `TODO.md` using this format:
  ```
  - [workspace]: description of needed change
  ```

## Frontend Development (coreader-app/)

### Technology Stack
- **Framework**: Next.js 16+ with App Router
- **UI**: React 19, TypeScript, Tailwind CSS
- **Testing**: Playwright for e2e tests
- **Linting**: ESLint with TypeScript and Next.js configs
- **Formatting**: Prettier with Tailwind plugin

### Coding Conventions

#### React Components
- Use **Server Components by default** - only mark components with `"use client"` when they require:
  - Browser APIs (window, document, localStorage, etc.)
  - Event handlers (onClick, onChange, etc.)
  - React hooks (useState, useEffect, etc.)
  - Client-side interactivity
- Keep route logic close to pages in the `app/` directory
- Place shared/reusable UI components in `ui/` directory
- Custom hooks go in the `hooks/` directory

#### Styling
- Use existing Tailwind CSS patterns from the codebase
- Let Prettier handle formatting (with Tailwind plugin for class sorting)
- Follow mobile-first responsive design patterns

#### TypeScript
- Enable strict type checking - don't use `any` unless absolutely necessary
- Generate database types using `npm run db:types` after schema changes
- Keep types close to where they're used or in dedicated type files

### Development Commands
```bash
# Start development server
npm run app:dev           # or: npm run dev (from root)

# Type checking
npm run typecheck         # Run TypeScript compiler check

# Linting & Formatting
npm run lint              # Run ESLint
npm run format            # Format with Prettier

# Testing
npm run e2e               # Run Playwright e2e tests
npm run e2e:ui            # Run e2e tests with UI

# Build
npm run build             # Production build
npm run start             # Start production server

# Database operations (from root)
npm run db:migrate        # Run database migrations
npm run db:types          # Generate TypeScript types from DB schema
npm run db:seed           # Seed database with test data
npm run db:reset          # Drop and recreate database
```

### Testing
- Add e2e tests in `e2e/` directory for new features
- Tests use Playwright - follow existing test patterns
- Only run tests when changes affect the tested functionality

### Database Integration
- MongoDB connection configured via `MONGODB_URI` environment variable
- Default: `mongodb://localhost:27017`
- After schema changes, regenerate types: `npm run db:types`

## Backend Development (coreader-worker/)

### Technology Stack
- **Language**: Go 1.22+
- **Database**: MongoDB driver
- **LLM**: Ollama integration
- **Environment**: godotenv for configuration

### Coding Conventions

#### Go Style
- Use `gofmt` for formatting (standard Go formatting)
- Follow standard Go project layout
- Prefer explicit error handling over panics

#### Error Handling
- **Never use panics** - always return explicit errors
- Use descriptive error messages
- Wrap errors with context using `fmt.Errorf("context: %w", err)`

#### Context Usage
- Use `context.Context` for all external calls (database, HTTP, LLM)
- Pass context down the call chain
- Respect context cancellation

#### Concurrency
- Use goroutines and channels appropriately
- Avoid shared state - prefer message passing
- Use sync package primitives when needed (Mutex, WaitGroup)

### Development Commands
```bash
# Run worker
npm run worker:run        # From root
# or
cd coreader-worker && go run .

# Format code
gofmt -w .                # Format all Go files

# Build
go build -o worker .      # Build binary
```

### Testing
- Add tests only when behavior changes
- Use table-driven tests for multiple test cases
- Place tests in `*_test.go` files

### Dependencies
- Use Go modules (go.mod/go.sum)
- Run `go mod tidy` after adding/removing dependencies

## Infrastructure & DevOps

### Development Setup

#### Local Development (Recommended)
Run apps on host with infrastructure in Docker:
```bash
# Cross-platform (from root)
npm run dev

# Windows PowerShell
npm run dev:win

# Unix/macOS/Linux
npm run dev:unix
```

This starts:
- MongoDB container
- Ollama LLM container
- Next.js dev server (hot reload)
- Go worker (manual restart needed)

#### Full Docker Stack
Run everything in containers:
```bash
# Start all containers
npm run docker:up

# Stop all containers
npm run docker:down
```

### Environment Variables
- Configure via environment variables (not committed to repo)
- MongoDB: `MONGODB_URI` (default: `mongodb://localhost:27017`)
- Add new env vars to documentation

### Docker Compose
- Main compose file: `infra/docker-compose.yaml`
- Profiles: `infra` (MongoDB + Ollama), `app`, `worker`
- Validate changes when modifying compose files

### Ports
- **App**: http://localhost:3000
- **MongoDB**: mongodb://localhost:27017
- **LLM (Ollama)**: http://localhost:11434

## Database Management

### Schema Changes
1. Create migration in `infra/db/scripts/`
2. Run migration: `npm run db:migrate`
3. Generate TypeScript types: `npm run db:types`
4. Update both frontend and worker code if needed

### Available Commands
```bash
npm run db:migrate        # Apply migrations
npm run db:drop           # Drop entire database
npm run db:seed           # Seed with test data
npm run db:types          # Generate TS types from schema
npm run db:reset          # Drop + migrate (fresh start)
```

## Git Workflow

### Commit Messages
Use this format for all commits:
```
[type]: (AI:{ainame}) description

Optional detailed description explaining changes
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style/formatting (no logic change)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

**Examples:**
- `feat: (AI:Copilot) add user authentication`
- `fix: (AI:Copilot) resolve database connection timeout`
- `docs: (AI:Copilot) update API documentation`

### Branch Strategy
- Feature branches from main
- Reference issues/PRs in commit descriptions when applicable

## Build & Test Strategy

### When to Run Builds/Tests
- **Before changes**: Check for existing issues (not your responsibility to fix unrelated problems)
- **During development**: Run lint/build/test only when changes affect them
- **Documentation changes**: Skip tests unless there are docs-specific tests
- **Final verification**: Run full test suite before marking work complete

### Incremental Development
1. Make small, focused changes
2. Verify each change works
3. Run relevant tests (not full suite)
4. Only run full test suite at the end

## Code Review & Handoff

### Summary Format
When completing work, provide:
1. **Summary of changes**: What was modified and why
2. **Commands run**: Build, test, lint commands executed
3. **Verification**: How changes were verified
4. **Known issues**: Any remaining TODOs or limitations

### Testing Verification
- Document what was tested
- Include test results
- Note any skipped tests and why

## Best Practices Summary

### DO
✅ Follow existing code patterns and conventions
✅ Use TypeScript strict mode in frontend
✅ Return explicit errors in Go (no panics)
✅ Use context.Context for external calls
✅ Mark React components as "use client" only when needed
✅ Run gofmt on Go code
✅ Run Prettier on frontend code
✅ Generate types after database schema changes
✅ Add meaningful commit messages
✅ Keep changes minimal and focused

### DON'T
❌ Commit secrets or credentials
❌ Refactor unrelated code
❌ Remove or modify working code unnecessarily
❌ Add dependencies without justification
❌ Use panics in Go code
❌ Mark all React components as "use client"
❌ Skip type checking or linting
❌ Make infrastructure changes unless requested
❌ Fix unrelated bugs (note them in TODO.md instead)

## Questions or Issues?

If you encounter ambiguity or need clarification:
1. Check existing code for patterns
2. Refer to this file and AGENTS.md
3. Ask for clarification rather than guessing
4. Document assumptions in commit messages
