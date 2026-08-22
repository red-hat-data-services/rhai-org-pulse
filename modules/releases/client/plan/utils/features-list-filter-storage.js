/**
 * Persist Features List filters across navigation (e.g. feature-detail → back).
 * Mirrors PM Hub's pm-hub-filters pattern.
 */

export var STORAGE_KEY = 'features-list-filters'

export var DEFAULT_FILTERS = {
  outcome: [],
  targetVersion: [],
  fixVersion: [],
  component: [],
  priority: [],
  team: [],
  product: [],
  fpdorItems: [],
  alignment: [],
  readiness: null
}

function asStringArray(value) {
  if (!Array.isArray(value)) return []
  return value.filter(function(item) {
    return typeof item === 'string'
  })
}

/**
 * @param {object} filters
 * @param {string} selectedVersion
 */
export function saveFeaturesListFilters(filters, selectedVersion) {
  try {
    var state = {
      filters: {
        outcome: asStringArray(filters && filters.outcome),
        targetVersion: asStringArray(filters && filters.targetVersion),
        fixVersion: asStringArray(filters && filters.fixVersion),
        component: asStringArray(filters && filters.component),
        priority: asStringArray(filters && filters.priority),
        team: asStringArray(filters && filters.team),
        product: asStringArray(filters && filters.product),
        fpdorItems: asStringArray(filters && filters.fpdorItems),
        alignment: asStringArray(filters && filters.alignment),
        readiness: filters && filters.readiness != null ? String(filters.readiness) : null
      },
      selectedVersion: typeof selectedVersion === 'string' ? selectedVersion : ''
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    void e
  }
}

/**
 * @returns {{ filters: object, selectedVersion: string }|null}
 */
export function restoreFeaturesListFilters() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    var state = JSON.parse(raw)
    if (!state || typeof state !== 'object') return null
    var saved = state.filters && typeof state.filters === 'object' ? state.filters : {}
    return {
      filters: {
        outcome: asStringArray(saved.outcome),
        targetVersion: asStringArray(saved.targetVersion),
        fixVersion: asStringArray(saved.fixVersion),
        component: asStringArray(saved.component),
        priority: asStringArray(saved.priority),
        team: asStringArray(saved.team),
        product: asStringArray(saved.product),
        fpdorItems: asStringArray(saved.fpdorItems),
        alignment: asStringArray(saved.alignment),
        readiness: saved.readiness != null && saved.readiness !== '' ? String(saved.readiness) : null
      },
      selectedVersion: typeof state.selectedVersion === 'string' ? state.selectedVersion : ''
    }
  } catch {
    return null
  }
}

export function clearFeaturesListFiltersStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    void e
  }
}
