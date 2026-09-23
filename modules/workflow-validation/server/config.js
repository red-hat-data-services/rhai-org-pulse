const CONFIG_PATH = 'workflow-validation/config.json';
const DEFAULT_URL = 'http://localhost:9200';

const SETTING_KEYS = {
  WORKFLOW_VALIDATION_OPENSEARCH_URL: 'url',
  HTTP_PROXY: 'httpProxy',
  HTTPS_PROXY: 'httpsProxy'
};

function validateHttpUrl(value, name, { required = false } = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    if (required) throw new Error(`${name} must be an HTTP or HTTPS URL`);
    return '';
  }
  if (typeof value !== 'string') throw new Error(`${name} must be a string`);

  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error(`${name} must be a valid HTTP(S) URL`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`${name} must be a credential-free HTTP(S) URL`);
  }
  return parsed.href.replace(/\/+$/, '');
}

function saveableSettings(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Workflow Validation settings must be an object');
  }
  const allowed = new Set(Object.values(SETTING_KEYS));
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new Error(`Unsupported Workflow Validation setting: ${key}`);
  }
  const settings = {};
  for (const [envKey, property] of Object.entries(SETTING_KEYS)) {
    if (Object.prototype.hasOwnProperty.call(input, property)) {
      settings[property] = validateHttpUrl(input[property], envKey);
    }
  }
  return settings;
}

async function getSavedSettings(readFromStorage) {
  if (!readFromStorage) return {};
  const saved = await readFromStorage(CONFIG_PATH);
  return saved && typeof saved === 'object' && !Array.isArray(saved) && !saved._deleted ? saved : {};
}

async function getEffectiveSettings(readFromStorage, env = process.env) {
  const saved = await getSavedSettings(readFromStorage);
  const savedSettings = saveableSettings(saved);
  const result = { sources: {} };
  for (const [envKey, property] of Object.entries(SETTING_KEYS)) {
    const savedValue = savedSettings[property];
    const envValue = validateHttpUrl(env[envKey], envKey);
    if (savedValue) {
      result[property] = savedValue;
      result.sources[property] = 'admin-setting';
    } else if (envValue) {
      result[property] = envValue;
      result.sources[property] = 'environment';
    } else {
      result[property] = property === 'url' ? DEFAULT_URL : '';
      result.sources[property] = property === 'url' ? 'default' : 'none';
    }
  }
  return result;
}

async function saveSettings(writeToStorage, input) {
  const settings = saveableSettings(input);
  await writeToStorage(CONFIG_PATH, settings);
  return settings;
}

module.exports = {
  CONFIG_PATH,
  DEFAULT_URL,
  validateHttpUrl,
  saveableSettings,
  getSavedSettings,
  getEffectiveSettings,
  saveSettings
};
