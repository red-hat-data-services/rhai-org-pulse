# Outcomes Dashboard Access Control: Open Editing + Audit Enhancement

**Status:** Draft
**Author:** Architect Agent
**Date:** 2026-06-09
**Module:** releases (planning + health sub-modules)

---

## 1. Problem Statement

The Outcomes Dashboard and Health Dashboard currently restrict editing (Big Rock
CRUD, risk overrides, snapshots, health config, etc.) to users with the
`release-manager` role or `admin` status. In practice, the team that uses these
dashboards is broad enough that the role gate creates friction -- the right
people cannot edit, and the admin must manually assign the `release-manager`
role to every new user who needs it.

**Goal:** Remove all edit restrictions from both the Outcomes Dashboard and
Health Dashboard so that any authenticated user can make changes. Compensate for
the loss of the role gate by adding detailed audit logging that records who
changed what, when, and the specifics of the change.

### What stays restricted

- **Release Registry** (Manage tab): Continues to require `release-manager`
  role. This controls release identity, Product Pages sync, Jira version
  resolution -- structural operations that have downstream effects across
  planning, execution, and delivery.
- **Hygiene module config**: Continues to require `release-manager`.
- **Admin-only routes** (seed, delete release, config): Continue to require
  `admin` role.
- **Module navigation gates**: The Manage nav item retains
  `requireRole: "release-manager"` in `module.json`.
- **Audit nav item**: Moved to Phase 1 -- remove `requireRole: "release-manager"`
  from the Audit nav item in `module.json`. The Audit API endpoint is already
  open to all authenticated users, so the nav gate is inconsistent. Since
  audit is the primary accountability mechanism compensating for open editing,
  all users should be able to view it.

**Note on `POST /releases` in planning/routes.js:** This route creates
releases from the Outcomes Dashboard (including clone). While the Release
Registry (in `registry.js`) also manages releases, `POST /releases` in
`planning/routes.js` is the primary mechanism users interact with for
creating releases in the planning workflow. Opening this to all
authenticated users is intentional and within scope -- it enables the
self-service release creation that motivated this change. The Registry
routes (which handle Product Pages sync, Jira version resolution, and
structural operations) remain restricted in `registry.js`.

### What becomes open to all authenticated users

- Big Rock CRUD (create, update, delete, reorder)
- Big Rock import from Google Doc (both `append` and `replace` modes)
- Jira key validation
- Pipeline refresh (candidates + health)
- Release creation (new release, clone)
- Risk overrides (set, remove)
- Committed snapshots (create, re-snapshot)
- Health admin config (RICE field, enableStratCreator toggle)
- Health milestones debug

**Destructive operations note:** `POST /releases/:version/import/doc` with
`mode=replace` wipes all existing Big Rocks before importing. This is
mitigated by: (a) the handler already calls `backupConfig()` before
replace-mode imports, creating a restorable snapshot, and (b) the enhanced
audit log entry (Phase 2) will capture the full list of replaced rocks in
`details.replacedRocks` for recovery. The `blockDuringImpersonation`
middleware (Phase 1) will also be applied to this route.

---

## 2. Current Architecture

### 2.1 Permission Model

**Server side:**
- `requireReleaseManager` = `requireRole('release-manager')`, which checks
  `req.isAdmin || roleStore.hasRole(email, 'release-manager')`. Defined in
  `shared/server/auth.js`.
- The `release-manager` role is registered in `modules/releases/server/index.js`
  line 131.
- The planning routes file (`planning/routes.js`) uses `requireReleaseManager`
  on all write endpoints.
- The health routes file (`planning/health/health-routes.js`) uses `requirePM`
  (which is `requireReleaseManager` aliased) on all write endpoints.

**Client side:**
- **Outcomes Dashboard** (`DashboardView.vue` line 74):
  `canEdit = !demoMode && permissions.canEdit` where `permissions` comes from
  `GET /planning/permissions` (returns `{ canEdit: req.isAdmin || req.isReleaseManager }`).
- **Health Dashboard** (`HealthDashboardView.vue` line 47):
  `canEdit = !demoMode && isAdmin` -- even more restrictive, uses `useAuth().isAdmin`
  directly instead of the permissions endpoint.
- The `canEdit` flag flows into `BigRocksTable`, `BigRockRow`,
  `FeatureHealthRow`, `FeatureHealthTable`, `ReleaseSelector`, and
  `HealthSummaryCards` components, controlling UI element visibility (Add button,
  edit/delete buttons, drag handles, new release button, RICE config, snapshot
  buttons).

### 2.2 Audit Log System

The audit log is a well-established, cross-domain system:

- **Storage:** `releases/audit-log.json` -- single JSON file with an `entries`
  array (max 5000 entries, FIFO).
- **Module:** `modules/releases/server/planning/audit-log.js` -- exports
  `logAudit()` and `getAuditLog()`.
- **Entry schema:**
  ```json
  {
    "id": "audit-<base36-timestamp>-<random-hex>",
    "timestamp": "ISO-8601",
    "domain": "planning|execution|delivery|registry|hygiene",
    "version": "string|null",
    "action": "string",
    "user": "email",
    "summary": "human-readable text",
    "details": { ... } // optional structured data
  }
  ```
- **API:** `GET /api/modules/releases/audit-log` (unified route in
  `server/index.js`) and `GET /api/modules/releases/planning/audit-log`
  (planning-specific duplicate). Both support `version`, `action`, `domain`,
  `limit`, `offset` query params.
- **Client views:**
  - `RecentActivity.vue` -- collapsible widget on Outcomes Dashboard, shows
    last 5 entries for the selected version, links to full audit log.
  - `AuditView.vue` -- full paginated audit log view (requires
    `release-manager` nav gate).
  - `useAuditLog.js` -- composable fetching from unified endpoint.
- **Current coverage:** Big Rock CRUD, reorder, import, release create/clone/delete,
  seed, registry CRUD, risk overrides, committed list changes, committed
  snapshots. Each `logAudit()` call includes `action`, `user`, `summary`, and
  optional `details`.

### 2.3 `release-manager` Role Usage Outside Planning/Health

The `release-manager` role gates routes in four areas beyond the dashboards in
scope:

| Area | Files | Routes |
|------|-------|--------|
| Release Registry | `server/registry.js` | CRUD, config, discover, version resolution |
| Feature Tracking | `server/execution/feature-tracking-routes.js` | (no `requireReleaseManager` found) |
| Hygiene | `server/hygiene/routes.js` | refresh, config get/save |
| Module Navigation | `module.json` | Manage, Audit nav items |

**Conclusion:** The `release-manager` role must remain registered because it
is used by the Registry, Hygiene, and nav gating systems. We will only remove
it from the planning routes and health routes.

---

## 3. Design

### 3.1 Server-Side Changes: Replace `requireReleaseManager` with `requireAuth`

For the planning and health routes in scope, replace `requireReleaseManager`
(or `requirePM`) middleware with `requireAuth`. This changes the authorization
from "must be admin or release-manager" to "must be authenticated."

The `requireScope('releases:write')` middleware remains in place on all write
endpoints, preserving API token scope enforcement.

**Routes affected (planning/routes.js):**

| Route | Method | Current Middleware | New Middleware |
|-------|--------|--------------------|---------------|
| `/releases/:version/refresh` | POST | `requireReleaseManager` | `requireAuth` |
| `/releases/:version/big-rocks/reorder` | PUT | `requireReleaseManager` | `requireAuth` |
| `/releases/:version/big-rocks/:name` | PUT | `requireReleaseManager` | `requireAuth` |
| `/releases/:version/big-rocks` | POST | `requireReleaseManager` | `requireAuth` |
| `/releases/:version/big-rocks/:name` | DELETE | `requireReleaseManager` | `requireAuth` |
| `/releases` | POST | `requireReleaseManager` | `requireAuth` |
| `/jira/validate-keys` | POST | `requireReleaseManager` | `requireAuth` |
| `/releases/:version/import/doc/preview` | POST | `requireReleaseManager` | `requireAuth` |
| `/releases/:version/import/doc` | POST | `requireReleaseManager` | `requireAuth` |

**Routes affected (planning/health/health-routes.js):**

The `requirePM` variable in `health-routes.js` is assigned from
`context.requirePM`, which is passed at `routes.js` line 236:

```js
requirePM: requireReleaseManager,
```

**Implementation approach:** Change the context pass-through in `routes.js`
line 236 from `requirePM: requireReleaseManager` to `requirePM: requireAuth`.
This is the smallest diff -- `health-routes.js` itself does not change, but
every use of `requirePM` in that file now resolves to `requireAuth`.

Do NOT rename the `requirePM` variable in `health-routes.js` -- that would
touch every route in the file for no behavioral benefit.

| Route | Method | Current Middleware | New Middleware |
|-------|--------|--------------------|---------------|
| `/releases/:version/health/override/:featureKey` | PUT | `requirePM` | `requireAuth` (via context) |
| `/releases/:version/health/override/:featureKey` | DELETE | `requirePM` | `requireAuth` (via context) |
| `/releases/:version/health/snapshot/:phase` | POST | `requirePM` | `requireAuth` (via context) |
| `/releases/:version/health/refresh` | POST | `requirePM` | `requireAuth` (via context) |
| `/releases/health-admin/jira-fields` | GET | `requirePM` | `requireAuth` (via context) |
| `/releases/health-admin/config` | PUT | `requirePM` | `requireAuth` (via context) |
| `/releases/health-admin/rice-test` | POST | `requirePM` | `requireAuth` (via context) |
| `/releases/health-admin/config` | GET | `requirePM` | `requireAuth` (via context) |
| `/releases/:version/health/milestones/debug` | GET | `requirePM` | `requireAuth` (via context) |

**Routes NOT affected (remain restricted):**

| Route | Method | Middleware | Reason |
|-------|--------|-----------|--------|
| `/config` | GET | `requireAdmin` | Platform configuration |
| `/admin/seed` | POST | `requireAdmin` | Admin data seeding |
| `/admin/seed/fixture` | GET | `requireAdmin` | Admin fixture access |
| `/releases/:version` | DELETE | `requireAdmin` | Destructive release deletion |
| All registry routes | Various | `requireReleaseManager` | Out of scope |
| All hygiene routes | Various | `requireReleaseManager` | Out of scope |

### 3.2 Server-Side Changes: Permissions Endpoint

Update the `/planning/permissions` endpoint to always return `{ canEdit: true }`
for authenticated users:

```js
// Before
router.get('/permissions', requireAuth, requireScope('releases:read'), function(req, res) {
  res.json({
    canEdit: !!req.isAdmin || !!req.isReleaseManager
  })
})

// After
router.get('/permissions', requireAuth, requireScope('releases:read'), function(req, res) {
  res.json({
    canEdit: true
  })
})
```

**Note:** After this change, the endpoint always returns the same value and
is functionally dead code. It is intentionally retained because:
(a) `DashboardView.vue` depends on it -- removing the round-trip would
require a client-side change to hardcode `canEdit: true`, which couples the
client to knowing the server's access policy; (b) the endpoint is the natural
place to re-introduce conditional logic if restrictions are ever restored
(rollback path); and (c) removing it would break API token consumers that
call `/planning/permissions` before issuing writes.

### 3.3 Client-Side Changes

**HealthDashboardView.vue** -- Replace the `isAdmin`-based `canEdit` with the
permissions endpoint approach (consistent with DashboardView):

```js
// Before
var canEdit = computed(function() {
  if (healthData.value && healthData.value.demoMode) return false
  return isAdmin.value
})

// After
var canEdit = computed(function() {
  if (healthData.value && healthData.value.demoMode) return false
  return true
})
```

Since the permissions endpoint now always returns `canEdit: true`, the Outcomes
Dashboard's existing logic (`!demoMode && permissions.canEdit`) will
automatically work. Only the Health Dashboard needs a code change because it
bypasses the permissions endpoint.

No changes needed in `BigRocksTable.vue`, `BigRockRow.vue`,
`FeatureHealthRow.vue`, `FeatureHealthTable.vue`, or `HealthSummaryCards.vue`
-- they either receive `canEdit` as a prop (and will automatically reflect the
new open permission) or do not use `canEdit` at all.

**`ReleaseSelector.vue` in HealthDashboardView:** The `ReleaseSelector`
component has a `canEdit` prop (default `false`) that controls the "New
Release" button visibility. The `HealthDashboardView` template currently does
NOT pass `:canEdit` to `ReleaseSelector`, so the button defaults to hidden.
**Fix (Phase 1):** Add `:canEdit="canEdit"` to the `<ReleaseSelector>` usage
in `HealthDashboardView.vue` so the "New Release" button appears for all
authenticated users, consistent with the Outcomes Dashboard behavior.

### 3.4 Audit Enhancement: Richer Change Details

The existing audit log already captures actions well. The gap is in the
`details` field -- some mutations log minimal or no detail about what
specifically changed. Enhance the following:

#### Big Rock Update (`update_rock`)
Add before/after diff for changed fields:

```js
logAudit(readFromStorage, writeToStorage, {
  version: version,
  action: 'update_rock',
  user: req.userEmail,
  summary: 'Updated Big Rock "' + name + '"',
  details: {
    rockName: name,
    changes: computeFieldDiff(existingRock, req.body)
  }
})
```

Where `computeFieldDiff(before, after)` returns an object like:
```json
{
  "name": { "from": "Old Name", "to": "New Name" },
  "jiraKeys": { "from": ["RHOAIENG-100"], "to": ["RHOAIENG-100", "RHOAIENG-200"] }
}
```

Only include fields that actually changed. Omit unchanged fields to keep
entries compact.

#### Big Rock Create (`create_rock`)
Add the full rock definition:

```js
details: {
  rockName: newName,
  definition: { name: req.body.name, pillar: req.body.pillar, jiraKeys: req.body.jiraKeys, ... }
}
```

#### Big Rock Delete (`delete_rock`)
Add the deleted rock's definition for recovery:

```js
details: {
  rockName: name,
  deletedDefinition: { name: found.name, pillar: found.pillar, jiraKeys: found.jiraKeys, ... }
}
```

#### Big Rock Reorder (`reorder_rocks`)
Add old and new ordering:

```js
details: {
  previousOrder: existingRocks.map(r => r.name),
  newOrder: order
}
```

#### Risk Override (`set_risk_override`)
Already well-detailed. No change needed.

#### Release Create/Clone
Already adequate. No change needed.

#### Doc Import (`import_doc`)
Add imported rock names and (for mode=replace) the deleted rocks for recovery:

```js
details: {
  docId: docId,
  mode: mode,
  importedRocks: result.bigRocks.map(r => r.name),
  // mode=replace only: capture rocks being wiped for audit recovery
  replacedRocks: mode === 'replace' ? existingRocks.map(r => ({
    name: r.name, pillar: r.pillar, jiraKeys: r.jiraKeys
  })) : undefined
}
```

#### Health Admin Config (`update_health_config`) -- NEW
The `PUT /releases/health-admin/config` handler currently has NO audit logging.
Since this endpoint controls global pipeline settings (`enableRice`,
`enableStratCreator`, `riceScoreField`), it must be audited. Add to
`health-routes.js`:

```js
logAudit(readFromStorage, writeToStorage, {
  version: null,
  action: 'update_health_config',
  user: req.auditActor || req.userEmail,
  summary: 'Updated health admin configuration',
  details: {
    riceScoreField: req.body.riceScoreField,
    enableRice: req.body.enableRice,
    enableStratCreator: req.body.enableStratCreator
  }
})
```

This is a Phase 1 task (not Phase 2) because it addresses a gap that becomes
more important when the role gate is removed.

### 3.5 Audit Enhancement: New `computeFieldDiff` Helper

Add a small utility function in `audit-log.js`:

```js
function computeFieldDiff(before, after) {
  if (!before || !after) return null
  var diff = {}
  // Iterate the union of both key sets to catch added AND deleted fields
  var allKeys = Object.keys(before)
  var afterKeys = Object.keys(after)
  for (var i = 0; i < afterKeys.length; i++) {
    if (allKeys.indexOf(afterKeys[i]) === -1) allKeys.push(afterKeys[i])
  }
  for (var j = 0; j < allKeys.length; j++) {
    var key = allKeys[j]
    var oldVal = before[key]
    var newVal = after[key]
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diff[key] = { from: oldVal, to: newVal }
    }
  }
  return Object.keys(diff).length > 0 ? diff : null
}
```

### 3.6 RecentActivity Enhancement

Update `RecentActivity.vue` to display richer details when available:

- Add new action meta entries for health-related actions (e.g.,
  `set_risk_override`, `remove_risk_override`, `committed_snapshot`).
- Show inline diff preview for `update_rock` entries (e.g., "Updated Big Rock
  'Serving' -- changed pillar, added 2 Jira keys").

This is a UI polish item that can be implemented after the core access changes
land.

---

## 4. Backward Compatibility

### 4.1 API Consumers

- The `/planning/permissions` endpoint will return `{ canEdit: true }` for all
  authenticated users. Any client polling this endpoint will see an expanded
  permission set. This is the intended behavior.
- **API token scope widening:** API tokens with `releases:write` scope
  previously required the token owner to also have the `release-manager`
  role for planning/health write endpoints. After this change, any valid
  token with `releases:write` gains write access to planning and health
  endpoints regardless of the token owner's roles. The `requireScope`
  middleware remains in place, so tokens without `releases:write` are still
  rejected. This is the intended behavior -- the scope gate is the correct
  access boundary for API tokens, not the role gate.
- The role `release-manager` continues to exist and function for Registry,
  Hygiene, and nav gating. No role store migration needed.

### 4.2 Existing Audit Data

- The audit log format is additive-only. Existing entries are untouched. New
  entries will have richer `details` fields.
- No schema version bump needed -- `details` is already a nullable free-form
  object.

### 4.3 Demo Mode

- Demo mode blocks all non-GET requests via middleware, so open editing has no
  effect in demo mode. The `canEdit` flag is already gated by `!demoMode` on
  both dashboards.

### 4.3.1 Refresh Rate Limiting

Without the role gate, any authenticated user can trigger refresh endpoints
(`POST /releases/:version/refresh` and `POST /releases/:version/health/refresh`).
The existing 2-concurrent-refresh cap (`MAX_CONCURRENT_REFRESHES = 2`) prevents
parallel overload but does not prevent rapid sequential triggering.

**Known limitation:** A user could rapidly trigger sequential refreshes for
different versions, each completing and allowing the next. In practice this is
low risk because: (a) refreshes are relatively slow (Jira API calls), so the
concurrency cap throttles throughput effectively, (b) the CronJob already
triggers refreshes every 15 minutes for all configured releases, and (c)
refresh is idempotent -- repeated calls produce the same result.

**Future consideration:** If abuse is observed, add per-user rate limiting
(e.g., 1 refresh per version per 60 seconds) as a follow-up. This is NOT
required for the initial rollout.

### 4.4 Impersonation

**Previous claim corrected:** The original draft stated that
`blockDuringImpersonation` was already applied to releases write routes. This
was false -- `blockDuringImpersonation` is only used on `dev-server.js` admin
routes (backup/restore, tokens, allowlist, roles). No releases module route
uses it.

**Risk:** Without mitigation, an admin impersonating a user could make
destructive edits (delete Big Rocks, create releases, set risk overrides) and
the audit log would record `req.userEmail` (the impersonated user's email),
not the admin's -- undermining the audit trail that compensates for removing
the role gate.

**Mitigation (two-part, added to Phase 1):**

1. **Add `blockDuringImpersonation` to destructive write routes.** The
   following routes will gain the `blockDuringImpersonation` middleware:
   - `DELETE /releases/:version/big-rocks/:name`
   - `POST /releases/:version/import/doc` (mode=replace is destructive)
   - `POST /releases` (creates release identity)
   - `DELETE /releases/:version/health/override/:featureKey`
   - `POST /releases/:version/health/snapshot/:phase`

2. **Switch all `logAudit()` calls to use `req.auditActor` instead of
   `req.userEmail`.** The auth middleware already sets `req.auditActor` to
   `"target@email (impersonated by admin@email)"` during impersonation and
   to the real user email otherwise. This ensures every audit entry records
   the true actor chain, even for non-blocked write routes (updates, reorder,
   refresh, etc.).

   Affected files:
   - `modules/releases/server/planning/routes.js` -- all `logAudit()` calls
     (currently 8 call sites using `user: req.userEmail`)
   - `modules/releases/server/planning/health/health-routes.js` -- all
     `logAudit()` calls (currently 5 call sites using
     `user: req.userEmail || 'unknown'` or `user: user`)

---

## 5. Files Modified

| File | Change | Phase |
|------|--------|-------|
| `modules/releases/server/planning/routes.js` | Replace `requireReleaseManager` with `requireAuth` on 9 endpoints; update permissions endpoint; add `blockDuringImpersonation` on destructive routes; switch `logAudit()` calls to use `req.auditActor` | 1 |
| `modules/releases/server/planning/routes.js` | Change context pass-through at line 236 from `requirePM: requireReleaseManager` to `requirePM: requireAuth` | 1 |
| `modules/releases/server/planning/health/health-routes.js` | No middleware changes needed (context swap handles it); add `blockDuringImpersonation` on destructive routes; switch `logAudit()` calls to use `req.auditActor`; add audit logging to `PUT /health-admin/config` | 1 |
| `modules/releases/client/plan/views/HealthDashboardView.vue` | Remove `isAdmin`-based `canEdit`, use unconditional `true`; add `:canEdit="canEdit"` prop to `<ReleaseSelector>` | 1 |
| `modules/releases/module.json` | Remove `requireRole: "release-manager"` from Audit nav item | 1 |
| `modules/releases/server/planning/audit-log.js` | Add `computeFieldDiff()` helper (iterates union of key sets) | 2 |
| `modules/releases/server/planning/routes.js` | Enhance `logAudit()` calls with richer `details` (update, create, delete, reorder, import with replacedRocks) | 2 |
| `modules/releases/client/plan/components/RecentActivity.vue` | Add action meta for health actions; optional inline diff preview | 3 |
| `modules/releases/client/plan/views/DashboardView.vue` | No changes needed (already uses permissions endpoint) | -- |
| `modules/releases/client/plan/components/BigRocksTable.vue` | No changes needed (receives canEdit as prop) | -- |
| `modules/releases/client/plan/components/BigRockRow.vue` | No changes needed | -- |
| `modules/releases/client/plan/components/FeatureHealthRow.vue` | No changes needed | -- |
| `modules/releases/client/plan/components/FeatureHealthTable.vue` | No changes needed | -- |
| `modules/releases/client/plan/components/ReleaseSelector.vue` | No changes needed (receives canEdit as prop) | -- |
| `modules/releases/client/plan/components/HealthSummaryCards.vue` | No changes needed (does not use canEdit) | -- |

### Files NOT modified (intentionally)

| File | Reason |
|------|--------|
| `modules/releases/server/registry.js` | Registry routes stay restricted to `release-manager` |
| `modules/releases/server/hygiene/routes.js` | Hygiene routes stay restricted to `release-manager` |
| `modules/releases/server/index.js` | Role registration stays; `requireReleaseManager` still used by registry/hygiene |
| `shared/server/auth.js` | No changes to middleware infrastructure (already exports `blockDuringImpersonation`) |
| `shared/server/role-registry.js` | No changes to role registry |

---

## 6. Testing

### 6.1 Unit Tests

**Existing tests to update:**

- `modules/releases/__tests__/server/planning/routes.test.js`:
  - **Line 487-491:** The `GET /permissions` test asserts `canEdit` is `false`
    for regular users. Update to expect `canEdit: true`.
  - **Line 190:** The auth guards test uses a spy assertion on the middleware
    function reference (`router.post` called with `expect.any(Function)`).
    This verifies middleware registration, not 403 behavior. After the
    change, the middleware argument changes from `requireReleaseManager` to
    `requireAuth` -- update the test description accordingly (it currently
    says "uses requireReleaseManager on POST...").
  - **Lines 475-484:** The `canEdit: true` assertions for admin and
    release-manager remain valid (still true).
- `modules/releases/__tests__/server/planning/health-routes.test.js` -- If
  this file exists, update any assertions that expect 403 for non-PM users
  on health write endpoints. These should now expect 200/201.
- `modules/releases/__tests__/server/rbac.test.js` -- This file tests
  `release-manager` role registration, assignment, and the `requireRole`
  middleware generically. It does NOT have planning/health endpoint-specific
  assertions. **No changes needed** -- the `release-manager` role continues
  to exist and function for registry/hygiene.

**New tests:**

- `audit-log.test.js`: Add test for `computeFieldDiff()` -- empty diffs, field
  additions, field removals (iterates union of key sets), nested object changes.
- `routes.test.js`: Add test verifying an authenticated non-admin,
  non-release-manager user can successfully create/update/delete big rocks
  (200/201 responses, not 403).
- `health-routes.test.js`: Add test verifying an authenticated user can set
  risk overrides and create snapshots without any role.
- `health-routes.test.js` or `routes.test.js`: Add test verifying
  `blockDuringImpersonation` rejects writes during impersonation on
  destructive routes.

### 6.2 Integration Tests

The existing integration test at `tests/integration/releases.spec.js` runs in
demo mode, where all writes are blocked (403). The access control change does
not affect demo mode behavior, so existing integration tests should pass
without modification.

### 6.3 Manual Verification

1. Start dev server without `release-manager` role assigned to test user.
2. Navigate to Outcomes Dashboard -- verify Add Big Rock button appears.
3. Create, edit, and delete a Big Rock -- verify operations succeed.
4. Navigate to Health Dashboard -- verify RICE config gear appears.
5. Verify "New Release" button appears on Health Dashboard's ReleaseSelector.
6. Set and remove a risk override.
7. Create a committed snapshot.
8. Verify Audit nav item is visible in sidebar without `release-manager` role.
9. Check Recent Activity -- verify entries show detailed change information.
10. Check full Audit Log -- verify enhanced details in entry JSON.
11. **Impersonation test (admin only):** Impersonate a user, attempt to delete
    a Big Rock -- verify 403 "not allowed while impersonating." Attempt a
    non-destructive edit (update Big Rock) -- verify it succeeds and audit log
    shows `"user@email (impersonated by admin@email)"` in the user field.
12. Toggle health admin config (RICE, stratCreator) -- verify audit log entry
    is created with `update_health_config` action.

---

## 7. Deployment

### 7.1 Rollout Safety

- **No migration needed.** The change is purely a middleware swap
  (`requireReleaseManager` -> `requireAuth`) and a permissions endpoint update.
- **No data format changes.** Audit log entries are additive.
- **Backward-compatible API.** Clients receiving `canEdit: true` will enable
  edit UI -- the same behavior they get today when the user has the right role.
- **Feature flag option (if desired):** The permissions endpoint could be made
  conditional on a config flag (e.g., `openEditing` in `healthConfig`), but
  given the user's clear intent to remove restrictions entirely, a flag adds
  complexity without benefit.

### 7.2 Rollback

If issues are discovered after deployment:

1. Revert the middleware changes (restore `requireReleaseManager` / `requirePM`
   on the affected routes, including the context pass-through at routes.js
   line 236).
2. Revert the permissions endpoint to return
   `{ canEdit: req.isAdmin || req.isReleaseManager }`.
3. Revert `HealthDashboardView.vue` `canEdit` to `isAdmin.value`; remove
   `:canEdit` prop from `<ReleaseSelector>`.
4. Restore `requireRole: "release-manager"` on the Audit nav item in
   `module.json`.
5. The `blockDuringImpersonation` middleware, `req.auditActor` usage, and
   health-admin config audit logging are safety improvements that should NOT
   be reverted -- they are correct regardless of the access model.
6. The audit log enhancements (Phase 2) are purely additive and need not be
   reverted.

---

## 8. Phased Implementation

### Phase 1: Open Access + Impersonation Safety (Estimated: 2-3 hours)

Remove edit restrictions from both dashboards. Add impersonation guards and
audit correctness.

**Tasks:**
1. In `planning/routes.js`: Replace `requireReleaseManager` with `requireAuth`
   on the 9 planning write routes.
2. In `planning/routes.js`: Update the `/permissions` endpoint to return
   `{ canEdit: true }`.
3. In `planning/routes.js` line 236: Change `requirePM: requireReleaseManager`
   to `requirePM: requireAuth` (this propagates to all health routes via
   context).
4. In `HealthDashboardView.vue`: Change `canEdit` to not depend on `isAdmin`,
   just gate on `!demoMode`.
5. In `HealthDashboardView.vue`: Add `:canEdit="canEdit"` prop to the
   `<ReleaseSelector>` component so the "New Release" button appears.
6. In `module.json`: Remove `requireRole: "release-manager"` from the Audit
   nav item (keep it on Manage).
7. **Impersonation guards:** Add `blockDuringImpersonation` middleware to
   destructive write routes in both `planning/routes.js` and
   `health-routes.js` (DELETE big-rocks, import/doc, POST /releases,
   DELETE override, POST snapshot). Import `blockDuringImpersonation` from
   `shared/server/auth.js`.
8. **Audit actor fix:** In both `planning/routes.js` and `health-routes.js`,
   change all `logAudit()` calls to use `user: req.auditActor || req.userEmail`
   instead of `user: req.userEmail`. This ensures impersonation sessions
   record the full actor chain.
9. **Health config audit:** Add `logAudit()` call to the `PUT /health-admin/config`
   handler in `health-routes.js` (currently has no audit logging).
10. Update existing unit tests for the 403 -> 200 behavior change (see
    Section 6.1 for specific test locations).
11. Add test for `blockDuringImpersonation` on destructive routes.
12. Run `npm test` and `npm run lint` to verify.

### Phase 2: Audit Enhancement (Estimated: 1-2 hours)

Add richer change details to audit log entries.

**Tasks:**
1. Add `computeFieldDiff()` to `audit-log.js`.
2. In `planning/routes.js` Big Rock update handler: capture existing rock
   before mutation, compute diff, include in audit details.
3. In `planning/routes.js` Big Rock create handler: include full definition
   in audit details.
4. In `planning/routes.js` Big Rock delete handler: include deleted definition
   in audit details.
5. In `planning/routes.js` reorder handler: include previous and new order
   in audit details.
6. In `planning/routes.js` import handler: include imported rock names and
   (for mode=replace) the replaced rocks in audit details.
7. Add unit tests for `computeFieldDiff()`.
8. Run `npm test` and `npm run lint`.

### Phase 3: RecentActivity Polish (Estimated: 30 min, optional)

Improve the RecentActivity widget to surface health-related actions and richer
inline summaries.

**Tasks:**
1. Add action meta entries for `set_risk_override`, `remove_risk_override`,
   `committed_snapshot`, `committed_list_change` to `RecentActivity.vue`.
2. Optionally show inline diff summary for `update_rock` entries with
   `details.changes`.

---

## 9. Open Questions

1. ~~**Audit Log view navigation gate:**~~ **RESOLVED** -- moved to Phase 1.
   The Audit nav item in `module.json` will have `requireRole` removed so all
   users can view the audit trail (the accountability mechanism for open editing).

2. **Health admin config (RICE, stratCreator):** These are currently gated by
   `requirePM`. Opening them means any authenticated user can toggle RICE
   scoring or stratCreator checks. Is this acceptable? **Current decision:**
   Yes, per user's request to remove all restrictions. If needed later, these
   specific admin-config routes could be re-restricted without affecting the
   broader editing openness. Audit logging is now added to this endpoint
   (Phase 1, task 9) to track changes.

3. **Per-user refresh rate limiting:** Without the role gate, any user can
   trigger refresh endpoints. The existing 2-concurrent-refresh cap provides
   basic protection. Per-user rate limiting (e.g., 1 refresh per version per
   60 seconds) is deferred unless abuse is observed. See Section 4.3.1.

---

## 10. Review Response Log

This section documents the review findings received and how each was addressed.
Review conducted 2026-06-09.

### Critical Findings

| # | Finding | Resolution |
|---|---------|------------|
| 1 | **Impersonation audit gap** -- `blockDuringImpersonation` is not used on any releases module route; audit log records impersonated user's email, not admin's | **Plan updated.** (a) Added `blockDuringImpersonation` to destructive write routes (Phase 1, task 7). (b) Switched all `logAudit()` calls to `req.auditActor` (Phase 1, task 8). See Section 4.4. |
| 2 | **Health routes middleware swap is ambiguous** -- unclear whether to change `health-routes.js` or the context pass-through in `routes.js` | **Plan updated.** Explicitly specifies changing `routes.js` line 236 (`requirePM: requireReleaseManager` to `requirePM: requireAuth`). No changes to `health-routes.js` middleware references. See Section 3.1. |

### Major Findings

| # | Finding | Resolution |
|---|---------|------------|
| 3 | **`health-admin/config PUT` has no audit logging** | **Plan updated.** Added audit logging as Phase 1, task 9. See Section 3.4 "Health Admin Config" subsection. |
| 4 | **`POST /releases` contradicts plan's scoping** -- plan says registry stays restricted but planning routes also create releases | **Plan updated.** Added explicit note in Section 1 "What stays restricted" clarifying that `POST /releases` in planning/routes.js is intentionally opened (self-service release creation) while registry.js structural operations remain restricted. |
| 5 | **Doc import `mode=replace` is destructive** -- wipes all Big Rocks | **Plan updated.** (a) `blockDuringImpersonation` added to this route. (b) Audit entry enhanced with `replacedRocks` field capturing deleted rocks for recovery. (c) Noted that `backupConfig()` is already called before replace-mode imports. See Sections 1 and 3.4. |
| 6 | **`computeFieldDiff` misses deleted fields** -- only iterates `Object.keys(after)` | **Plan updated.** Fixed implementation to iterate the union of both key sets (`before` + `after`). See Section 3.5. |
| 7 | **Refresh endpoint rate concerns** | **Plan updated.** Documented as known limitation with mitigation rationale (idempotent, concurrency cap, CronJob already triggers). Per-user rate limiting noted as future consideration. See Section 4.3.1. |
| 8 | **Test references are inaccurate** -- `rbac.test.js` has no planning assertions; real test locations differ | **Plan updated.** Section 6.1 now references specific line numbers in `routes.test.js` (lines 190, 475-491) and correctly notes `rbac.test.js` needs no changes. |

### Minor Findings

| # | Finding | Resolution |
|---|---------|------------|
| 9 | **Permissions endpoint becomes dead code** | **Plan updated.** Added rationale for retaining the endpoint (client dependency, rollback path, API consumer compatibility). See Section 3.2 note. |
| 10 | **`HealthDashboardView` doesn't pass `canEdit` to child components** | **Plan updated.** Added Phase 1, task 5 to pass `:canEdit="canEdit"` to `<ReleaseSelector>`. `HealthSummaryCards` confirmed to not have a `canEdit` prop, so no change needed there. See Section 3.3. |
| 11 | **Audit nav item should be opened** | **Plan updated.** Moved from "Open Questions" to Phase 1, task 6. `module.json` added to Files Modified table. See Section 1 "What stays restricted". |
| 12 | **API token scope widening** | **Plan updated.** Explicitly documented in Section 4.1 with rationale that scope gate is the correct access boundary for API tokens. |
