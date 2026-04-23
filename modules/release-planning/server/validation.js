/**
 * Big Rock field validation with max lengths, reserved name check,
 * priority constraints, and outcomeKeys format validation.
 */

const RESERVED_NAMES = ['reorder', '__proto__', 'constructor', 'prototype']

const FIELD_LIMITS = {
  name: 100,
  fullName: 200,
  pillar: 100,
  state: 100,
  owner: 200,
  architect: 200,
  notes: 2000,
  description: 2000
}

const MAX_OUTCOME_KEYS = 20
const OUTCOME_KEY_PATTERN = /^[A-Z]+-\d+$/

/**
 * Validate a Big Rock object for create or update.
 * @param {object} data - The Big Rock fields to validate
 * @param {object} options - Validation options
 * @param {string[]} [options.existingNames] - Names already in use (for uniqueness check)
 * @param {string} [options.originalName] - The original name when editing (to allow keeping the same name)
 * @returns {{ valid: boolean, errors: object }} Validation result with field-level errors
 */
function validateBigRock(data, options) {
  if (!options) options = {}
  const existingNames = options.existingNames || []
  const originalName = options.originalName || null
  const errors = {}

  // name: required, max length, reserved check, uniqueness
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.name = 'Name is required'
  } else {
    const name = data.name.trim()
    if (name.length > FIELD_LIMITS.name) {
      errors.name = `Name must be ${FIELD_LIMITS.name} characters or fewer`
    } else if (RESERVED_NAMES.includes(name.toLowerCase())) {
      errors.name = `"${name}" is a reserved name and cannot be used`
    } else {
      // Check uniqueness (case-sensitive), excluding the original name when editing
      const isDuplicate = existingNames.some(function(n) {
        return n === name && n !== originalName
      })
      if (isDuplicate) {
        errors.name = `A Big Rock named "${name}" already exists in this release`
      }
    }
  }

  // String fields: max length
  var field
  for (field of ['fullName', 'pillar', 'state', 'owner', 'architect', 'notes', 'description']) {
    if (data[field] && typeof data[field] === 'string' && data[field].length > FIELD_LIMITS[field]) {
      errors[field] = `${field} must be ${FIELD_LIMITS[field]} characters or fewer`
    }
  }

  // outcomeKeys: array of strings matching pattern, max count
  if (data.outcomeKeys !== undefined && data.outcomeKeys !== null) {
    if (!Array.isArray(data.outcomeKeys)) {
      errors.outcomeKeys = 'outcomeKeys must be an array'
    } else if (data.outcomeKeys.length > MAX_OUTCOME_KEYS) {
      errors.outcomeKeys = `Maximum ${MAX_OUTCOME_KEYS} outcome keys allowed`
    } else {
      const invalidKeys = data.outcomeKeys.filter(function(key) {
        return typeof key !== 'string' || !OUTCOME_KEY_PATTERN.test(key)
      })
      if (invalidKeys.length > 0) {
        errors.outcomeKeys = `Invalid outcome key format: ${invalidKeys.join(', ')}. Expected format: PROJECT-123`
      }
    }
  }

  // priority: if provided, must be integer >= 1
  if (data.priority !== undefined && data.priority !== null) {
    if (!Number.isInteger(data.priority) || data.priority < 1) {
      errors.priority = 'Priority must be a positive integer'
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors: errors
  }
}

module.exports = { validateBigRock, RESERVED_NAMES, FIELD_LIMITS, MAX_OUTCOME_KEYS, OUTCOME_KEY_PATTERN }
