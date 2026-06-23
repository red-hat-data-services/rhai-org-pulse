/**
 * Factory for Jira API client functions.
 *
 * Wraps the shared team-tracker jiraRequest to provide the allocation
 * data-fetching interface. Supports strategy-declared extra fields
 * via the extraFields parameter.
 *
 * Returns { fetchBoards, fetchSprints, fetchSprintIssues, fetchBoardConfiguration, fetchFilterJql, fetchIssuesByJql }.
 */

const BASE_FIELD_IDS = {
  storyPoints: 'customfield_10028',
};

const BASE_ISSUE_FIELDS = [
  'summary', 'issuetype', 'status', 'assignee',
  BASE_FIELD_IDS.storyPoints,
  'resolution', 'resolutiondate'
];

/**
 * @param {Object} options
 * @param {function} options.jiraRequest - Shared Jira request function
 * @param {string} options.jiraHost - Jira host URL
 * @param {Object} [options.extraFields] - Strategy-declared extra fields
 * @param {string[]} [options.extraFields.fieldIds] - Additional Jira field IDs to fetch
 * @param {function} [options.extraFields.extract] - Extract strategy values from raw fields
 */
function createJiraClient({ jiraRequest, jiraHost, extraFields }) {
  const allFieldIds = [...BASE_ISSUE_FIELDS]
  if (extraFields?.fieldIds) {
    for (const id of extraFields.fieldIds) {
      if (!allFieldIds.includes(id)) allFieldIds.push(id)
    }
  }

  const fieldsParam = allFieldIds.join(',')

  function mapIssue(issue) {
    const storyPoints = issue.fields[BASE_FIELD_IDS.storyPoints] ?? null;

    const mapped = {
      key: issue.key,
      summary: issue.fields.summary,
      issueType: issue.fields.issuetype?.name || null,
      status: issue.fields.status?.name || null,
      assignee: issue.fields.assignee?.displayName || null,
      storyPoints: storyPoints,
      resolution: issue.fields.resolution?.name || null,
      resolutionDate: issue.fields.resolutiondate || null,
      url: `${jiraHost}/browse/${issue.key}`
    };

    if (extraFields?.extract) {
      Object.assign(mapped, extraFields.extract(mapped, issue.fields));
    }

    return mapped;
  }

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
        `/rest/agile/1.0/sprint/${sprintId}/issue?startAt=${startAt}&maxResults=${maxResults}&fields=${fieldsParam}`
      );

      total = data.total;
      issues.push(...data.issues.map(mapIssue));
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
   */
  async function fetchIssuesByJql(jql) {
    const issues = [];
    const maxResults = 100;
    let nextPageToken = undefined;
    let isLast = false;

    while (!isLast) {
      const requestBody = { jql, fields: allFieldIds, maxResults };
      if (nextPageToken) requestBody.nextPageToken = nextPageToken;

      const data = await jiraRequest('/rest/api/3/search/jql', {
        method: 'POST',
        body: requestBody
      });

      issues.push(...data.issues.map(mapIssue));

      isLast = data.isLast === true || !data.nextPageToken;
      nextPageToken = data.nextPageToken;
    }

    return issues;
  }

  /**
   * Fetch the board type (scrum or kanban) for a given board ID.
   */
  async function fetchBoardType(boardId) {
    const data = await jiraRequest(`/rest/agile/1.0/board/${boardId}`);
    return data.type || 'scrum';
  }

  return { fetchBoards, fetchSprints, fetchSprintIssues, fetchBoardConfiguration, fetchFilterJql, fetchIssuesByJql, fetchBoardType };
}

module.exports = { createJiraClient };
