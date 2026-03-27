# Module Development Guide

This document covers how to create, develop, and contribute built-in modules for Org Pulse.

## Quick Start

> **Tip:** If you use [Claude Code](https://claude.com/claude-code), run `/create-module` to bootstrap a new module interactively.

1. Copy the template: `cp -r docs/module-template modules/your-module`
2. Edit `modules/your-module/module.json` with your module's name, slug, description, and icon
3. Implement your views in `modules/your-module/client/views/`
4. Add API routes in `modules/your-module/server/index.js`
5. Run `npm run validate:modules` to verify your manifest
6. Run `npm test` to ensure everything works

## Module Structure

```
modules/your-module/
  module.json              # Module manifest (required)
  client/
    index.js               # Frontend entry: exports { routes }
    views/
      MainView.vue         # Your Vue views
    components/            # Module-private components
    composables/           # Module-private composables
  server/
    index.js               # Backend entry: exports function(router, context)
  __tests__/
    client/                # Frontend tests
    server/                # Backend tests
```

## module.json Reference

```json
{
  "name": "My Module",
  "slug": "my-module",
  "description": "What this module does",
  "icon": "box",
  "order": 10,
  "client": {
    "entry": "./client/index.js",
    "navItems": [
      { "id": "main", "label": "Main", "icon": "BarChart3", "default": true },
      { "id": "detail", "label": "Detail", "icon": "FileText" }
    ],
    "settingsComponent": "./client/components/MySettings.vue"
  },
  "server": {
    "entry": "./server/index.js"
  }
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display name shown in sidebar and landing page |
| `slug` | Yes | URL-safe identifier, must match directory name |
| `description` | Yes | Short description for the landing page |
| `icon` | Yes | Lucide icon name (e.g., `bar-chart`, `box`, `search`) |
| `order` | No | Sort order on landing page (default: 100, lower = first) |
| `defaultEnabled` | No | Whether the module is enabled by default (default: `true`) |
| `requires` | No | Array of module slugs this module depends on (default: `[]`) |
| `client.entry` | No | Path to frontend entry point |
| `client.navItems` | No | Sidebar navigation items |
| `client.settingsComponent` | No | Vue component for the Settings page |
| `server.entry` | No | Path to backend entry point |

### navItems vs routes

- **`navItems`** defines what appears in the sidebar. Each has `id`, `label`, `icon`, and optionally `default: true`.
- **`routes`** (exported from `client/index.js`) is a superset of navItems — it includes sidebar items AND internal views navigated to programmatically (e.g., detail views).

## Frontend Entry (`client/index.js`)

```javascript
import { defineAsyncComponent } from 'vue'

export const routes = {
  'main': defineAsyncComponent(() => import('./views/MainView.vue')),
  'detail': defineAsyncComponent(() => import('./views/DetailView.vue')),
}
```

Use `defineAsyncComponent` for lazy loading.

## Navigation API

The shell provides a `moduleNav` object via Vue's `provide/inject`:

```javascript
import { inject } from 'vue'

const nav = inject('moduleNav')

// Navigate to a view within your module
nav.navigateTo('detail', { id: '123' })

// Go back via browser history
nav.goBack()

// Read current route params (reactive)
const id = computed(() => nav.params.value.id)
```

### Hash URL Format

Navigation produces URLs like: `#/<module-slug>/<view-id>?key=value`

Example: `#/my-module/detail?id=123`

## Backend Entry (`server/index.js`)

```javascript
module.exports = function registerRoutes(router, context) {
  const { storage, requireAuth, requireAdmin } = context

  router.get('/data', function(req, res) {
    const data = storage.readFromStorage('my-module-data.json')
    res.json(data || {})
  })

  router.post('/data', requireAdmin, function(req, res) {
    storage.writeToStorage('my-module-data.json', req.body)
    res.json({ success: true })
  })
}
```

Routes are automatically mounted at `/api/modules/<slug>/`.

## Shared Imports

Modules can import shared composables and utilities:

```javascript
import { useRoster } from '@shared/client/composables/useRoster'
import { useAuth } from '@shared/client/composables/useAuth'
import { apiRequest, cachedRequest } from '@shared/client/services/api'
```

**Modules cannot import from other modules** — only from `@shared`.

## Settings Component

To add a settings tab for your module, create a Vue component and reference it in `module.json`:

```json
{
  "client": {
    "settingsComponent": "./client/components/MySettings.vue"
  }
}
```

The component will be rendered as a tab in the shell's Settings page.

## Testing

- Frontend tests: `modules/your-module/__tests__/client/`
- Backend tests: `modules/your-module/__tests__/server/` or `modules/your-module/server/__tests__/`
- Run all tests: `npm test`
- Module manifest validation: `npm run validate:modules`

## CODEOWNERS

Add your module to `.github/CODEOWNERS`:

```
/modules/your-module/          @your-github-username
```

The `module.json` wildcard rule ensures core team review for manifest changes.

## Module Enable/Disable

Built-in modules can be enabled or disabled by admins via Settings > Modules. State is persisted in `data/modules-state.json`.

### Dependencies (`requires`)

If your module depends on another module, declare it in `module.json`:

```json
{
  "requires": ["team-tracker"]
}
```

- When enabling a module, all transitive dependencies are auto-enabled.
- A module cannot be disabled while another enabled module depends on it.
- At startup, if an enabled module's dependency is disabled, the dependency is auto-enabled.
- The validation script (`npm run validate:modules`) checks for missing dependencies and circular dependency chains.

### `defaultEnabled`

Set `"defaultEnabled": false` if your module should be opt-in. New modules default to enabled (`true`) when no persisted state exists.

### Restart behavior

Disabling a module hides it from the UI immediately but its server routes remain mounted until the next restart. Enabling a previously-disabled module updates the state, but if its routes were not mounted at startup, the API returns `restartRequired: true` and the UI shows a banner.

### CronJob behavior

The daily CronJob (`deploy/openshift/overlays/prod/cronjob-sync-refresh.yaml`) calls the Team Tracker module's API endpoints directly. If Team Tracker is disabled, those endpoints will return 404 and the CronJob will fail silently. Re-enable Team Tracker and restart to restore automatic syncs.

## Export Hook

Modules can participate in the anonymized test data export by declaring an `export` field in `module.json` and providing a custom export handler.

### module.json

```json
{
  "export": {
    "customHandler": true,
    "files": [
      { "path": "my-data.json", "notes": "Description of data" }
    ]
  }
}
```

When `customHandler` is `true`, the orchestrator calls `server/export.js` during export. The `files` array is documentation-only when `customHandler` is `true`.

### server/export.js

```javascript
module.exports = async function(addFile, storage, mapping) {
  const data = storage.readFromStorage('my-data.json');
  if (!data) return;

  // Anonymize PII using the shared mapping
  const anonymized = { ...data };
  if (anonymized.userName) {
    anonymized.userName = mapping.getOrCreateNameMapping(anonymized.userName);
  }

  // Add to the export tarball
  addFile('my-data.json', anonymized);
};
```

**Parameters:**
- `addFile(path, jsonData)` — adds a file to the tarball (path relative to `data/` root)
- `storage` — shared storage layer (`readFromStorage`, `writeToStorage`, `listStorageFiles`)
- `mapping` — universal PII mapping from `shared/server/anonymize.js` with functions like `getOrCreateNameMapping()`, `anonymizeJiraKey()`, `anonymizeIssueSummary()`, etc.

The validation script (`npm run validate:modules`) checks that `server/export.js` exists when `customHandler` is `true`.

## Diagnostics Hook

Modules can register a diagnostics hook to include module-specific health data in the must-gather diagnostic bundle (`GET /api/must-gather`). This is optional — modules that don't register a hook are simply skipped.

### Registering Diagnostics

Call `context.registerDiagnostics(fn)` inside your `registerRoutes` function. The callback has access to closure-scoped runtime state:

```javascript
module.exports = function registerRoutes(router, context) {
  const { storage } = context

  // Module-local runtime state
  const refreshState = { running: false }

  // ... route definitions ...

  // Register diagnostics hook (optional)
  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      return {
        refreshState,
        dataExists: !!storage.readFromStorage('my-data.json'),
        // Include whatever is useful for debugging
      }
    })
  }
}
```

### Guidelines

- **Return metadata, not data**: Include counts, timestamps, status flags, and health checks — not full data files
- **Include data integrity checks**: Missing files, stale caches, configuration mismatches
- **Keep it fast**: The hook has a 10-second timeout. Avoid expensive operations
- **No PII in keys**: Put PII in values only — the must-gather redaction system anonymizes values but not the structure
- **Guard the call**: Always check `if (context.registerDiagnostics)` for backward compatibility

### How It Works

- `context.registerDiagnostics` is set per-module during router creation in `module-loader.js`
- All registered hooks are called in parallel with a 10-second timeout via `collectModuleDiagnostics()`
- Errors in one module's hook don't affect others
- Results appear under `modules.<slug>` in the must-gather bundle

See [Must-Gather Documentation](MUST-GATHER.md) for the full bundle format.

## PR Checklist

- [ ] `module.json` has all required fields
- [ ] Slug matches directory name
- [ ] `npm run validate:modules` passes
- [ ] `npm test` passes
- [ ] CODEOWNERS entry added
- [ ] No imports from other modules (only `@shared`)
