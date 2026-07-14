const STORAGE_KEY = 'ai-impact/assessments.json';
const MAX_HISTORY = 20;

/**
 * Read assessments from storage with null/malformed data guard.
 * @param {Function} readFromStorage - The storage read function
 * @returns {object} Assessments data object (never null)
 */
async function readAssessments(readFromStorage) {
  const data = await readFromStorage(STORAGE_KEY);
  if (!data || typeof data !== 'object' || !data.assessments) {
    return { lastSyncedAt: null, totalAssessed: 0, assessments: {} };
  }
  return data;
}

/**
 * Atomic write via the shared storage abstraction.
 * @param {Function} writeToStorage - The storage write function
 * @param {object} data - The assessments data object to write
 */
async function writeAssessmentsAtomic(writeToStorage, data) {
  await writeToStorage(STORAGE_KEY, data);
}

/**
 * Trim a full assessment down to history-sized payload.
 * @param {object} assessment - Full assessment object
 * @returns {object} Trimmed object with only scores, total, passFail, assessedAt
 */
function trimForHistory(assessment) {
  return {
    scores: assessment.scores,
    total: assessment.total,
    passFail: assessment.passFail,
    assessedAt: assessment.assessedAt
  };
}

/**
 * Upsert a single assessment into the data object (mutates in place).
 * @param {object} data - The full assessments data object
 * @param {string} rfeKey - The RFE key (e.g. "RHAIRFE-123")
 * @param {object} assessment - The validated assessment data
 * @returns {'created' | 'updated' | 'unchanged'}
 */
function upsertAssessment(data, rfeKey, assessment) {
  const existing = data.assessments[rfeKey];

  if (!existing) {
    // New entry
    data.assessments[rfeKey] = {
      latest: assessment,
      history: []
    };
    return 'created';
  }

  // Idempotent: same timestamp means unchanged
  if (existing.latest.assessedAt === assessment.assessedAt) {
    return 'unchanged';
  }

  const incomingDate = new Date(assessment.assessedAt);
  const latestDate = new Date(existing.latest.assessedAt);

  if (incomingDate > latestDate) {
    // Incoming is newer: rotate current latest into history
    const history = [trimForHistory(existing.latest), ...existing.history];
    // Cap at MAX_HISTORY
    existing.history = history.slice(0, MAX_HISTORY);
    existing.latest = assessment;
    return 'updated';
  }

  // Incoming is older: check if it already exists in history
  const existsInHistory = existing.history.some(h => h.assessedAt === assessment.assessedAt);
  if (existsInHistory) {
    return 'unchanged';
  }

  // Smart eviction: only insert if it would survive the cap
  if (existing.history.length >= MAX_HISTORY) {
    const oldestInHistory = existing.history[existing.history.length - 1];
    const oldestDate = new Date(oldestInHistory.assessedAt);
    if (incomingDate <= oldestDate) {
      // Incoming is older than the oldest entry; discard it
      return 'unchanged';
    }
  }

  // Insert at correct position (newest-first) and cap
  const trimmed = trimForHistory(assessment);
  const insertIdx = existing.history.findIndex(h => new Date(h.assessedAt) < incomingDate);
  if (insertIdx === -1) {
    existing.history.push(trimmed);
  } else {
    existing.history.splice(insertIdx, 0, trimmed);
  }
  existing.history = existing.history.slice(0, MAX_HISTORY);
  return 'updated';
}

/**
 * Get a slim projection of all latest assessments for list/chart views.
 * Strips criterionNotes, verdict, feedback, history from each entry.
 * @param {object} data - The full assessments data object
 * @returns {object} Projected data with slim assessment entries
 */
function getLatestProjection(data) {
  const projected = {};
  for (const [key, entry] of Object.entries(data.assessments)) {
    projected[key] = {
      scores: entry.latest.scores,
      total: entry.latest.total,
      passFail: entry.latest.passFail,
      antiPatterns: entry.latest.antiPatterns,
      assessedAt: entry.latest.assessedAt
    };
  }
  return {
    lastSyncedAt: data.lastSyncedAt,
    totalAssessed: data.totalAssessed,
    assessments: projected
  };
}

/**
 * Count total history entries across all assessments.
 * @param {object} data - The full assessments data object
 * @returns {number}
 */
function countHistoryEntries(data) {
  let count = 0;
  for (const entry of Object.values(data.assessments)) {
    count += (entry.history ? entry.history.length : 0);
  }
  return count;
}

module.exports = {
  STORAGE_KEY,
  MAX_HISTORY,
  readAssessments,
  writeAssessmentsAtomic,
  trimForHistory,
  upsertAssessment,
  getLatestProjection,
  countHistoryEntries
};
