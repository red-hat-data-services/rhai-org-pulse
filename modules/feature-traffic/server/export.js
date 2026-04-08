/**
 * Feature Traffic export hook for anonymized test data.
 *
 * Handles: feature-traffic/index.json, feature-traffic/features/*.json
 */

const DATA_PREFIX = 'feature-traffic';

module.exports = async function featureTrafficExport(addFile, storage, mapping) {
  const { readFromStorage, listKeys } = storage;

  // 1. index.json
  const index = readFromStorage(`${DATA_PREFIX}/index.json`);
  if (!index) return;

  const anonymizedIndex = { ...index };
  if (Array.isArray(anonymizedIndex.features)) {
    anonymizedIndex.features = anonymizedIndex.features.map(f => anonymizeFeatureSummary(f, mapping));
  }
  addFile(`${DATA_PREFIX}/index.json`, anonymizedIndex);

  // 2. features/*.json
  const featureKeys = listKeys ? listKeys(`${DATA_PREFIX}/features/`) : [];
  for (const key of featureKeys) {
    const feature = readFromStorage(key);
    if (!feature) continue;
    const fileName = key.split('/').pop();
    const anonymized = anonymizeFeatureDetail(feature, mapping);
    addFile(`${DATA_PREFIX}/features/${fileName}`, anonymized);
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
