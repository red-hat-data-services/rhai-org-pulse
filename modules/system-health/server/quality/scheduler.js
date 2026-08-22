const gitlabFetch = require('./gitlab-fetch');

let fetchInProgress = false;
let fetchStartTime = 0;
let lastSuccessfulFetch = 0;
const COOLDOWN_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10 * 60 * 1000;

let _secrets = {};

function init(secrets) {
  _secrets = secrets || {};
}

function getToken() {
  return _secrets.GITLAB_TOKEN || null;
}

function getTokenSource() {
  if (_secrets.GITLAB_TOKEN) return 'GITLAB_TOKEN';
  return null;
}

async function runFetch(storage) {
  if (fetchInProgress) {
    const elapsed = Date.now() - fetchStartTime;
    if (elapsed > FETCH_TIMEOUT_MS) {
      console.warn('[system-health/quality] Fetch timeout exceeded, resetting fetchInProgress flag');
      fetchInProgress = false;
      fetchStartTime = 0;
    } else {
      return { status: 'skipped', message: 'Fetch already in progress' };
    }
  }

  const token = getToken();
  if (!token) {
    return { status: 'error', message: 'No GITLAB_TOKEN configured.' };
  }

  fetchInProgress = true;
  fetchStartTime = Date.now();
  try {
    const fetchResult = await gitlabFetch.fetchReports(storage, token);
    if (fetchResult.status === 'success') {
      lastSuccessfulFetch = Date.now();
    }
    await storage.writeToStorage('system-health/quality/last-fetch.json', fetchResult);
    return fetchResult;
  } catch (err) {
    console.error('[system-health/quality] Fetch error:', err.message);
    const errorResult = { status: 'error', message: err.message, timestamp: new Date().toISOString() };
    await storage.writeToStorage('system-health/quality/last-fetch.json', errorResult);
    return errorResult;
  } finally {
    fetchInProgress = false;
    fetchStartTime = 0;
  }
}

async function manualRefresh(storage) {
  const now = Date.now();
  const elapsed = now - lastSuccessfulFetch;
  if (lastSuccessfulFetch > 0 && elapsed < COOLDOWN_MS) {
    const retryAfter = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    return { status: 'cooldown', retryAfter, httpStatus: 429 };
  }
  return runFetch(storage);
}

function isFetchInProgress() {
  return fetchInProgress;
}

module.exports = {
  init,
  getToken,
  getTokenSource,
  runFetch,
  manualRefresh,
  isFetchInProgress
};
