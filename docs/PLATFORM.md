# Platform Extensions

The `platform/` directory holds deployment-specific customizations to core UI.
This is separate from `modules/` (which are for feature domains). Platform
extensions customize core chrome — tabs, panels, branding — without forking
core files.

## How it works

Core discovers platform extensions via Vite's `import.meta.glob`. When
`platform/` is absent (core-only deployments), the globs return empty objects
and no platform extensions are loaded. No conditional logic is needed.

## About Page Tabs (`platform/about-tabs/`)

The About page supports extensible tabs via `platform/about-tabs/manifest.json`.

### Manifest format

```json
{
  "tabs": [
    {
      "id": "docs",
      "label": "Docs",
      "icon": "BookOpen",
      "component": "./DocsTab.vue",
      "order": 15
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique tab identifier |
| `label` | string | yes | Display text on the tab button |
| `icon` | string | yes | Lucide icon name (resolved via shared ICON_MAP) |
| `component` | string | yes | Path to Vue component relative to `platform/about-tabs/` |
| `order` | number | no | Sort position (default: 100) |
| `requireRole` | string | no | Role required to see this tab |

### Core tab ordering

| Order | Tab |
|-------|-----|
| 10 | About |
| 30 | Site Usage |
| 40 | Backups |
| 50 | Help & Debug |

Platform tabs default to `order: 100` (after all core tabs). Set a lower value
to insert between core tabs — e.g., `15` places a tab between About and Site
Usage.

### Adding a new tab

1. Create a Vue component in `platform/about-tabs/` (e.g., `MyTab.vue`)
2. Add an entry to `platform/about-tabs/manifest.json`
3. Run `npm run validate:platform` to verify the manifest
4. The tab appears automatically on the About page

### Component contract

Platform tab components receive no props and emit no events. They are
standalone sections that render their own content.

## Allocation (`platform/allocation/`)

Allocation was removed from `@org-pulse/core` in v2.0.61 and now lives entirely
in this consumer repo as a self-contained `module-views` platform extension at
`platform/allocation/`. It registers into team-tracker's contribution slots via
the discovery seam (a per-team **Allocation** tab, the **Work Allocation**
report, and an **Allocation** settings tab) and ships its own classification
strategy, server engine, and Jira transport.

### Structure

```
platform/allocation/
  manifest.json                 # type module-views, targetModule team-tracker,
                                #   server.entry, secrets (jira), strategy metadata
  team-tracker-contributions.js # register({ registerTeamDetailTab, registerReport,
                                #   registerSettingsTab }) — the discovery seam
  classify.js                   # classifyIssue() + getJiraFields() (owns classification)
  client/                       # tab, settings, report, subcomponents, composables
  server/                       # index.js (entry) + routes/orchestration/…engine
```

### Contribution seam (`team-tracker-contributions.js`)

Core discovers `platform/*/team-tracker-contributions.js` and calls its exported
`register(api)` with an **injected** registrar API — the extension never imports
team-tracker internals:

```js
export function register({ registerTeamDetailTab, registerReport, registerSettingsTab }) {
  registerTeamDetailTab({
    id: 'allocation', label: 'Allocation', order: 40,
    isVisible: () => true, // gated on the strategy being configured
    render: { type: 'component', load: () => import('./client/TeamAllocationTab.vue') }
  })
  // registerReport({ … render: { … './client/reports/AllocationReport.vue' } })
  // registerSettingsTab({ … render: { … './client/AllocationSettings.vue' } })
}
```

`render` is a **descriptor** (`{ type: 'component', load: () => import(...) }`),
never a raw component, so client chunks stay code-split.

### Strategy metadata (`manifest.json` → `strategy`)

The strategy (formerly `platform/allocation-strategy/`) is folded in. Its
metadata lives under `manifest.strategy`:

```json
{
  "strategy": {
    "id": "ai-eng-40-40-20",
    "name": "AI Engineering 40/40/20",
    "description": "Classifies work into Tech Debt & Quality (40%), New Features (40%), and Learning & Enablement (20%)",
    "categories": [
      { "key": "tech-debt-quality", "name": "Tech Debt & Quality", "color": "amber", "target": 40 },
      { "key": "new-features", "name": "New Features", "color": "blue", "target": 40 },
      { "key": "learning-enablement", "name": "Learning & Enablement", "color": "green", "target": 20 }
    ]
  }
}
```

`classify.js` exports `classifyIssue(issue)` (returns a category key or
`'uncategorized'`) and optionally `getJiraFields()` (declares extra Jira field
IDs + an `extract` function). The AI-Eng story-points field remains the
hardcoded `customfield_10028`.

### Self-loading the strategy (core no longer provides it)

Core removed `loadAllocationStrategy` and `context.allocationStrategy`, so the
extension is fully self-sufficient:

- **Backend** — `server/index.js` builds the strategy object from
  `manifest.strategy` + `classify.js` and threads it (plus the Jira transport)
  into `server/routes.js`/orchestration via an augmented context. Routes are
  registered on the passed `router` and mounted by core at
  `/api/modules/team-tracker/allocation/...`. The refresh handler is preserved
  via `context.registerRefresh`.
- **Frontend** — `useAllocationStrategy()` reads `manifest.strategy` directly
  (no core loader). It reports `configured: true` whenever the extension is
  present. Backend metadata is also available at
  `GET /api/modules/team-tracker/allocation/strategy`.

### Secrets

The extension slug is `team-tracker/allocation`, so it does **not** inherit
team-tracker's Jira secrets automatically. `manifest.json` declares the `jira`
platform secret group and `server/index.js` reads `JIRA_EMAIL`/`JIRA_TOKEN` from
`context.secrets` (via core's shared `createJiraClient`) — never `process.env`.

```json
{ "secrets": { "platform": ["jira"] } }
```

### Server-only manifest (no nav item)

Core v2.0.62 allows server-only `module-views` extensions, so the manifest
declares only `server.entry` (plus `secrets` and `strategy`) — no `navItems` or
`client.views`. All UI surfaces through the contribution seam: the per-team
allocation tab, the report card, and the settings tab.

### Adding or changing the strategy

1. Edit `platform/allocation/manifest.json` → `strategy` (categories, targets).
2. Edit `platform/allocation/classify.js` classification logic.
3. Run `npm run validate:platform` to verify the manifest.

## Server Routes (`platform/*/`)

Server-route platform extensions register Express routes on a dedicated mount
path without contributing any UI. Core discovers manifests with
`"type": "server-routes"` and mounts the exported router at the path
specified by `mountPath` (e.g., `/api/usage`).

Requires `@org-pulse/core` ≥ 2.0.95, which adds the `server-routes`
extension type and the `appendToStorage`, `readRawFromStorage`,
`writeRawToStorage`, and `listAllStorageFiles` storage methods used by
server-route extensions.

### Manifest format

```json
{
  "type": "server-routes",
  "mountPath": "/api/usage",
  "server": {
    "entry": "./server/index.js"
  },
  "secrets": {
    "module": [
      {
        "key": "USAGE_TRACKING_HMAC_KEY",
        "description": "HMAC key for pseudonymizing user IDs",
        "required": false
      }
    ]
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | yes | Must be `server-routes` |
| `mountPath` | string | yes | Absolute mount path for the router (e.g., `/api/usage`) |
| `server.entry` | string | yes | Path to the server entry point relative to the extension dir |
| `secrets` | object | no | Secret declarations — use `secrets.module` array with `key`, `description`, and `required` per secret |

### Server entry contract

The entry module must export a single function:

```js
module.exports = function register(router, context) {
  // router — Express Router, already scoped to mountPath
  // context — { storage, requireAuth, requireAdmin, resolveSecret, registerRefresh }
}
```

### Adding a new server-routes extension

1. Create `platform/<name>/manifest.json` with `"type": "server-routes"`
2. Create `platform/<name>/server/index.js` exporting the register function
3. Run `npm run validate:platform` to verify the manifest

## Dockerfile layering

The core frontend builder does NOT include `platform/`. Deployment-specific
Dockerfiles add it:

```dockerfile
# In deploy/ai-eng.frontend.Dockerfile
COPY platform/ ./platform/
```

## Validation

Run `npm run validate:platform` to check manifest structure. This runs
automatically in CI. It gracefully skips if `platform/` doesn't exist
(core-only builds).
