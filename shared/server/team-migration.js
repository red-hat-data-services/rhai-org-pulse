/**
 * Migration logic for switching from Sheets-based team data to in-app management.
 * Converts _teamGrouping strings to first-class teams with teamIds,
 * and teamStructure.customFields config to field-definitions.json with _appFields.
 */

const { createTeam, REGISTRY_KEY } = require('./team-store');
const { createFieldDefinition } = require('./field-store');
const { appendAuditEntry } = require('./audit-log');

/**
 * Build a name→uid lookup from the registry for person-reference resolution.
 */
function buildNameToUid(registry) {
  const map = {};
  for (const [uid, person] of Object.entries(registry.people || {})) {
    if (person.name) {
      map[person.name.toLowerCase().trim()] = uid;
    }
  }
  return map;
}

/**
 * Try to resolve a raw field value (possibly containing multiple person names)
 * into an array of UIDs by greedily matching against known roster names.
 * Names are sorted longest-first to avoid partial matches.
 */
function resolvePersonNames(rawValue, nameToUid) {
  if (!rawValue || typeof rawValue !== 'string') return [];

  // Split by comma first if present, then resolve each part
  const parts = rawValue.includes(',')
    ? rawValue.split(',').map(s => s.trim()).filter(Boolean)
    : [rawValue.trim()];

  const sortedNames = Object.keys(nameToUid).sort((a, b) => b.length - a.length);
  const resolved = [];

  for (const part of parts) {
    // Try exact match first
    const uid = nameToUid[part.toLowerCase().trim()];
    if (uid) {
      resolved.push(uid);
      continue;
    }

    // Greedy matching for space-concatenated or run-together names
    let remaining = part.toLowerCase().trim();
    for (const name of sortedNames) {
      const idx = remaining.indexOf(name);
      if (idx !== -1) {
        resolved.push(nameToUid[name]);
        remaining = (remaining.substring(0, idx) + remaining.substring(idx + name.length)).trim();
        if (!remaining) break;
      }
    }
  }

  return resolved;
}

/**
 * Analyze existing field data and return a preview for the migration UI.
 * For each custom field, returns unique values, suggested type, multi-value detection,
 * and person-reference match info.
 */
function previewMigration(storage, config) {
  const registry = storage.readFromStorage(REGISTRY_KEY);
  if (!registry || !registry.people) {
    return { fields: [], totalPeople: 0 };
  }

  const customFieldsConfig = config.teamStructure?.customFields;
  if (!Array.isArray(customFieldsConfig) || customFieldsConfig.length === 0) {
    return { fields: [], totalPeople: Object.keys(registry.people).length };
  }

  const nameToUid = buildNameToUid(registry);

  const fields = [];

  for (const cfConfig of customFieldsConfig) {
    const rawValues = [];
    let populatedCount = 0;

    for (const person of Object.values(registry.people)) {
      if (person.status !== 'active') continue;
      const value = person[cfConfig.key];
      if (value !== undefined && value !== null && value !== '') {
        rawValues.push(value);
        populatedCount++;
      }
    }

    // Detect multi-value by checking for commas
    const hasCommas = rawValues.some(v => typeof v === 'string' && v.includes(','));

    // Split all values (by comma if multi-value detected) to get individual values
    const individualValues = new Set();
    for (const v of rawValues) {
      if (hasCommas && typeof v === 'string') {
        for (const part of v.split(',').map(s => s.trim()).filter(Boolean)) {
          individualValues.add(part);
        }
      } else {
        individualValues.add(String(v));
      }
    }

    // Try person-reference matching
    let personMatchCount = 0;
    const matchedNames = new Set();
    const unmatchedValues = new Set();

    for (const val of individualValues) {
      // Try exact match first, then greedy multi-name matching
      if (nameToUid[val.toLowerCase().trim()]) {
        personMatchCount++;
        matchedNames.add(val);
      } else {
        const resolved = resolvePersonNames(val, nameToUid);
        if (resolved.length > 0) {
          personMatchCount++;
          matchedNames.add(val);
        } else {
          unmatchedValues.add(val);
        }
      }
    }

    const uniqueCount = individualValues.size;
    const matchRate = uniqueCount > 0 ? personMatchCount / uniqueCount : 0;

    // Suggest type
    let suggestedType = 'free-text';
    if (matchRate >= 0.5) {
      suggestedType = 'person-reference-linked';
    } else if (uniqueCount <= 50) {
      suggestedType = 'constrained';
    }

    const suggestedMultiValue = hasCommas || (suggestedType === 'person-reference-linked' && rawValues.some(v => {
      const resolved = resolvePersonNames(v, nameToUid);
      return resolved.length > 1;
    }));

    fields.push({
      key: cfConfig.key,
      label: cfConfig.displayLabel || cfConfig.key,
      visible: cfConfig.visible !== false,
      primaryDisplay: cfConfig.primaryDisplay || false,
      populatedCount,
      uniqueValues: [...individualValues].sort(),
      uniqueCount,
      hasCommas,
      suggestedType,
      suggestedMultiValue,
      personMatchRate: Math.round(matchRate * 100),
      matchedNames: [...matchedNames].sort(),
      unmatchedValues: [...unmatchedValues].sort()
    });
  }

  const activePeople = Object.values(registry.people).filter(p => p.status === 'active').length;
  return { fields, totalPeople: activePeople };
}

/**
 * Run one-time migration from Sheets to in-app team data.
 * Idempotent: checks _migratedToInApp flag in config.
 *
 * @param {object} storage
 * @param {object} config - roster-sync config (must have teamDataSource === 'in-app')
 * @param {string} actorEmail
 * @param {Array<{key: string, type: string, multiValue: boolean}>} [fieldOverrides] - per-field type overrides
 * @returns {{ migrated: boolean, teams: number, fields: number, assignments: number }}
 */
function migrateToInApp(storage, config, actorEmail, fieldOverrides) {
  // Already migrated — skip
  if (config._migratedToInApp) {
    return { migrated: false, teams: 0, fields: 0, assignments: 0 };
  }

  const registry = storage.readFromStorage(REGISTRY_KEY);
  if (!registry || !registry.people) {
    return { migrated: false, teams: 0, fields: 0, assignments: 0 };
  }

  // Build override lookup: key → { type, multiValue }
  const overrideMap = {};
  if (Array.isArray(fieldOverrides)) {
    for (const fo of fieldOverrides) {
      overrideMap[fo.key] = { type: fo.type || 'free-text', multiValue: !!fo.multiValue };
    }
  }

  // Build name→uid for person-reference resolution
  const nameToUid = buildNameToUid(registry);

  // ─── Step 1: Migrate teams from _teamGrouping ───

  const teamMap = new Map();

  for (const [uid, person] of Object.entries(registry.people)) {
    if (person.status !== 'active') continue;
    const grouping = person._teamGrouping;
    if (!grouping) continue;

    const teamNames = grouping.split(',').map(t => t.trim()).filter(Boolean);
    const orgKey = person.orgRoot || 'unknown';

    for (const name of teamNames) {
      if (name === '_unassigned') continue;
      const key = `${orgKey}::${name.toLowerCase()}`;
      if (!teamMap.has(key)) {
        teamMap.set(key, { name, orgKey, uids: [] });
      }
      teamMap.get(key).uids.push(uid);
    }
  }

  let teamsCreated = 0;
  let assignmentsCreated = 0;

  for (const person of Object.values(registry.people)) {
    if (!Array.isArray(person.teamIds)) person.teamIds = [];
  }

  for (const entry of teamMap.values()) {
    const team = createTeam(storage, entry.name, entry.orgKey, actorEmail);
    teamsCreated++;

    for (const uid of entry.uids) {
      const person = registry.people[uid];
      if (person && !person.teamIds.includes(team.id)) {
        person.teamIds.push(team.id);
        assignmentsCreated++;
      }
    }
  }

  // ─── Step 2: Migrate custom fields ───

  let fieldsCreated = 0;
  const customFieldsConfig = config.teamStructure?.customFields;

  if (Array.isArray(customFieldsConfig) && customFieldsConfig.length > 0) {
    for (const cfConfig of customFieldsConfig) {
      const override = overrideMap[cfConfig.key] || {};
      const fieldType = override.type || 'free-text';
      const multiValue = override.multiValue || false;

      // Collect all raw values to determine allowedValues for constrained fields
      const allIndividualValues = new Set();
      const rawEntries = []; // { person, rawValue }

      for (const person of Object.values(registry.people)) {
        if (person.status !== 'active') continue;
        const value = person[cfConfig.key];
        if (value !== undefined && value !== null && value !== '') {
          rawEntries.push({ person, rawValue: value });
          if (multiValue && typeof value === 'string' && value.includes(',')) {
            for (const part of value.split(',').map(s => s.trim()).filter(Boolean)) {
              allIndividualValues.add(part);
            }
          } else {
            allIndividualValues.add(String(value));
          }
        }
      }

      // Build allowedValues for constrained fields
      let allowedValues = null;
      if (fieldType === 'constrained') {
        allowedValues = [...allIndividualValues].sort();
      }

      const field = createFieldDefinition(storage, 'person', {
        label: cfConfig.displayLabel || cfConfig.key,
        type: fieldType,
        visible: cfConfig.visible !== false,
        primaryDisplay: cfConfig.primaryDisplay || false,
        multiValue,
        allowedValues
      }, actorEmail);
      fieldsCreated++;

      // Copy values from flat person fields to _appFields
      for (const { person, rawValue } of rawEntries) {
        if (!person._appFields) person._appFields = {};

        if (fieldType === 'person-reference-linked') {
          // Resolve person names to UIDs
          const resolved = resolvePersonNames(rawValue, nameToUid);
          person._appFields[field.id] = multiValue ? resolved : (resolved[0] || null);
        } else if (multiValue && typeof rawValue === 'string' && rawValue.includes(',')) {
          // Split comma-separated into array
          person._appFields[field.id] = rawValue.split(',').map(s => s.trim()).filter(Boolean);
        } else {
          person._appFields[field.id] = rawValue;
        }
      }
    }
  }

  // ─── Step 3: Write updated registry (preserving _teamGrouping) ───
  storage.writeToStorage(REGISTRY_KEY, registry);

  appendAuditEntry(storage, {
    action: 'migration.sheets_to_inapp',
    actor: actorEmail,
    entityType: 'system',
    entityId: 'migration',
    detail: `Migrated from Sheets: ${teamsCreated} teams, ${fieldsCreated} fields, ${assignmentsCreated} assignments`
  });

  return { migrated: true, teams: teamsCreated, fields: fieldsCreated, assignments: assignmentsCreated };
}

module.exports = { migrateToInApp, previewMigration, resolvePersonNames, buildNameToUid };
