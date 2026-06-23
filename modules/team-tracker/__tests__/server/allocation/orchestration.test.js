// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { processBoard, processKanbanBoard, refreshTeam, performRefresh } from '../../../server/allocation/orchestration.js';

const TEST_STRATEGY = {
  id: 'test-strategy',
  name: 'Test Strategy',
  description: 'Test allocation strategy',
  categories: [
    { key: 'tech-debt-quality', name: 'Tech Debt & Quality', color: 'amber', target: 40 },
    { key: 'new-features', name: 'New Features', color: 'blue', target: 40 },
    { key: 'learning-enablement', name: 'Learning & Enablement', color: 'green', target: 20 }
  ],
  classifyIssue: (issue) => {
    if (issue.issueType === 'Vulnerability' || issue.issueType === 'Weakness') return 'tech-debt-quality';
    switch (issue.activityType) {
      case 'Tech Debt & Quality': return 'tech-debt-quality';
      case 'New Features': return 'new-features';
      case 'Learning & Enablement': return 'learning-enablement';
      default: return 'uncategorized';
    }
  }
};

function makeDeps(overrides = {}) {
  return {
    strategy: TEST_STRATEGY,
    fetchSprints: vi.fn().mockResolvedValue([]),
    fetchSprintIssues: vi.fn().mockResolvedValue([]),
    fetchBoardConfiguration: vi.fn().mockResolvedValue({ filterId: '555' }),
    fetchFilterJql: vi.fn().mockResolvedValue('project = PROJ'),
    fetchIssuesByJql: vi.fn().mockResolvedValue([]),
    fetchBoardType: vi.fn().mockResolvedValue('scrum'),
    readStorage: vi.fn().mockReturnValue(null),
    writeStorage: vi.fn(),
    ...overrides
  };
}

function makeTeam(overrides = {}) {
  return {
    id: 'team_abc123',
    name: 'Model Serving',
    orgKey: 'shgriffi',
    metadata: { allocationMode: 'points' },
    boards: [
      { url: 'https://redhat.atlassian.net/jira/software/projects/RHOAIENG/boards/123', name: 'RHOAIENG Board', boardId: 123 }
    ],
    ...overrides
  };
}

describe('processBoard', () => {
  it('fetches sprints and issues, classifies, writes sprint data', async () => {
    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-01-15', endDate: '2025-01-28', completeDate: null }
      ]),
      fetchSprintIssues: vi.fn().mockResolvedValue([
        { key: 'PROJ-1', issueType: 'Bug', activityType: 'Tech Debt & Quality', storyPoints: 3, resolution: 'Done' },
        { key: 'PROJ-2', issueType: 'Story', activityType: 'New Features', storyPoints: 5, resolution: null }
      ])
    });

    const board = { boardId: 42, name: 'Board A' };
    const result = await processBoard({ board, teamId: 'team_abc', allocationMode: 'points', hardRefresh: false, ...deps });

    expect(result.sprintResults).toHaveLength(1);
    expect(result.sprintResults[0].issueCount).toBe(2);
    expect(result.dashboardSprint).toBeTruthy();

    // Should write sprint data and sprint index
    const writeCalls = deps.writeStorage.mock.calls;
    expect(writeCalls.some(c => c[0] === 'sprints/100.json')).toBe(true);
    expect(writeCalls.some(c => c[0] === 'sprints/board-42.json')).toBe(true);

    // Sprint data should include teamId
    const sprintDataCall = writeCalls.find(c => c[0] === 'sprints/100.json');
    expect(sprintDataCall[1].teamId).toBe('team_abc');
  });

  it('uses cached data for closed sprints when not hard refreshing', async () => {
    const cachedData = {
      strategyId: 'test-strategy',
      issues: [{ key: 'PROJ-1' }],
      summary: { totalPoints: 10, buckets: {} }
    };

    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 200, name: 'Sprint Old', state: 'closed', startDate: '2025-01-01', endDate: '2025-01-14', completeDate: '2025-01-15' }
      ]),
      readStorage: vi.fn().mockImplementation(key => {
        if (key === 'sprints/200.json') return cachedData;
        return null;
      })
    });

    const board = { boardId: 42, name: 'Board A' };
    const result = await processBoard({ board, teamId: 'team_abc', allocationMode: 'points', hardRefresh: false, ...deps });

    expect(result.sprintResults).toHaveLength(1);
    expect(result.sprintResults[0].totalPoints).toBe(10);
    // Should NOT have fetched sprint issues
    expect(deps.fetchSprintIssues).not.toHaveBeenCalled();
  });

  it('re-fetches closed sprints when hard refreshing', async () => {
    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 200, name: 'Sprint Old', state: 'closed', startDate: '2025-01-01', endDate: '2025-01-14', completeDate: '2025-01-15' }
      ]),
      fetchSprintIssues: vi.fn().mockResolvedValue([]),
      readStorage: vi.fn().mockReturnValue({ issues: [], summary: { totalPoints: 5 } })
    });

    const board = { boardId: 42, name: 'Board A' };
    await processBoard({ board, teamId: 'team_abc', allocationMode: 'points', hardRefresh: true, ...deps });

    expect(deps.fetchSprintIssues).toHaveBeenCalled();
  });

  it('applies sprint filter when set', async () => {
    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 100, name: 'Alpha Sprint 1', state: 'active', startDate: '2025-01-15', endDate: '2025-01-28', completeDate: null },
        { id: 101, name: 'Beta Sprint 1', state: 'active', startDate: '2025-01-15', endDate: '2025-01-28', completeDate: null }
      ]),
      fetchSprintIssues: vi.fn().mockResolvedValue([])
    });

    const board = { boardId: 42, name: 'Board A', sprintFilter: 'Alpha' };
    const result = await processBoard({ board, teamId: 'team_abc', allocationMode: 'points', hardRefresh: false, ...deps });

    // Only the Alpha sprint should be processed
    expect(result.sprintResults).toHaveLength(1);
    // fetchSprintIssues should only be called once (for Alpha Sprint 1)
    expect(deps.fetchSprintIssues).toHaveBeenCalledTimes(1);
    expect(deps.fetchSprintIssues).toHaveBeenCalledWith(100);
  });

  it('processes closed sprints (most recent 5)', async () => {
    const closedSprints = Array.from({ length: 8 }, (_, i) => ({
      id: 300 + i,
      name: `Sprint ${i}`,
      state: 'closed',
      startDate: `2025-0${i + 1}-01`,
      endDate: `2025-0${i + 1}-14`,
      completeDate: `2025-0${i + 1}-15`
    }));

    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue(closedSprints),
      fetchSprintIssues: vi.fn().mockResolvedValue([])
    });

    const board = { boardId: 42, name: 'Board A' };
    await processBoard({ board, teamId: 'team_abc', allocationMode: 'points', hardRefresh: true, ...deps });

    // Should only process the 5 most recent closed sprints
    expect(deps.fetchSprintIssues).toHaveBeenCalledTimes(5);
  });

  it('filters out non-allowed issue types', async () => {
    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-01-15', endDate: '2025-01-28', completeDate: null }
      ]),
      fetchSprintIssues: vi.fn().mockResolvedValue([
        { key: 'PROJ-1', issueType: 'Bug', activityType: null, storyPoints: 3, resolution: null },
        { key: 'PROJ-2', issueType: 'Sub-task', activityType: null, storyPoints: 1, resolution: null },
        { key: 'PROJ-3', issueType: 'Epic', activityType: null, storyPoints: 5, resolution: null }
      ])
    });

    const board = { boardId: 42, name: 'Board A' };
    const result = await processBoard({ board, teamId: 'team_abc', allocationMode: 'points', hardRefresh: false, ...deps });

    // Only Bug is in ALLOWED_ISSUE_TYPES; Sub-task and Epic are not
    expect(result.sprintResults[0].issueCount).toBe(1);
  });

  it('uses allocationMode for calculation', async () => {
    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-01-15', endDate: '2025-01-28', completeDate: null }
      ]),
      fetchSprintIssues: vi.fn().mockResolvedValue([
        { key: 'PROJ-1', issueType: 'Bug', activityType: null, storyPoints: 3, resolution: null }
      ])
    });

    const board = { boardId: 42, name: 'Board A' };
    await processBoard({ board, teamId: 'team_abc', allocationMode: 'counts', hardRefresh: false, ...deps });

    const sprintDataCall = deps.writeStorage.mock.calls.find(c => c[0] === 'sprints/100.json');
    expect(sprintDataCall[1].summary.calculationMode).toBe('counts');
  });
});

describe('processKanbanBoard', () => {
  it('fetches board config, JQL, and creates synthetic sprint', async () => {
    const deps = makeDeps({
      fetchBoardConfiguration: vi.fn().mockResolvedValue({ filterId: '999' }),
      fetchFilterJql: vi.fn().mockResolvedValue('project = PROJ ORDER BY rank ASC'),
      fetchIssuesByJql: vi.fn().mockResolvedValue([
        { key: 'PROJ-1', issueType: 'Bug', activityType: 'Tech Debt & Quality', storyPoints: 3, resolution: 'Done' }
      ])
    });

    const board = { boardId: 50, name: 'Kanban Board' };
    const result = await processKanbanBoard({ board, teamId: 'team_abc', allocationMode: 'points', ...deps });

    expect(result.sprintResults).toHaveLength(1);
    expect(result.sprintResults[0].sprintId).toBe('kanban-50');
    expect(result.dashboardSprint.name).toBe('Last 2 weeks');

    // Should write sprint data and sprint index
    const writeCalls = deps.writeStorage.mock.calls;
    expect(writeCalls.some(c => c[0] === 'sprints/kanban-50.json')).toBe(true);
    expect(writeCalls.some(c => c[0] === 'sprints/board-50.json')).toBe(true);
  });

  it('strips ORDER BY from JQL and adds date constraint', async () => {
    const deps = makeDeps({
      fetchBoardConfiguration: vi.fn().mockResolvedValue({ filterId: '999' }),
      fetchFilterJql: vi.fn().mockResolvedValue('project = PROJ AND type = Bug ORDER BY priority DESC'),
      fetchIssuesByJql: vi.fn().mockResolvedValue([])
    });

    const board = { boardId: 50, name: 'Kanban Board' };
    await processKanbanBoard({ board, teamId: 'team_abc', allocationMode: 'points', ...deps });

    const jql = deps.fetchIssuesByJql.mock.calls[0][0];
    expect(jql).toContain('project = PROJ AND type = Bug');
    expect(jql).toContain('resolved >= -2w');
    // Should not have the original ORDER BY
    expect(jql).not.toContain('ORDER BY priority DESC');
    // Should have the new ORDER BY
    expect(jql).toContain('ORDER BY resolved DESC');
  });

  it('includes teamId in sprint data', async () => {
    const deps = makeDeps({
      fetchIssuesByJql: vi.fn().mockResolvedValue([])
    });

    const board = { boardId: 50, name: 'Kanban Board' };
    await processKanbanBoard({ board, teamId: 'team_xyz', allocationMode: 'points', ...deps });

    const sprintDataCall = deps.writeStorage.mock.calls.find(c => c[0] === 'sprints/kanban-50.json');
    expect(sprintDataCall[1].teamId).toBe('team_xyz');
  });
});

describe('refreshTeam', () => {
  it('processes all boards with valid boardId', async () => {
    const team = makeTeam({
      boards: [
        { url: 'https://example.com/boards/123', name: 'Board A', boardId: 123 },
        { url: 'https://example.com/boards/456', name: 'Board B', boardId: 456 }
      ]
    });

    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-01-15', endDate: '2025-01-28', completeDate: null }
      ]),
      fetchSprintIssues: vi.fn().mockResolvedValue([])
    });

    const result = await refreshTeam({ team, hardRefresh: false, ...deps });

    expect(result).toBeTruthy();
    expect(result.teamId).toBe('team_abc123');
    expect(result.teamName).toBe('Model Serving');
    expect(result.orgKey).toBe('shgriffi');
    expect(result.allocationMode).toBe('points');

    // Should write team summary
    const summaryCall = deps.writeStorage.mock.calls.find(c => c[0] === 'summaries/team-team_abc123.json');
    expect(summaryCall).toBeTruthy();
    expect(summaryCall[1].teamName).toBe('Model Serving');
  });

  it('skips boards without boardId', async () => {
    const team = makeTeam({
      boards: [
        { url: 'https://example.com/some-page', name: 'Not a board' }
        // No boardId
      ]
    });

    const deps = makeDeps();
    const result = await refreshTeam({ team, hardRefresh: false, ...deps });

    expect(result).toBeNull();
    expect(deps.fetchSprints).not.toHaveBeenCalled();
  });

  it('uses allocationMode from team metadata', async () => {
    const team = makeTeam({
      metadata: { allocationMode: 'counts' }
    });

    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-01-15', endDate: '2025-01-28', completeDate: null }
      ]),
      fetchSprintIssues: vi.fn().mockResolvedValue([
        { key: 'PROJ-1', issueType: 'Bug', activityType: null, storyPoints: 3, resolution: null }
      ])
    });

    const result = await refreshTeam({ team, hardRefresh: false, ...deps });

    expect(result.allocationMode).toBe('counts');
  });

  it('defaults allocationMode to points when not set', async () => {
    const team = makeTeam({ metadata: {} });

    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-01-15', endDate: '2025-01-28', completeDate: null }
      ]),
      fetchSprintIssues: vi.fn().mockResolvedValue([])
    });

    const result = await refreshTeam({ team, hardRefresh: false, ...deps });

    expect(result.allocationMode).toBe('points');
  });

  it('auto-detects kanban boards and uses processKanbanBoard', async () => {
    const team = makeTeam({
      boards: [
        { url: 'https://example.com/boards/123', name: 'Kanban Board', boardId: 123 }
      ]
    });

    const deps = makeDeps({
      fetchBoardType: vi.fn().mockResolvedValue('kanban'),
      fetchBoardConfiguration: vi.fn().mockResolvedValue({ filterId: '999' }),
      fetchFilterJql: vi.fn().mockResolvedValue('project = PROJ ORDER BY rank ASC'),
      fetchIssuesByJql: vi.fn().mockResolvedValue([
        { key: 'PROJ-1', issueType: 'Bug', activityType: 'Tech Debt & Quality', storyPoints: 3, resolution: 'Done' }
      ])
    });

    const result = await refreshTeam({ team, hardRefresh: false, ...deps });

    expect(result).toBeTruthy();
    // Should have used kanban flow (fetchBoardConfiguration) instead of scrum flow (fetchSprints)
    expect(deps.fetchBoardConfiguration).toHaveBeenCalledWith(123);
    expect(deps.fetchSprints).not.toHaveBeenCalled();
    // Sprint data should use synthetic kanban ID
    const writeCalls = deps.writeStorage.mock.calls;
    expect(writeCalls.some(c => c[0] === 'sprints/kanban-123.json')).toBe(true);
  });

  it('falls back to scrum when fetchBoardType fails', async () => {
    const team = makeTeam({
      boards: [
        { url: 'https://example.com/boards/123', name: 'Board A', boardId: 123 }
      ]
    });

    const deps = makeDeps({
      fetchBoardType: vi.fn().mockRejectedValue(new Error('API error')),
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-01-15', endDate: '2025-01-28', completeDate: null }
      ]),
      fetchSprintIssues: vi.fn().mockResolvedValue([])
    });

    const result = await refreshTeam({ team, hardRefresh: false, ...deps });

    expect(result).toBeTruthy();
    // Should fall back to scrum flow
    expect(deps.fetchSprints).toHaveBeenCalled();
  });

  it('falls back to scrum when fetchBoardType is not provided', async () => {
    const team = makeTeam();

    const deps = makeDeps({
      fetchBoardType: undefined,
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-01-15', endDate: '2025-01-28', completeDate: null }
      ]),
      fetchSprintIssues: vi.fn().mockResolvedValue([])
    });

    const result = await refreshTeam({ team, hardRefresh: false, ...deps });

    expect(result).toBeTruthy();
    expect(deps.fetchSprints).toHaveBeenCalled();
  });

  it('continues when individual boards fail', async () => {
    const team = makeTeam({
      boards: [
        { url: 'https://example.com/boards/123', name: 'Board A', boardId: 123 },
        { url: 'https://example.com/boards/456', name: 'Board B', boardId: 456 }
      ]
    });

    let callCount = 0;
    const deps = makeDeps({
      fetchSprints: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error('Board A failed');
        return Promise.resolve([
          { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-01-15', endDate: '2025-01-28', completeDate: null }
        ]);
      }),
      fetchSprintIssues: vi.fn().mockResolvedValue([])
    });

    const result = await refreshTeam({ team, hardRefresh: false, ...deps });

    expect(result).toBeTruthy();
    // Board B should have been processed even though Board A failed
    expect(deps.fetchSprints).toHaveBeenCalledTimes(2);
  });
});

describe('performRefresh', () => {
  it('refreshes all teams and builds summaries', async () => {
    const teams = [
      makeTeam({ id: 'team_1', name: 'Team Alpha', orgKey: 'org1' }),
      makeTeam({ id: 'team_2', name: 'Team Beta', orgKey: 'org1' }),
      makeTeam({ id: 'team_3', name: 'Team Gamma', orgKey: 'org2' })
    ];

    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-01-15', endDate: '2025-01-28', completeDate: null }
      ]),
      fetchSprintIssues: vi.fn().mockResolvedValue([
        { key: 'PROJ-1', issueType: 'Bug', activityType: 'Tech Debt & Quality', storyPoints: 3, resolution: 'Done' }
      ])
    });

    const result = await performRefresh({ teams, hardRefresh: false, ...deps });

    expect(result.success).toBe(true);
    expect(result.teamCount).toBe(3);
    expect(result.orgCount).toBe(2);

    // Check that org summaries were written
    const writeCalls = deps.writeStorage.mock.calls;
    expect(writeCalls.some(c => c[0] === 'summaries/org-org1.json')).toBe(true);
    expect(writeCalls.some(c => c[0] === 'summaries/org-org2.json')).toBe(true);
    expect(writeCalls.some(c => c[0] === 'summaries/global.json')).toBe(true);

    // Org summary should include team details
    const org1Call = writeCalls.find(c => c[0] === 'summaries/org-org1.json');
    expect(org1Call[1].teams).toHaveLength(2);

    // Global summary should include org details and all teams
    const globalCall = writeCalls.find(c => c[0] === 'summaries/global.json');
    expect(globalCall[1].orgs).toHaveLength(2);
    expect(globalCall[1].teams).toHaveLength(3);
    expect(globalCall[1].teams[0]).toHaveProperty('orgKey');
    expect(globalCall[1].teams[0]).toHaveProperty('teamName');
  });

  it('skips teams with no allocation boards', async () => {
    const teams = [
      makeTeam({ id: 'team_1', boards: [] }),
      makeTeam({ id: 'team_2', boards: [{ url: 'https://example.com/page', name: 'Wiki' }] })
    ];

    const deps = makeDeps();
    const result = await performRefresh({ teams, hardRefresh: false, ...deps });

    expect(result.teamCount).toBe(0);
    expect(deps.fetchSprints).not.toHaveBeenCalled();
  });

  it('continues when individual teams fail', async () => {
    const teams = [
      makeTeam({ id: 'team_1', name: 'Team Alpha', orgKey: 'org1' }),
      makeTeam({ id: 'team_2', name: 'Team Beta', orgKey: 'org1' })
    ];

    let callCount = 0;
    const deps = makeDeps({
      fetchSprints: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount <= 1) throw new Error('Jira unavailable');
        return Promise.resolve([
          { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-01-15', endDate: '2025-01-28', completeDate: null }
        ]);
      }),
      fetchSprintIssues: vi.fn().mockResolvedValue([])
    });

    const result = await performRefresh({ teams, hardRefresh: false, ...deps });

    // Both teams return results (board errors are caught inside refreshTeam),
    // but Team Alpha's summary has 0 boards processed
    expect(result.teamCount).toBe(2);
    expect(result.failedTeamCount).toBe(0);
  });

  it('handles empty teams array', async () => {
    const deps = makeDeps();
    const result = await performRefresh({ teams: [], hardRefresh: false, ...deps });

    expect(result.success).toBe(true);
    expect(result.teamCount).toBe(0);
    expect(result.orgCount).toBe(0);
  });
});
