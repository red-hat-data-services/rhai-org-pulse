/**
 * Jira API client for writing Activity Type field
 */

const fetch = require('node-fetch');

const ACTIVITY_TYPE_FIELD = 'customfield_10464';

function getJiraAuth() {
  const token = process.env.JIRA_TOKEN;
  const email = process.env.JIRA_EMAIL;
  if (!token || !email) {
    throw new Error('JIRA_TOKEN and JIRA_EMAIL environment variables must be set.');
  }
  return Buffer.from(`${email}:${token}`).toString('base64');
}

/**
 * Update Activity Type field on a Jira issue
 * @param {string} issueKey - Issue key (e.g., AIPCC-12345)
 * @param {string} category - Activity Type category value
 * @returns {Promise<void>}
 */
async function updateActivityType(issueKey, category) {
  if (!category) {
    throw new Error('Category is required');
  }

  const validCategories = [
    'Tech Debt & Quality',
    'New Features',
    'Learning & Enablement'
  ];

  if (!validCategories.includes(category)) {
    throw new Error(`Invalid category: ${category}. Must be one of: ${validCategories.join(', ')}`);
  }

  const auth = getJiraAuth();
  const host = process.env.JIRA_HOST || 'https://redhat.atlassian.net';

  const updateBody = {
    fields: {
      [ACTIVITY_TYPE_FIELD]: { value: category }
    }
  };

  const response = await fetch(`${host}/rest/api/3/issue/${issueKey}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateBody)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update Activity Type for ${issueKey}: ${response.status} ${text}`);
  }

  // PUT to update issue returns 204 No Content on success
}

module.exports = {
  updateActivityType,
  ACTIVITY_TYPE_FIELD
};
