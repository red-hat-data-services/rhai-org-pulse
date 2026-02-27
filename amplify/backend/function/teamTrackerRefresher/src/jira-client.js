/**
 * Factory for Jira API client functions.
 *
 * Accepts a jiraRequest function and jiraHost string.
 * Returns { fetchBoards, fetchSprints, fetchSprintReport }.
 */

function createJiraClient({ jiraRequest, jiraHost }) {
  /**
   * Fetch all scrum boards for the RHOAIENG project (paginated)
   */
  async function fetchBoards() {
    const boards = [];
    let startAt = 0;
    const maxResults = 50;
    let isLast = false;

    while (!isLast) {
      const data = await jiraRequest(
        `/rest/agile/1.0/board?projectKeyOrId=RHOAIENG&type=scrum&startAt=${startAt}&maxResults=${maxResults}`
      );

      boards.push(...data.values.map(board => ({
        id: board.id,
        name: board.name,
        projectKey: 'RHOAIENG'
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
   * Fetch sprint report from Jira Greenhopper API.
   * Returns raw sprint report data with committed/added/removed/completed categorization.
   */
  async function fetchSprintReport(boardId, sprintId) {
    const data = await jiraRequest(
      `/rest/greenhopper/1.0/rapid/charts/sprintreport?rapidViewId=${boardId}&sprintId=${sprintId}`
    );
    return data;
  }

  return { fetchBoards, fetchSprints, fetchSprintReport };
}

module.exports = { createJiraClient };
