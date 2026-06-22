/**
 * GitLab Jobs API client for fetching CI pipeline artifacts.
 * Downloads artifact zip, extracts in-memory, writes to storage.
 */

const AdmZip = require('adm-zip');
const path = require('path');

// Allows test override
let _fetch = globalThis.fetch;

const DATA_PREFIX = 'releases/execution';

/**
 * Fetch artifacts from GitLab CI and write to storage.
 * After extraction, optionally enriches features from Jira and writes
 * unified feature files via the feature store.
 *
 * @param {object} storage - storage abstraction
 * @param {object} config - fetch configuration
 * @param {string} token - GitLab PAT
 * @param {object} [jira] - Jira client ({ jiraRequest, fetchAllJqlResults }), optional
 * @returns {object} fetch result summary
 */
async function fetchArtifacts(storage, config, token, jira) {
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

  // Validate base URL to prevent SSRF via admin config
  let parsedBase;
  try {
    parsedBase = new URL(gitlabBaseUrl);
  } catch {
    throw new Error('Invalid gitlabBaseUrl');
  }
  if (!['https:', 'http:'].includes(parsedBase.protocol)) {
    throw new Error('gitlabBaseUrl must use http or https');
  }

  const encodedProject = encodeURIComponent(projectPath);
  const url = `${parsedBase.origin}/api/v4/projects/${encodedProject}/jobs/artifacts/${encodeURIComponent(branch)}/download?job=${encodeURIComponent(jobName)}`;

  console.log(`[releases/execution] Fetching artifacts from ${projectPath} (branch: ${branch}, job: ${jobName})`);
  const startTime = Date.now();

  const fetchOptions = {
    headers: { 'Authorization': `Bearer ${token}` },
    signal: AbortSignal.timeout(30000)
  };

  const response = await _fetch(url, fetchOptions);

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

  const buffer = Buffer.from(await response.arrayBuffer());
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

  // Separate pipeline index from feature files
  const indexData = staged.get('index.json');
  staged.delete('index.json');

  // Build pipeline index lookup for pipeline-index-only fields
  const pipelineIndexMap = new Map();
  if (indexData && Array.isArray(indexData.features)) {
    for (let i = 0; i < indexData.features.length; i++) {
      const entry = indexData.features[i];
      if (entry.key) pipelineIndexMap.set(entry.key, entry);
    }
  }

  // Collect pipeline feature data, keyed by issue key
  const pipelineFeatures = new Map();
  const nonFeatureFiles = new Map();

  for (const [filePath, data] of staged) {
    if (filePath.startsWith('features/') && filePath.endsWith('.json')) {
      const key = filePath.replace('features/', '').replace('.json', '');
      // Merge pipeline-index-only fields onto the feature data
      const indexEntry = pipelineIndexMap.get(key);
      if (indexEntry) {
        if (indexEntry.pm !== undefined) data.pm = indexEntry.pm;
        if (indexEntry.architect !== undefined) data.architect = indexEntry.architect;
        if (indexEntry.parentKey !== undefined) data.parentKey = indexEntry.parentKey;
        if (indexEntry.targetVersions !== undefined) data.targetVersions = indexEntry.targetVersions;
      }
      pipelineFeatures.set(key, data);
    } else {
      nonFeatureFiles.set(filePath, data);
    }
  }

  // Write non-feature files directly (e.g., config files in the artifact)
  let fileCount = 0;
  for (const [filePath, data] of nonFeatureFiles) {
    storage.writeToStorage(`${DATA_PREFIX}/${filePath}`, data);
    fileCount++;
  }

  // Enrich pipeline features from Jira (fail-safe)
  const featureKeys = Array.from(pipelineFeatures.keys());
  let enrichmentMap = new Map();

  if (jira && featureKeys.length > 0) {
    try {
      const { enrichFeatures } = require('./jira-enrich');
      enrichmentMap = await enrichFeatures(
        featureKeys,
        jira.jiraRequest,
        jira.fetchAllJqlResults
      );
      console.log(`[releases/execution] Post-ingest enrichment: ${enrichmentMap.size}/${featureKeys.length} features enriched`);
    } catch (err) {
      console.warn('[releases/execution] Post-ingest Jira enrichment failed (pipeline data preserved):', err.message);
    }
  }

  // Merge pipeline + jira + existing data via feature store
  const { mergeFeatureData, writeFeatures } = require('./feature-store');
  const mergedFeatures = [];

  for (const [key, pipelineData] of pipelineFeatures) {
    const existing = storage.readFromStorage(`${DATA_PREFIX}/features/${key}.json`);
    const jiraData = enrichmentMap.get(key) || null;
    const merged = mergeFeatureData(existing, pipelineData, jiraData);
    mergedFeatures.push(merged);
  }

  // Write merged features + rebuild derived index
  await writeFeatures(storage, mergedFeatures);
  fileCount += mergedFeatures.length + 1; // features + index.json

  const duration = Date.now() - startTime;
  console.log(`[releases/execution] Fetch complete: ${fileCount} files in ${duration}ms`);

  if (warnings.length > 0) {
    console.warn(`[releases/execution] Warnings during extraction:`, warnings);
  }

  const result = {
    status: 'success',
    timestamp: new Date().toISOString(),
    duration,
    fileCount,
    enrichedCount: enrichmentMap.size,
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
