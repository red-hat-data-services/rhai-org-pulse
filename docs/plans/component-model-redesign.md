# Component Model Redesign

## Problem Statement

Components currently exist in two loosely coupled systems:

1. **Spreadsheet-sourced team-level components** (`org-roster/components.json`): A `componentName -> [teamNames]` mapping parsed from a Google Sheets "Summary components per team" tab during org-sync. This feeds the TeamCard badges and TeamBacklogTab.

2. **Person-level component field** (`customFields.component` / `customFields.jiraComponent`): A simple string on individual person records, displayed in PersonProfileView and TeamMembersTable.

Neither system is well-suited for multi-team people. Staff engineers and architects assigned to multiple teams have their component values leak across all teams. Additionally, the spreadsheet-sourced component mapping is fragile, requires manual sheet maintenance, and has no in-app editing capability.

### Requirements

- **Team-level components**: Independently managed per team by team admins, completely decoupled from person assignments. Editable in-app using the existing constrained/autocomplete UX pattern.
- **Person-level components**: Global per person (one list regardless of team membership). Remains manually editable with suggestions from a shared field option set.
- **Shared field options**: A global list of valid component names, reused for both team-level and person-level component selection via autocomplete.
- **Generic field options system**: The field options pattern must be reusable for future shared fields beyond components. Adding a second field option set later should be trivial -- just create the field option set and a field definition referencing it.
- **Migration**: Replace existing data structures in place. OK to change the data model.

## Proposed Solution

### Architecture Overview

Introduce a **generic field options system** for the team-tracker module, then use the existing field definition system to create team-level and person-level component fields that reference a "components" field option set. The field options system is designed to support multiple named option sets, though only "components" is created in v1.

### Data Model Changes

#### 1. Generic Field Options System (`data/team-data/field-options/<name>.json`)

Each field option set is a separate JSON file, identified by name. File path pattern: `data/team-data/field-options/<name>.json`.

Example for the "components" field option set (`data/team-data/field-options/components.json`):

```json
{
  "name": "components",
  "label": "Components",
  "values": [
    "Platform Core",
    "Platform Dashboard",
    "Infrastructure Services",
    "ML Models",
    "Data Pipelines"
  ],
  "updatedAt": "2026-04-29T12:00:00Z",
  "updatedBy": "admin@example.com"
}
```

Using one file per field option set (vs. a single `field-options.json`) means option sets are independently readable and writable without contention, and adding a new option set is just creating a new file.

The `name` field is the stable identifier referenced by `optionsRef` on field definitions. The `label` field is the human-readable name shown in the Manage UI. The `values` array is the ordered list of valid entries.

#### 2. Team-Level Components (via existing team metadata)

Add a new **team field definition** of type `constrained`, multi-value, with `allowedValues` sourced dynamically from the "components" field option set. The field definition is stored in `data/team-data/field-definitions.json` under `teamFields`:

```json
{
  "id": "field_comp01",
  "label": "Components",
  "type": "constrained",
  "multiValue": true,
  "required": false,
  "visible": true,
  "primaryDisplay": false,
  "allowedValues": null,
  "optionsRef": "components",
  "deleted": false,
  "order": 2,
  "createdAt": "2026-04-29T00:00:00.000Z",
  "createdBy": "system"
}
```

The key addition is `optionsRef: "components"` -- a new optional property on field definitions that tells the UI and validation layer to source `allowedValues` from the named field option set instead of a static list. When `optionsRef` is set, `allowedValues` is null in storage and resolved at runtime from the field options file.

Team component values are stored in `team.metadata` just like any other team field:

```json
{
  "id": "team_a1b2c3",
  "name": "Platform",
  "metadata": {
    "field_g7h8i9": "pmanager",
    "field_tf0001": "Active",
    "field_comp01": ["Platform Core", "Platform Dashboard"]
  }
}
```

#### 3. Person-Level Components (migrate existing field)

The existing person-level "Jira Component" or "Component" field (currently `free-text`) will be migrated to type `constrained`, `multiValue: true`, with `optionsRef: "components"`. This gives person-level components the same autocomplete UX while keeping them global per person. The migrated field label will be **"Component"** (singular) to match the existing `getCustomFieldByLabel(member, 'Component')` call in TeamMembersTable.vue.

#### 4. Deprecate `org-roster/components.json`

After migration, this file is no longer written during org-sync. The `componentsTab` config option becomes a no-op. The file is kept for one release cycle for rollback safety, then removed.

#### 5. Jira Component Name Coupling

Component names in the field option set serve double duty: they are both display labels and functional Jira identifiers used in the RFE backlog pipeline. The `componentMapping` config (in `org-roster/config.json`) maps app-level component names to Jira component names when they differ. This mapping must be preserved and remain functional after migration.

Specifically:
- `fetchAllRfeBacklog()` in `rfe.js` receives component names and uses `componentMapping[comp] || comp` to resolve Jira component names for JQL queries.
- The `triggerOrgSync()` function in org-teams.js calls `fetchAllRfeBacklog()` with the list of all team components.
- After migration, the component list fed to `fetchAllRfeBacklog()` will be sourced from team metadata instead of `org-roster/components.json`, but the same `componentMapping` config continues to translate app names to Jira names.
- The Field Options Manager UI should display a warning when a component name does not have a corresponding Jira component (either directly or via mapping), since this would mean RFE queries will fail silently for that component. This warning is specific to the "components" field option set; the generic field options UI provides a hook for option-set-specific warnings, but only the "components" option set implements one in v1.

### API Changes

#### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/modules/team-tracker/field-options` | Authenticated | List all field option sets (name, label, value count) |
| `GET` | `/api/modules/team-tracker/field-options/:name` | Authenticated | Get a single field option set by name (full values list) |
| `PUT` | `/api/modules/team-tracker/field-options/:name` | Admin | Replace a field option set's values (full overwrite) |
| `POST` | `/api/modules/team-tracker/field-options/:name/values` | Team Admin | Add one or more values to a field option set |
| `DELETE` | `/api/modules/team-tracker/field-options/:name/values` | Admin | Remove values from a field option set (body: `{ values: [...] }`) |

The `:name` parameter matches the option set's `name` field (e.g., "components"). Only "components" exists in v1, but the API is generic. Creating a new field option set is a future admin operation -- the `PUT` endpoint will create the file if it does not exist.

#### Modified Endpoints

| Method | Path | Change |
|--------|------|--------|
| `GET` | `/api/modules/team-tracker/org-teams` | `team.components` sourced from `team.metadata[componentFieldId]` instead of `org-roster/components.json` |
| `GET` | `/api/modules/team-tracker/org-teams/:teamKey` | Same as above |
| `GET` | `/api/modules/team-tracker/org-summary/:orgName` | `orgComponents` derived from enriched teams' metadata-sourced components instead of reading `org-roster/components.json` directly (see detail below) |
| `GET` | `/api/modules/team-tracker/structure/field-definitions` | Field definitions with `optionsRef` include resolved `allowedValues` from field options |
| `GET` | `/api/modules/team-tracker/components` | Deprecated. Reconstructs legacy `{ components: { name: [teams] } }` format from team metadata (see backward compatibility section) |
| `PATCH` | `/api/modules/team-tracker/structure/teams/:teamId/fields` | Validation for `optionsRef` fields checks against field options instead of static `allowedValues` |
| `PATCH` | `/api/modules/team-tracker/structure/person/:uid/fields` | Same options-based validation |

##### `org-summary` Route Fix (Critical)

The current `GET /org-summary/:orgName` route (org-teams.js lines 314-320) reads `org-roster/components.json` directly, bypassing `buildEnrichedTeams()`. After migration, this would return empty/stale data. The fix:

```javascript
// BEFORE (broken after migration):
const compData = readFromStorage('org-roster/components.json');
const orgComponents = [];
if (compData) {
  for (const [comp, teamNames] of Object.entries(compData.components || {})) {
    if (teams.some(t => teamNames.includes(t.name))) orgComponents.push(comp);
  }
}

// AFTER: derive from enriched teams (which already have metadata-sourced components)
const orgComponents = [...new Set(teams.flatMap(t => t.components || []))];
```

This is clean because `buildEnrichedTeams()` is already called on line 294 and the returned `teams` array will contain the metadata-sourced `components` after the Phase 3 changes. The `rfeByComponent` aggregation on lines 322-330 then works unchanged against the same component names.

#### Backward Compatibility

- `team.components` continues to appear in org-teams API responses, but is now sourced from team metadata. No client-side contract change.
- The `componentsTab` configuration option is preserved but ignored when teams have in-app component data.

##### `GET /components` Backward-Compatible Adapter

The current response format is `{ components: { "ComponentName": ["TeamA", "TeamB"] } }` -- a component-to-teams mapping. This must be reconstructed from team metadata:

```javascript
router.get('/components', function(req, res) {
  try {
    const { teams } = buildEnrichedTeams();
    const components = {};
    for (const team of teams) {
      for (const comp of (team.components || [])) {
        if (!components[comp]) components[comp] = [];
        if (!components[comp].includes(team.name)) {
          components[comp].push(team.name);
        }
      }
    }
    res.set('X-Deprecated', 'Use team metadata components field instead');
    res.json({ components });
  } catch {
    res.status(500).json({ error: 'Failed to load component data' });
  }
});
```

This iterates all enriched teams and inverts their `components` arrays to produce the legacy `componentName -> [teamNames]` format. The `X-Deprecated` header signals consumers to migrate.

### Backend Implementation

#### `modules/team-tracker/server/field-options-store.js` (new)

This module lives in the team-tracker module directory, not in `shared/server/`, because field options are team-tracker-specific. Per the `shared/API.md` stability contract, code should only be promoted to `shared/` when a second consumer exists.

The store is generic -- it operates on any named field option set, not just "components":

```javascript
const { appendAuditEntry } = require('../../../shared/server/audit-log');

const FIELD_OPTIONS_DIR = 'team-data/field-options';

function optionsKey(name) {
  // Sanitize name to prevent path traversal
  const safe = name.replace(/[^a-z0-9_-]/gi, '');
  return `${FIELD_OPTIONS_DIR}/${safe}.json`;
}

function readFieldOptions(storage, name) {
  return storage.readFromStorage(optionsKey(name)) || null;
}

function writeFieldOptions(storage, name, data) {
  storage.writeToStorage(optionsKey(name), data);
}

/**
 * List all field option sets (summary: name, label, value count).
 */
function listFieldOptions(storage) {
  const files = storage.listFromStorage(FIELD_OPTIONS_DIR);
  return files
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const data = storage.readFromStorage(`${FIELD_OPTIONS_DIR}/${f}`);
      return data ? { name: data.name, label: data.label, count: (data.values || []).length } : null;
    })
    .filter(Boolean);
}

/**
 * Get field option values by name.
 * Returns the values array, or null if the option set does not exist.
 */
function getValues(storage, name) {
  const options = readFieldOptions(storage, name);
  return options ? options.values || [] : null;
}

/**
 * Add values to a field option set. Creates the option set if it does not exist.
 */
function addValues(storage, name, values, actorEmail) {
  let options = readFieldOptions(storage, name);
  if (!options) {
    options = { name, label: name.charAt(0).toUpperCase() + name.slice(1), values: [] };
  }

  const existing = new Set(options.values);
  const added = [];
  for (const v of values) {
    const trimmed = v.trim();
    if (trimmed && !existing.has(trimmed)) {
      options.values.push(trimmed);
      existing.add(trimmed);
      added.push(trimmed);
    }
  }

  if (added.length > 0) {
    options.values.sort();
    options.updatedAt = new Date().toISOString();
    options.updatedBy = actorEmail;
    writeFieldOptions(storage, name, options);

    appendAuditEntry(storage, {
      action: 'field-options.add',
      actor: actorEmail,
      entityType: 'field-options',
      entityId: name,
      detail: `Added ${added.length} values to "${name}": ${added.join(', ')}`
    });
  }

  return { added, total: options.values.length };
}

/**
 * Replace all values in a field option set.
 */
function replaceValues(storage, name, values, label, actorEmail) {
  const deduped = [...new Set(values.map(v => v.trim()).filter(Boolean))].sort();
  const options = {
    name,
    label: label || name.charAt(0).toUpperCase() + name.slice(1),
    values: deduped,
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail
  };
  writeFieldOptions(storage, name, options);

  appendAuditEntry(storage, {
    action: 'field-options.replace',
    actor: actorEmail,
    entityType: 'field-options',
    entityId: name,
    detail: `Replaced "${name}" field options with ${deduped.length} values`
  });

  return options;
}

/**
 * Remove values from a field option set.
 */
function removeValues(storage, name, valuesToRemove, actorEmail) {
  const options = readFieldOptions(storage, name);
  if (!options) return null;

  const removeSet = new Set(valuesToRemove);
  const before = options.values.length;
  options.values = options.values.filter(v => !removeSet.has(v));
  const removed = before - options.values.length;

  if (removed > 0) {
    options.updatedAt = new Date().toISOString();
    options.updatedBy = actorEmail;
    writeFieldOptions(storage, name, options);

    appendAuditEntry(storage, {
      action: 'field-options.remove',
      actor: actorEmail,
      entityType: 'field-options',
      entityId: name,
      detail: `Removed ${removed} values from "${name}"`
    });
  }

  return { removed, total: options.values.length };
}
```

**Concurrency note**: The read-modify-write pattern in `addValues` has no locking, which is consistent with every other store in the codebase (`field-store.js`, `team-store.js`, `role-store.js` -- none use locks). The Express server is single-threaded, so concurrent writes can only happen if two async request handlers interleave at an `await` boundary. Since `addValues` is fully synchronous (no `await` between read and write), this is safe. The `replaceValues` function is a full overwrite, so last-write-wins semantics are acceptable.

#### Changes to `shared/server/field-store.js`

##### Property allowlist updates

Both `createFieldDefinition()` and `updateFieldDefinition()` have hardcoded property allowlists that must be extended to include `optionsRef`:

```javascript
// createFieldDefinition() — line ~136, add optionsRef to the field object:
const field = {
  id: generateFieldId(),
  label: definition.label,
  type: fieldType,
  multiValue: definition.multiValue || false,
  required: definition.required || false,
  visible: definition.visible !== false,
  primaryDisplay: definition.primaryDisplay || false,
  allowedValues: definition.allowedValues || null,
  optionsRef: definition.optionsRef || null,   // <-- ADD
  deleted: false,
  order: fields.length,
  createdAt: new Date().toISOString(),
  createdBy: actorEmail
};

// updateFieldDefinition() — line ~194, add optionsRef to the allowed keys:
if (['label', 'type', 'required', 'visible', 'primaryDisplay',
     'allowedValues', 'multiValue', 'optionsRef'].includes(k)) {
  //                              ^^^^^^^^^^^ ADD
  changes[k] = { old: field[k], new: v };
  field[k] = v;
}
```

##### Validation logic update

The current `validateFieldValues()` (line 90) guards constrained validation with `if (fieldDef.type === 'constrained' && fieldDef.allowedValues)`. Since options-ref-backed fields have `allowedValues: null`, the entire validation block is skipped. The fix:

**Circular dependency concern**: `field-store.js` (in `shared/server/`) cannot import from `modules/team-tracker/server/`. To solve this, `validateFieldValues()` accepts an optional `optionsResolver` callback parameter:

```javascript
function validateFieldValues(storage, scope, fieldValues, existingValues, { optionsResolver } = {}) {
  // ...
  if (fieldDef.type === 'constrained') {
    let allowed = fieldDef.allowedValues;

    if (!allowed && fieldDef.optionsRef && optionsResolver) {
      allowed = optionsResolver(fieldDef.optionsRef);
    }

    if (allowed && allowed.length > 0) {
      const vals = Array.isArray(value) ? value : (value ? [value] : []);
      for (const v of vals) {
        if (!allowed.includes(v)) {
          warnings.push(`Value "${v}" is not in the allowed options for "${fieldDef.label}"`);
        }
      }
    }
  }
  // ...
}
```

**Important**: This emits warnings, not errors, for values outside the field options. This is intentional -- it matches the existing behavior for constrained fields and allows orphaned values to persist after option set changes.

Callers in the team-tracker module routes pass a resolver that uses the generic field options store:

```javascript
const fieldOptionsStore = require('./field-options-store');
const optionsResolver = (ref) => {
  return fieldOptionsStore.getValues(storage, ref);
};
const { validated, warnings, errors } = fieldStore.validateFieldValues(
  storage, 'team', req.body, existingValues, { optionsResolver }
);
```

The resolver is generic -- it resolves any field option set name, not just "components". This means when a second option set is added in the future, no changes to the resolver or validation logic are needed.

##### `MAX_ALLOWED_VALUES` cap handling

The existing `validateAllowedValues()` function enforces a 100-item cap. This limit applies to **static** `allowedValues` stored in field definitions. Options-ref-backed fields have `allowedValues: null` in their field definition, so `validateAllowedValues()` is never called for them (it short-circuits on `if (allowedValues == null) return null`). The field option set itself has no size cap since it is stored separately and resolved at runtime. The resolved values are injected into the field definition API response (see "Field Definition API Response Enhancement" below) for client-side autocomplete only -- they are never persisted back to the field definition's `allowedValues`.

#### Changes to `modules/team-tracker/server/routes/org-teams.js`

##### `buildEnrichedTeams()` component sourcing

Replace the `componentMap` lookup (lines 70-72, 120-123) with reading components from team metadata:

```javascript
// Remove these lines:
const compData = readFromStorage('org-roster/components.json');
const componentMap = compData?.components || {};

// Remove the component lookup loop (lines 120-123):
// const components = [];
// for (const [comp, teamNames] of Object.entries(componentMap)) {
//   if (teamNames.includes(name)) components.push(comp);
// }

// Instead, after the structure enrichment block (line 148), read components
// from team metadata using the component field definition ID:
const fieldDefs = require('../../../../shared/server/field-store').readFieldDefinitions(storage);
const componentFieldDef = (fieldDefs.teamFields || []).find(
  f => !f.deleted && f.optionsRef === 'components'
);
const componentFieldId = componentFieldDef?.id;

// In the team-building loop, set components from metadata:
// (replaces the old componentMap lookup)
const components = componentFieldId && structure?.metadata?.[componentFieldId]
  ? [].concat(structure.metadata[componentFieldId])
  : [];
```

Note: The field definition lookup uses `optionsRef === 'components'` rather than label matching because `optionsRef` is a programmatic identifier set during migration and not subject to user renaming. This is a deliberate choice -- see "Design Decisions" section for rationale.

##### `org-summary` route

Replace the direct `org-roster/components.json` read (lines 314-320) with:

```javascript
const orgComponents = [...new Set(teams.flatMap(t => t.components || []))];
```

This works because `teams` is already returned by `buildEnrichedTeams()` (called on line 294) and will contain the metadata-sourced components after the changes above.

#### Changes to `modules/team-tracker/server/org-sync.js`

- `runSync()`: Skip writing `org-roster/components.json` when in-app component data exists. Optionally seed the component field options from the spreadsheet on first migration.
- The `triggerOrgSync()` function in org-teams.js calls `fetchAllRfeBacklog()` with `teams.flatMap(t => t.components || [])`. After migration, `team.components` is sourced from metadata, so the RFE pipeline gets the correct component names automatically.

### UI Changes

#### TeamCard (`modules/team-tracker/client/components/TeamCard.vue`)

No changes needed. The `team.components` array is already rendered from the API response; the API will now source it from metadata.

#### TeamFieldEditor (`modules/team-tracker/client/components/TeamFieldEditor.vue`)

No changes needed for basic editing. The `ConstrainedAutocomplete` component already handles multi-value constrained fields. The options-ref-backed field will appear as a regular constrained field.

#### ConstrainedAutocomplete (`modules/team-tracker/client/components/ConstrainedAutocomplete.vue`)

No changes needed. The preferred approach resolves field options server-side and includes them in the field definition response, so this component receives `allowedValues` as it always has.

#### Field Definition API Response Enhancement

The `GET /structure/field-definitions` endpoint will resolve `optionsRef` fields by merging field option values into `allowedValues` in the response. This way, the existing `ConstrainedAutocomplete` component works unchanged -- it already reads `field.allowedValues`.

Important: The resolved values are injected into the **API response only**, not persisted to the field definition file. This avoids the `MAX_ALLOWED_VALUES` (100-item) cap in `validateAllowedValues()`, which only applies to static `allowedValues` written to field definitions. The response field will carry a `_resolvedFromOptions: true` flag so clients can distinguish resolved values from static ones if needed.

#### TeamBacklogTab (`modules/team-tracker/client/components/TeamBacklogTab.vue`)

No changes needed. Receives `components` prop from TeamRosterView, which gets it from the API.

#### PersonProfileView (`modules/team-tracker/client/views/PersonProfileView.vue`)

The `personComponent` computed property currently reads `customFields.component` as a string. After migration, the person's component field will be a multi-value constrained field rendered by PersonFieldEditor. The hardcoded `personComponent` display should be removed in favor of the field editor's rendering.

#### TeamMembersTable (`modules/team-tracker/client/components/TeamMembersTable.vue`)

##### `_appFields` vs `customFields` data flow

In in-app mode, the API response builds `member.customFields` from `person._appFields` keyed by field definition ID (see `modules/team-tracker/server/index.js` line 176: `memberEntry.customFields[fieldDef.id] = person._appFields?.[fieldDef.id] || null`). The `getCustomFieldByLabel()` function in TeamMembersTable then searches `member.customFields` by matching field definition labels.

After migration:
- The person's component values live in `person._appFields[fieldId]` (e.g., `_appFields.field_d4e5f6 = ["Platform Core"]`)
- The API maps this to `customFields[fieldId] = ["Platform Core"]`
- `getCustomFieldByLabel(member, 'Component')` finds this by matching the field definition label "Component" to the field ID key

The `getComponent()` function (line 270-273) currently has several fallback paths:

```javascript
function getComponent(member) {
  return getCustomFieldByLabel(member, 'Component')
    || member.customFields?.component || member.customFields?.jiraComponent
    || member.component || '---'
}
```

After migration, `getCustomFieldByLabel(member, 'Component')` will work correctly because:
1. The migrated field definition label is "Component" (singular, matching the lookup)
2. In in-app mode, `customFields` keys are field IDs, and `getCustomFieldByLabel` already handles this by searching field definitions for a matching label

The fallback paths (`customFields?.component`, `customFields?.jiraComponent`, `member.component`) become dead code after migration but are harmless. They can be cleaned up in a follow-up.

**Important**: The migrated field label MUST be "Component" (singular), not "Components" (plural). The team-level field is "Components" (plural, since teams have multiple). The person-level field is "Component" (singular, matching the existing `getCustomFieldByLabel` call and the existing column header).

#### Settings / Field Definition Manager

No changes needed. The existing FieldDefinitionManager UI allows creating/editing constrained fields. The component field option set will be auto-created by migration and can be managed through the existing UI.

#### Field Options Manager (Manage Page)

The field options management UI lives in the **Manage page** (`ManageView.vue`) of the team-tracker module, alongside the existing "Teams" and "Fields" tabs. A new **"Field Options"** tab is added.

The Manage page is the correct location because:
- It already houses team and field management (the same permission tier: admin/team-admin)
- It is module-scoped (team-tracker), matching the field options store's module scope
- Settings is for platform-level configuration; field options are data management

##### ManageView.vue changes

Add a third tab:

```javascript
const tabs = [
  { id: 'teams', label: 'Teams' },
  { id: 'fields', label: 'Fields' },
  { id: 'field-options', label: 'Field Options' }   // <-- ADD
]
```

And render the new component:

```html
<FieldOptionsManager v-if="activeTab === 'field-options'" />
```

##### FieldOptionsManager component

A new generic component at `modules/team-tracker/client/components/FieldOptionsManager.vue`:

- **List view**: Shows all field option sets (`GET /field-options`) with name, label, and value count. Clicking an option set opens its detail view.
- **Detail view**: Shows all values in the selected option set with:
  - Add new values (text input + add button)
  - Remove values (with confirmation, shows warning if any team/person field references the value)
  - Option-set-specific warnings panel (for "components" option set: flags values with no Jira component match)
- **No option set creation UI in v1**: Only "components" exists. Future option sets can be created via the API or a future UI enhancement.

The component is generic -- it works with any field option set, not just "components". The Jira component mapping warning is implemented as an option-set-specific enhancement: the component checks if the option set name is "components" and, if so, fetches the RFE config to cross-reference `componentMapping`.

### Migration Strategy

Migration is a one-time server-side operation triggered via the admin Manage page (similar to the existing Sheets-to-in-app migration pattern).

#### Migration Steps

1. **Seed component field options**: Read `org-roster/components.json` and extract all unique component names. Also scan all person records for `_appFields` values on any field definition with label containing "component" (case-insensitive), plus legacy `customFields.component` / `customFields.jiraComponent` values. Write to `team-data/field-options/components.json`.

2. **Create team-level component field definition**: Add a new entry to `field-definitions.json` under `teamFields` with `type: "constrained"`, `multiValue: true`, `optionsRef: "components"`, `label: "Components"` (plural for team-level).

3. **Populate team component metadata**: For each team in `teams.json`, look up its components from `org-roster/components.json` (the old `componentName -> [teamNames]` mapping) and write them into `team.metadata[newFieldId]`.

4. **Migrate person-level component field**: Find the existing person-level component field definition using a multi-strategy lookup:
   - First, look for a field with `optionsRef: "components"` (already migrated -- idempotency guard)
   - Then, look for a field with label matching "component" or "jira component" (case-insensitive)
   - If no match found, create a new person field with label "Component"

   Update the matched/created field: set `type: "constrained"`, `multiValue: true`, `optionsRef: "components"`. For each person with a component value (whether in `_appFields[fieldId]` or legacy `customFields.component`), convert the string value to a single-element array in `_appFields[fieldId]`.

5. **Mark migration complete**: Write a `migrationDone: true` flag to the field options file (`team-data/field-options/components.json`) to prevent re-running. The migration endpoint checks this flag and returns early with a message if already complete.

6. **Summary response**: The migration endpoint returns a summary of what was done: `{ fieldOptionsSeeded: N, teamFieldCreated: true, teamsPopulated: N, personFieldMigrated: true, personsUpdated: N }`.

#### Rollback

- The old `org-roster/components.json` file is preserved and not deleted.
- If the migration needs to be reverted, the old field types can be restored via the field definition manager.
- No destructive changes are made to person records (values are only converted from string to array, which the `coerceFieldValue` function already handles bidirectionally).

### Design Decisions

#### Why `optionsRef` lookup instead of field ID

The plan uses `optionsRef === 'components'` to find the component field definition in `buildEnrichedTeams()` rather than looking up by field ID or label. This is a deliberate choice:

- **Field ID**: Generated randomly (`field_` + random hex). Would require hardcoding a specific ID or storing a config reference. Fragile across deployments.
- **Field label**: User-editable. If someone renames "Components" to "Jira Components", the lookup breaks silently.
- **`optionsRef`**: A programmatic identifier set during migration, not exposed in any rename UI, and semantically meaningful ("this field is backed by the components field option set"). It is a new dimension on field definitions, but it serves a specific purpose that ID and label cannot.

The `optionsRef` property is set once during migration and is not editable through the FieldDefinitionManager UI. It functions as a stable programmatic marker.

#### Why one file per field option set

Using `team-data/field-options/<name>.json` instead of a single `team-data/field-options.json`:

- **Independent read/write**: Option sets can be read and written without loading all option data. No contention between unrelated option sets.
- **Trivial addition**: Creating a new option set is just writing a new file. No need to read-modify-write a shared file.
- **Consistent with existing patterns**: The codebase uses per-entity files elsewhere (e.g., `data/people/{name}.json` for person metrics).
- **Storage layer support**: `storage.listFromStorage(dir)` already supports directory listing.

#### Why generic field options store in v1

Although only "components" exists in v1, the field options store, API endpoints, and Manage UI are all generic from day one:

- **Marginal cost is near zero**: The difference between a generic store and a components-specific store is a `name` parameter. The API pattern (`/field-options/:name`) is standard REST.
- **Future extensibility**: Adding a second field option set (e.g., "focus-areas", "technologies") requires only creating an option set file and a field definition with `optionsRef: "focus-areas"`. No code changes to the store, API, validation, or UI.
- **Avoids a v2 rewrite**: Baking in "components" assumptions now would require refactoring all layers when a second option set is needed.

### Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `modules/team-tracker/server/field-options-store.js` | **New** | Generic field options CRUD (module-scoped, not shared) |
| `shared/server/field-store.js` | Modify | Add `optionsRef` to create/update allowlists; add `optionsResolver` callback param to `validateFieldValues()` |
| `modules/team-tracker/server/index.js` | Modify | Add generic field options API routes (`/field-options/:name`); pass `optionsResolver` to field validation calls; resolve field options in field-definitions response |
| `modules/team-tracker/server/routes/org-teams.js` | Modify | Source `team.components` from team metadata; fix `org-summary` route; rewrite `GET /components` as backward-compat adapter |
| `modules/team-tracker/server/org-sync.js` | Modify | Skip component sheet sync when in-app data exists |
| `modules/team-tracker/client/views/ManageView.vue` | Modify | Add "Field Options" tab |
| `modules/team-tracker/client/components/FieldOptionsManager.vue` | **New** | Generic field options management UI for Manage page |
| `modules/team-tracker/client/views/PersonProfileView.vue` | Modify | Remove hardcoded `personComponent` in favor of field editor |
| `modules/team-tracker/client/components/TeamMembersTable.vue` | Modify | Clean up dead-code fallbacks in `getComponent()` (low priority, existing code still works) |
| `fixtures/team-data/field-definitions.json` | Modify | Add team-level "Components" field definition with `optionsRef` |
| `fixtures/team-data/teams.json` | Modify | Add component metadata to fixture teams |
| `fixtures/team-data/field-options/components.json` | **New** | Demo fixture for components field options |
| `fixtures/org-roster/components.json` | Keep | Preserved for backward compatibility during transition |
| `modules/team-tracker/__tests__/server/org-teams.test.js` | Modify | Update mocks: replace `org-roster/components.json` with team metadata and field definitions |
| `modules/team-tracker/__tests__/` | **New** | Tests for field options store, migration, options-ref-backed field validation |

### Testability

#### Unit Tests

- `field-options-store.js`: Generic CRUD operations (add, replace, remove, list), deduplication, sorting, audit logging, path sanitization, multi-option-set isolation
- `field-store.js`: `optionsRef` persisted through create/update; `optionsResolver` callback in `validateFieldValues` produces correct warnings; options resolver returning null (unknown option set) does not crash
- `org-teams.js`: `buildEnrichedTeams` sourcing components from team metadata; `org-summary` deriving `orgComponents` from enriched teams; `GET /components` backward-compat adapter producing correct inverted mapping
- Migration logic: End-to-end migration from old format to new format, idempotency, multi-strategy field lookup

#### Integration Tests

- API route tests for generic field options endpoints (`/field-options`, `/field-options/:name`, `/field-options/:name/values`)
- Field definition response includes resolved field option values (with `_resolvedFromOptions` flag)
- Team PATCH with options-ref-backed field validates correctly via `optionsResolver`
- `GET /components` returns correct legacy format after migration

#### Manual Testing

- Create/edit team components via TeamFieldEditor
- Verify TeamCard shows correct components
- Verify TeamBacklogTab shows correct components and RFE counts
- Verify person component editing with autocomplete
- Run migration on existing data and verify output
- Verify demo mode works with fixture data
- Verify `org-summary` returns correct components after migration
- Verify RFE backlog pipeline works with metadata-sourced components
- Verify Manage page Field Options tab shows option set list and detail editing

### Deployability

- **No database migrations**: All changes are filesystem-based JSON.
- **Backward compatible API**: `team.components` array shape is unchanged in API responses.
- **Feature flag not needed**: The migration is admin-triggered and idempotent.
- **Rollback**: Preserve old files; field type changes are reversible.
- **PVC**: No new PVC mounts needed; new files go in existing `data/` directory.
- **CI**: No new environment variables or secrets required.

### Phased Implementation

#### Phase 1: Backend Foundation
1. Create `modules/team-tracker/server/field-options-store.js` with generic CRUD operations and audit logging
2. Add `optionsRef` to `field-store.js` create/update property allowlists
3. Add `optionsResolver` callback parameter to `validateFieldValues()`
4. Add generic field options API routes to `modules/team-tracker/server/index.js` (`/field-options`, `/field-options/:name`, `/field-options/:name/values`)
5. Write unit tests for field options store and field-store changes

#### Phase 2: Migration
1. Implement migration logic (in `modules/team-tracker/server/migration/`)
2. Add migration trigger endpoint (admin-only POST)
3. Seed "components" field options from existing component data into `team-data/field-options/components.json`
4. Create team-level component field definition (label: "Components", optionsRef: "components")
5. Populate team metadata from old component mapping
6. Migrate person-level component field (label: "Component", optionsRef: "components")
7. Multi-strategy field lookup with idempotency guard
8. Test migration on fixture data and write integration tests

#### Phase 3: API Updates
1. Update `buildEnrichedTeams()` to source components from team metadata via `optionsRef` field lookup
2. Fix `org-summary` route to derive `orgComponents` from enriched teams
3. Rewrite `GET /components` as backward-compat adapter with deprecation header
4. Update field-definitions endpoint to resolve field option values into response
5. Pass `optionsResolver` to all `validateFieldValues` calls in team-tracker routes
6. Update org-sync to skip component sheet writes
7. Update `modules/team-tracker/__tests__/server/org-teams.test.js` mocks

#### Phase 4: Frontend Updates
1. Update `PersonProfileView.vue` to remove hardcoded component display
2. Verify `TeamMembersTable.vue` `getComponent()` works with migrated field (label "Component" matches)
3. Add "Field Options" tab to `ManageView.vue`
4. Create `FieldOptionsManager.vue` component (generic, works with any field option set)
5. Add Jira component mapping warnings for "components" option set
6. Update demo fixtures (including `fixtures/team-data/field-options/components.json`)
7. Manual QA across all views

### Out-of-Scope for v1

- **`docs/DATA-FORMATS.md` update**: Should be updated to document the new field options file format and the `optionsRef` property on field definitions. Will be done as a follow-up documentation task after implementation stabilizes.
- **`demo-storage.js` code changes**: Not needed. The demo storage layer reads any path under `fixtures/` generically -- adding `fixtures/team-data/field-options/components.json` is sufficient. No code changes required in `demo-storage.js`.
- **Field option set creation UI**: No UI for creating new field option sets in v1. New option sets can be created via the API (`PUT /field-options/:name`) or programmatically during a future migration.
- **Field option descriptions or categories**: Keep option values as flat strings for simplicity. Can be extended later.
- **Cascade-remove on option deletion**: No. Warn the admin about existing references but allow orphaned values. The validation layer flags them as warnings, not errors.

### Open Questions (Resolved)

1. **Should adding a new component value during team/person editing auto-add it to the field options?**

   **Decision: No.** The original proposal created a privilege escalation: person field editing requires only manager permissions, but field options modification requires Team Admin. Instead, the ConstrainedAutocomplete component only offers values from the field options. To add a new component, an admin/team-admin must use the Field Options Manager on the Manage page. This is consistent with how constrained fields work today -- the allowed values are managed separately from the field editing UI.

2. **Should removing a component from the field options cascade-remove it from teams/people?**

   **Decision: No.** Warn the admin about existing references but allow orphaned values. The validation layer flags them as warnings, not errors.
