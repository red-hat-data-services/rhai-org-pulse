/**
 * AI Engineering 40/40/20 allocation classification.
 *
 * Classifies Jira issues into three categories based on Activity Type
 * custom field, with special handling for vulnerability issue types.
 */

const ACTIVITY_TYPE_FIELD = 'customfield_10464';

/**
 * Classify an issue into an allocation category.
 * @param {Object} issue - Issue with base fields + activityType from getJiraFields
 * @returns {string} Category key
 */
function classifyIssue(issue) {
  if (issue.issueType === 'Vulnerability' || issue.issueType === 'Weakness') {
    return 'tech-debt-quality';
  }

  switch (issue.activityType) {
    case 'Tech Debt & Quality':
      return 'tech-debt-quality';
    case 'New Features':
      return 'new-features';
    case 'Learning & Enablement':
      return 'learning-enablement';
    default:
      return 'uncategorized';
  }
}

/**
 * Declare the additional Jira field needed for classification.
 * @returns {{ fieldIds: string[], extract: function(Object, Object): Object }}
 */
function getJiraFields() {
  return {
    fieldIds: [ACTIVITY_TYPE_FIELD],
    extract: (_issue, fields) => ({
      activityType: fields[ACTIVITY_TYPE_FIELD]?.value || null
    })
  };
}

module.exports = { classifyIssue, getJiraFields };
