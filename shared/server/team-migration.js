/**
 * Migration logic for switching from Sheets-based team data to in-app management.
 * Converts _teamGrouping strings to first-class teams with teamIds,
 * and teamStructure.customFields config to field-definitions.json with _appFields.
 */

const { REGISTRY_KEY } = require('./team-store');
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
 * Build a map of composite team keys to { name, orgKey, uids } from the registry.
 * Groups active people by their _teamGrouping values, skipping _unassigned.
 * Keys are normalized to lowercase for dedup, but original casing is preserved.
 * @param {object} registry - The people registry
 * @returns {Map<string, { name: string, orgKey: string, uids: string[] }>}
 */
function buildTeamMap(registry) {
  const teamMap = new Map();

  for (const [uid, person] of Object.entries(registry.people || {})) {
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

  return teamMap;
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
  const teamMap = buildTeamMap(registry);

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

    // Scope detection: check uniformity across teams
    let teamsWithAnyValue = 0;
    let teamsWithUniformValue = 0;

    for (const teamEntry of teamMap.values()) {
      const teamValues = new Set();
      for (const uid of teamEntry.uids) {
        const person = registry.people[uid];
        if (!person) continue;
        const val = person[cfConfig.key];
        if (val !== undefined && val !== null && val !== '') {
          teamValues.add(String(val).toLowerCase().trim());
        }
      }
      if (teamValues.size === 0) continue; // excluded from denominator
      teamsWithAnyValue++;
      if (teamValues.size === 1) teamsWithUniformValue++;
    }

    const uniformTeamPct = teamsWithAnyValue > 0
      ? Math.round(teamsWithUniformValue / teamsWithAnyValue * 100)
      : 0;
    const suggestedScope = uniformTeamPct >= 80 ? 'team' : 'person';

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
      suggestedScope,
      uniformTeamPct,
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
 * Uses batched I/O: reads all data once, mutates in memory, writes once at the end.
 *
 * @param {object} storage
 * @param {object} config - roster-sync config (must have teamDataSource === 'in-app')
 * @param {string} actorEmail
 * @param {Array<{key: string, type: string, multiValue: boolean, scope?: string}>} [fieldOverrides] - per-field type overrides
 * @returns {{ migrated: boolean, teams: number, fields: number, assignments: number, boardsMigrated: number }}
 */
function migrateToInApp(storage, config, actorEmail, fieldOverrides) {
  // Already migrated — skip
  if (config._migratedToInApp) {
    return { migrated: false, teams: 0, fields: 0, assignments: 0, boardsMigrated: 0 };
  }

  const registry = storage.readFromStorage(REGISTRY_KEY);
  if (!registry || !registry.people) {
    return { migrated: false, teams: 0, fields: 0, assignments: 0, boardsMigrated: 0 };
  }

  // ─── Read all data once ───
  const { readTeams, generateTeamId, TEAMS_KEY } = require('./team-store');
  const { readFieldDefinitions, FIELD_DEFS_KEY } = require('./field-store');
  const { getOrgDisplayNames } = require('./roster-sync/config');

  const teamsData = readTeams(storage);
  const fieldDefs = readFieldDefinitions(storage);

  // Build override lookup: key → { type, multiValue, scope }
  const overrideMap = {};
  if (Array.isArray(fieldOverrides)) {
    for (const fo of fieldOverrides) {
      overrideMap[fo.key] = { type: fo.type || 'free-text', multiValue: !!fo.multiValue, scope: fo.scope || 'person' };
    }
  }

  // Build name→uid for person-reference resolution
  const nameToUid = buildNameToUid(registry);

  // ─── Step 1: Migrate teams from _teamGrouping (batched in memory) ───

  const teamMap = buildTeamMap(registry);
  const existingIds = new Set(Object.keys(teamsData.teams));
  const auditEntries = [];

  let teamsCreated = 0;
  let assignmentsCreated = 0;

  // Initialize teamIds on all people
  for (const person of Object.values(registry.people)) {
    if (!Array.isArray(person.teamIds)) person.teamIds = [];
  }

  // Build existing teams lookup for dedup (orgKey + name, case-insensitive)
  const existingTeamsByKey = {};
  for (const [id, team] of Object.entries(teamsData.teams)) {
    existingTeamsByKey[`${team.orgKey}::${team.name.toLowerCase()}`] = { ...team, id };
  }

  // Map from composite key to teamId for field value assignment
  const compositeToTeamId = {};

  for (const [compositeKey, entry] of teamMap.entries()) {
    // Check for existing team (dedup on retry)
    const existing = existingTeamsByKey[compositeKey];
    let teamId;

    if (existing) {
      teamId = existing.id;
      // Merge members additively
      for (const uid of entry.uids) {
        const person = registry.people[uid];
        if (person && !person.teamIds.includes(teamId)) {
          person.teamIds.push(teamId);
          assignmentsCreated++;
        }
      }
    } else {
      teamId = generateTeamId(existingIds);
      existingIds.add(teamId);

      const team = {
        id: teamId,
        name: entry.name,
        orgKey: entry.orgKey,
        createdAt: new Date().toISOString(),
        createdBy: actorEmail,
        metadata: {},
        boards: []
      };

      teamsData.teams[teamId] = team;
      teamsCreated++;

      auditEntries.push({
        action: 'team.create',
        actor: actorEmail,
        entityType: 'team',
        entityId: teamId,
        entityLabel: entry.name,
        detail: `Created team "${entry.name}" in org ${entry.orgKey}`
      });

      for (const uid of entry.uids) {
        const person = registry.people[uid];
        if (person && !person.teamIds.includes(teamId)) {
          person.teamIds.push(teamId);
          assignmentsCreated++;
        }
      }
    }

    compositeToTeamId[compositeKey] = teamId;
  }

  // ─── Step 1.5: Migrate boards from teams-metadata.json ───

  let boardsMigrated = 0;
  const metaData = storage.readFromStorage('org-roster/teams-metadata.json');

  if (metaData && metaData.teams) {
    const orgDisplayNames = getOrgDisplayNames(storage);
    const boardNames = metaData.boardNames || {};

    // Build a case-insensitive lookup for metadata teams
    const metaTeams = metaData.teams;

    for (const [compositeKey, entry] of teamMap.entries()) {
      const teamId = compositeToTeamId[compositeKey];
      if (!teamId) continue;

      const displayName = orgDisplayNames[entry.orgKey] || entry.orgKey;

      // Case-insensitive match against metadata
      const metaMatch = metaTeams.find(mt =>
        mt.org.toLowerCase() === displayName.toLowerCase() &&
        mt.name.toLowerCase() === entry.name.toLowerCase()
      );

      if (metaMatch && Array.isArray(metaMatch.boardUrls) && metaMatch.boardUrls.length > 0) {
        const boards = [];
        for (const url of metaMatch.boardUrls) {
          if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
            boards.push({ url, name: boardNames[url] || '' });
          } else {
            console.warn(`[migration] Skipping board with invalid URL scheme: ${url}`);
          }
        }
        if (boards.length > 0) {
          teamsData.teams[teamId].boards = boards;
          boardsMigrated += boards.length;
        }
      }
    }
  }

  // ─── Step 2: Migrate custom fields ───

  let fieldsCreated = 0;
  const customFieldsConfig = config.teamStructure?.customFields;
  let personFieldOrder = fieldDefs.personFields ? fieldDefs.personFields.length : 0;
  let teamFieldOrder = fieldDefs.teamFields ? fieldDefs.teamFields.length : 0;

  if (!fieldDefs.teamFields) fieldDefs.teamFields = [];

  if (Array.isArray(customFieldsConfig) && customFieldsConfig.length > 0) {
    for (const cfConfig of customFieldsConfig) {
      const override = overrideMap[cfConfig.key] || {};
      const fieldType = override.type || 'free-text';
      let multiValue = override.multiValue || false;
      const scope = override.scope || 'person';

      // Collect all raw values to determine allowedValues for constrained fields
      const allIndividualValues = new Set();
      const rawEntries = []; // { person, uid, rawValue }

      for (const [uid, person] of Object.entries(registry.people)) {
        if (person.status !== 'active') continue;
        const value = person[cfConfig.key];
        if (value !== undefined && value !== null && value !== '') {
          rawEntries.push({ person, uid, rawValue: value });
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

      // Generate field ID in memory
      const crypto = require('crypto');
      const fieldId = 'field_' + crypto.randomBytes(3).toString('hex');

      const fieldDef = {
        id: fieldId,
        label: cfConfig.displayLabel || cfConfig.key,
        type: fieldType,
        multiValue,
        required: false,
        visible: cfConfig.visible !== false,
        primaryDisplay: cfConfig.primaryDisplay || false,
        allowedValues,
        deleted: false,
        order: scope === 'team' ? teamFieldOrder++ : personFieldOrder++,
        createdAt: new Date().toISOString(),
        createdBy: actorEmail
      };

      if (scope === 'team') {
        // ─── Team-scoped field handling ───

        // Compute rolled-up values per team
        for (const [compositeKey, entry] of teamMap.entries()) {
          const teamId = compositeToTeamId[compositeKey];
          if (!teamId) continue;

          const distinctValues = new Set();
          for (const uid of entry.uids) {
            const person = registry.people[uid];
            if (!person) continue;
            const val = person[cfConfig.key];
            if (val !== undefined && val !== null && val !== '') {
              if (fieldType === 'person-reference-linked') {
                const resolved = resolvePersonNames(val, nameToUid);
                for (const r of resolved) distinctValues.add(r);
              } else if (multiValue && typeof val === 'string' && val.includes(',')) {
                for (const part of val.split(',').map(s => s.trim()).filter(Boolean)) {
                  distinctValues.add(part);
                }
              } else {
                distinctValues.add(String(val));
              }
            }
          }

          if (distinctValues.size === 0) continue;

          const valuesArray = [...distinctValues];
          if (valuesArray.length > 1) {
            // Auto-promote to multiValue
            multiValue = true;
            fieldDef.multiValue = true;
            teamsData.teams[teamId].metadata[fieldId] = valuesArray;
          } else {
            teamsData.teams[teamId].metadata[fieldId] = multiValue ? valuesArray : valuesArray[0];
          }
        }

        // Do NOT write to person _appFields for team-scoped fields
        fieldDefs.teamFields.push(fieldDef);
      } else {
        // ─── Person-scoped field handling (existing behavior) ───

        // Copy values from flat person fields to _appFields
        for (const { person, rawValue } of rawEntries) {
          if (!person._appFields) person._appFields = {};

          if (fieldType === 'person-reference-linked') {
            const resolved = resolvePersonNames(rawValue, nameToUid);
            person._appFields[fieldId] = multiValue ? resolved : (resolved[0] || null);
          } else if (multiValue && typeof rawValue === 'string' && rawValue.includes(',')) {
            person._appFields[fieldId] = rawValue.split(',').map(s => s.trim()).filter(Boolean);
          } else {
            person._appFields[fieldId] = rawValue;
          }
        }

        fieldDefs.personFields.push(fieldDef);
      }

      fieldsCreated++;

      auditEntries.push({
        action: 'field.create',
        actor: actorEmail,
        entityType: 'field',
        entityId: fieldId,
        entityLabel: fieldDef.label,
        detail: `Created ${scope} field "${fieldDef.label}" (type: ${fieldType})`
      });
    }
  }

  // ─── Step 3: Write all data once ───
  storage.writeToStorage(TEAMS_KEY, teamsData);
  storage.writeToStorage(REGISTRY_KEY, registry);
  storage.writeToStorage(FIELD_DEFS_KEY, fieldDefs);

  // Batch all audit entries
  auditEntries.push({
    action: 'migration.sheets_to_inapp',
    actor: actorEmail,
    entityType: 'system',
    entityId: 'migration',
    detail: `Migrated from Sheets: ${teamsCreated} teams, ${fieldsCreated} fields, ${assignmentsCreated} assignments, ${boardsMigrated} boards`
  });

  for (const entry of auditEntries) {
    appendAuditEntry(storage, entry);
  }

  return { migrated: true, teams: teamsCreated, fields: fieldsCreated, assignments: assignmentsCreated, boardsMigrated };
}

module.exports = { migrateToInApp, previewMigration, buildTeamMap, resolvePersonNames, buildNameToUid };
