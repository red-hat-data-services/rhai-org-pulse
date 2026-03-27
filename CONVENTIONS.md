# Project Conventions

This document defines the canonical coding and architecture conventions for the Team Tracker project. All contributors (human and automated) should follow these.

## Code Style

- **Vue components**: Use `<script setup>` (Composition API). No Options API.
- **Server code**: CommonJS (`require`/`module.exports`)
- **Client code**: ES modules (`import`/`export`)
- **Language**: Plain JavaScript only. No TypeScript.
- **Styling**: Tailwind CSS utility classes. Custom `primary` color palette in `tailwind.config.mjs`.
- **Composables**: Shared reactive state logic goes in composables (`useXxx` naming convention)

## Architecture

- **Module system**: Built-in modules live in `modules/<slug>/` with `module.json` manifests. Modules are self-contained with `client/`, `server/`, and `__tests__/` directories.
- **Shared code**: Reusable code lives in `shared/client/` and `shared/server/`, imported via the `@shared` Vite alias. Modules must not import from other modules.
- **App shell**: `src/` contains only the application shell (sidebar, landing page, module loader). Business logic belongs in modules.
- **Backend**: Single Express server (`server/dev-server.js`). Module routes mount at `/api/modules/<slug>/`.
- **Storage**: Filesystem-based (`./data/` directory). No database.
- **Auth**: OpenShift OAuth proxy in production sets `X-Forwarded-Email`. Backend checks against `data/allowlist.json`.

## Testing

- **Framework**: Vitest for all tests
- **Frontend tests**: Vitest + `@vue/test-utils` in `src/__tests__/` and `modules/*/__tests__/client/`
- **Backend tests**: Vitest in `modules/*/__tests__/server/`
- **Module validation**: `npm run validate:modules` checks manifests (runs in CI)
- **Run before committing**: `npm test`

## Patterns

- **Caching**: Frontend uses localStorage stale-while-revalidate (`tt_cache:` prefix). API functions accept `onData` callbacks.
- **Composite keys**: Teams are identified by `orgKey::teamName` (e.g., `shgriffi::Model Serving`).
- **Module navigation**: Use `inject('moduleNav')` for `navigateTo(viewId, params)` and `goBack()`.
- **Hash routing**: `#/<module-slug>/<view-id>?key=value`

## What to Avoid

- Don't over-engineer. Keep solutions simple and focused on the task at hand.
- Don't add TypeScript, type annotations, or JSDoc types.
- Don't add features, refactor code, or make "improvements" beyond what was asked.
- Don't create abstractions for one-time operations.
- Don't add error handling for scenarios that can't happen.
