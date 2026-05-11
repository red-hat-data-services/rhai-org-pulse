/**
 * Field definition and value CRUD with audit logging.
 * Reads/writes data/team-data/field-definitions.json and updates _appFields on registry persons.
 */

const crypto = require('crypto');
const { appendAuditEntry } = require('./audit-log');

const FIELD_DEFS_KEY = 'team-data/field-definitions.json';
const REGISTRY_KEY = 'team-data/registry.json';

/** Guard against prototype pollution via user-controlled object keys. */
function isSafeKey(key) {
  return typeof key === 'string' && !['__proto__', 'constructor', 'prototype'].includes(key);
}

function generateFieldId() {
  return 'field_' + crypto.randomBytes(3).toString('hex');
}

const MAX_ALLOWED_VALUES = 100;
const MAX_ALLOWED_VALUE_LENGTH = 200;
const VALID_FIELD_TYPES = ['free-text', 'constrained', 'person-reference-linked'];

function readFieldDefinitions(storage) {
  return storage.readFromStorage(FIELD_DEFS_KEY) || { personFields: [], teamFields: [] };
}

function writeFieldDefinitions(storage, data) {
  storage.writeToStorage(FIELD_DEFS_KEY, data);
}

/**
 * Validate allowedValues array: must be an array of strings with reasonable bounds.
 * @returns {string|null} Error message, or null if valid.
 */
function validateAllowedValues(allowedValues) {
  if (allowedValues == null) return null;
  if (!Array.isArray(allowedValues)) return 'allowedValues must be an array';
  if (allowedValues.length > MAX_ALLOWED_VALUES) return `allowedValues cannot exceed ${MAX_ALLOWED_VALUES} items`;
  for (const v of allowedValues) {
    if (typeof v !== 'string') return 'Each allowedValues entry must be a string';
    if (v.length > MAX_ALLOWED_VALUE_LENGTH) return `Each allowedValues entry must be ${MAX_ALLOWED_VALUE_LENGTH} characters or fewer`;
    if (v.length === 0) return 'allowedValues entries cannot be empty strings';
  }
  return null;
}

/**
 * Normalize a stored field value to match the field definition's current multiValue setting.
 * - multiValue=true: string -> [string], null -> [], array -> array
 * - multiValue=false: [first] -> first, string -> string, null -> null
 */
function coerceFieldValue(value, fieldDef) {
  if (fieldDef && fieldDef.multiValue) {
    if (value == null || value === '') return [];
    if (Array.isArray(value)) return value;
    return [value];
  }
  // single-value
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

/**
 * Validate and normalize field values against their definitions.
 * @param {object} storage
 * @param {'person'|'team'} scope
 * @param {Object<string,*>} fieldValues - Incoming { fieldId: value } pairs
 * @param {Object<string,*>} [existingValues] - Full current field values for required-field checks
 * @returns {{ validated: Object, warnings: string[], errors: string[] }}
 */
function validateFieldValues(storage, scope, fieldValues, existingValues, { optionsResolver } = {}) {
  const defs = readFieldDefinitions(storage);
  const key = scope === 'person' ? 'personFields' : 'teamFields';
  const fields = defs[key] || [];
  const byId = {};
  for (const f of fields) {
    if (!f.deleted) byId[f.id] = f;
  }

  const validated = {};
  const warnings = [];
  const errors = [];

  for (const [fieldId, rawValue] of Object.entries(fieldValues)) {
    if (!isSafeKey(fieldId)) {
      errors.push(`Invalid field key: ${fieldId}`);
      continue;
    }
    const fieldDef = byId[fieldId];
    if (!fieldDef) {
      errors.push(`Unknown field: ${fieldId}`);
      continue;
    }

    const value = coerceFieldValue(rawValue, fieldDef);

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

    validated[fieldId] = value;
  }

  // Check required fields against the merged set of existing + incoming values
  const merged = { ...(existingValues || {}), ...validated };
  for (const f of fields) {
    if (f.deleted || !f.required) continue;
    const val = merged[f.id];
    const isEmpty = val == null || val === '' || (Array.isArray(val) && val.length === 0);
    if (isEmpty) {
      warnings.push(`${f.label} is required`);
    }
  }

  return { validated, warnings, errors };
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

  const fieldType = definition.type || 'free-text';

  if (!VALID_FIELD_TYPES.includes(fieldType)) {
    throw new Error(`Invalid type. Must be one of: ${VALID_FIELD_TYPES.join(', ')}`);
  }

  // Validate allowedValues
  const avError = validateAllowedValues(definition.allowedValues);
  if (avError) throw new Error(avError);

  const field = {
    id: generateFieldId(),
    label: definition.label,
    type: fieldType,
    multiValue: definition.multiValue || false,
    required: definition.required || false,
    visible: definition.visible !== false,
    primaryDisplay: definition.primaryDisplay || false,
    allowedValues: definition.allowedValues || null,
    optionsRef: definition.optionsRef || null,
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

  // Validate type if being updated
  if (updates.type !== undefined && !VALID_FIELD_TYPES.includes(updates.type)) {
    throw new Error(`Invalid type. Must be one of: ${VALID_FIELD_TYPES.join(', ')}`);
  }

  // Validate allowedValues if being updated
  if (updates.allowedValues !== undefined) {
    const avError = validateAllowedValues(updates.allowedValues);
    if (avError) throw new Error(avError);
  }

  const changes = {};
  for (const [k, v] of Object.entries(updates)) {
    if (['label', 'type', 'required', 'visible', 'primaryDisplay', 'allowedValues', 'multiValue', 'optionsRef'].includes(k)) {
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
    if (!isSafeKey(orderedIds[i])) continue;
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
    if (!isSafeKey(fieldId)) {
      throw new Error(`Invalid field key: ${fieldId}`);
    }
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
  coerceFieldValue,
  validateFieldValues,
  FIELD_DEFS_KEY
};
