/**
 * Releases module export hook.
 *
 * Handles exported files listed in module.json > export.files:
 * - releases/registry.json
 * - releases/execution/index.json
 * - releases/execution/features/*.json
 *
 * Storage reads and export paths both use releases/execution/.
 */

const DATA_PREFIX = 'releases';
const EXECUTION_STORAGE_PREFIX = 'releases/execution';
const EXECUTION_EXPORT_PREFIX = `${DATA_PREFIX}/execution`;

module.exports = async function releasesExport(addFile, storage, mapping) {
  const { readFromStorage, listStorageFiles } = storage;

  // Registry (no sensitive data — export as-is)
  const registry = await readFromStorage(`${DATA_PREFIX}/registry.json`);
  if (registry) {
    addFile(`${DATA_PREFIX}/registry.json`, registry);
  }

  // Execution data (feature-traffic storage -> releases/execution export)
  const index = await readFromStorage(`${EXECUTION_STORAGE_PREFIX}/index.json`);
  if (index) {
    const anonymizedIndex = { ...index };
    if (Array.isArray(anonymizedIndex.features)) {
      anonymizedIndex.features = anonymizedIndex.features.map(f => anonymizeFeatureSummary(f, mapping));
    }
    addFile(`${EXECUTION_EXPORT_PREFIX}/index.json`, anonymizedIndex);

    // features/*.json
    let featureFiles;
    try { featureFiles = await listStorageFiles(`${EXECUTION_STORAGE_PREFIX}/features`) || []; } catch { featureFiles = []; }
    for (const fileName of featureFiles) {
      const feature = await readFromStorage(`${EXECUTION_STORAGE_PREFIX}/features/${fileName}`);
      if (!feature) continue;
      const anonymized = anonymizeFeatureDetail(feature, mapping);
      const anonymizedFileName = anonymized.key ? `${anonymized.key}.json` : fileName;
      addFile(`${EXECUTION_EXPORT_PREFIX}/features/${anonymizedFileName}`, anonymized);
    }
  }
};

function anonymizeFeatureSummary(feature, mapping) {
  if (!feature) return feature;
  const result = { ...feature };

  if (result.key) result.key = mapping.anonymizeJiraKey(result.key);
  if (result.summary) result.summary = mapping.anonymizeIssueSummary(result.key || result.summary);

  return result;
}

function anonymizeFeatureDetail(feature, mapping) {
  if (!feature) return feature;
  const result = { ...feature };

  if (result.key) result.key = mapping.anonymizeJiraKey(result.key);
  if (result.summary) result.summary = mapping.anonymizeIssueSummary(result.key || result.summary);

  if (Array.isArray(result.epics)) {
    result.epics = result.epics.map(epic => {
      const e = { ...epic };
      if (e.key) e.key = mapping.anonymizeJiraKey(e.key);
      if (e.summary) e.summary = mapping.anonymizeIssueSummary(e.key || e.summary);
      if (e.assignee) e.assignee = mapping.getOrCreateNameMapping(e.assignee);
      if (e.accountId) e.accountId = mapping.getOrCreateAccountIdMapping(e.accountId);
      return e;
    });
  }

  return result;
}
