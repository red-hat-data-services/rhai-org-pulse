<!-- Space: RHAI -->
<!-- Parent: Org Pulse Application -->
<!-- Title: Org Pulse — Contributor's Guide -->

# Contributor's Guide

This page provides a curated overview of how to contribute to Org Pulse. For full details, see the source docs in the repository:
- [CONTRIBUTING.md](https://github.com/red-hat-data-services/rhai-org-pulse/blob/main/CONTRIBUTING.md) — Development workflow and code style
- [Module Development Guide](https://github.com/red-hat-data-services/rhai-org-pulse/blob/main/docs/MODULES.md) — Building new modules

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Node.js** | 18+ (20 recommended) |
| **npm** | Included with Node.js |
| **Red Hat VPN** | Required for LDAP roster sync (not needed in Demo Mode) |
| **Jira API Token** | Required for live data (not needed in Demo Mode) |
| **Git** | Standard Git workflow |

**Demo Mode** is available for contributors who don't have VPN access or API credentials. It loads fixture data so you can develop and test UI changes without any external dependencies.

## Getting Started

```bash
# 1. Clone and install
git clone https://github.com/red-hat-data-services/rhai-org-pulse.git
cd rhai-org-pulse
npm install

# 2. Configure environment
cp .env.example .env
# For Demo Mode: set DEMO_MODE=true and VITE_DEMO_MODE=true
# For Live Data: fill in JIRA_EMAIL, JIRA_TOKEN, GITHUB_TOKEN, etc.

# 3. Run locally
npm run dev
# Frontend: http://localhost:5173
# Backend:  http://localhost:3001
# API Docs: http://localhost:3001/api/docs

# 4. Run tests and linting
npm test
npm run lint
```

## Project Structure

```
src/              Frontend shell (Vue 3 SPA, routing, settings)
modules/          Self-contained modules (each with client/ and server/)
server/           Express.js backend (API server, module loader)
shared/           Shared code (composables, services, integrations)
deploy/           Dockerfiles, nginx config, OpenShift manifests
fixtures/         Demo mode data (matches production JSON schema)
scripts/          Validation and utility scripts
```

## Making Changes

### Branch Naming

Use descriptive branch names: `feature/add-widget`, `fix/roster-sync-timeout`, `docs/update-readme`

### Development Workflow

1. Create a branch from `main`
2. Make your changes
3. Run `npm test` and `npm run lint` — both must pass
4. Open a PR against `main`
5. All PRs require review — automated Claude code review also runs on every PR
6. Once approved, merge triggers ArgoCD deployment

### Code Style

| Area | Convention |
|---|---|
| **Vue components** | `<script setup>` composition API |
| **Backend** | CommonJS (`require`/`module.exports`) |
| **Styling** | Tailwind CSS utility classes |
| **TypeScript** | Not used — plain JavaScript throughout |
| **Testing** | Vitest + @vue/test-utils + jsdom |

## Building a New Module

Org Pulse uses a **modular architecture** — each module is a self-contained directory under `modules/` with its own frontend, backend, and manifest.

### Quick Start

1. Copy an existing module directory as a template
2. Edit `module.json` with your module's name, slug, description, icon, and views
3. Implement your frontend views in `client/`
4. Implement your API routes in `server/`
5. Run `node scripts/validate-modules.js` to verify your manifest
6. Add a CODEOWNERS entry for your module directory

### Module Manifest (`module.json`)

Every module requires a `module.json` manifest:

| Field | Required | Description |
|---|---|---|
| `name` | Yes | Display name (e.g., "Team Tracker") |
| `slug` | Yes | URL-safe identifier, must match directory name |
| `description` | Yes | One-line description |
| `icon` | Yes | Lucide icon name (e.g., "BarChart") |
| `order` | No | Sidebar sort order (default: 0) |
| `defaultEnabled` | No | Whether enabled by default (default: true) |
| `requires` | No | Array of module slugs this module depends on |
| `client.entry` | Yes | Frontend entry point (e.g., "./client/index.js") |
| `client.navItems` | Yes | Sidebar navigation items with id, label, icon |
| `server.entry` | Yes | Backend entry point (e.g., "./server/index.js") |

### Key Rules

- **Modules cannot import from each other** — only from `@shared/`
- **Backend routes mount automatically** at `/api/modules/<slug>/`
- **Frontend views load dynamically** via `import.meta.glob`
- **Settings UI** is optional — add `client.settingsComponent` to your manifest to get a tab in the admin Settings panel

### Optional Hooks

| Hook | Purpose | Details |
|---|---|---|
| **Export** | Anonymized data export for demo fixtures | Add `export.customHandler: true` and implement `server/export.js` |
| **Diagnostics** | Health checks for must-gather bundles | Register a callback via `context.registerDiagnostics()` |

## PR Checklist

Before submitting your PR, verify:

- [ ] `module.json` is valid (`node scripts/validate-modules.js`)
- [ ] Slug matches directory name
- [ ] All `navItem` IDs are unique
- [ ] Frontend entry file exists and exports routes + views
- [ ] Backend entry file exists and exports a route registration function
- [ ] Tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] CODEOWNERS entry added for your module

## Questions?

- **GitHub Issues**: [rhai-org-pulse/issues](https://github.com/red-hat-data-services/rhai-org-pulse/issues)
- **Module Guide**: [docs/MODULES.md](https://github.com/red-hat-data-services/rhai-org-pulse/blob/main/docs/MODULES.md)
- **Contributing Guide**: [CONTRIBUTING.md](https://github.com/red-hat-data-services/rhai-org-pulse/blob/main/CONTRIBUTING.md)

---

*This page is a curated summary. For full details, see the linked repository docs. To propose changes, submit a PR to [docs/confluence/](https://github.com/red-hat-data-services/rhai-org-pulse/tree/main/docs/confluence).*
