# Edit Big Rock: Enable Name and Pillar Editing

**Date:** 2026-06-10
**Status:** Draft (revised)
**Author:** Architect Agent
**Branch:** TBD (suggest `feat/edit-big-rock-name-pillar`)
**Revision:** v2 -- addresses 12 review findings (see Revision Log below)

---

## 1. Summary

Enable users to edit the **Name** and **Pillar** fields on existing Big Rocks
through the Edit Big Rock dialog. Currently, Name is read-only after creation
and Pillar is displayed as static text (only shown if already populated). This
plan makes both fields editable with appropriate validation, cache invalidation,
and rename propagation through the pipeline.

**Pillar** becomes a dropdown derived from the existing PM Hub pillar config
(`releases/pm-hub/pillar-config.json`), replacing the current free-text field.
The PM Hub already manages a structured pillar list with components, PM leads,
and eng leads via `PillarConfigPanel.vue` and GET/PUT endpoints at
`/api/modules/releases/pm-hub/pillar-config`. Rather than creating a second,
incompatible pillar store in the planning config, this plan derives pillar
names from that existing config to keep a single source of truth.

**Permissions:** Same as other editable fields -- anyone who can edit a Big Rock
can change its name and pillar. No new permission checks required.

---

## 2. Current State Analysis

### How Name Is Used

The Big Rock `name` field serves as the **primary key** across the system:

1. **Per-release data file** (`releases/planning/releases/{version}.json`):
   `bigRocks[].name` is the identifier. `saveBigRock()` in `config.js` finds
   the rock by `originalName` and overwrites it.

2. **Pipeline** (`pipeline.js`): Builds `rockSet` entries as
   `priority:name`. `mergeRockNames()` joins them into comma-separated
   `bigRock` strings on feature/RFE candidates (e.g., `"MaaS, Serving"`).

3. **Candidates cache** (`candidates-cache-{version}.json`): Features carry
   `bigRock: "RockA, RockB"` strings. The `bigRocks[]` array carries full
   rock objects with `name` as the key.

4. **Health aggregation** (`useHealthAggregation.js`): Splits
   `feature.bigRock` by `", "` and uses each rock name as a key in
   `rockHealth[rockName]` and `rockFeatures[rockName]`.

5. **Filters** (`useFilters.js`): Rock filter matches
   `feature.bigRock.split(', ')` against `selectedRock`. Pillar filter matches
   `bigRocks[].pillar`.

6. **Reorder** (`reorderBigRocks()` in `config.js`): Receives and validates
   an array of names, matches them against current rocks.

7. **Audit log**: Logs `rockName` in details.

8. **Health overrides** (`health-overrides-{version}.json`): Keyed by
   feature issue key, not by rock name -- **not affected** by rename.

9. **DoR state** (`dor-state-{version}.json`): Keyed by feature issue key
   -- **not affected** by rename.

### How Pillar Is Used

1. Stored as `bigRocks[].pillar` in the per-release file.
2. Collected into `filterOptions.pillars` by `buildCandidateResponse()`.
3. Used for pillar-based filtering in `useFilters.js`.
4. Displayed in the BigRocksTable Pillar column via `BigRockRow.vue`.
5. Currently a **free-text** field (validated only for max length of 100).

### Current Edit Dialog Behavior

- **Name**: Read-only `<p>` when editing (`v-if="!isNewRock"`), editable
  `<input>` only when creating a new rock.
- **Pillar**: Read-only `<p>` shown only when `formData.pillar` is truthy.
  Not editable in either create or edit mode.
- **Dirty tracking** (`useBigRockEditor.js`): The `isDirty` computed for
  edits only checks `owner`, `architect`, `outcomeKeys`, and `notes`. Name
  and pillar are excluded because they are not editable.

---

## 3. Detailed Implementation Plan

### Phase 1: Backend -- Pillar Options from PM Hub Config

**Goal:** Expose pillar names derived from the existing PM Hub pillar config
and validate Big Rock pillar values against them.

#### 3.1.1 No new config schema -- reuse PM Hub pillar config

The PM Hub already maintains a structured pillar configuration at
`releases/pm-hub/pillar-config.json` (managed via `PillarConfigPanel.vue`
in the Component Release Load Report). Each pillar has `name`, `components`,
`pmLead`, and `engLead` fields. This plan derives the allowed pillar names
from that existing config rather than creating a duplicate store.

No changes to `DEFAULT_CONFIG` in `config.js` are needed.

#### 3.1.2 API route for pillar options (read-only)

Add one read-only route in `routes.js`:

```
GET  /api/modules/releases/planning/pillar-options
```

- **GET**: Returns `{ options: string[] }`. Open to all authenticated users
  (`requireAuth`, `requireScope('releases:read')`). Reads from the PM Hub
  pillar config file (`releases/pm-hub/pillar-config.json`) and extracts
  pillar names:

```js
/**
 * @openapi
 * /api/modules/releases/planning/pillar-options:
 *   get:
 *     tags: [Releases]
 *     summary: Get allowed pillar values for Big Rock editing
 *     description: >
 *       Derives pillar names from the PM Hub pillar configuration.
 *       Returns an empty array if no pillar config exists.
 *     responses:
 *       200:
 *         description: Array of pillar name strings
 */
router.get('/pillar-options', requireAuth, requireScope('releases:read'), function(req, res) {
  var pillarConfig = readFromStorage('releases/pm-hub/pillar-config.json')
  var options = []
  if (pillarConfig && Array.isArray(pillarConfig.pillars)) {
    options = pillarConfig.pillars.map(function(p) { return p.name }).filter(Boolean)
  }
  res.json({ options: options })
})
```

No PUT endpoint is needed here. Pillar management remains in PM Hub's
existing `PillarConfigPanel.vue` and its PUT `/api/modules/releases/pm-hub/pillar-config`
endpoint (which already uses `requireScope('releases:write')`). This avoids
a duplicate management UI and keeps pillar names consistent across the
Component Release Load Report and Big Rock planning.

**Note:** The existing PM Hub PUT `/pillar-config` route does not use
`blockDuringImpersonation` middleware, unlike other destructive admin routes
(e.g., DELETE big-rock, DELETE release, POST import). This is a pre-existing
gap. As a cleanup item in this PR, add `blockDuringImpersonation` to the
PM Hub PUT route to match the pattern used by other write endpoints.

#### 3.1.3 Validation update

In `validation.js`, add optional `pillarOptions` to the validation context:

```js
function validateBigRock(data, options) {
  // ... existing validation ...

  // Pillar: if pillarOptions provided, validate against allowed values
  if (options.pillarOptions && options.pillarOptions.length > 0) {
    if (data.pillar && !options.pillarOptions.includes(data.pillar)) {
      errors.pillar = 'Pillar must be one of: ' + options.pillarOptions.join(', ')
    }
  }
}
```

This is additive -- callers that don't pass `pillarOptions` keep current
behavior (free-text). The route handlers for create/update will load the
PM Hub pillar config and pass the derived names to `validateBigRock()`.

#### 3.1.4 Doc import pillar validation

The `doc-import.js` `executeDocImport()` function (line 122) calls
`validateBigRock(rock, { existingNames })` without passing `pillarOptions`.
This means imported rocks with free-text pillars bypass pillar validation.

**Fix:** Load the PM Hub pillar config at the start of `executeDocImport()`
and pass `pillarOptions` to the validation call:

```js
var pillarConfig = readFromStorage('releases/pm-hub/pillar-config.json')
var pillarOptions = (pillarConfig && Array.isArray(pillarConfig.pillars))
  ? pillarConfig.pillars.map(function(p) { return p.name }).filter(Boolean)
  : []

// ... inside the loop:
const validation = validateBigRock(rock, {
  existingNames: Array.from(existingNames),
  pillarOptions: pillarOptions
})
```

When `pillarOptions` is empty (no PM Hub config exists), validation falls
back to accepting any value (current behavior). When options are configured,
imported rocks with invalid pillars will be reported in `validationErrors`
and skipped, matching the existing skip-on-validation-failure flow.

**Files modified:**

| File | Change |
|------|--------|
| `modules/releases/server/planning/validation.js` | Add optional pillar-against-options validation |
| `modules/releases/server/planning/routes.js` | Add GET pillar-options route (derived from PM Hub config); pass `pillarOptions` to `validateBigRock()` in create/update handlers |
| `modules/releases/server/planning/doc-import.js` | Pass `pillarOptions` to `validateBigRock()` during import |

### Phase 2: Backend -- Name Rename with Cache Invalidation

**Goal:** Allow the Big Rock name to change via the existing PUT endpoint,
with immediate cache invalidation.

#### 3.2.1 `saveBigRock()` already handles renames

Looking at `config.js` lines 110-157, `saveBigRock()` already accepts
`originalName` and writes `data.name` as the new name. When
`data.name !== originalName`, this is a rename. The function already:
- Finds the rock by `originalName`
- Overwrites `name` with `data.name.trim()`
- Writes the updated release file

**No changes needed to `saveBigRock()`.**

#### 3.2.2 Validation: uniqueness and comma check

`validateBigRock()` already checks name uniqueness:
```js
const isDuplicate = existingNames.some(function(n) {
  return n === name && n !== originalName
})
```

When renaming, `originalName` is the old name, so the old name is excluded
from the duplicate check. If the new name collides with another rock, the
error is surfaced. **Per-release uniqueness is sufficient** (no cross-release
check needed).

**New: reject commas in rock names.** The pipeline uses `", "` (comma-space)
as a delimiter when joining multiple rock names into `feature.bigRock`
strings (`pipeline.js:174 mergeRockNames()`). Downstream consumers —
`useHealthAggregation.js` (line 100), `useFilters.js` (line 37), and sort
logic in `pipeline.js` (line 191) — all split on `", "` to recover
individual rock names. A rock name containing a comma (e.g.,
`"Inference, Training"`) would corrupt every consumer.

Add a comma check to `validateBigRock()` in the name validation block:

```js
} else if (name.includes(',')) {
  errors.name = 'Name cannot contain commas (commas are used as delimiters in the pipeline)'
}
```

This check applies to both create and rename. The existing pillar options
validation (Phase 1) should also reject commas in pillar option values for
consistency, though pillars are not used as delimiters today.

**Files modified:**

| File | Change |
|------|--------|
| `modules/releases/server/planning/validation.js` | Add comma rejection for name field |

#### 3.2.3 Cache invalidation on rename

The existing `invalidateCache(version)` function in `routes.js` (line 481)
already:
1. Deletes all health phase caches
2. Deletes the outcome summaries cache
3. Marks the candidates cache as invalidated (`_invalidatedAt`)
4. Triggers a background refresh

This is called after every Big Rock save. On rename, the background refresh
re-runs `runPipeline()` which rebuilds all `bigRock` strings on features
from the updated rock names. The health pipeline then rebuilds from the
refreshed candidates cache.

**No additional cache invalidation logic is needed** -- the existing
`invalidateCache()` already covers the rename case because it invalidates
all caches and triggers a full pipeline refresh.

#### 3.2.4 Route handler adjustments

The PUT handler (`/releases/:version/big-rocks/:name`) already passes
`originalName` (decoded from the URL path) and `req.body` (which contains
the new name). The audit log already captures the old name in `summary` and
the field diff via `computeFieldDiff()`.

One small enhancement: when a rename occurs, the audit log `summary` should
explicitly note it. (The existing `@openapi` annotation on the PUT route
already documents the `name` body field, so no annotation update is needed
for the rename behavior -- it was always part of the contract.)

```js
var isRename = req.body.name && req.body.name.trim() !== name
logAudit(readFromStorage, writeToStorage, {
  version: version,
  action: 'update_rock',
  user: req.auditActor || req.userEmail,
  summary: isRename
    ? 'Renamed Big Rock "' + name + '" to "' + req.body.name.trim() + '"'
    : 'Updated Big Rock "' + name + '"',
  details: { rockName: name, newName: isRename ? req.body.name.trim() : undefined, changes: computeFieldDiff(existingRockSnapshot, req.body) }
})
```

**Files modified:**

| File | Change |
|------|--------|
| `modules/releases/server/planning/routes.js` | Enhance audit log message for renames |

### Phase 3: Frontend -- Make Name and Pillar Editable

**Goal:** Update the Edit Big Rock dialog to allow editing Name (text input)
and Pillar (dropdown select).

#### 3.3.1 `useBigRockEditor.js` changes

1. **Add `pillarOptions` ref** to the composable (loaded from API). This
   must be a **module-level singleton ref** (declared outside the
   `useBigRockEditor()` function, alongside `isOpen`, `editingRock`, etc.
   at lines 7-12) to match the existing singleton pattern. All consumers
   that call `useBigRockEditor()` share the same refs:

```js
// Module-level singleton (outside useBigRockEditor function)
const pillarOptions = ref([])

// Inside useBigRockEditor():
async function loadPillarOptions() {
  try {
    const data = await apiRequest(API_BASE + '/pillar-options')
    pillarOptions.value = data.options || []
  } catch {
    pillarOptions.value = []
  }
}
```

2. **Update `isDirty` computed** to include `name`, `fullName`, and `pillar`:

The existing `isDirty` for edits only checks `owner`, `architect`,
`outcomeKeys`, and `notes`. This is a pre-existing gap: `fullName` is
editable in the form but not tracked for dirty state, meaning changes
to `fullName` alone don't enable the Save button or trigger the unsaved-
changes prompt. This plan fixes the gap by including all editable fields:

```js
// Editing existing -- dirty if any field differs from original
const orig = editingRock.value
return formData.value.name !== (orig.name || '') ||
  formData.value.fullName !== (orig.fullName || '') ||
  formData.value.pillar !== (orig.pillar || '') ||
  formData.value.owner !== (orig.owner || '') ||
  // ... rest unchanged
```

3. **Export** `pillarOptions` and `loadPillarOptions` from the composable.

#### 3.3.2 `BigRockEditPanel.vue` changes

1. **Name field**: Remove the `v-if="!isNewRock"` read-only block. Make the
   text input appear in both create and edit modes. When editing, pre-fill
   with the existing name. Add a helper note: "Renaming will trigger a data
   refresh."

2. **Pillar field**: Replace the static `<p>` with a `<select>` dropdown:

```html
<div>
  <label for="rock-pillar" class="...">Pillar</label>
  <select
    id="rock-pillar"
    v-model="formData.pillar"
    class="w-full px-3 py-2 border rounded-md text-sm ..."
    :class="fieldErrors.pillar ? 'border-red-300' : 'border-gray-300'"
  >
    <option value="">-- Select pillar --</option>
    <option v-for="p in pillarOptions" :key="p" :value="p">{{ p }}</option>
  </select>
  <p v-if="fieldErrors.pillar" class="mt-1 text-xs text-red-600">
    {{ fieldErrors.pillar }}
  </p>
</div>
```

When `pillarOptions` is empty (no options configured by admin), fall back to
a free-text input to maintain backward compatibility.

3. **Pillar field in "add new" mode**: Same dropdown, allowing users to
   select a pillar when creating a Big Rock.

#### 3.3.3 `DashboardView.vue` changes

1. **Load pillar options on mount**: Call `loadPillarOptions()` alongside
   `loadPermissions()` and `loadReleases()` in `onMounted`.

2. **After save, handle name change**: When a save completes with a
   renamed Big Rock, the `updateBigRocksInPlace(result.bigRocks)` call
   already replaces the entire bigRocks array, so the table updates
   immediately. The background refresh (triggered by cache invalidation)
   will update the feature `bigRock` strings in the candidates cache.

**Files modified:**

| File | Change |
|------|--------|
| `modules/releases/client/plan/composables/useBigRockEditor.js` | Add `pillarOptions` ref, `loadPillarOptions()`, update `isDirty` |
| `modules/releases/client/plan/components/BigRockEditPanel.vue` | Make Name editable, replace Pillar with dropdown |
| `modules/releases/client/plan/views/DashboardView.vue` | Load pillar options on mount |

### Phase 4: Frontend -- Pillar Management (No New UI Needed)

**Goal (revised):** Pillar management is already handled by the PM Hub's
`PillarConfigPanel.vue` component, embedded in the Component Release Load
Report view (`ComponentReleaseLoadReport.vue`, line 327). Admins can add,
remove, and reorder pillars with their component mappings there.

No changes to `ReleasesSettings.vue` are needed for pillar management.
`ReleasesSettings.vue` currently contains only data refresh controls
(execution, delivery, hygiene domain refresh triggers) -- it has no
planning config sections and adding pillar management there would be
inconsistent with where the config is actually stored.

**If we want a cross-link for discoverability:** Add a brief note to the
Planning Dashboard's admin area (or the Big Rock edit panel's pillar
dropdown) that links to the Component Release Load Report for pillar
configuration. This is a low-effort UX enhancement that can be added
during implementation if deemed useful.

**Files modified:**

| File | Change |
|------|--------|
| _(none -- Phase 4 is eliminated)_ | Pillar management already exists in PM Hub |

### Phase 5: Tests

#### 3.5.1 Backend unit tests

1. **`config.test.js`** or new `config-rename.test.js`: Test `saveBigRock()`
   with a name change -- verify the rock is renamed in the data, old name is
   gone, new name is present, other rocks are unaffected.

2. **`validation.test.js`**: Test pillar validation against allowed options --
   valid pillar passes, invalid pillar fails, empty pillar with options
   passes (pillar is optional), empty options list allows any value.

3. **`routes.test.js`**: Test the new pillar-options GET route -- returns
   pillar names derived from PM Hub config, returns empty array when no
   PM Hub config exists, requires authentication and `releases:read` scope.
   Test comma rejection in create/update big rock routes.

4. **`invalidate-cache.test.js`**: Verify cache invalidation fires on
   rename (existing test coverage should already cover this since the
   route handler calls `invalidateCache()` after every save).

#### 3.5.2 Frontend unit tests

1. **`use-big-rock-editor.test.js`**: Test dirty tracking includes name,
   fullName, and pillar. Test `pillarOptions` ref loads and is accessible.

2. **`big-rock-edit-panel.test.js`**:
   - **Update existing tests that assert name is read-only.** The test
     `'shows rock name as read-only'` (line 67-73) asserts that `#rock-name`
     input does not exist in edit mode. This must be changed to assert that
     `#rock-name` input **does** exist and is pre-filled with the rock name.
   - **Update existing test `'shows pillar as read-only when present'`**
     (line 76-79). This must be changed to assert that a `<select>` dropdown
     renders with the pillar pre-selected (when `pillarOptions` are provided).
   - **Add new tests:** Name input is editable in edit mode. Pillar renders
     as dropdown when options available, falls back to text input when empty.
     Validation error display for pillar. Rename helper text appears when
     name is changed.

#### 3.5.3 Demo mode fixture update

The planning config fixture (`fixtures/releases/planning/config.json`)
currently has no `pillarOptions` field (because we now derive pillars from
PM Hub). However, the PM Hub pillar config fixture must exist for demo mode
to work. Verify that `fixtures/releases/pm-hub/pillar-config.json` exists
and contains pillar entries. If it doesn't exist, create it with the default
pillar config (matching `DEFAULT_PILLAR_CONFIG` in `pm-hub/routes.js`) so
the pillar dropdown populates correctly in demo mode.

**Files modified:**

| File | Change |
|------|--------|
| `fixtures/releases/pm-hub/pillar-config.json` | Verify/create fixture for demo mode pillar dropdown |

#### 3.5.4 Integration tests

The existing releases integration tests (`tests/integration/releases.spec.js`)
should be extended to verify the edit dialog shows editable name and pillar
fields.

**Files modified:**

| File | Change |
|------|--------|
| `modules/releases/__tests__/server/planning/config-crud.test.js` | Add rename test cases |
| `modules/releases/__tests__/server/planning/validation.test.js` | Add pillar options validation tests |
| `modules/releases/__tests__/server/planning/routes.test.js` | Add pillar-options route tests |
| `modules/releases/__tests__/client/plan/use-big-rock-editor.test.js` | Add dirty tracking + pillar options tests |
| `modules/releases/__tests__/client/plan/big-rock-edit-panel.test.js` | Add name/pillar editability tests |

---

## 4. Files Modified (Complete)

| File | Phase | Change |
|------|-------|--------|
| `modules/releases/server/planning/validation.js` | 1, 2 | Add comma rejection for name; add optional pillar-against-options validation |
| `modules/releases/server/planning/routes.js` | 1, 2 | Add GET pillar-options route (derived from PM Hub config); pass `pillarOptions` to `validateBigRock()` in create/update handlers; enhance rename audit log |
| `modules/releases/server/planning/doc-import.js` | 1 | Pass `pillarOptions` to `validateBigRock()` during import |
| `modules/releases/server/pm-hub/routes.js` | 1 | Add `blockDuringImpersonation` to PUT `/pillar-config` route |
| `modules/releases/client/plan/composables/useBigRockEditor.js` | 3 | Add module-level `pillarOptions` singleton ref, `loadPillarOptions()`, update `isDirty` to include `name`, `fullName`, and `pillar` |
| `modules/releases/client/plan/components/BigRockEditPanel.vue` | 3 | Make Name editable in edit mode, Pillar as dropdown, rename toast message |
| `modules/releases/client/plan/views/DashboardView.vue` | 3 | Load pillar options on mount, show toast after rename |
| `fixtures/releases/pm-hub/pillar-config.json` | 5 | Verify/create fixture for demo mode pillar dropdown |
| `modules/releases/__tests__/server/planning/config-crud.test.js` | 5 | Rename test cases |
| `modules/releases/__tests__/server/planning/validation.test.js` | 5 | Pillar validation + comma rejection tests |
| `modules/releases/__tests__/server/planning/routes.test.js` | 5 | Pillar-options route tests |
| `modules/releases/__tests__/client/plan/use-big-rock-editor.test.js` | 5 | Dirty tracking (name, fullName, pillar) + pillar options tests |
| `modules/releases/__tests__/client/plan/big-rock-edit-panel.test.js` | 5 | **Update** existing read-only assertions (lines 67-79); add name/pillar editability tests |

---

## 5. API / Interface Changes

All changes are **backward compatible**:

### New endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/modules/releases/planning/pillar-options` | `requireAuth`, `requireScope('releases:read')` | Returns `{ options: string[] }` derived from PM Hub pillar config |

Note: No PUT endpoint is added. Pillar management uses the existing PM Hub
endpoint `PUT /api/modules/releases/pm-hub/pillar-config`.

### Existing endpoint changes

**PUT `/api/modules/releases/planning/releases/{version}/big-rocks/{name}`**
- **No contract change.** The endpoint already accepts `name` in the request
  body and `originalName` in the URL path. When `body.name !== URL.name`,
  a rename occurs. This was always technically possible but the UI did not
  expose it.

**POST `/api/modules/releases/planning/releases/{version}/big-rocks`**
- **No contract change.** Pillar validation becomes stricter only when
  `pillarOptions` is configured. When empty, any value is accepted
  (current behavior preserved).

### Config schema

No changes to `releases/planning/config.json`. Pillar options are derived
at read time from the existing `releases/pm-hub/pillar-config.json`.

---

## 6. Testability

### Unit test strategy

- **Backend rename**: Create a release with rocks A and B. Rename A to C.
  Verify C exists, A does not, B is unchanged. Attempt rename A to B
  (duplicate) -- expect validation error.
- **Backend comma rejection**: Attempt to create/rename a rock with name
  `"Inference, Training"` -- expect validation error. Attempt with name
  `"Inference"` (no comma) -- passes.
- **Backend pillar validation**: Configure `pillarOptions: ["X", "Y"]`.
  Save with `pillar: "X"` -- passes. Save with `pillar: "Z"` -- fails.
  Save with `pillar: ""` -- passes (optional). No options configured --
  any value passes.
- **Backend doc import pillar validation**: Import a doc with rocks that
  have pillar values. With `pillarOptions` configured, invalid pillars
  are skipped with validation errors. Without options, all values pass.
- **Frontend dirty tracking**: Open edit panel with rock
  `{ name: "A", fullName: "Full A", pillar: "X" }`. Change name to "B" --
  `isDirty` is true. Revert to "A" -- `isDirty` is false. Same for
  fullName and pillar.
- **Frontend dropdown**: Mount `BigRockEditPanel` with `pillarOptions: ["X", "Y"]`.
  Verify `<select>` renders with 2 options + placeholder. Mount with
  `pillarOptions: []` -- verify text input fallback.

### Manual testing

1. Start dev server (`npm run dev:full`).
2. Create a release with 2+ Big Rocks.
3. Open Edit dialog on a rock -- verify Name is editable and Pillar shows
   a dropdown (populated from PM Hub pillar config).
4. Rename a rock and save -- verify table updates immediately, toast message
   appears, audit log shows rename, background refresh runs, health data
   reappears after refresh completes.
5. Set pillar from dropdown -- verify it persists on reload.
6. Attempt to enter a name containing a comma -- verify validation rejects it.
7. Go to Component Release Load Report > Pillar Config Panel -- add a new
   pillar. Return to Planning dashboard, open Edit dialog -- verify the new
   pillar appears in the dropdown.

---

## 7. Deployability

### Rollout risk: Low

- **No database migration.** No new config schema fields. Pillar options
  are derived from the existing PM Hub config at read time.
- **No breaking API changes.** The PUT endpoint already supports name
  changes; the UI simply did not expose it.
- **No new environment variables or secrets.**
- **Feature flag:** Not needed. The pillar dropdown gracefully degrades to
  free-text when no PM Hub pillar config exists, so deployment is safe.

### Deployment sequence

1. Deploy backend (new route, validation changes).
2. Deploy frontend (edit dialog changes).

No coordinated rollout required. Steps 1 and 2 can ship in a single PR.
If PM Hub pillar config is already populated (it is in production), the
dropdown works immediately. If not, the free-text fallback activates.

---

## 8. Edge Cases and Error Handling

### Name rename

| Edge case | Handling |
|-----------|----------|
| Rename to a name that already exists in the release | Validation rejects with `"A Big Rock named 'X' already exists in this release"`. Surfaced as field error on the name input. |
| Rename to the same name (no-op) | `saveBigRock()` writes unchanged data. No error. Cache invalidation still fires (idempotent). |
| Rename while another user has stale data | The reorder endpoint validates against current names. A stale reorder will fail with a 409 containing current names. The user refreshes and retries. |
| Rename a rock referenced by features in cache | Cache invalidation + background refresh rebuilds all feature `bigRock` strings. During the refresh window (~30-60s), `rockHealth`/`rockFeatures` in `useHealthAggregation.js` are keyed by the old name while `updateBigRocksInPlace()` has already applied the new name — so health data temporarily disappears for the renamed rock. **Mitigation:** After a rename save, show a toast message: "Rock renamed. Health data is refreshing and will appear shortly." The `DashboardView` already watches for refresh completion events; once the background refresh completes and `loadRelease()` re-fetches, health data reappears under the new key automatically. |
| Rock name contains special characters (slashes, dots) | Name is URL-encoded in the path (`encodeURIComponent`). Decoded on receipt. Max 100 chars already enforced. |
| Concurrent rename of the same rock | `withConfigLock()` serializes writes. Second request either succeeds (if first completed) or fails with "not found" (if first renamed it away from originalName). |

### Pillar dropdown

| Edge case | Handling |
|-----------|----------|
| No PM Hub pillar config exists | Dropdown falls back to free-text input. Validation accepts any value (current behavior). |
| Pillar options API call fails | `pillarOptions` stays `[]`, free-text fallback activates. No user-facing error for a read failure. |
| Admin removes a pillar in PM Hub config | Existing rocks keep their pillar (stored in per-release file). The removed value no longer appears in the dropdown. To change, user opens the rock and selects a new pillar. No data loss. |
| Admin renames a pillar in PM Hub config | Not in scope. Renaming a pillar in PM Hub does not cascade to Big Rock pillar values. Existing rocks keep the old pillar string. A future enhancement could add cascading updates. |
| Pillar field left empty | Allowed. Pillar is optional. Empty string stored. |
| Rock name contains a comma | Rejected by validation with error: "Name cannot contain commas (commas are used as delimiters in the pipeline)". |

---

## 9. UX Recommendation

The edit dialog changes (editable name input, pillar dropdown, helper text
for rename implications) would benefit from a UX review before
implementation. Key questions:

- Should the name field show a warning icon or helper text when the user
  changes it, explaining that rename triggers a data refresh?
- Should the pillar dropdown include a "None" or "Unset" option, or should
  empty be represented differently?
- Should there be a confirmation step for renames (inline warning vs.
  confirmation dialog)?

**Decision on stale-data window:** After a rename, a toast message will
inform the user: "Rock renamed. Health data is refreshing and will appear
shortly." This handles the ~30-60s window where health data is keyed by
the old name.

**Recommendation:** Spawn a UX teammate to create mockups for the edit
dialog before implementing Phase 3. The backend work (Phases 1-2) can
proceed independently.

---

## 10. Revision Log

### v2 (2026-06-10) -- Review findings addressed

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | Critical | Comma in rock name corrupts pipeline delimiter | Added comma validation to `validateBigRock()` (Phase 2, Section 3.2.2). Rejects names containing commas. |
| 2 | Critical | Duplicate pillar system vs PM Hub | Eliminated separate `pillarOptions` config store. GET route now derives pillar names from existing `releases/pm-hub/pillar-config.json`. No PUT endpoint needed. Phase 4 (Settings UI) eliminated entirely. |
| 3 | Critical | `isDirty` omits `fullName` | `isDirty` now includes `name`, `fullName`, and `pillar` -- fixes a pre-existing gap where `fullName` changes were not tracked. |
| 4 | Major | Existing tests assert name is read-only | Added to Phase 5: existing tests at lines 67-79 of `big-rock-edit-panel.test.js` must be updated (not just new tests added). Listed in Files Modified table. |
| 5 | Major | `doc-import.js` bypasses pillar validation | Added Phase 1 Section 3.1.4: `executeDocImport()` now loads PM Hub pillar config and passes `pillarOptions` to `validateBigRock()`. |
| 6 | Major | UI regression during rename (health data disappears) | Documented the root cause (key mismatch between `updateBigRocksInPlace` and `rockHealth`). Added toast message mitigation. Updated edge case table. |
| 7 | Medium | Missing `@openapi` on new routes | `@openapi` annotation included inline in Phase 1 GET route code snippet. Existing PUT route annotation unchanged (rename was always in the contract). |
| 8 | Medium | Missing `requireScope` on new routes | GET pillar-options route uses `requireScope('releases:read')`. |
| 9 | Medium | Missing `blockDuringImpersonation` on PM Hub PUT | Added as a cleanup item in Phase 1: `blockDuringImpersonation` middleware on existing `PUT /pillar-config` route. File added to Files Modified table. |
| 10 | Medium | `ReleasesSettings.vue` has no planning config sections | Corrected Phase 4 description. The file only has data refresh controls. Phase 4 is now eliminated -- pillar management stays in PM Hub's `PillarConfigPanel.vue`. |
| 11 | Medium | Demo mode fixture update | Added Phase 5 Section 3.5.3: verify/create `fixtures/releases/pm-hub/pillar-config.json` for demo mode. |
| 12 | Medium | `pillarOptions` ref scope ambiguity | Clarified in Phase 3 Section 3.3.1: `pillarOptions` is a module-level singleton ref (outside the `useBigRockEditor()` function), matching the existing pattern. |
