/**
 * Roster sync configuration stored on PVC.
 * Manages org roots, Google Sheet settings, and sync metadata.
 */

const CONFIG_KEY = 'team-data/config.json';
const LEGACY_CONFIG_KEY = 'roster-sync-config.json';

// Simple cache for getOrgDisplayNames — invalidated on saveConfig
let _orgDisplayNamesCache = null;

function loadConfig(storage) {
  // One-time migration: merge legacy roster-sync-config.json into team-data/config.json
  migrateFromLegacyConfig(storage);

  const config = storage.readFromStorage(CONFIG_KEY);
  if (config) {
    const migrated = migrateConfig(config);
    const instancesMigrated = migrateGitlabInstances(migrated, storage);
    return instancesMigrated;
  }
  return config;
}

/**
 * Idempotent migration: merge fields from legacy roster-sync-config.json
 * into team-data/config.json. Uses _migratedFrom guard flag to run only once.
 * The old file is never deleted (rollback safety net).
 */
function migrateFromLegacyConfig(storage) {
  if (!storage.writeToStorage) return;

  var target = storage.readFromStorage(CONFIG_KEY);

  // Already migrated — skip
  if (target && target._migratedFrom === LEGACY_CONFIG_KEY) return;

  var legacy = storage.readFromStorage(LEGACY_CONFIG_KEY);
  if (!legacy) return;

  // Merge legacy fields into target (target fields take precedence)
  var merged = Object.assign({}, legacy, target || {});
  merged._migratedFrom = LEGACY_CONFIG_KEY;

  storage.writeToStorage(CONFIG_KEY, merged);
  console.log('[config-migration] Merged roster-sync-config.json into team-data/config.json');
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

/**
 * Migrate legacy gitlabGroups to gitlabInstances.
 * Writes back to disk immediately so the file reflects runtime state.
 */
function migrateGitlabInstances(config, storage) {
  if (!config) return config;
  // Already has gitlabInstances — no migration needed
  if (config.gitlabInstances) return config;

  // No legacy gitlabGroups — nothing to migrate
  const groups = config.gitlabGroups;
  if (!groups || !Array.isArray(groups) || groups.length === 0) return config;

  config.gitlabInstances = [{
    label: 'GitLab.com',
    baseUrl: process.env.GITLAB_BASE_URL || 'https://gitlab.com',
    tokenEnvVar: 'GITLAB_TOKEN',
    groups: [...groups]
  }];

  // Write back to disk immediately
  if (storage && storage.writeToStorage) {
    storage.writeToStorage(CONFIG_KEY, config);
  }

  console.log(`[roster-sync] Migrated gitlabGroups (${groups.length} groups) to gitlabInstances`);
  return config;
}

function saveConfig(storage, config) {
  _orgDisplayNamesCache = null;
  storage.writeToStorage(CONFIG_KEY, config);
}

function isConfigured(storage) {
  const config = loadConfig(storage);
  return config && Array.isArray(config.orgRoots) && config.orgRoots.length > 0;
}

function getOrgDisplayNames(storage) {
  if (_orgDisplayNamesCache) return _orgDisplayNamesCache;
  const config = loadConfig(storage);
  if (!config || !config.orgRoots) return {};
  const map = {};
  for (const root of config.orgRoots) {
    map[root.uid] = root.displayName || root.name;
  }
  _orgDisplayNamesCache = map;
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

function clearDisplayNamesCache() {
  _orgDisplayNamesCache = null;
}

module.exports = {
  loadConfig,
  saveConfig,
  isConfigured,
  getOrgDisplayNames,
  updateSyncStatus,
  clearDisplayNamesCache
};
