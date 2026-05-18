# Unified Releases Module — Implementation Plan

## Overview

Merge three existing modules — **release-planning**, **feature-traffic**, and
**release-analysis** — into a single **releases** module organized around the
release lifecycle: Plan, Execute, Deliver. Add a unified release registry, a
new `release-manager` RBAC role, a placeholder Reports view, and a unified
Audit log.

This is a true merge, not a wrapper. All code moves into `modules/releases/`.
The three old module directories are deleted at the end.

---

## Table of Contents

1. [Navigation & UX](#1-navigation--ux)
2. [Unified Release Registry](#2-unified-release-registry)
3. [RBAC: release-manager Role](#3-rbac-release-manager-role)
4. [Module Structure](#4-module-structure)
5. [Storage Restructure](#5-storage-restructure)
6. [API Routes](#6-api-routes)
7. [Client Architecture](#7-client-architecture)
8. [Server Architecture](#8-server-architecture)
9. [Settings](#9-settings)
10. [Reports (Placeholder)](#10-reports-placeholder)
11. [Audit Log (Unified)](#11-audit-log-unified)
12. [Fixtures & Demo Mode](#12-fixtures--demo-mode)
13. [Tests](#13-tests)
14. [CI/CD & Deployment](#14-cicd--deployment)
15. [Migration & Cleanup](#15-migration--cleanup)
16. [Phased Execution](#16-phased-execution)
17. [Files Modified](#17-files-modified)
18. [Risks & Mitigations](#18-risks--mitigations)
19. [Review Findings & Resolutions](#19-review-findings--resolutions)

---

## 1. Navigation & UX

### Sidebar

One sidebar entry: **Releases** (slug: `releases`, icon: `rocket`, order: 10).

Five nav items:

| Nav Item | ID | Icon | Default |
|----------|----|------|---------|
| Plan | `plan` | ClipboardList | Yes |
| Execute | `execute` | GitBranch | |
| Deliver | `deliver` | Rocket | |
| Reports | `reports` | BarChart3 | |
| Audit | `audit` | History | |

### Sub-tabs within each nav item

Each nav item is a top-level view that contains sub-tabs internally:

- **Plan**: Outcomes (default), Health
- **Execute**: Overview (default), Feature Detail (drill-down route, not a tab)
- **Deliver**: Risk Dashboard (default), Component Breakdown, Conforma Insights

Reports and Audit are single views (no sub-tabs).

### Release Selector

A persistent release selector sits above all tab content. Selecting a release
sets the context for all views. The selector is driven by the unified release
registry (section 2).

### Feature Detail Navigation

Feature Detail uses a **drill-down route** pattern (Option B). Clicking a
feature in the Execute Overview navigates to a full-page detail view. The back
button returns to Execute Overview with filters preserved via sessionStorage.
This matches the current behavior in feature-traffic.

---

## 2. Unified Release Registry

### Purpose

Canonical source of truth for release identity. Eliminates brittle
version-string matching across the three domains.

### Storage

`releases/registry.json`

### Schema

```json
{
  "schemaVersion": 1,
  "releases": [
    {
      "id": "rhoai-2.14",
      "displayName": "RHOAI 2.14",
      "fixVersions": ["RHOAI-2.14", "rhoai-2.14"],
      "productPagesShortname": "red_hat_openshift_ai",
      "productPagesVersion": "2.14",
      "milestones": {
        "codeFreeze": "2026-06-01",
        "ea1": "2026-06-15",
        "ga": "2026-07-01"
      },
      "state": "active",
      "createdAt": "2026-05-18T00:00:00Z",
      "updatedAt": "2026-05-18T00:00:00Z"
    }
  ]
}
```

### Population

Combination approach:

1. **Auto-discovery**: On refresh, fetch releases from Product Pages API
   (using existing `product-pages.js` logic). Extract fix versions, milestone
   dates, shortnames.
2. **Manual enrichment**: Release managers can create/edit releases via admin
   UI. Add fix version aliases, override milestones, set state
   (active/archived).
3. **Migration seed**: On first load, if registry is empty, seed from existing
   release-planning config releases + Product Pages cache.

### How tabs use the registry

- **Plan**: Filters Big Rocks and candidates by release ID. Replaces the
  current `releases` config object in release-planning.
- **Execute**: Filters features by matching `fixVersions` from the registry
  entry against feature fix version arrays.
- **Deliver**: Filters analysis data by matching `productPagesShortname` +
  `productPagesVersion` from the registry.
- **All tabs**: The release selector dropdown is populated from the registry.

### API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/modules/releases/registry` | authenticated | List all releases |
| GET | `/api/modules/releases/registry/:id` | authenticated | Single release |
| POST | `/api/modules/releases/registry` | release-manager | Create release |
| PUT | `/api/modules/releases/registry/:id` | release-manager | Update release |
| DELETE | `/api/modules/releases/registry/:id` | release-manager | Archive/delete |
| POST | `/api/modules/releases/registry/discover` | release-manager | Auto-discover from Product Pages |

---

## 3. RBAC: release-manager Role

### Changes to shared RBAC system

**`shared/server/role-store.js`**:
Add `'release-manager'` to `VALID_ROLES` array.

**`shared/server/auth.js`**:
- In `resolveUserUid()`: add `req.isReleaseManager = roleStore ? roleStore.hasRole(req.userEmail, 'release-manager') : false`
- In `applyImpersonation()`: add `req.isReleaseManager = roleStore ? roleStore.hasRole(req.userEmail, 'release-manager') : false`
- New middleware factory (inside `createAuthMiddleware`, alongside `requireAdmin` and `requireTeamAdmin`):
  ```javascript
  function requireReleaseManager(req, res, next) {
    if (!req.isAdmin && !req.isReleaseManager) {
      return res.status(403).json({ error: 'Release manager access required.' });
    }
    next();
  }
  ```
- Add `requireReleaseManager` to the returned object from `createAuthMiddleware()`

**`shared/server/permissions.js`**:
Update `getPermissionTier()` signature to accept `isReleaseManagerFlag` parameter.
Add `release-manager` tier between `team-admin` and `manager`:
```javascript
function getPermissionTier(uid, registry, isAdminFlag, isTeamAdminFlag, isReleaseManagerFlag) {
  if (isAdminFlag) return 'admin';
  if (isTeamAdminFlag) return 'team-admin';
  if (isReleaseManagerFlag) return 'release-manager';
  if (!uid) return 'user';
  if (isManager(uid, registry)) return 'manager';
  return 'user';
}
```
Update callers in `resolveUserUid()` and `applyImpersonation()` to pass the
new parameter.

**`server/dev-server.js`**:
Add `requireReleaseManager` to `moduleContext`.

**`src/components/UserManagement.vue`**:
Add `release-manager` option to role selector dropdown. Update the display-name
maps (around lines 112 and 123) to include the new role label.

**`server/api-tokens.js`** (scope catalog):
Update scope definitions: replace `feature-traffic:read`, `feature-traffic:write`,
`release-planning:read`, `release-planning:write`, `release-analysis:read`,
`release-analysis:write` with `releases:read`, `releases:write`. Update any
scope presets that reference the old names. Add migration logic: on startup,
scan existing tokens and rewrite old scope names to new ones.

### Replacing pm-auth.js

The release-planning module's custom `pm-auth.js` and `pm-users.json` are
replaced by the central `release-manager` role. All routes that currently use
`requirePM` will use `requireReleaseManager` instead.

**Migration**: Must happen in the SAME phase that replaces `requirePM` with
`requireReleaseManager` (Phase 2). On module initialization, if
`releases/planning/pm-users.json` exists (or the old path
`release-planning/pm-users.json`), read its email list and auto-assign the
`release-manager` role to those users via the role store. Log a message
indicating migration occurred. Delete the pm-users file after successful
migration. This prevents any window where PM users lose access.

---

## 4. Module Structure

```
modules/releases/
  module.json
  client/
    index.js                          # Route exports
    components/
      ReleaseSelector.vue             # Shared release selector (registry-driven)
      ReleasesSettings.vue            # Unified settings component
    views/
      PlanView.vue                    # Plan tab shell (sub-tabs: Outcomes, Health)
      ExecuteView.vue                 # Execute tab shell (Overview sub-tab)
      FeatureDetailView.vue           # Execute drill-down (full page)
      DeliverView.vue                 # Deliver tab shell (sub-tabs)
      ReportsView.vue                 # Reports hub (placeholder)
      AuditView.vue                   # Unified audit log
    plan/
      views/                          # From release-planning/client/views/
        DashboardView.vue             # Outcomes content (used by PlanView)
        HealthDashboardView.vue       # Health content (used by PlanView)
      components/                     # From release-planning/client/components/
        BigRocksTable.vue
        BigRockRow.vue
        BigRockExpandedRow.vue
        BigRockEditPanel.vue
        BigRockDeleteDialog.vue
        FeaturesTable.vue
        RfesTable.vue
        SummaryCards.vue
        FilterBar.vue
        NewReleaseDialog.vue
        RecentActivity.vue
        FeatureHealthTable.vue
        FeatureHealthRow.vue          # NOTE: has hardcoded #/feature-traffic URL, must update
        HealthFilterBar.vue
        HealthSummaryCards.vue
        PlanningGateStatus.vue
        RiskPopover.vue
        RiskBadge.vue
        StatusBadge.vue               # Plan-specific status badge
        RiceScoreDisplay.vue
        RiceFieldConfig.vue
        MilestoneTimeline.vue
        TierSeparator.vue
      composables/
        useReleasePlanning.js
        useReleaseHealth.js
        useBigRockEditor.js
        useFilters.js
        useHealthAggregation.js
        useAuditLog.js
        useRefreshPolling.js
        useReleaseDistribution.js
        useClickOutside.js
        useFocusTrap.js
        usePopover.js
      utils/
        constants.js                  # Source: release-planning/client/constants.js (not utils/)
        outcomes-export.js
        health-export.js
        risk-levels.js
        phase-filter.js
    execute/
      views/                          # From feature-traffic/client/views/
        OverviewView.vue              # Overview content (used by ExecuteView)
      components/                     # From feature-traffic/client/components/
        StatusBadge.vue               # Execute-specific status badge
        SignoffBadge.vue
        SignoffSection.vue
        AIReviewSection.vue
        AIAssessmentBreakdown.vue
        AIAssessmentHistory.vue
        AIFeedbackText.vue
        AIInfoBubble.vue
        EpicBreakdown.vue
        FeatureTable.vue
        MetricsCards.vue
        TrafficMap.vue                # Currently disabled (SHOW_DELIVERY_PIPELINE flag)
      composables/
        useFeatureTraffic.js
        useAIReview.js
      utils/
        ai-review-helpers.js
    deliver/
      views/                          # From release-analysis/client/views/
        MainView.vue                  # Risk Dashboard content (used by DeliverView)
        ProjectBreakdownView.vue      # Component Breakdown content
        ConformaExceptionsView.vue    # Conforma content
      components/                     # From release-analysis/client/components/
        ReleaseFilterBar.vue
        ReleaseVersionGroup.vue
        ProductReleaseCard.vue
        ComponentDetailRow.vue
        MonteCarloChart.vue
      composables/
        useReleaseAnalysis.js
        useReleaseFilter.js
        useConformaExceptions.js
      utils/
        monteCarlo.js
    reports/
      ReportsHub.vue                  # Hub component (registry pattern)
      registry.js                     # Report definitions (empty for now)
  server/
    index.js                          # Main router, mounts sub-routers
    registry.js                       # Release registry CRUD + auto-discover
    planning/                         # From release-planning/server/
      routes.js                       # Renamed from index.js; planning routes
      config.js
      pipeline.js
      cache-reader.js                 # Updated: reads from releases/execution/ paths
      validation.js
      audit-log.js
      config-lock.js
      config-backup.js
      outcome-fetch.js
      doc-import.js
      constants.js
      health/
        health-routes.js              # Updated: reads Product Pages from delivery paths
        health-pipeline.js            # Updated: reads Product Pages from delivery paths
        jira-enrichment.js
        planning-gates.js
        risk-engine.js
        rice-scorer.js
        priority-scorer.js
        tshirt-parser.js
    execution/                        # From feature-traffic/server/
      routes.js                       # Renamed from index.js
      scheduler.js
      gitlab-fetch.js                 # Updated: writes to releases/execution/ paths
      export.js
    delivery/                         # From release-analysis/server/
      routes.js                       # Renamed from index.js
      config.js
      product-pages.js
      conforma.js
  __tests__/
    server/
      planning/                       # From release-planning/__tests__/server/
      execution/                      # From feature-traffic/__tests__/server/
      delivery/                       # From release-analysis/__tests__/server/
      registry.test.js                # New: registry CRUD tests
    client/
      planning/                       # From release-planning/__tests__/client/
      execution/                      # From feature-traffic/__tests__/client/
      delivery/                       # From release-analysis/__tests__/client/
```

**Note on test files**: release-planning has a test at
`client/utils/__tests__/health-export.test.js` (nested inside utils). This
moves to `__tests__/client/planning/health-export.test.js` alongside the
other client tests.

### module.json

```json
{
  "name": "Releases",
  "slug": "releases",
  "defaultEnabled": true,
  "description": "Unified release lifecycle: planning, execution tracking, and delivery readiness",
  "icon": "rocket",
  "order": 10,
  "client": {
    "entry": "./client/index.js",
    "navItems": [
      { "id": "plan", "label": "Plan", "icon": "ClipboardList", "default": true },
      { "id": "execute", "label": "Execute", "icon": "GitBranch" },
      { "id": "deliver", "label": "Deliver", "icon": "Rocket" },
      { "id": "reports", "label": "Reports", "icon": "BarChart3" },
      { "id": "audit", "label": "Audit", "icon": "History" }
    ],
    "settingsComponent": "./client/components/ReleasesSettings.vue"
  },
  "server": {
    "entry": "./server/index.js"
  },
  "export": {
    "customHandler": true,
    "files": [
      { "path": "releases/registry.json", "notes": "Canonical release registry" },
      { "path": "releases/execution/index.json", "notes": "Feature index with summary metrics" },
      { "path": "releases/execution/features/*.json", "notes": "Per-feature detail files" }
    ]
  }
}
```

---

## 5. Storage Restructure

### Path Mapping

| Old Path | New Path |
|----------|----------|
| `feature-traffic/index.json` | `releases/execution/index.json` |
| `feature-traffic/features/*.json` | `releases/execution/features/*.json` |
| `feature-traffic/rfes/*.json` | `releases/execution/rfes/*.json` |
| `feature-traffic/config.json` | `releases/execution/config.json` |
| `feature-traffic/last-fetch.json` | `releases/execution/last-fetch.json` |
| `release-planning/config.json` | `releases/planning/config.json` |
| `release-planning/pm-users.json` | _(deleted, migrated to RBAC)_ |
| `release-planning/releases/*.json` | `releases/planning/releases/*.json` |
| `release-planning/candidates-cache-*.json` | `releases/planning/candidates-cache-*.json` |
| `release-planning/health-cache-*.json` | `releases/planning/health-cache-*.json` |
| `release-planning/health-overrides-*.json` | `releases/planning/health-overrides-*.json` |
| `release-planning/dor-state-*.json` | `releases/planning/dor-state-*.json` |
| `release-planning/committed-snapshot-*.json` | `releases/planning/committed-snapshot-*.json` |
| `release-planning/outcome-summaries-cache-*.json` | `releases/planning/outcome-summaries-cache-*.json` |
| `release-planning/audit-log.json` | `releases/audit-log.json` _(top-level, shared)_ |
| `release-planning/releases-backup/*.json` | `releases/planning/releases-backup/*.json` |
| `release-analysis/config.json` | `releases/delivery/config.json` |
| `release-analysis/analysis-cache.json` | `releases/delivery/analysis-cache.json` |
| `release-analysis/product-pages-releases-cache.json` | `releases/delivery/product-pages-releases-cache.json` |
| `release-analysis/conforma.json` | `releases/delivery/conforma.json` |
| _(new)_ | `releases/registry.json` |

**Note**: The conforma storage key is `conforma.json` (not
`conforma-releases.json` as previously documented in CLAUDE.md).

### Cross-module reads eliminated

Today release-planning reads from `feature-traffic/` and `release-analysis/`
via `readFromStorage`. After the merge, these become internal reads within the
same module. All three cross-module storage reads:

1. `cache-reader.js` → `releases/execution/index.json` (was `feature-traffic/index.json`)
2. `health-pipeline.js` → `releases/delivery/product-pages-releases-cache.json` (was `release-analysis/...`, lines 237 and 299)
3. `health-routes.js` → `releases/delivery/product-pages-releases-cache.json` (was `release-analysis/...`, line 796)

### Data migration

For existing deployments with data at old storage paths:

1. **Automatic on startup**: The module's `server/index.js` runs a migration
   check on initialization. If old paths exist and new paths don't, files are
   copied to new locations. Old files are left in place (not deleted) as a
   safety measure. A log message records the migration.
2. **Admin cleanup endpoint**: `POST /api/modules/releases/admin/migrate-storage`
   removes old-path files after verifying new-path files exist. Idempotent.
3. **Deployment runbook** (see section 14): The new code deploys, startup
   migration runs automatically, admin calls cleanup endpoint when satisfied.

---

## 6. API Routes

All routes under `/api/modules/releases/`.

### Registry (new)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/registry` | authenticated | List releases |
| GET | `/registry/:id` | authenticated | Single release |
| POST | `/registry` | release-manager | Create release |
| PUT | `/registry/:id` | release-manager | Update release |
| DELETE | `/registry/:id` | release-manager | Archive release |
| POST | `/registry/discover` | release-manager | Auto-discover from Product Pages |

### Planning (`/planning/...`)

Moved from `/api/modules/release-planning/`. Auth changes: `requirePM` →
`requireReleaseManager`.

| Method | Path | Auth |
|--------|------|------|
| GET | `/planning/releases` | read |
| POST | `/planning/releases` | release-manager |
| DELETE | `/planning/releases/:version` | release-manager |
| GET | `/planning/releases/:version/candidates` | read |
| POST | `/planning/releases/:version/big-rocks` | release-manager |
| PUT | `/planning/releases/:version/big-rocks/:name` | release-manager |
| DELETE | `/planning/releases/:version/big-rocks/:name` | release-manager |
| PUT | `/planning/releases/:version/big-rocks/reorder` | release-manager |
| POST | `/planning/releases/:version/refresh` | release-manager |
| GET | `/planning/refresh/status` | read |
| POST | `/planning/jira/validate-keys` | release-manager |
| POST | `/planning/releases/:version/import/doc/preview` | release-manager |
| POST | `/planning/releases/:version/import/doc` | release-manager |
| GET | `/planning/smartsheet/releases` | read |
| GET | `/planning/releases/:version/health` | read |
| POST | `/planning/releases/:version/health/refresh` | release-manager |
| GET | `/planning/releases/:version/health/refresh/status` | read |
| PUT | `/planning/releases/:version/health/override/:featureKey` | release-manager |
| DELETE | `/planning/releases/:version/health/override/:featureKey` | release-manager |
| POST | `/planning/releases/:version/health/snapshot/:phase` | release-manager |
| GET | `/planning/permissions` | read |

PM user management routes (`/pm-users`) are **removed** (replaced by central RBAC).

### Execution (`/execution/...`)

Moved from `/api/modules/feature-traffic/`.

| Method | Path | Auth |
|--------|------|------|
| GET | `/execution/features` | read |
| GET | `/execution/features/:key` | read |
| GET | `/execution/versions` | read |
| GET | `/execution/status` | read |
| GET | `/execution/config` | admin |
| POST | `/execution/config` | admin |
| POST | `/execution/refresh` | admin |

### Delivery (`/delivery/...`)

Moved from `/api/modules/release-analysis/`.

| Method | Path | Auth |
|--------|------|------|
| GET | `/delivery/config` | admin |
| POST | `/delivery/config` | admin |
| DELETE | `/delivery/config` | admin |
| GET | `/delivery/product-pages/products` | admin |
| GET | `/delivery/refresh/status` | read |
| POST | `/delivery/refresh` | admin |
| GET | `/delivery/analysis` | read |
| POST | `/delivery/admin/releases` | admin |
| GET | `/delivery/conforma/releases` | read |
| GET | `/delivery/conforma/releases/:version` | read |
| GET | `/delivery/conforma/status` | read |
| POST | `/delivery/conforma/bulk` | admin |
| DELETE | `/delivery/conforma` | admin |

### Admin

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/admin/migrate-storage` | admin | One-time storage migration cleanup |
| POST | `/admin/seed` | admin | Bulk import (from release-planning) |
| GET | `/admin/seed/fixture` | admin | Load seed fixture |

### Audit

| Method | Path | Auth |
|--------|------|------|
| GET | `/audit-log` | read |

### OpenAPI annotations

Every route handler gets an `@openapi` JSDoc annotation per project convention.

---

## 7. Client Architecture

### Entry point (`client/index.js`)

```javascript
import { defineAsyncComponent } from 'vue'

export const routes = {
  'plan': defineAsyncComponent(() => import('./views/PlanView.vue')),
  'execute': defineAsyncComponent(() => import('./views/ExecuteView.vue')),
  'feature-detail': defineAsyncComponent(() => import('./views/FeatureDetailView.vue')),
  'deliver': defineAsyncComponent(() => import('./views/DeliverView.vue')),
  'reports': defineAsyncComponent(() => import('./views/ReportsView.vue')),
  'audit': defineAsyncComponent(() => import('./views/AuditView.vue')),
}
```

Note: `feature-detail` is a hidden route (not a nav item) used for drill-down
from Execute Overview.

### Shared Release Selector

`ReleaseSelector.vue` fetches from `/api/modules/releases/registry` and
provides the selected release context via `provide('selectedRelease', ...)`.
All sub-views `inject('selectedRelease')` to filter their data.

The selector shows:
- Release display name (e.g., "RHOAI 2.14")
- State badge (active/archived)
- GA date if known

### View shells

Each tab view (PlanView, ExecuteView, DeliverView) contains:
1. Sub-tab navigation (internal tab bar, not sidebar nav items)
2. The active sub-tab's content component

Sub-tab state is preserved in the URL hash query params (e.g.,
`#/releases/plan?tab=health`) so it survives navigation.

### API path updates

All composable API calls update their base path:
- `useReleasePlanning.js`: `/modules/release-planning/` → `/modules/releases/planning/`
- `useFeatureTraffic.js`: `/modules/feature-traffic/` → `/modules/releases/execution/`
- `useReleaseAnalysis.js`: `/modules/release-analysis/` → `/modules/releases/delivery/`
- `useAIReview.js`: No change (still reads from `/modules/ai-impact/`)

### Cross-module navigation updates

**Within the releases module**:
- `FeatureHealthRow.vue` (line 113): Update hardcoded `#/feature-traffic/feature-detail?key=...`
  to use `navigateTo('feature-detail', { key })` via `moduleNav` inject.

**In ai-impact module** (external, must be updated in same PR):
- `modules/ai-impact/client/views/RFEReviewView.vue` (line 108):
  Change `crossNavigate('feature-traffic', 'feature-detail', ...)` to
  `crossNavigate('releases', 'feature-detail', ...)`
- `modules/ai-impact/client/views/FeatureReviewView.vue` (line 36):
  Same change.

---

## 8. Server Architecture

### Main router (`server/index.js`)

The main server entry point creates sub-routers and mounts them:

```javascript
module.exports = function registerRoutes(router, context) {
  const { storage, requireAuth, requireAdmin, requireReleaseManager, requireScope } = context;

  // Startup: auto-migrate storage paths if needed
  migrateStoragePaths(storage);

  // Startup: auto-migrate PM users to release-manager role if needed
  migratePMUsers(storage, context.roleStore);

  // Registry routes (top-level)
  registerRegistryRoutes(router, { storage, requireAuth, requireReleaseManager, requireScope });

  // Planning sub-router
  const planningRouter = express.Router();
  registerPlanningRoutes(planningRouter, { storage, requireAuth, requireReleaseManager, requireScope });
  router.use('/planning', planningRouter);

  // Execution sub-router
  const executionRouter = express.Router();
  registerExecutionRoutes(executionRouter, { storage, requireAuth, requireAdmin, requireScope });
  router.use('/execution', executionRouter);

  // Delivery sub-router
  const deliveryRouter = express.Router();
  registerDeliveryRoutes(deliveryRouter, { storage, requireAuth, requireAdmin, requireScope });
  router.use('/delivery', deliveryRouter);

  // Audit (top-level)
  registerAuditRoutes(router, { storage, requireAuth, requireScope });

  // Admin (top-level)
  registerAdminRoutes(router, { storage, requireAuth, requireAdmin });
};
```

### Startup initialization sequencing

The three domains have startup side effects that must be coordinated:
- **Delivery** (release-analysis): fires `triggerBackgroundRefresh()` after 2s delay
- **Execution** (feature-traffic): calls `initScheduler()` on load
- **Planning**: has its own refresh state management

To avoid all three hitting Jira APIs simultaneously on startup, stagger the
initialization: planning first (immediate), execution second (5s delay),
delivery third (10s delay). This prevents API rate limiting issues.

### Internal reads simplified

`cache-reader.js` currently does `readFromStorage('feature-traffic/index.json')`.
After the merge, this becomes `readFromStorage('releases/execution/index.json')`.
Same storage abstraction, just different paths. No cross-module access.

`health-pipeline.js` (lines 237, 299) and `health-routes.js` (line 796)
currently read `readFromStorage('release-analysis/product-pages-releases-cache.json')`.
After the merge: `readFromStorage('releases/delivery/product-pages-releases-cache.json')`.

### Relative require() path updates

Moving server files one level deeper (e.g., from `modules/release-planning/server/`
to `modules/releases/server/planning/`) breaks all relative `require()` paths
to `shared/server/*`. These must be updated:

| File | Current require | New require |
|------|----------------|-------------|
| `planning/health/health-pipeline.js` | `../../../../shared/server/smartsheet` | `../../../../../shared/server/smartsheet` |
| `planning/health/health-pipeline.js` | `../../../../shared/server/jira` | `../../../../../shared/server/jira` |
| `planning/routes.js` | `../../../shared/server/smartsheet` | `../../../../shared/server/smartsheet` |
| `planning/doc-import.js` | `../../../shared/server/google-docs` | `../../../../shared/server/google-docs` |
| `planning/outcome-fetch.js` | `../../../shared/server/jira` | `../../../../shared/server/jira` |
| `delivery/routes.js` | `../../../shared/server/jira` | `../../../../shared/server/jira` |

All `require()` paths to `shared/server/*` in moved files need an extra `../`
level added.

### loadFixture() path fix

`release-planning/server/index.js` has a `loadFixture()` function that uses
`path.join(__dirname, '..', '..', '..', 'fixtures', DATA_PREFIX, name)` to
resolve fixture paths. After relocation to `modules/releases/server/planning/`,
`__dirname` changes and the traversal needs an extra `..`:
`path.join(__dirname, '..', '..', '..', '..', 'fixtures', 'releases', 'planning', name)`.

### Product Pages integration

Stays in `server/delivery/product-pages.js`. The registry auto-discover
endpoint calls into this module to fetch releases, then maps them into the
registry format.

---

## 9. Settings

### Unified settings component

`ReleasesSettings.vue` combines settings from all three modules into sections:

1. **Release Registry** — manage releases, trigger auto-discover
2. **Planning** — RICE field config (from HealthDashboardView admin section)
3. **Execution** — GitLab CI artifact config (from FeatureTrafficSettings)
4. **Delivery** — Jira project keys, risk thresholds, Product Pages config,
   baseline params (from ReleaseAnalysisSettings)
5. **Data Refresh** — unified refresh controls for all pipelines

Each section is collapsible. Uses the existing settings component pattern from
the module system.

Source components (not copied directly, content folded into ReleasesSettings):
- `modules/feature-traffic/client/components/FeatureTrafficSettings.vue`
- `modules/release-analysis/client/components/ReleaseAnalysisSettings.vue`
- RICE config from `modules/release-planning/client/views/HealthDashboardView.vue`

---

## 10. Reports (Placeholder)

### Pattern

Follows the team-tracker reports hub pattern:

- `ReportsView.vue` — hub component showing report cards or active report
- `reports/registry.js` — report definitions array (empty for MVP)
- Placeholder state: "Reports coming soon" message with a brief description

### Future reports (not built now)

- Release health trending
- Feature completion velocity
- Cross-release comparison
- Blocker analysis

---

## 11. Audit Log (Unified)

### Current state

Only release-planning logs audit events (Big Rock CRUD, release management,
PM user changes). Feature-traffic and release-analysis have no audit logging.

### Changes

- Move audit log storage to `releases/audit-log.json` (shared across domains)
- Add audit logging to execution and delivery write operations:
  - Execution: config saves, manual refreshes
  - Delivery: config saves, manual refreshes, conforma bulk imports
  - Registry: create/update/delete releases, auto-discover
- Each audit entry includes a `domain` field (`planning`, `execution`,
  `delivery`, `registry`) for filtering
- AuditView allows filtering by domain, version, action, date range
- Existing audit entries (migrated from `release-planning/audit-log.json`)
  that lack a `domain` field default to `"planning"` when displayed

### Audit entry schema

```json
{
  "timestamp": "2026-05-18T12:00:00Z",
  "domain": "planning",
  "action": "create_rock",
  "user": "alice@redhat.com",
  "summary": "Created Big Rock 'Model Serving'",
  "version": "3.5",
  "details": {}
}
```

---

## 12. Fixtures & Demo Mode

### Fixture restructure

| Old Path | New Path |
|----------|----------|
| `fixtures/feature-traffic/` | `fixtures/releases/execution/` |
| `fixtures/release-planning/` | `fixtures/releases/planning/` |
| `fixtures/release-analysis/` | `fixtures/releases/delivery/` |
| _(new)_ | `fixtures/releases/registry.json` |

Additional release-planning fixtures to handle:
- `fixtures/release-planning/config-crud-test.json` → move to planning/
- `fixtures/release-planning/google-doc-response.json` → move to planning/
- `fixtures/release-planning/pm-users.json` → drop (RBAC replaces this)

### Registry fixture

Create a `fixtures/releases/registry.json` with 2-3 demo releases that match
the existing fixture data (versions referenced in feature-traffic fixtures and
release-planning fixtures).

### Demo storage

`shared/server/demo-storage.js` is a generic abstraction that reads from
`fixtures/` using whatever key is passed — no hardcoded module paths. The
fixture directory restructure is the only change needed for demo mode.

---

## 13. Tests

### Test migration

All existing tests move to `modules/releases/__tests__/` preserving their
subdirectory structure (planning/, execution/, delivery/).

Special cases:
- `release-planning/client/utils/__tests__/health-export.test.js` → moves to
  `modules/releases/__tests__/client/planning/health-export.test.js`

### Path updates in tests

Tests that reference old storage paths (`feature-traffic/`, `release-planning/`,
`release-analysis/`) update to new paths (`releases/execution/`, etc.).

Tests that reference old API paths (`/modules/feature-traffic/`, etc.) update
to new paths (`/modules/releases/execution/`, etc.).

### Tests in other modules

- `src/__tests__/BuiltInModuleSettings.test.js` references `release-analysis`
  slug in test fixtures. Update to `releases`.

### New tests

- `registry.test.js` — Registry CRUD, auto-discover, validation
- `rbac.test.js` — release-manager role integration (assign, check, middleware)
- `storage-migration.test.js` — Storage path migration endpoint
- `audit-unified.test.js` — Cross-domain audit logging

### Integration tests

No existing integration tests for these three modules. Create a new
`tests/integration/releases.spec.js` with `@releases` tag.

---

## 14. CI/CD & Deployment

### CronJob update

`deploy/openshift/overlays/prod/cronjob-sync-refresh.yaml`:
Change `POST /api/modules/feature-traffic/refresh` to
`POST /api/modules/releases/execution/refresh`.

### Kustomize

No new overlays needed. The module is auto-discovered. ConfigMap changes
(if any env vars change names) go in the existing overlays.

### CODEOWNERS

Update `.github/CODEOWNERS`:
- Remove entries for `modules/release-analysis/`
- Add entry for `modules/releases/`

### CI workflows

- `ci.yml`: Change detection paths update (old module dirs → `modules/releases/`)
- `build-images.yml`: Same path updates
- `integration-tests.yml`: Update module filter and test job

### Deployment runbook (existing environments)

1. Deploy new code (contains `modules/releases/`, old modules deleted)
2. On startup, the module auto-migrates storage (copies old paths → new paths)
3. On startup, the module auto-migrates PM users to `release-manager` role
4. Verify the app works correctly
5. Call `POST /api/modules/releases/admin/migrate-storage` to clean up old files
6. Update any external automation scripts that reference old API endpoints

### No legacy API forwards

Clean break — no backwards-compatible redirects.

---

## 15. Migration & Cleanup

### Delete old modules

After the new `modules/releases/` is complete and all tests pass:

- Delete `modules/feature-traffic/`
- Delete `modules/release-planning/`
- Delete `modules/release-analysis/`

### Delete old fixtures

- Delete `fixtures/feature-traffic/`
- Delete `fixtures/release-planning/`
- Delete `fixtures/release-analysis/`

### Update documentation

Per project conventions, documentation updates land in the same PR:

- **`.claude/CLAUDE.md`**: Update API routes section (remove old module routes,
  add unified releases routes). Update module list references.
- **`AGENTS.md`**: Update module list in hard constraint #4.
- **`docs/MODULES.md`**: Update `crossNavigate('feature-traffic', ...)` example
  (line 126) to use `releases` slug.
- **`docs/DATA-FORMATS.md`**: Update storage path references.
- **`shared/API.md`**: Update if it references old module exports.
- **`docs/plans/product-pages-oauth.md`**: Update references to
  `modules/release-analysis/`.
- **`docs/plans/feature-traffic-gitlab-fetch.md`**: Update references to
  `modules/feature-traffic/`.
- **`deploy/OPENSHIFT.md`**: Update references to `feature-traffic`
  (FEATURE_TRAFFIC_GITLAB_TOKEN) and `release-planning`.

---

## 16. Phased Execution

**Important sequencing note**: Because `cache-reader.js` (planning) reads from
feature-traffic storage paths and `health-pipeline.js` (planning) reads from
release-analysis storage paths, we cannot move Plan domain and update its
storage paths independently from Execute and Deliver. Two approaches:

**Approach chosen: Move all code first, update all paths together.** All three
domains' code is moved into the new module structure in Phases 2-4, but
storage path constants are NOT updated until all code is in place. In Phase 5,
all storage paths are updated atomically. This avoids the sequencing problem.

### Phase 1: Scaffolding & Registry (~1 sprint)

1. Create `modules/releases/` directory structure and `module.json`
2. Implement unified release registry (server + client + tests)
3. Add `release-manager` role to RBAC system (shared/server changes)
4. Update `server/api-tokens.js` scope catalog (old scope names → new)
5. Create the Release Selector component
6. Create tab shell views (PlanView, ExecuteView, DeliverView, ReportsView,
   AuditView) with sub-tab navigation — initially empty content areas
7. **Checkpoint**: New module appears in sidebar, registry works, role
   assignable. Tabs render empty shells.

### Phase 2: Move Plan domain (~1 sprint)

1. Copy all release-planning client code into `modules/releases/client/plan/`
   - Include views: DashboardView.vue, HealthDashboardView.vue
   - Include all components, composables, utils
   - Note: `constants.js` source is at `client/constants.js` not `client/utils/`
2. Copy all release-planning server code into `modules/releases/server/planning/`
   - Rename `server/index.js` → `server/planning/routes.js`
   - Fix all relative `require()` paths (add extra `../` level)
   - Fix `loadFixture()` `__dirname` path calculation
3. Wire PlanView sub-tabs (Outcomes, Health) to the moved view components
4. **DO NOT update storage paths yet** — keep reading from `release-planning/` paths
5. Update API paths in composables (`/modules/release-planning/` → `/modules/releases/planning/`)
6. Replace `requirePM` with `requireReleaseManager` in routes
7. Add PM user auto-migration to module startup (read pm-users.json → assign role)
8. Remove PM user management routes
9. Fix `FeatureHealthRow.vue` hardcoded `#/feature-traffic/` URL
10. Move and update tests
11. **Checkpoint**: Plan tab fully functional using old storage paths.

### Phase 3: Move Execute domain (~1 sprint)

1. Copy all feature-traffic client code into `modules/releases/client/execute/`
   - Include views: OverviewView.vue
   - Include all components (including TrafficMap.vue), composables, utils
2. Copy all feature-traffic server code into `modules/releases/server/execution/`
   - Rename `server/index.js` → `server/execution/routes.js`
   - Fix all relative `require()` paths
3. Wire ExecuteView to the moved OverviewView component
4. Wire FeatureDetailView drill-down (moved from feature-traffic)
5. **DO NOT update storage paths yet** — keep reading/writing `feature-traffic/` paths
6. Update API paths in composables
7. Move and update tests
8. Update export handler (`export.js`) data prefix
9. **Checkpoint**: Execute tab fully functional using old storage paths.

### Phase 4: Move Deliver domain (~1 sprint)

1. Copy all release-analysis client code into `modules/releases/client/deliver/`
   - Include views: MainView.vue, ProjectBreakdownView.vue, ConformaExceptionsView.vue
   - Include all components, composables, utils
2. Copy all release-analysis server code into `modules/releases/server/delivery/`
   - Rename `server/index.js` → `server/delivery/routes.js`
   - Fix all relative `require()` paths
3. Wire DeliverView sub-tabs to the moved view components
4. **DO NOT update storage paths yet** — keep reading/writing `release-analysis/` paths
5. Update API paths in composables
6. Move and update tests
7. Sequence startup initialization (stagger delays)
8. **Checkpoint**: Deliver tab fully functional using old storage paths.

### Phase 5: Storage paths, Registry integration, Audit, Reports, Settings (~1 sprint)

1. **Update ALL storage paths atomically** across all three domains:
   - Planning: `release-planning/` → `releases/planning/`
   - Execution: `feature-traffic/` → `releases/execution/`
   - Delivery: `release-analysis/` → `releases/delivery/`
   - Cross-domain reads (cache-reader, health-pipeline, health-routes): update to new paths
   - Audit log: `release-planning/audit-log.json` → `releases/audit-log.json`
2. Add automatic storage migration to module startup
3. Connect Release Selector to all three domain tabs (provide/inject)
4. Implement registry auto-discover from Product Pages
5. Seed registry from existing config on first load
6. Unify audit log (add domain field, add audit logging to execution/delivery)
   - Default missing `domain` field to `"planning"` for migrated entries
7. Build Reports placeholder (hub + empty registry)
8. Build unified ReleasesSettings component
9. Update all sub-domain version resolution to read from registry where applicable
10. Update tests for new storage paths

### Phase 6: Cleanup (~0.5 sprint)

1. Delete `modules/feature-traffic/`, `modules/release-planning/`,
   `modules/release-analysis/`
2. Delete old fixtures, create new fixtures under `fixtures/releases/`
3. Update all documentation (CLAUDE.md, AGENTS.md, DATA-FORMATS.md,
   MODULES.md, plans/*.md, OPENSHIFT.md)
4. Update CI/CD (CronJob, CODEOWNERS, workflow paths)
5. Update `dev-server.js` (remove any old module references)
6. Update ai-impact module cross-navigation (`crossNavigate` calls)
7. Update `src/__tests__/BuiltInModuleSettings.test.js`
8. Run full test suite, smoke tests, integration tests
9. Storage migration cleanup endpoint

---

## 17. Files Modified

### New files

| File | Purpose |
|------|---------|
| `modules/releases/module.json` | Module manifest |
| `modules/releases/client/index.js` | Route exports |
| `modules/releases/client/components/ReleaseSelector.vue` | Shared release selector |
| `modules/releases/client/components/ReleasesSettings.vue` | Unified settings |
| `modules/releases/client/views/PlanView.vue` | Plan tab shell |
| `modules/releases/client/views/ExecuteView.vue` | Execute tab shell |
| `modules/releases/client/views/FeatureDetailView.vue` | Feature detail drill-down |
| `modules/releases/client/views/DeliverView.vue` | Deliver tab shell |
| `modules/releases/client/views/ReportsView.vue` | Reports placeholder |
| `modules/releases/client/views/AuditView.vue` | Unified audit view |
| `modules/releases/client/reports/ReportsHub.vue` | Reports hub component |
| `modules/releases/client/reports/registry.js` | Report definitions (empty) |
| `modules/releases/server/index.js` | Main router (mounts sub-routers) |
| `modules/releases/server/registry.js` | Release registry CRUD |
| `modules/releases/__tests__/server/registry.test.js` | Registry tests |
| `fixtures/releases/registry.json` | Demo registry data |

### Moved files (all client + server + test files from three old modules)

~100+ files total. See Module Structure (section 4) for full listing.

### Modified shared files

| File | Change |
|------|--------|
| `shared/server/role-store.js` | Add `'release-manager'` to VALID_ROLES |
| `shared/server/auth.js` | Add `req.isReleaseManager`, `requireReleaseManager`, update exports |
| `shared/server/permissions.js` | Add `release-manager` tier, update `getPermissionTier()` signature |
| `server/dev-server.js` | Add `requireReleaseManager` to moduleContext |
| `server/api-tokens.js` | Update scope catalog (old module scopes → `releases:*`) |
| `src/components/UserManagement.vue` | Add release-manager to role dropdown + display maps |
| `modules/ai-impact/client/views/RFEReviewView.vue` | Update crossNavigate slug |
| `modules/ai-impact/client/views/FeatureReviewView.vue` | Update crossNavigate slug |
| `src/__tests__/BuiltInModuleSettings.test.js` | Update module slug in fixtures |
| `.claude/CLAUDE.md` | Update API routes |
| `AGENTS.md` | Update module list |
| `docs/MODULES.md` | Update crossNavigate example |
| `docs/DATA-FORMATS.md` | Update storage paths |
| `docs/plans/product-pages-oauth.md` | Update module references |
| `docs/plans/feature-traffic-gitlab-fetch.md` | Update module references |
| `deploy/OPENSHIFT.md` | Update module references |
| `deploy/openshift/overlays/prod/cronjob-sync-refresh.yaml` | Update API endpoint |
| `.github/CODEOWNERS` | Update module paths |

### Deleted files

| Path | Reason |
|------|--------|
| `modules/feature-traffic/` (entire directory) | Merged into releases |
| `modules/release-planning/` (entire directory) | Merged into releases |
| `modules/release-analysis/` (entire directory) | Merged into releases |
| `fixtures/feature-traffic/` | Moved to fixtures/releases/execution/ |
| `fixtures/release-planning/` | Moved to fixtures/releases/planning/ |
| `fixtures/release-analysis/` | Moved to fixtures/releases/delivery/ |

---

## 18. Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Large PR size (~100+ moved files + new code) | Medium | Phased execution with per-phase checkpoints. Can merge phases as separate PRs if needed. |
| Existing deployments have data in old storage paths | High | Automatic startup migration (copy to new paths). Admin cleanup endpoint. Deployment runbook. |
| Feature-traffic scheduler + GitLab fetch paths break | High | Storage paths updated atomically in Phase 5 after all code is moved. |
| CronJob calls old API endpoint | High | Update CronJob YAML in same PR as module merge. Deploy atomically. |
| PM users lose access during migration | High | PM user migration runs in Phase 2 (same phase as requirePM replacement). No access gap. |
| Regression in any of the three domains | High | Move existing tests alongside code. Run full suite at each phase checkpoint. |
| Export handler breaks (feature-traffic anonymization) | Medium | Update export.js paths in Phase 3 and test. |
| ai-impact cross-navigation breaks | High | Update crossNavigate calls in ai-impact module (Phase 6). |
| API token scopes break existing tokens | High | Migrate scope names in api-tokens.js. Scan existing tokens on startup. |
| Relative require() paths break after file relocation | High | Explicitly fix all shared/server/* require paths when moving files. |
| loadFixture() __dirname path breaks demo mode | High | Fix path calculation when relocating planning routes. |
| Startup side effects from all three domains fire simultaneously | Medium | Stagger initialization delays (0s, 5s, 10s). |
| demo-storage.js has hardcoded old paths | Low | Verified: demo-storage.js is generic, no hardcoded paths. Fixture restructure is sufficient. |
| Existing audit entries lack `domain` field | Low | Default to `"planning"` when displaying entries without a domain. |

---

## 19. Review Findings & Resolutions

This section documents issues found during Architect validation and Red Team
adversarial review, and how they were resolved in this plan revision.

### Critical (all addressed)

1. **Wrong conforma filename**: Storage key is `conforma.json` not `conforma-releases.json`.
   Fixed in storage path mapping (section 5).

2. **ai-impact cross-navigation breaks**: `crossNavigate('feature-traffic', ...)`
   in ai-impact module. Added to client architecture section 7 and Phase 6 cleanup.

3. **API token scopes break**: Old scope names in token catalog need migration.
   Added `server/api-tokens.js` updates to RBAC section 3 and Phase 1.

### Major (all addressed)

4. **Relative require() paths break**: Moving files deeper adds a directory level.
   Added explicit path mapping table in section 8.

5. **loadFixture() uses __dirname**: Path traversal breaks after relocation.
   Added fix details in section 8.

6. **PM user migration timing**: Was in Phase 6, leaving a 4-sprint access gap.
   Moved to Phase 2 (same phase as requirePM replacement).

7. **Phase sequencing problem**: Cross-domain reads break if paths update per-phase.
   Resolved: all storage paths update atomically in Phase 5.

8. **Startup side effects**: All three domains hit APIs simultaneously.
   Added staggered initialization in section 8.

9. **getPermissionTier() parameter threading**: Function signature needs new param.
   Added explicit implementation detail in section 3.

10. **Missing client views in file tree**: DashboardView, HealthDashboardView, etc.
    Added to module structure (section 4).

11. **health-routes.js cross-module read**: Third storage read not documented.
    Added to section 5 cross-module reads list.

12. **Storage migration race condition**: No deployment runbook.
    Added automatic startup migration + deployment runbook (sections 5, 14).

### Minor (all addressed)

13. **FeatureHealthRow hardcoded URL**: Fixed in Phase 2 task list.
14. **BuiltInModuleSettings.test.js**: Added to modified files list.
15. **docs/plans/*.md references**: Added to documentation update list.
16. **Existing audit entries lack domain field**: Default to "planning" on display.
17. **Server file rename (index.js → routes.js)**: Made explicit in Phase 2-4 steps.
18. **constants.js source location**: Noted correct source path in file tree.
