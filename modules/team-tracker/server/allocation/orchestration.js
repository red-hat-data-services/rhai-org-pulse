/** Orchestration logic for allocation sprint refresh. */

const { buildSprintSummary, buildTeamSummary, buildOrgSummary } = require('./classification');

/**
 * Allowed issue types for calculation.
 */
const ALLOWED_ISSUE_TYPES = ['Bug', 'Task', 'Story', 'Spike', 'Vulnerability', 'Weakness'];

/**
 * Process a single scrum board: fetch sprints and issues, classify, write to storage.
 */
async function processBoard({ board, teamId, allocationMode, strategy, hardRefresh, fetchSprints, fetchSprintIssues, readStorage, writeStorage }) {
  const calculationMode = allocationMode || 'points';
  console.log(`[allocation] Processing board: ${board.name || board.boardId} (${board.boardId})`);

  let sprints = await fetchSprints(board.boardId);
  console.log(`  [allocation] Found ${sprints.length} sprints`);

  // Filter sprints by name if sprintFilter is set
  if (board.sprintFilter?.trim()) {
    const filterLower = board.sprintFilter.trim().toLowerCase();
    const beforeCount = sprints.length;
    sprints = sprints.filter(s => s.name.toLowerCase().includes(filterLower));
    console.log(`  [allocation] Sprint filter "${board.sprintFilter}": ${sprints.length} of ${beforeCount} sprints match`);
  }

  const activeSprints = sprints.filter(s => s.state === 'active');
  const futureSprints = sprints.filter(s => s.state === 'future');
  const closedSprints = sprints
    .filter(s => s.state === 'closed')
    .sort((a, b) => new Date(b.completeDate || 0) - new Date(a.completeDate || 0))
    .slice(0, 5);

  const sprintsToProcess = [...activeSprints, ...futureSprints, ...closedSprints];
  const sprintResults = [];

  for (const sprint of sprintsToProcess) {
    // Closed-sprint caching: skip Jira fetch if cached, strategy matches, and not hard refresh
    if (!hardRefresh && sprint.state === 'closed') {
      const cached = readStorage(`sprints/${sprint.id}.json`);
      if (cached && cached.strategyId === strategy.id) {
        console.log(`  [allocation] Using cached data for closed sprint: ${sprint.name}`);
        sprintResults.push({
          sprintId: sprint.id,
          sprintName: sprint.name,
          state: sprint.state,
          issueCount: cached.issues?.length || 0,
          totalPoints: cached.summary?.totalPoints || 0,
          summary: cached.summary
        });
        continue;
      }
    }

    console.log(`  [allocation] Fetching sprint: ${sprint.name} (${sprint.state})`);

    const rawIssues = await fetchSprintIssues(sprint.id);

    const filteredIssues = rawIssues.filter(issue =>
      ALLOWED_ISSUE_TYPES.includes(issue.issueType)
    );

    const classifiedIssues = filteredIssues.map(issue => ({
      ...issue,
      bucket: strategy.classifyIssue(issue),
      completed: issue.resolution != null
    }));

    const summary = buildSprintSummary(classifiedIssues, calculationMode, strategy.categories);

    const sprintData = {
      sprintId: sprint.id,
      sprintName: sprint.name,
      sprintState: sprint.state,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      completeDate: sprint.completeDate,
      boardId: board.boardId,
      teamId,
      strategyId: strategy.id,
      lastUpdated: new Date().toISOString(),
      issues: classifiedIssues,
      summary
    };

    writeStorage(`sprints/${sprint.id}.json`, sprintData);

    sprintResults.push({
      sprintId: sprint.id,
      sprintName: sprint.name,
      state: sprint.state,
      issueCount: classifiedIssues.length,
      totalPoints: summary.totalPoints,
      summary
    });
  }

  // Write sprint index for this board
  writeStorage(`sprints/board-${board.boardId}.json`, {
    boardId: board.boardId,
    boardName: board.name,
    teamId,
    lastUpdated: new Date().toISOString(),
    sprints: sprintsToProcess.map(s => ({
      id: s.id,
      name: s.name,
      state: s.state,
      startDate: s.startDate,
      endDate: s.endDate,
      completeDate: s.completeDate
    }))
  });

  // Pick the active sprint (or most recent closed) for dashboard summary
  const dashboardSprint = activeSprints[0] || closedSprints[0] || null;
  const dashboardSprintResult = dashboardSprint
    ? sprintResults.find(r => r.sprintId === dashboardSprint.id)
    : null;

  return {
    board,
    sprintResults,
    dashboardSprint,
    dashboardSprintResult
  };
}

/**
 * Process a kanban board: fetch board config, filter JQL, issues by date range,
 * classify, and create a synthetic sprint.
 */
async function processKanbanBoard({ board, teamId, allocationMode, strategy, fetchBoardConfiguration, fetchFilterJql, fetchIssuesByJql, writeStorage }) {
  const calculationMode = allocationMode || 'points';
  console.log(`[allocation] Processing kanban board: ${board.name || board.boardId} (${board.boardId})`);

  const { filterId } = await fetchBoardConfiguration(board.boardId);
  const baseJql = await fetchFilterJql(filterId);
  const strippedJql = baseJql.replace(/\s+ORDER\s+BY\s+.+$/i, '');
  const constrainedJql = `(${strippedJql}) AND resolved >= -2w ORDER BY resolved DESC`;

  const rawIssues = await fetchIssuesByJql(constrainedJql);

  const filteredIssues = rawIssues.filter(issue =>
    ALLOWED_ISSUE_TYPES.includes(issue.issueType)
  );

  const classifiedIssues = filteredIssues.map(issue => ({
    ...issue,
    bucket: strategy.classifyIssue(issue),
    completed: issue.resolution != null
  }));

  const summary = buildSprintSummary(classifiedIssues, calculationMode, strategy.categories);

  const syntheticSprintId = `kanban-${board.boardId}`;
  const syntheticSprint = {
    id: syntheticSprintId,
    name: 'Last 2 weeks',
    state: 'active',
    startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString()
  };

  const sprintData = {
    sprintId: syntheticSprintId,
    sprintName: syntheticSprint.name,
    sprintState: syntheticSprint.state,
    startDate: syntheticSprint.startDate,
    endDate: syntheticSprint.endDate,
    completeDate: null,
    boardId: board.boardId,
    teamId,
    strategyId: strategy.id,
    lastUpdated: new Date().toISOString(),
    issues: classifiedIssues,
    summary
  };

  writeStorage(`sprints/${syntheticSprintId}.json`, sprintData);

  writeStorage(`sprints/board-${board.boardId}.json`, {
    boardId: board.boardId,
    boardName: board.name,
    teamId,
    lastUpdated: new Date().toISOString(),
    sprints: [{
      id: syntheticSprintId,
      name: syntheticSprint.name,
      state: syntheticSprint.state,
      startDate: syntheticSprint.startDate,
      endDate: syntheticSprint.endDate,
      completeDate: null
    }]
  });

  const sprintResult = {
    sprintId: syntheticSprintId,
    sprintName: syntheticSprint.name,
    state: syntheticSprint.state,
    issueCount: classifiedIssues.length,
    totalPoints: summary.totalPoints,
    summary
  };

  return {
    board,
    sprintResults: [sprintResult],
    dashboardSprint: syntheticSprint,
    dashboardSprintResult: sprintResult
  };
}

/**
 * Refresh allocation data for a single team.
 * Iterates the team's boards that have a valid boardId.
 */
async function refreshTeam({ team, strategy, hardRefresh, fetchSprints, fetchSprintIssues, fetchBoardConfiguration, fetchFilterJql, fetchIssuesByJql, fetchBoardType, readStorage, writeStorage }) {
  const teamId = team.id;
  const allocationMode = team.metadata?.allocationMode || 'points';
  const boards = (team.boards || []).filter(b => b.boardId);

  if (boards.length === 0) {
    console.log(`[allocation] Team "${team.name}" (${teamId}) has no boards with boardId, skipping`);
    return null;
  }

  console.log(`[allocation] Refreshing team "${team.name}" (${teamId}): ${boards.length} boards`);

  const boardResults = [];

  for (const board of boards) {
    try {
      // Auto-detect board type from Jira API (falls back to scrum if detection fails)
      let boardType = 'scrum';
      if (fetchBoardType) {
        try {
          boardType = await fetchBoardType(board.boardId);
          console.log(`  [allocation] Detected board type: ${boardType} for board ${board.boardId}`);
        } catch (err) {
          console.warn(`  [allocation] Could not detect board type for ${board.boardId}, defaulting to scrum:`, err.message);
        }
      }

      let result;
      if (boardType === 'kanban') {
        result = await processKanbanBoard({
          board, teamId, allocationMode, strategy,
          fetchBoardConfiguration, fetchFilterJql, fetchIssuesByJql, writeStorage
        });
      } else {
        result = await processBoard({
          board, teamId, allocationMode, strategy, hardRefresh,
          fetchSprints, fetchSprintIssues, readStorage, writeStorage
        });
      }
      boardResults.push(result);
    } catch (error) {
      console.error(`[allocation] Board ${board.boardId} failed for team "${team.name}":`, error.message);
    }
  }

  // Build team summary from board results
  const boardSummaries = boardResults
    .filter(r => r.dashboardSprintResult?.summary)
    .map(r => r.dashboardSprintResult.summary);

  const teamSummary = buildTeamSummary(boardSummaries, strategy.categories);

  const summaryData = {
    teamId,
    teamName: team.name,
    orgKey: team.orgKey,
    allocationMode,
    strategyId: strategy.id,
    lastUpdated: new Date().toISOString(),
    ...teamSummary,
    boards: {}
  };

  // Include per-board sprint info in team summary
  for (const { board, dashboardSprint, dashboardSprintResult } of boardResults) {
    if (dashboardSprint && dashboardSprintResult) {
      summaryData.boards[board.boardId] = {
        boardName: board.name,
        sprint: {
          id: dashboardSprint.id,
          name: dashboardSprint.name,
          state: dashboardSprint.state,
          startDate: dashboardSprint.startDate,
          endDate: dashboardSprint.endDate
        },
        summary: dashboardSprintResult.summary
      };
    }
  }

  writeStorage(`summaries/team-${teamId}.json`, summaryData);

  return summaryData;
}

/**
 * Full refresh: read teams from team-store, process each, then build org and global summaries.
 */
async function performRefresh({ teams, strategy, hardRefresh, fetchSprints, fetchSprintIssues, fetchBoardConfiguration, fetchFilterJql, fetchIssuesByJql, fetchBoardType, readStorage, writeStorage }) {
  console.log(`[allocation] Starting refresh for ${teams.length} teams (hardRefresh: ${hardRefresh})`);
  const refreshStart = Date.now();

  const teamResults = [];

  for (const team of teams) {
    try {
      const result = await refreshTeam({
        team, strategy, hardRefresh,
        fetchSprints, fetchSprintIssues,
        fetchBoardConfiguration, fetchFilterJql, fetchIssuesByJql,
        fetchBoardType, readStorage, writeStorage
      });
      if (result) {
        teamResults.push(result);
      }
    } catch (error) {
      console.error(`[allocation] Team "${team.name}" (${team.id}) failed:`, error.message);
    }
  }

  // Build org-level summaries
  const orgGroups = new Map();
  for (const result of teamResults) {
    const orgKey = result.orgKey || 'unknown';
    if (!orgGroups.has(orgKey)) orgGroups.set(orgKey, []);
    orgGroups.get(orgKey).push(result);
  }

  const orgSummaries = [];
  for (const [orgKey, orgTeams] of orgGroups) {
    const orgSummary = buildOrgSummary(orgTeams, strategy.categories);
    const orgData = {
      orgKey,
      strategyId: strategy.id,
      lastUpdated: new Date().toISOString(),
      ...orgSummary,
      teams: orgTeams.map(t => ({
        teamId: t.teamId,
        teamName: t.teamName,
        totalPoints: t.totalPoints,
        totalCount: t.totalCount,
        boardCount: t.boardCount,
        percentages: t.percentages
      }))
    };
    writeStorage(`summaries/org-${orgKey}.json`, orgData);
    orgSummaries.push(orgData);
  }

  // Build global summary
  const globalSummary = buildOrgSummary(teamResults, strategy.categories);
  writeStorage('summaries/global.json', {
    strategyId: strategy.id,
    lastUpdated: new Date().toISOString(),
    ...globalSummary,
    teams: teamResults.map(t => ({
      teamId: t.teamId,
      teamName: t.teamName,
      orgKey: t.orgKey,
      totalPoints: t.totalPoints,
      totalCount: t.totalCount,
      boardCount: t.boardCount,
      percentages: t.percentages
    })),
    orgs: orgSummaries.map(o => ({
      orgKey: o.orgKey,
      totalPoints: o.totalPoints,
      totalCount: o.totalCount,
      teamCount: o.teamCount,
      boardCount: o.boardCount,
      percentages: o.percentages
    }))
  });

  const refreshElapsed = ((Date.now() - refreshStart) / 1000).toFixed(1);
  console.log(`[allocation] Refresh complete: ${teamResults.length}/${teams.length} teams succeeded (${refreshElapsed}s)`);

  return {
    success: true,
    teamCount: teamResults.length,
    failedTeamCount: teams.length - teamResults.length,
    orgCount: orgGroups.size
  };
}

module.exports = { processBoard, processKanbanBoard, refreshTeam, performRefresh };
