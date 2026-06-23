const AdmZip = require('adm-zip');
const path = require('path');
const { Octokit } = require('@octokit/rest');
const { upsertReport, readReports, writeReportsAtomic } = require('./storage');

const SCORER_OWNER = 'opendatahub-io';
const SCORER_REPO = 'disconnected-readiness-scorer';
const WORKFLOW_FILE = 'readiness-summary.yml';
const ARTIFACT_NAME = 'readiness-reports';

function createOctokit(token) {
  return new Octokit({
    auth: token,
    request: {
      timeout: 30000
    }
  });
}

async function fetchConsolidatedReport(token) {
  const octokit = createOctokit(token);

  try {
    // First, get the default branch name
    const { data: repoData } = await octokit.rest.repos.get({
      owner: SCORER_OWNER,
      repo: SCORER_REPO
    });

    const defaultBranch = repoData.default_branch;

    // Fetch workflow runs from the default branch only
    const { data: runsData } = await octokit.rest.actions.listWorkflowRuns({
      owner: SCORER_OWNER,
      repo: SCORER_REPO,
      workflow_id: WORKFLOW_FILE,
      status: 'completed',
      branch: defaultBranch,
      per_page: 1
    });

    if (!runsData.workflow_runs || runsData.workflow_runs.length === 0) {
      return { status: 'no_runs', message: 'No completed workflow runs found' };
    }

    const run = runsData.workflow_runs[0];
    if (run.conclusion !== 'success') {
      return { status: 'run_failed', message: `Latest run concluded with: ${run.conclusion}`, runId: run.id };
    }

    // Get artifacts for the run
    const { data: artifactsData } = await octokit.rest.actions.listWorkflowRunArtifacts({
      owner: SCORER_OWNER,
      repo: SCORER_REPO,
      run_id: run.id
    });

    const artifact = artifactsData.artifacts.find(a => a.name === ARTIFACT_NAME);

    if (!artifact) {
      return { status: 'no_artifact', message: `Artifact '${ARTIFACT_NAME}' not found in run ${run.id}` };
    }

    if (artifact.expired) {
      return { status: 'expired', message: 'Artifact has expired' };
    }

    // Download the artifact - Octokit handles redirects automatically
    const response = await octokit.rest.actions.downloadArtifact({
      owner: SCORER_OWNER,
      repo: SCORER_REPO,
      artifact_id: artifact.id,
      archive_format: 'zip'
    });

    const buffer = Buffer.from(response.data);
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
      } catch {
        console.debug(`[system-health/disconnected] Skipping unparseable JSON: ${normalized}`);
      }
    }

    return {
      status: 'success',
      reports,
      runId: run.id,
      runCreatedAt: run.created_at
    };
  } catch (error) {
    // Handle Octokit/GitHub API errors
    if (error.status === 401 || error.status === 403) {
      throw new Error(`GitHub API auth failed (${error.status}). Check your token.`, { cause: error });
    }
    if (error.status === 404) {
      throw new Error(`Repository or workflow not found: ${SCORER_OWNER}/${SCORER_REPO}`, { cause: error });
    }
    // Re-throw other errors as-is
    throw error;
  }
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
  createOctokit
};
