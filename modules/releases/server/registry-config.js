/**
 * Registry-level configuration for Jira version resolution.
 *
 * Stores settings that control how the registry discovers and maps
 * Jira project versions to registry releases.
 *
 * Storage: releases/registry-config.json
 */

const STORAGE_KEY = 'releases/registry-config.json'

const DEFAULT_JIRA_PROJECTS = ['RHAISTRAT', 'RHOAIENG']

function getDefaults() {
  return {
    jiraProjects: DEFAULT_JIRA_PROJECTS.slice()
  }
}

/**
 * Load registry config from storage, merging with defaults.
 * @param {{ readFromStorage: function }} storage
 * @returns {{ jiraProjects: string[] }}
 */
function loadRegistryConfig(storage) {
  var defaults = getDefaults()
  var stored = storage.readFromStorage(STORAGE_KEY)

  if (!stored || typeof stored !== 'object') {
    return defaults
  }

  return {
    jiraProjects: Array.isArray(stored.jiraProjects) ? stored.jiraProjects : defaults.jiraProjects
  }
}

/**
 * Save registry config to storage.
 * @param {{ writeToStorage: function }} storage
 * @param {{ jiraProjects?: string[] }} config
 */
function saveRegistryConfig(storage, config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Config must be an object')
  }

  var toSave = {
    jiraProjects: Array.isArray(config.jiraProjects)
      ? config.jiraProjects.filter(function(p) { return typeof p === 'string' && p.trim().length > 0 })
      : DEFAULT_JIRA_PROJECTS.slice()
  }

  storage.writeToStorage(STORAGE_KEY, toSave)
}

module.exports = {
  loadRegistryConfig,
  saveRegistryConfig,
  getDefaults,
  STORAGE_KEY
}
