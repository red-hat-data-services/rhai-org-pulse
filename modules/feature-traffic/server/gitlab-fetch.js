/**
 * GitLab Jobs API client for fetching CI pipeline artifacts.
 * Downloads artifact zip, extracts in-memory, writes to storage.
 */

const nodeFetch = require('node-fetch');
const AdmZip = require('adm-zip');
const path = require('path');

// Allows test override
let _fetch = nodeFetch;

const DATA_PREFIX = 'feature-traffic';

/**
 * Fetch artifacts from GitLab CI and write to storage.
 * @param {object} storage - storage abstraction
 * @param {object} config - fetch configuration
 * @param {string} token - GitLab PAT
 * @returns {object} fetch result summary
 */
async function fetchArtifacts(storage, config, token) {
  const {
    gitlabBaseUrl = 'https://gitlab.com',
    projectPath,
    jobName = 'fetch-traffic',
    branch = 'main',
    artifactPath = 'output'
  } = config;

  if (!projectPath) {
    throw new Error('projectPath is required');
  }

  const encodedProject = encodeURIComponent(projectPath);
  const url = `${gitlabBaseUrl}/api/v4/projects/${encodedProject}/jobs/artifacts/${encodeURIComponent(branch)}/download?job=${encodeURIComponent(jobName)}`;

  console.log(`[feature-traffic] Fetching artifacts from ${projectPath} (branch: ${branch}, job: ${jobName})`);
  const startTime = Date.now();

  const response = await _fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
    timeout: 30000
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 401) {
      throw new Error('GitLab API authentication failed (401). Check your token.');
    }
    if (status === 404) {
      return {
        status: 'artifact_expired',
        message: 'Artifacts not found (404). They may have expired or the project/job/branch is incorrect.',
        timestamp: new Date().toISOString()
      };
    }
    if (status === 429) {
      throw new Error('GitLab API rate limited (429). Try again later.');
    }
    throw new Error(`GitLab API returned ${status}: ${response.statusText}`);
  }

  const buffer = await response.buffer();
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  // Stage all files in-memory first
  const staged = new Map();
  const warnings = [];
  const prefix = artifactPath ? artifactPath.replace(/\/$/, '') + '/' : '';

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    let entryName = entry.entryName;

    // Strip artifact path prefix
    if (prefix && entryName.startsWith(prefix)) {
      entryName = entryName.slice(prefix.length);
    }

    // Skip non-JSON files
    if (!entryName.endsWith('.json')) continue;

    // Zip-slip protection: ensure resolved path stays within target
    const resolved = path.resolve('/', entryName);
    if (!resolved.startsWith('/')) {
      warnings.push(`Skipped entry with suspicious path: ${entry.entryName}`);
      continue;
    }
    const normalized = resolved.slice(1); // Remove leading /
    if (normalized.includes('..') || path.isAbsolute(entryName)) {
      warnings.push(`Skipped entry with path traversal: ${entry.entryName}`);
      continue;
    }

    try {
      const content = entry.getData().toString('utf8');
      const parsed = JSON.parse(content);
      staged.set(normalized, parsed);
    } catch (err) {
      warnings.push(`Failed to parse ${entry.entryName}: ${err.message}`);
    }
  }

  // Validate critical files present
  if (!staged.has('index.json')) {
    throw new Error('Artifact archive missing index.json. Existing data preserved.');
  }

  // Atomic write: features first, index.json last
  const indexData = staged.get('index.json');
  staged.delete('index.json');

  let fileCount = 0;
  for (const [filePath, data] of staged) {
    storage.writeToStorage(`${DATA_PREFIX}/${filePath}`, data);
    fileCount++;
  }

  // Write index.json last
  storage.writeToStorage(`${DATA_PREFIX}/index.json`, indexData);
  fileCount++;

  const duration = Date.now() - startTime;
  console.log(`[feature-traffic] Fetch complete: ${fileCount} files in ${duration}ms`);

  if (warnings.length > 0) {
    console.warn(`[feature-traffic] Warnings during extraction:`, warnings);
  }

  const result = {
    status: 'success',
    timestamp: new Date().toISOString(),
    duration,
    fileCount,
    warnings: warnings.length > 0 ? warnings : undefined
  };

  // Write last-fetch metadata
  storage.writeToStorage(`${DATA_PREFIX}/last-fetch.json`, result);

  return result;
}

module.exports = {
  fetchArtifacts,
  DATA_PREFIX,
  _setFetch(fn) { _fetch = fn; }
};
