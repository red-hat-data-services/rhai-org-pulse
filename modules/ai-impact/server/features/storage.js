/**
 * AI Impact feature storage — response-shaping transforms.
 *
 * Reads from the unified releases execution store and reshapes data
 * for backward-compatible AI Impact API responses.
 *
 * The canonical feature store is owned by releases. AI Impact pushes
 * review data via the internal API (POST /api/modules/releases/execution/ai-review/bulk).
 */

const RELEASES_INDEX_KEY = 'releases/execution/index.json';
const RELEASES_FEATURE_PREFIX = 'releases/execution/features/';
const LEGACY_STORAGE_KEY = 'ai-impact/features.json';

/**
 * Read features from the unified releases store and reshape into the
 * AI Impact format ({ features: { [key]: { latest, history } }, ... }).
 *
 * Falls back to the legacy ai-impact/features.json if no releases data
 * has aiReview entries yet (pre-migration).
 *
 * @param {Function} readFromStorage - The storage read function
 * @returns {object} Features data object (never null)
 */
function readFeatures(readFromStorage) {
  const index = readFromStorage(RELEASES_INDEX_KEY);
  if (!index || !Array.isArray(index.features)) {
    // Fallback to legacy store
    const legacy = readFromStorage(LEGACY_STORAGE_KEY);
    if (legacy && typeof legacy === 'object' && legacy.features) {
      return legacy;
    }
    return { lastSyncedAt: null, totalFeatures: 0, features: {} };
  }

  // Filter to only features that have aiReview data
  const aiFeatures = index.features.filter(function(f) { return f.aiReview; });
  if (aiFeatures.length === 0) {
    // Check legacy store as fallback
    const legacy = readFromStorage(LEGACY_STORAGE_KEY);
    if (legacy && typeof legacy === 'object' && legacy.features && Object.keys(legacy.features).length > 0) {
      return legacy;
    }
    return { lastSyncedAt: null, totalFeatures: 0, features: {} };
  }

  const features = {};
  for (var i = 0; i < aiFeatures.length; i++) {
    var entry = aiFeatures[i];
    // Read the full feature file for history
    var featureFile = readFromStorage(RELEASES_FEATURE_PREFIX + entry.key + '.json');
    var aiReview = featureFile && featureFile.aiReview ? featureFile.aiReview : {};

    features[entry.key] = {
      latest: {
        key: entry.key,
        title: aiReview.title || entry.summary || '',
        sourceRfe: aiReview.sourceRfe || null,
        priority: entry.priority || 'Undefined',
        status: entry.status || '',
        size: aiReview.size || null,
        recommendation: aiReview.recommendation || null,
        needsAttention: aiReview.needsAttention || false,
        humanReviewStatus: aiReview.humanReviewStatus || (entry.aiReview && entry.aiReview.humanReviewStatus) || 'awaiting-review',
        scores: aiReview.scores || (entry.aiReview && entry.aiReview.scores) || null,
        reviewers: aiReview.reviewers || null,
        labels: entry.labels || [],
        components: aiReview.components || [],
        reviewedAt: aiReview.reviewedAt || (entry.aiReview && entry.aiReview.reviewedAt) || null,
        runId: aiReview.runId || undefined,
        approvedBy: aiReview.approvedBy || null,
        approvedAt: aiReview.approvedAt || null
      },
      history: aiReview.history || []
    };
  }

  return {
    lastSyncedAt: index.fetchedAt || null,
    totalFeatures: aiFeatures.length,
    features
  };
}

/**
 * Get a slim projection of all latest features for list views.
 * Strips labels, runId, runTimestamp from each entry.
 * @param {object} data - The features data object (from readFeatures)
 * @returns {object} Projected data with slim feature entries
 */
function getLatestProjection(data) {
  const projected = {};
  for (const [key, entry] of Object.entries(data.features)) {
    projected[key] = {
      key: entry.latest.key,
      title: entry.latest.title,
      sourceRfe: entry.latest.sourceRfe,
      priority: entry.latest.priority,
      status: entry.latest.status,
      size: entry.latest.size,
      recommendation: entry.latest.recommendation,
      needsAttention: entry.latest.needsAttention,
      humanReviewStatus: entry.latest.humanReviewStatus,
      scores: entry.latest.scores,
      reviewers: entry.latest.reviewers,
      reviewedAt: entry.latest.reviewedAt,
      components: entry.latest.components || [],
      approvedBy: entry.latest.approvedBy || null,
      approvedAt: entry.latest.approvedAt || null
    };
  }
  return {
    lastSyncedAt: data.lastSyncedAt,
    totalFeatures: data.totalFeatures,
    features: projected
  };
}

/**
 * Count total history entries across all features.
 * @param {object} data - The features data object (from readFeatures)
 * @returns {number}
 */
function countHistoryEntries(data) {
  let count = 0;
  for (const entry of Object.values(data.features)) {
    count += (entry.history ? entry.history.length : 0);
  }
  return count;
}

module.exports = {
  RELEASES_INDEX_KEY,
  RELEASES_FEATURE_PREFIX,
  LEGACY_STORAGE_KEY,
  readFeatures,
  getLatestProjection,
  countHistoryEntries
};
