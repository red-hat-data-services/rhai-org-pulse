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

module.exports = {
  listFieldOptions,
  getValues,
  addValues,
  replaceValues,
  removeValues,
  readFieldOptions,
  writeFieldOptions,
  FIELD_OPTIONS_DIR
};
