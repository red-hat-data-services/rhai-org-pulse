# Custom Team Allocation System — Design Plan

## Overview

Replace the hardcoded 40/40/20 allocation classification system with a
**platform extension** that allows each deployment to define its own allocation
categories, classification logic, and admin settings UI. This follows the
`platform/` directory pattern established in PR #1090 (extensible About page
tabs), extending it to support server-side classification hooks.

### Requirements (from user)

- **Fully customizable** — classification may not be Jira-based at all
- **System-wide** — one active allocation strategy per deployment
- **Generic N categories** — any number of buckets with names, colors, targets
- **Custom admin settings UI** — each strategy can provide its own Vue settings
- **Backward compatible** — existing 40/40/20 data must continue to work
- **Repo-split ready** — org-specific strategy code must NOT live in core
  team-tracker; it follows the platform customization pattern

---

## Architecture

### Platform Extension Pattern (PR #1090 Recap)

PR #1090 established the `platform/` directory for deployment-specific core UI
customizations. Key characteristics:

- `platform/<extension>/manifest.json` — declarative manifest
- `import.meta.glob('/platform/*/manifest.json')` — Vite auto-discovery
- `src/platform-loader.js` — loader functions that parse manifests
- `@platform` Vite alias in `vite.config.mjs`
- Core handles absent `platform/` gracefully (globs return empty objects)
- AI Eng Dockerfile COPYs `platform/` into image
- `scripts/validate-platform.js` — CI validation
- `docs/PLATFORM.md` — documentation

The about-tabs extension is frontend-only. Allocation strategies need both
**server-side classification logic** and **frontend category metadata**. This
plan extends the platform pattern to support server-side extensions.

### Allocation Strategy as Platform Extension

```
platform/allocation-strategy/
  manifest.json           # Strategy metadata + category definitions
  classify.js             # Server-side: classifyIssue() + optional getJiraFields()
  AllocationSettings.vue  # Optional: strategy-specific admin settings component
```

#### manifest.json

```json
{
  "id": "ai-eng-40-40-20",
  "name": "AI Engineering 40/40/20",
  "description": "Classifies work into Tech Debt & Quality (40%), New Features (40%), and Learning & Enablement (20%)",
  "categories": [
    { "key": "tech-debt-quality", "name": "Tech Debt & Quality", "color": "amber", "target": 40 },
    { "key": "new-features", "name": "New Features", "color": "blue", "target": 40 },
    { "key": "learning-enablement", "name": "Learning & Enablement", "color": "green", "target": 20 }
  ],
  "classify": "./classify.js",
  "settingsComponent": "./AllocationSettings.vue"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | yes | Unique strategy identifier (used in stored data for cache invalidation) |
| `name` | string | yes | Human-readable name |
| `description` | string | no | Short description shown in allocation UI |
| `categories` | array | yes | Ordered list of allocation categories |
| `categories[].key` | string | yes | Machine key for the bucket |
| `categories[].name` | string | yes | Display name |
| `categories[].color` | string | yes | Tailwind color name (amber, blue, green, etc.) |
| `categories[].target` | number | yes | Target percentage (all targets should sum to 100) |
| `classify` | string | yes | Path to CommonJS classification module (relative to manifest) |
| `settingsComponent` | string | no | Path to Vue settings component (relative to manifest) |

#### classify.js (Server-Side)

CommonJS module exporting the classification contract:

```js
/**
 * Classify a Jira issue into an allocation category.
 * @param {Object} issue - Issue object with base fields + any extra fields
 * @returns {string} Category key (must match one of manifest.categories[].key)
 */
function classifyIssue(issue) {
  const activityType = issue.activityType
  switch (activityType) {
    case 'Tech Debt / Quality': return 'tech-debt-quality'
    case 'New Feature': return 'new-features'
    case 'Learning / Enablement': return 'learning-enablement'
    default: break
  }
  // Vulnerability/Weakness → tech debt
  if (['Vulnerability', 'Weakness'].includes(issue.issueType)) {
    return 'tech-debt-quality'
  }
  return 'uncategorized'
}

/**
 * Optional: declare additional Jira fields needed for classification.
 * @returns {{ fieldIds: string[], extract: (issue: Object, fields: Object) => Object }}
 */
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

### Server-Side Platform Discovery

PR #1090's platform discovery is Vite-only (`import.meta.glob`). Server-side
allocation classification needs a Node.js discovery mechanism. This extends
the platform pattern with a server-side loader:

**New file: `server/platform-loader.js`**

Scans `platform/allocation-strategy/manifest.json` at startup. If found:
1. Validates the manifest structure
2. Requires the `classify.js` module
3. Returns a frozen strategy object with categories + classification functions

If `platform/allocation-strategy/` doesn't exist, returns `null`. This mirrors
the frontend pattern where absent `platform/` means no extensions loaded.

```js
const fs = require('fs')
const path = require('path')

const PLATFORM_DIR = path.join(__dirname, '..', 'platform')
const STRATEGY_DIR = path.join(PLATFORM_DIR, 'allocation-strategy')

function loadAllocationStrategy() {
  const manifestPath = path.join(STRATEGY_DIR, 'manifest.json')
  if (!fs.existsSync(manifestPath)) return null

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  const classifyPath = path.join(STRATEGY_DIR, manifest.classify.replace(/^\.\//, ''))
  const classifier = require(classifyPath)

  return Object.freeze({
    id: manifest.id,
    name: manifest.name,
    description: manifest.description || '',
    categories: Object.freeze(manifest.categories),
    classifyIssue: classifier.classifyIssue,
    getJiraFields: classifier.getJiraFields || null
  })
}

module.exports = { loadAllocationStrategy }
```

### Frontend Platform Discovery

Extends `src/platform-loader.js` with a new loader function:

```js
const strategyManifests = import.meta.glob(
  '/platform/allocation-strategy/manifest.json',
  { eager: true }
)
const strategyComponents = import.meta.glob(
  '/platform/allocation-strategy/*.vue'
)

export function loadAllocationStrategy() {
  const manifest = strategyManifests['/platform/allocation-strategy/manifest.json']
  if (!manifest) return null
  const data = manifest.default || manifest
  const result = {
    id: data.id,
    name: data.name,
    description: data.description || '',
    categories: data.categories
  }
  if (data.settingsComponent) {
    const normalized = data.settingsComponent.replace(/^\.\//, '')
    const globKey = `/platform/allocation-strategy/${normalized}`
    const loader = strategyComponents[globKey]
    if (loader) {
      result.settingsComponent = defineAsyncComponent(loader)
    }
  }
  return result
}
```

This gives the frontend direct access to category metadata (names, colors,
targets) at build time — no API call needed. The `useAllocationStrategy()`
composable wraps this for reactive use across components.

### Integration with Team-Tracker

**Server**: `dev-server.js` (or `module-loader.js`) calls
`loadAllocationStrategy()` at startup and passes the result to team-tracker's
allocation routes via `coreServices.allocationStrategy`. Team-tracker's
server code is the consumer, not the owner, of the strategy.

**Frontend**: Allocation components import from `useAllocationStrategy()`
composable, which calls `loadAllocationStrategy()` from
`src/platform-loader.js`. No API endpoint needed for categories — they're
baked into the frontend build via the manifest glob.

### Repo Split Context

After the repo split:
- **Core repo**: `shared/`, `src/`, `modules/team-tracker/`, `server/` — all
  allocation infrastructure (pipeline, UI, composable)
- **Downstream repo** (e.g., AI Eng): `platform/allocation-strategy/` with
  the 40/40/20 manifest, classify.js, and optional settings component

The AI Eng Dockerfile already COPYs `platform/` into the image (from PR #1090).
The allocation strategy rides the same path — zero additional Docker config.

### Design Rationale — Why Platform Extension, Not Module

1. **Consistent with PR #1090** — platform/ is for deployment-specific
   customizations of core behavior. Allocation classification is exactly this:
   the core provides the pipeline, deployments customize the classification.
2. **No module overhead** — strategies don't need Express routes, navItems,
   module.json manifests, or sidebar entries. They're data + a function.
3. **Build-time discovery** — Vite globs resolve at build time, making
   category metadata available to the frontend without API calls.
4. **Simple contract** — A JSON manifest + one JS function is simpler than
   a full module with server entry, client entry, and module.json.

### Design Rationale — Why NOT a Full Pipeline Override

The V1 contract keeps strategies as **classification-only** hooks into the
existing Jira fetch pipeline. A `fetchIssues` override was rejected because:
- `refreshTeam` depends on `processBoard`'s return shape (`{ board,
  sprintResults, dashboardSprint, dashboardSprintResult }`)
- All known use cases use Jira data
- A V2 can add pipeline override when a real non-Jira use case emerges

### What Core Ships (No Strategy Present)

If `platform/allocation-strategy/` doesn't exist:
- Server: `loadAllocationStrategy()` returns `null`
- `GET /allocation/strategy` returns `{ configured: false }`
- Allocation tab is **hidden entirely** from TeamRosterView (not shown as
  an empty state)
- Org allocation report is **hidden entirely** (nav item not rendered)
- Refresh handler skips classification

### Category Configuration Flow

Categories are defined in `manifest.json`, not by runtime config. This means:
- Number of categories, their keys, names, colors, and targets are fixed per
  strategy
- The strategy can optionally expose admin-tunable settings via its
  `settingsComponent` (e.g., field mappings, thresholds)
- Changing categories means changing the platform extension files

---

## Affected Code — Change Map

### 1. Platform: Server Loader (NEW)

**New file**: `server/platform-loader.js`
Scans `platform/allocation-strategy/manifest.json`, requires `classify.js`,
returns frozen strategy object or `null`.

### 2. Platform: Frontend Loader (`src/platform-loader.js`)

Add `loadAllocationStrategy()` function. Uses `import.meta.glob` for manifest
+ Vue component discovery. Returns strategy metadata + optional async settings
component, or `null` if not present.

### 3. Platform: Validation (`scripts/validate-platform.js`)

Add allocation strategy validation alongside existing about-tabs validation:
- Verify manifest.json has required fields (id, name, categories, classify)
- Verify categories array structure (key, name, color, target)
- Verify classify.js file exists
- Verify settingsComponent file exists if declared
- Gracefully skip if `platform/allocation-strategy/` doesn't exist

### 4. Platform: Module Loader (`server/module-loader.js` or `server/dev-server.js`)

Call `loadAllocationStrategy()` at startup. Pass the result via
`coreServices.allocationStrategy` so team-tracker's allocation routes can
access it.

### 5. Server: Classification (`classification.js`)

**Current**: `classifyIssue()` has hardcoded switch; `emptyBuckets()`,
`buildSprintSummary()`, `buildTeamSummary()`, `buildOrgSummary()` use
hardcoded bucket keys.

**Change**: Make all functions category-aware by accepting a `categories` array:

```js
function emptyBuckets(categories) {
  const buckets = {}
  for (const cat of categories) {
    buckets[cat.key] = { points: 0, count: 0, issueCount: 0, completedPoints: 0, completedCount: 0 }
  }
  buckets['uncategorized'] = { points: 0, count: 0, issueCount: 0, completedPoints: 0, completedCount: 0 }
  return buckets
}
```

`buildTeamSummary` (lines 178-191) and `buildOrgSummary` (lines 255-260):
build `percentages` and `bucketWeights` dynamically from category keys.
`addBuckets` already iterates `Object.keys(target)` — works as-is.

The `uncategorized` bucket is always present as a catch-all.

### 6. Server: Jira Client (`jira-client.js`)

**Current**: Hardcoded `FIELD_IDS.activityType` in fetch fields and extraction.

**Change**: `createJiraClient` accepts optional `extraFields` from the
strategy's `getJiraFields()`. Base fields remain constant. Strategy-declared
`fieldIds` are appended. The strategy's `extract` function runs during issue
mapping.

The hardcoded `activityType` extraction moves into
`platform/allocation-strategy/classify.js` via `getJiraFields().extract`.

### 7. Server: Orchestration (`orchestration.js`)

**Current**: Calls `classifyIssue(issue)` directly.

**Change**: Accept the active strategy as a parameter:

```js
async function processBoard({ board, teamId, allocationMode, strategy, ... }) {
  const classifiedIssues = filteredIssues.map(issue => ({
    ...issue,
    bucket: strategy.classifyIssue(issue),
    completed: issue.resolution != null
  }))
  const summary = buildSprintSummary(classifiedIssues, calculationMode, strategy.categories)
}
```

**strategyId cache invalidation**: Stored sprint data gains a `strategyId`
field. Closed-sprint cache check (lines 40-53) compares cached `strategyId`
against active strategy. Mismatch → cache miss → re-fetch + re-classify.

```js
if (!hardRefresh && sprint.state === 'closed') {
  const cached = readStorage(`sprints/${sprint.id}.json`)
  if (cached && cached.strategyId === strategy.id) continue
}
```

### 8. Server: Routes (`routes.js`)

**Current**: Creates Jira client and calls orchestration directly.

**Change**: Read the strategy from `coreServices.allocationStrategy` (resolved
at startup). Pass to orchestration calls. If `null`, allocation endpoints
return appropriate empty responses. Add:

```
GET /api/modules/team-tracker/allocation/strategy
  → { configured: true, id, name, description, categories: [...] }
  OR { configured: false }
```

### 9. Client: `useAllocationStrategy()` composable (NEW)

**New file**: `modules/team-tracker/client/composables/useAllocationStrategy.js`

Calls `loadAllocationStrategy()` from `src/platform-loader.js` and exposes
reactive `categories`, `strategyId`, `configured`, `name`, and optionally
`settingsComponent` refs. Since the data comes from Vite globs (build-time),
no API call or caching needed — it's synchronous.

```js
import { computed } from 'vue'
import { loadAllocationStrategy } from '@/platform-loader'

const strategy = loadAllocationStrategy()

export function useAllocationStrategy() {
  return {
    configured: computed(() => strategy !== null),
    strategyId: computed(() => strategy?.id ?? null),
    name: computed(() => strategy?.name ?? null),
    description: computed(() => strategy?.description ?? null),
    categories: computed(() => strategy?.categories ?? []),
    settingsComponent: computed(() => strategy?.settingsComponent ?? null)
  }
}
```

Components use the `configured` ref to **gate visibility** — when `false`,
allocation tabs and report nav items are not rendered at all (no empty state).
This keeps the UI clean for core-only deployments that have no allocation
strategy.
```

### 10. Client: `TeamAllocationTab.vue`

**Current**: `BUCKET_CONFIGS` hardcoded at lines 139-144. `transformSprintData()`
uses `BUCKET_KEYS` to build `issuesByBucket`.

**Change**:
- Use `useAllocationStrategy()` for dynamic categories
- Replace `BUCKET_CONFIGS`/`BUCKET_KEYS` with reactive `categories`
- `transformSprintData()` builds `issuesByBucket` from strategy keys + `uncategorized`
- The entire Allocation tab is **hidden** from TeamRosterView when
  `configured === false` — the tab definition at line 674
  (`{ id: 'allocation', label: '40/40/20 Allocation', ... }`) is conditionally
  included in the `tabs` array only when `configured` is true. The tab
  simply doesn't appear in the tab bar, no empty state needed.

### 11. Client: `AllocationBar.vue`

**Current**: 4 hardcoded `<div>` segments. Target markers at `left: 40%` and
`left: 80%`.

**Change**: `v-for` loop over categories. Dynamic cumulative target markers:

```js
const targetMarkers = computed(() => {
  const markers = []
  let cumulative = 0
  for (let i = 0; i < categories.value.length - 1; i++) {
    cumulative += categories.value[i].target
    markers.push(cumulative)
  }
  return markers
})
```

### 12. Client: `AllocationTeamCard.vue`

**Current**: Hardcoded percentage labels for 4 buckets.

**Change**: `v-for` loop over categories, using `cat.color` and `cat.name`.

### 13. Client: `AllocationReport.vue`

**Current**: `teamBuckets()` uses hardcoded bucket keys.

**Change**: Use categories from strategy metadata. The report entry in
`reports/registry.js` is conditionally included only when `configured` is
true — the allocation report card doesn't appear in the Reports Hub at all
when no strategy is present.

### 14. Client: `CompletionSummary.vue`

**Current**: `bucketLabels` (lines 70-75) hardcodes display names. Iteration
(lines 80-88) already uses `Object.entries()` dynamically.

**Change**: Replace `bucketLabels` with strategy category lookup:
`categories.find(c => c.key === key)?.name || key`.

### 15. Data Format

**No breaking changes.** Sprint data already stores bucket keys as dynamic
object keys. Different strategies produce different keys. Existing data
remains valid.

**New field**: Sprint/summary files gain `strategyId` (string) for provenance
tracking and cache invalidation. Data without `strategyId` is treated as a
cache miss on first refresh — re-fetched and re-classified automatically.

### 16. Demo Fixtures

In demo mode, `platform/` may or may not be present. If absent, allocation
tab and org report are hidden entirely. For the AI Eng image (which includes
platform/), demo fixtures already have 40/40/20 bucket keys that match the
strategy.

---

## File Inventory

### New Files (Platform Extension — AI Eng)
| File | Purpose |
|------|---------|
| `platform/allocation-strategy/manifest.json` | Strategy metadata + category definitions |
| `platform/allocation-strategy/classify.js` | 40/40/20 classification logic (CommonJS) |
| `platform/allocation-strategy/AllocationSettings.vue` | Optional: strategy-specific admin settings |

### New Files (Core)
| File | Purpose |
|------|---------|
| `server/platform-loader.js` | Server-side platform extension discovery |
| `modules/team-tracker/client/composables/useAllocationStrategy.js` | Shared composable for strategy metadata |

### Modified Files (Core)
| File | Nature of Change |
|------|-----------------|
| `src/platform-loader.js` | Add `loadAllocationStrategy()` function |
| `scripts/validate-platform.js` | Add allocation strategy manifest validation |
| `server/module-loader.js` or `server/dev-server.js` | Call `loadAllocationStrategy()`, pass via coreServices |
| `modules/team-tracker/server/allocation/classification.js` | Make category-generic |
| `modules/team-tracker/server/allocation/jira-client.js` | Accept extra fields from strategy |
| `modules/team-tracker/server/allocation/orchestration.js` | Thread strategy through, add strategyId cache |
| `modules/team-tracker/server/allocation/routes.js` | Read strategy from coreServices, add `/strategy` endpoint |
| `modules/team-tracker/client/components/TeamAllocationTab.vue` | Dynamic categories, tab hidden when unconfigured |
| `modules/team-tracker/client/components/allocation/AllocationBar.vue` | Dynamic segments via v-for |
| `modules/team-tracker/client/components/allocation/AllocationTeamCard.vue` | Dynamic bucket labels |
| `modules/team-tracker/client/components/allocation/CompletionSummary.vue` | Replace hardcoded bucketLabels |
| `modules/team-tracker/client/reports/AllocationReport.vue` | Dynamic bucket keys |
| `modules/team-tracker/client/reports/registry.js` | Conditionally include allocation report based on strategy presence |
| `modules/team-tracker/client/views/TeamRosterView.vue` | Conditionally include allocation tab based on strategy presence |
| `modules/team-tracker/client/services/allocation-api.js` | Add `getAllocationStrategy()` |
| `docs/PLATFORM.md` | Add allocation strategy extension docs |

### Unchanged Files
| File | Reason |
|------|--------|
| `modules/team-tracker/client/components/allocation/BucketBreakdown.vue` | Already generic via props |
| `shared/server/module-context.js` | No new hooks needed — strategy loaded directly, not via module registration |
| `shared/API.md` | No new shared exports |

### Test Files
| File | Nature of Change |
|------|-----------------|
| New: `server/__tests__/platform-loader.test.js` | Server platform loader tests |
| New: `src/__tests__/platform-loader-allocation.test.js` | Frontend allocation strategy loader tests |
| New: `platform/allocation-strategy/__tests__/classify.test.js` | AI Eng classification logic tests |
| `modules/team-tracker/__tests__/server/allocation/classification.test.js` | Pass categories/strategy |
| `modules/team-tracker/__tests__/server/allocation/orchestration.test.js` | Pass strategy, test cache invalidation |
| `modules/team-tracker/__tests__/client/allocation/AllocationBar.test.js` | Dynamic segments |
| `modules/team-tracker/__tests__/client/allocation/AllocationTeamCard.test.js` | Dynamic labels |
| `modules/team-tracker/__tests__/client/allocation/CompletionSummary.test.js` | Dynamic buckets |
| `modules/team-tracker/__tests__/client/reports/AllocationReport.test.js` | Dynamic buckets |

---

## Implementation Phases

### Phase 1: Platform Infrastructure

1. Create `server/platform-loader.js` — server-side strategy discovery
2. Add `loadAllocationStrategy()` to `src/platform-loader.js` — frontend discovery
3. Extend `scripts/validate-platform.js` with allocation strategy validation
4. Wire server-side strategy into `coreServices.allocationStrategy` in module
   loader / dev-server
5. Update `docs/PLATFORM.md` with allocation strategy extension documentation
6. Add unit tests for both loaders

### Phase 2: Core Server Refactor

1. Refactor `classification.js` to be category-generic (accept categories param)
2. Thread strategy through `orchestration.js` (incl. `strategyId` cache)
3. Refactor `jira-client.js` to accept strategy-declared extra fields
4. Refactor `routes.js` — read from `coreServices.allocationStrategy`, add
   `/strategy` endpoint, return `{ configured: false }` when no strategy
5. Update all server allocation tests

### Phase 3: AI Eng Strategy (Platform Extension)

1. Create `platform/allocation-strategy/manifest.json` with 40/40/20 categories
2. Extract current classification logic into `platform/allocation-strategy/classify.js`
3. Create optional `AllocationSettings.vue`
4. Add classification unit tests
5. Verify end-to-end: platform loader finds strategy, team-tracker uses it

### Phase 4: Dynamic Frontend

1. Create `useAllocationStrategy()` composable
2. Refactor `TeamRosterView.vue` — conditionally include allocation tab only
   when `configured` is true
3. Refactor `reports/registry.js` — conditionally include allocation report
   only when strategy is present
4. Refactor `TeamAllocationTab.vue` — dynamic categories
5. Refactor `AllocationBar.vue` — dynamic segments via `v-for`
6. Refactor `AllocationTeamCard.vue` — dynamic bucket labels
7. Refactor `CompletionSummary.vue` — strategy-based label lookup
8. Refactor `AllocationReport.vue` — dynamic bucket keys
9. Update all client allocation tests

### Phase 5: Documentation & Validation

1. Update `docs/DATA-FORMATS.md` with strategyId field
2. Update `docs/PLATFORM.md` with full allocation strategy guide
3. Handle demo fixtures
4. End-to-end testing with and without the platform extension

---

## Backward Compatibility

| Concern | Resolution |
|---------|-----------|
| Existing stored sprint data | Continues to work — AI Eng strategy defines same bucket keys as current hardcoded |
| Existing summary files | Same bucket keys, no migration needed |
| API response shapes | Unchanged for existing endpoints; `/strategy` is additive |
| `allocationMode` (points/counts) | Orthogonal to categories — preserved as-is |
| Deployments with AI Eng image | Zero behavior change — platform extension provides same 40/40/20 |
| Core-only deployments | Allocation tab and org report hidden entirely — clean UI |

---

## UX Teammate Recommendation

**Not required.** Changes are structural (hardcoded → dynamic loops). Visual
appearance unchanged when the AI Eng strategy is present. When no strategy is
configured, allocation UI is hidden entirely — no empty state design needed.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Strategy switch invalidates historical data | `strategyId` in stored data enables automatic cache invalidation |
| Existing data without `strategyId` | Treated as cache miss on first refresh. One-time cost. |
| Server-side `require()` of platform code | `server/platform-loader.js` validates manifest before requiring. File must exist (validated by CI). |
| Frontend strategy metadata stale | Data comes from Vite glob (build-time). Redeploying the image updates it. |
| `classifyIssue` returns unknown key | `uncategorized` catch-all always present |
| Color palette limitations | Document supported Tailwind colors. Strategy can use hex fallback. |
| No `module-context.js` hook | By design — platform extensions are lighter than modules. Strategy loaded directly by platform-loader, not via registerX() pattern. |
| Multiple strategies in platform/ | Only one `platform/allocation-strategy/` directory supported. Manifest has a single strategy. |

---

## Key Differences from Previous Plan

| Aspect | Previous (Module-Based) | Current (Platform Extension) |
|--------|------------------------|------------------------------|
| Where AI Eng code lives | `modules/ai-eng-allocation/` | `platform/allocation-strategy/` |
| Discovery mechanism | Module auto-discovery + `module.json` | Platform manifest + `import.meta.glob` / `fs.existsSync` |
| Registration pattern | `context.registerAllocationStrategy()` | Direct loading by `server/platform-loader.js` |
| New shared infrastructure | `shared/server/allocation-strategy-registry.js` | None (no registry needed) |
| Changes to `module-context.js` | New `registerAllocationStrategy` hook | None |
| Changes to `module-loader.js` | New registry + registries wiring | One call to `loadAllocationStrategy()` |
| Docker config | Would need `COPY modules/ai-eng-allocation/` | Already handled by existing `COPY platform/` |
| Frontend category access | API call to `/allocation/strategy` | Build-time via Vite glob (no API call) |
| Module overhead | Full module (module.json, server/index.js, client/index.js) | 3 files (manifest, classify.js, optional Vue component) |

---

## Resolved Questions

1. **Why not a module?** — Platform extensions are the established pattern for
   deployment-specific customizations (PR #1090). Allocation strategies are
   exactly this — they customize core team-tracker behavior per deployment.
   No module overhead needed.

2. **Server-side discovery** — PR #1090 only established frontend discovery
   via Vite globs. This plan extends the pattern with `server/platform-loader.js`
   for server-side `require()` of the classification module. Same directory
   structure, same manifest, dual discovery paths.

3. **No module-context changes** — Unlike `registerRefresh` etc., the
   allocation strategy is not a per-module hook. It's a platform-level
   customization loaded once at startup. Passing it via `coreServices` is
   simpler and more direct.

4. **Frontend uses build-time data** — Category metadata (names, colors,
   targets) is in the manifest, which Vite globs eagerly load. No API
   endpoint needed for the frontend to know the categories. The
   `GET /allocation/strategy` endpoint remains for API consumers.

5. **Uncategorized bucket** — Always present. Not defined in the manifest.
   Core code adds it automatically.
