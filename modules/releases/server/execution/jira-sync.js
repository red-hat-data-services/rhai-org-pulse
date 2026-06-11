/**
 * Periodic Jira sync and feature discovery.
 *
 * Re-enriches all features from Jira on a configurable cadence,
 * discovers new features via JQL, and reconciles tracking data.
 */

const { enrichFeatures, discoverFeatures, fetchSignOffDetails } = require('./jira-enrich');
const { mergeFeatureData, writeFeatures } = require('./feature-store');

const DATA_PREFIX = 'releases/execution';

/**
 * Sync all existing features with fresh Jira data.
 *
 * @param {object} storage - Storage abstraction
 * @param {Function} jiraRequestFn - Bound jiraRequest
 * @param {Function} fetchAllJqlResultsFn - Bound fetchAllJqlResults
 * @returns {Promise<object>} Sync result metadata
 */
async function syncAllFeatures(storage, jiraRequestFn, fetchAllJqlResultsFn) {
  const startTime = Date.now();

  // List all feature files
  const fileNames = storage.listStorageFiles(DATA_PREFIX + '/features');
  if (!fileNames || fileNames.length === 0) {
    return {
      status: 'skipped',
      message: 'No features in store',
      timestamp: new Date().toISOString()
    };
  }

  // Extract keys from filenames
  const keys = [];
  for (let i = 0; i < fileNames.length; i++) {
    if (fileNames[i].endsWith('.json')) {
      keys.push(fileNames[i].replace('.json', ''));
    }
  }

  console.log('[jira-sync] Enriching ' + keys.length + ' features from Jira');

  // Batch-enrich from Jira
  const enrichmentMap = await enrichFeatures(keys, jiraRequestFn, fetchAllJqlResultsFn);

  // Merge and collect
  const mergedFeatures = [];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const existing = storage.readFromStorage(DATA_PREFIX + '/features/' + key + '.json');
    const jiraData = enrichmentMap.get(key) || null;
    const merged = mergeFeatureData(existing, null, jiraData);
    mergedFeatures.push(merged);
  }

  // Write all merged features + rebuild index
  await writeFeatures(storage, mergedFeatures);

  // Targeted sign-off detection pass: fetch changelog only for features that
  // have aiReview with humanReviewStatus=approved but no approvedBy/approvedAt
  try {
    const signOffMap = await fetchSignOffDetails(keys, storage, jiraRequestFn, fetchAllJqlResultsFn);
    if (signOffMap.size > 0) {
      const signOffUpdates = [];
      for (const [key, signOff] of signOffMap) {
        const feature = storage.readFromStorage(DATA_PREFIX + '/features/' + key + '.json');
        if (feature && feature.aiReview) {
          feature.aiReview.approvedBy = signOff.approvedBy;
          feature.aiReview.approvedAt = signOff.approvedAt;
          signOffUpdates.push(feature);
        }
      }
      if (signOffUpdates.length > 0) {
        await writeFeatures(storage, signOffUpdates);
        console.log('[jira-sync] Updated sign-off details for ' + signOffUpdates.length + ' features');
      }
    }
  } catch (err) {
    console.warn('[jira-sync] Sign-off detection pass failed:', err.message);
  }

  const duration = Date.now() - startTime;
  const result = {
    status: 'success',
    timestamp: new Date().toISOString(),
    featureCount: keys.length,
    enrichedCount: enrichmentMap.size,
    duration,
    lastKey: keys[keys.length - 1] || null
  };

  // Write enrichment metadata
  storage.writeToStorage(DATA_PREFIX + '/last-enrichment.json', result);

  console.log('[jira-sync] Sync complete: ' + enrichmentMap.size + '/' + keys.length + ' enriched in ' + duration + 'ms');

  return result;
}

/**
 * Discover new features from Jira via configurable JQL.
 *
 * @param {object} storage - Storage abstraction
 * @param {Function} jiraRequestFn
 * @param {Function} fetchAllJqlResultsFn
 * @param {object} config - { discoveryJql: string }
 * @returns {Promise<object>} Discovery result
 */
async function discoverFromJira(storage, jiraRequestFn, fetchAllJqlResultsFn, config) {
  const jql = config.discoveryJql ||
    'project = RHAISTRAT AND issuetype IN (Feature, Initiative) AND created >= -365d';

  console.log('[jira-sync] Discovering features from Jira: ' + jql);

  const discovered = await discoverFeatures(jql, jiraRequestFn, fetchAllJqlResultsFn);

  // Check against existing store
  const newFeatures = [];
  for (let i = 0; i < discovered.length; i++) {
    const feature = discovered[i];
    const existing = storage.readFromStorage(DATA_PREFIX + '/features/' + feature.key + '.json');
    if (!existing) {
      // Create new entry from Jira data
      const merged = mergeFeatureData(null, null, feature);
      newFeatures.push(merged);
    }
  }

  if (newFeatures.length > 0) {
    await writeFeatures(storage, newFeatures);
    console.log('[jira-sync] Discovered ' + newFeatures.length + ' new features from Jira');
  }

  return {
    status: 'success',
    totalDiscovered: discovered.length,
    newFeatures: newFeatures.length
  };
}

/**
 * Reconcile tracking data files — create stub entries for keys not in the store.
 *
 * @param {object} storage - Storage abstraction
 * @returns {Promise<object>} Reconciliation result
 */
async function reconcileTrackingData(storage) {
  // Find all tracking-data-*.json files
  const files = storage.listStorageFiles(DATA_PREFIX);
  const trackingFiles = [];
  for (let i = 0; i < files.length; i++) {
    if (files[i].startsWith('tracking-data-') && files[i].endsWith('.json')) {
      trackingFiles.push(files[i]);
    }
  }

  const discoveredKeys = new Set();
  for (let i = 0; i < trackingFiles.length; i++) {
    const data = storage.readFromStorage(DATA_PREFIX + '/' + trackingFiles[i]);
    if (!data || !data.features) continue;

    // data.features is either an array or an object keyed by issue key
    if (Array.isArray(data.features)) {
      for (let j = 0; j < data.features.length; j++) {
        if (data.features[j].key) discoveredKeys.add(data.features[j].key);
      }
    } else {
      for (const key of Object.keys(data.features)) {
        discoveredKeys.add(key);
      }
    }
  }

  // Check which keys don't have feature files yet
  const newFeatures = [];
  for (const key of discoveredKeys) {
    const existing = storage.readFromStorage(DATA_PREFIX + '/features/' + key + '.json');
    if (!existing) {
      newFeatures.push({
        key,
        summary: '',
        _sources: { tracking: new Date().toISOString() }
      });
    }
  }

  if (newFeatures.length > 0) {
    await writeFeatures(storage, newFeatures);
    console.log('[jira-sync] Reconciled ' + newFeatures.length + ' features from tracking data');
  }

  return {
    trackingFilesScanned: trackingFiles.length,
    totalKeys: discoveredKeys.size,
    newStubs: newFeatures.length
  };
}

module.exports = {
  syncAllFeatures,
  discoverFromJira,
  reconcileTrackingData,
  DATA_PREFIX
};
