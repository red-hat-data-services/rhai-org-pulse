/**
 * Configuration management for the team-data module.
 * Reads/writes team-data/config.json from PVC storage.
 * IPA credentials are never stored here -- they come from env vars.
 */

const CONFIG_KEY = 'team-data/config.json';

const DEFAULTS = {
  orgRoots: [],
  gracePeriodDays: 30,
  autoSync: { enabled: false, intervalHours: 24 },
  excludedTitles: ['Intern - No Work Location']
};

function loadConfig(storage) {
  var config = storage.readFromStorage(CONFIG_KEY);
  if (!config) return Object.assign({}, DEFAULTS);
  return Object.assign({}, DEFAULTS, config);
}

function saveConfig(storage, config) {
  storage.writeToStorage(CONFIG_KEY, config);
}

function isConfigured(storage) {
  var config = loadConfig(storage);
  return config.orgRoots && config.orgRoots.length > 0;
}

/**
 * Check IPA environment variables. Returns an object describing what's set.
 * Never returns actual credential values.
 */
function getIpaStatus() {
  return {
    bindDnSet: !!process.env.IPA_BIND_DN,
    passwordSet: !!process.env.IPA_BIND_PASSWORD,
    host: process.env.IPA_HOST || 'ldaps://ipa.corp.redhat.com',
    baseDn: process.env.IPA_BASE_DN || 'cn=users,cn=accounts,dc=ipa,dc=redhat,dc=com',
    caCertSet: !!process.env.IPA_CA_CERT_PATH,
    ready: !!(process.env.IPA_BIND_DN && process.env.IPA_BIND_PASSWORD)
  };
}

module.exports = {
  loadConfig,
  saveConfig,
  isConfigured,
  getIpaStatus,
  DEFAULTS
};
