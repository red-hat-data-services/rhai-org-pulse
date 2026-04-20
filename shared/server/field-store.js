/**
 * Field definition and value CRUD with audit logging.
 * Reads/writes data/team-data/field-definitions.json and updates _appFields on registry persons.
 */

const crypto = require('crypto');
const { appendAuditEntry } = require('./audit-log');

const FIELD_DEFS_KEY = 'team-data/field-definitions.json';
const REGISTRY_KEY = 'team-data/registry.json';

function generateFieldId() {
  return 'field_' + crypto.randomBytes(3).toString('hex');
}

function readFieldDefinitions(storage) {
  return storage.readFromStorage(FIELD_DEFS_KEY) || { personFields: [], teamFields: [] };
}

function writeFieldDefinitions(storage, data) {
  storage.writeToStorage(FIELD_DEFS_KEY, data);
}

/**
 * Create a field definition.
 * @param {object} storage
 * @param {'person'|'team'} scope
 * @param {{ label: string, type: string, required?: boolean, visible?: boolean, primaryDisplay?: boolean, allowedValues?: string[]|null }} definition
 * @param {string} actorEmail
 * @returns {object} The created field definition
 */
function createFieldDefinition(storage, scope, definition, actorEmail) {
  const data = readFieldDefinitions(storage);
  const key = scope === 'person' ? 'personFields' : 'teamFields';
  const fields = data[key];

  const field = {
    id: generateFieldId(),
    label: definition.label,
    type: definition.type || 'free-text',
    required: definition.required || false,
    visible: definition.visible !== false,
    primaryDisplay: definition.primaryDisplay || false,
    allowedValues: definition.allowedValues || null,
    deleted: false,
    order: fields.length,
    createdAt: new Date().toISOString(),
    createdBy: actorEmail
  };

  fields.push(field);
  writeFieldDefinitions(storage, data);

  appendAuditEntry(storage, {
    action: 'field.create',
    actor: actorEmail,
    entityType: 'field',
    entityId: field.id,
    entityLabel: field.label,
    detail: `Created ${scope} field "${field.label}" (type: ${field.type})`
  });

  return field;
}

/**
 * Update a field definition.
 * @param {object} storage
 * @param {'person'|'team'} scope
 * @param {string} fieldId
 * @param {object} updates - Partial updates (label, type, required, visible, primaryDisplay, allowedValues)
 * @param {string} actorEmail
 * @returns {object|null} The updated field, or null if not found
 */
function updateFieldDefinition(storage, scope, fieldId, updates, actorEmail) {
  const data = readFieldDefinitions(storage);
  const key = scope === 'person' ? 'personFields' : 'teamFields';
  const field = data[key].find(f => f.id === fieldId);
  if (!field) return null;

  const changes = {};
  for (const [k, v] of Object.entries(updates)) {
    if (['label', 'type', 'required', 'visible', 'primaryDisplay', 'allowedValues'].includes(k)) {
      changes[k] = { old: field[k], new: v };
      field[k] = v;
    }
  }

  writeFieldDefinitions(storage, data);

  appendAuditEntry(storage, {
    action: 'field.update',
    actor: actorEmail,
    entityType: 'field',
    entityId: fieldId,
    entityLabel: field.label,
    oldValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.old])),
    newValue: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.new])),
    detail: `Updated ${scope} field "${field.label}"`
  });

  return field;
}

/**
 * Soft-delete a field definition (marks as deleted, does not remove).
 */
function softDeleteField(storage, scope, fieldId, actorEmail) {
  const data = readFieldDefinitions(storage);
  const key = scope === 'person' ? 'personFields' : 'teamFields';
  const field = data[key].find(f => f.id === fieldId);
  if (!field) return null;

  field.deleted = true;
  writeFieldDefinitions(storage, data);

  appendAuditEntry(storage, {
    action: 'field.delete',
    actor: actorEmail,
    entityType: 'field',
    entityId: fieldId,
    entityLabel: field.label,
    detail: `Soft-deleted ${scope} field "${field.label}"`
  });

  return field;
}

/**
 * Reorder fields by providing an ordered array of field IDs.
 */
function reorderFields(storage, scope, orderedIds, actorEmail) {
  const data = readFieldDefinitions(storage);
  const key = scope === 'person' ? 'personFields' : 'teamFields';
  const fields = data[key];

  // Build lookup
  const byId = {};
  for (const f of fields) byId[f.id] = f;

  // Assign order based on position in orderedIds
  for (let i = 0; i < orderedIds.length; i++) {
    if (byId[orderedIds[i]]) {
      byId[orderedIds[i]].order = i;
    }
  }

  // Sort by order
  data[key] = fields.sort((a, b) => a.order - b.order);
  writeFieldDefinitions(storage, data);

  appendAuditEntry(storage, {
    action: 'field.reorder',
    actor: actorEmail,
    entityType: 'field',
    entityId: scope,
    detail: `Reordered ${scope} fields`
  });
}

/**
 * Update person-level custom field values.
 * @param {object} storage
 * @param {string} uid - Person UID
 * @param {Object<string, *>} fieldValues - { fieldId: value, ... }
 * @param {string} actorEmail
 */
function updatePersonFields(storage, uid, fieldValues, actorEmail) {
  const registry = storage.readFromStorage(REGISTRY_KEY);
  if (!registry || !registry.people || !registry.people[uid]) return null;

  const person = registry.people[uid];
  if (!person._appFields) person._appFields = {};

  for (const [fieldId, value] of Object.entries(fieldValues)) {
    const oldValue = person._appFields[fieldId] || null;
    person._appFields[fieldId] = value;

    appendAuditEntry(storage, {
      action: 'person.field.update',
      actor: actorEmail,
      entityType: 'person',
      entityId: uid,
      entityLabel: person.name,
      field: fieldId,
      oldValue,
      newValue: value
    });
  }

  storage.writeToStorage(REGISTRY_KEY, registry);
  return person._appFields;
}

module.exports = {
  readFieldDefinitions,
  createFieldDefinition,
  updateFieldDefinition,
  softDeleteField,
  reorderFields,
  updatePersonFields,
  FIELD_DEFS_KEY
};
