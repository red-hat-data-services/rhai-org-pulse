const VALID_ACTIONS = new Set([
  'view',
  'tab-switch',
  'filter',
  'search',
  'drill-down',
  'button-click',
  'external-link',
  'navigate'
])

const MAX_TARGET_LENGTH = 100

function validateAction(action) {
  if (typeof action !== 'string') return null
  return VALID_ACTIONS.has(action) ? action : null
}

function sanitizeTarget(target) {
  if (target == null) return null
  const str = String(target).trim()
  if (!str) return null
  return str.slice(0, MAX_TARGET_LENGTH)
}

function sanitizeString(value) {
  if (typeof value !== 'string') return null
  return value.trim().slice(0, MAX_TARGET_LENGTH) || null
}

module.exports = { validateAction, sanitizeTarget, sanitizeString, VALID_ACTIONS }
