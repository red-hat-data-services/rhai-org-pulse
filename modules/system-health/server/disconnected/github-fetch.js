const AdmZip = require('adm-zip');
const path = require('path');
const { upsertReport, readReports, writeReportsAtomic } = require('./storage');

let _fetch = fetch;

const SCORER_OWNER = 'opendatahub-io';
const SCORER_REPO = 'disconnected-readiness-scorer';
const WORKFLOW_FILE = 'readiness-summary.yml';
const ARTIFACT_NAME = 'readiness-reports';

function buildFetchOptions(token) {
  const opts = {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    signal: AbortSignal.timeout(30000)
  };
  // Note: Proxy support with native fetch requires different approach than node-fetch.
  // For now, proxies must be configured at the OS/container level (e.g., HTTP_PROXY env var).
  // Future enhancement could use undici ProxyAgent with dispatcher option.
  // Fixed: Native fetch timeout and proxy compatibility for Node.js
  return opts;
}

async function fetchConsolidatedReport(token) {
  const opts = buildFetchOptions(token);

  const runsUrl = `https://api.github.com/repos/${SCORER_OWNER}/${SCORER_REPO}/actions/workflows/${WORKFLOW_FILE}/runs?status=completed&per_page=1`;
  const runsResponse = await _fetch(runsUrl, opts);

  if (!runsResponse.ok) {
    if (runsResponse.status === 401 || runsResponse.status === 403) {
      throw new Error(`GitHub API auth failed (${runsResponse.status}). Check your token.`);
    }
    throw new Error(`Failed to fetch workflow runs (${runsResponse.status})`);
  }

  const runsData = await runsResponse.json();
  if (!runsData.workflow_runs || runsData.workflow_runs.length === 0) {
    return { status: 'no_runs', message: 'No completed workflow runs found' };
  }

  const run = runsData.workflow_runs[0];
  if (run.conclusion !== 'success') {
    return { status: 'run_failed', message: `Latest run concluded with: ${run.conclusion}`, runId: run.id };
  }

  const artifactsUrl = `https://api.github.com/repos/${SCORER_OWNER}/${SCORER_REPO}/actions/runs/${run.id}/artifacts`;
  const artifactsResponse = await _fetch(artifactsUrl, opts);

  if (!artifactsResponse.ok) {
    throw new Error(`Failed to fetch artifacts (${artifactsResponse.status})`);
  }

  const artifactsData = await artifactsResponse.json();
  const artifact = (artifactsData.artifacts || []).find(a => a.name === ARTIFACT_NAME);

  if (!artifact) {
    return { status: 'no_artifact', message: `Artifact '${ARTIFACT_NAME}' not found in run ${run.id}` };
  }

  if (artifact.expired) {
    return { status: 'expired', message: 'Artifact has expired' };
  }

  const downloadUrl = artifact.archive_download_url;
  let parsed;
  try {
    parsed = new URL(downloadUrl);
  } catch {
    throw new Error('Invalid artifact download URL');
  }
  if (parsed.hostname !== 'api.github.com') {
    throw new Error('Unexpected download URL hostname: ' + parsed.hostname);
  }

  const downloadOpts = buildFetchOptions(token);
  downloadOpts.redirect = 'follow';
  const downloadResponse = await _fetch(downloadUrl, downloadOpts);

  if (!downloadResponse.ok) {
    throw new Error(`Artifact download failed (${downloadResponse.status})`);
  }

  const buffer = Buffer.from(await downloadResponse.arrayBuffer());
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  const reports = [];
  for (const entry of entries) {
    if (entry.isDirectory) continue;

    // Guard against zip traversal attacks: ensure entry stays within safe bounds
    const resolved = path.resolve('/', entry.entryName);
    const normalized = resolved.slice(1);
    if (normalized.includes('..')) continue;

    if (!normalized.endsWith('.json') || normalized === 'summary.json') continue;

    try {
      const report = JSON.parse(entry.getData().toString('utf8'));
      if (report && report.repo && report.score && Array.isArray(report.rules)) {
        reports.push(report);
      }
    } catch { // skip unparseable
    }
  }

  return {
    status: 'success',
    reports,
    runId: run.id,
    runCreatedAt: run.created_at
  };
}

async function fetchAllReports(storage, token) {
  const startTime = Date.now();

  console.log(`[system-health/disconnected] Fetching consolidated report from ${SCORER_OWNER}/${SCORER_REPO}`);
  const result = await fetchConsolidatedReport(token);

  if (result.status !== 'success') {
    console.warn(`[system-health/disconnected] ${result.status}: ${result.message || ''}`);
    return { status: result.status, message: result.message, timestamp: new Date().toISOString() };
  }

  const data = readReports(storage.readFromStorage);
  const counts = { created: 0, updated: 0, unchanged: 0 };

  for (const report of result.reports) {
    if (!report.date) {
      report.date = result.runCreatedAt;
    }
    const status = upsertReport(data, report);
    counts[status]++;
  }

  data.lastSyncedAt = new Date().toISOString();
  data.repoCount = Object.keys(data.repos).length;
  writeReportsAtomic(storage.writeToStorageAtomic, data);

  const duration = Date.now() - startTime;
  console.log(`[system-health/disconnected] Fetch complete: ${result.reports.length} repos in ${duration}ms (${counts.created} created, ${counts.updated} updated, ${counts.unchanged} unchanged)`);

  return {
    status: 'success',
    timestamp: new Date().toISOString(),
    duration,
    repoCount: result.reports.length,
    created: counts.created,
    updated: counts.updated,
    unchanged: counts.unchanged
  };
}

module.exports = {
  fetchConsolidatedReport,
  fetchAllReports,
  SCORER_OWNER,
  SCORER_REPO,
  WORKFLOW_FILE,
  ARTIFACT_NAME,
  _setFetch(fn) { _fetch = fn; }
};
