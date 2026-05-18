/**
 * Generic field-to-field-options migration.
 *
 * Takes an existing person or team field, extracts its unique values across all
 * records, creates a field option set from those values, and links the source
 * field to it via optionsRef. Optionally creates a counterpart field on the
 * other scope (e.g., a team-level field when sourcing from a person field),
 * with member-derived seeding.
 */

const fieldOptionsStore = require('../field-options-store');
const fieldStore = require('../../../../shared/server/field-store');
const teamStore = require('../../../../shared/server/team-store');
const { appendAuditEntry } = require('../../../../shared/server/audit-log');

const REGISTRY_KEY = 'team-data/registry.json';

/**
 * Preview what a migration would do without executing it.
 * @param {object} storage
 * @param {string} sourceFieldId - The field definition ID to extract values from
 * @returns {{ field, scope, uniqueValues, recordCount } | { error }}
 */
function previewMigration(storage, sourceFieldId) {
  const fieldDefs = fieldStore.readFieldDefinitions(storage);

  // Find the source field in either scope
  let scope = null;
  let field = (fieldDefs.personFields || []).find(f => f.id === sourceFieldId && !f.deleted);
  if (field) {
    scope = 'person';
  } else {
    field = (fieldDefs.teamFields || []).find(f => f.id === sourceFieldId && !f.deleted);
    if (field) scope = 'team';
  }

  if (!field) return { error: 'Field not found' };
  if (field.optionsRef) return { error: 'Field already linked to a field option set' };

  const values = new Set();
  let recordCount = 0;

  if (scope === 'person') {
    const registry = storage.readFromStorage(REGISTRY_KEY);
    if (registry?.people) {
      for (const person of Object.values(registry.people)) {
        const val = person._appFields?.[sourceFieldId];
        if (val != null) {
          const vals = Array.isArray(val) ? val : [val];
          for (const v of vals) {
            if (v && typeof v === 'string') values.add(v.trim());
          }
          recordCount++;
        }
      }
    }
  } else {
    const teamsData = teamStore.readTeams(storage);
    for (const team of Object.values(teamsData.teams || {})) {
      const val = team.metadata?.[sourceFieldId];
      if (val != null) {
        const vals = Array.isArray(val) ? val : [val];
        for (const v of vals) {
          if (v && typeof v === 'string') values.add(v.trim());
        }
        recordCount++;
      }
    }
  }

  return {
    field: { id: field.id, label: field.label, type: field.type, multiValue: !!field.multiValue },
    scope,
    uniqueValues: [...values].filter(Boolean).sort(),
    recordCount
  };
}

/**
 * Execute the migration.
 * @param {object} storage
 * @param {object} params
 * @param {string} params.sourceFieldId - Field to extract values from
 * @param {string} params.optionSetName - Name for the new option set (e.g., "components")
 * @param {string} params.optionSetLabel - Human label (e.g., "Components")
 * @param {boolean} [params.createCounterpart] - Create a field on the opposite scope
 * @param {string} [params.counterpartLabel] - Label for the counterpart field
 * @param {boolean} [params.seedFromMembers] - Seed counterpart team field from person members
 * @param {string} actorEmail
 */
function executeMigration(storage, params, actorEmail) {
  const { sourceFieldId, optionSetName, optionSetLabel, createCounterpart, counterpartLabel, seedFromMembers } = params;

  // Validate option set doesn't already exist
  const existing = fieldOptionsStore.readFieldOptions(storage, optionSetName);
  if (existing) {
    return { error: `Field option set "${optionSetName}" already exists` };
  }

  // Preview to get values and validate
  const preview = previewMigration(storage, sourceFieldId);
  if (preview.error) return preview;

  const summary = {
    optionSetCreated: optionSetName,
    valuesExtracted: preview.uniqueValues.length,
    sourceFieldUpdated: true,
    counterpartFieldCreated: false,
    teamsSeeded: 0,
    valuesConverted: 0
  };

  // Step 1: Create the field option set from extracted values
  fieldOptionsStore.replaceValues(storage, optionSetName, preview.uniqueValues, optionSetLabel, actorEmail);

  // Step 2: Update the source field to link to the option set
  fieldStore.updateFieldDefinition(storage, preview.scope, sourceFieldId, {
    type: 'constrained',
    multiValue: true,
    optionsRef: optionSetName,
    allowedValues: null
  }, actorEmail);

  // Step 2b: Convert any string values to arrays in source records
  if (preview.scope === 'person') {
    const registry = storage.readFromStorage(REGISTRY_KEY);
    if (registry?.people) {
      let converted = 0;
      for (const person of Object.values(registry.people)) {
        const val = person._appFields?.[sourceFieldId];
        if (val != null && typeof val === 'string') {
          person._appFields[sourceFieldId] = [val.trim()];
          converted++;
        }
      }
      if (converted > 0) {
        storage.writeToStorage(REGISTRY_KEY, registry);
        summary.valuesConverted = converted;
      }
    }
  } else {
    const teamsData = teamStore.readTeams(storage);
    let converted = 0;
    for (const team of Object.values(teamsData.teams || {})) {
      const val = team.metadata?.[sourceFieldId];
      if (val != null && typeof val === 'string') {
        team.metadata[sourceFieldId] = [val.trim()];
        converted++;
      }
    }
    if (converted > 0) {
      storage.writeToStorage('team-data/teams.json', teamsData);
      summary.valuesConverted = converted;
    }
  }

  // Step 3: Optionally create counterpart field on the opposite scope
  if (createCounterpart) {
    const counterpartScope = preview.scope === 'person' ? 'team' : 'person';
    const label = counterpartLabel || optionSetLabel || preview.field.label;

    const counterpartField = fieldStore.createFieldDefinition(storage, counterpartScope, {
      label,
      type: 'constrained',
      multiValue: true,
      required: false,
      visible: true,
      primaryDisplay: false,
      allowedValues: null,
      optionsRef: optionSetName
    }, actorEmail);
    summary.counterpartFieldCreated = true;

    // Step 4: Seed counterpart team field from person members
    if (seedFromMembers && preview.scope === 'person' && counterpartScope === 'team') {
      const registry = storage.readFromStorage(REGISTRY_KEY);
      const teamsData = teamStore.readTeams(storage);

      if (registry?.people && teamsData?.teams) {
        for (const [teamId, _team] of Object.entries(teamsData.teams)) {
          // Find members of this team
          const memberComponents = new Set();
          for (const person of Object.values(registry.people)) {
            if (Array.isArray(person.teamIds) && person.teamIds.includes(teamId)) {
              const val = person._appFields?.[sourceFieldId];
              if (val) {
                const vals = Array.isArray(val) ? val : [val];
                for (const v of vals) {
                  if (v && typeof v === 'string') memberComponents.add(v.trim());
                }
              }
            }
          }

          if (memberComponents.size > 0) {
            teamStore.updateTeamFields(storage, teamId, {
              [counterpartField.id]: [...memberComponents].sort()
            }, actorEmail);
            summary.teamsSeeded++;
          }
        }
      }
    }
  }

  appendAuditEntry(storage, {
    action: 'migration.field-to-options',
    actor: actorEmail,
    entityType: 'migration',
    entityId: optionSetName,
    detail: `Created "${optionSetName}" option set from ${preview.scope} field "${preview.field.label}" with ${summary.valuesExtracted} values` +
      (summary.counterpartFieldCreated ? `, created counterpart field` : '') +
      (summary.teamsSeeded > 0 ? `, seeded ${summary.teamsSeeded} teams from members` : '')
  });

  return summary;
}

module.exports = { previewMigration, executeMigration };
