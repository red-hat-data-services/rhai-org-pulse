/**
 * Generic field options CRUD for named field option sets.
 * Stores each option set as a separate JSON file at data/team-data/field-options/<name>.json.
 * Module-scoped to team-tracker (not shared/) per stability contract.
 */

const { appendAuditEntry } = require('../../../shared/server/audit-log');

const FIELD_OPTIONS_DIR = 'team-data/field-options';

function optionsKey(name) {
  // Sanitize name to prevent path traversal
  const safe = name.replace(/[^a-z0-9_-]/gi, '');
  if (!safe) {
    throw new Error('Invalid field option set name: empty after sanitization');
  }
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
  const files = storage.listStorageFiles(FIELD_OPTIONS_DIR);
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

/**
 * Rename a value in a field option set and cascade the change to all
 * person/team records that reference it via optionsRef fields.
 *
 * @param {object} storage
 * @param {string} name - The option set name
 * @param {string} oldValue - The current value text
 * @param {string} newValue - The new value text
 * @param {string} actorEmail
 * @returns {{ updated: number }|null} Count of person+team records updated, or null if set not found
 */
function renameValue(storage, name, oldValue, newValue, actorEmail) {
  const options = readFieldOptions(storage, name);
  if (!options) return null;

  const idx = options.values.indexOf(oldValue);
  if (idx === -1) {
    throw new Error(`Value "${oldValue}" not found in option set "${name}"`);
  }
  if (options.values.includes(newValue)) {
    throw new Error(`Value "${newValue}" already exists in option set "${name}"`);
  }

  // 1. Update the option set itself
  options.values[idx] = newValue;
  options.values.sort();
  options.updatedAt = new Date().toISOString();
  options.updatedBy = actorEmail;
  writeFieldOptions(storage, name, options);

  // 2. Find all field definitions that reference this option set
  const fieldDefs = storage.readFromStorage('team-data/field-definitions.json') || { personFields: [], teamFields: [] };
  const personFieldIds = (fieldDefs.personFields || []).filter(f => !f.deleted && f.optionsRef === name).map(f => f.id);
  const teamFieldIds = (fieldDefs.teamFields || []).filter(f => !f.deleted && f.optionsRef === name).map(f => f.id);

  let updated = 0;

  // 3. Cascade to person records
  if (personFieldIds.length > 0) {
    const registry = storage.readFromStorage('team-data/registry.json');
    if (registry && registry.people) {
      let registryModified = false;
      for (const person of Object.values(registry.people)) {
        if (!person._appFields) continue;
        for (const fieldId of personFieldIds) {
          const val = person._appFields[fieldId];
          if (val === oldValue) {
            person._appFields[fieldId] = newValue;
            registryModified = true;
            updated++;
          } else if (Array.isArray(val)) {
            const arrIdx = val.indexOf(oldValue);
            if (arrIdx !== -1) {
              val[arrIdx] = newValue;
              registryModified = true;
              updated++;
            }
          }
        }
      }
      if (registryModified) {
        storage.writeToStorage('team-data/registry.json', registry);
      }
    }
  }

  // 4. Cascade to team metadata
  if (teamFieldIds.length > 0) {
    const teamsData = storage.readFromStorage('team-data/teams.json');
    if (teamsData && teamsData.teams) {
      let teamsModified = false;
      for (const team of Object.values(teamsData.teams)) {
        if (!team.metadata) continue;
        for (const fieldId of teamFieldIds) {
          const val = team.metadata[fieldId];
          if (val === oldValue) {
            team.metadata[fieldId] = newValue;
            teamsModified = true;
            updated++;
          } else if (Array.isArray(val)) {
            const arrIdx = val.indexOf(oldValue);
            if (arrIdx !== -1) {
              val[arrIdx] = newValue;
              teamsModified = true;
              updated++;
            }
          }
        }
      }
      if (teamsModified) {
        storage.writeToStorage('team-data/teams.json', teamsData);
      }
    }
  }

  appendAuditEntry(storage, {
    action: 'field-options.rename',
    actor: actorEmail,
    entityType: 'field-options',
    entityId: name,
    oldValue,
    newValue,
    detail: `Renamed "${oldValue}" to "${newValue}" in "${name}" (${updated} records updated)`
  });

  return { updated };
}

module.exports = {
  listFieldOptions,
  getValues,
  addValues,
  replaceValues,
  removeValues,
  renameValue,
  readFieldOptions,
  writeFieldOptions,
  FIELD_OPTIONS_DIR
};
