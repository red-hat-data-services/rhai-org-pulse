# Custom Fields Phase 2 — Implementation Plan

> **Revision 2** — incorporates feedback from four reviewers.

## Overview

This plan covers the remaining custom field user stories that are not yet implemented. The existing infrastructure provides solid CRUD for field definitions and single-value assignment. This phase adds:

1. **Multi-value assignment** for constrained fields (per-field opt-in)
2. **Filter/group people** by custom field values (single and multi-field)
3. **Filter/group teams** by custom field values
4. **Aggregate counts** when filtering (e.g., "12 engineers on component X")
5. **Person-reference field UI** (editors for `person-reference-linked` and `person-reference-unlinked`)
6. **Required field validation** (soft -- warn but allow save)
7. **Test coverage** for field-store, team-store field ops, and frontend components
8. **Multi-field filtering** (combine filters across multiple fields with AND logic)

Org-scoped field definitions are explicitly deferred to a future effort. Field definitions remain global.

---

## Phases

### Phase 1: Data Model & Backend (multi-value + validation)

**Goal:** Extend the field definition schema to support `multiValue` flag, update backend storage and validation, add a value coercion layer for mixed string/array data, and add server-side validation warnings for required fields.

**Estimated scope:** ~3 days (revised up from 2 -- see M1 below)

#### 1a. Field definition schema change

Add an optional `multiValue: boolean` property to field definitions. Only meaningful when `type === 'constrained'`. Defaults to `false` for backward compatibility.

**Current schema** (in `field-definitions.json`):
```json
{
  "id": "field_x1y2z3",
  "label": "Component",
  "type": "constrained",
  "required": false,
  "visible": true,
  "primaryDisplay": false,
  "allowedValues": ["Platform", "Model Serving", "UI"],
  "deleted": false,
  "order": 0,
  "createdAt": "...",
  "createdBy": "..."
}
```

**New schema** -- adds one field:
```json
{
  "multiValue": false
}
```

When `multiValue: true`, stored values in `_appFields` (person) and `team.metadata` (team) change from a plain string to an array of strings:

```json
// Single-value (multiValue: false or absent):
{ "field_abc": "Platform" }

// Multi-value (multiValue: true):
{ "field_abc": ["Platform", "Model Serving"] }
```

#### 1b. Value coercion helper (addresses M5 and M6)

**Problem:** When an admin enables `multiValue` on an existing field, old string values remain strings in storage. When an admin disables `multiValue`, array values remain arrays. Every read and write path must handle both shapes.

**Solution:** Create a `coerceFieldValue(value, fieldDef)` utility in `shared/server/field-store.js`:

```js
/**
 * Normalize a stored field value to match the field definition's current multiValue setting.
 * - multiValue=true: string -> [string], null -> [], array -> array
 * - multiValue=false: [first] -> first, string -> string, null -> null
 */
function coerceFieldValue(value, fieldDef) { ... }
```

This function is called:
1. In `updatePersonFields()` and `updateTeamFields()` before validation -- to normalize incoming values.
2. On read paths (or let the frontend handle display coercion) -- see note below.

**Decision:** Backend coercion on writes, frontend coercion on reads. The backend normalizes incoming values before storing them (so new writes are always in the correct shape). For reads, the frontend coerces at display/filter time using a mirror `coerceFieldValue()` utility (see Phase 2). This avoids a migration and avoids expensive read-modify-write on every GET.

The backend also coerces the stored value before validating against `allowedValues`, so that a legacy string value `"Platform"` is valid for a field that was changed to `multiValue: true` and still has `"Platform"` in its `allowedValues`.

#### 1c. Backend validation (addresses M1)

**Problem:** Adding validation to PATCH routes means loading field definitions on every write, cross-referencing fieldIds, validating types, and checking `allowedValues` membership. This is more work than a simple pass-through. Additionally, enabling validation could cause previously-accepted writes to fail for stale constrained values (values that were valid when written but whose option was later removed from `allowedValues`).

**Solution:**

- **`shared/server/field-store.js`** -- new exported function:
  ```js
  /**
   * Validate and normalize field values against their definitions.
   * @returns {{ validated: Object, warnings: string[], errors: string[] }}
   */
  function validateFieldValues(storage, scope, fieldValues) { ... }
  ```
  This function:
  1. Loads field definitions for the given scope.
  2. For each incoming fieldId/value pair:
     - If fieldId does not match any non-deleted definition, adds an error.
     - If the field is `constrained`: checks value(s) against `allowedValues`. **Lenient mode:** values not in `allowedValues` generate a warning, not an error. This prevents breakage when options are removed after values are set.
     - If the field is `constrained` and `multiValue`: coerces string to array, validates each element.
     - If the field is `constrained` and single-value: coerces array to first element, validates.
  3. After validation, checks all `required` fields. If any required field is still empty (across the full set of person/team fields, not just the ones being updated), adds to `warnings`.
  4. Returns `{ validated, warnings, errors }`. The route handler uses `validated` (coerced values) for the write and returns errors as HTTP 400 or warnings in the response.

- **`shared/server/field-store.js`** changes:
  - `createFieldDefinition()`: Accept `multiValue` in the definition object. Default to `false`. Only store `multiValue: true` when `type === 'constrained'`.
  - `updateFieldDefinition()`: Add `'multiValue'` to the whitelist of updatable keys (line 83, alongside `label`, `type`, `required`, `visible`, `primaryDisplay`, `allowedValues`).
  - `updatePersonFields()`: Accept a `fieldDefinitions` parameter (or load internally) to validate. Return shape changes -- see 1d.

- **`shared/server/team-store.js`** changes:
  - `updateTeamFields()`: Accept field definitions for validation. Normalize return value (see M7 below).

- **`modules/team-tracker/server/index.js`** (route handlers):
  - Field creation routes (lines 612-623, 652-663): Pass `multiValue` from `req.body` to `createFieldDefinition()`.
  - Field update routes (lines 625-631, 665-671): Allow `multiValue` in PATCH body.
  - Person field value route (lines 692-701): Call `validateFieldValues()` before `updatePersonFields()`. If `errors` is non-empty, return 400. Otherwise write validated values and return result with `_warnings`.
  - Team field value route (lines 705-711): Same flow.

#### 1d. Response shape for field value PATCH (addresses C2)

**Problem:** The original plan proposed changing the PATCH response from `{ field_abc: "value" }` to `{ values: {...}, warnings: [...] }`, which is a breaking change.

**Solution:** Always return the flat field values object. Append warnings using an underscore-prefixed key `_warnings` that cannot collide with field IDs (all field IDs start with `field_`).

```json
// No warnings:
{ "field_abc": "Platform", "field_def": ["A", "B"] }

// With warnings:
{ "field_abc": "Platform", "field_def": ["A", "B"], "_warnings": ["Focus Area is required"] }
```

This is fully backward compatible. Old frontend code ignores `_warnings`. New frontend code checks for it.

#### 1e. Normalize `updateTeamFields` return value (addresses M7)

**Problem:** `teamStore.updateTeamFields()` returns the full `team` object, while `fieldStore.updatePersonFields()` returns just `person._appFields`. The route handler for team fields then passes this full team object directly to `res.json()`. This means the response shapes differ.

**Solution:** Normalize both routes to return the same shape -- the flat field values map (with optional `_warnings`).

In the team field PATCH route handler (`modules/team-tracker/server/index.js`, line 705-711):
- After `updateTeamFields()` returns the team object, extract `team.metadata` and return that as the response body (plus `_warnings` if any).
- This makes both person and team field PATCH routes return `{ fieldId: value, ... , _warnings?: [...] }`.

#### 1f. Fixture update

- **`fixtures/team-data/field-definitions.json`**: Add a constrained field with `multiValue: true` to exercise the feature in demo mode. Also add at least one field with `required: true` so required-field warnings can be tested.
- **`fixtures/team-data/registry.json`**: Add array-valued `_appFields` entries for persons using the multi-value field.
- **`fixtures/team-data/teams.json`**: Add `metadata` entries with multi-value fields on at least one team.

---

### Phase 2: Frontend -- Multi-value Editor & Required Warnings

**Goal:** Update field editors to support multi-value selection and show required-field warnings.

**Estimated scope:** ~2.5 days

**Recommendation: Spawn a UX teammate** to review the multi-select widget design before implementation begins.

#### 2a. Edit state refactor (addresses M2)

**Problem:** Both `PersonFieldEditor.vue` and `TeamFieldEditor.vue` use a single `editValue = ref('')` for all field types. A single ref cannot serve as both a string and an array. When a multi-value constrained field is being edited, `editValue` must be an array. When a `<select>` v-model receives an array, it fails to match any option.

**Solution:** Replace the single `editValue` ref with type-specific state:

```js
// Replace:
const editValue = ref('')

// With:
const editValue = ref(null) // will be string or array depending on field type

function startEdit(fieldId) {
  editingFieldId.value = fieldId
  const field = props.fieldDefinitions.find(f => f.id === fieldId)
  const raw = props.customFields[fieldId] ?? null

  if (field?.type === 'constrained' && field?.multiValue) {
    // Coerce to array (handles legacy string values -- M5)
    editValue.value = Array.isArray(raw) ? [...raw] : (raw ? [raw] : [])
  } else {
    // Coerce to string (handles legacy array values from toggling multiValue off)
    editValue.value = Array.isArray(raw) ? (raw[0] || '') : (raw || '')
  }
}
```

On save:
```js
async function saveEdit(fieldId) {
  const field = props.fieldDefinitions.find(f => f.id === fieldId)
  let valueToSave = editValue.value

  // For single-value constrained, send string or null
  if (field?.type === 'constrained' && !field?.multiValue) {
    valueToSave = valueToSave || null
  }
  // For multi-value constrained, send array
  // (already an array from the checkbox editor)

  // ... API call with valueToSave
}
```

Apply the same refactor to both `PersonFieldEditor.vue` and `TeamFieldEditor.vue`.

#### 2b. Multi-value constrained editor UI (addresses UX feedback)

**UX decision:** Use checkbox groups for fields with 8 or fewer options. Use a combobox multi-select for fields with 9+ options.

In `PersonFieldEditor.vue` and `TeamFieldEditor.vue`, when `field.type === 'constrained' && field.multiValue`:

- **8 or fewer options:** Render checkboxes:
  ```html
  <div v-if="field.allowedValues.length <= 8" class="space-y-1">
    <label v-for="opt in field.allowedValues" :key="opt" class="flex items-center gap-2">
      <input type="checkbox" :value="opt" v-model="editValue" />
      <span class="text-sm">{{ opt }}</span>
    </label>
  </div>
  ```
  (Vue's `v-model` on checkboxes with an array ref handles add/remove automatically.)

- **9+ options:** Render a combobox multi-select (searchable dropdown with checkmarks). Implement as a small inline component or extract to a shared component if needed.

**Display mode** for multi-value fields: Show selected values as pill badges, truncated to 3 pills + "+N more" in table contexts (UX #2). In the field editor (non-table context), show all pills.

```html
<template v-else>
  <!-- Multi-value display -->
  <div v-if="isMultiValue(field)" class="flex flex-wrap gap-1 flex-1">
    <span v-for="v in displayValues(field)" :key="v"
          class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
      {{ v }}
    </span>
    <span v-if="overflowCount(field) > 0" class="text-xs text-gray-400">+{{ overflowCount(field) }} more</span>
  </div>
  <!-- Single-value display (unchanged) -->
  <span v-else class="text-sm text-gray-900 flex-1">{{ coercedDisplay(field) || '-' }}</span>
</template>
```

#### 2c. Frontend value coercion utility

Create a small utility function (can live in the editor components or be extracted to a shared util):

```js
function coerceForDisplay(value, fieldDef) {
  if (fieldDef.multiValue) {
    return Array.isArray(value) ? value : (value ? [value] : [])
  }
  return Array.isArray(value) ? (value[0] || null) : value
}
```

This handles the M5 case where storage has mixed string/array values after toggling `multiValue`.

#### 2d. FieldDefinitionManager.vue

- Add a "Allow multiple values" checkbox in the create-field modal, visible only when type is `constrained`.
- In the field list, show a badge like "(multi)" next to constrained fields that have `multiValue: true`.
- In the edit flow, allow toggling `multiValue` via the PATCH endpoint. Show a warning: "Changing to single-value will not remove existing multi-value data, but only the first value will display."

#### 2e. Required field warnings (addresses UX #8 and #9)

- Visually mark required fields: add a red asterisk `*` after the field label for fields with `required: true`.
- After save, check if the API response includes `_warnings`. Display each warning as an **inline yellow message** below the relevant field (not a toast -- UX #8).
- Show the yellow highlight on a required empty field **only after the user has interacted** with the field (blur or save) -- not on first render of new records (UX #9). Track interaction state per field with a `touchedFields` set.
- Do not show "(required)" hint text -- the asterisk is sufficient (UX #8).

#### 2f. Dark mode and responsive (addresses UX #10 and #11)

- All new UI elements must include dark mode Tailwind variants (`dark:bg-*`, `dark:text-*`, etc.).
- On mobile (`sm:` breakpoint and below), stack field labels above checkbox groups rather than using the inline flex layout.

---

### Phase 3: Filtering & Aggregate Counts

**Goal:** Add filter UI for people and teams by custom field values, with aggregate counts. Support multi-field AND filtering.

**Estimated scope:** ~3.5 days

**Recommendation: UX teammate** should review the filter panel mockup before implementation. The recommended approach and UX decisions are described below.

#### 3a. Critical fix: Team data source mismatch (addresses C1)

**Problem:** `TeamDirectoryView.vue` does NOT use `GET /structure/teams` (the team-data store). It uses `useOrgRoster` which calls `GET /org-teams`. That endpoint (`modules/team-tracker/server/routes/org-teams.js`) builds team objects dynamically from `_teamGrouping` values on people -- these team objects have NO `metadata` property, NO team ID, and NO connection to `team-data/teams.json` where custom field metadata lives. The original plan incorrectly assumed `team.metadata` would be available.

**Two data sources for "teams":**
1. **Org-roster teams** (`GET /org-teams`): Derived dynamically from people's `_teamGrouping` field. Keyed by `org::name` composite. No team ID. No custom field metadata. This is what `TeamDirectoryView` and `TeamCard` consume.
2. **Structure teams** (`GET /structure/teams`, stored in `team-data/teams.json`): Admin-created teams with IDs, `metadata` for custom fields, and member assignments via `teamIds`. Used by `TeamManagement`, `TeamAssignment`, and `TeamFieldEditor`.

**Solution:** Enrich org-roster team objects with custom field metadata by joining the two data sources on the server side.

Changes to `modules/team-tracker/server/routes/org-teams.js`:
- In `buildEnrichedTeams()`, after building teams from people's `_teamGrouping`, look up matching structure teams from `team-data/teams.json` by `orgKey::name` composite key matching.
- For each match, copy `metadata` and `id` (the structure team ID) onto the org-roster team object.
- This is a read-only join -- no changes to how teams are stored.

```js
// In buildEnrichedTeams(), after the teams.push() loop:
const { readTeams } = require('../../../../shared/server/team-store');
const structureData = readTeams(storage);
const structureByComposite = {};
for (const [id, t] of Object.entries(structureData.teams)) {
  // Structure teams use orgKey (LDAP uid), org-roster teams use orgDisplayName
  // Need to map orgKey -> displayName for matching
  const displayName = orgKeyToDisplay[t.orgKey] || t.orgKey;
  structureByComposite[`${displayName}::${t.name}`] = { ...t, id };
}

for (const team of teams) {
  const key = `${team.org}::${team.name}`;
  const structure = structureByComposite[key];
  if (structure) {
    team.structureId = structure.id;
    team.metadata = structure.metadata || {};
  }
}
```

This approach:
- Does not change the structure team data model.
- Does not require a migration or merging of the two team systems.
- Is backward compatible -- old frontends ignore the new `structureId` and `metadata` keys.
- Is a read-only enrichment on an existing endpoint.

**Fixture update:** `fixtures/team-data/teams.json` must have at least one team whose `orgKey::name` matches an org-roster team derived from the registry fixture, so that the join produces metadata in demo mode.

#### 3b. Composable: `useFieldFilters.js` (placement addresses M3)

**Placement decision:** Place in `modules/team-tracker/client/composables/useFieldFilters.js`, NOT in `shared/`. Per `shared/API.md`, shared exports are a stability contract. This composable is tightly coupled to `_appFields` / `metadata` data shapes that are specific to the team-tracker module. If other modules need filtering in the future, the composable can be promoted to shared at that time.

```js
/**
 * Provides reactive field-based filtering for a list of items.
 *
 * @param {Ref<Array>} items - The FULL unfiltered list (people or teams)
 * @param {Ref<Array>} fieldDefinitions - Active field definitions
 * @param {Function} getFieldValues - (item) => { fieldId: value } extractor
 * @returns {Object} { activeFilters, setFilter, clearFilter, clearAll, filtered, filterCounts }
 */
export function useFieldFilters(items, fieldDefinitions, getFieldValues)
```

State:
- `activeFilters`: `Ref<Record<string, string[]>>` -- maps fieldId to array of selected values. AND across fields, OR within a field.
- `filtered`: computed list after applying all active filters.
- `filterCounts`: computed `Record<string, Record<string, number>>` -- for each filterable field, the count of items matching each option value. **Computed against the FULL unfiltered list** (absolute counts), not the currently filtered list. This addresses M4 and matches the user story requirement ("12 engineers work on component X" should always show 12, regardless of other active filters).

Methods:
- `setFilter(fieldId, values)`: Set the selected values for a field.
- `clearFilter(fieldId)`: Remove filter for a field.
- `clearAll()`: Reset all filters.

Filtering logic:
- Values are coerced before comparison using `coerceForDisplay()` (handles mixed string/array storage).
- For single-value fields: item matches if `coerced(getFieldValues(item)[fieldId])` is in `activeFilters[fieldId]`.
- For multi-value fields: item matches if the intersection of `coerced(getFieldValues(item)[fieldId])` (array) and `activeFilters[fieldId]` is non-empty (i.e., any selected value matches).
- Across fields: AND -- item must match all active filters.

#### 3c. Shared component: `FieldFilterPanel.vue` (addresses UX #4)

Extract the filter panel into a shared component at `modules/team-tracker/client/components/FieldFilterPanel.vue`:

Props:
- `fieldDefinitions` (array) -- visible constrained field definitions
- `activeFilters` (object) -- current filter state from `useFieldFilters`
- `filterCounts` (object) -- per-value counts from `useFieldFilters`

Emits:
- `update:filter` with `{ fieldId, values }`
- `clear:filter` with `fieldId`
- `clear:all`

UX decisions incorporated:
- **Collapsible per field** (UX #3): Each field group is collapsible. When collapsed, show an active-filter count badge (e.g., "Component (2 selected)").
- **Per-value counts** displayed as muted text (UX #6): `"Platform" <span class="text-gray-400 dark:text-gray-500 text-xs">8</span>`, not badges.
- **Dark mode** variants on all elements (UX #11).

#### 3d. PeopleDirectoryView.vue changes

- Import `useFieldFilters` from `modules/team-tracker/client/composables/useFieldFilters.js` and `useFieldDefinitions` from `@shared`.
- On mount, fetch field definitions alongside existing data loads (`Promise.all` with the existing three requests).
- Compute `personFieldDefs` = visible, non-deleted person fields of type `constrained`.
- **Important (M4):** Pass the FULL unfiltered active-people list as the `items` source to `useFieldFilters`, NOT the already org/geo/search-filtered list. The `useFieldFilters` composable applies its own filtering. Then the final displayed list is the intersection: apply org/geo/search filters first, then apply field filters on the result. But `filterCounts` are computed from the full unfiltered list (absolute counts).
- Render `FieldFilterPanel` in the existing filter panel area (lines 191-233), alongside the existing Orgs and Geos groups.
- The result count (`filtered.length`) reflects all active filters including custom field filters.

#### 3e. TeamDirectoryView.vue changes

- Import `useFieldFilters` and `useFieldDefinitions`.
- Fetch field definitions on mount.
- Compute `teamFieldDefs` = visible, non-deleted team fields of type `constrained`.
- Add `FieldFilterPanel` below the OrgSelector (collapsible). Only render when `teamFieldDefs` is non-empty.
- `getFieldValues = (team) => team.metadata || {}` -- this works because of the server-side enrichment from 3a.
- The `filteredTeams` computed in `useOrgRoster` applies search/sort. Chain field filtering after that.
- Show aggregate count: `"8 teams"` in the header.

#### 3f. TeamMembersTable.vue changes

- Accept `fieldDefinitions` as a new prop (array of person field defs).
- For each visible constrained person field, add a pill-button filter row (same pattern as the existing role filter on lines 17-38).
- **Cap at 2 pill-button filter rows** (UX #5). If more than 2 constrained fields exist, show the first 2 and add a "More filters" expansion toggle that reveals the rest.
- Show count: `"Showing 5 of 12 members"` when filters are active.

#### 3g. `_appFields` in people listing (verification)

The `/modules/team-tracker/registry/people` endpoint (`ipa-registry.js`, line 117) uses `Object.assign({}, p, { orgDisplayName, teams })` which copies all properties from the registry person object `p`, including `_appFields`. No change needed -- `_appFields` is already included.

---

### Phase 4: Person-Reference Field UI

**Goal:** Render proper editors for `person-reference-linked` and `person-reference-unlinked` field types.

**Estimated scope:** ~1.5 days

#### 4a. Relationship to existing `PersonReferenceField.vue` (addresses minor issue)

The existing `shared/client/components/PersonReferenceField.vue` is a **display-only** component -- it renders a person reference value as either a clickable link (linked) or plain text (unlinked). It has no editing capability.

The new `PersonAutocomplete.vue` is an **edit** component -- a typeahead input for selecting a person. These are complementary:
- `PersonReferenceField.vue` is used in display mode (already exists, no changes needed).
- `PersonAutocomplete.vue` is used in edit mode (new).

#### 4b. `PersonAutocomplete.vue` (addresses UX #7)

Create `modules/team-tracker/client/components/PersonAutocomplete.vue` (placed in the module, not shared -- since it depends on the registry people list shape):

- Props: `modelValue` (string -- UID or name), `people` (array of `{ uid, name, title }`), `linked` (boolean -- if true, works with UIDs; if false, works with names), `placeholder`
- Emits: `update:modelValue`
- **Implements WAI-ARIA combobox pattern** (UX #7):
  - `role="combobox"` on the input
  - `role="listbox"` on the dropdown
  - `role="option"` on each item
  - `aria-expanded`, `aria-activedescendant`, `aria-autocomplete="list"`
  - Keyboard navigation: arrow keys, Enter to select, Escape to close
- Debounced filtering (150ms), max 10 results displayed
- Shows name + title in dropdown items
- Dark mode variants (UX #11)

#### 4c. `person-reference-unlinked`

In `PersonFieldEditor.vue` and `TeamFieldEditor.vue`:
- When editing a `person-reference-unlinked` field, render `PersonAutocomplete` with `linked=false`.
- The stored value is a plain string (the person's display name).
- Display mode: plain text (unchanged from current behavior).

#### 4d. `person-reference-linked`

In `PersonFieldEditor.vue` and `TeamFieldEditor.vue`:
- When editing, render `PersonAutocomplete` with `linked=true`. On selection, store the `uid`.
- In display mode, resolve the UID to a name using the people list prop and render using the existing `PersonReferenceField.vue` component (with `linked=true` and a `@navigate` handler).
- If the UID cannot be resolved (person left org), show the raw UID with a "(not found)" indicator in muted text.

#### 4e. People list prop

Both `PersonFieldEditor.vue` and `TeamFieldEditor.vue` need access to the registry people list for the autocomplete. Add a `people` prop (array of `{ uid, name, title }`) to both components. The parent view is responsible for loading and passing this data (already available from `useOrgRoster().loadPeople()` or the registry API).

---

### Phase 5: Test Coverage

**Goal:** Add comprehensive tests for field stores, route handlers, and frontend components.

**Estimated scope:** ~2.5 days

#### 5a. Backend unit tests

Create `modules/team-tracker/__tests__/server/field-store.test.js`:
- `createFieldDefinition()`: creates with all field types, handles `multiValue` flag, rejects `multiValue` for non-constrained types
- `updateFieldDefinition()`: updates label, type, allowedValues, multiValue, visibility
- `softDeleteField()`: marks as deleted, does not remove
- `reorderFields()`: reorders correctly
- `updatePersonFields()`: sets values, handles multi-value arrays, returns `_appFields`
- `validateFieldValues()`: validates constrained values (lenient mode for stale values), coerces string<->array, reports required field warnings
- `coerceFieldValue()`: string to array, array to string, null handling
- Audit log entries are created for each operation

Create `modules/team-tracker/__tests__/server/team-field-store.test.js`:
- `updateTeamFields()`: sets values, handles multi-value arrays
- Audit log entries for team field updates

Create `modules/team-tracker/__tests__/server/field-routes.test.js`:
- Integration tests using supertest against the Express router
- Test field definition CRUD routes (POST, PATCH, DELETE, GET)
- Test person field value PATCH with validation (constrained values, multi-value arrays, `_warnings` in response)
- Test team field value PATCH returns flat metadata (not full team object) -- verifies M7 fix
- Test demo mode guard returns demo response

Use the same in-memory storage pattern from `export.test.js` for mock storage (not `derive-roster-merge.test.js` as originally stated).

#### 5b. Frontend unit tests

Create `modules/team-tracker/__tests__/client/PersonFieldEditor.test.js`:
- Renders visible fields
- Hides deleted fields
- Single-value constrained: renders select dropdown
- Multi-value constrained with <=8 options: renders checkbox group
- Multi-value constrained with 9+ options: renders combobox multi-select
- Free-text: renders text input
- Required field: shows asterisk; shows inline warning after interaction (not on first render)
- Edit + save flow: `editValue` is array for multi-value, string for single-value
- Coercion: legacy string value displays correctly for multi-value field
- Coercion: legacy array value displays correctly for single-value field (shows first element)

Create `modules/team-tracker/__tests__/client/TeamFieldEditor.test.js`:
- Same coverage as PersonFieldEditor but for team context

Create `modules/team-tracker/__tests__/client/FieldDefinitionManager.test.js`:
- Renders field list
- Create modal: shows multiValue checkbox for constrained type, hidden for other types
- Edit inline label
- Delete with confirmation
- Options modal for constrained fields

Create `modules/team-tracker/__tests__/client/useFieldFilters.test.js`:
- Filters by single field
- Filters by multiple fields (AND logic)
- Multi-value field filtering (OR within values)
- Mixed string/array value coercion during filtering
- Aggregate counts are absolute (computed from unfiltered list)
- Clear filter / clear all

#### 5c. Fixture validation

Add a test that validates `fixtures/team-data/field-definitions.json` matches the expected schema (has required keys, types are valid, `multiValue` fields have `allowedValues`).

---

## Files Modified

| File | Action | Phase | Description |
|------|--------|-------|-------------|
| `shared/server/field-store.js` | Modify | 1 | Add `multiValue` to create/update whitelist, add `validateFieldValues()`, add `coerceFieldValue()` |
| `shared/server/team-store.js` | Modify | 1 | Accept field definitions for validation in `updateTeamFields()` |
| `modules/team-tracker/server/index.js` | Modify | 1 | Pass `multiValue` in field creation routes, add validation + `_warnings` in field value routes, normalize team field PATCH response (M7) |
| `modules/team-tracker/server/routes/org-teams.js` | Modify | 3 | Enrich org-roster teams with structure team metadata (C1 fix) |
| `fixtures/team-data/field-definitions.json` | Modify | 1 | Add constrained multi-value field + required field examples |
| `fixtures/team-data/registry.json` | Modify | 1 | Add array-valued `_appFields` entries |
| `fixtures/team-data/teams.json` | Modify | 1 | Add `metadata` with multi-value fields on a team that matches an org-roster team |
| `modules/team-tracker/client/components/PersonFieldEditor.vue` | Modify | 2, 4 | Refactor `editValue` to type-specific state (M2), multi-value checkbox/combobox editor, person-reference autocomplete, required field warnings, dark mode, responsive |
| `modules/team-tracker/client/components/TeamFieldEditor.vue` | Modify | 2, 4 | Same refactor as PersonFieldEditor |
| `modules/team-tracker/client/components/FieldDefinitionManager.vue` | Modify | 2 | `multiValue` checkbox in create modal, badge in list |
| `modules/team-tracker/client/composables/useFieldFilters.js` | **Create** | 3 | Module-level composable for field-based filtering with absolute counts (M3) |
| `modules/team-tracker/client/components/FieldFilterPanel.vue` | **Create** | 3 | Reusable collapsible filter panel with per-value counts (UX #4) |
| `modules/team-tracker/client/components/PersonAutocomplete.vue` | **Create** | 4 | WAI-ARIA combobox typeahead for person-reference fields (UX #7) |
| `modules/team-tracker/client/views/PeopleDirectoryView.vue` | Modify | 3 | Add FieldFilterPanel to existing filter area, integrate useFieldFilters |
| `modules/team-tracker/client/views/TeamDirectoryView.vue` | Modify | 3 | Add FieldFilterPanel below OrgSelector, integrate useFieldFilters |
| `modules/team-tracker/client/components/TeamMembersTable.vue` | Modify | 3 | Add custom field pill-button filters (max 2 rows + "More"), accept `fieldDefinitions` prop |
| `shared/client/index.js` | No change | -- | No new shared exports (composable and components stay in module) |
| `shared/API.md` | No change | -- | No new shared exports to document |
| `modules/team-tracker/__tests__/server/field-store.test.js` | **Create** | 5 | Unit tests for field-store including validation and coercion |
| `modules/team-tracker/__tests__/server/team-field-store.test.js` | **Create** | 5 | Unit tests for team field operations |
| `modules/team-tracker/__tests__/server/field-routes.test.js` | **Create** | 5 | Integration tests for field API routes |
| `modules/team-tracker/__tests__/client/PersonFieldEditor.test.js` | **Create** | 5 | Frontend component tests |
| `modules/team-tracker/__tests__/client/TeamFieldEditor.test.js` | **Create** | 5 | Frontend component tests |
| `modules/team-tracker/__tests__/client/FieldDefinitionManager.test.js` | **Create** | 5 | Frontend component tests |
| `modules/team-tracker/__tests__/client/useFieldFilters.test.js` | **Create** | 5 | Composable unit tests |

---

## Data Model Changes

### Field definition schema

```diff
 {
   "id": "field_abc123",
   "label": "Component",
   "type": "constrained",
+  "multiValue": false,
   "required": false,
   "visible": true,
   "primaryDisplay": false,
   "allowedValues": ["Platform", "Model Serving"],
   "deleted": false,
   "order": 0,
   "createdAt": "...",
   "createdBy": "..."
 }
```

- `multiValue` is optional. Absent or `false` means single-value (current behavior).
- Only valid when `type === 'constrained'`. Ignored for other types.

### Field value storage

Person values (`_appFields` in registry):
```json
// Single-value field:
{ "field_abc": "Platform" }

// Multi-value field:
{ "field_abc": ["Platform", "Model Serving"] }
```

Team values (`team.metadata`):
```json
// Same pattern as person values
{ "field_abc": ["Platform", "Model Serving"] }
```

### Mixed value handling (M5, M6)

When `multiValue` is toggled on an existing field, old values remain in their original shape (string). When toggled off, array values remain arrays. The system handles this via coercion:

| Storage shape | Field `multiValue` | Backend coercion (writes) | Frontend coercion (reads) |
|---------------|-------------------|---------------------------|---------------------------|
| `"Platform"` | `true` | `["Platform"]` | `["Platform"]` |
| `["A", "B"]` | `false` | `"A"` (first element) | `"A"` |
| `null` | `true` | `[]` | `[]` |
| `null` | `false` | `null` | `null` |

### Snapshot format impact

Snapshots (`data/snapshots/`) do not reference `_appFields` or team `metadata`. Custom field values are not included in snapshots. No snapshot format changes are needed.

### Migration / coexistence

No data migration is needed. The `multiValue` flag defaults to `false` when absent, preserving all existing single-value behavior. Coercion handles mixed shapes at read and write time.

---

## API Changes

### Modified endpoints

**POST `/api/modules/team-tracker/structure/field-definitions/person`**
**POST `/api/modules/team-tracker/structure/field-definitions/team`**

New optional body parameter:
- `multiValue` (boolean, default `false`) -- only stored when `type === 'constrained'`

**PATCH `/api/modules/team-tracker/structure/field-definitions/person/:fieldId`**
**PATCH `/api/modules/team-tracker/structure/field-definitions/team/:fieldId`**

New optional body parameter:
- `multiValue` (boolean)

**PATCH `/api/modules/team-tracker/structure/person/:uid/fields`**

Behavior changes:
- Incoming values are validated against field definitions (loads defs on each request).
- For `multiValue` constrained fields, the value is coerced to an array. Each element is checked against `allowedValues` (lenient: unknown values generate warnings, not errors).
- For single-value constrained fields, arrays are coerced to first element. Value is checked against `allowedValues` (lenient).
- Unknown field IDs return HTTP 400.
- Response always includes the flat `_appFields` map. If required-field warnings exist, they are appended as `_warnings: [...]`.

Response shape (unchanged, with additive `_warnings` key):
```json
{ "field_abc": "Platform", "field_def": ["A", "B"], "_warnings": ["Focus Area is required"] }
```

**PATCH `/api/modules/team-tracker/structure/teams/:teamId/fields`**

Behavior changes:
- Same validation as person fields.
- Response is now `team.metadata` (flat field values map) instead of the full team object. This is a **minor breaking change** but no current frontend code depends on the full team object from this endpoint -- `TeamFieldEditor.vue` only uses the composable which ignores the response shape beyond demo detection.

Response shape (normalized to match person fields):
```json
{ "field_abc": "Platform", "_warnings": [] }
```

**GET `/api/modules/team-tracker/org-teams`**

Additive change -- team objects in the response now include optional `structureId` and `metadata` properties (from the C1 enrichment join). Old consumers ignore these.

### No new endpoints

All filtering is done client-side. The existing endpoints return sufficient data.

---

## Frontend Components

### New components (all in `modules/team-tracker/`)

1. **`client/components/PersonAutocomplete.vue`** -- WAI-ARIA combobox typeahead for person-reference fields. Not in `shared/` since it depends on the registry people shape.
2. **`client/components/FieldFilterPanel.vue`** -- Reusable collapsible filter panel with checkbox groups and per-value counts.

### New composables (in `modules/team-tracker/`)

1. **`client/composables/useFieldFilters.js`** -- Reactive filtering engine for lists by custom field values. Returns filtered list, active filters, and absolute per-value counts.

### Modified components

1. **`PersonFieldEditor.vue`** -- Refactored edit state (M2), multi-value checkbox/combobox editor, person-reference autocomplete, required-field visual indicators
2. **`TeamFieldEditor.vue`** -- Same refactor
3. **`FieldDefinitionManager.vue`** -- `multiValue` toggle in create/edit modals
4. **`PeopleDirectoryView.vue`** -- FieldFilterPanel in existing filter area
5. **`TeamDirectoryView.vue`** -- FieldFilterPanel below OrgSelector
6. **`TeamMembersTable.vue`** -- Custom field pill-button filters (max 2 rows + expansion)

---

## Testability

### Local development

- All features can be tested locally with `npm run dev:full` using demo mode (`DEMO_MODE=true VITE_DEMO_MODE=true`).
- Updated fixtures in `fixtures/team-data/` provide multi-value fields, required fields, and constrained fields for exercising filter, edit, and display flows.
- Unit tests run via `npm test` (Vitest). All new test files follow existing patterns.
- Manual test checklist:
  1. Create a constrained field with "Allow multiple" enabled
  2. Assign multi-values to a person; verify checkbox group (<=8 options) or combobox (9+ options)
  3. Verify multi-value display shows pills with "+N more" truncation in table views
  4. Filter people by a constrained field; verify absolute counts next to each option
  5. Apply filters across 2+ fields; verify AND logic
  6. Clear individual filter; clear all filters
  7. Create a `person-reference-linked` field and assign a person via autocomplete
  8. Verify linked person renders as clickable link in display mode
  9. Mark a field as required; leave it empty; verify asterisk shows and inline warning appears after save
  10. Toggle `multiValue` on an existing field with data; verify old values coerce correctly
  11. Open TeamDirectoryView; verify team custom fields appear in filter panel (C1 fix)
  12. Test in dark mode and on mobile viewport

### Preprod

- Deploy to preprod overlay (`:latest` images). Verify:
  - Existing field definitions load correctly (no `multiValue` key = backward compat)
  - Creating new multi-value fields works end-to-end
  - Filtering works with real roster data
  - Team field PATCH response is now flat metadata (M7 fix) -- verify `TeamFieldEditor` still works
  - Org-roster teams show custom field metadata in TeamDirectoryView (C1 fix)
  - Audit log captures all field operations

### Production

- No data migration needed. Deployment is a simple image update.
- Monitor: Check that existing field values display correctly after deployment (no regressions from coercion).
- Verify team field PATCH consumers are unaffected by the response normalization (M7).

---

## Deployability

### CI/CD impact

- No new environment variables required.
- No new secrets.
- No changes to Dockerfiles or nginx config.
- New files are all within `shared/` and `modules/team-tracker/`, which are already covered by the `build-images.yml` change detection.
- New test files are picked up automatically by Vitest.
- `npm run validate:modules` is unaffected (no module.json changes).

### Deployment sequence

Standard deployment flow -- merge to `main`, CI builds images, auto-PR updates prod image tags, ArgoCD rolls out.

No special deployment ordering is needed. Backend and frontend can be deployed simultaneously because:
- Backend changes are additive (new optional field, array values accepted alongside strings).
- Frontend gracefully handles missing `multiValue` flag (treats as `false`).
- The team field PATCH response normalization (M7) and the `_warnings` key are consumed only by the new frontend code.

### Rollback

If a rollback is needed:

- **Rolling back the frontend only** is safe -- old frontend ignores `multiValue` flag and `_warnings` key. Old single-value `<select>` receiving a string works as before.
- **Rolling back the backend only** is safe with one caveat: old backend returns the full team object from team field PATCH (pre-M7-fix). The new frontend's `TeamFieldEditor` must handle both shapes (it already does since the composable is permissive with the response).
- **Rollback with existing multi-value data:** If a multi-value field was created and values were written as arrays, rolling back the frontend means the old `<select>` v-model receives an array value. The old `startEdit()` does `editValue.value = props.customFields[fieldId] || ''`, which would set editValue to the array's `.toString()` (e.g., `"Platform,Model Serving"`). This would not match any dropdown option, resulting in an empty dropdown selection. **This is a known limitation** -- the old frontend cannot correctly display or edit multi-value data. An admin would need to re-save the field value after rollback.
- **Full rollback** (both images): No data migration or cleanup needed. Multi-value array data in storage is harmless -- it coerces to `.toString()` on display and can be overwritten.

---

## Backward Compatibility

### Data format

- **Field definitions**: Adding `multiValue` is purely additive. Old code ignores unknown keys. Default is `false`, preserving existing behavior exactly.
- **Field values**: Single-value fields continue to store strings. Multi-value fields store arrays. The coercion layer (1b) ensures both shapes are handled at read and write time.
- **No migration required**: Existing data files are valid under the new schema without changes.

### API contracts

- All existing endpoints continue to work identically for single-value fields.
- The field value PATCH response uses `_warnings` (underscore prefix) which cannot collide with field IDs (`field_*` prefix). Old frontend code ignores this key.
- Field definitions GET response includes `multiValue` as a new key. Old frontend code ignores it.
- The team field PATCH response changes from full team object to flat metadata map. This is a minor breaking change, but the only consumer (`TeamFieldEditor.vue` via `useTeams.updateTeamFields()`) does not destructure the response -- it just passes through the demo check and emits `updated`. The parent component re-fetches team data after the event.
- The `GET /org-teams` response adds optional `structureId` and `metadata` keys on team objects. Old consumers ignore these.

### UI behavior

- Existing single-value constrained fields render and behave exactly as before.
- The filter panel additions only appear when constrained fields exist. If no constrained fields are defined, no filter groups appear.
- Required field warnings are non-blocking (soft validation). Users can still save empty required fields.

### Demo mode

- Updated fixtures ensure demo mode exercises all new features.
- Demo write guard continues to prevent data modification in demo mode.

---

## UX Decisions (incorporated from reviewer feedback)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Checkbox groups for <=8 options; combobox multi-select for 9+ | Balances discoverability with scalability |
| 2 | Truncate multi-value pills to 3 + "+N more" in table contexts | Prevents table row height explosion |
| 3 | Collapsible filter groups with active-filter count badge | Manages vertical space when many fields exist |
| 4 | Extract `FieldFilterPanel.vue` as reusable component | Shared across PeopleDirectoryView, TeamDirectoryView |
| 5 | Cap TeamMembersTable at 2 pill-button filter rows + "More" | Prevents filter UI from dominating the table |
| 6 | Per-value counts as muted text (`text-gray-400 text-xs`) | Less visual noise than badges |
| 7 | WAI-ARIA combobox pattern for PersonAutocomplete | Accessibility compliance |
| 8 | Inline warnings only (not toasts); no "(required)" hint | Contextual feedback, less clutter |
| 9 | Yellow highlight only after interaction, not on first render | Avoids false-alarm warnings on new records |
| 10 | Stack labels above checkbox groups on mobile | Responsive layout |
| 11 | Dark mode Tailwind variants on all new UI | Consistency with existing app |

---

## Reviewer Feedback Traceability

| Issue | Status | Section |
|-------|--------|---------|
| C1: TeamDirectoryView wrong data source | Fixed | Phase 3a |
| C2: Response shape breaks callers | Fixed | Phase 1d |
| M1: Backend validation scope underestimated | Fixed | Phase 1c, estimate raised to 3 days |
| M2: `editValue` ref shared across types | Fixed | Phase 2a |
| M3: `useFieldFilters` placement | Fixed | Phase 3b (module-level, not shared) |
| M4: Filter count ambiguity | Fixed | Phase 3b (absolute counts from unfiltered list) |
| M5: No coercion for toggled multiValue | Fixed | Phase 1b, 2c |
| M6: Rollback broken edit flow | Fixed | Phase 1b, Rollback section |
| M7: `updateTeamFields` return mismatch | Fixed | Phase 1e |
| UX #1-#11 | Incorporated | Phase 2b/2e/2f, Phase 3c/3f, Phase 4b, UX table |
| Minor: `shared/client/index.js` | Addressed | Files Modified table (no change needed) |
| Minor: PersonAutocomplete vs PersonReferenceField | Clarified | Phase 4a |
| Minor: Fixture constrained fields | Addressed | Phase 1f |
| Minor: Snapshot format impact | Addressed | Data Model Changes section |
| Minor: Test pattern reference | Fixed | Phase 5a (export.test.js, not derive-roster-merge) |
