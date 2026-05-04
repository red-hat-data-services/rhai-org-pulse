/**
 * Classification engine for Activity Type auto-population
 *
 * Implements hybrid rule-based + keyword matching for 40/40/20 allocation buckets:
 * - Tech Debt & Quality (40%)
 * - New Features (40%)
 * - Learning & Enablement (20%)
 */

const CATEGORIES = {
  TECH_DEBT: 'Tech Debt & Quality',
  NEW_FEATURES: 'New Features',
  LEARNING: 'Learning & Enablement'
};

const TECH_DEBT_KEYWORDS = /\b(fix(es|ed|ing)?|bug|flaky|test(s|ing)?|refactor(ing)?|security|upgrade|CVE|regression|vulnerability|weakness|package build|ci\/cd|quality|QE)\b/i;
const LEARNING_KEYWORDS = /\b(spike|training|research|POC|proof[- ]of[- ]concept|prototype|prototyping|investigation|investigating|hackathon|documentation|onboarding|enablement)\b/i;
const FEATURE_KEYWORDS = /\b(RFE|enhancement|feature|capability)\b|\bnew (feature|capability|functionality)\b/i;

/**
 * Classify a Jira issue based on type and content
 * @param {Object} issue - Jira issue object
 * @param {string} issue.issueType - Issue type (Bug, Story, Spike, Task, Epic)
 * @param {string} issue.summary - Issue summary text
 * @param {string} [issue.description] - Issue description text
 * @param {string} [issue.activityType] - Existing Activity Type (if set)
 * @returns {Object} Classification result with category, confidence, method
 */
function classifyIssue(issue) {
  // Skip if already classified
  if (issue.activityType) {
    return {
      category: null,
      confidence: 0,
      method: 'already-classified',
      reason: 'Activity Type already set'
    };
  }

  // Rule 1: Issue type determines category (highest confidence)
  if (issue.issueType === 'Bug' || issue.issueType === 'Vulnerability' || issue.issueType === 'Weakness') {
    return {
      category: CATEGORIES.TECH_DEBT,
      confidence: 0.95,
      method: 'issue-type',
      reason: `Issue type: ${issue.issueType}`
    };
  }

  if (issue.issueType === 'Spike') {
    return {
      category: CATEGORIES.LEARNING,
      confidence: 0.90,
      method: 'issue-type',
      reason: 'Issue type: Spike'
    };
  }

  // Rule 2: Keyword matching in summary + description
  const text = `${issue.summary} ${issue.description || ''}`.toLowerCase();

  const techDebtMatch = TECH_DEBT_KEYWORDS.test(text);
  const learningMatch = LEARNING_KEYWORDS.test(text);
  const featureMatch = FEATURE_KEYWORDS.test(text);

  // Single category match → high confidence
  const matchCount = [techDebtMatch, learningMatch, featureMatch].filter(Boolean).length;

  if (matchCount === 1) {
    if (techDebtMatch) {
      return {
        category: CATEGORIES.TECH_DEBT,
        confidence: 0.85,
        method: 'keyword',
        reason: 'Tech debt keywords detected'
      };
    }
    if (learningMatch) {
      return {
        category: CATEGORIES.LEARNING,
        confidence: 0.85,
        method: 'keyword',
        reason: 'Learning keywords detected'
      };
    }
    if (featureMatch) {
      return {
        category: CATEGORIES.NEW_FEATURES,
        confidence: 0.85,
        method: 'keyword',
        reason: 'Feature keywords detected'
      };
    }
  }

  // Multiple category matches or no matches → low confidence
  if (matchCount > 1) {
    return {
      category: null,
      confidence: 0.4,
      method: 'ambiguous',
      reason: 'Multiple category keywords detected'
    };
  }

  // Rule 3: Default heuristics for common patterns
  if (issue.issueType === 'Story' || issue.issueType === 'Epic') {
    // Stories/epics without clear keywords → likely new features (but low confidence)
    return {
      category: CATEGORIES.NEW_FEATURES,
      confidence: 0.60,
      method: 'default-heuristic',
      reason: 'Story/Epic without clear keyword match'
    };
  }

  if (issue.issueType === 'Task') {
    // Tasks without clear keywords → likely tech debt (maintenance work)
    return {
      category: CATEGORIES.TECH_DEBT,
      confidence: 0.60,
      method: 'default-heuristic',
      reason: 'Task without clear keyword match'
    };
  }

  // No clear classification possible
  return {
    category: null,
    confidence: 0.0,
    method: 'unclear',
    reason: 'No classification rules matched'
  };
}

/**
 * Check if classification meets confidence threshold for auto-write
 * @param {Object} classification - Classification result
 * @param {number} [threshold=0.85] - Minimum confidence threshold
 * @returns {boolean}
 */
function meetsThreshold(classification, threshold = 0.85) {
  return classification.category !== null && classification.confidence >= threshold;
}

module.exports = {
  classifyIssue,
  meetsThreshold,
  CATEGORIES
};
