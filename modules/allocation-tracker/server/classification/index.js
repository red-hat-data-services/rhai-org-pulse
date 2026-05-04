/**
 * Classification service - orchestrates classification and Jira writes
 */

const { classifyIssue, meetsThreshold } = require('./classifier');
const { updateActivityType } = require('./jira-writer');

/**
 * Configuration for classification service
 */
const CONFIG = {
  enabled: true,
  projects: ['AIPCC', 'RHOAIENG', 'INFERENG', 'RHAIENG'],
  confidenceThreshold: 0.85,
  issueTypes: ['Story', 'Bug', 'Spike', 'Task', 'Epic', 'Vulnerability', 'Weakness']
};

/**
 * Classify and optionally write to Jira
 * @param {Object} issue - Jira issue object
 * @param {Object} options - Options
 * @param {boolean} options.dryRun - If true, don't write to Jira
 * @param {number} options.confidenceThreshold - Minimum confidence (default: 0.85)
 * @returns {Promise<Object>} Classification result
 */
async function classifyAndWrite(issue, options = {}) {
  const dryRun = options.dryRun || false;
  const threshold = options.confidenceThreshold || CONFIG.confidenceThreshold;

  // Classify the issue
  const classification = classifyIssue(issue);

  // Skip if already classified
  if (classification.method === 'already-classified') {
    return {
      issueKey: issue.key,
      skipped: true,
      reason: 'already-classified',
      classification
    };
  }

  // Skip if below confidence threshold
  if (!meetsThreshold(classification, threshold)) {
    return {
      issueKey: issue.key,
      skipped: true,
      reason: 'low-confidence',
      classification
    };
  }

  // Write to Jira (unless dry run)
  if (!dryRun) {
    try {
      await updateActivityType(issue.key, classification.category);
      return {
        issueKey: issue.key,
        classified: true,
        written: true,
        classification
      };
    } catch (error) {
      console.error(`[classification] Failed to write Activity Type for ${issue.key}:`, error.message);
      return {
        issueKey: issue.key,
        classified: true,
        written: false,
        error: 'Failed to write to Jira',
        classification
      };
    }
  }

  return {
    issueKey: issue.key,
    classified: true,
    written: false,
    dryRun: true,
    classification
  };
}

/**
 * Check if an issue should be classified based on project and issue type
 * @param {Object} issue - Jira issue object
 * @returns {boolean}
 */
function shouldClassify(issue) {
  if (!CONFIG.enabled) {
    return false;
  }

  // Check if issue is in configured projects
  if (issue.project && !CONFIG.projects.includes(issue.project)) {
    return false;
  }

  // Check if issue type is supported
  if (issue.issueType && !CONFIG.issueTypes.includes(issue.issueType)) {
    return false;
  }

  return true;
}

module.exports = {
  classifyAndWrite,
  shouldClassify,
  CONFIG
};
