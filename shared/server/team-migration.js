/**
 * Migration logic for switching from Sheets-based team data to in-app management.
 * Converts _teamGrouping strings to first-class teams with teamIds,
 * and teamStructure.customFields config to field-definitions.json with _appFields.
 */

const { createTeam, REGISTRY_KEY } = require('./team-store');
const { createFieldDefinition } = require('./field-store');
const { appendAuditEntry } = require('./audit-log');

/**
 * Run one-time migration from Sheets to in-app team data.
 * Idempotent: checks _migratedToInApp flag in config.
 *
 * @param {object} storage
 * @param {object} config - roster-sync config (must have teamDataSource === 'in-app')
 * @param {string} actorEmail
 * @returns {{ migrated: boolean, teams: number, fields: number, assignments: number }}
 */
function migrateToInApp(storage, config, actorEmail) {
  // Already migrated — skip
  if (config._migratedToInApp) {
    return { migrated: false, teams: 0, fields: 0, assignments: 0 };
  }

  const registry = storage.readFromStorage(REGISTRY_KEY);
  if (!registry || !registry.people) {
    return { migrated: false, teams: 0, fields: 0, assignments: 0 };
  }

  // ─── Step 1: Migrate teams from _teamGrouping ───

  // Collect unique team names per org
  // Key: "orgKey::lowercaseName" -> { name (first-seen casing), orgKey, uids }
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

  // Create team records and assign teamIds
  let teamsCreated = 0;
  let assignmentsCreated = 0;

  // Initialize teamIds arrays
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
      const field = createFieldDefinition(storage, 'person', {
        label: cfConfig.displayLabel || cfConfig.key,
        type: 'free-text',
        visible: cfConfig.visible !== false,
        primaryDisplay: cfConfig.primaryDisplay || false
      }, actorEmail);
      fieldsCreated++;

      // Copy values from flat person fields to _appFields
      for (const person of Object.values(registry.people)) {
        if (person.status !== 'active') continue;
        const value = person[cfConfig.key];
        if (value !== undefined && value !== null && value !== '') {
          if (!person._appFields) person._appFields = {};
          person._appFields[field.id] = value;
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

module.exports = { migrateToInApp };
