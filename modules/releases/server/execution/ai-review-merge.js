/**
 * AI review merge logic for the unified feature store.
 *
 * Handles history management (smart eviction, position-based insertion,
 * idempotency via reviewedAt) when merging AI review data into feature files.
 *
 * Ported from modules/ai-impact/server/features/storage.js upsertFeature.
 */

const MAX_HISTORY = 20;

/**
 * Trim a full aiReview object down to a history entry.
 * @param {object} aiReview - Full aiReview object
 * @returns {object} Trimmed history entry
 */
function trimForHistory(aiReview) {
  return {
    scores: aiReview.scores,
    recommendation: aiReview.recommendation,
    needsAttention: aiReview.needsAttention,
    humanReviewStatus: aiReview.humanReviewStatus,
    reviewedAt: aiReview.reviewedAt
  };
}

/**
 * Merge incoming AI review data into an existing feature's aiReview namespace.
 * Handles history rotation, idempotency, and smart eviction.
 *
 * @param {object|null} existingAiReview - Current aiReview data on the feature (may be null)
 * @param {object} incoming - Incoming aiReview data from the bulk push
 * @returns {{ aiReview: object, status: 'created'|'updated'|'unchanged' }}
 */
function mergeAiReview(existingAiReview, incoming) {
  if (!existingAiReview || !existingAiReview.reviewedAt) {
    // No existing AI review data — create new
    return {
      aiReview: {
        ...incoming,
        history: incoming.history || []
      },
      status: 'created'
    };
  }

  // Idempotent: same reviewedAt means unchanged
  if (existingAiReview.reviewedAt === incoming.reviewedAt) {
    return { aiReview: existingAiReview, status: 'unchanged' };
  }

  const incomingDate = new Date(incoming.reviewedAt);
  const existingDate = new Date(existingAiReview.reviewedAt);

  if (incomingDate > existingDate) {
    // Incoming is newer: rotate current into history
    const history = [trimForHistory(existingAiReview), ...(existingAiReview.history || [])];
    return {
      aiReview: {
        ...incoming,
        // Preserve sign-off details if not in incoming
        approvedBy: incoming.approvedBy || existingAiReview.approvedBy,
        approvedAt: incoming.approvedAt || existingAiReview.approvedAt,
        history: history.slice(0, MAX_HISTORY)
      },
      status: 'updated'
    };
  }

  // Incoming is older: check if it already exists in history
  const existingHistory = existingAiReview.history || [];
  const existsInHistory = existingHistory.some(function(h) {
    return h.reviewedAt === incoming.reviewedAt;
  });
  if (existsInHistory) {
    return { aiReview: existingAiReview, status: 'unchanged' };
  }

  // Smart eviction: only insert if it would survive the cap
  if (existingHistory.length >= MAX_HISTORY) {
    const oldestDate = new Date(existingHistory[existingHistory.length - 1].reviewedAt);
    if (incomingDate <= oldestDate) {
      return { aiReview: existingAiReview, status: 'unchanged' };
    }
  }

  // Insert at correct position (newest-first) and cap
  const trimmed = trimForHistory(incoming);
  const newHistory = [...existingHistory];
  const insertIdx = newHistory.findIndex(function(h) {
    return new Date(h.reviewedAt) < incomingDate;
  });
  if (insertIdx === -1) {
    newHistory.push(trimmed);
  } else {
    newHistory.splice(insertIdx, 0, trimmed);
  }

  return {
    aiReview: {
      ...existingAiReview,
      history: newHistory.slice(0, MAX_HISTORY)
    },
    status: 'updated'
  };
}

module.exports = { mergeAiReview, trimForHistory, MAX_HISTORY };
