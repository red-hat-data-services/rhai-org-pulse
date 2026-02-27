const fetch = require('node-fetch');
const { readFromS3, writeToS3 } = require('./s3-storage');
const { createJiraClient } = require('./jira-client');
const { discoverBoards, performRefresh: orchestrate } = require('./orchestration');

const JIRA_HOST = process.env.JIRA_HOST || 'https://issues.redhat.com';

/**
 * Run a full refresh: discover boards, fetch sprint data, write to S3.
 */
async function performRefresh({ hardRefresh, jiraToken }) {
  console.log(`Starting refresh (hardRefresh: ${hardRefresh})`);

  // Build jiraRequest function with the SSM token
  async function jiraRequest(path) {
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const response = await fetch(`${JIRA_HOST}${path}`, {
        headers: {
          'Authorization': `Bearer ${jiraToken}`,
          'Accept': 'application/json'
        }
      });

      if (response.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = parseInt(response.headers.get('retry-after'), 10);
        const delay = (!isNaN(retryAfter) && retryAfter > 0) ? retryAfter * 1000 : Math.pow(2, attempt + 1) * 1000;
        console.warn(`[Jira API] Rate limited (429), retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Jira API error (${response.status}): ${text}`);
      }

      return response.json();
    }
  }

  // Create Jira client with injected dependencies
  const jiraClient = createJiraClient({ jiraRequest, jiraHost: JIRA_HOST });

  const deps = {
    ...jiraClient,
    readStorage: readFromS3,
    writeStorage: writeToS3,
    jiraHost: JIRA_HOST,
    hardRefresh,
    onProgress: async (event) => {
      // Write progress to S3 for polling
      try {
        await writeToS3('refresh-status.json', {
          ...event,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Failed to write refresh status:', err.message);
      }
    }
  };

  // Run the orchestration
  const result = await orchestrate(deps);

  // Write final status
  await writeToS3('refresh-status.json', {
    type: 'complete',
    boardCount: result.boardCount,
    sprintCount: result.sprintCount,
    timestamp: new Date().toISOString()
  });

  console.log(`Refresh complete: ${result.boardCount} boards, ${result.sprintCount} sprints`);
  return result;
}

module.exports = { performRefresh };
