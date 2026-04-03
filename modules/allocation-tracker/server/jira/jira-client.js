/**
 * Factory for Jira API client functions.
 *
 * Wraps the shared team-tracker jiraRequest to provide the same interface
 * as the standalone 40-40-20-tracker's jira-client.js.
 *
 * Returns { fetchBoards, fetchSprints, fetchSprintIssues, fetchBoardConfiguration, fetchFilterJql, fetchIssuesByJql }.
 */

const FIELD_IDS = {
  storyPoints: 'customfield_10028',
  activityType: 'customfield_10464',
};

const ISSUE_FIELDS = [
  'summary', 'issuetype', 'status', 'assignee',
  FIELD_IDS.storyPoints, FIELD_IDS.activityType,
  'resolution', 'resolutiondate'
];

function createJiraClient({ jiraRequest, jiraHost }) {
  /**
   * Fetch all scrum boards for a project (paginated)
   */
  async function fetchBoards(projectKey, boardType = 'scrum') {
    const boards = [];
    let startAt = 0;
    const maxResults = 50;
    let isLast = false;

    while (!isLast) {
      const data = await jiraRequest(
        `/rest/agile/1.0/board?projectKeyOrId=${projectKey}&type=${boardType}&startAt=${startAt}&maxResults=${maxResults}`
      );

      boards.push(...data.values.map(board => ({
        id: board.id,
        name: board.name,
        projectKey: projectKey,
        type: boardType
      })));

      isLast = data.isLast;
      startAt += maxResults;
    }

    return boards;
  }

  /**
   * Fetch all sprints for a board (paginated)
   */
  async function fetchSprints(boardId) {
    const sprints = [];
    let startAt = 0;
    const maxResults = 50;
    let isLast = false;

    while (!isLast) {
      const data = await jiraRequest(
        `/rest/agile/1.0/board/${boardId}/sprint?startAt=${startAt}&maxResults=${maxResults}`
      );

      sprints.push(...data.values.map(sprint => ({
        id: sprint.id,
        name: sprint.name,
        state: sprint.state,
        startDate: sprint.startDate || null,
        endDate: sprint.endDate || null,
        completeDate: sprint.completeDate || null,
        boardId: boardId
      })));

      isLast = data.isLast;
      startAt += maxResults;
    }

    return sprints;
  }

  /**
   * Fetch all issues for a sprint (paginated)
   */
  async function fetchSprintIssues(sprintId) {
    const issues = [];
    let startAt = 0;
    const maxResults = 100;
    let total = Infinity;

    while (startAt < total) {
      const data = await jiraRequest(
        `/rest/agile/1.0/sprint/${sprintId}/issue?startAt=${startAt}&maxResults=${maxResults}&fields=summary,issuetype,status,assignee,${FIELD_IDS.storyPoints},${FIELD_IDS.activityType},resolution,resolutiondate`
      );

      total = data.total;

      issues.push(...data.issues.map(issue => {
        const storyPoints = issue.fields[FIELD_IDS.storyPoints] ?? null;

        return {
          key: issue.key,
          summary: issue.fields.summary,
          issueType: issue.fields.issuetype?.name || null,
          status: issue.fields.status?.name || null,
          assignee: issue.fields.assignee?.displayName || null,
          storyPoints: storyPoints,
          activityType: issue.fields[FIELD_IDS.activityType]?.value || null,
          resolution: issue.fields.resolution?.name || null,
          resolutionDate: issue.fields.resolutiondate || null,
          url: `${jiraHost}/browse/${issue.key}`
        };
      }));

      startAt += maxResults;
    }

    return issues;
  }

  /**
   * Fetch board configuration to get the filter ID
   */
  async function fetchBoardConfiguration(boardId) {
    const data = await jiraRequest(`/rest/agile/1.0/board/${boardId}/configuration`);
    if (!data.filter?.id) {
      throw new Error(`Board ${boardId} has no filter configured`);
    }
    return { filterId: data.filter.id };
  }

  /**
   * Fetch the JQL string from a saved filter
   */
  async function fetchFilterJql(filterId) {
    const data = await jiraRequest(`/rest/api/3/filter/${filterId}`);
    return data.jql;
  }

  /**
   * Fetch issues by JQL query (cursor-based pagination via POST)
   * NOTE: shared jiraRequest auto-stringifies body — pass body as plain object
   */
  async function fetchIssuesByJql(jql) {
    const issues = [];
    const maxResults = 100;
    let nextPageToken = undefined;
    let isLast = false;

    while (!isLast) {
      const requestBody = { jql, fields: ISSUE_FIELDS, maxResults };
      if (nextPageToken) requestBody.nextPageToken = nextPageToken;

      const data = await jiraRequest('/rest/api/3/search/jql', {
        method: 'POST',
        body: requestBody
      });

      issues.push(...data.issues.map(issue => {
        const storyPoints = issue.fields[FIELD_IDS.storyPoints] ?? null;
        return {
          key: issue.key,
          summary: issue.fields.summary,
          issueType: issue.fields.issuetype?.name || null,
          status: issue.fields.status?.name || null,
          assignee: issue.fields.assignee?.displayName || null,
          storyPoints: storyPoints,
          activityType: issue.fields[FIELD_IDS.activityType]?.value || null,
          resolution: issue.fields.resolution?.name || null,
          resolutionDate: issue.fields.resolutiondate || null,
          url: `${jiraHost}/browse/${issue.key}`
        };
      }));

      // Stop when isLast is explicitly true OR there's no next page token
      isLast = data.isLast === true || !data.nextPageToken;
      nextPageToken = data.nextPageToken;
    }

    return issues;
  }

  return { fetchBoards, fetchSprints, fetchSprintIssues, fetchBoardConfiguration, fetchFilterJql, fetchIssuesByJql };
}

module.exports = { createJiraClient };
