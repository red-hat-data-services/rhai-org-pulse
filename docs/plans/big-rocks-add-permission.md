# Big Rocks Access Control: Granular Permissions with Planning Manager Role

**Status:** Final Draft
**Author:** Architect Agent
**Date:** 2026-06-15
**Module:** releases (planning sub-module)

---

## 1. Problem Statement

The Outcomes Dashboard (Big Rocks) currently uses a single `canEdit` flag that
grants all-or-nothing access to every write operation: add, delete, reorder, and
edit fields. Following the recent decision to open editing to all authenticated
users (outcomes-dashboard-access.md), the `canEdit` flag is hardcoded to `true`
for everyone.

This is too permissive for structural operations. Adding a new Big Rock,
deleting one, or reordering the priority list are high-impact actions that change
the shape of the planning data. Editing fields on an existing rock (name,
pillar, outcomes, notes, owners, etc.) is low-impact collaborative work.

**Goal:** Split the single `canEdit` flag into granular permissions so that:

- **Any authenticated user** can edit all fields on existing Big Rocks.
- **Only users with the `planning-manager` role (or admins)** can add, delete,
  or reorder Big Rocks.

This requires renaming the existing `release-manager` role to `planning-manager`
to better reflect its purpose, and updating all references throughout the
codebase.

---

## 2. Requirements Summary

| Requirement | Detail |
|---|---|
| Role rename | `release-manager` -> `planning-manager` across registration, middleware, auth flags, frontend checks, tests, docs |
| Granular permissions | Replace single `canEdit` with `canEdit`, `canAdd`, `canDelete`, `canReorder` |
| Edit scope | All fields on existing Big Rocks editable by any authenticated user (no field-level restrictions) |
| Privileged actions | Add, delete, reorder gated to `planning-manager` role + admins |
| Server enforcement | API returns 403 on POST (create), DELETE, and PUT (reorder) for non-privileged users |
| Frontend enforcement | Hide/disable "Add Big Rock" button, delete buttons, and drag handles for non-privileged users |
| Backward compatibility | Existing `release-manager` assignments in `roles.json` migrated to `planning-manager` on startup |
| Settings UI | Role appears as "Planning Manager" in the Users tab (automatic via role registry) |
| Doc import gating | `replace` mode on `POST /import/doc` restricted to `planning-manager` (structural operation) |

---

## 3. Current Architecture

### 3.1 Role Registration

In `modules/releases/server/index.js` (line 132):

```javascript
context.registerRole('release-manager', {
  label: 'Release Manager',
  description: 'Manage release planning, execution, and delivery'
});
```

This produces `requireReleaseManager = requireRole('release-manager')` (line 116),
which is passed to sub-routers: registry, planning, execution (feature-tracking),
hygiene.

### 3.2 Auth Middleware Flags

In `shared/server/auth.js` (lines 109, 143):

```javascript
req.isReleaseManager = req.userRoles.includes('release-manager');
```

Set during both normal auth and impersonation flows.

### 3.3 Permissions Endpoint

In `modules/releases/server/planning/routes.js` (lines 575-579):

```javascript
router.get('/permissions', requireAuth, requireScope('releases:read'), function(req, res) {
  res.json({
    canEdit: true
  })
})
```

Hardcoded -- no role logic.

### 3.4 Frontend Flow

1. `useReleasePlanning()` composable fetches `/api/modules/releases/planning/permissions`
2. `DashboardView.vue` computes `canEdit = !demoMode && permissions.canEdit`
3. `BigRocksTable.vue` receives `canEdit` prop, which controls:
   - "Add Big Rock" button (line 176)
   - Drag handles and reorder hint (lines 135, 193)
   - Edit/delete action buttons column (lines 203, 227-248)
   - `draggable="true"` attribute on `<tr>` elements (line 209)
   - Entire editable vs read-only table body toggle (lines 206 vs 261)

### 3.5 Write Endpoints (No Role Check)

All currently use `requireAuth` + `requireScope('releases:write')` but no role
check:

| Endpoint | Line | Purpose |
|---|---|---|
| `PUT /releases/:version/big-rocks/reorder` | 635 | Reorder |
| `PUT /releases/:version/big-rocks/:name` | 685 | Update existing |
| `POST /releases/:version/big-rocks` | 761 | Create new |
| `DELETE /releases/:version/big-rocks/:name` | 838 | Delete |
| `POST /releases/:version/import/doc` | 1120 | Doc import (replace mode wipes all rocks) |

### 3.6 Full Inventory of `release-manager` References

**Server-side (runtime):**

| File | Usage |
|---|---|
| `modules/releases/server/index.js:116` | `requireReleaseManager = requireRole('release-manager')` |
| `modules/releases/server/index.js:132` | `context.registerRole('release-manager', ...)` |
| `modules/releases/server/planning/routes.js:59,68-69,73` | PM user auto-migration to `release-manager` |
| `modules/releases/server/registry.js:305,344,372,445,499,566,600,633,698` | All registry routes use `requireReleaseManager` |
| `modules/releases/server/hygiene/routes.js:125,334,464,505,530` | Hygiene config/refresh routes use `requireReleaseManager` |
| `modules/releases/module.json:11` | `"requireRole": "release-manager"` on Manage nav item |
| `shared/server/auth.js:109,143` | Sets `req.isReleaseManager` flag |
| `shared/server/role-registry.js:13` | JSDoc example uses `'release-manager'` |

**Client-side:**

| File | Usage |
|---|---|
| `modules/releases/client/views/RegistryView.vue:6,575` | Access check + error message |
| `modules/releases/client/execute/views/HygieneView.vue:201,206,231,493` | `isReleaseManager` ref + prop |
| `modules/releases/client/execute/components/hygiene/HygieneWelcomeModal.vue:11,127,175` | `isReleaseManager` prop + template uses |
| `src/components/UserManagement.vue:213` | Badge color for `release-manager` |

**Tests:**

| File | Usage |
|---|---|
| `modules/releases/__tests__/server/rbac.test.js` | 19+ references -- role registration, assignment, revocation, middleware tests |
| `modules/releases/__tests__/server/planning/routes.test.js:610,622,635` | Open access tests reference "non-release-manager" |
| `modules/releases/__tests__/server/planning/health-routes.test.js:912,925` | Health route access tests |
| `modules/releases/__tests__/server/planning/invalidate-cache.test.js:131,273` | `requireReleaseManager` mock references in context setup |
| `tests/integration/tv-fv-delta.spec.js:123,128` | Nav item `requireRole` assertions (see note in Section 4.7) |
| `shared/server/__tests__/module-context.test.js:100-101` | Module context role registration test |

**Documentation:**

| File | Usage |
|---|---|
| `docs/DATA-FORMATS.md:1300` | Example in byRole statistics |
| `docs/MODULES.md:83,216` | Role documentation examples |
| `docs/plans/outcomes-dashboard-access.md` | 21+ references throughout plan |

---

## 4. Architectural Approach

### 4.1 Role Rename: `release-manager` -> `planning-manager`

The `release-manager` role was originally conceived to gate the release registry
and planning workflows. Renaming to `planning-manager` better reflects its
actual purpose -- controlling who can make structural changes to planning data
(Big Rocks, registry entries, hygiene config). The role continues to gate the
same set of privileged operations; only the identifier changes.

**Registration (new):**

```javascript
context.registerRole('planning-manager', {
  label: 'Planning Manager',
  description: 'Manage release planning, registry, and delivery configuration'
});
```

**Auth flag (new):**

```javascript
req.isPlanningManager = req.userRoles.includes('planning-manager');
```

### 4.2 Startup Migration: `release-manager` -> `planning-manager`

On module startup, before any routes are registered, scan `roles.json` for users
with the `release-manager` role and migrate them to `planning-manager`. This is
a one-time migration that runs idempotently -- if no `release-manager`
assignments exist, it is a no-op.

**Important:** The migration must NOT use `roleStore.revokeRole()` /
`roleStore.assignRole()` because those methods validate against the role
registry. Since `release-manager` is no longer registered (only
`planning-manager` is), calling `revokeRole(email, 'release-manager')` would
throw `Invalid role: "release-manager"`. Instead, manipulate the raw
`roles.json` data directly via `readFromStorage` / `writeToStorage`, following
the same pattern as the existing `migrateEmailDomains()` in `role-store.js`.

```javascript
// In modules/releases/server/index.js, after role registration
const rolesData = storage.readFromStorage('roles.json');
if (rolesData && rolesData.assignments) {
  let migrated = 0;
  for (const [email, entry] of Object.entries(rolesData.assignments)) {
    if (entry.roles && entry.roles.includes('release-manager')) {
      migrated++;
    }
  }
  if (migrated > 0) {
    // Backup before overwriting, following migrateEmailDomains() pattern
    const backupKey = `roles-backup-premigration.json`;
    storage.writeToStorage(backupKey, JSON.parse(JSON.stringify(rolesData)));
    console.log(`[releases] Backup saved to ${backupKey}`);

    for (const [email, entry] of Object.entries(rolesData.assignments)) {
      if (entry.roles && entry.roles.includes('release-manager')) {
        entry.roles = entry.roles.filter(r => r !== 'release-manager');
        if (!entry.roles.includes('planning-manager')) {
          entry.roles.push('planning-manager');
        }
      }
    }
    storage.writeToStorage('roles.json', rolesData);
    console.log(`[releases] Migrated ${migrated} user(s) from release-manager to planning-manager`);
  }
}
```

This approach:
- **Creates a backup (`roles-backup-premigration.json`) before overwriting**,
  following the same pattern as `migrateEmailDomains()` in `role-store.js`
  (line 219). This mitigates data loss from a concurrent write or unexpected
  failure during migration.
- Reads the raw JSON, iterates assignments, replaces `'release-manager'` with
  `'planning-manager'` in each user's roles array, writes back.
- Avoids any role registry validation -- operates on raw data only.
- Is idempotent -- if no `release-manager` entries exist, the write is skipped.
  On subsequent restarts, the backup write is also skipped (no-op).
- Handles the edge case where a user already has both roles (just removes
  `release-manager`, avoids duplicating `planning-manager`).
- Does not create audit log entries for the migration (consistent with
  `migrateEmailDomains()` which also operates below the audit layer).

The existing PM user auto-migration (lines 58-82 in planning/routes.js) also
needs updating to assign `planning-manager` instead of `release-manager`.

### 4.3 Granular Permissions Endpoint

The `/permissions` endpoint will return four flags instead of one:

```javascript
router.get('/permissions', requireAuth, requireScope('releases:read'), function(req, res) {
  const isPlanningManager = req.isAdmin || req.isPlanningManager;
  res.json({
    canEdit: true,              // All authenticated users can edit existing rocks
    canAdd: isPlanningManager,  // Only planning-managers can add
    canDelete: isPlanningManager, // Only planning-managers can delete
    canReorder: isPlanningManager // Only planning-managers can reorder
  })
})
```

### 4.4 Server-Side Enforcement

Add `requirePlanningManager` middleware to the privileged endpoints. The edit
(PUT) endpoint remains open to all authenticated users. The doc import endpoint
gets conditional gating for `replace` mode (see Section 4.6).

| Endpoint | Current Middleware | New Middleware |
|---|---|---|
| `POST /:version/big-rocks` | `requireAuth, requireScope` | `requireAuth, requirePlanningManager, requireScope` |
| `DELETE /:version/big-rocks/:name` | `requireAuth, blockDuringImpersonation, requireScope` | `requireAuth, requirePlanningManager, blockDuringImpersonation, requireScope` |
| `PUT /:version/big-rocks/reorder` | `requireAuth, requireScope` | `requireAuth, requirePlanningManager, requireScope` |
| `PUT /:version/big-rocks/:name` | `requireAuth, requireScope` | No change (stays open) |
| `POST /:version/import/doc` | `requireAuth, blockDuringImpersonation, requireScope` | See Section 4.6 |

Note: `requirePlanningManager` already handles admin bypass internally
(admins always pass role checks), so no additional admin logic is needed.

**How `requirePlanningManager` reaches planning routes:** Currently
`planning/routes.js` (line 51) destructures `{ storage, requireAuth,
requireAdmin, requireScope }` from its context object. It receives
`requireReleaseManager` in its context (passed at `index.js` line 163) but does
not destructure or use it. To add role enforcement to planning routes:

1. In `modules/releases/server/index.js`, rename `requireReleaseManager` to
   `requirePlanningManager` in the planning sub-router context object (line 163):
   ```javascript
   registerPlanningRoutes(planningRouter, {
     storage,
     requireAuth,
     requireAdmin,
     requirePlanningManager,  // <-- renamed from requireReleaseManager
     requireScope,
     roleStore,
     // ...rest
   });
   ```

2. In `modules/releases/server/planning/routes.js`, update the destructuring
   (line 51) to include it:
   ```javascript
   const { storage, requireAuth, requireAdmin, requirePlanningManager, requireScope } = context
   ```

This middleware is then used directly in route definitions (e.g.,
`router.post('/releases/:version/big-rocks', requireAuth, requirePlanningManager, requireScope('releases:write'), ...)`).

### 4.5 Frontend Changes

#### 4.5.1 Composable (`useReleasePlanning.js`)

The `loadPermissions()` function already fetches and stores the permissions
response verbatim. No changes needed here -- the composable will automatically
expose the new granular flags through the existing `permissions` ref.

Update the fallback default to include all four flags:

```javascript
permissions.value = { canEdit: false, canAdd: false, canDelete: false, canReorder: false }
```

#### 4.5.2 DashboardView.vue

Replace the single `canEdit` computed with granular computeds:

```javascript
const canEdit = computed(() => !demoMode.value && permissions.value?.canEdit)
const canAdd = computed(() => !demoMode.value && permissions.value?.canAdd)
const canDelete = computed(() => !demoMode.value && permissions.value?.canDelete)
const canReorder = computed(() => !demoMode.value && permissions.value?.canReorder)
```

Pass granular props to `BigRocksTable`:

```html
<BigRocksTable
  :canEdit="canEdit"
  :canAdd="canAdd"
  :canDelete="canDelete"
  :canReorder="canReorder"
  ...
/>
```

The "New Release" and "Load Fixture Data" buttons (lines 448, 455) should remain
gated on `canEdit` since they are about editing the release configuration, which
remains open to all.

**ReleaseSelector:** The `ReleaseSelector` component is unaffected by this
change. It receives `canEdit` from `DashboardView` (line 320), which stays
`true` for all authenticated users. No changes needed.

#### 4.5.3 BigRocksTable.vue

Add new props:

```javascript
const props = defineProps({
  bigRocks: { type: Array, default: () => [] },
  canEdit: { type: Boolean, default: false },
  canAdd: { type: Boolean, default: false },
  canDelete: { type: Boolean, default: false },
  canReorder: { type: Boolean, default: false },
  // ... existing props
})
```

Split the template logic:

| UI Element | Current Gate | New Gate |
|---|---|---|
| "Add Big Rock" button | `canEdit` | `canAdd` |
| "Drag to reorder" hint | `canEdit` | `canReorder` |
| Drag handle column header | `canEdit` | `canReorder` |
| Drag handles on rows | `canEdit` | `canReorder` |
| `draggable` attribute on `<tr>` | `canEdit` (implicit in tbody) | `:draggable="canReorder"` (see below) |
| Edit button (pencil icon) | `canEdit` (in edit tbody) | `canEdit` |
| Delete button (trash icon) | `canEdit` (in edit tbody) | `canDelete` |
| Actions column header | `canEdit` | `canEdit \|\| canDelete` |
| Editable tbody vs read-only tbody | `canEdit` | `canEdit` (keeps inline edit active) |

**`draggable` attribute must be conditional:** Hiding the drag handle column is
not sufficient -- the `draggable="true"` attribute on `<tr>` elements (line 209)
must also be conditionalized on `canReorder`. Otherwise, users can still
initiate HTML5 drag events by clicking anywhere on the row. Change from
`draggable="true"` to `:draggable="canReorder"`. When `canReorder` is false,
this renders `draggable="false"`, which suppresses native drag behavior.

**Key design decision:** The template currently uses two mutually exclusive
`<tbody>` blocks -- one for edit mode (with drag handles and action buttons)
and one for read-only mode (no actions). With granular permissions, we need to
keep the editable tbody active for any user who `canEdit`, but conditionally
show/hide the drag handles, delete buttons, and add button based on the
granular flags. The edit button (pencil) stays visible when `canEdit` is true.

The refactored template will use a single tbody when `canEdit` is true, with
conditional rendering within rows:

- Drag handle cell: `v-if="canReorder"`
- Delete button: `v-if="canDelete"`
- Edit button: always shown (when `canEdit`)
- Actions column header: `v-if="canEdit || canDelete"` (show if either action
  exists -- the column contains both edit and delete buttons)

**Dynamic colspan for `BigRockExpandedRow`:** The editable tbody currently
passes `colspan="hasHealth ? 11 : 8"` (includes drag handle + actions columns).
The read-only tbody passes `colspan="hasHealth ? 9 : 6"` (omits those columns).
When merging to a single tbody with conditional columns, the colspan for
`BigRockExpandedRow` becomes dynamic based on which permission columns are
visible:

```javascript
const expandedColspan = computed(() => {
  let base = hasHealth.value ? 9 : 6   // base columns (no drag, no actions)
  if (props.canReorder) base++          // drag handle column
  if (props.canEdit || props.canDelete) base++  // actions column
  return base
})
```

This computed is used in the template: `:colspan="expandedColspan"`. The same
logic applies to the skeleton loading row colspan and the empty-state colspan
(see below).

**Skeleton loading and empty state must be migrated into the merged tbody.**
Currently the editable tbody (line 206) has NO skeleton loading rows and NO
empty state -- it jumps straight into the `v-for` over `localRocks`. The
read-only tbody (line 261) HAS both: skeleton loading rows (lines 263-275) and
a "No Big Rocks configured" empty state (lines 304-307). Since `canEdit` is now
`true` for all authenticated users, the editable tbody will always render -- but
without skeleton loading or empty state handling, the table shows nothing during
loading and nothing when empty.

When merging to a single tbody, migrate both from the read-only tbody:

1. **Skeleton loading rows** (currently lines 263-275): Add a
   `<template v-if="loading">` block at the top of the merged tbody, before the
   data rows `v-for`. Use `:colspan="expandedColspan"` instead of the hardcoded
   `hasHealth ? 9 : 6` so the skeleton rows span the correct number of columns
   (which now varies based on `canReorder` and `canEdit || canDelete`).

2. **Empty state** (currently lines 304-307): Add a `<tr v-else>` after the
   data rows `<template v-else-if="...">` block. Use
   `:colspan="expandedColspan"` for the same reason. The "No Big Rocks
   configured." text and styling are preserved as-is.

3. **Data rows**: The existing `v-for` over `localRocks` becomes
   `<template v-else-if="localRocks && localRocks.length > 0">` to fit the
   `v-if` / `v-else-if` / `v-else` chain.

The resulting merged tbody structure:

```html
<tbody>
  <!-- Skeleton loading rows -->
  <template v-if="loading">
    <tr v-for="n in 3" :key="'skeleton-' + n">
      <td :colspan="expandedColspan" class="...">
        <div class="animate-pulse flex items-center gap-4">...</div>
      </td>
    </tr>
  </template>
  <!-- Data rows -->
  <template v-else-if="localRocks && localRocks.length > 0">
    <template v-for="(rock, index) in localRocks" :key="rock.name">
      <tr :draggable="canReorder" ...>
        <td v-if="canReorder">...</td>
        <BigRockRow :canEdit="props.canEdit" ... />
        <td v-if="canEdit || canDelete">...</td>
      </tr>
      <tr v-if="isExpanded(rock.name)" ...>
        <BigRockExpandedRow :colspan="expandedColspan" ... />
      </tr>
    </template>
  </template>
  <!-- Empty state -->
  <tr v-else>
    <td :colspan="expandedColspan" class="px-3 py-8 text-center text-gray-500 border border-gray-300 dark:border-gray-600">
      No Big Rocks configured.
    </td>
  </tr>
</tbody>
```

This eliminates the second (read-only) tbody entirely, since all its content is
now handled by the merged tbody with conditional column rendering.

#### 4.5.4 BigRockRow.vue

Check if `BigRockRow.vue` receives or uses `canEdit`. Based on the template
(line 226), it receives `:canEdit="true"` as a hardcoded prop. This controls
inline edit triggers within the row. Since all authenticated users can edit,
this prop is functionally true whenever the editable tbody renders.

**However**, when merging to a single tbody, the hardcoded `:canEdit="true"`
(line 226) must change to `:canEdit="props.canEdit"` to properly respect demo
mode. In demo mode, `canEdit` is `false` (via `DashboardView`), and the
hardcoded `true` would incorrectly allow inline edit triggers. No other changes
needed to BigRockRow.

#### 4.5.5 HygieneWelcomeModal.vue

`HygieneWelcomeModal.vue` receives `isReleaseManager` as a prop (line 11) and
uses it in the template at lines 127 and 175 to show release-manager-specific
guidance text. When `HygieneView.vue` renames its `isReleaseManager` ref to
`isPlanningManager`, the prop name passed to `HygieneWelcomeModal` must also
be updated:

- Rename the prop from `isReleaseManager` to `isPlanningManager` (line 11)
- Update template references at lines 127 and 175
- Update the text content from "release manager" to "planning manager" where
  it appears in user-facing strings

### 4.5.6 Files Examined But Not Modified

The following files were reviewed during analysis and are explicitly out of
scope for this plan:

| File | Reason Not Modified |
|---|---|
| `modules/releases/client/plan/views/HealthDashboardView.vue` (lines 47-50) | Computes its own `canEdit` independently (`true` unless demo mode). This controls health/risk features (passed to `ReleaseSelector`, `FeatureHealthTable`, `FeatureHealthRow`) -- not Big Rock structural operations. The Big Rock permission model does not apply here. |
| `modules/releases/client/plan/composables/useReleasePlanning.js` (permissions fetch) | Only the fallback default changes (Section 4.5.1). The fetch/store logic is already shape-agnostic and requires no modification. |
| `modules/releases/client/plan/components/BigRockRow.vue` | Receives `canEdit` prop for inline edit triggers. Since all authenticated users retain `canEdit`, the prop value does not change semantically. However, the hardcoded `:canEdit="true"` in the editable tbody must change to `:canEdit="props.canEdit"` during the template merge (see Section 4.5.3, Minor note). |

### 4.6 Doc Import: Gate `replace` Mode to Planning Manager

The `POST /releases/:version/import/doc` endpoint in `replace` mode wipes all
existing Big Rocks before importing from a Google Doc. This is the most
destructive structural operation available -- it replaces the entire planning
dataset for a release version. Consistent with the plan's goal of restricting
structural changes to `planning-manager` users, `replace` mode is gated in
Phase 2.

**Implementation:** Rather than adding `requirePlanningManager` as route-level
middleware (which would also block `append` mode), add an inline check inside
the handler:

```javascript
router.post('/releases/:version/import/doc', requireAuth, blockDuringImpersonation, requireScope('releases:write'), async function(req, res) {
  const mode = req.body && req.body.mode
  // Gate replace mode to planning-manager (structural operation)
  if (mode === 'replace' && !req.isAdmin && !req.isPlanningManager) {
    return res.status(403).json({ error: 'Replace mode requires planning-manager role' })
  }
  // ... rest of handler unchanged
})
```

`append` mode remains open to all authenticated users (it adds Big Rocks
without destroying existing data).

### 4.7 Clarifications

**`feature-tracking-routes.js` does NOT use `requireReleaseManager`.** While
`index.js` currently passes `requireReleaseManager` in the feature-tracking
context (line 189), the function signature in `feature-tracking-routes.js`
(line 503) only destructures `context.storage`, `context.requireAuth`, and
`context.requireScope`. The middleware is passed but never consumed. In Phase 1,
clean up `index.js` by removing `requirePlanningManager` from the
feature-tracking context object (it is dead code). No changes to
`feature-tracking-routes.js` itself.

**`tv-fv-delta.spec.js` Audit nav item assertion is stale.** Line 128 asserts
`{ id: 'audit', label: 'Audit', icon: 'History', requireRole: 'release-manager' }`,
but the actual `module.json` does NOT have `requireRole` on the Audit nav item
(only the Manage/registry item has it). This is a pre-existing test bug -- the
assertion passes because the test compares a subset of properties (not strict
equality), but the `requireRole` key is phantom. Fix this by removing the
`requireRole: 'release-manager'` from the Audit assertion entirely, rather than
renaming it. The Manage nav item assertion at line 123 is correct and should be
renamed to `'planning-manager'`.

**`ReleaseSelector` is unaffected.** The `ReleaseSelector` component receives
`canEdit` from `DashboardView` (line 320), which stays `true` for all
authenticated users. No changes needed.

---

## 5. Migration & Backward Compatibility

### 5.1 Role Assignment Migration

**Mechanism:** Direct `roles.json` manipulation via `readFromStorage` /
`writeToStorage` in `modules/releases/server/index.js`, immediately after role
registration. Does NOT use `roleStore.assignRole()` / `revokeRole()` (see
Section 4.2 for rationale).

**Behavior:**
1. After registering `planning-manager`, read raw `roles.json` via
   `storage.readFromStorage('roles.json')`
2. Scan for users with `release-manager` in their roles array
3. If any need migration, write a backup to `roles-backup-premigration.json`
   (following the `migrateEmailDomains()` precedent in `role-store.js`)
4. For each user with `release-manager`, remove `release-manager` and add
   `planning-manager` (if not already present)
5. Write back via `storage.writeToStorage('roles.json', data)`
6. Log the migration count
7. This is idempotent -- safe to run on every restart (backup and write are
   both skipped when no `release-manager` entries exist)

**Edge cases:**
- User has both `release-manager` and `planning-manager` (shouldn't happen, but
  handle gracefully -- just remove `release-manager`, skip adding duplicate
  `planning-manager`)
- Empty `roles.json` or no assignments -- no-op, no write
- Demo mode -- `readFromStorage` returns fixture data, `writeToStorage` is a
  no-op, which is fine

### 5.2 PM User Auto-Migration

The existing PM user auto-migration (planning/routes.js lines 58-82) migrates
from `pm-users.json` to the role system. Update it to assign `planning-manager`
instead of `release-manager`. Since this migration deletes `pm-users.json` after
running, it is already idempotent.

### 5.3 Role Registry Validation

The role registry (`shared/server/role-registry.js`) prevents duplicate
registration. Since we are registering `planning-manager` instead of
`release-manager`, there is no conflict. However, if any other code attempts to
register `release-manager` after this change, it will fail silently (role not
found in registry when trying to assign via roleStore). This is the desired
behavior.

### 5.4 Frontend Permissions Backward Compatibility

The permissions endpoint response is additive -- it adds three new fields
(`canAdd`, `canDelete`, `canReorder`) alongside the existing `canEdit`. Any
frontend code that only reads `canEdit` will continue to work correctly. The new
props are optional with `default: false`, so components that do not receive them
will behave as read-only for the new operations.

---

## 6. Settings UI Impact

The UserManagement component (`src/components/UserManagement.vue`) fetches
available roles from `/api/roles/available` and renders them dynamically. The
role label and description come from the role registry, so renaming the role
automatically updates the Settings UI.

**Badge color update:** The `ROLE_BADGE_COLORS` map (line 210) uses the role ID
as key. Update `'release-manager'` to `'planning-manager'` to preserve the
purple badge color.

---

## 7. Files Modified

### Server-Side

| File | Changes |
|---|---|
| `modules/releases/server/index.js` | Rename role registration to `planning-manager`; rename `requireReleaseManager` to `requirePlanningManager`; add startup migration (direct `roles.json` manipulation via `readFromStorage`/`writeToStorage`); update all sub-router context objects to pass `requirePlanningManager`; add `requirePlanningManager` to planning sub-router context; stop passing `requireReleaseManager` to feature-tracking context (unused -- see Section 4.7) |
| `modules/releases/server/planning/routes.js` | Destructure `requirePlanningManager` from context; update permissions endpoint to return granular flags; add `requirePlanningManager` to POST, DELETE, reorder endpoints; add `requirePlanningManager` to `POST /import/doc` with `replace` mode check (Section 4.6); update PM user auto-migration to assign `planning-manager` |
| `modules/releases/server/registry.js` | Update destructured `requireReleaseManager` to `requirePlanningManager` |
| `modules/releases/server/hygiene/routes.js` | Update destructured `requireReleaseManager` to `requirePlanningManager`; update OpenAPI summaries |
| `modules/releases/module.json` | Update `"requireRole": "release-manager"` to `"planning-manager"` on Manage nav item |
| `shared/server/auth.js` | Rename `req.isReleaseManager` to `req.isPlanningManager` (lines 109, 143) |
| `shared/server/role-registry.js` | Update JSDoc example at line 13 from `'release-manager'` to `'planning-manager'` |

### Client-Side

| File | Changes |
|---|---|
| `modules/releases/client/plan/views/DashboardView.vue` | Add `canAdd`, `canDelete`, `canReorder` computeds; pass as props to BigRocksTable |
| `modules/releases/client/plan/components/BigRocksTable.vue` | Add `canAdd`, `canDelete`, `canReorder` props; merge two `<tbody>` blocks into single tbody with conditional columns; migrate skeleton loading rows and empty state from read-only tbody; make `draggable` attribute conditional on `canReorder`; compute dynamic `expandedColspan` for expanded rows, skeleton rows, and empty state; change `:canEdit="true"` to `:canEdit="props.canEdit"` on `BigRockRow` |
| `modules/releases/client/plan/composables/useReleasePlanning.js` | Update permissions fallback default to include all four flags |
| `modules/releases/client/views/RegistryView.vue` | Update `'release-manager'` string to `'planning-manager'` in access check and error message |
| `modules/releases/client/execute/views/HygieneView.vue` | Rename `isReleaseManager` ref to `isPlanningManager`; update prop name passed to `HygieneWelcomeModal` |
| `modules/releases/client/execute/components/hygiene/HygieneWelcomeModal.vue` | Rename `isReleaseManager` prop to `isPlanningManager`; update template references at lines 127 and 175; update user-facing text |
| `src/components/UserManagement.vue` | Update `ROLE_BADGE_COLORS` key from `'release-manager'` to `'planning-manager'` |

### Tests

| File | Changes |
|---|---|
| `modules/releases/__tests__/server/rbac.test.js` | Rename all `release-manager` references to `planning-manager` |
| `modules/releases/__tests__/server/planning/routes.test.js` | Update open access tests: POST and DELETE should now return 403 for non-planning-manager; add new tests for role enforcement |
| `modules/releases/__tests__/server/planning/health-routes.test.js` | Update role references |
| `modules/releases/__tests__/server/planning/invalidate-cache.test.js` | Update `requireReleaseManager` mock references to `requirePlanningManager` in context setup (lines 131, 273) |
| `tests/integration/tv-fv-delta.spec.js` | Update `requireRole` assertion at line 123 from `'release-manager'` to `'planning-manager'`; remove stale `requireRole` assertion from Audit nav item at line 128 (see Section 4.7) |
| `shared/server/__tests__/module-context.test.js` | Update role registration example |

### Documentation

| File | Changes |
|---|---|
| `docs/DATA-FORMATS.md` | Update example role name |
| `docs/MODULES.md` | Update role documentation examples |
| `docs/plans/outcomes-dashboard-access.md` | Add note about superseded role name (do not rewrite -- it is a historical record) |

---

## 8. Phased Implementation

### Phase 1: Role Rename (foundation)

**Scope:** Rename `release-manager` -> `planning-manager` everywhere. No
permission logic changes. Behavior stays identical -- just the identifier
changes.

**Steps:**
1. Update `modules/releases/server/index.js`:
   - Change `registerRole('release-manager', ...)` to `registerRole('planning-manager', ...)`
   - Rename `requireReleaseManager` variable to `requirePlanningManager`
   - Add startup migration block (direct `roles.json` manipulation via
     `readFromStorage`/`writeToStorage` -- NOT `roleStore.revokeRole()`);
     must write `roles-backup-premigration.json` before overwriting
   - Update all sub-router context objects to pass `requirePlanningManager`
   - Remove `requireReleaseManager`/`requirePlanningManager` from
     feature-tracking context (unused, dead code cleanup)
2. Update `shared/server/auth.js`:
   - Change `req.isReleaseManager` to `req.isPlanningManager` (lines 109, 143)
3. Update `shared/server/role-registry.js`:
   - Update JSDoc example at line 13 from `'release-manager'` to `'planning-manager'`
4. Update `modules/releases/module.json`:
   - Change `"requireRole": "release-manager"` to `"planning-manager"`
5. Update `modules/releases/server/registry.js`:
   - Rename destructured `requireReleaseManager` to `requirePlanningManager`
6. Update `modules/releases/server/hygiene/routes.js`:
   - Rename destructured `requireReleaseManager` to `requirePlanningManager`
   - Update OpenAPI summary strings
7. Update `modules/releases/server/planning/routes.js`:
   - Update PM user auto-migration to use `planning-manager`
8. Update all client files:
   - `RegistryView.vue`: role string + error message
   - `HygieneView.vue`: ref name + role check + prop name to HygieneWelcomeModal
   - `HygieneWelcomeModal.vue`: prop name + template references + user-facing text
   - `UserManagement.vue`: badge color key
9. Update all tests:
   - `rbac.test.js`: all `release-manager` references
   - `routes.test.js`: comment strings
   - `health-routes.test.js`: role references
   - `invalidate-cache.test.js`: `requireReleaseManager` mock references
   - `tv-fv-delta.spec.js`: rename Manage nav item assertion to `'planning-manager'`;
     remove stale `requireRole` from Audit nav item assertion
   - `module-context.test.js`: role registration example
10. Update documentation:
    - `role-registry.js`: JSDoc example
    - `DATA-FORMATS.md`: example role name
    - `MODULES.md`: role documentation examples
    - `outcomes-dashboard-access.md`: add superseded note

**Verification:** `npm test` passes. `npm run lint` passes. Role assignment via
Settings UI shows "Planning Manager". Existing users with `release-manager` are
auto-migrated on server restart.

**PR:** Single PR, can be merged independently.

### Phase 2: Granular Permissions (the feature)

**Scope:** Split `canEdit` into `canEdit` + `canAdd` + `canDelete` +
`canReorder`. Add server-side role enforcement on Big Rock write endpoints.
Gate doc import `replace` mode.

**Steps:**
1. In `modules/releases/server/index.js`, add `requirePlanningManager` to the
   planning sub-router context object.
2. In `modules/releases/server/planning/routes.js`:
   - Destructure `requirePlanningManager` from context (add to line 51)
   - Update permissions endpoint to return
     `{ canEdit, canAdd, canDelete, canReorder }` based on
     `req.isPlanningManager || req.isAdmin`
   - Add `requirePlanningManager` middleware to:
     - `POST /releases/:version/big-rocks` (create)
     - `DELETE /releases/:version/big-rocks/:name` (delete)
     - `PUT /releases/:version/big-rocks/reorder` (reorder)
   - Add inline `replace` mode check to `POST /releases/:version/import/doc`
     (see Section 4.6)
3. Update `useReleasePlanning.js` fallback default
4. Update `DashboardView.vue` with granular computeds and prop passing
5. Update `BigRocksTable.vue`:
   - Add new props
   - Merge the two `<tbody>` blocks into a single tbody with conditional columns
   - Migrate skeleton loading rows and "No Big Rocks configured" empty state
     from the read-only tbody into the merged tbody (see Section 4.5.3)
   - Use `expandedColspan` computed for all colspan values (expanded rows,
     skeleton rows, empty state)
   - Make `draggable` attribute conditional: `:draggable="canReorder"`
   - Compute dynamic colspan for `BigRockExpandedRow` based on visible columns
   - Change `:canEdit="true"` on `BigRockRow` to `:canEdit="props.canEdit"`
     (respects demo mode -- see Section 4.5.4)
   - Conditionally render drag handles, delete buttons, add button
   - Actions column header gated on `canEdit || canDelete`
   - Remove the second (read-only) `<tbody>` entirely
6. Update tests:
   - `routes.test.js`: POST and DELETE for non-planning-manager should 403
   - `routes.test.js`: PUT (edit) for non-planning-manager should still 200
   - `routes.test.js`: Reorder for non-planning-manager should 403
   - `routes.test.js`: Doc import `replace` mode for non-planning-manager should 403
   - `routes.test.js`: Doc import `append` mode for non-planning-manager should 200
   - Add new test block: "planning-manager role enforcement"

**Verification:** Manual testing with two accounts (one with `planning-manager`,
one without). Verify 403 responses on privileged endpoints. Verify UI hides
add/delete/reorder for unprivileged users. Verify edit still works for all.
Verify doc import `replace` blocked, `append` allowed for non-managers.

**PR:** Single PR, depends on Phase 1 being merged.

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Existing test patterns to follow:**
- `rbac.test.js` -- role registration, assignment, middleware behavior
- `routes.test.js` -- route-level permission testing with mock req/res

**New test cases for Phase 2:**

```
planning-manager role enforcement on big rocks
  - returns 403 when non-planning-manager creates a big rock (POST)
  - returns 403 when non-planning-manager deletes a big rock (DELETE)
  - returns 403 when non-planning-manager reorders big rocks (PUT reorder)
  - allows planning-manager to create a big rock (POST)
  - allows planning-manager to delete a big rock (DELETE)
  - allows planning-manager to reorder big rocks (PUT reorder)
  - allows admin (non-planning-manager) to create/delete/reorder
  - allows any authenticated user to edit existing big rock (PUT)

doc import replace mode enforcement
  - returns 403 when non-planning-manager uses replace mode
  - allows non-planning-manager to use append mode
  - allows planning-manager to use replace mode

permissions endpoint returns granular flags
  - returns canAdd=true for planning-manager
  - returns canAdd=false for non-planning-manager
  - returns canEdit=true for all authenticated users
  - returns canReorder and canDelete correctly

role migration
  - migrates release-manager to planning-manager on startup
  - writes roles-backup-premigration.json before overwriting roles.json
  - handles empty roles.json gracefully
  - is idempotent (no error on re-run, no backup written when nothing to migrate)
  - handles user with both release-manager and planning-manager
```

### 9.2 Local Testing

1. Start dev server: `npm run dev:full`
2. Open browser, authenticate
3. In Settings > Users, assign `planning-manager` to yourself
4. Verify full Big Rocks functionality (add, edit, delete, reorder)
5. Revoke `planning-manager` from yourself
6. Verify edit works but add/delete/reorder are hidden
7. Try direct API calls to POST/DELETE endpoints -- should get 403
8. Re-assign `planning-manager` and verify access restored
9. Test doc import: without `planning-manager`, `replace` mode should 403,
   `append` mode should succeed

### 9.3 Impersonation Testing

1. As admin, assign `planning-manager` to a test user
2. Impersonate that user -- verify full access
3. Impersonate a user without `planning-manager` -- verify restricted access
4. Verify blockDuringImpersonation still works on DELETE

### 9.4 Integration Tests

No integration test changes needed for Phase 1 (role rename does not change
behavior). Phase 2 may warrant a new integration test case in
`tests/integration/releases.spec.js` if one exists, but given that the
permission logic is fully tested at the unit level and the UI changes are
prop-driven, unit tests provide sufficient coverage.

---

## 10. Deployment Considerations

### 10.1 CI/CD

No CI/CD pipeline changes. The build-images workflow is unaffected. Kustomize
overlays do not reference the role name. The role is stored in `data/roles.json`
(PVC-backed), not in ConfigMaps or Secrets.

### 10.2 Rollout Sequence

1. **Merge Phase 1 (role rename)** -- deploys to preprod via ArgoCD
2. Verify in preprod: existing release-manager users migrated, Settings UI shows
   "Planning Manager", all gated features still work
3. **Merge Phase 2 (granular permissions)** -- deploys to preprod
4. Verify in preprod: granular UI behavior, 403 on privileged endpoints for
   unprivileged users
5. Promote to prod (prod overlay does not need changes)

### 10.3 Rollback

**Phase 1 rollback:** If the role rename causes issues, roll back the code
deployment. The backend uses a `Recreate` deployment strategy, so there is no
split-brain risk during deployment (old and new pods never run simultaneously).

However, rollback has user-visible impact: users who were migrated to
`planning-manager` will lose ALL role-gated access -- not just Big Rocks, but
also the release registry, hygiene configuration, and any nav items gated on
the role. This is because the rolled-back code expects `release-manager` in
`roles.json`, but the migration has already rewritten those entries to
`planning-manager`. The `planning-manager` entries will be treated as an
unrecognized role by the old code, effectively making those users unprivileged.

**To fix after rollback:** Manually edit `data/roles.json` on the PVC, replacing
`planning-manager` back to `release-manager` in each user's roles array. This
requires shell access to the pod or PVC. Alternatively, deploy a hotfix that
adds a reverse migration. Given the migration's simplicity and the narrow scope
of the role rename, this risk is low and well-understood.

**Phase 2 rollback:** Roll back the code deployment. The permissions endpoint
will return the old `{ canEdit: true }` shape. Frontend will gracefully degrade
(new props have `default: false`, but the old code only checks `canEdit`). No
data corruption risk.

### 10.4 Migration Timing

The startup migration runs synchronously before routes are registered. It
completes in milliseconds (iterating `roles.json` entries). No downtime or
maintenance window needed.

---

## 11. UX Review

**Recommendation:** A UX review is not required for this change. The visual
changes are minimal:

- The "Add Big Rock" button disappears for non-planning-managers (already hidden
  in read-only mode, so the pattern is established)
- Delete buttons (trash icons) disappear for non-planning-managers
- Drag handles disappear for non-planning-managers
- Edit buttons (pencil icons) remain visible for all users
- No new UI components, modals, or flows are introduced
- The role name in Settings changes from "Release Manager" to "Planning Manager"

If a UX teammate has capacity, a quick review of the granular permission states
(what the table looks like for planning-manager vs non-planning-manager) would be
valuable but not blocking.

---

## 12. Open Questions

1. **Should the "New Release" and "Clone Release" buttons also be gated to
   planning-manager?** Currently gated on `canEdit` which is open to all. The
   outcomes-dashboard-access.md plan explicitly opened these. If the intent is
   to restrict structural changes, release creation could be included. For now,
   this plan keeps them open per the prior decision. Can be added later by
   including a `canCreateRelease` flag.

---

## 13. Summary

This plan introduces granular Big Rock permissions by:

1. **Renaming** `release-manager` to `planning-manager` with automated startup
   migration (direct `roles.json` manipulation, not roleStore API)
2. **Splitting** the single `canEdit` flag into four granular permissions
3. **Enforcing** on both server (403 on privileged endpoints) and frontend
   (hide/disable UI elements)
4. **Gating** doc import `replace` mode to planning-manager (most destructive
   structural operation)
5. **Preserving** open editing for all authenticated users on existing Big Rocks

Two clean PRs: Phase 1 (rename, independently shippable) and Phase 2 (granular
permissions, depends on Phase 1). Total estimated touch: 7 server files, 7
client files, 6 test files, 3 documentation files.
