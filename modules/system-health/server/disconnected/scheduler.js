const githubFetch = require('./github-fetch');

let fetchInProgress = false;
let lastSuccessfulFetch = 0;
const COOLDOWN_MS = 5 * 60 * 1000;

let _secrets = {};

function init(secrets) {
  _secrets = secrets || {};
}

function getToken() {
  return _secrets.GITHUB_TOKEN || null;
}

function getTokenSource() {
  if (_secrets.GITHUB_TOKEN) return 'GITHUB_TOKEN';
  return null;
}

async function runFetch(storage) {
  if (fetchInProgress) {
    return { status: 'skipped', message: 'Fetch already in progress' };
  }

  const token = getToken();
  if (!token) {
    return { status: 'error', message: 'No GITHUB_TOKEN configured.' };
  }

  fetchInProgress = true;
  try {
    const fetchResult = await githubFetch.fetchAllReports(storage, token);
    if (fetchResult.status === 'success') {
      lastSuccessfulFetch = Date.now();
    }
    storage.writeToStorage('system-health/disconnected/last-fetch.json', fetchResult);
    return fetchResult;
  } catch (err) {
    console.error('[system-health/disconnected] Fetch error:', err.message);
    const errorResult = { status: 'error', message: err.message, timestamp: new Date().toISOString() };
    storage.writeToStorage('system-health/disconnected/last-fetch.json', errorResult);
    return errorResult;
  } finally {
    fetchInProgress = false;
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
