/**
 * Roster sync configuration stored on PVC.
 * Manages org roots, Google Sheet settings, and sync metadata.
 */

const CONFIG_KEY = 'roster-sync-config.json';

function loadConfig(storage) {
  const config = storage.readFromStorage(CONFIG_KEY);
  if (config) {
    return migrateConfig(config);
  }
  return config;
}

/**
 * In-memory migration: transforms legacy fieldMapping to teamStructure.
 * Does NOT write back to disk — the PVC file stays in old format
 * until the next explicit save or sync.
 */
function migrateConfig(config) {
  // Already has teamStructure — no migration needed
  if (config.teamStructure) return config;

  // No fieldMapping — nothing to migrate
  if (!config.fieldMapping || typeof config.fieldMapping !== 'object') return config;

  const fm = config.fieldMapping;
  const nameColumn = fm.name || null;
  const teamGroupingColumn = fm.miroTeam || null;

  // If no team grouping column, skip migration entirely — user must configure manually
  if (!teamGroupingColumn) return config;

  const customFields = [];
  for (const [key, label] of Object.entries(fm)) {
    if (!label || !label.trim()) continue;
    if (key === 'name' || key === 'miroTeam') continue;

    // Rename 'manager' to 'sheetManager' to avoid LDAP collision
    const fieldKey = key === 'manager' ? 'sheetManager' : key;
    const displayLabel = fieldKey.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

    customFields.push({
      key: fieldKey,
      columnLabel: label.trim(),
      displayLabel,
      visible: fieldKey === 'specialty' || fieldKey === 'jiraComponent',
      primaryDisplay: fieldKey === 'specialty'
    });
  }

  config.teamStructure = {
    nameColumn: nameColumn || "Associate's Name",
    teamGroupingColumn,
    customFields
  };

  return config;
}

function saveConfig(storage, config) {
  storage.writeToStorage(CONFIG_KEY, config);
}

function isConfigured(storage) {
  const config = loadConfig(storage);
  return config && Array.isArray(config.orgRoots) && config.orgRoots.length > 0;
}

function getOrgDisplayNames(storage) {
  const config = loadConfig(storage);
  if (!config || !config.orgRoots) return {};
  const map = {};
  for (const root of config.orgRoots) {
    map[root.uid] = root.displayName || root.name;
  }
  return map;
}

function updateSyncStatus(storage, status, error) {
  const config = loadConfig(storage);
  if (!config) return;
  config.lastSyncAt = new Date().toISOString();
  config.lastSyncStatus = status;
  config.lastSyncError = error || null;
  saveConfig(storage, config);
}

module.exports = {
  loadConfig,
  saveConfig,
  isConfigured,
  getOrgDisplayNames,
  updateSyncStatus
};
