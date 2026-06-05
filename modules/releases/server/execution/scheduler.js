/**
 * Scheduler for GitLab artifact fetching.
 * Manages mutex lock, cooldown, and config reload.
 *
 * The periodic scheduling is now handled by the refresh registry's
 * cadence system — the independent setInterval scheduler has been removed.
 */

const gitlabFetch = require('./gitlab-fetch');

let fetchInProgress = false;
// Allows test override
let _fetchArtifacts = gitlabFetch.fetchArtifacts;
let lastSuccessfulFetch = 0;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

const DEFAULT_CONFIG = {
  gitlabBaseUrl: 'https://gitlab.com',
  projectPath: 'redhat/rhel-ai/agentic-ci/feature-traffic',
  jobName: 'fetch-traffic',
  branch: 'main',
  artifactPath: 'output',
  refreshIntervalHours: 12,
  enabled: false
};

// Module-level secrets, set once via init()
let _secrets = {};

// Callback invoked when config save changes the cadence
let _onCadenceChange = null;

function init(secrets) {
  _secrets = secrets || {};
}

function getToken() {
  return _secrets.FEATURE_TRAFFIC_GITLAB_TOKEN || _secrets.GITLAB_TOKEN || null;
}

function getTokenSource() {
  if (_secrets.FEATURE_TRAFFIC_GITLAB_TOKEN) return 'FEATURE_TRAFFIC_GITLAB_TOKEN';
  if (_secrets.GITLAB_TOKEN) return 'GITLAB_TOKEN';
  return null;
}

const DATA_PREFIX = gitlabFetch.DATA_PREFIX;

function loadConfig(storage) {
  const stored = storage.readFromStorage(`${DATA_PREFIX}/config.json`);
  return { ...DEFAULT_CONFIG, ...stored };
}

function saveConfig(storage, config) {
  storage.writeToStorage(`${DATA_PREFIX}/config.json`, config);
}

/**
 * Run a single fetch cycle.
 */
async function runFetch(storage, config) {
  if (fetchInProgress) {
    return { status: 'skipped', message: 'Fetch already in progress' };
  }

  const token = getToken();
  if (!token) {
    return { status: 'error', message: 'No GitLab token configured. Set FEATURE_TRAFFIC_GITLAB_TOKEN or GITLAB_TOKEN.' };
  }

  config = config || loadConfig(storage);
  if (!config.enabled) {
    return { status: 'skipped', message: 'Feature traffic fetch is disabled' };
  }

  fetchInProgress = true;
  try {
    const result = await _fetchArtifacts(storage, config, token);
    if (result.status === 'success') {
      lastSuccessfulFetch = Date.now();
    }
    // Write last-fetch metadata (also written inside fetchArtifacts for success, but handle artifact_expired here)
    if (result.status === 'artifact_expired') {
      storage.writeToStorage(`${DATA_PREFIX}/last-fetch.json`, result);
    }
    return result;
  } catch (err) {
    console.error('[releases/execution] Fetch error:', err.message);
    const errorResult = {
      status: 'error',
      message: err.message,
      timestamp: new Date().toISOString()
    };
    storage.writeToStorage(`${DATA_PREFIX}/last-fetch.json`, errorResult);
    return errorResult;
  } finally {
    fetchInProgress = false;
  }
}

/**
 * Handle a manual refresh request with cooldown enforcement.
 */
async function manualRefresh(storage) {
  const now = Date.now();
  const elapsed = now - lastSuccessfulFetch;
  if (lastSuccessfulFetch > 0 && elapsed < COOLDOWN_MS) {
    const retryAfter = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    return { status: 'cooldown', retryAfter, httpStatus: 429 };
  }
  return runFetch(storage);
}

/**
 * Validate config input. Throws on invalid values.
 */
function validateConfig(input) {
  // gitlabBaseUrl must be https://
  if (input.gitlabBaseUrl !== undefined) {
    if (typeof input.gitlabBaseUrl !== 'string' || !input.gitlabBaseUrl.startsWith('https://')) {
      throw new Error('gitlabBaseUrl must start with https://');
    }
  }

  // refreshIntervalHours must be a number between 1 and 168
  if (input.refreshIntervalHours !== undefined) {
    const val = input.refreshIntervalHours;
    if (typeof val !== 'number' || !Number.isFinite(val) || val < 1 || val > 168) {
      throw new Error('refreshIntervalHours must be a number between 1 and 168');
    }
  }

  // String fields: type check
  const stringFields = ['projectPath', 'jobName', 'branch', 'artifactPath'];
  for (const field of stringFields) {
    if (input[field] !== undefined && typeof input[field] !== 'string') {
      throw new Error(`${field} must be a string`);
    }
  }

  // enabled must be boolean
  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
    throw new Error('enabled must be a boolean');
  }
}

/**
 * Set a callback that is invoked when config save changes the cadence.
 * The callback receives the new cadence string (e.g. '12h').
 * @param {Function} callback
 */
function setOnCadenceChange(callback) {
  _onCadenceChange = callback;
}

/**
 * Handle config save: notify cadence change and optionally trigger immediate fetch.
 */
async function onConfigSave(storage, newConfig) {
  validateConfig(newConfig);

  const oldConfig = loadConfig(storage);
  const wasEnabled = oldConfig.enabled;
  const config = { ...DEFAULT_CONFIG, ...newConfig };

  saveConfig(storage, config);

  // Notify cadence change
  if (_onCadenceChange) {
    _onCadenceChange(config.refreshIntervalHours + 'h');
  }

  const token = getToken();
  if (config.enabled && token && !wasEnabled) {
    // Immediate fetch if newly enabled
    return runFetch(storage, config);
  }

  return { status: 'saved' };
}

function isFetchInProgress() {
  return fetchInProgress;
}

module.exports = {
  init,
  DEFAULT_CONFIG,
  validateConfig,
  getToken,
  getTokenSource,
  loadConfig,
  saveConfig,
  runFetch,
  manualRefresh,
  setOnCadenceChange,
  onConfigSave,
  isFetchInProgress,
  _setFetchFn(fn) { _fetchArtifacts = fn; }
};
