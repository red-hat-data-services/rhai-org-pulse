# Team Field Migration & Boards as First-Class Property

## Overview

Three coordinated changes to the Sheets-to-In-App migration system:

1. **Scope toggle in migration modal** -- let users choose person vs team scope per field, with auto-detection heuristics.
2. **Team-scoped field migration execution** -- when a field is marked team-scope, create a team field definition and write rolled-up values into `team.metadata`.
3. **Boards as first-class team property** -- move board data out of `teams-metadata.json` and the custom field system into a dedicated `boards` array on each team record in `teams.json`.

---

## Requirements (from user answers)

| Question | Answer |
|----------|--------|
| Uniformity threshold | 80% of teams must show uniform values for the field to suggest team-scope |
| Scope granularity | Per field definition globally -- a field is either team or person everywhere |
| Non-uniform rollup | Store all distinct values (multi-value) on the team when values differ across members |
| Which fields | Auto-detect ALL custom fields; suggest team-scope for any passing the 80% threshold |
| Board migration trigger | Part of the existing Sheets-to-In-App migration flow (not separate) |
| Board editing UX | URL + optional manual display name; add/remove |

---

## Part 1: Migration Preview -- Scope Detection

### Backend: `previewMigration()` in `shared/server/team-migration.js`

Add a `suggestedScope` property to each field in the preview response. The detection algorithm:

**Prerequisite refactoring (M2):** Extract the team-building logic from `migrateToInApp()` (lines 203-221, which groups active people by `_teamGrouping` into `{ orgKey, name, uids }` entries) into a shared helper function:

```js
function buildTeamMap(registry) {
  // Returns Map<compositeKey, { name, orgKey, uids }> from _teamGrouping
}
```

Both `previewMigration()` and `migrateToInApp()` call this helper. This avoids duplicating the team grouping logic.

**Detection algorithm:**

1. Call `buildTeamMap(registry)` to get the team-to-members mapping.
2. For each custom field, iterate over teams:
   a. Collect the non-empty values for this field across the team's members.
   b. If no members have a value, exclude this team from the denominator.
   c. If all populated members share the same value, the team is "uniform."
   d. People on multiple teams (multi-team via comma-separated `_teamGrouping`) contribute to all their teams. **(m2)**
3. Calculate `uniformTeamPct = teamsWithUniformValue / teamsWithAnyValue * 100`.
4. If `uniformTeamPct >= 80`, set `suggestedScope: 'team'`; otherwise `suggestedScope: 'person'`.
5. Return `uniformTeamPct` in the preview so the UI can display it.

**Edge cases:**
- Teams with only one member are always "uniform" -- they count toward the percentage.
- People with no value for the field are excluded from the uniformity check for their team (they do not break uniformity).
- If a team has zero populated values for a field, that team is excluded from the denominator entirely.

**New fields in preview response per field:**

```js
{
  // ... existing fields ...
  suggestedScope: 'team' | 'person',  // NEW
  uniformTeamPct: 85,                  // NEW -- percentage of teams with uniform values
}
```

### Frontend: `MigrationFieldConfig.vue`

Add a scope toggle (segmented button or radio) per field card:

```
[Person Field] [Team Field]
```

- Default selection comes from `suggestedScope` in the preview response.
- When `suggestedScope === 'team'`, show a blue info badge: "80%+ of teams have uniform values -- suggested as team field".
- Display `uniformTeamPct` value so users can make informed decisions.
- The toggle adds `scope: 'person' | 'team'` to each entry in `fieldOverridesList`.
- When scope is `'team'` and multi-value is unchecked, show a subtle note: "Non-uniform teams will store multiple values automatically."
- **(m4):** Initialize `scope` in the `onMounted` override setup alongside `type` and `multiValue`:
  ```js
  overrides[field.key] = {
    type: field.suggestedType,
    multiValue: field.suggestedMultiValue,
    scope: field.suggestedScope || 'person'  // NEW
  }
  ```
  And include it in `fieldOverridesList` computed:
  ```js
  preview.value.fields.map(f => ({
    key: f.key,
    type: overrides[f.key]?.type || 'free-text',
    multiValue: overrides[f.key]?.multiValue || false,
    scope: overrides[f.key]?.scope || 'person'  // NEW
  }))
  ```

**Recommendation: assign a UX-focused teammate** for the Vue component changes in `MigrationFieldConfig.vue` and the board management section in `TeamRosterView.vue`. The scope toggle, board editor, and info badges require careful layout work.

### Files changed

| File | Change |
|------|--------|
| `shared/server/team-migration.js` | Extract `buildTeamMap()` helper; `previewMigration()` adds `suggestedScope`, `uniformTeamPct` |
| `modules/team-tracker/client/components/MigrationFieldConfig.vue` | Scope toggle UI, info badge, `scope` initialization in `onMounted`, emit scope in overrides |

---

## Part 2: Team-Scoped Field Migration Execution

### Prerequisite: Fix `createFieldDefinition()` multiValue bug (C1)

**`shared/server/field-store.js` line 140** silently discards `multiValue` for non-constrained types:

```js
// CURRENT (broken for person-reference-linked and free-text):
multiValue: fieldType === 'constrained' ? (definition.multiValue || false) : false,
```

This must be changed to allow `multiValue` on all field types:

```js
// FIXED:
multiValue: definition.multiValue || false,
```

Without this fix, the auto-promotion to multi-value for team-scoped `person-reference-linked` fields (the primary use case -- PM, engineering lead) will silently produce `multiValue: false` definitions, causing data loss when teams have multiple distinct values.

### Backend: `migrateToInApp()` in `shared/server/team-migration.js`

#### Batched I/O pattern (M1)

Currently `createTeam()` does a read-write-audit cycle per team (3 I/O ops each). For a 30-team org with team-scoped fields and boards, this produces 240+ sequential writes. The migration must use **batched in-memory mutation with a single write at the end**:

1. Read `teams.json` and `registry.json` once at the start of migration.
2. Build all team objects in memory (generate IDs, assign members, set metadata, copy boards).
3. Write `teams.json` once at the end.
4. Write `registry.json` once at the end.
5. Write `field-definitions.json` once at the end (accumulate all field defs in memory).
6. Batch all audit log entries and append them in a single call.

This means migration does NOT call `createTeam()` or `createFieldDefinition()` directly. Instead, it uses the same ID generation logic but mutates in-memory data structures, then writes once. The individual CRUD functions remain unchanged for non-migration use.

#### Team deduplication on retry (M6)

If migration fails partway through and is retried (the `_migratedToInApp` flag is only set after success), `createTeam()` generates random IDs with no name-based dedup, producing duplicate teams. The batched approach solves this naturally:

1. Before creating teams, check existing teams in `teams.json` for matching `orgKey + name` (case-insensitive).
2. If a match exists, reuse the existing team ID and merge members (additive).
3. Log a warning: "Team already exists, merging."

This makes retry safe without requiring cleanup.

#### Team name case sensitivity (M3)

The `buildTeamMap()` helper normalizes team names with `.toLowerCase()` for grouping keys, but the actual team name stored uses the original casing from the first person encountered. Board matching in Step 1.5 also uses case-insensitive comparison against `teams-metadata.json`:

```js
const metaKey = `${displayName}::${entry.name}`.toLowerCase();
// Match against: metaTeams entries normalized the same way
```

#### Field migration with scope support

Accept `scope` in each `fieldOverrides` entry: `{ key, type, multiValue, scope }`.

When `scope === 'team'`:
1. Create the field definition object in memory with `scope: 'team'` (will be written to `teamFields` in `field-definitions.json`).
2. For each team built in Step 1, compute the rolled-up value:
   - Collect all distinct non-empty values for this field across team members.
   - If exactly one distinct value: store as a single value.
   - If multiple distinct values: store as an array and force `multiValue: true` on the field definition.
   - If person-reference-linked: resolve names to UIDs via `resolvePersonNames()`, then deduplicate.
3. Write the value into `teamData.teams[teamId].metadata[field.id]` (in-memory mutation).
4. Do NOT write this field's values into person `_appFields` (it is a team field, not a person field).

When `scope === 'person'` (or absent): existing behavior, unchanged.

**Important:** The `multiValue` flag on the field definition must be set to `true` if the migration detects multiple distinct values across ANY team, even if the user did not check multi-value. This is an automatic promotion. The preview UI should note this: "Will become multi-value if any team has mixed values."

#### Stale person-level data cleanup (M4)

When a field is migrated as team-scope, the person records still contain the old flat field value (e.g., `person.productManager`). The migration should:

1. **NOT delete** the original flat field from person records. These values are the source data and may be needed if the admin wants to re-run migration or verify data.
2. **NOT write** to `person._appFields` for team-scoped fields.
3. The flat fields (e.g., `person.productManager`) are not rendered in the UI after migration -- the UI reads from `_appFields` (person scope) or `team.metadata` (team scope). So stale flat values are harmless.
4. Document this as a known behavior: "Original person-level values for team-scoped fields are preserved in the registry but not displayed. They can be cleaned up in a future maintenance task if desired."

### Data contract changes

The `fieldOverrides` array sent from the frontend to `POST /api/modules/team-tracker/structure/migrate` gains a new property:

```js
// Before
{ key: 'productManager', type: 'person-reference-linked', multiValue: true }

// After
{ key: 'productManager', type: 'person-reference-linked', multiValue: true, scope: 'team' }
```

The migration response gains an optional boards count:

```js
{ migrated: true, teams: 5, fields: 3, assignments: 42, boardsMigrated: 12 }
```

### Files changed

| File | Change |
|------|--------|
| `shared/server/field-store.js` | **(C1)** Fix line 140: allow `multiValue` on all field types, not just constrained |
| `shared/server/team-migration.js` | Extract `buildTeamMap()`; batched I/O in `migrateToInApp()`; `scope: 'team'` handling; dedup on retry; board migration |
| `modules/team-tracker/server/index.js` | **(C3)** Pass `scope` from request body through to `migrateToInApp()` (the migrate route lives here, not in a separate `structure.js`) |

---

## Part 3: Boards as First-Class Team Property

### 3a. Data model change: `teams.json`

Add a `boards` array to each team record:

```json
{
  "teams": {
    "team_a1b2c3": {
      "id": "team_a1b2c3",
      "name": "Platform",
      "orgKey": "achen",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "createdBy": "admin@example.com",
      "metadata": {},
      "boards": [
        { "url": "https://redhat.atlassian.net/jira/software/c/projects/RHOAIENG/boards/1103", "name": "RHOAIENG - Platform" },
        { "url": "https://redhat.atlassian.net/jira/software/c/projects/RHOAIENG/boards/1200", "name": "" }
      ]
    }
  }
}
```

Each board entry:
- `url` (string, required) -- the full Jira board URL.
- `name` (string, optional) -- user-provided display name. Empty string means "no name set."

### 3b. Migration: pull boards from `teams-metadata.json`

During `migrateToInApp()`, after creating teams (Step 1), add a new step:

**Step 1.5: Migrate boards**

1. Read `org-roster/teams-metadata.json`.
2. **(C2)** Use `getOrgDisplayNames(storage)` from `shared/server/roster-sync/config` to map `orgKey` (e.g., `"achen"`) to display name (e.g., `"Anderson Chen"`). The metadata file stores org as display names, but migration creates teams using `person.orgRoot` (raw LDAP key). The matching must bridge this gap:
   ```js
   const orgDisplayNames = getOrgDisplayNames(storage);
   // For each team entry { orgKey, name }:
   const displayName = orgDisplayNames[entry.orgKey] || entry.orgKey;
   // Match against metadata using case-insensitive comparison (M3):
   const metaMatch = metaTeams.find(mt =>
     mt.org.toLowerCase() === displayName.toLowerCase() &&
     mt.name.toLowerCase() === entry.name.toLowerCase()
   );
   ```
3. Copy `boardUrls` into the team's `boards` array as `{ url, name: boardNames[url] || '' }`.
4. Use `boardNames` from the metadata file for initial display names.

This happens automatically as part of the migration -- no user configuration needed. The migration response reports `boardsMigrated: N`.

### 3c. Team store changes: `shared/server/team-store.js`

Add board CRUD helpers:

```js
function updateTeamBoards(storage, teamId, boards, actorEmail)
```

- Validates each board entry has a `url` string.
- `name` defaults to empty string if absent.
- Overwrites the entire `boards` array (replace semantics, not patch).
- Audit logs the change.
- **(M5)** Concurrency note: This uses the same last-write-wins pattern as `updateTeamFields()`. Concurrent edits from two admins editing the same team's boards will result in the last save overwriting the first. This is a known limitation consistent with all other team mutations in the system. A future enhancement could add optimistic concurrency control (e.g., an `etag` or `version` field on the team record), but that is out of scope for this change.

Update `createTeam()` to initialize `boards: []` on new teams.

### 3d. API routes

**(C3)** All structure and migration routes live in `modules/team-tracker/server/index.js` (there is no separate `structure.js` file).

Add the boards endpoint there:

**`PATCH /api/modules/team-tracker/structure/teams/:teamId/boards`**
- Body: `{ boards: [{ url, name? }, ...] }`
- Auth: requireTeamAdmin (same as team field updates)
- **(m1)** Demo mode: include `demoWriteGuard(res)` check at the top of the handler, consistent with all other write routes.
- Calls `updateTeamBoards()`
- Returns: `{ boards: [...] }`

**(m5)** Justification for a separate PATCH endpoint rather than folding into the existing `PATCH /structure/teams/:teamId`: The existing team PATCH only handles `name` (rename). Boards are a distinct array with different validation (URL required, name optional) and different audit semantics. Combining them would complicate the handler and make it harder to reason about partial updates. The existing `PATCH .../teams/:teamId/fields` is already a separate endpoint for the same reason -- team field values are patched separately from the team record itself.

### 3e. Consumer changes: `buildEnrichedTeams()` in `org-teams.js`

Currently boards come from `teams-metadata.json`:

```js
const meta = metaByKey[compositeKey];
const teamBoardUrls = meta?.boardUrls || [];
const boards = teamBoardUrls.map(url => ({ url, name: boardNames[url] || null }));
```

Change to a priority cascade:
1. If the team has a `structureId` (i.e., it exists in `teams.json`) and has a `boards` array, read boards from `structure.boards`.
2. Otherwise fall back to `teams-metadata.json` (for teams not yet migrated).

```js
const structureTeam = structureByComposite[compositeKey];
let boards;
if (structureTeam && Array.isArray(structureTeam.boards)) {
  boards = structureTeam.boards;
} else {
  const meta = metaByKey[compositeKey];
  const teamBoardUrls = meta?.boardUrls || [];
  boards = teamBoardUrls.map(url => ({ url, name: boardNames[url] || null }));
}
```

This preserves backward compatibility: teams that haven't been migrated still get their boards from the old location.

### 3f. Sprint tracking: no changes required in this PR

The sprint tracking system (`orchestration.js`) has its own `teams.json` file (scoped to `sprint-data/teams.json` via the module's `readFromStorage` context) with sprint-specific fields (`boardId`, `sprintFilter`, `enabled`, `manuallyConfigured`, `stale`). These are fundamentally different from the org-roster team record's `boards` array.

**Rationale:** Sprint tracking boards are discovered via Jira API board search (project-level), have enable/disable toggles, staleness detection, and sprint filters. The team record boards are user-managed URLs. Unifying them would conflate two different concerns. A future enhancement could link them (e.g., "auto-populate sprint tracking from team boards"), but that is out of scope.

**(m3)** This disconnection between sprint tracking boards and team record boards should be documented in `docs/DATA-FORMATS.md` as a known limitation:

> **Note:** Sprint tracking boards (`sprint-data/teams.json`) and team record boards (`team-data/teams.json[].boards`) are separate data stores with different lifecycles. Sprint tracking boards are auto-discovered from Jira and include sprint-specific metadata (filters, staleness). Team record boards are user-managed URLs. A future enhancement may link these two systems.

### 3g. Frontend: Board management section in `TeamRosterView.vue`

Add a "Boards" section to the team detail header card (visible to managers/admins when `teamDataSource === 'in-app'`):

**Read-only mode (default):**
- Show board links as they appear today (unchanged from current rendering).

**Edit mode (toggle via pencil icon, same pattern as team field editing):**
- Each board entry shows:
  - URL input (text field, full width)
  - Name input (text field, optional, placeholder: "Display name (optional)")
  - Remove button (trash icon)
- "Add board" button at the bottom.
- Save/Cancel buttons.
- On save: `PATCH /api/modules/team-tracker/structure/teams/:teamId/boards` with the full boards array.

No URL validation beyond requiring a non-empty string. No automatic Jira API board name resolution (users set names manually).

### Files changed

| File | Change |
|------|--------|
| `shared/server/team-store.js` | Add `updateTeamBoards()`, init `boards: []` in `createTeam()` |
| `shared/server/team-migration.js` | Step 1.5: copy boards from metadata during migration with orgKey-to-displayName mapping **(C2)** and case-insensitive matching **(M3)** |
| `modules/team-tracker/server/routes/org-teams.js` | `buildEnrichedTeams()` reads boards from structure first |
| `modules/team-tracker/server/index.js` | **(C3)** New `PATCH .../structure/teams/:teamId/boards` route with demo mode guard **(m1)** |
| `modules/team-tracker/client/views/TeamRosterView.vue` | Board management edit section |
| `docs/DATA-FORMATS.md` | Document `boards` array on team records; document sprint tracking board disconnection **(m3)** |

---

## Affected APIs and Data Contracts

### API changes

| Endpoint | Change | Backward compatible? |
|----------|--------|---------------------|
| `GET /api/modules/team-tracker/structure/migrate/preview` | Response gains `suggestedScope`, `uniformTeamPct` per field | Yes (additive) |
| `POST /api/modules/team-tracker/structure/migrate` | Request body `fieldOverrides[].scope` (optional, defaults to `'person'`); response gains `boardsMigrated` | Yes (additive, defaults preserve old behavior) |
| `PATCH /api/modules/team-tracker/structure/teams/:teamId/boards` | **New endpoint** | N/A (new) |
| `GET /api/modules/team-tracker/org-teams` | Response `boards` array now sourced from structure for migrated teams | Yes (same shape) |
| `GET /api/modules/team-tracker/org-teams/:teamKey` | Same as above | Yes (same shape) |

### Data file changes

| File | Change | Backward compatible? |
|------|--------|---------------------|
| `data/team-data/teams.json` | Teams gain `boards: []` array | Yes (new field, consumers check existence) |
| `data/team-data/field-definitions.json` | `teamFields` array may now have entries created by migration | Yes (existing schema) |
| `data/org-roster/teams-metadata.json` | Unchanged (still written by org-sync for non-migrated setups) | Yes |

---

## Migration Idempotency

The existing `_migratedToInApp` flag in the config prevents re-running migration. This is sufficient.

**(M6)** If migration fails before setting `_migratedToInApp` and is retried, the batched migration uses `orgKey + name` deduplication to avoid creating duplicate teams. Existing teams are reused and members are merged additively.

For boards specifically: since boards are written to `teams.json` during migration and `buildEnrichedTeams()` uses the priority cascade (structure first, metadata fallback), there is no conflict. After migration, the structure record's boards are authoritative. The org-sync can still write to `teams-metadata.json` without causing issues -- that data is simply ignored for migrated teams.

---

## Implementation Order

### Phase 1: Backend foundations (no UI changes)
1. **(C1)** Fix `multiValue` bug in `shared/server/field-store.js` -- allow `multiValue` on all field types
2. Extract `buildTeamMap()` helper in `team-migration.js` **(M2)**
3. Add `boards: []` initialization to `createTeam()` in `team-store.js`
4. Add `updateTeamBoards()` to `team-store.js`
5. Refactor `migrateToInApp()` to use batched I/O **(M1)** with dedup **(M6)**
6. Add scope detection logic to `previewMigration()` in `team-migration.js`
7. Add team-scoped field handling to `migrateToInApp()` in `team-migration.js`
8. Add board migration (Step 1.5) to `migrateToInApp()` with orgKey mapping **(C2)** and case-insensitive matching **(M3)**
9. Add `PATCH .../boards` route in `modules/team-tracker/server/index.js` **(C3)** with demo guard **(m1)**
10. Update `buildEnrichedTeams()` priority cascade in `org-teams.js`

### Phase 2: Frontend (depends on Phase 1)
11. Scope toggle in `MigrationFieldConfig.vue` with `scope` initialization **(m4)**
12. Board management section in `TeamRosterView.vue`
13. Update `docs/DATA-FORMATS.md` including sprint tracking note **(m3)**

---

## Testability

### Unit tests

| Area | Test file | Cases |
|------|-----------|-------|
| `buildTeamMap()` | `shared/__tests__/team-migration.test.js` | Groups by _teamGrouping; handles multi-team people; skips inactive; skips _unassigned |
| Scope detection | `shared/__tests__/team-migration.test.js` | 100% uniform -> suggest team; 80% -> suggest team; 79% -> suggest person; single-member teams; empty fields excluded from denominator; multi-team people contribute to all teams |
| multiValue fix | `shared/__tests__/field-store.test.js` | `person-reference-linked` with `multiValue: true` preserves the flag; `free-text` with `multiValue: true` preserves it |
| Team field migration | `shared/__tests__/team-migration.test.js` | scope:'team' creates teamField def; rolls up uniform value as single; rolls up mixed values as multi-value array; person-reference resolution; does NOT write to _appFields; stale flat values preserved on person |
| Board migration | `shared/__tests__/team-migration.test.js` | copies boards from metadata; maps orgKey to display name for matching **(C2)**; case-insensitive matching **(M3)**; uses boardNames for display names; handles missing metadata gracefully; handles teams with no boards |
| Dedup on retry | `shared/__tests__/team-migration.test.js` | Existing team with same orgKey+name is reused; members merged additively; no duplicate team IDs |
| Batched I/O | `shared/__tests__/team-migration.test.js` | Storage write counts: exactly 1 write each for teams.json, registry.json, field-definitions.json |
| updateTeamBoards | `shared/__tests__/team-store.test.js` | Replaces boards array; validates url required; name defaults to ''; audit log entry |
| buildEnrichedTeams cascade | `modules/team-tracker/__tests__/server/org-teams.test.js` | Prefers structure boards; falls back to metadata boards; handles missing boards array |

### Integration / manual testing

1. Start with Sheets-based setup, trigger migration, verify:
   - Fields with 80%+ uniformity are suggested as team-scope
   - Overriding scope to team creates team field definitions (in `teamFields`, not `personFields`)
   - Rolled-up values appear in team metadata
   - Multi-value auto-promotion works for `person-reference-linked` fields **(C1 regression check)**
   - Boards appear on team records after migration
   - Original person flat field values are preserved but not displayed **(M4)**
2. Re-trigger migration (simulate retry) -- verify no duplicate teams **(M6)**
3. Edit boards via team detail UI, verify persistence
4. Verify sprint tracking continues to work (reads its own teams.json, unaffected)
5. Verify org-sync still runs without errors after migration
6. Demo mode: verify new PATCH boards route returns demo guard response **(m1)**

### Deployability

- **Zero-downtime:** All changes are additive. Existing `teams.json` files without `boards` arrays work fine (consumers default to `[]`). The `scope` field in migration overrides defaults to `'person'` if absent.
- **Rollback:** If the new code is reverted, teams created with `boards` arrays will simply have an unused property. Team fields created by migration remain in `field-definitions.json` and continue to work. The `multiValue` fix in `field-store.js` is a bug fix that is safe to keep even if other changes are reverted.
- **No data migration needed on deploy:** The `boards` array is only populated during user-triggered migration or manual board editing. Existing deployments are unaffected until an admin runs migration.

---

## Known Limitations

- **Last-write-wins on board updates (M5):** `updateTeamBoards()` uses replace semantics, same as `updateTeamFields()`. Concurrent edits from two admins will result in the last save winning. Consistent with all other team mutations in the system.
- **Sprint tracking boards are separate (m3):** Sprint tracking boards (`sprint-data/teams.json`) and team record boards (`team-data/teams.json[].boards`) are independent data stores. See DATA-FORMATS.md for details.
- **Stale person flat fields (M4):** Original person-level values for team-scoped fields are preserved in the registry after migration. They are not displayed in the UI and can be cleaned up in a future maintenance task.

## Out of Scope

- Automatic Jira board name resolution when adding boards in-app (user provides name manually)
- Unifying sprint tracking board config with team record boards
- Board URL validation (e.g., regex matching Jira patterns)
- Per-team scope overrides (scope is global per field definition)
- Optimistic concurrency control for team mutations
- Cleanup of stale person flat fields post-migration
