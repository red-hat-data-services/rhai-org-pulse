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

## Allocation Strategy (`platform/allocation-strategy/`)

The allocation tracker supports customizable work classification via
`platform/allocation-strategy/`. When present, the allocation tab appears on
team detail views and the Work Allocation report appears in the reports hub.
When absent, allocation features are hidden entirely.

### Manifest format

```json
{
  "id": "ai-eng-40-40-20",
  "name": "40/40/20 Allocation",
  "description": "Tracks tech debt, features, and learning investment.",
  "classify": "classify.js",
  "categories": [
    { "key": "tech-debt-quality", "name": "Tech Debt & Quality", "color": "amber", "target": 40 },
    { "key": "new-features", "name": "New Features", "color": "blue", "target": 40 },
    { "key": "learning-enablement", "name": "Learning & Enablement", "color": "green", "target": 20 }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique strategy identifier (stored in sprint data for cache invalidation) |
| `name` | string | yes | Display name for the strategy |
| `description` | string | no | Short description |
| `classify` | string | yes | Path to CommonJS classification module relative to the extension directory |
| `categories` | array | yes | Ordered list of allocation categories |
| `settingsComponent` | string | no | Path to Vue component for strategy-specific admin settings |

Each category object:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | string | yes | Unique identifier (used in data storage) |
| `name` | string | yes | Display name |
| `color` | string | yes | Tailwind color name (e.g., `amber`, `blue`, `green`) |
| `target` | number | yes | Target percentage (all targets should sum to 100) |

### Classification module (`classify.js`)

The classification module must export:

```js
// Required: classify a Jira issue into a category
function classifyIssue(issue) {
  // issue has: issueType, status, storyPoints, summary, assignee,
  //            plus any extra fields declared by getJiraFields()
  return 'category-key' // or 'uncategorized'
}

// Optional: declare additional Jira fields needed for classification
function getJiraFields() {
  return {
    fieldIds: ['customfield_10464'],
    extract: (issue, fields) => ({
      activityType: fields.customfield_10464?.value || null
    })
  }
}

module.exports = { classifyIssue, getJiraFields }
```

### How it works

- **Server-side**: `server/platform-loader.js` discovers the manifest and loads
  the classification module. The strategy is passed into module context via
  `context.allocationStrategy`.
- **Frontend**: `src/platform-loader.js` discovers the manifest via
  `import.meta.glob` and exposes category metadata. The `useAllocationStrategy()`
  composable provides reactive access to categories.
- **Cache invalidation**: The `strategyId` is stored alongside sprint data. When
  the strategy changes, cached closed sprint data is invalidated and re-classified.
- **Uncategorized**: Issues that don't match any category are automatically placed
  in an "Uncategorized" bucket (always appended, not declared in the manifest).

### Adding a new strategy

1. Create `platform/allocation-strategy/manifest.json` with your categories
2. Create `platform/allocation-strategy/classify.js` with classification logic
3. Run `npm run validate:platform` to verify
4. The allocation tab and report appear automatically

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
