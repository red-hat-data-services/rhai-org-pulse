# Agent Conventions

Vendor-neutral conventions for AI agents working on this codebase. Tool-specific
configuration (e.g., `.claude/CLAUDE.md`) should import this file rather than
duplicating these conventions.

## Project Overview

**Org Pulse** — a modular engineering dashboard connecting Jira, GitHub, and
GitLab data with a team roster to surface delivery insights. Vue 3 + Express,
deployed on OpenShift via ArgoCD.

## Architecture

- **Frontend**: Vue 3 SPA (`<script setup>`), Vite 6, Tailwind CSS 3, Chart.js 4
- **Backend**: Express (port 3001), single `server/dev-server.js` for dev + prod
- **Modules**: Built-in modules in `modules/<slug>/` with `module.json` manifests, auto-discovered
- **Auth**: OpenShift OAuth proxy in prod; no auth locally (uses `ADMIN_EMAILS`)
- **Storage**: Local filesystem (`./data/`), mounted as PVC in OpenShift
- **Shared code**: `shared/client/` and `shared/server/`, importable via `@shared` alias

See `docs/MODULES.md` for the module development guide.

## Hard Constraints

These are non-negotiable. Every PR should be checked against them.

### 1. No cross-module imports

Modules import only from `@shared`. Cross-module data access goes through
`readFromStorage()` for files listed in another module's `module.json > export.files`,
or through API calls at `/api/modules/<slug>/`. Never import directly from
another module's directory. See `shared/API.md` for the stability contract.

### 2. Use storage abstractions for all data

Always use `readFromStorage` / `writeToStorage` for data files. Never construct
raw filesystem paths. These abstractions handle demo mode, path-traversal safety,
and the PVC mount.

### 3. The app is a display layer, not a compute engine

If something requires significant computation — complex aggregations across
hundreds of Jira issues, ML scoring, data enrichment, bulk cross-referencing —
it belongs in an external process (CI pipeline, GitLab job, scheduled task)
that pushes pre-computed results into the app. The app backend should do
lightweight fetching, caching, and serving. Feature Traffic and AI Impact
assessments are good examples of this pattern: external pipelines push data
via the bulk API endpoints.

### 4. New pages go in existing modules when the domain overlaps

Only create a new module when it has a genuinely distinct domain with no
conceptual home in an existing module. If a feature is a new way to look at
data that relates to an existing module's purpose, add it as a view there.
Current modules: ai-impact, feature-traffic, release-analysis, release-planning,
system-health, team-tracker, upstream-pulse.

### 5. No TypeScript

Plain JavaScript throughout. CommonJS (`require`) for server-side code, ES
modules (`import`) for frontend code.

### 6. API routes require OpenAPI annotations

Every new or modified Express route handler must have an `@openapi` JSDoc
annotation. CI enforces a minimum operation count via `validate:openapi`.

### 7. Keep documentation in sync

Documentation changes must land in the same PR as the code they describe:

- **Data format changes** → update `docs/DATA-FORMATS.md` and `fixtures/`
- **New shared exports** → update `shared/API.md`
- **Module system changes** → update `docs/MODULES.md`
- **API route changes** → update the API Routes section in `.claude/CLAUDE.md`

## Code Style

- `<script setup>` for Vue components
- Tailwind CSS utility classes; custom `primary` palette in `tailwind.config.mjs`
- Composables for shared state logic (`shared/client/composables/`)
- Always run `npm run lint` before committing — CI rejects lint failures
- A pre-commit hook (`lint-staged` + `husky`) auto-runs ESLint on staged files

## Testing

- **Unit tests**: Vitest + @vue/test-utils for frontend, Vitest for backend
- **Smoke tests**: Playwright against production containers (verify app loads)
- **Integration tests**: Playwright module-specific tests (`make test-module MODULE=<name>`)
- **Validation**: `npm run validate:modules` for module manifests
- Run `npm test` before committing

## Code Review

Review criteria are defined in
[`.github/instructions/review.instructions.md`](.github/instructions/review.instructions.md).
All automated reviews (CI) and manual reviews (`/pr-review`) use this shared
checklist, which explicitly enforces the hard constraints above.

## Commands

```bash
npm run dev:full              # Start Vite (5173) + Express (3001)
npm run dev                   # Vite only
npm run dev:server            # Express only (needs .env)
npm test                      # Run all tests
npm run test:watch            # Watch mode
npm run lint                  # Lint check
npm run validate:modules      # Validate module manifests

# Container-based tests (requires Docker/Podman)
make smoke-test               # Run smoke tests against containers
make test-module MODULE=<name>  # Run integration tests for a module
```

## Agent Instruction Files

| File | Purpose | Audience |
|------|---------|----------|
| `AGENTS.md` (this file) | Project conventions + hard constraints | All AI agents |
| `.claude/CLAUDE.md` | Architecture details, API routes, deployment | Claude Code |
| `.github/instructions/review.instructions.md` | Code review checklist | CI bots, Copilot, `/pr-review` |
| `CONTRIBUTING.md` | Getting started, workflow | Human contributors |
| `shared/API.md` | Shared export stability contract | All |
| `docs/MODULES.md` | Module development guide | All |
| `docs/DATA-FORMATS.md` | JSON schemas for data files | All |
