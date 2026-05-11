# Plan: Wire Team Structure Management UI into the App

## Context

The Team Structure Management feature has a complete backend (22 API endpoints under `/api/modules/team-tracker/structure/`) and all Vue components/composables are built. However, none of them are accessible from the UI — no nav items, no routes, no settings integration.

This plan covers wiring the existing components into the app's navigation, settings, and views.

## User Decisions

1. **Unassigned people**: Enhance the existing amber banner on Team Directory with a "Manage Unassigned" link that navigates to the full UnassignedPeople view (new internal route)
2. **Team assignment**: Inline collapsible section on TeamRosterView (team detail page), visible to admins/managers only
3. **Person custom fields**: Inline section on PersonProfileView, editable in-place by admins/managers
4. **Settings organization**: Add new sub-tabs ("Teams", "Fields", "Audit Log") alongside existing "People & Teams", "Jira Sync", "Snapshots"

## Components Covered

All 7 components that need wiring are accounted for:

| Component | Wired Into |
|-----------|-----------|
| TeamManagement | Settings sub-tab "Teams" |
| FieldDefinitionManager | Settings sub-tab "Fields" |
| AuditLogView | Settings sub-tab "Audit Log" |
| UnassignedPeople | New `unassigned` route (via banner link) |
| TeamAssignment | Inline section on TeamRosterView |
| TeamFieldEditor | Inline section on TeamRosterView |
| PersonFieldEditor | Inline section on PersonProfileView |

**Intentionally excluded**: `PermissionBadge` and `PersonReferenceField` are shared components (`shared/client/components/`) imported directly by the wired components themselves (e.g., PersonFieldEditor uses PersonReferenceField for `person-reference-linked` fields, and several components use PermissionBadge to show the user's permission tier). They don't need separate wiring — they're consumed internally.

## Data Source Gating (`teamDataSource`)

The roster API response includes `teamDataSource` (`"sheets"` or `"in-app"`), accessible via `useRoster().rosterData.value.teamDataSource`. **All in-app-only components must be gated on this value**:

- **TeamAssignment, TeamFieldEditor** (on TeamRosterView): Only render when `teamDataSource === 'in-app'` AND `team.teamId` is present. In Sheets mode, `teamId` is not populated on roster team objects, so these sections are hidden.
- **PersonFieldEditor** (on PersonProfileView): Only render when `teamDataSource === 'in-app'`. In Sheets mode, custom field keys are human-readable strings from Google Sheets (e.g., `"component"`), not field-definition IDs (e.g., `"field_x1y2z3"`), so PersonFieldEditor would misinterpret them.
- **UnassignedPeople**: Only show the "Manage Unassigned" banner button when `teamDataSource === 'in-app'`, since bulk assignment uses the structure API.
- **Settings sub-tabs** (Teams, Fields, Audit Log): Always visible — admins need access to configure teams/fields even before switching to in-app mode, and the Audit Log captures all structure operations regardless.

## Key Data-Flow Details

### Team-store ID via roster API (`teamId`)

The backend's `deriveRoster()` function (in `modules/team-tracker/server/index.js`) already attaches `teamId` to each team object when `teamDataSource === 'in-app'`. The roster response shape per team:

```js
// When teamDataSource === 'in-app':
{ displayName, members, metadata: { field_id: value }, teamId: "team_a1b2c3" }

// When teamDataSource === 'sheets':
{ displayName, members, metadata: {} }
// No teamId field
```

**However**, `useRoster.js`'s `buildTeam()` function (line 29-36) currently drops `teamId` — it only propagates `key`, `displayKey`, `displayName`, and `members`.

**Fix required**: Update `buildTeam()` in `shared/client/composables/useRoster.js` to pass through `teamId` and `metadata`:

```js
function buildTeam(org, teamName, team) {
  return {
    key: `${org.key}::${teamName}`,
    displayKey: org.displayName ? `${org.displayName}::${teamName}` : null,
    displayName: team.displayName,
    members: team.members,
    teamId: team.teamId || null,       // NEW — pass through structure team ID
    metadata: team.metadata || {}       // NEW — pass through team-level field values
  }
}
```

This eliminates the need for a separate `useTeams().fetchTeams()` call in TeamRosterView — the `teamId` and `metadata` are already available from the roster.

### `allPeople` for TeamAssignment

TeamAssignment's `allPeople` prop expects `Array<{ uid, name }>`. TeamRosterView already has access to `allTeams` from `useRoster()`. Derive `allPeople` by deduplicating members across all teams:

```js
const allPeople = computed(() => {
  const seen = new Set()
  const result = []
  for (const t of allTeams.value) {
    for (const m of t.members) {
      if (m.uid && !seen.has(m.uid)) {
        seen.add(m.uid)
        result.push({ uid: m.uid, name: m.name })
      }
    }
  }
  return result
})
```

### `teamDataSource` access

Available via `useRoster().rosterData.value.teamDataSource`. Each view that needs it reads it from the already-loaded roster data — no additional API call.

```js
const { rosterData } = useRoster()
const isInAppMode = computed(() => rosterData.value?.teamDataSource === 'in-app')
```

### Person field definitions

In PersonProfileView, get person-level field definitions from `useFieldDefinitions().definitions.value.personFields` (filtered to `visible && !deleted`). The `customFields` come from `rosterMember.value._appFields` (the registry's in-app field values, keyed by field ID — NOT `customFields` which uses human-readable Sheets keys).

### Permission gating

- **TeamAssignment / TeamFieldEditor on TeamRosterView**: Gate with `canEditTeam(team.teamId)` from `usePermissions()`. This checks `isAdmin` only (see `usePermissions.js:37-39`). Do NOT use `canEdit(uid)` — that's for person-level edits and checks person UIDs, not team IDs.
- **PersonFieldEditor on PersonProfileView**: Gate with `canEdit(person.uid)` — this checks admin OR managed UIDs.
- **"Manage Unassigned" button on TeamDirectoryView**: Gate with `isAdmin` from `usePermissions()`.

### Settings permission coverage

The SettingsView is only accessible to admins — `AppSidebar.vue:401` gates the Settings nav item behind `props.isAdmin`. This means all settings sub-tabs (Teams, Fields, Audit Log) inherit admin-only access without needing additional permission checks.

## Files to Modify

### 0. Pass through `teamId` and `metadata` in roster composable

**File: `shared/client/composables/useRoster.js`**

Update `buildTeam()` (line 29-36) to include `teamId` and `metadata` from the raw roster API response. See code snippet above. This is the prerequisite for #3 and #7.

### 1. New Route: `unassigned` view

**File: `modules/team-tracker/client/index.js`**

Add an internal route (no sidebar nav item — accessed via banner link):

```js
'unassigned': defineAsyncComponent(() => import('./components/UnassignedPeople.vue')),
```

### 2. Team Directory banner link

**File: `modules/team-tracker/client/views/TeamDirectoryView.vue`**

- In the existing amber unassigned-people banner (line 63-97), add a "Manage Unassigned" button
- Button calls `nav.navigateTo('unassigned')` to open the full UnassignedPeople view
- Gate the button with `isAdmin` from `usePermissions()` AND `isInAppMode` (only relevant in in-app mode)

### 3. Inline TeamAssignment on team detail

**File: `modules/team-tracker/client/views/TeamRosterView.vue`**

- Import `TeamAssignment` and `usePermissions`
- Read `teamId` directly from `team.value.teamId` (available after fix #0)
- Derive `allPeople` from `allTeams` by deduplicating members (see data-flow section)
- Add a collapsible "Manage Members" section after the tab panels
- **Gate on**: `isInAppMode && team.teamId && canEditTeam(team.teamId)`
- Pass `teamId` (= `team.teamId`), `teamName` (= `team.displayName`), `members` (= `uniqueMembers`), and `allPeople` as props
- Wire the `@updated` emit to call `reloadRoster()` to refresh team data

### 4. Inline PersonFieldEditor on person profile

**File: `modules/team-tracker/client/views/PersonProfileView.vue`**

- Import `PersonFieldEditor`, `useFieldDefinitions`, and `usePermissions`
- After the existing profile sections, add a "Custom Fields" section
- Pass `uid` (= `person.uid`), `customFields` (from `rosterMember._appFields || {}`), `fieldDefinitions` (from `useFieldDefinitions().definitions.value.personFields`), and `canEdit` (from `usePermissions().canEdit(person.uid)`) as props
- **Gate on**: `isInAppMode` AND `personFields` has visible, non-deleted entries

### 5. New Settings sub-tabs

**File: `modules/team-tracker/client/components/TeamTrackerSettings.vue`**

- Import `TeamManagement`, `FieldDefinitionManager`, `AuditLogView`
- Add 3 new entries to the `tabs` array:
  - `{ id: 'teams', label: 'Teams' }`
  - `{ id: 'fields', label: 'Fields' }`
  - `{ id: 'audit-log', label: 'Audit Log' }`
- Add conditional renders:
  - `<TeamManagement v-if="activeTab === 'teams'" />`
  - `<FieldDefinitionManager v-if="activeTab === 'fields'" />`
  - `<AuditLogView v-if="activeTab === 'audit-log'" />`
- No additional permission checks needed — SettingsView is already admin-gated via `AppSidebar.vue:401`

### 6. Team Data Source toggle + migration

**File: `modules/team-tracker/client/components/PeopleAndTeamsSettings.vue`**

- Add a toggle/radio at the top: "Team Data Source: Google Sheets (legacy) vs. In-App Management"
- Wire to the existing `teamDataSource` field in roster-sync config (already persisted as `"sheets"` or `"in-app"` in `data/team-data/config.json` — no backend changes needed)
- When "In-App" is selected, show a "Migrate from Sheets" button that calls `POST /api/modules/team-tracker/structure/migrate`
- **Migration warning**: The migrate button triggers a one-time data transition (Sheets team assignments → team-store). Add a confirmation dialog explaining that this creates in-app teams/assignments from current Sheets data. The operation is additive (creates team-store entries) but switching `teamDataSource` changes which data source is authoritative. The confirmation should make this clear.

### 7. TeamFieldEditor on team detail

**File: `modules/team-tracker/client/views/TeamRosterView.vue`** (same file as #3)

- Import `TeamFieldEditor` and `useFieldDefinitions`
- Add a "Team Fields" section in the team header area (below the existing PM/Eng Lead/Board metadata)
- Read `metadata` directly from `team.value.metadata` (available after fix #0)
- Pass `teamId` (= `team.teamId`), `metadata` (= `team.metadata`), `fieldDefinitions` (from `useFieldDefinitions().definitions.value.teamFields`), and `canEdit` (from `canEditTeam(team.teamId)`)
- **Gate on**: `isInAppMode && team.teamId` (same as #3)

## Files NOT Modified

- **`module.json`** — no new navItems needed (all new views are settings sub-tabs or internal routes)
- **`AppSidebar.vue`** — no changes (nav items come from module.json; admin gate already present)
- **`SettingsView.vue`** — no changes (already dynamically loads module settings components)
- No new wrapper/layout components needed — all existing components are self-contained

## Summary

| # | File | Change |
|---|------|--------|
| 0 | `shared/client/composables/useRoster.js` | Pass through `teamId` and `metadata` in `buildTeam()` |
| 1 | `modules/team-tracker/client/index.js` | Add `unassigned` route |
| 2 | `modules/team-tracker/client/views/TeamDirectoryView.vue` | Add "Manage Unassigned" button to banner |
| 3 | `modules/team-tracker/client/views/TeamRosterView.vue` | Add TeamAssignment + TeamFieldEditor sections |
| 4 | `modules/team-tracker/client/views/PersonProfileView.vue` | Add PersonFieldEditor section |
| 5 | `modules/team-tracker/client/components/TeamTrackerSettings.vue` | Add 3 sub-tabs (Teams, Fields, Audit Log) |
| 6 | `modules/team-tracker/client/components/PeopleAndTeamsSettings.vue` | Add data source toggle + migrate button |

## Complexity Assessment

This is a low-risk wiring task. All components are already built and self-contained. Each modification is additive (no existing behavior changes). The largest change is TeamRosterView which gets two new sections.

The key prerequisites are:
1. **useRoster.js fix** (#0) — must land first since #3 and #7 depend on `teamId` being available on team objects
2. **`teamDataSource` gating** — all in-app-only sections (#2, #3, #4, #7) are hidden in Sheets mode, preventing API mismatches
3. **Migration button** (#6) — the only operation with side effects; requires a confirmation dialog since it transitions data source authority
