# Implementation Plan: Team Structure Management

## Overview

This plan covers the implementation of 6 epics that make the app the source of truth for team structure data, replacing Google Sheets as the team/custom-field authority while keeping LDAP as the identity source of truth.

### Key Design Decisions (from requirements clarification)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sheets <-> App conflict | **Settings toggle** -- "Team data source" switch | Allows gradual migration; Sheets enrichment skipped when set to "in-app" |
| Team data model | **First-class teams** -- `data/team-data/teams.json` | Enables team-level metadata, creation/deletion, future features |
| Audit log storage | **Append-only JSON** -- `data/audit-log.json`, capped at 10,000 entries | Simple, matches existing storage patterns |
| Phasing | **All 6 epics in one phase** | Delivers complete feature set together |
| Manager scope | **LDAP subtree only** | Manager can edit anyone whose `managerUid` chain leads back to them, regardless of team org |
| Custom field scope | **Global** | Fields defined once, apply to all orgs/teams |
| Unassigned UX | **Both** -- virtual team in list + dedicated management view | Virtual team for visibility, dedicated view for bulk operations |
| Multi-team limit | **No limit** | No artificial cap on team assignments |

---

## Architecture

### Data Model Changes

#### New File: `data/team-data/teams.json`

First-class team definitions, keyed by auto-generated ID. This is a **new** storage file, separate from the existing `data/teams.json` used by sprint board configuration.

```json
{
  "teams": {
    "team_a1b2c3": {
      "id": "team_a1b2c3",
      "name": "Platform",
      "orgKey": "achen",
      "createdAt": "2026-04-20T12:00:00Z",
      "createdBy": "admin@redhat.com",
      "metadata": {
        "field_x1y2z3": "Alice Smith",
        "field_a2b3c4": "Q2 Focus"
      }
    }
  }
}
```

**Design notes:**
- Team IDs are stable slugs (`team_` + 6 random hex chars). Names can change; IDs cannot.
- On ID generation, check for collision against existing IDs and retry if needed.
- `orgKey` references the org root UID this team belongs to.
- `metadata` stores team-level custom field values, keyed by field definition ID.
- Stored at `data/team-data/teams.json` (NOT `data/teams.json`, which is the existing sprint board config).

#### New File: `data/team-data/field-definitions.json`

Global custom field definitions for both person-level and team-level fields.

```json
{
  "personFields": [
    {
      "id": "field_x1y2z3",
      "label": "Focus Area",
      "type": "free-text",
      "required": false,
      "visible": true,
      "primaryDisplay": false,
      "allowedValues": null,
      "deleted": false,
      "order": 0,
      "createdAt": "2026-04-20T12:00:00Z",
      "createdBy": "admin@redhat.com"
    },
    {
      "id": "field_d4e5f6",
      "label": "Engineering Lead",
      "type": "person-reference-linked",
      "required": false,
      "visible": true,
      "primaryDisplay": false,
      "allowedValues": null,
      "deleted": false,
      "order": 1,
      "createdAt": "2026-04-20T12:00:00Z",
      "createdBy": "admin@redhat.com"
    }
  ],
  "teamFields": [
    {
      "id": "field_g7h8i9",
      "label": "Product Manager",
      "type": "person-reference-unlinked",
      "required": false,
      "visible": true,
      "primaryDisplay": false,
      "allowedValues": null,
      "deleted": false,
      "order": 0,
      "createdAt": "2026-04-20T12:00:00Z",
      "createdBy": "admin@redhat.com"
    }
  ]
}
```

**Value types:**
- `free-text` -- arbitrary string
- `constrained` -- selection from `allowedValues` array
- `person-reference-linked` -- UID of a person in the roster (renders as clickable link)
- `person-reference-unlinked` -- free-text name (no link, for people outside the app)

#### Modified File: `data/team-data/registry.json`

Add person-level custom field values and team assignments (replacing `_teamGrouping`).

```json
{
  "people": {
    "jsmith": {
      "uid": "jsmith",
      "name": "Jane Smith",
      "teamIds": ["team_a1b2c3", "team_d4e5f6"],
      "_appFields": {
        "field_x1y2z3": "backend",
        "field_d4e5f6": "bsmith"
      },
      "_teamGrouping": "Platform",
      "...existing LDAP fields unchanged..."
    }
  }
}
```

**Changes to person records:**
- Add `teamIds` array (replaces `_teamGrouping` string when in-app mode)
- Add `_appFields` object for in-app custom field values -- **deliberately NOT named `customFields`** to avoid collision with the existing `customFields` key in `ENRICHMENT_FIELDS` (see Sync Protection section)
- `_teamGrouping` is **preserved** during migration for rollback safety (see Migration Path section)
- LDAP fields remain unchanged and read-only

#### New File: `data/audit-log.json`

```json
{
  "entries": [
    {
      "id": "evt_a1b2c3d4",
      "timestamp": "2026-04-20T12:00:00Z",
      "actor": "admin@redhat.com",
      "action": "person.team.assign",
      "entityType": "person",
      "entityId": "jsmith",
      "entityLabel": "Jane Smith",
      "field": "teamIds",
      "oldValue": ["team_a1b2c3"],
      "newValue": ["team_a1b2c3", "team_d4e5f6"],
      "detail": "Added to team 'Infrastructure'"
    }
  ],
  "maxEntries": 10000
}
```

**Performance note:** At 10K entries with detailed `oldValue`/`newValue` objects, this file will be ~3-5MB. The read-parse-append-write cycle is synchronous but acceptable given the low write frequency (admin/manager operations, not high-throughput). Burst editing (e.g., bulk assign of 20 people) writes a single audit entry per person -- at worst ~20 sequential writes. If this becomes a bottleneck, the `appendAuditEntry` function can buffer writes and flush periodically, or migrate to a jsonlines format (one JSON object per line, append-only without full file rewrite).

**Action types:**
- `person.team.assign`, `person.team.unassign`
- `person.field.update`
- `team.create`, `team.rename`, `team.delete`
- `field.create`, `field.update`, `field.delete`

#### Modified File: `data/team-data/config.json`

Add team data source toggle.

```json
{
  "teamDataSource": "sheets",
  "...existing config..."
}
```

Values: `"sheets"` (legacy, default) or `"in-app"`. When `"in-app"`, the sync pipeline skips Google Sheets enrichment for team assignments and custom fields.

**Implementation note:** `teamDataSource` will be added to the defaults in `config.js` `loadConfig()` and handled by `saveConfig()`. The existing migration logic in `loadConfig()` provides a pattern for this.

### LDAP-Protected Fields

The following fields are sourced from LDAP and cannot be edited in-app:

| Field | LDAP Attribute |
|-------|---------------|
| `uid` | `uid` |
| `name` | `cn` |
| `email` | `mail` |
| `title` | `title` |
| `city` | `l` |
| `country` | `co` |
| `geo` | `rhatGeo` |
| `location` | `rhatLocation` |
| `officeLocation` | `rhatOfficeLocation` |
| `costCenter` | `rhatCostCenter` |
| `managerUid` | `manager` (parsed) |

### Sync Protection: Preventing Data Clobbering (Critical)

The current sync pipeline (`consolidated-sync.js` lines 164-186) has a Phase 5 that:
1. **Clears** all `ENRICHMENT_FIELDS` on every merged registry person (line 174-177)
2. **Re-copies** enrichment values from the Sheets-enriched LDAP person (line 179-185)

The `ENRICHMENT_FIELDS` array (line 25-28) includes `customFields`, `_teamGrouping`, and other Sheets-derived fields.

**Key design decision: use `_appFields` instead of `customFields` for in-app data.**

The existing `customFields` key is already in `ENRICHMENT_FIELDS` and is used by `deriveRoster()` (line 154-163) to build `member.customFields` in the API response. Reusing this key would create an unresolvable conflict: Phase 5 would wipe in-app data on every sync.

Instead, in-app custom field values are stored under `_appFields` on person records. This key is:
- NOT in `ENRICHMENT_FIELDS`, so it survives sync Phase 5 untouched
- NOT referenced by existing code, so no collision risk
- Prefixed with `_` to signal it's an internal/app-managed field (matching `_teamGrouping` convention)

Similarly, `teamIds` is a new key not in `ENRICHMENT_FIELDS`, so it also survives sync unmodified.

**Protection approach:**

**A. Gate Sheets enrichment (Phase 3):** When `config.teamDataSource === 'in-app'`, skip the `fetchSheetData()` call and `enrichPerson()` loop entirely:

```javascript
// Phase 3: Sheets enrichment
if (config.teamDataSource !== 'in-app' && config.googleSheetId) {
  // ... existing fetchSheetData + enrichPerson calls ...
}
```

When in-app mode, Sheets enrichment is simply not run. LDAP fields still sync normally (Phase 2 + Phase 4).

**B. Phase 5 (enrichment copy) still runs** but only processes fields from `ENRICHMENT_FIELDS`. Since `teamIds` and `_appFields` are NOT in that list, they are neither cleared nor overwritten. No save/restore logic needed.

**C. `lifecycle.js` `mergePerson()`:** For **new** persons (line 20-48), the fixed-field constructor does NOT include `teamIds` or `_appFields`. This is **correct behavior** -- new LDAP arrivals start unassigned with no custom field values (they appear in the "unassigned" bucket). For existing persons (line 51+), `Object.assign({}, existing)` preserves all fields including `teamIds` and `_appFields`.

**D. API response compatibility:** `deriveRoster()` currently builds `member.customFields` from `teamStructure.customFields` config (reading person fields by key name like `specialty`, `jiraComponent`). In Sheets mode this continues unchanged. In in-app mode, `deriveRoster()` builds `member.customFields` from `_appFields` using the field definitions:

```javascript
// In-app mode: build customFields from _appFields + field definitions
if (teamDataSource === 'in-app') {
  for (const fieldDef of personFieldDefs) {
    memberEntry.customFields[fieldDef.id] = person._appFields?.[fieldDef.id] || null;
  }
}
```

**E. Frontend `customFields` key format change:** Currently the frontend accesses `member.customFields.specialty`, `member.customFields.component`, etc. using human-readable keys from the Sheets config. In in-app mode, the keys will be field definition IDs like `field_x1y2z3`. The existing frontend components (`PersonCard.vue:33`, `PersonTable.vue:34`, `TeamDeliveryTab.vue:228`) all use dynamic key access via `visibleFields` iteration:

```javascript
member.customFields[field.key]  // field.key changes from "specialty" to "field_x1y2z3"
```

These components iterate over `visibleFields` (derived from config) and use `field.key` dynamically -- they don't hardcode field names. The key format change is transparent to them. **However**, two components DO hardcode field names:
- `PersonProfileView.vue:40` -- `customFields?.component`
- `PersonProfileView.vue:44` -- `customFields?.engineeringSpeciality`
- `TeamMembersTable.vue:162` -- `customFields?.component`
- `TeamMembersTable.vue:158` -- `customFields?.status`

These hardcoded accesses must be migrated to use field definitions or guarded with `teamDataSource` checks. This is addressed in Step 4 (Frontend).

---

## API Routes

### New Endpoints

All new routes are mounted inside the team-tracker module router at `/api/modules/team-tracker/`.

**IMPORTANT -- Route collision avoidance:** The team-tracker module already has `GET /teams` (sprint board team config, `index.js:872`) and `POST /teams` (save sprint board config, `index.js:903`). These use `data/teams.json` and are completely unrelated to team structure management.

New team structure routes use the `/structure/teams` prefix to avoid collision:

#### RBAC & Permissions

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/modules/team-tracker/permissions/me` | auth | Returns current user's permission tier, managed UIDs (if manager), email |

#### Team Management (Epic 2)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/modules/team-tracker/structure/teams` | auth | List all teams (with optional `orgKey` filter) |
| POST | `/api/modules/team-tracker/structure/teams` | admin | Create a new team `{ name, orgKey }` |
| PATCH | `/api/modules/team-tracker/structure/teams/:teamId` | admin | Rename a team `{ name }` |
| DELETE | `/api/modules/team-tracker/structure/teams/:teamId` | admin | Delete a team (members become unassigned) |
| POST | `/api/modules/team-tracker/structure/teams/:teamId/members` | manager/admin | Assign person `{ uid }` |
| POST | `/api/modules/team-tracker/structure/teams/:teamId/members/bulk` | manager/admin | Bulk assign `{ uids: [...] }` -- all-or-nothing (see Bulk Assignment Permissions) |
| DELETE | `/api/modules/team-tracker/structure/teams/:teamId/members/:uid` | manager/admin | Unassign person |
| GET | `/api/modules/team-tracker/structure/unassigned` | auth | List unassigned people (query: `scope=direct\|org\|all`) |

#### Person Custom Fields (Epic 3)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/modules/team-tracker/structure/field-definitions` | auth | List all field definitions (person + team) |
| POST | `/api/modules/team-tracker/structure/field-definitions/person` | admin | Create person-level field |
| PATCH | `/api/modules/team-tracker/structure/field-definitions/person/:fieldId` | admin | Edit field definition |
| DELETE | `/api/modules/team-tracker/structure/field-definitions/person/:fieldId` | admin | Soft-delete field |
| POST | `/api/modules/team-tracker/structure/field-definitions/person/reorder` | admin | Reorder fields `{ orderedIds }` |
| PATCH | `/api/modules/team-tracker/structure/person/:uid/fields` | manager/admin | Update person field values `{ fieldId: value, ... }` |

#### Team Metadata Fields (Epic 4)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/modules/team-tracker/structure/field-definitions/team` | admin | Create team-level field |
| PATCH | `/api/modules/team-tracker/structure/field-definitions/team/:fieldId` | admin | Edit field definition |
| DELETE | `/api/modules/team-tracker/structure/field-definitions/team/:fieldId` | admin | Soft-delete field |
| POST | `/api/modules/team-tracker/structure/field-definitions/team/reorder` | admin | Reorder fields `{ orderedIds }` |
| PATCH | `/api/modules/team-tracker/structure/teams/:teamId/fields` | manager/admin | Update team field values `{ fieldId: value, ... }` |

#### Audit Log (Epic 5)

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/modules/team-tracker/structure/audit-log` | admin/manager | Query audit log (query: `from`, `to`, `action`, `actor`, `entityId`, `limit`, `offset`) |

### Modified Endpoints

| Method | Route | Change |
|--------|-------|--------|
| GET | `/api/roster` (legacy forward) | In-app mode: `member.customFields` keys change from human-readable (e.g., `specialty`) to field definition IDs (e.g., `field_x1y2z3`). Adds `team.metadata`, `roster.fieldDefinitions`, `roster.teamDataSource`, `roster.permissions`. In Sheets mode: no change. |
| GET | `/api/admin/roster-sync/config` | Response includes `teamDataSource` field |
| POST | `/api/admin/roster-sync/config` | Accepts `teamDataSource` field |

**Note on `member.customFields` key format:** This IS a breaking change for the in-app mode path. Existing frontend components that iterate over `visibleFields[].key` will work because the key comes from the field definitions (which change from config-based keys to definition IDs). Components that hardcode field names (`PersonProfileView.vue`, `TeamMembersTable.vue`) must be updated. The Sheets mode path is completely unaffected -- when `teamDataSource === "sheets"`, the response format is identical to today.

### Permission Middleware

New middleware factory in `modules/team-tracker/server/index.js`, using the shared `permissions.js` logic. The factory takes a **function** that extracts the target UID from the request at invocation time (not at registration time):

```javascript
// Factory takes a getter function, returns Express middleware
function requireManagerOrAdmin(getTargetUid) {
  return (req, res, next) => {
    if (req.isAdmin) return next();
    const targetUid = getTargetUid(req);
    if (!req.userUid) return res.status(403).json({ error: 'Cannot determine your identity' });
    const managed = permissions.getManagedUids(req.userUid, managerMap);
    if (managed.has(targetUid)) return next();
    return res.status(403).json({ error: 'Not authorized for this person' });
  };
}

// Usage:
router.patch('/structure/person/:uid/fields',
  requireManagerOrAdmin(req => req.params.uid),
  handleUpdatePersonFields
);

router.post('/structure/teams/:teamId/members',
  requireManagerOrAdmin(req => req.body.uid),
  handleAssignMember
);
```

**Manager detection:** At startup (and after each sync), build an in-memory map of UID -> set of managed UIDs by walking the `managerUid` chain in the registry. A person is a manager if any other person's `managerUid` equals their UID. Cache is invalidated on registry write.

**User UID resolution:** The auth middleware sets `req.userEmail`. To find the user's UID, look up the registry for a person with matching email. Store as `req.userUid`. **If no registry match is found** (e.g., an admin who is not an LDAP user, or `local-dev@redhat.com` in local dev), `req.userUid = null` and `req.permissionTier` is determined solely by admin status: `req.isAdmin ? 'admin' : 'user'`. Admins with `userUid = null` can still perform all admin operations. Manager-tier operations require a non-null `userUid` -- in local dev (where the user is always admin), this is not a limitation.

### Permission Model: Team Assignment (Detailed)

For `POST /api/modules/team-tracker/structure/teams/:teamId/members` (assigning a person to a team):

**Permission check: can the actor manage the TARGET PERSON?**
- Admin: always yes (even with `userUid = null`)
- Manager: yes if `targetUid` is in the actor's LDAP subtree (i.e., `managerMap.get(actorUid).has(targetUid)`)
- Regular user: never

The team's orgKey is NOT checked for permission. Per US-2.4 ("assign a person to a team within my org") and US-2.7 ("admin can cross-org assign"), the permission gate is on the person, not the team. A manager can assign their report to any team in any org. Cross-org assignment by non-admins is allowed as long as the person is in the manager's subtree.

**Rationale:** The LDAP subtree represents the manager's authority over *people*. Team membership is a property of the person, not the team. This avoids complex dual-permission checks and aligns with the user stories.

### Bulk Assignment Permissions

The bulk endpoint `POST /api/modules/team-tracker/structure/teams/:teamId/members/bulk` with body `{ uids: [...] }` cannot use the `requireManagerOrAdmin` middleware (which returns a single UID from a getter). Instead, it uses **all-or-nothing** semantics:

**Design:** The route handler (not middleware) checks permissions inline before performing any assignments:

```javascript
router.post('/structure/teams/:teamId/members/bulk', function(req, res) {
  const { uids } = req.body;
  if (!req.isAdmin) {
    if (!req.userUid) return res.status(403).json({ error: 'Cannot determine your identity' });
    const managed = permissions.getManagedUids(req.userUid, managerMap);
    const denied = uids.filter(uid => !managed.has(uid));
    if (denied.length > 0) {
      return res.status(403).json({
        error: 'Not authorized for all requested people',
        denied
      });
    }
  }
  // All UIDs authorized -- proceed with assignment
  const result = teamStore.assignMembersBulk(storage, teamId, uids, req.userEmail);
  res.json(result);
});
```

**Why all-or-nothing over partial success:**
- **Predictable UX:** The frontend's "assign selected" button either works completely or shows a clear error listing which people the manager can't assign. No ambiguity about what happened.
- **Simpler error handling:** Partial success requires the frontend to parse `{ assigned, denied }` and show per-person results. All-or-nothing uses a standard 403 with an actionable error message.
- **Matches user stories:** US-2.4 says a manager can assign people "within my org." If some UIDs are outside their subtree, the entire request is suspect -- better to reject and let them fix the selection.
- **The `denied` array** in the 403 response tells the frontend exactly which people to deselect, enabling a quick retry.

### Unassigned People Scope (US-2.9)

The `scope` query parameter on `GET /api/modules/team-tracker/structure/unassigned` supports three values:

| Scope | Filter | Available to |
|-------|--------|-------------|
| `direct` | People whose `managerUid === actorUid` (direct reports only) | Manager, Admin |
| `org` | People in the actor's full LDAP subtree (all transitive reports) | Manager, Admin |
| `all` | All people across all orgs | Admin only |

**Distinction between `direct` and `org`:** `direct` returns only people one level below the actor in the LDAP hierarchy. `org` returns the full transitive closure (the actor's complete subtree). This maps to the `managerMap` -- `direct` filters for `person.managerUid === actorUid`, while `org` uses the full `managedUids` set.

For regular users (non-managers), the endpoint returns an empty list (they have no management scope).

---

## Frontend Changes

### New Components

| Component | Location | Description |
|-----------|----------|-------------|
| `TeamManagement.vue` | `modules/team-tracker/client/components/` | Admin view for creating/renaming/deleting teams |
| `TeamAssignment.vue` | `modules/team-tracker/client/components/` | Drag-and-drop or select-based team member assignment |
| `UnassignedPeople.vue` | `modules/team-tracker/client/components/` | Dedicated unassigned people view with scope toggle and bulk assign |
| `FieldDefinitionManager.vue` | `modules/team-tracker/client/components/` | Admin UI for managing custom field definitions (person + team) |
| `PersonFieldEditor.vue` | `modules/team-tracker/client/components/` | Inline editing of person-level custom field values |
| `TeamFieldEditor.vue` | `modules/team-tracker/client/components/` | Inline editing of team-level metadata values |
| `AuditLogView.vue` | `modules/team-tracker/client/components/` | Audit log viewer with filters |
| `PersonReferenceField.vue` | `shared/client/components/` | Reusable component for person-reference fields (linked -> clickable, unlinked -> plain text) |
| `PermissionBadge.vue` | `shared/client/components/` | Small badge showing user's permission tier |

### Modified Components

| Component | Changes |
|-----------|---------|
| `PersonProfileView.vue` | Replace hardcoded `customFields?.component` and `customFields?.engineeringSpeciality` with dynamic field definition lookup. Guard with `teamDataSource` check for backward compat. |
| `TeamMembersTable.vue` | Replace hardcoded `customFields?.component` and `customFields?.status` with dynamic lookup. |
| `PersonCard.vue` | Already uses dynamic `visibleFields` -- no changes needed |
| `PersonTable.vue` | Already uses dynamic `visibleFields` -- no changes needed |
| Team detail view | Add team metadata display, edit controls for managers/admins |
| Team list view | Show "Unassigned" virtual team at bottom with count |
| Settings view | Add "Team Data Source" toggle, field definition management section |

### Demo Mode UX

In demo mode, write operations (team create, field edit, etc.) will return success responses but data will not persist (matching existing demo behavior for all write endpoints). The demo mode banner already warns that the app is in demo mode. **Additionally**, if the user is in demo mode and attempts an edit, the response will include a `demo: true` flag that the frontend can use to show a transient toast: "Demo mode -- changes are not saved." This prevents confusion from "successful" edits that disappear on refresh.

### New Composables

| Composable | Location | Description |
|------------|----------|-------------|
| `usePermissions` | `shared/client/composables/` | Reactive permission state: tier, managed UIDs, `canEdit(uid)`, `canEditTeam(teamId)` |
| `useTeams` | `shared/client/composables/` | CRUD operations for teams, team assignment |
| `useFieldDefinitions` | `shared/client/composables/` | CRUD for field definitions |
| `useAuditLog` | `modules/team-tracker/client/composables/` | Audit log fetching with filters |

### Modified Composables

| Composable | Changes |
|------------|---------|
| `useRoster` | Consume `teamIds` and structured custom fields from new data model |
| `useAuth` | Expose `permissionTier` alongside `isAdmin` |

---

## Backend Implementation

### New Server Modules

#### `shared/server/permissions.js`

Core permission logic, consumed by API route handlers.

```javascript
// Manager subtree computation
function buildManagerMap(registry) // -> Map<uid, Set<managedUids>>
function getManagedUids(managerUid, managerMap) // -> Set<uid>
function getDirectReports(managerUid, registry) // -> Set<uid> (managerUid === person.managerUid only)
function isManager(uid, registry) // -> boolean
function getPermissionTier(email, registry, isAdmin) // -> 'admin' | 'manager' | 'user'
function canEditPerson(actorUid, targetUid, isAdmin, managerMap) // -> boolean
```

#### `shared/server/audit-log.js`

Audit logging utility.

```javascript
function appendAuditEntry(storage, entry) // Appends to data/audit-log.json, enforces cap
function queryAuditLog(storage, filters) // -> { entries, total } // Filtered query with pagination
```

#### `shared/server/team-store.js`

Team CRUD operations with audit logging.

```javascript
function createTeam(storage, name, orgKey, actorEmail) // -> team
function renameTeam(storage, teamId, newName, actorEmail) // -> team
function deleteTeam(storage, teamId, actorEmail) // -> void (scans registry, removes teamId from all persons)
function assignMember(storage, teamId, uid, actorEmail) // -> void
function assignMembersBulk(storage, teamId, uids, actorEmail) // -> { assigned, skipped }
function unassignMember(storage, teamId, uid, actorEmail) // -> void
function getUnassigned(storage, scope, actorUid, isAdmin, managerMap, registry) // -> person[]
function updateTeamFields(storage, teamId, fields, actorEmail) // -> void
```

#### `shared/server/field-store.js`

Field definition and value CRUD with audit logging.

```javascript
function createFieldDefinition(storage, scope, definition, actorEmail) // -> field
function updateFieldDefinition(storage, scope, fieldId, updates, actorEmail) // -> field
function softDeleteField(storage, scope, fieldId, actorEmail) // -> void
function reorderFields(storage, scope, orderedIds, actorEmail) // -> void
function updatePersonFields(storage, uid, fieldValues, actorEmail) // -> void
```

### Modified Server Modules

#### `shared/server/roster-sync/consolidated-sync.js`

Detailed changes to protect in-app data during sync:

1. **Gate Sheets enrichment** (Phase 3): When `config.teamDataSource === 'in-app'`, skip the `fetchSheetData()` call and `enrichPerson()` loop entirely. LDAP fields still sync normally.

2. **Phase 5 is safe without modification**: Because in-app data uses `_appFields` (not `customFields`) and `teamIds` (not in `ENRICHMENT_FIELDS`), Phase 5's clear-and-recopy of `ENRICHMENT_FIELDS` does not touch in-app data. The `customFields` and `_teamGrouping` keys in `ENRICHMENT_FIELDS` only affect Sheets-derived data.

3. **Implementation order note**: The sync protection (Step 1 of Phase 3 gating) MUST be implemented in Step 2 alongside the data model, NOT deferred to Step 5. This prevents data loss during development.

#### `shared/server/roster-sync/lifecycle.js`

No changes needed. For new persons, `Object.assign`-based construction doesn't include `teamIds` or `_appFields` -- new LDAP arrivals correctly start unassigned. For existing persons, `Object.assign({}, existing)` preserves all fields.

#### `shared/server/roster-sync/config.js`

Add `teamDataSource` to config defaults (`"sheets"`) and ensure `loadConfig()`/`saveConfig()` handle it.

#### `shared/server/roster.js` (`readRosterFull`)

- Read `team-data/teams.json` and `team-data/field-definitions.json` alongside registry
- Build team membership from `teamIds` on person records (not `_teamGrouping`)
- Include team metadata and field definitions in the response

#### `modules/team-tracker/server/index.js`

- Register all new routes under `/structure/` prefix (avoids collision with existing `/teams` sprint board routes)
- When `teamDataSource === "in-app"`, modify `deriveRoster()` to:
  - Derive teams from `team-data/teams.json` + `teamIds` on persons
  - Build `member.customFields` from `_appFields` using field definitions
- When `teamDataSource === "sheets"` (legacy), `deriveRoster()` unchanged
- Build and maintain in-memory manager map (rebuilt on registry writes and at startup)

#### `shared/server/auth.js`

- Extend `authMiddleware` to resolve `req.userUid` from email -> registry lookup (null if not found)
- Add `req.permissionTier` ('admin', 'manager', 'user')
- In local dev, `local-dev@redhat.com` won't be in the registry, so `req.userUid = null`, `req.permissionTier = 'admin'` (because local dev user is always admin). All admin operations work; manager-specific UX (e.g., "my direct reports") will show empty results, which is expected.

### Migration Path: Sheets -> In-App

When an admin switches `teamDataSource` from `"sheets"` to `"in-app"`:

1. **Auto-migration** (one-time, on toggle): Read current `_teamGrouping` values from registry:
   - Split comma-separated values (e.g., "Platform, Infrastructure" -> ["Platform", "Infrastructure"])
   - Deduplicate team names (case-insensitive match, keep first-seen casing)
   - For each unique team name, determine `orgKey` from the first person with that `_teamGrouping` value (using their `orgRoot`)
   - If a team name appears in multiple orgs, create one team per org (with name suffixed by org display name if needed to disambiguate)
   - Skip the `_unassigned` virtual team (it's computed dynamically, not stored)
   - Create team records in `team-data/teams.json`, set `teamIds` on person records
2. **Migrate custom fields**: Convert `teamStructure.customFields` config entries into `field-definitions.json` entries, copy values from flat person fields (e.g., `person.specialty`) to `_appFields` map
3. **Preserve `_teamGrouping`**: Keep existing `_teamGrouping` values on all person records as read-only backup. This enables rollback: switching `teamDataSource` back to `"sheets"` will find `_teamGrouping` intact and `deriveRoster()` will use it as before.
4. **Mark as migrated**: Set a `_migratedToInApp` timestamp in config to prevent re-migration

This ensures no data loss when switching modes AND safe rollback.

---

## Data Flow Diagrams

### Current Flow (Sheets mode)
```
LDAP -> identity fields -> registry.json
Google Sheets -> _teamGrouping, custom fields -> registry.json
registry.json -> readRosterFull() -> deriveRoster() -> /api/roster
```

### New Flow (In-app mode)
```
LDAP -> identity fields -> registry.json (sync skips Sheets, preserves _appFields/teamIds)
team-data/teams.json -> team definitions (name, org, metadata)
team-data/field-definitions.json -> field schemas
registry.json (teamIds, _appFields) -> person assignments + field values
App edits -> team-store.js / field-store.js -> write to teams.json + registry.json + audit-log.json
registry.json + teams.json + field-definitions.json -> readRosterFull() -> deriveRoster() -> /api/roster
```

---

## Backward Compatibility Analysis

### API Response Changes

The `/api/roster` response behavior depends on `teamDataSource`:

**When `teamDataSource === "sheets"` (default):**
No changes to existing response format. All existing consumers continue to work.

**When `teamDataSource === "in-app"`:**

| Field | Current (Sheets) | In-App Mode |
|-------|---------|-------|
| `member.customFields` | Keys are human-readable (e.g., `specialty`) | Keys are field definition IDs (e.g., `field_x1y2z3`) -- **breaking change for hardcoded accessors** |
| `team.key` | `orgKey::teamName` | `orgKey::teamName` (unchanged) |
| `team.metadata` | Not present | New: object with team-level field values |
| `roster.fieldDefinitions` | Not present | New: `{ personFields, teamFields }` |
| `roster.teamDataSource` | Not present | New: `"in-app"` |
| `roster.permissions` | Not present | New: caller's permission tier and managed UIDs |

**Breaking change scope:** The `customFields` key format change only affects the in-app mode path. Components using dynamic `visibleFields` iteration (PersonCard, PersonTable, TeamDeliveryTab, OrgTeamCard) are unaffected because they read keys from the field definitions. Four hardcoded field accesses in PersonProfileView and TeamMembersTable must be updated (see Frontend Changes).

### Composite Key Stability

Team composite keys (`orgKey::teamName`) remain the format for snapshots, metrics, and URL params. When teams become first-class, the composite key is derived from `team.orgKey + "::" + team.name`. Renaming a team updates the composite key -- existing snapshots under the old key are preserved but won't link to the renamed team. This matches current behavior (renaming in Sheets has the same effect). Snapshot orphaning is documented behavior, not a bug -- users can delete all snapshots and regenerate if desired. The team rename audit log entry records both old and new names for traceability.

### Module API Stability

- All new routes are registered on the team-tracker module router under `/structure/` prefix
- No collision with existing `/teams` sprint board routes
- `shared/API.md` will be updated with new exports
- No changes to module system or module contract

### Demo Mode / Fixtures

- Add fixture files: `fixtures/team-data/teams.json`, `fixtures/team-data/field-definitions.json`, `fixtures/audit-log.json`
- Update `fixtures/team-data/registry.json` to include `teamIds`, `_appFields`, and ensure 2-level `managerUid` hierarchy for RBAC testing
- Update `fixtures/team-data/config.json` to include `teamDataSource: "in-app"` (so demo mode demonstrates the new features)
- `demo-storage.js` remains read-only -- in demo mode, write operations return success with `{ demo: true }` flag
- Frontend shows "Demo mode -- changes are not saved" toast on write operations

---

## Implementation Order

Even though all 6 epics are delivered together, implementation should proceed in dependency order:

### Step 1: Foundation + Sync Protection (Epic 6 + Epic 1 + Critical sync fix)
**LDAP Protection + RBAC + Sync gating**

1. Define `LDAP_FIELDS` constant (the protected field list)
2. Implement `shared/server/permissions.js` -- manager map, permission tier detection, authorization checks, `getDirectReports()` for the "direct" scope
3. Extend auth middleware with `req.userUid` and `req.permissionTier` (with null-UID fallback for non-registry users including local dev)
4. **Add `teamDataSource` to config defaults** and implement the Phase 3 gating in `consolidated-sync.js` (MUST happen before Step 2 to prevent sync from destroying in-app data during development)
5. Add `GET /api/modules/team-tracker/permissions/me` endpoint
6. Create `usePermissions` composable on frontend
7. Add `PermissionBadge.vue` component
8. **Tests:** Unit tests for manager subtree computation, direct reports, permission checks, null-UID admin scenario

### Step 2: Data Model (Epic 2 foundation + Epic 3 + Epic 4)
**Teams, Field Definitions, Storage**

1. Create `shared/server/team-store.js` -- team CRUD, member assignment, bulk assignment (reads/writes `team-data/teams.json`)
2. Create `shared/server/field-store.js` -- field definition CRUD, value updates (reads/writes `team-data/field-definitions.json`, updates `_appFields` on registry persons)
3. Create `shared/server/audit-log.js` -- append + query
4. Implement auto-migration logic (Sheets -> in-app)
5. **Tests:** Unit tests for all store operations, migration logic (including comma-separated teams, cross-org teams, deduplication), audit log cap enforcement

### Step 3: API Layer (All epics)
**REST Endpoints**

1. Register team management routes on module router under `/structure/teams/*`
2. Register field definition routes under `/structure/field-definitions/*`
3. Register person field update routes under `/structure/person/:uid/fields`
4. Register audit log route under `/structure/audit-log`
5. Add `requireManagerOrAdmin` middleware factory (getter-based, not static UID)
6. Modify `deriveRoster()` to support both data sources (dual path: Sheets keys vs field definition IDs)
7. Update `readRosterFull()` to include teams, field definitions, permissions
8. **Tests:** API route tests with mock auth (admin, manager, regular user, null-UID admin scenarios)

### Step 4: Frontend (All epics)
**UI Components and Views**

1. `TeamManagement.vue` -- team CRUD (admin)
2. `TeamAssignment.vue` -- assign/unassign members
3. `UnassignedPeople.vue` -- dedicated view with scope toggle (direct/org/all)
4. `FieldDefinitionManager.vue` -- field CRUD (admin)
5. `PersonFieldEditor.vue` -- inline field editing
6. `TeamFieldEditor.vue` -- inline team metadata editing
7. `PersonReferenceField.vue` -- linked/unlinked person references
8. `AuditLogView.vue` -- log viewer with filters
9. **Fix hardcoded field accesses** in `PersonProfileView.vue` and `TeamMembersTable.vue` -- migrate to dynamic field definition lookup
10. Modify team list -- add virtual "Unassigned" team
11. Modify Settings -- add team data source toggle, field management
12. Update `useRoster` to consume new data model
13. Add demo mode toast for write operations

### Step 5: Integration & Polish

1. Update fixture data for demo mode (including 2-level manager hierarchy, `_appFields`, `teamIds`)
2. Update `docs/DATA-FORMATS.md`
3. Update `.claude/CLAUDE.md` API routes section
4. Update `shared/API.md` with new exports
5. End-to-end testing

---

## Files to Be Modified

### New Files

| File | Description |
|------|-------------|
| `shared/server/permissions.js` | RBAC logic -- manager map, direct reports, permission checks |
| `shared/server/audit-log.js` | Audit log append/query |
| `shared/server/team-store.js` | Team CRUD + member assignment + bulk assign |
| `shared/server/field-store.js` | Field definition + value CRUD |
| `shared/client/composables/usePermissions.js` | Frontend permission state |
| `shared/client/composables/useTeams.js` | Frontend team CRUD |
| `shared/client/composables/useFieldDefinitions.js` | Frontend field definition CRUD |
| `shared/client/components/PersonReferenceField.vue` | Person reference renderer |
| `shared/client/components/PermissionBadge.vue` | Permission tier badge |
| `modules/team-tracker/client/composables/useAuditLog.js` | Audit log fetching |
| `modules/team-tracker/client/components/TeamManagement.vue` | Team CRUD UI |
| `modules/team-tracker/client/components/TeamAssignment.vue` | Member assignment UI |
| `modules/team-tracker/client/components/UnassignedPeople.vue` | Unassigned people view |
| `modules/team-tracker/client/components/FieldDefinitionManager.vue` | Field definition admin UI |
| `modules/team-tracker/client/components/PersonFieldEditor.vue` | Person field inline editor |
| `modules/team-tracker/client/components/TeamFieldEditor.vue` | Team metadata inline editor |
| `modules/team-tracker/client/components/AuditLogView.vue` | Audit log viewer |
| `fixtures/team-data/teams.json` | Demo team definitions |
| `fixtures/team-data/field-definitions.json` | Demo field definitions |
| `fixtures/audit-log.json` | Demo audit log |
| `shared/server/__tests__/permissions.test.js` | Permission logic tests |
| `shared/server/__tests__/team-store.test.js` | Team store tests |
| `shared/server/__tests__/field-store.test.js` | Field store tests |
| `shared/server/__tests__/audit-log.test.js` | Audit log tests |

### Modified Files

| File | Changes |
|------|---------|
| `shared/server/auth.js` | Add `req.userUid` resolution (null if not in registry), `req.permissionTier` |
| `shared/server/roster.js` | Read team-data/teams.json and team-data/field-definitions.json, build team membership from `teamIds` |
| `shared/server/roster-sync/consolidated-sync.js` | Gate Sheets enrichment (Phase 3) on `teamDataSource` |
| `shared/server/roster-sync/config.js` | Add `teamDataSource` to config defaults and save/load |
| `shared/server/demo-storage.js` | Add fixture paths for new data files |
| `shared/client/composables/useRoster.js` | Consume `teamIds`, structured custom fields, field definitions, permissions |
| `shared/client/composables/useAuth.js` | Expose `permissionTier` |
| `shared/client/index.js` | Export new composables and components |
| `modules/team-tracker/server/index.js` | Add `/structure/*` routes, modify `deriveRoster()` for dual data source, build/maintain in-memory manager map |
| `modules/team-tracker/client/views/PersonProfileView.vue` | Replace hardcoded `customFields?.component` and `customFields?.engineeringSpeciality` with dynamic lookup |
| `modules/team-tracker/client/components/TeamMembersTable.vue` | Replace hardcoded `customFields?.component` and `customFields?.status` with dynamic lookup |
| `modules/team-tracker/client/` (other views) | Add edit controls, field displays, permission checks |
| `fixtures/team-data/registry.json` | Add `teamIds`, `_appFields`, ensure 2-level `managerUid` hierarchy |
| `fixtures/team-data/config.json` | Add `teamDataSource` field |
| `shared/API.md` | Document new exports |
| `docs/DATA-FORMATS.md` | Document new data file schemas |
| `.claude/CLAUDE.md` | Add new API routes |

---

## Testability

### Local Development

- **Demo mode**: Fixtures include team/field/audit data with 2-level manager hierarchy for RBAC testing. Edit operations return success with `{ demo: true }` flag. Frontend shows toast indicating changes won't persist.
- **Full local dev**: `npm run dev:full` with `.env` configured. Local dev user is always admin (`userUid = null`, `permissionTier = 'admin'`). All admin operations work. Manager-specific views (direct reports, org scope) show empty results -- this is expected and documented. LDAP sync populates registry; toggle to "in-app" mode to test team management. Without LDAP access (no VPN), use demo mode.
- **Unit tests**: All new shared server modules have tests in `shared/server/__tests__/` (matching existing convention for auth.test.js, etc.). Run `npm test`.
- **Manual testing flow**:
  1. Start dev server, verify permission badge shows correct tier
  2. Create a team via `/structure/teams`, assign members, verify roster API response
  3. Create custom fields, set values, verify display
  4. Check audit log records changes
  5. Toggle data source, verify Sheets enrichment is skipped
  6. Run LDAP sync in in-app mode, verify `teamIds`/`_appFields` are preserved
  7. Test as non-admin user -- verify read-only behavior

### Preprod

- Deploy to preprod overlay (`:latest` images)
- Verify LDAP sync still works with `teamDataSource: "sheets"` (backward compat)
- Switch to `"in-app"`, verify auto-migration creates teams from `_teamGrouping` data (including comma-separated, cross-org cases)
- Run LDAP sync again, verify in-app data survives sync
- Test manager permissions with real LDAP hierarchy
- Verify audit log entries are created for all operations
- Test rollback: switch back to `"sheets"`, verify `_teamGrouping` is intact and teams render correctly

### Prod

- Deploy with `teamDataSource: "sheets"` (no behavior change)
- Admin switches to `"in-app"` when ready -- auto-migration runs
- Monitor audit log for unexpected changes
- Rollback: switch `teamDataSource` back to `"sheets"` (`_teamGrouping` preserved, roster reverts to Sheets-derived teams)

---

## Deployability

### CI/CD Impact

- **No new dependencies** -- all implementation uses existing packages (Express, filesystem, crypto)
- **No Dockerfile changes** -- new files are in `shared/` and `modules/`, already COPYed
- **No new environment variables** -- permission detection uses existing LDAP data
- **No new secrets** -- no external service integration
- **CI pipeline**: `ci.yml` change detection already covers `modules/`, `shared/`, `scripts/`
- **Image build**: `build-images.yml` triggers on `shared/` and `modules/` changes (already configured)
- **Kustomize overlays**: No changes needed -- no new ConfigMaps, no new PVC paths

### Data Migration

- **No manual migration steps**: New data files (`team-data/teams.json`, `team-data/field-definitions.json`, `audit-log.json`) are created on first use with empty defaults. Missing files return safe fallback values. The deployment uses the existing `Recreate` strategy (brief pod restart, same as all current deployments).
- **Backward compatible**: `teamDataSource` defaults to `"sheets"`, so existing deployments see no behavior change until an admin explicitly toggles.
- **Auto-migration**: When toggling to `"in-app"`, the migration is idempotent (checks `_migratedToInApp` timestamp).
- **Rollback safe**: `_teamGrouping` values preserved on person records during migration, enabling safe rollback to Sheets mode.

### Changeset Size

This feature touches ~40 files (24 new + 16 modified). To reduce deployment risk:
- Each implementation step is independently testable and deployable
- Steps 1-3 (backend) can be deployed without Steps 4-5 (frontend) -- new API routes are additive
- The `teamDataSource` toggle defaults to `"sheets"`, so deploying new code has zero user-visible impact until an admin enables in-app mode
- All changes are behind the feature toggle, enabling progressive rollout

---

## Architecture Decisions & Trade-offs

### 1. Team IDs vs Team Names
**Decision:** Teams get stable IDs (`team_` + 6 random hex chars, collision-checked on generation).
**Trade-off:** Composite keys (`orgKey::teamName`) are still used in URLs, snapshots, and metrics for backward compatibility. Team rename updates the composite key but old snapshots keep old keys. This matches current behavior with Sheets. Snapshot orphaning on rename is documented, not a bug -- recorded in audit log and users can regenerate.

### 2. Global vs Per-Org Custom Fields
**Decision:** Global field definitions.
**Trade-off:** Less flexible for orgs with different needs, but much simpler to implement and maintain. Per-org fields can be added later by adding an `orgKey` scope to field definitions.

### 3. Append-Only Audit Log vs Event Sourcing
**Decision:** Simple audit log for observability, not event sourcing.
**Trade-off:** No undo/rollback capability (per US-5.5). Capped at 10,000 entries to prevent unbounded growth. Read-parse-append-write is synchronous but acceptable at this scale (~3-5MB max, low write frequency). If performance becomes an issue, `appendAuditEntry` can be optimized to buffer/batch writes, or migrate to jsonlines format.

### 4. In-Memory Manager Map vs Per-Request Computation
**Decision:** Build manager subtree map at startup and after each sync, keep in memory.
**Trade-off:** Uses memory proportional to org size (negligible for typical orgs of <1000 people). Avoids O(n) traversal on every authorized request. Invalidated on registry changes.

### 5. Sheets Toggle vs Hard Removal
**Decision:** Settings toggle with auto-migration and rollback safety.
**Trade-off:** More code to maintain (dual paths in sync and derivation). But provides safety net for rollback and gradual adoption. The Sheets path can be deprecated and removed in a future release after confidence is established.

### 6. Storing Team Assignments on Person Records
**Decision:** `teamIds` array on person records in `registry.json`, with team definitions in separate `team-data/teams.json`.
**Trade-off:** Denormalized -- team membership is on the person, but team definitions are separate. This avoids a join but means team deletion must scan all persons to remove references. Acceptable for the data sizes involved (<1000 people).

### 7. Permission Gate on Person, Not Team
**Decision:** Team assignment permission checks the actor's authority over the target person, not the team's org.
**Trade-off:** A manager can assign their report to a team in a different org. This is intentional per US-2.7 (cross-org assignment). The alternative (dual permission check on person AND team) would be more restrictive but also more complex and harder to reason about.

### 8. Concurrent Writes
**Decision:** No optimistic concurrency control for MVP.
**Trade-off:** Simultaneous writes to the same JSON file could cause lost updates. This is acceptable because: (a) write operations are admin/manager-only, (b) simultaneous edits are extremely rare, (c) the existing storage layer has no locking for any data file. A TODO comment will note this for future consideration if multi-user editing becomes common.

### 9. Route Prefix: `/structure/` to Avoid Collision
**Decision:** All new team structure routes use `/structure/` prefix on the module router, separate from existing `/teams` sprint board routes.
**Trade-off:** Slightly longer URLs but avoids collision with existing `GET /teams` (sprint board config, `index.js:872`) and `POST /teams` (save sprint board config, `index.js:903`). Note: the existing legacy forward is `/api/team` (singular, `dev-server.js:704`), which maps to the module router's `/team` path -- it does NOT reach `/structure/teams`. No new legacy forwards are needed; the new routes are accessed at their canonical `/api/modules/team-tracker/structure/...` paths.

### 10. `_appFields` vs Reusing `customFields`
**Decision:** In-app custom field values stored under `_appFields` on person records, NOT `customFields`.
**Trade-off:** Introduces a new key name rather than reusing the existing one. But `customFields` is already in the `ENRICHMENT_FIELDS` array (consolidated-sync.js:27) and would be wiped on every sync run. Using a new key (`_appFields`) completely sidesteps the enrichment collision without needing complex save/restore logic in the sync pipeline.

### 11. Test File Placement
**Decision:** Tests for `shared/server/` modules go in `shared/server/__tests__/`, matching the existing convention (where `auth.test.js` and `auth-tokens.test.js` already live).
**Trade-off:** None -- this follows the established pattern rather than placing shared tests inside a module's test directory.
