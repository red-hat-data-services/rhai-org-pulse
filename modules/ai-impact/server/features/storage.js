const fs = require('fs');
const path = require('path');

const STORAGE_KEY = 'ai-impact/features.json';
const MAX_HISTORY = 20;

// Resolve DATA_DIR the same way shared/server/storage.js does
const DATA_DIR = path.join(__dirname, '..', '..', '..', '..', 'data');

/**
 * Read features from storage with null/malformed data guard.
 * @param {Function} readFromStorage - The storage read function
 * @returns {object} Features data object (never null)
 */
function readFeatures(readFromStorage) {
  const data = readFromStorage(STORAGE_KEY);
  if (!data || typeof data !== 'object' || !data.features) {
    return { lastSyncedAt: null, totalFeatures: 0, features: {} };
  }
  return data;
}

/**
 * Atomic write: write to temp file then rename.
 * @param {object} data - The features data object to write
 */
function writeFeaturesAtomic(data) {
  const filePath = path.resolve(DATA_DIR, STORAGE_KEY);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmpPath = filePath + '.tmp.' + process.pid;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Trim a full feature down to history-sized payload.
 * @param {object} feature - Full feature object
 * @returns {object} Trimmed object
 */
function trimForHistory(feature) {
  return {
    scores: feature.scores,
    recommendation: feature.recommendation,
    needsAttention: feature.needsAttention,
    humanReviewStatus: feature.humanReviewStatus,
    reviewedAt: feature.reviewedAt
  };
}

/**
 * Upsert a single feature into the data object (mutates in place).
 * @param {object} data - The full features data object
 * @param {string} key - The feature key (e.g. "RHAISTRAT-123")
 * @param {object} feature - The validated feature data
 * @returns {'created' | 'updated' | 'unchanged'}
 */
function upsertFeature(data, key, feature) {
  const existing = data.features[key];

  if (!existing) {
    data.features[key] = {
      latest: feature,
      history: []
    };
    return 'created';
  }

  // Idempotent: same timestamp means unchanged
  if (existing.latest.reviewedAt === feature.reviewedAt) {
    return 'unchanged';
  }

  const incomingDate = new Date(feature.reviewedAt);
  const latestDate = new Date(existing.latest.reviewedAt);

  if (incomingDate > latestDate) {
    // Incoming is newer: rotate current latest into history
    const history = [trimForHistory(existing.latest), ...existing.history];
    existing.history = history.slice(0, MAX_HISTORY);
    existing.latest = feature;
    return 'updated';
  }

  // Incoming is older: check if it already exists in history
  const existsInHistory = existing.history.some(h => h.reviewedAt === feature.reviewedAt);
  if (existsInHistory) {
    return 'unchanged';
  }

  // Smart eviction: only insert if it would survive the cap
  if (existing.history.length >= MAX_HISTORY) {
    const oldestInHistory = existing.history[existing.history.length - 1];
    const oldestDate = new Date(oldestInHistory.reviewedAt);
    if (incomingDate <= oldestDate) {
      return 'unchanged';
    }
  }

  // Insert at correct position (newest-first) and cap
  const trimmed = trimForHistory(feature);
  const insertIdx = existing.history.findIndex(h => new Date(h.reviewedAt) < incomingDate);
  if (insertIdx === -1) {
    existing.history.push(trimmed);
  } else {
    existing.history.splice(insertIdx, 0, trimmed);
  }
  existing.history = existing.history.slice(0, MAX_HISTORY);
  return 'updated';
}

/**
 * Get a slim projection of all latest features for list views.
 * Strips labels, runId, runTimestamp from each entry.
 * @param {object} data - The full features data object
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
      reviewedAt: entry.latest.reviewedAt
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
 * @param {object} data - The full features data object
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
  STORAGE_KEY,
  MAX_HISTORY,
  readFeatures,
  writeFeaturesAtomic,
  trimForHistory,
  upsertFeature,
  getLatestProjection,
  countHistoryEntries
};
