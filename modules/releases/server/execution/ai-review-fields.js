/**
 * AI review field helpers for the unified feature store.
 *
 * Sign-off extraction from Jira changelog and humanReviewStatus
 * derivation from strat-creator pipeline labels.
 */

const SIGN_OFF_LABEL = 'strat-creator-human-sign-off';
const NEEDS_ATTENTION_LABEL = 'strat-creator-needs-attention';

/**
 * Derive humanReviewStatus from strat-creator pipeline labels.
 * @param {string[]} labels
 * @returns {'approved' | 'needs-review' | 'awaiting-review'}
 */
function deriveHumanReviewStatus(labels) {
  if (!labels || !Array.isArray(labels)) return 'awaiting-review';
  if (labels.includes(SIGN_OFF_LABEL)) return 'approved';
  if (labels.includes(NEEDS_ATTENTION_LABEL)) return 'needs-review';
  return 'awaiting-review';
}

/**
 * Extract who added the human sign-off label and when, from the Jira changelog.
 *
 * @param {object} changelog - Jira issue changelog (from expand=changelog)
 * @returns {{ approvedBy: string, approvedAt: string } | null}
 */
function extractSignOffInfo(changelog) {
  if (!changelog || !changelog.histories) return null;
  let latest = null;
  for (const history of changelog.histories) {
    for (const item of history.items) {
      if (item.field !== 'labels') continue;
      const before = (item.fromString || '').split(/\s+/).filter(Boolean);
      const after = (item.toString || '').split(/\s+/).filter(Boolean);
      if (after.includes(SIGN_OFF_LABEL) && !before.includes(SIGN_OFF_LABEL)) {
        const date = new Date(history.created);
        if (!latest || date > new Date(latest.approvedAt)) {
          latest = {
            approvedBy: history.author && history.author.displayName || null,
            approvedAt: history.created
          };
        }
      }
    }
  }
  return latest;
}

module.exports = {
  deriveHumanReviewStatus,
  extractSignOffInfo,
  SIGN_OFF_LABEL,
  NEEDS_ATTENTION_LABEL
};
