# Manager Dashboard: Team-Manager Association & One-Stop Management View

## Overview

Add a **Manager Dashboard** view that gives managers a single place to manage data fields for their direct reports and the teams those reports belong to. Team-manager associations are **derived at runtime** from existing LDAP `managerUid` data — no new stored data model is needed.

## Key Concept: Derived Team Purview

A manager has "purview" over a team if **at least one of their direct reports** (people whose `managerUid` equals the manager's UID) is assigned to that team via the in-app structure store (`teamIds`).

```
Manager's purview teams = union of all teamIds across their direct reports
```

This is computed server-side and exposed via API. Multiple managers can have purview over the same team (expected when a team has members from different orgs). A manager can have purview over multiple teams.

## Scope

- **In-app teams only** (structure store / `data/team-data/teams.json`)
- **No new stored fields** on teams — purview is computed from existing `managerUid` + `teamIds` data
- **No backend permission model changes** — the existing `manager` permission tier already grants the right to edit fields for managed people. However, **UI-level visibility changes** are needed: a new `requireRole: "manager"` option for nav items, sidebar filtering logic to support it, a new `isManager` prop plumbed from `App.vue` through to `AppSidebar`, and a new icon added to the sidebar's `ICON_MAP`. These are additive UI controls, not changes to the backend authorization model.
- **`requireRole` and `requireCondition` are conjunctive (AND)** — both conditions must pass for a nav item to be visible. For example, `requireRole: "manager"` + `requireCondition: "in-app-mode"` means the item appears only when the user is a manager (or above) AND the app is in in-app mode.
- **New nav item** visible to managers (and above) when in-app mode is active
- **New API endpoint** to return the manager's purview data
- **New frontend view** with tabbed interface for managing people and teams

---

## Phase 1: Backend — Compute & Expose Manager Purview

### 1.1 New helper: `getManagerPurview()`

**File:** `modules/team-tracker/server/manager-purview.js` (new file)

This function lives in the team-tracker module (not in `shared/server/permissions.js`) because it depends on the module-specific in-app team data structure (`teams.json`). The shared `permissions.js` layer should not have coupling to module-specific data formats. No updates to `shared/API.md` are needed since no new shared exports are added.

```js
const { getDirectReports } = require('../../../shared/server/permissions');

/**
 * Compute the teams a manager has purview over based on their
 * direct reports' team assignments.
 * @param {string} managerUid
 * @param {object} registry - { people: { uid: { managerUid, teamIds, _appFields, ... } } }
 * @param {object} teamsData - { teams: { teamId: { id, name, orgKey, metadata, ... } } }
 * @returns {{ directReportUids: string[], teams: Array<{ id, name, orgKey, directReportUids: string[], totalMemberCount: number }> }}
 */
function getManagerPurview(managerUid, registry, teamsData) { ... }
```

This reuses `getDirectReports()` from `shared/server/permissions.js` (already exists) and cross-references with `teamIds` from the registry.

**Performance note:** `getDirectReports()` performs an O(n) scan of all registry people on every call. This is acceptable at current scale (hundreds to low thousands of people). For larger deployments, the pre-built `managerMap` (computed once at startup and on roster changes via `rebuildManagerMap()` in the server index) already computes direct reports as an intermediate step during `buildManagerMap()`'s first pass. The dashboard endpoint could accept this pre-built map to avoid redundant scans. This optimization is deferred — documented here as a known path if performance becomes a concern.

**Tests:** `modules/team-tracker/__tests__/server/manager-purview.test.js`
- Manager with reports on 2 teams → returns both teams with correct `directReportUids` and `totalMemberCount`
- Manager with reports on no teams → returns reports but empty teams array
- Multiple reports on same team → deduplicates team, lists all report UIDs under `directReportUids`
- Inactive reports are excluded
- Reports with no `teamIds` → included in `directReportUids` return value but not in any team's `directReportUids`

### 1.2 New API endpoint: `GET /api/modules/team-tracker/manager/dashboard`

**File:** `modules/team-tracker/server/index.js`

Returns the current user's manager purview along with enriched data for the dashboard view.

**Request:** No parameters needed (uses `req.userUid` from auth).

**Auth:** Requires the user to be in the registry and have at least one active direct report (i.e., `manager` tier or above). Returns 403 for `user` tier.

**`req.userUid` null handling (local dev):** In local dev, `req.userUid` may be null because the local-dev email is not in the registry. When `req.userUid` is null, the endpoint returns a **200 with an informative empty state** (not a 403), including a `reason` field:

```json
{
  "manager": null,
  "directReports": [],
  "teams": [],
  "fieldDefinitions": { "person": [], "team": [] },
  "reason": "no-registry-identity"
}
```

This allows the frontend to display a helpful message ("Your account is not linked to the people registry") rather than an access-denied error.

When `req.userUid` is valid but the user has no direct reports, the response returns an empty state with `"reason": "no-direct-reports"`.

**Response (normal case):**

```json
{
  "manager": {
    "uid": "jsmith",
    "name": "Jane Smith",
    "email": "jsmith@redhat.com"
  },
  "directReports": [
    {
      "uid": "adoe",
      "name": "Alice Doe",
      "email": "adoe@redhat.com",
      "title": "Software Engineer",
      "teamIds": ["team_abc123"],
      "customFields": { "field_x1y2z3": "backend" }
    }
  ],
  "teams": [
    {
      "id": "team_abc123",
      "name": "Model Serving",
      "orgKey": "shgriffi",
      "directReportUids": ["adoe", "bjones"],
      "totalMemberCount": 5,
      "metadata": { ... },
      "boards": [...]
    }
  ],
  "fieldDefinitions": {
    "person": [ ... ],
    "team": [ ... ]
  }
}
```

**`_appFields` to `customFields` mapping:** The registry stores person field data in the `_appFields` property (an internal storage convention). The API response maps this to `customFields` for consistency with the existing org-teams endpoint, which performs the same transformation (see `modules/team-tracker/server/index.js` lines 170-185). The mapping iterates over the active person field definitions and populates `customFields[fieldDef.id]` from `person._appFields?.[fieldDef.id] || null`:

```js
const customFields = {};
for (const fieldDef of personFieldDefs) {
  customFields[fieldDef.id] = person._appFields?.[fieldDef.id] || null;
}
```

**`teams[].directReportUids` (not `memberUids`):** This array contains ONLY the manager's direct reports assigned to that team (not all team members). The field is named `directReportUids` to make it unambiguous whose UIDs are listed. The `totalMemberCount` field provides the total count of all people assigned to the team so the UI can show context like "3 of 8 members are your reports."

### 1.3 Existing endpoints — no changes needed

The existing endpoints already support what the dashboard needs:
- `PATCH /api/modules/team-tracker/structure/person/:uid/fields` — edit person fields (already checks `requireManagerOrAdmin`)
- `PATCH /api/modules/team-tracker/structure/teams/:teamId/fields` — edit team fields (requires team-admin+, managers cannot edit team fields)

No backend changes are needed for field editing — the dashboard will call these existing endpoints.

---

## Phase 2: Frontend — Sidebar & Nav Support

### 2.1 Add `LayoutDashboard` icon to `ICON_MAP`

**File:** `src/components/AppSidebar.vue`

The `ICON_MAP` object (lines 269-306) does not include `LayoutDashboard`. Without adding it, the icon would silently fall back to `BarChart3` via the `resolveIcon` function. Changes needed:

1. Add `LayoutDashboard` to the lucide-vue-next import statement (lines ~240-266)
2. Add `LayoutDashboard` as a key in the `ICON_MAP` object

### 2.2 Add `isManager` prop to `AppSidebar`

**File:** `src/components/AppSidebar.vue`

Add `isManager` to `defineProps` (after `isTeamAdmin` at line 315):

```js
isManager: { type: Boolean, default: false },
```

### 2.3 Add `requireRole: "manager"` to sidebar filter

**File:** `src/components/AppSidebar.vue`

The filter chain at lines 384-389 currently handles only `team-admin`. Insert the `"manager"` check AFTER the `team-admin` line (388) and BEFORE the final `return false` (389):

```js
.filter(item => {
  if (item.requireCondition === 'in-app-mode' && props.teamDataSource !== 'in-app') return false
  if (!item.requireRole) return true
  if (props.isAdmin) return true
  if (item.requireRole === 'team-admin') return props.isTeamAdmin
  if (item.requireRole === 'manager') return props.isManager || props.isTeamAdmin  // NEW LINE
  return false
})
```

Note: `props.isAdmin` is already checked before any role-specific branches, so admins pass unconditionally. The `manager` branch also allows team-admins (who are a superset of managers for nav visibility).

### 2.4 Plumb `isManager` from `App.vue` to `AppSidebar`

**File:** `src/components/App.vue`

App.vue currently calls `usePermissions()` at line 235 but only destructures `refresh`:
```js
const { refresh: refreshPermissions } = usePermissions()
```

It does NOT destructure or return `isManager`. Three changes are needed:

1. **Update the destructure** to include `isManager`:
   ```js
   const { isManager: authIsManager, refresh: refreshPermissions } = usePermissions()
   ```

2. **Add to the `return` block** (line ~367):
   ```js
   return {
     ...
     authIsManager,   // ADD THIS
     ...
   }
   ```

3. **Pass to AppSidebar** in the template (after `:is-team-admin` at line ~11):
   ```html
   :is-manager="authIsManager"
   ```

---

## Phase 3: Frontend — Manager Dashboard View

### 3.1 New view: `ManagerDashboardView.vue`

**File:** `modules/team-tracker/client/views/ManagerDashboardView.vue`

A tabbed dashboard with two sections:

#### Tab 1: "My Reports" (default)

A table/card layout showing all direct reports with:
- Name (clickable, navigates to person-detail)
- Title
- Team assignment(s)
- Editable custom fields inline (reuses `PersonFieldEditor` component)
- Visual grouping by team (optional toggle: flat list vs. grouped by team)

Managers can edit person-level custom fields directly from this view without navigating to each person's profile.

**Empty states:**
- `reason: "no-registry-identity"` — "Your account is not linked to the people registry. In local dev, this typically means your email address does not match any person in the registry."
- `reason: "no-direct-reports"` — "You have no direct reports in the system."
- Reports exist but none are assigned to any team — show reports with a note that they are unassigned

#### Tab 2: "My Teams"

A list of teams the manager has purview over, showing:
- Team name (clickable, navigates to team-detail)
- "X of Y members are your reports" count (using `directReportUids.length` and `totalMemberCount`)
- Team metadata fields (read-only for managers, since team field editing requires team-admin+)
- Team boards (read-only links)

Each team card/row can be expanded to show the manager's direct reports on that team, with inline field editing.

### 3.2 New composable: `useManagerDashboard`

**File:** `modules/team-tracker/client/composables/useManagerDashboard.js`

```js
export function useManagerDashboard() {
  // Fetches GET /api/modules/team-tracker/manager/dashboard
  // Returns reactive refs: manager, directReports, teams, fieldDefinitions, loading, error, reason
  // Provides refresh() function
}
```

### 3.3 Route registration

**File:** `modules/team-tracker/client/index.js`

Add route:
```js
'manager-dashboard': defineAsyncComponent(() => import('./views/ManagerDashboardView.vue')),
```

### 3.4 Nav item

**File:** `modules/team-tracker/module.json`

Add nav item after "Org Dashboard" and before "Manage" in the navItems array:
```json
{
  "id": "manager-dashboard",
  "label": "My Teams",
  "icon": "LayoutDashboard",
  "requireRole": "manager",
  "requireCondition": "in-app-mode"
}
```

Both `requireRole` and `requireCondition` are evaluated conjunctively (AND) — the item only appears when both conditions pass.

---

## Phase 4: Demo Mode & Fixtures

### 4.1 Fixture data verification

The existing demo fixtures already have the manager hierarchy needed for this feature. **No fixture changes are needed.**

**`fixtures/team-data/registry.json`:**
- `achen` (Senior Engineering Manager, `managerUid: "demovp"`) manages:
  - `bsmith` → `teamIds: ["team_a1b2c3"]` (Platform)
  - `dlee` → `teamIds: ["team_d4e5f6"]` (Infrastructure)
  - `egarcia` → `teamIds: ["team_d4e5f6"]` (Infrastructure)
- `bsmith` (Senior Software Engineer, sub-manager) manages:
  - `cwilliams` → `teamIds: ["team_a1b2c3"]` (Platform)
- `fjohnson` (Engineering Manager, `managerUid: "demovp"`) manages:
  - `gkim` → `teamIds: ["team_j1k2l3"]` (ML Platform)
  - `hwilson` → `teamIds: ["team_j1k2l3"]` (ML Platform)

**`fixtures/team-data/teams.json`:** Contains teams `team_a1b2c3` (Platform), `team_d4e5f6` (Infrastructure), `team_j1k2l3` (ML Platform), `team_m4n5o6` (Data Pipeline).

This means in demo mode:
- `achen` → sees 3 direct reports across 2 teams (Platform, Infrastructure)
- `fjohnson` → sees 2 direct reports on 1 team (ML Platform)
- `bsmith` → sees 1 direct report on 1 team (Platform)
- All people have `_appFields` populated with field values for inline editing

### 4.2 Demo storage

The `GET /manager/dashboard` endpoint handles demo storage the same way other endpoints do — the `readFromStorage` abstraction transparently delegates to `demo-storage.js` when `DEMO_MODE` is active. No special demo-mode code is needed in the endpoint.

---

## Phase 5: Testing

### Backend tests

**File:** `modules/team-tracker/__tests__/server/manager-purview.test.js`

Unit tests for `getManagerPurview()`:
- Manager with reports on 2 teams → returns both teams with correct `directReportUids` and `totalMemberCount`
- Manager with reports on no teams → returns reports but empty teams array
- Multiple reports on same team → deduplicates team, lists all report UIDs under `directReportUids`
- Inactive reports are excluded
- Reports with no `teamIds` → not included in any team's `directReportUids`

**File:** `modules/team-tracker/__tests__/server/manager-dashboard-endpoint.test.js`

Integration-style tests for the endpoint:
- `GET /manager/dashboard` returns correct purview for a manager
- Returns 200 with `reason: "no-registry-identity"` when `req.userUid` is null
- Returns 200 with `reason: "no-direct-reports"` for user with no reports
- Returns 403 for `user` tier (has registry identity but is not a manager)
- `customFields` are populated from `_appFields` using field definitions (not raw `_appFields`)
- `directReportUids` contains only direct reports, not all team members
- `totalMemberCount` reflects all team members assigned to the team

### Frontend tests

**File:** `modules/team-tracker/__tests__/client/ManagerDashboardView.test.js`

- Renders reports tab by default
- Shows direct reports with editable fields
- Shows teams tab with team cards displaying "X of Y" member counts
- Handles `reason: "no-registry-identity"` empty state message
- Handles `reason: "no-direct-reports"` empty state message
- Navigation to person/team detail views works

---

## Files Modified (Summary)

| File | Change |
|------|--------|
| `modules/team-tracker/server/manager-purview.js` | **New file.** `getManagerPurview()` function |
| `modules/team-tracker/server/index.js` | Add `GET /manager/dashboard` endpoint |
| `modules/team-tracker/client/views/ManagerDashboardView.vue` | **New file.** Primary deliverable (manager dashboard view) |
| `modules/team-tracker/client/composables/useManagerDashboard.js` | **New file.** Composable for dashboard data fetching |
| `modules/team-tracker/client/index.js` | Register `manager-dashboard` route |
| `modules/team-tracker/module.json` | Add "My Teams" nav item with `requireRole: "manager"` |
| `src/components/AppSidebar.vue` | Import `LayoutDashboard` from lucide-vue-next and add to `ICON_MAP`; add `isManager` prop to `defineProps`; add `requireRole: "manager"` filter branch after `team-admin` check |
| `src/components/App.vue` | Destructure `isManager` from `usePermissions()`, add to `return` block, pass as `:is-manager` prop to AppSidebar |
| `modules/team-tracker/__tests__/server/manager-purview.test.js` | **New file.** Unit tests for `getManagerPurview()` |
| `modules/team-tracker/__tests__/server/manager-dashboard-endpoint.test.js` | **New file.** Endpoint tests |
| `modules/team-tracker/__tests__/client/ManagerDashboardView.test.js` | **New file.** Frontend tests |

## Files NOT Modified

- `shared/server/permissions.js` — no changes; `getDirectReports()` is consumed as-is from the module
- `shared/API.md` — no changes; no new shared exports are added
- `shared/server/team-store.js` — no data model changes
- `data/team-data/teams.json` — no schema changes
- `data/team-data/registry.json` — no schema changes
- `fixtures/**` — existing fixture data already exercises the feature adequately

## Backward Compatibility

- **No breaking changes.** This feature is purely additive.
- No data migrations needed — purview is computed from existing data.
- The nav item only appears for managers in in-app mode (both `requireRole` and `requireCondition` must pass), so users who are not managers see no UI changes.
- The existing team and person field editing endpoints are reused without modification.
- The new `isManager` prop on AppSidebar defaults to `false`, so any external consumers of AppSidebar that do not pass the prop see no behavioral change.

## Implementation Order

1. **Backend helper:** `modules/team-tracker/server/manager-purview.js` + unit tests
2. **API endpoint:** `GET /manager/dashboard` in server index + endpoint tests
3. **Sidebar plumbing:** `LayoutDashboard` icon + `ICON_MAP` entry, `isManager` prop on AppSidebar, `requireRole: "manager"` filter, `App.vue` prop plumbing
4. **Frontend:** composable → view → route registration → module.json nav item
5. **Frontend tests**

## Open Questions / Future Considerations

1. **Admin/team-admin view of the dashboard:** Should admins see a version of this dashboard? Currently they can already manage everything via the Manage view and individual team/person pages. The dashboard could show "all teams" for admins, but that may be noise. Recommend: admins see the same manager dashboard scoped to their own reports (if they have any), or a message directing them to use the Manage view.

2. **Transitive vs. direct reports:** The spec says "direct reports" only (people whose `managerUid` equals the manager's UID). This means a senior manager will not see teams where only their skip-level reports are assigned. If skip-level visibility is desired later, `getManagerPurview()` can be extended to use `getManagedUids()` (transitive) instead of `getDirectReports()`.

3. **Team field editing for managers:** Currently managers cannot edit team-level fields (requires team-admin+). The dashboard shows team fields as read-only. If managers should be able to edit fields on teams they have purview over, that would require a backend permission system change (out of scope per requirements).

4. **Notification of unassigned reports:** The dashboard could highlight direct reports who are not assigned to any team, nudging managers to assign them. This is a natural extension but not in the initial scope.

5. **Performance at scale:** `getDirectReports()` is O(n) per call. If this becomes a bottleneck, the pre-built `managerMap` (which already computes direct reports during `buildManagerMap()`'s first pass) can be passed to `getManagerPurview()` to avoid the redundant scan. See Phase 1.1 performance note for details.
