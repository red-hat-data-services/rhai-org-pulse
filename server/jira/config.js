/**
 * Jira sync configuration stored on PVC.
 * Manages project key filtering for JQL queries.
 */

const CONFIG_KEY = 'jira-sync-config.json';

function loadConfig(storage) {
  return storage.readFromStorage(CONFIG_KEY);
}

function saveConfig(storage, config) {
  storage.writeToStorage(CONFIG_KEY, config);
}

function getProjectKeys(storage) {
  const config = loadConfig(storage);
  return config?.projectKeys || [];
}

module.exports = { loadConfig, saveConfig, getProjectKeys };
