/**
 * Unified feature store — merge logic, writes, and index derivation.
 *
 * Merges data from pipeline (GitLab CI artifacts) and Jira enrichment
 * into canonical per-feature JSON files. Derives index.json from the
 * set of feature files.
 */

const DATA_PREFIX = 'releases/execution';

let storeWriteInProgress = false;

// Jira-owned fields — Jira always wins, preserve existing if jiraData is null
const JIRA_FIELDS = [
  'status', 'statusCategory', 'colorStatus', 'ownerStatusColor',
  'statusSummary', 'assignee', 'pm', 'labels', 'fixVersions',
  'components', 'priority', 'team', 'releaseType', 'docsRequired',
  'targetEnd', 'riceScore', 'riceStatus', 'isBlocked', 'linkedRfeKey',
  'issueLinks', 'epics'
];

// Pipeline-owned fields — pipeline always wins
const PIPELINE_FIELDS = [
  'metrics', 'topology', 'trafficSignals', 'statusNotes'
];

// Pipeline-index-only fields — written from pipeline index during ingest
const PIPELINE_INDEX_FIELDS = [
  'architect', 'parentKey', 'targetVersions'
];

/**
 * Merge data from existing store, pipeline ingest, and Jira enrichment.
 * All three inputs are optional (may be null).
 *
 * @param {object|null} existing - Current stored feature data
 * @param {object|null} pipelineData - New pipeline-delivered data
 * @param {object|null} jiraData - New Jira enrichment data
 * @returns {object} Merged feature object
 */
function mergeFeatureData(existing, pipelineData, jiraData) {
  const base = existing || {};
  const pipeline = pipelineData || {};
  const jira = jiraData || {};

  // Start with existing as base
  const merged = { ...base };

  // Key and summary: Jira wins, pipeline fallback
  merged.key = jira.key || pipeline.key || base.key;
  merged.summary = jira.summary || pipeline.summary || base.summary || '';

  // Pipeline-owned fields: pipeline wins when present
  for (let i = 0; i < PIPELINE_FIELDS.length; i++) {
    const field = PIPELINE_FIELDS[i];
    if (pipeline[field] !== undefined) {
      merged[field] = pipeline[field];
    }
  }

  // Pipeline-index-only fields: refreshed on pipeline ingest
  for (let i = 0; i < PIPELINE_INDEX_FIELDS.length; i++) {
    const field = PIPELINE_INDEX_FIELDS[i];
    if (pipeline[field] !== undefined) {
      merged[field] = pipeline[field];
    }
  }

  // Jira-owned fields: Jira wins when jiraData is provided
  if (jiraData) {
    for (let i = 0; i < JIRA_FIELDS.length; i++) {
      const field = JIRA_FIELDS[i];
      if (jira[field] !== undefined) {
        merged[field] = jira[field];
      }
    }
  }
  // If jiraData is null (enrichment failed/skipped), preserve existing Jira fields

  // created: Jira is source of truth (issue creation date)
  if (jira.created) {
    merged.created = jira.created;
  } else if (pipeline.created) {
    merged.created = pipeline.created;
  }

  // updated: latest of Jira and pipeline
  const jiraUpdated = jira.updated ? new Date(jira.updated).getTime() : 0;
  const pipelineUpdated = pipeline.updated ? new Date(pipeline.updated).getTime() : 0;
  const existingUpdated = base.updated ? new Date(base.updated).getTime() : 0;
  const latestUpdated = Math.max(jiraUpdated, pipelineUpdated, existingUpdated);
  if (latestUpdated > 0) {
    if (jiraUpdated === latestUpdated) merged.updated = jira.updated;
    else if (pipelineUpdated === latestUpdated) merged.updated = pipeline.updated;
    // else keep existing
  }

  // _sources metadata
  const sources = { ...(base._sources || {}) };
  if (pipelineData) {
    sources.pipeline = new Date().toISOString();
  }
  if (jiraData) {
    sources.jira = new Date().toISOString();
  }
  merged._sources = sources;

  return merged;
}

/**
 * Write a batch of features and rebuild the index.
 * Protected by a simple mutex to prevent interleaving.
 *
 * @param {object} storage - Storage abstraction
 * @param {object[]} features - Array of feature objects to write
 */
async function writeFeatures(storage, features) {
  // Wait for any in-progress write to complete
  while (storeWriteInProgress) {
    await new Promise(function(resolve) { setTimeout(resolve, 100); });
  }

  storeWriteInProgress = true;
  try {
    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      if (!feature.key) continue;
      storage.writeToStorage(
        DATA_PREFIX + '/features/' + feature.key + '.json',
        feature
      );
    }

    await rebuildIndex(storage);
  } finally {
    storeWriteInProgress = false;
  }
}

/**
 * Rebuild index.json by scanning all feature files in storage.
 * Maps detail fields to index summary fields.
 *
 * @param {object} storage - Storage abstraction
 */
async function rebuildIndex(storage) {
  const fileNames = storage.listStorageFiles(DATA_PREFIX + '/features');
  if (!fileNames || fileNames.length === 0) {
    storage.writeToStorage(DATA_PREFIX + '/index.json', {
      fetchedAt: new Date().toISOString(),
      schemaVersion: 'v2',
      featureCount: 0,
      features: []
    });
    return;
  }

  const features = [];

  for (let i = 0; i < fileNames.length; i++) {
    const fileName = fileNames[i];
    if (!fileName.endsWith('.json')) continue;

    const feature = storage.readFromStorage(DATA_PREFIX + '/features/' + fileName);
    if (!feature || !feature.key) continue;

    // Map detail fields to index summary fields
    const indexEntry = {
      key: feature.key,
      summary: feature.summary || '',
      status: feature.status || null,
      statusCategory: feature.statusCategory || null,
      priority: feature.priority || null,
      // Index uses string assignee (detail has object)
      assignee: feature.assignee
        ? (typeof feature.assignee === 'object' ? feature.assignee.displayName : feature.assignee)
        : null,
      fixVersions: feature.fixVersions || [],
      labels: feature.labels || [],
      // Derived from metrics
      completionPct: feature.metrics ? (feature.metrics.completionPct || 0) : 0,
      epicCount: feature.metrics ? (feature.metrics.totalEpics || 0) : 0,
      issueCount: feature.metrics ? (feature.metrics.totalIssues || 0) : 0,
      blockerCount: feature.metrics ? (feature.metrics.blockerCount || 0) : 0,
      health: feature.metrics ? (feature.metrics.health || null) : null,
      // Timestamps
      lastUpdated: feature.updated || null,
      // Pipeline-index-only fields
      targetVersions: feature.targetVersions || null,
      pm: feature.pm
        ? (typeof feature.pm === 'object' ? feature.pm.displayName : feature.pm)
        : null,
      architect: feature.architect || null,
      parentKey: feature.parentKey || null,
      // Jira-sourced fields for index filtering
      colorStatus: feature.colorStatus || null,
      ownerStatusColor: feature.colorStatus || null, // backward compat alias
      team: feature.team || null,
      components: feature.components || []
    };

    features.push(indexEntry);
  }

  storage.writeToStorage(DATA_PREFIX + '/index.json', {
    fetchedAt: new Date().toISOString(),
    schemaVersion: 'v2',
    featureCount: features.length,
    features
  });
}

module.exports = {
  mergeFeatureData,
  writeFeatures,
  rebuildIndex,
  DATA_PREFIX,
  JIRA_FIELDS,
  PIPELINE_FIELDS,
  PIPELINE_INDEX_FIELDS
};
