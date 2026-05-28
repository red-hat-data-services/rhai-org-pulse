# Module Development Guide

This document covers how to create, develop, and contribute built-in modules for People & Teams.

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

### navItem Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique within module, maps to a key in the `routes` export |
| `label` | string | Yes | Sidebar display text |
| `icon` | string | Yes | Lucide icon name |
| `default` | boolean | No | If `true`, this is the module's landing view |
| `disabled` | boolean | No | If `true`, item is visible but non-clickable (greyed out) |
| `requireRole` | string | No | Only show item to users with this role (e.g., `"manager"`, `"team-admin"`, `"release-manager"`) |
| `requireCondition` | string | No | Only show when condition is met (e.g., `"in-app-mode"` — hides when roster is sheet-based) |
| `separatorBefore` | boolean | No | Render a visual separator line above this item |

### `hiddenRoutes`

In `client`, you can declare `hiddenRoutes` — a map of route IDs to their parent navItem ID. These are routes that exist in the `routes` export but should not appear as sidebar items (e.g., detail views navigated to programmatically):

```json
{
  "client": {
    "hiddenRoutes": {
      "feature-detail": "execute"
    }
  }
}
```

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

### Cross-Module Navigation

To navigate to another module's view, use the shared `useModuleLink` composable:

```javascript
import { useModuleLink } from '@shared/client/composables/useModuleLink.js'

const { navigateTo: crossNavigate } = useModuleLink()

// Navigate to another module's view
crossNavigate('releases', 'feature-detail', { key: 'RHAISTRAT-123' })
```

This produces a hash URL like `#/releases/feature-detail?key=RHAISTRAT-123` and updates `window.location.hash`. Use intra-module `moduleNav.navigateTo()` for navigation within your own module.

**Important:** Cross-module links should always be guarded by a module-availability
check so the UI degrades gracefully when the target module is not installed:

```vue
<script setup>
import { inject, computed } from 'vue'
import { useModuleLink } from '@shared/client/composables/useModuleLink.js'

const moduleNav = inject('moduleNav')
const targetAvailable = computed(() => moduleNav?.isModuleAvailable?.('other-module') ?? false)
const { linkTo } = useModuleLink()
</script>
<template>
  <a v-if="targetAvailable" :href="linkTo('other-module', 'view', { id: '123' })">View</a>
  <span v-else>View</span>
</template>
```

## Backend Entry (`server/index.js`)

```javascript
/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
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

## Server Context Reference

The authoritative typedef for the context object is in `shared/server/module-context.js`. Each module receives a frozen, per-module context built by `buildModuleContext()`.

### Context Properties

| Property | Type | Description |
|----------|------|-------------|
| `storage` | object | Storage module (`readFromStorage`, `writeToStorage`, etc.) |
| `requireAuth` | middleware | Requires authenticated user |
| `requireAdmin` | middleware | Requires admin role |
| `requireTeamAdmin` | middleware | Requires team-admin or admin role |
| `requireReleaseManager` | middleware | Requires release-manager role |
| `requireScope(name)` | function | Returns middleware for API token scope check |
| `roleStore` | object | Role store instance |
| `registerDiagnostics(fn)` | function | Register diagnostics hook (see below) |
| `registerMessageProvider(id, fn)` | function | Register message provider (see below) |
| `registerRefresh(id, config)` | function | Register refresh handler (see below) |
| `registerExport(fn)` | function | Register data export hook (see below) |

### Testing

Use `createTestContext(overrides)` from `shared/server/module-context.js` to create a mock context for unit tests:

```javascript
const { createTestContext } = require('../../shared/server/module-context')
const context = createTestContext({ storage: myMockStorage })
```

## Shared Imports

Modules can import shared composables and utilities:

```javascript
import { useRoster } from '@shared/client/composables/useRoster'
import { useAuth } from '@shared/client/composables/useAuth'
import { apiRequest, cachedRequest } from '@shared/client/services/api'
```

**Modules cannot import from other modules** — only from `@shared`. This is enforced
by the `org-pulse/no-cross-module-imports` ESLint rule, which flags direct imports,
cross-module API paths (`/api/modules/<other>/...`), and cross-module hash routes
(`#/<other>/...`). If a cross-module reference is unavoidable, guard it behind a
module-availability check and add an `eslint-disable` comment with justification.

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

The daily CronJob (`deploy/openshift/overlays/prod/cronjob-sync-refresh.yaml`) calls the People & Teams module's API endpoints directly. If People & Teams is disabled, those endpoints will return 404 and the CronJob will fail silently. Re-enable People & Teams and restart to restore automatic syncs.

## Export Hook

Modules can participate in the anonymized test data export by registering an export hook via `context.registerExport(fn)` and optionally declaring exported files in `module.json`.

### module.json (optional)

```json
{
  "export": {
    "files": [
      { "path": "my-data.json", "notes": "Description of data" }
    ]
  }
}
```

The `files` array is documentation-only — it describes what the export hook produces. The actual export logic lives in the registered hook.

### Registering an Export Hook

In your `server/index.js`, register the export function:

```javascript
module.exports = function registerRoutes(router, context) {
  // ... routes ...

  context.registerExport(require('./export'))
}
```

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
- **Guard the call**: Check `if (context.registerDiagnostics)` for backward compatibility with hand-rolled test contexts

### How It Works

- Each module's frozen context provides a `registerDiagnostics` function scoped to that module's slug
- Multiple calls accumulate — sub-routers can each register their own diagnostics (e.g., releases' planning, execution, and delivery)
- All registered hooks are called in parallel with a 10-second timeout via `collectModuleDiagnostics()`
- Errors in one module's hook don't affect others
- Results appear under `modules.<slug>` in the must-gather bundle

See [Must-Gather Documentation](MUST-GATHER.md) for the full bundle format.

## Message Provider Hook

Modules can register message providers to surface contextual alerts to users across every page of the application. Messages appear as a stack of sticky banners below the top bar header. This is optional — modules that don't register a provider simply produce no messages.

### Registering a Message Provider

Call `context.registerMessageProvider(id, fn)` inside your `registerRoutes` function. The provider function receives the current user context and returns an array of messages:

```javascript
module.exports = function registerRoutes(router, context) {
  const { storage } = context

  // ... route definitions ...

  // Register message provider (optional)
  if (context.registerMessageProvider) {
    context.registerMessageProvider('my-module:my-alert', async function(user) {
      // user = { email, uid, isAdmin, isTeamAdmin, permissionTier }

      // Return empty array if nothing to alert on
      if (!someCondition) return []

      return [{
        id: 'my-module:my-alert',
        type: 'warning',          // 'warning' | 'info' | 'error'
        text: 'Something needs attention.',
        link: {                    // optional
          label: 'Review',
          href: '#/my-module/detail'
        }
      }]
    })
  }
}
```

### Message Shape

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Globally unique. Convention: `<module-slug>:<message-name>` |
| `type` | string | Yes | `'warning'`, `'info'`, or `'error'` — determines banner color |
| `text` | string | Yes | Plain text (no HTML or markdown) |
| `link` | object or null | No | Optional CTA with `label` (string) and `href` (string) |

### Guidelines

- **Guard the call**: Check `if (context.registerMessageProvider)` for backward compatibility with hand-rolled test contexts
- **Synchronous registration**: Providers must be registered synchronously during `require(entryPath)` — the same constraint as `registerDiagnostics`
- **Per-request execution**: Provider functions are called on every `GET /api/messages` request with the current user context. Keep them fast
- **Timeout**: Each provider has a 5-second timeout. Providers that exceed this are skipped with a warning
- **Error isolation**: If a provider throws or times out, other providers still run and the endpoint still returns results
- **Early bailout**: Check `user.permissionTier` or `user.uid` early to skip expensive work for users who won't see the message
- **Return an array**: Providers can return zero or more messages. Return `[]` when there is nothing to alert on

### How It Works

- Each module's frozen context provides a `registerMessageProvider` function that delegates to the shared message registry
- All registered providers are called sequentially by the message registry on `GET /api/messages`
- Provider results are merged with admin-stored messages from `data/messages.json`
- The client fetches messages once on app load (non-blocking) and renders them as sticky banners inside the header
- Users can dismiss messages per session (sessionStorage)

## PR Checklist

- [ ] `module.json` has all required fields
- [ ] Slug matches directory name
- [ ] `npm run validate:modules` passes
- [ ] `npm test` passes
- [ ] CODEOWNERS entry added
- [ ] No imports from other modules (only `@shared`)
