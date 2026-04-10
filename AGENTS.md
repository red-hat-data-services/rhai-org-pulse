# Agent Conventions

Vendor-neutral conventions for AI agents working on this codebase. Tool-specific
configuration (e.g., `.claude/CLAUDE.md`) should reference this file rather than
duplicating these conventions.

## Code style

- `<script setup>` for Vue components
- CommonJS (`require`) for server-side code
- ES modules (`import`) for frontend code
- No TypeScript — plain JavaScript throughout
- Tailwind CSS utility classes for styling; custom `primary` palette in `tailwind.config.mjs`
- Composables (`src/composables/`, `shared/client/composables/`) for shared state logic
- Always run `npm run lint` before committing — CI rejects lint failures

## Testing

- Vitest + @vue/test-utils for frontend tests (`src/__tests__/`, `modules/*/__tests__/client/`)
- Vitest for backend unit tests (`modules/*/__tests__/server/`)
- Module manifest validation: `npm run validate:modules`
- Run `npm test` before committing

## Code review

Review criteria are defined in
[`.github/instructions/review.instructions.md`](.github/instructions/review.instructions.md).
All automated reviews (CI) and manual reviews (`/pr-review`) use this shared
checklist.

## Documentation

Keep docs in sync with code changes:

- **Data format changes**: Update `docs/DATA-FORMATS.md` and `fixtures/`
- **API route changes**: Update the API Routes section in `.claude/CLAUDE.md`
- **New data files or storage paths**: Update Data Flow in `.claude/CLAUDE.md` and `docs/DATA-FORMATS.md`
- **New shared exports**: Update `shared/API.md`
- **Module system changes**: Update `docs/MODULES.md`

## Agent instruction files

| File | Purpose | Audience |
|------|---------|----------|
| `AGENTS.md` (this file) | Vendor-neutral conventions | All AI agents |
| `.claude/CLAUDE.md` | Architecture, integrations, deployment | Claude Code / Claude CI |
| `.github/instructions/review.instructions.md` | Code review checklist | CI review bots, Copilot, `/pr-review` |
| `CONTRIBUTING.md` | Getting started, workflow | Human contributors |
