/**
 * Orchestration logic for board discovery and sprint refresh.
 *
 * All I/O is injected via dependencies — this module never touches
 * the filesystem or the network directly.
 *
 * Ported from 40-40-20-tracker with these changes:
 * - Removed `await` on storage calls (team-tracker uses sync fs.readFileSync/writeFileSync)
 * - Removed redundant `fetchBoards` call from `performRefresh` (reads from teams.json directly)
 * - Dashboard summary built AFTER all boards complete (no race condition)
 * - Dead code removed (getHistoryKey, prefixKey)
 */

const { classifyIssue, buildSprintSummary, buildProjectSummary, buildOrgSummary, determineStaleness } = require('./classification');
const { getStoragePrefix, createPrefixedStorage } = require('./config');

/**
 * Allowed issue types for calculation.
 */
const ALLOWED_ISSUE_TYPES = ['Bug', 'Task', 'Story', 'Spike', 'Vulnerability', 'Weakness'];

/**
 * Generate a unique team identifier from a board ID and optional sprint filter.
 */
function generateTeamId(boardId, sprintFilter) {
  if (!sprintFilter?.trim()) return String(boardId);
  const normalized = sprintFilter.trim().toLowerCase().replace(/\s+/g, '-');
  return `${boardId}_${normalized}`;
}

/**
 * Discover boards from Jira, determine staleness, and merge with existing team config.
 */
async function discoverBoards({ projectKey, fetchBoards, fetchSprints, readStorage, writeStorage }) {
  console.log(`Discovering boards for project ${projectKey}`);

  // Fetch both scrum and kanban boards
  const scrumBoards = await fetchBoards(projectKey);
  let kanbanBoards = [];
  try {
    kanbanBoards = await fetchBoards(projectKey, 'kanban');
  } catch (error) {
    console.warn('Failed to fetch kanban boards:', error.message);
  }

  const boards = [
    ...scrumBoards.map(b => ({ ...b, boardType: 'scrum' })),
    ...kanbanBoards.map(b => ({ ...b, boardType: 'kanban' }))
  ];
  console.log(`Found ${scrumBoards.length} scrum boards and ${kanbanBoards.length} kanban boards`);

  writeStorage('boards.json', {
    lastUpdated: new Date().toISOString(),
    boards: boards
  });

  // Fetch sprints for each scrum board to determine staleness
  const DISCOVER_CONCURRENCY = 3;
  const boardStaleness = new Map();

  const scrumBoardsOnly = boards.filter(b => b.boardType !== 'kanban');
  for (let i = 0; i < scrumBoardsOnly.length; i += DISCOVER_CONCURRENCY) {
    const chunk = scrumBoardsOnly.slice(i, i + DISCOVER_CONCURRENCY);
    const results = await Promise.all(chunk.map(async (board) => {
      try {
        const sprints = await fetchSprints(board.id);
        return { boardId: board.id, ...determineStaleness(sprints) };
      } catch (error) {
        console.warn(`Failed to fetch sprints for board ${board.id}, marking as not stale:`, error.message);
        return { boardId: board.id, stale: false, lastSprintEndDate: null };
      }
    }));
    results.forEach(r => boardStaleness.set(r.boardId, r));
  }

  // Mark kanban boards as not stale
  for (const board of boards.filter(b => b.boardType === 'kanban')) {
    boardStaleness.set(board.id, { boardId: board.id, stale: false, lastSprintEndDate: null });
  }

  const staleCount = [...boardStaleness.values()].filter(s => s.stale).length;
  console.log(`Staleness check: ${staleCount} of ${boards.length} boards are stale`);

  // Merge with existing teams config
  const existingTeams = readStorage('teams.json');
  const existingByBoard = new Map();
  if (existingTeams?.teams) {
    for (const t of existingTeams.teams) {
      const list = existingByBoard.get(t.boardId) || [];
      list.push(t);
      existingByBoard.set(t.boardId, list);
    }
  }

  const mergedTeams = [];
  for (const b of boards) {
    const staleness = boardStaleness.get(b.id) || { stale: false, lastSprintEndDate: null };
    const existingEntries = existingByBoard.get(b.id);

    if (existingEntries && existingEntries.length > 0) {
      for (const existing of existingEntries) {
        const updated = {
          ...existing,
          boardName: b.name,
          boardType: b.boardType || existing.boardType || 'scrum',
          stale: staleness.stale,
          lastSprintEndDate: staleness.lastSprintEndDate
        };
        if (staleness.stale && !existing.manuallyConfigured) {
          updated.enabled = false;
        }
        mergedTeams.push(updated);
      }
    } else {
      const isKanban = (b.boardType || 'scrum') === 'kanban';
      mergedTeams.push({
        boardId: b.id,
        boardName: b.name,
        displayName: b.name.replace(/^RHOAIENG\s*[-–]\s*/, ''),
        enabled: isKanban ? false : !staleness.stale,
        stale: staleness.stale,
        lastSprintEndDate: staleness.lastSprintEndDate,
        boardType: b.boardType || 'scrum',
        manuallyConfigured: false
      });
    }
  }

  writeStorage('teams.json', { teams: mergedTeams });

  return { success: true, boardCount: boards.length, staleCount };
}

/**
 * Process a single board: fetch sprints and issues, classify, write to storage.
 */
async function processBoard({ board, hardRefresh, fetchSprints, fetchSprintIssues, readStorage, writeStorage }) {
  const calculationMode = board.calculationMode || 'points';
  console.log(`Processing board: ${board.name} (${board.id})`);

  let sprints = await fetchSprints(board.id);
  console.log(`  [${board.name}] Found ${sprints.length} sprints`);

  // Filter sprints by name if sprintFilter is set
  if (board.sprintFilter?.trim()) {
    const filterLower = board.sprintFilter.trim().toLowerCase();
    const beforeCount = sprints.length;
    sprints = sprints.filter(s => s.name.toLowerCase().includes(filterLower));
    console.log(`  [${board.name}] Sprint filter "${board.sprintFilter}": ${sprints.length} of ${beforeCount} sprints match`);
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
    // Closed-sprint caching: skip Jira fetch if cached and not hard refresh
    if (!hardRefresh && sprint.state === 'closed') {
      const cached = readStorage(`sprints/${sprint.id}.json`);
      if (cached) {
        console.log(`  [${board.name}] Using cached data for closed sprint: ${sprint.name}`);
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

    console.log(`  [${board.name}] Fetching sprint: ${sprint.name} (${sprint.state})`);

    const rawIssues = await fetchSprintIssues(sprint.id);

    const filteredIssues = rawIssues.filter(issue =>
      ALLOWED_ISSUE_TYPES.includes(issue.issueType)
    );

    const classifiedIssues = filteredIssues.map(issue => ({
      ...issue,
      bucket: classifyIssue(issue),
      completed: issue.resolution != null
    }));

    const summary = buildSprintSummary(classifiedIssues, calculationMode);

    const filteredCount = rawIssues.length - filteredIssues.length;
    const filterMsg = filteredCount > 0 ? ` (${filteredCount} filtered)` : '';
    console.log(`    ${classifiedIssues.length} issues${filterMsg}, ${summary.totalPoints} pts | tech-debt: ${summary.buckets['tech-debt-quality'].points} pts, features: ${summary.buckets['new-features'].points} pts, learning: ${summary.buckets['learning-enablement'].points} pts, uncategorized: ${summary.buckets['uncategorized'].points} pts | ${summary.unestimatedIssueCount} unestimated`);

    const sprintData = {
      sprintId: sprint.id,
      sprintName: sprint.name,
      sprintState: sprint.state,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      completeDate: sprint.completeDate,
      boardId: board.id,
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

  // Upload sprints index for this team
  const teamKey = board.teamId || String(board.id);
  writeStorage(`sprints/team-${teamKey}.json`, {
    boardId: board.id,
    boardName: board.name,
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
async function processKanbanBoard({ board, fetchBoardConfiguration, fetchFilterJql, fetchIssuesByJql, _readStorage, writeStorage }) {
  const calculationMode = board.calculationMode || 'points';
  const teamKey = board.teamId || `kanban-${board.id}`;
  console.log(`Processing kanban board: ${board.name} (${board.id})`);

  const { filterId } = await fetchBoardConfiguration(board.id);
  const baseJql = await fetchFilterJql(filterId);
  const strippedJql = baseJql.replace(/\s+ORDER\s+BY\s+.+$/i, '');
  const constrainedJql = `(${strippedJql}) AND resolved >= -2w ORDER BY resolved DESC`;

  const rawIssues = await fetchIssuesByJql(constrainedJql);

  const filteredIssues = rawIssues.filter(issue =>
    ALLOWED_ISSUE_TYPES.includes(issue.issueType)
  );

  const classifiedIssues = filteredIssues.map(issue => ({
    ...issue,
    bucket: classifyIssue(issue),
    completed: issue.resolution != null
  }));

  const summary = buildSprintSummary(classifiedIssues, calculationMode);

  const syntheticSprintId = `kanban-${board.id}`;
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
    boardId: board.id,
    lastUpdated: new Date().toISOString(),
    issues: classifiedIssues,
    summary
  };

  writeStorage(`sprints/${syntheticSprintId}.json`, sprintData);

  writeStorage(`sprints/team-${teamKey}.json`, {
    boardId: board.id,
    boardName: board.name,
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

  const filteredCount = rawIssues.length - filteredIssues.length;
  const filterMsg = filteredCount > 0 ? ` (${filteredCount} filtered)` : '';
  console.log(`  [${board.name}] Kanban: ${classifiedIssues.length} issues${filterMsg}, ${summary.totalPoints} pts`);

  return {
    board,
    sprintResults: [sprintResult],
    dashboardSprint: syntheticSprint,
    dashboardSprintResult: sprintResult
  };
}

/**
 * Full refresh: read enabled boards from teams.json, process each, then build dashboard summary.
 *
 * Key changes from standalone:
 * - Removed redundant fetchBoards call (reads from teams.json directly)
 * - Dashboard summary built AFTER all boards complete (no race condition with sync storage)
 * - No `await` on storage calls (synchronous)
 */
async function performRefresh({ projectKey, hardRefresh, fetchSprints, fetchSprintIssues, fetchBoardConfiguration, fetchFilterJql, fetchIssuesByJql, readStorage, writeStorage }) {
  console.log(`Starting refresh for project ${projectKey} (hardRefresh: ${hardRefresh})`);
  const refreshStart = Date.now();

  // Read boards from teams config directly (no redundant Jira API call)
  const teamsData = readStorage('teams.json');
  let boards;
  if (teamsData && teamsData.teams) {
    const enabledTeams = teamsData.teams.filter(t => t.enabled !== false);
    boards = enabledTeams.map(team => ({
      id: team.boardId,
      name: team.boardName,
      teamId: team.teamId || String(team.boardId),
      sprintFilter: team.sprintFilter || '',
      calculationMode: team.calculationMode || 'points',
      boardType: team.boardType || 'scrum'
    }));
    const skipped = teamsData.teams.length - enabledTeams.length;
    if (skipped > 0) {
      console.log(`Skipping ${skipped} disabled teams`);
    }
  } else {
    boards = [];
  }

  // Process boards in parallel (allSettled so one failure doesn't kill the refresh)
  const CONCURRENCY = 2;
  const boardResults = [];

  for (let i = 0; i < boards.length; i += CONCURRENCY) {
    const chunk = boards.slice(i, i + CONCURRENCY);
    const chunkSettled = await Promise.allSettled(chunk.map(board => {
      if (board.boardType === 'kanban') {
        return processKanbanBoard({ board, fetchBoardConfiguration, fetchFilterJql, fetchIssuesByJql, readStorage, writeStorage });
      }
      return processBoard({ board, hardRefresh, fetchSprints, fetchSprintIssues, readStorage, writeStorage });
    }));
    for (let j = 0; j < chunkSettled.length; j++) {
      const result = chunkSettled[j];
      if (result.status === 'fulfilled') {
        boardResults.push(result.value);
      } else {
        console.error(`Failed to process board ${chunk[j].name} (${chunk[j].id}):`, result.reason?.message || result.reason);
      }
    }
  }

  // Build dashboard summary AFTER all boards complete (fixes race condition)
  const dashboardSummary = {
    lastUpdated: new Date().toISOString(),
    boards: {}
  };

  for (const { board, dashboardSprint, dashboardSprintResult } of boardResults) {
    if (dashboardSprint && dashboardSprintResult) {
      dashboardSummary.boards[board.teamId || board.id] = {
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

  writeStorage('dashboard-summary.json', dashboardSummary);

  const allSprintResults = boardResults.flatMap(r => r.sprintResults);
  const failedCount = boards.length - boardResults.length;
  const refreshElapsed = ((Date.now() - refreshStart) / 1000).toFixed(1);
  console.log(`Refresh complete: ${boardResults.length}/${boards.length} boards succeeded, ${allSprintResults.length} sprints (${refreshElapsed}s)`);

  return {
    success: true,
    projectKey,
    boardCount: boardResults.length,
    failedBoardCount: failedCount,
    sprintCount: allSprintResults.length,
    dashboardSummary
  };
}

/**
 * Multi-project refresh: iterate over projects, refresh each with prefixed storage,
 * then generate rollup summaries.
 */
async function performMultiProjectRefresh({ projects, hardRefresh, fetchSprints, fetchSprintIssues, fetchBoardConfiguration, fetchFilterJql, fetchIssuesByJql, readStorage, writeStorage, getDeps }) {
  console.log(`Starting multi-project refresh for ${projects.length} projects`);
  const refreshStart = Date.now();

  const projectResults = [];

  for (const project of projects) {
    let projRead, projWrite;
    if (getDeps) {
      const deps = getDeps(project.key);
      projRead = deps.readStorage;
      projWrite = deps.writeStorage;
    } else {
      const prefix = getStoragePrefix(project.key);
      const { read, write } = createPrefixedStorage(prefix, readStorage, writeStorage);
      projRead = read;
      projWrite = write;
    }

    try {
      const result = await performRefresh({
        projectKey: project.key,
        hardRefresh,
        fetchSprints,
        fetchSprintIssues,
        fetchBoardConfiguration,
        fetchFilterJql,
        fetchIssuesByJql,
        readStorage: projRead,
        writeStorage: projWrite
      });
      projectResults.push({ ...result, success: true });
    } catch (error) {
      console.error(`Failed to refresh project ${project.key}:`, error.message);
      projectResults.push({
        success: false,
        projectKey: project.key,
        error: error.message
      });
    }
  }

  // Build rollup summaries
  const projectSummaries = [];
  for (const result of projectResults) {
    if (!result.success || !result.dashboardSummary?.boards) continue;
    const boardSummaries = Object.values(result.dashboardSummary.boards)
      .filter(b => b.summary)
      .map(b => b.summary);
    const projSummary = buildProjectSummary(boardSummaries);
    projectSummaries.push(projSummary);
  }

  const orgSummary = buildOrgSummary(projectSummaries);
  writeStorage('data/org-summary.json', {
    lastUpdated: new Date().toISOString(),
    ...orgSummary
  });

  const refreshElapsed = ((Date.now() - refreshStart) / 1000).toFixed(1);
  console.log(`Multi-project refresh complete: ${projects.length} projects (${refreshElapsed}s)`);

  return {
    success: true,
    projects: projectResults
  };
}

module.exports = { discoverBoards, performRefresh, processBoard, processKanbanBoard, performMultiProjectRefresh, generateTeamId };
