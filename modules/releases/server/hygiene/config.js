/**
 * Hygiene Rule Configuration
 *
 * Manages persistence of hygiene rule settings at releases/hygiene-config.json.
 * Merges stored config with defaults so newly added rules always get a config entry.
 */

const { getRuleDefaults } = require('./hygiene-rules')

const STORAGE_KEY = 'releases/hygiene-config.json'

const DEFAULT_PROJECTS = ['RHAISTRAT', 'RHOAIENG']
const DEFAULT_ISSUE_TYPES = ['Feature', 'Initiative']

/**
 * Build the full default configuration object.
 * @returns {{ rules: Record<string, object>, projects: string[], issueTypes: string[] }}
 */
function getDefaults() {
  return {
    rules: getRuleDefaults(),
    projects: DEFAULT_PROJECTS.slice(),
    issueTypes: DEFAULT_ISSUE_TYPES.slice()
  }
}

/**
 * Load hygiene config from storage, merging with defaults for any missing rules.
 * @param {{ readFromStorage: function }} storage - Storage abstraction
 * @returns {{ rules: Record<string, object>, projects: string[], issueTypes: string[] }}
 */
function loadConfig(storage) {
  const defaults = getDefaults()
  const stored = storage.readFromStorage(STORAGE_KEY)

  if (!stored || typeof stored !== 'object') {
    return defaults
  }

  // Merge rule defaults — stored rules override defaults, but new rules get defaults
  const mergedRules = { ...defaults.rules }
  const storedRules = stored.rules || {}
  const ruleIds = Object.keys(storedRules)
  for (let i = 0; i < ruleIds.length; i++) {
    const id = ruleIds[i]
    mergedRules[id] = { ...(mergedRules[id] || {}), ...storedRules[id] }
  }

  return {
    rules: mergedRules,
    projects: Array.isArray(stored.projects) ? stored.projects : defaults.projects,
    issueTypes: Array.isArray(stored.issueTypes) ? stored.issueTypes : defaults.issueTypes
  }
}

/**
 * Save hygiene config to storage.
 * @param {{ writeToStorage: function }} storage - Storage abstraction
 * @param {{ rules?: Record<string, object>, projects?: string[], issueTypes?: string[] }} config - Config to save
 */
function saveConfig(storage, config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Config must be an object')
  }

  const toSave = {
    rules: config.rules || {},
    projects: Array.isArray(config.projects) ? config.projects : DEFAULT_PROJECTS.slice(),
    issueTypes: Array.isArray(config.issueTypes) ? config.issueTypes : DEFAULT_ISSUE_TYPES.slice()
  }

  storage.writeToStorage(STORAGE_KEY, toSave)
}

module.exports = {
  loadConfig,
  saveConfig,
  getDefaults
}
