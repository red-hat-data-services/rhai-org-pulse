/**
 * Scheduler for periodic GitLab artifact fetching.
 * Manages interval timer, mutex lock, cooldown, and config reload.
 */

const gitlabFetch = require('./gitlab-fetch');

let fetchInProgress = false;
// Allows test override
let _fetchArtifacts = gitlabFetch.fetchArtifacts;
let schedulerTimer = null;
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

function getToken() {
  return process.env.FEATURE_TRAFFIC_GITLAB_TOKEN || process.env.GITLAB_TOKEN || null;
}

function getTokenSource() {
  if (process.env.FEATURE_TRAFFIC_GITLAB_TOKEN) return 'FEATURE_TRAFFIC_GITLAB_TOKEN';
  if (process.env.GITLAB_TOKEN) return 'GITLAB_TOKEN';
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
    console.error('[feature-traffic] Fetch error:', err.message);
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
 * Start the scheduler with the given interval.
 */
function startScheduler(storage, intervalHours) {
  stopScheduler();

  if (!intervalHours || intervalHours <= 0) return;

  const intervalMs = intervalHours * 60 * 60 * 1000;
  schedulerTimer = setInterval(function () {
    runFetch(storage).catch(function (err) {
      console.error('[feature-traffic] Scheduled fetch error:', err.message);
    });
  }, intervalMs);

  if (schedulerTimer.unref) schedulerTimer.unref();

  console.log(`[feature-traffic] Scheduler started: every ${intervalHours}h`);
}

function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

/**
 * Initialize scheduler based on saved config.
 * Called on module load.
 */
function initScheduler(storage) {
  const config = loadConfig(storage);
  const token = getToken();

  if (config.enabled && token) {
    startScheduler(storage, config.refreshIntervalHours);
  } else {
    if (!token) {
      console.log('[feature-traffic] No GitLab token configured, scheduler not started');
    } else if (!config.enabled) {
      console.log('[feature-traffic] Fetch disabled in config, scheduler not started');
    }
  }
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
 * Handle config save: restart scheduler and optionally trigger immediate fetch.
 */
async function onConfigSave(storage, newConfig) {
  validateConfig(newConfig);

  const oldConfig = loadConfig(storage);
  const wasEnabled = oldConfig.enabled;
  const config = { ...DEFAULT_CONFIG, ...newConfig };

  saveConfig(storage, config);

  const token = getToken();
  if (config.enabled && token) {
    startScheduler(storage, config.refreshIntervalHours);
    // Immediate fetch if newly enabled
    if (!wasEnabled) {
      return runFetch(storage, config);
    }
  } else {
    stopScheduler();
  }

  return { status: 'saved' };
}

function isFetchInProgress() {
  return fetchInProgress;
}

module.exports = {
  DEFAULT_CONFIG,
  validateConfig,
  getToken,
  getTokenSource,
  loadConfig,
  saveConfig,
  runFetch,
  manualRefresh,
  startScheduler,
  stopScheduler,
  initScheduler,
  onConfigSave,
  isFetchInProgress,
  _setFetchFn(fn) { _fetchArtifacts = fn; }
};
