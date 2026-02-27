/**
 * Orchestration logic for board discovery and sprint refresh.
 *
 * All I/O is injected via dependencies — this module never touches
 * the filesystem or network directly.
 */

const { processSprintReport } = require('./sprint-report');

/**
 * Determine if a board is stale (no sprints in last 6 months)
 */
function determineStaleness(sprints) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const latestSprint = sprints
    .filter(s => s.endDate || s.completeDate)
    .sort((a, b) => new Date(b.endDate || b.completeDate) - new Date(a.endDate || a.completeDate))[0];

  if (!latestSprint) {
    return { stale: true, lastSprintEndDate: null };
  }

  const lastDate = new Date(latestSprint.endDate || latestSprint.completeDate);
  return {
    stale: lastDate < sixMonthsAgo,
    lastSprintEndDate: latestSprint.endDate || latestSprint.completeDate
  };
}

/**
 * Discover boards from Jira, determine staleness, and merge with existing team config.
 */
async function discoverBoards({ fetchBoards, fetchSprints, readStorage, writeStorage }) {
  console.log('Discovering boards for project RHOAIENG');

  const boards = await fetchBoards();
  console.log(`Found ${boards.length} scrum boards`);

  await writeStorage('boards.json', {
    lastUpdated: new Date().toISOString(),
    boards: boards
  });

  // Fetch sprints for each board to determine staleness
  const DISCOVER_CONCURRENCY = 3;
  const boardStaleness = new Map();

  for (let i = 0; i < boards.length; i += DISCOVER_CONCURRENCY) {
    const chunk = boards.slice(i, i + DISCOVER_CONCURRENCY);
    const results = await Promise.all(chunk.map(async (board) => {
      try {
        const sprints = await fetchSprints(board.id);
        return { boardId: board.id, ...determineStaleness(sprints) };
      } catch (error) {
        console.warn(`Failed to fetch sprints for board ${board.id}:`, error.message);
        return { boardId: board.id, stale: false, lastSprintEndDate: null };
      }
    }));
    results.forEach(r => boardStaleness.set(r.boardId, r));
  }

  const staleCount = [...boardStaleness.values()].filter(s => s.stale).length;
  console.log(`Staleness check: ${staleCount} of ${boards.length} boards are stale`);

  // Merge with existing teams config (preserving sub-team entries)
  const existingTeams = await readStorage('teams.json');
  const existingByBoard = new Map(); // boardId -> array of team entries
  if (existingTeams?.teams) {
    for (const t of existingTeams.teams) {
      if (!existingByBoard.has(t.boardId)) existingByBoard.set(t.boardId, []);
      existingByBoard.get(t.boardId).push(t);
    }
  }

  const mergedTeams = [];
  for (const b of boards) {
    const staleness = boardStaleness.get(b.id) || { stale: false, lastSprintEndDate: null };
    const existingEntries = existingByBoard.get(b.id);

    if (existingEntries) {
      for (const existing of existingEntries) {
        const updated = {
          ...existing,
          boardName: b.name,
          stale: staleness.stale,
          lastSprintEndDate: staleness.lastSprintEndDate
        };
        if (staleness.stale && !existing.manuallyConfigured) {
          updated.enabled = false;
        }
        mergedTeams.push(updated);
      }
    } else {
      mergedTeams.push({
        boardId: b.id,
        boardName: b.name,
        displayName: b.name.replace(/^RHOAIENG\s*[-–]\s*/, ''),
        enabled: !staleness.stale,
        stale: staleness.stale,
        lastSprintEndDate: staleness.lastSprintEndDate,
        manuallyConfigured: false
      });
    }
  }

  await writeStorage('teams.json', { teams: mergedTeams });

  return { success: true, boardCount: boards.length, staleCount };
}

/**
 * Process a single board: fetch sprints, fetch sprint reports, transform, cache.
 */
async function processBoard({ board, hardRefresh, sprintFilter, teamId, fetchSprints, fetchSprintReport, readStorage, writeStorage, jiraHost, onProgress }) {
  const effectiveTeamId = teamId || String(board.id);
  const emit = onProgress || (() => {});
  const displayName = sprintFilter ? `${board.name} [${sprintFilter}]` : board.name;
  console.log(`Processing board: ${displayName} (${board.id}, team: ${effectiveTeamId})`);
  emit({ type: 'board-start', board: displayName });

  const sprints = await fetchSprints(board.id);
  console.log(`  [${displayName}] Found ${sprints.length} sprints`);

  // Apply sprint name filter if set
  let filteredSprints = sprints;
  if (sprintFilter?.trim()) {
    const filterLower = sprintFilter.trim().toLowerCase();
    filteredSprints = sprints.filter(s => s.name.toLowerCase().includes(filterLower));
    console.log(`  [${displayName}] After filter "${sprintFilter}": ${filteredSprints.length} sprints`);
  }

  // Get closed sprints from last 12 months + active sprints
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const activeSprints = filteredSprints.filter(s => s.state === 'active');
  const closedSprints = filteredSprints
    .filter(s => s.state === 'closed')
    .filter(s => {
      const endDate = new Date(s.endDate || s.completeDate || 0);
      return endDate >= twelveMonthsAgo;
    })
    .sort((a, b) => new Date(b.completeDate || 0) - new Date(a.completeDate || 0));

  const sprintsToProcess = [...activeSprints, ...closedSprints];
  const sprintResults = [];

  for (let si = 0; si < sprintsToProcess.length; si++) {
    const sprint = sprintsToProcess[si];
    // Closed-sprint caching: skip if cached and not hard refresh
    if (!hardRefresh && sprint.state === 'closed') {
      const cached = await readStorage(`sprints/${sprint.id}.json`);
      if (cached) {
        console.log(`  [${displayName}] Using cached: ${sprint.name}`);
        emit({ type: 'sprint', board: displayName, sprint: sprint.name, sprintIndex: si, totalSprints: sprintsToProcess.length, cached: true });
        sprintResults.push(cached);
        continue;
      }
    }

    console.log(`  [${displayName}] Fetching sprint report: ${sprint.name} (${sprint.state})`);
    emit({ type: 'sprint', board: displayName, sprint: sprint.name, sprintIndex: si, totalSprints: sprintsToProcess.length, cached: false });

    try {
      const rawReport = await fetchSprintReport(board.id, sprint.id);
      const processed = processSprintReport(rawReport, board.id, jiraHost);

      await writeStorage(`sprints/${sprint.id}.json`, processed);
      sprintResults.push(processed);

      const m = processed.metrics;
      console.log(`    ${processed.committed.issues.length} committed, ${processed.delivered.issues.length} delivered, ${m.velocityPoints} pts velocity, ${m.commitmentReliabilityPoints}% reliability`);
    } catch (error) {
      console.error(`    Failed to process sprint ${sprint.name}:`, error.message);
    }
  }

  emit({ type: 'board-complete', board: displayName, sprintCount: sprintResults.length });

  // Write sprint index keyed by team ID
  await writeStorage(`sprints/team-${effectiveTeamId}.json`, {
    boardId: board.id,
    teamId: effectiveTeamId,
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

  // Pick active or most recent closed for dashboard
  const dashboardSprint = activeSprints[0] || closedSprints[0] || null;
  const dashboardResult = dashboardSprint
    ? sprintResults.find(r => r.sprint.id === dashboardSprint.id)
    : null;

  return {
    board,
    teamId: effectiveTeamId,
    sprintResults,
    dashboardSprint,
    dashboardResult
  };
}

const ROLLING_SPRINT_COUNT = 6;

/**
 * Compute rolling dashboard metrics from recent closed sprint results.
 * Uses up to N most recent closed sprints.
 */
function computeRollingMetrics(sprintResults, count = ROLLING_SPRINT_COUNT) {
  const closedSprints = sprintResults
    .filter(r => r.sprint.state === 'closed' || r.sprint.state === 'CLOSED')
    .sort((a, b) => new Date(b.sprint.completeDate || b.sprint.endDate || 0) - new Date(a.sprint.completeDate || a.sprint.endDate || 0))
    .slice(0, count);

  let totalCommitted = 0;
  let totalDelivered = 0;
  let totalScopeChange = 0;

  for (const sprint of closedSprints) {
    totalCommitted += sprint.committed?.totalPoints || 0;
    totalDelivered += sprint.delivered?.totalPoints || 0;
    totalScopeChange += sprint.metrics?.scopeChangeCount || 0;
  }

  const n = closedSprints.length;

  return {
    commitmentReliabilityPoints: totalCommitted > 0
      ? Math.round((totalDelivered / totalCommitted) * 100)
      : 0,
    avgVelocityPoints: n > 0 ? Math.round(totalDelivered / n) : 0,
    avgScopeChange: n > 0 ? +(totalScopeChange / n).toFixed(1) : 0,
    sprintsUsed: n
  };
}

/**
 * Full refresh: process all enabled boards and generate dashboard summary.
 */
async function performRefresh({ hardRefresh, fetchBoards, fetchSprints, fetchSprintReport, readStorage, writeStorage, jiraHost, onProgress }) {
  console.log(`Starting refresh (hardRefresh: ${hardRefresh})`);
  const refreshStart = Date.now();

  // Get enabled boards
  const teamsData = await readStorage('teams.json');
  const enabledTeams = teamsData?.teams?.filter(t => t.enabled !== false) || [];

  if (enabledTeams.length === 0) {
    console.log('No enabled boards to refresh');
    if (onProgress) await onProgress({ type: 'complete', boardCount: 0, sprintCount: 0 });
    return { success: true, boardCount: 0, sprintCount: 0 };
  }

  const totalBoards = enabledTeams.length;
  if (onProgress) await onProgress({ type: 'refresh-start', totalBoards });

  // Also update boards list
  const boardsData = await readStorage('boards.json');
  const allBoards = boardsData?.boards || [];

  // Process boards with concurrency limit of 2
  const CONCURRENCY = 2;
  const boardResults = [];
  let completedBoards = 0;

  for (let i = 0; i < enabledTeams.length; i += CONCURRENCY) {
    const chunk = enabledTeams.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map(team => {
      // Compute effective team ID
      const filter = team.sprintFilter?.trim();
      let effectiveTeamId = team.teamId;
      if (!effectiveTeamId && filter) {
        effectiveTeamId = `${team.boardId}_${filter.toLowerCase().replace(/\s+/g, '-')}`;
      }
      if (!effectiveTeamId) {
        effectiveTeamId = String(team.boardId);
      }

      const boardOnProgress = onProgress
        ? (event) => onProgress({ ...event, boardIndex: completedBoards + (chunk.indexOf(team)), totalBoards })
        : undefined;
      return processBoard({
        board: { id: team.boardId, name: team.boardName || team.displayName },
        hardRefresh,
        sprintFilter: team.sprintFilter,
        teamId: effectiveTeamId,
        fetchSprints,
        fetchSprintReport,
        readStorage,
        writeStorage,
        jiraHost,
        onProgress: boardOnProgress
      });
    }));
    completedBoards += chunkResults.length;
    boardResults.push(...chunkResults);
  }

  // Generate dashboard summary
  const dashboardSummary = {
    lastUpdated: new Date().toISOString(),
    boards: {}
  };

  for (const { board, teamId: resultTeamId, sprintResults } of boardResults) {
    if (sprintResults.length === 0) continue;

    const latestClosed = sprintResults
      .filter(r => r.sprint.state === 'closed' || r.sprint.state === 'CLOSED')
      .sort((a, b) => new Date(b.sprint.completeDate || b.sprint.endDate || 0) - new Date(a.sprint.completeDate || a.sprint.endDate || 0))[0];

    if (!latestClosed) continue;

    const rolling = computeRollingMetrics(sprintResults);

    dashboardSummary.boards[resultTeamId] = {
      boardName: board.name,
      sprint: {
        id: latestClosed.sprint.id,
        name: latestClosed.sprint.name,
        state: latestClosed.sprint.state,
        startDate: latestClosed.sprint.startDate,
        endDate: latestClosed.sprint.endDate
      },
      metrics: rolling
    };
  }

  await writeStorage('dashboard-summary.json', dashboardSummary);

  const totalSprints = boardResults.reduce((sum, r) => sum + r.sprintResults.length, 0);
  const elapsed = ((Date.now() - refreshStart) / 1000).toFixed(1);
  console.log(`Refresh complete: ${boardResults.length} boards, ${totalSprints} sprints (${elapsed}s)`);

  if (onProgress) await onProgress({ type: 'complete', boardCount: boardResults.length, sprintCount: totalSprints });

  return {
    success: true,
    boardCount: boardResults.length,
    sprintCount: totalSprints
  };
}

module.exports = { discoverBoards, processBoard, performRefresh, determineStaleness };
