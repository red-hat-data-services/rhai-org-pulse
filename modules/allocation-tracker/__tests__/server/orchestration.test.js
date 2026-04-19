// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { discoverBoards, performRefresh, processBoard, processKanbanBoard, performMultiProjectRefresh, generateTeamId } from '../../server/jira/orchestration.js';

function makeDeps(overrides = {}) {
  return {
    projectKey: 'PROJ',
    fetchBoards: vi.fn().mockResolvedValue([]),
    fetchSprints: vi.fn().mockResolvedValue([]),
    fetchSprintIssues: vi.fn().mockResolvedValue([]),
    fetchBoardConfiguration: vi.fn().mockResolvedValue({ filterId: '555' }),
    fetchFilterJql: vi.fn().mockResolvedValue('project = PROJ'),
    fetchIssuesByJql: vi.fn().mockResolvedValue([]),
    readStorage: vi.fn().mockReturnValue(null),
    writeStorage: vi.fn(),
    ...overrides
  };
}

describe('generateTeamId', () => {
  it('returns stringified boardId when no filter is provided', () => {
    expect(generateTeamId(42)).toBe('42');
  });

  it('returns stringified boardId when filter is empty string', () => {
    expect(generateTeamId(42, '')).toBe('42');
  });

  it('returns stringified boardId when filter is whitespace only', () => {
    expect(generateTeamId(42, '   ')).toBe('42');
  });

  it('returns boardId_normalizedFilter when filter is provided', () => {
    expect(generateTeamId(42, 'Team Alpha')).toBe('42_team-alpha');
  });

  it('trims and lowercases the filter', () => {
    expect(generateTeamId(42, '  TEAM ALPHA  ')).toBe('42_team-alpha');
  });

  it('collapses multiple spaces into single hyphens', () => {
    expect(generateTeamId(42, 'Team   Alpha  Beta')).toBe('42_team-alpha-beta');
  });

  it('handles undefined filter', () => {
    expect(generateTeamId(42, undefined)).toBe('42');
  });
});

/** Helper: create a fetchBoards mock that returns boards only for the scrum call */
function scrumOnlyFetchBoards(scrumBoards) {
  return vi.fn().mockImplementation((projectKey, boardType) => {
    if (boardType === 'kanban') return Promise.resolve([]);
    return Promise.resolve(scrumBoards);
  });
}

describe('discoverBoards', () => {
  it('saves boards.json and teams.json', async () => {
    const deps = makeDeps({
      fetchBoards: scrumOnlyFetchBoards([
        { id: 1, name: 'RHOAIENG - Team Alpha' }
      ]),
      fetchSprints: vi.fn().mockResolvedValue([
        { state: 'active', completeDate: null, endDate: '2025-06-15' }
      ])
    });

    const result = await discoverBoards(deps);

    expect(result.success).toBe(true);
    expect(result.boardCount).toBe(1);

    // boards.json written
    const boardsCall = deps.writeStorage.mock.calls.find(c => c[0] === 'boards.json');
    expect(boardsCall).toBeDefined();
    expect(boardsCall[1].boards).toHaveLength(1);

    // teams.json written
    const teamsCall = deps.writeStorage.mock.calls.find(c => c[0] === 'teams.json');
    expect(teamsCall).toBeDefined();
    const team = teamsCall[1].teams[0];
    expect(team.boardId).toBe(1);
    expect(team.displayName).toBe('Team Alpha');
    expect(team.enabled).toBe(true);
    expect(team.stale).toBe(false);
  });

  it('marks stale boards as disabled', async () => {
    const deps = makeDeps({
      fetchBoards: scrumOnlyFetchBoards([
        { id: 1, name: 'RHOAIENG - Stale Team' }
      ]),
      fetchSprints: vi.fn().mockResolvedValue([
        { state: 'closed', completeDate: '2024-01-01T00:00:00Z', endDate: null }
      ])
    });

    const result = await discoverBoards(deps);

    expect(result.staleCount).toBe(1);
    const teamsCall = deps.writeStorage.mock.calls.find(c => c[0] === 'teams.json');
    expect(teamsCall[1].teams[0].enabled).toBe(false);
    expect(teamsCall[1].teams[0].stale).toBe(true);
  });

  it('preserves existing team config for known boards', async () => {
    const deps = makeDeps({
      fetchBoards: scrumOnlyFetchBoards([
        { id: 1, name: 'RHOAIENG - Team Alpha' }
      ]),
      fetchSprints: vi.fn().mockResolvedValue([
        { state: 'active', completeDate: null, endDate: '2025-06-15' }
      ]),
      readStorage: vi.fn().mockReturnValue({
        teams: [{
          boardId: 1,
          boardName: 'RHOAIENG - Team Alpha',
          displayName: 'Custom Name',
          enabled: true,
          manuallyConfigured: true
        }]
      })
    });

    await discoverBoards(deps);

    const teamsCall = deps.writeStorage.mock.calls.find(c => c[0] === 'teams.json');
    expect(teamsCall[1].teams[0].displayName).toBe('Custom Name');
    expect(teamsCall[1].teams[0].manuallyConfigured).toBe(true);
  });

  it('does not auto-disable stale boards that are manually configured', async () => {
    const deps = makeDeps({
      fetchBoards: scrumOnlyFetchBoards([
        { id: 1, name: 'RHOAIENG - Team Alpha' }
      ]),
      fetchSprints: vi.fn().mockResolvedValue([]),
      readStorage: vi.fn().mockReturnValue({
        teams: [{
          boardId: 1,
          boardName: 'RHOAIENG - Team Alpha',
          displayName: 'Team Alpha',
          enabled: true,
          manuallyConfigured: true
        }]
      })
    });

    await discoverBoards(deps);

    const teamsCall = deps.writeStorage.mock.calls.find(c => c[0] === 'teams.json');
    // Should stay enabled because manuallyConfigured is true
    expect(teamsCall[1].teams[0].enabled).toBe(true);
    expect(teamsCall[1].teams[0].stale).toBe(true);
  });

  it('preserves multiple sub-team entries for the same board', async () => {
    const deps = makeDeps({
      fetchBoards: scrumOnlyFetchBoards([
        { id: 1, name: 'RHOAIENG - Shared Board' }
      ]),
      fetchSprints: vi.fn().mockResolvedValue([
        { state: 'active', completeDate: null, endDate: '2025-06-15' }
      ]),
      readStorage: vi.fn().mockReturnValue({
        teams: [
          { boardId: 1, boardName: 'RHOAIENG - Shared Board', displayName: 'Alpha', enabled: true, teamId: '1_alpha', sprintFilter: 'Alpha', manuallyConfigured: true },
          { boardId: 1, boardName: 'RHOAIENG - Shared Board', displayName: 'Beta', enabled: true, teamId: '1_beta', sprintFilter: 'Beta', manuallyConfigured: true }
        ]
      })
    });

    await discoverBoards(deps);

    const teamsCall = deps.writeStorage.mock.calls.find(c => c[0] === 'teams.json');
    const teams = teamsCall[1].teams;
    // Both sub-team entries should be preserved
    expect(teams.filter(t => t.boardId === 1)).toHaveLength(2);
    expect(teams.find(t => t.teamId === '1_alpha')).toBeDefined();
    expect(teams.find(t => t.teamId === '1_beta')).toBeDefined();
  });

  it('updates staleness on all sub-team entries for the same board', async () => {
    const deps = makeDeps({
      fetchBoards: scrumOnlyFetchBoards([
        { id: 1, name: 'RHOAIENG - Shared Board' }
      ]),
      fetchSprints: vi.fn().mockResolvedValue([
        { state: 'active', completeDate: null, endDate: '2025-06-15' }
      ]),
      readStorage: vi.fn().mockReturnValue({
        teams: [
          { boardId: 1, boardName: 'RHOAIENG - Shared Board', displayName: 'Alpha', teamId: '1_alpha', sprintFilter: 'Alpha', enabled: true, stale: true, manuallyConfigured: true },
          { boardId: 1, boardName: 'RHOAIENG - Shared Board', displayName: 'Beta', teamId: '1_beta', sprintFilter: 'Beta', enabled: true, stale: true, manuallyConfigured: true }
        ]
      })
    });

    await discoverBoards(deps);

    const teamsCall = deps.writeStorage.mock.calls.find(c => c[0] === 'teams.json');
    const teams = teamsCall[1].teams;
    // Both entries should have updated staleness (not stale since active sprint exists)
    expect(teams.find(t => t.teamId === '1_alpha').stale).toBe(false);
    expect(teams.find(t => t.teamId === '1_beta').stale).toBe(false);
  });

  it('handles sprint fetch errors gracefully', async () => {
    const deps = makeDeps({
      fetchBoards: scrumOnlyFetchBoards([
        { id: 1, name: 'Board A' }
      ]),
      fetchSprints: vi.fn().mockRejectedValue(new Error('Network error'))
    });

    const result = await discoverBoards(deps);

    expect(result.success).toBe(true);
    // Board should not be stale on error
    const teamsCall = deps.writeStorage.mock.calls.find(c => c[0] === 'teams.json');
    expect(teamsCall[1].teams[0].stale).toBe(false);
  });
});

describe('performRefresh', () => {
  it('processes enabled boards and generates dashboard summary', async () => {
    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null }
      ]),
      fetchSprintIssues: vi.fn().mockResolvedValue([
        { key: 'P-1', summary: 'Bug', issueType: 'Bug', activityType: 'Tech Debt & Quality', storyPoints: 3, resolution: { name: 'Done' } }
      ]),
      readStorage: vi.fn().mockImplementation((key) => {
        if (key === 'teams.json') {
          return {
            teams: [{ boardId: 1, boardName: 'Board A', enabled: true }]
          };
        }
        return null;
      })
    });

    const result = await performRefresh({ ...deps, hardRefresh: false });

    expect(result.success).toBe(true);
    expect(result.boardCount).toBe(1);
    expect(result.sprintCount).toBe(1);

    // Sprint data written
    const sprintCall = deps.writeStorage.mock.calls.find(c => c[0] === 'sprints/100.json');
    expect(sprintCall).toBeDefined();
    expect(sprintCall[1].issues[0].bucket).toBe('tech-debt-quality');

    // Dashboard summary written
    const dashCall = deps.writeStorage.mock.calls.find(c => c[0] === 'dashboard-summary.json');
    expect(dashCall).toBeDefined();
    expect(dashCall[1].boards['1']).toBeDefined();
  });

  it('skips disabled boards', async () => {
    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null }
      ]),
      fetchSprintIssues: vi.fn().mockResolvedValue([]),
      readStorage: vi.fn().mockImplementation((key) => {
        if (key === 'teams.json') {
          return {
            teams: [
              { boardId: 1, enabled: true },
              { boardId: 2, enabled: false }
            ]
          };
        }
        return null;
      })
    });

    const result = await performRefresh({ ...deps, hardRefresh: false });

    expect(result.boardCount).toBe(1);
    // fetchSprints should only be called for board 1
    expect(deps.fetchSprints).toHaveBeenCalledTimes(1);
    expect(deps.fetchSprints).toHaveBeenCalledWith(1);
  });

  it('uses cached data for closed sprints when not hard refresh', async () => {
    const cachedSprint = {
      issues: [{ key: 'P-1' }],
      summary: { totalPoints: 5, buckets: {} }
    };

    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 100, name: 'Sprint 1', state: 'closed', startDate: '2025-05-01', endDate: '2025-05-14', completeDate: '2025-05-15' }
      ]),
      readStorage: vi.fn().mockImplementation((key) => {
        if (key === 'sprints/100.json') return cachedSprint;
        return null;
      })
    });

    await performRefresh({ ...deps, hardRefresh: false });

    // Should NOT call fetchSprintIssues since sprint is cached
    expect(deps.fetchSprintIssues).not.toHaveBeenCalled();
  });

  it('re-fetches closed sprints on hard refresh', async () => {
    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 100, name: 'Sprint 1', state: 'closed', startDate: '2025-05-01', endDate: '2025-05-14', completeDate: '2025-05-15' }
      ]),
      fetchSprintIssues: vi.fn().mockResolvedValue([]),
      readStorage: vi.fn().mockImplementation((key) => {
        if (key === 'teams.json') {
          return {
            teams: [{ boardId: 1, boardName: 'Board A', enabled: true }]
          };
        }
        if (key === 'sprints/100.json') return { issues: [], summary: {} };
        return null;
      })
    });

    await performRefresh({ ...deps, hardRefresh: true });

    expect(deps.fetchSprintIssues).toHaveBeenCalledWith(100);
  });

  it('passes teamId and sprintFilter from teams.json to processBoard', async () => {
    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 100, name: 'Alpha Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null }
      ]),
      fetchSprintIssues: vi.fn().mockResolvedValue([]),
      readStorage: vi.fn().mockImplementation((key) => {
        if (key === 'teams.json') {
          return {
            teams: [{
              boardId: 1,
              boardName: 'Board A',
              enabled: true,
              teamId: '1_alpha',
              sprintFilter: 'Alpha',
              calculationMode: 'counts'
            }]
          };
        }
        return null;
      })
    });

    await performRefresh({ ...deps, hardRefresh: false });

    // Sprint index should use teamId key
    const indexCall = deps.writeStorage.mock.calls.find(c => c[0] === 'sprints/team-1_alpha.json');
    expect(indexCall).toBeDefined();

    // Dashboard summary should use teamId as key
    const dashCall = deps.writeStorage.mock.calls.find(c => c[0] === 'dashboard-summary.json');
    expect(dashCall).toBeDefined();
    expect(dashCall[1].boards['1_alpha']).toBeDefined();
  });

  it('defaults teamId to String(boardId) when not set in teams.json', async () => {
    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null }
      ]),
      fetchSprintIssues: vi.fn().mockResolvedValue([]),
      readStorage: vi.fn().mockImplementation((key) => {
        if (key === 'teams.json') {
          return {
            teams: [{ boardId: 1, boardName: 'Board A', enabled: true }]
          };
        }
        return null;
      })
    });

    await performRefresh({ ...deps, hardRefresh: false });

    // Dashboard summary should use string boardId as key
    const dashCall = deps.writeStorage.mock.calls.find(c => c[0] === 'dashboard-summary.json');
    expect(dashCall[1].boards['1']).toBeDefined();
  });

  it('continues processing remaining boards when one board fails', async () => {
    const deps = makeDeps({
      fetchSprints: vi.fn().mockImplementation((boardId) => {
        if (boardId === 1) throw new Error('Jira API timeout');
        return Promise.resolve([]);
      }),
      fetchSprintIssues: vi.fn().mockResolvedValue([]),
      fetchBoardConfiguration: vi.fn().mockResolvedValue({ filterId: '555' }),
      fetchFilterJql: vi.fn().mockResolvedValue('project = PROJ'),
      fetchIssuesByJql: vi.fn().mockResolvedValue([
        { key: 'P-1', summary: 'Bug', issueType: 'Bug', activityType: 'Tech Debt & Quality', storyPoints: 3, resolution: 'Done', resolutionDate: '2025-01-10' }
      ]),
      readStorage: vi.fn().mockImplementation((key) => {
        if (key === 'teams.json') {
          return {
            teams: [
              { boardId: 1, boardName: 'Failing Board', enabled: true, boardType: 'scrum' },
              { boardId: 20, boardName: 'Kanban Board', enabled: true, boardType: 'kanban', teamId: 'kanban-20' }
            ]
          };
        }
        return null;
      })
    });

    const result = await performRefresh({ ...deps, hardRefresh: false });

    // Should still succeed overall
    expect(result.success).toBe(true);
    // Only 1 board succeeded (the kanban one)
    expect(result.boardCount).toBe(1);
    // Dashboard summary should have the successful board
    const dashCall = deps.writeStorage.mock.calls.find(c => c[0] === 'dashboard-summary.json');
    expect(dashCall).toBeDefined();
    expect(dashCall[1].boards['kanban-20']).toBeDefined();
  });

  it('processes zero boards when teams.json is missing', async () => {
    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([]),
      readStorage: vi.fn().mockReturnValue(null)
    });

    const result = await performRefresh({ ...deps, hardRefresh: false });

    expect(result.success).toBe(true);
    expect(result.boardCount).toBe(0);
    // Should not call fetchSprints since no boards are configured
    expect(deps.fetchSprints).not.toHaveBeenCalled();
  });

  it('writes board sprint index', async () => {
    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null }
      ]),
      fetchSprintIssues: vi.fn().mockResolvedValue([]),
      readStorage: vi.fn().mockImplementation((key) => {
        if (key === 'teams.json') {
          return {
            teams: [{ boardId: 1, boardName: 'Board A', enabled: true }]
          };
        }
        return null;
      })
    });

    await performRefresh({ ...deps, hardRefresh: false });

    const indexCall = deps.writeStorage.mock.calls.find(c => c[0] === 'sprints/team-1.json');
    expect(indexCall).toBeDefined();
    expect(indexCall[1].sprints).toHaveLength(1);
    expect(indexCall[1].sprints[0].id).toBe(100);
  });
});

describe('processBoard', () => {
  it('processes a single board and returns dashboard sprint result', async () => {
    const readStorage = vi.fn().mockReturnValue(null);
    const writeStorage = vi.fn();
    const fetchSprints = vi.fn().mockResolvedValue([
      { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null }
    ]);
    const fetchSprintIssues = vi.fn().mockResolvedValue([
      { key: 'P-1', summary: 'Bug', issueType: 'Bug', activityType: 'Tech Debt & Quality', storyPoints: 3, resolution: { name: 'Done' } }
    ]);

    const result = await processBoard({
      board: { id: 1, name: 'Board A' },
      hardRefresh: false,
      fetchSprints,
      fetchSprintIssues,
      readStorage,
      writeStorage
    });

    expect(result.board.id).toBe(1);
    expect(result.sprintResults).toHaveLength(1);
    expect(result.dashboardSprint).toBeDefined();
    expect(result.dashboardSprintResult.summary.totalPoints).toBe(3);

    // Sprint data written
    const sprintCall = writeStorage.mock.calls.find(c => c[0] === 'sprints/100.json');
    expect(sprintCall).toBeDefined();
  });

  it('filters out Sub-task issue types', async () => {
    const readStorage = vi.fn().mockReturnValue(null);
    const writeStorage = vi.fn();
    const fetchSprints = vi.fn().mockResolvedValue([
      { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null }
    ]);
    const fetchSprintIssues = vi.fn().mockResolvedValue([
      { key: 'P-1', summary: 'Task', issueType: 'Task', activityType: 'New Features', storyPoints: 5, resolution: null },
      { key: 'P-2', summary: 'Subtask', issueType: 'Sub-task', activityType: 'New Features', storyPoints: 2, resolution: null },
      { key: 'P-3', summary: 'Bug', issueType: 'Bug', activityType: 'Tech Debt & Quality', storyPoints: 3, resolution: null }
    ]);

    const result = await processBoard({
      board: { id: 1, name: 'Board A' },
      hardRefresh: false,
      fetchSprints,
      fetchSprintIssues,
      readStorage,
      writeStorage
    });

    // Only 2 issues should be processed (Sub-task excluded)
    expect(result.dashboardSprintResult.summary.totalPoints).toBe(8);
    expect(result.dashboardSprintResult.issueCount).toBe(2);

    const sprintCall = writeStorage.mock.calls.find(c => c[0] === 'sprints/100.json');
    expect(sprintCall[1].issues).toHaveLength(2);
    expect(sprintCall[1].issues.find(i => i.issueType === 'Sub-task')).toBeUndefined();
  });

  it('filters out Epic and Initiative issue types', async () => {
    const readStorage = vi.fn().mockReturnValue(null);
    const writeStorage = vi.fn();
    const fetchSprints = vi.fn().mockResolvedValue([
      { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null }
    ]);
    const fetchSprintIssues = vi.fn().mockResolvedValue([
      { key: 'P-1', summary: 'Story', issueType: 'Story', activityType: 'New Features', storyPoints: 5, resolution: null },
      { key: 'P-2', summary: 'Epic', issueType: 'Epic', activityType: 'New Features', storyPoints: 50, resolution: null },
      { key: 'P-3', summary: 'Initiative', issueType: 'Initiative', activityType: 'New Features', storyPoints: 100, resolution: null }
    ]);

    const result = await processBoard({
      board: { id: 1, name: 'Board A' },
      hardRefresh: false,
      fetchSprints,
      fetchSprintIssues,
      readStorage,
      writeStorage
    });

    // Only Story should be processed
    expect(result.dashboardSprintResult.summary.totalPoints).toBe(5);
    expect(result.dashboardSprintResult.issueCount).toBe(1);

    const sprintCall = writeStorage.mock.calls.find(c => c[0] === 'sprints/100.json');
    expect(sprintCall[1].issues).toHaveLength(1);
    expect(sprintCall[1].issues[0].issueType).toBe('Story');
  });

  it('includes all allowed issue types', async () => {
    const readStorage = vi.fn().mockReturnValue(null);
    const writeStorage = vi.fn();
    const fetchSprints = vi.fn().mockResolvedValue([
      { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null }
    ]);
    const fetchSprintIssues = vi.fn().mockResolvedValue([
      { key: 'P-1', summary: 'Bug', issueType: 'Bug', activityType: 'Tech Debt & Quality', storyPoints: 1, resolution: null },
      { key: 'P-2', summary: 'Task', issueType: 'Task', activityType: 'New Features', storyPoints: 2, resolution: null },
      { key: 'P-3', summary: 'Story', issueType: 'Story', activityType: 'New Features', storyPoints: 3, resolution: null },
      { key: 'P-4', summary: 'Spike', issueType: 'Spike', activityType: 'Learning & Enablement', storyPoints: 4, resolution: null },
      { key: 'P-5', summary: 'Vuln', issueType: 'Vulnerability', activityType: 'Tech Debt & Quality', storyPoints: 5, resolution: null },
      { key: 'P-6', summary: 'Weak', issueType: 'Weakness', activityType: 'Tech Debt & Quality', storyPoints: 6, resolution: null }
    ]);

    const result = await processBoard({
      board: { id: 1, name: 'Board A' },
      hardRefresh: false,
      fetchSprints,
      fetchSprintIssues,
      readStorage,
      writeStorage
    });

    // All 6 allowed types should be included
    expect(result.dashboardSprintResult.summary.totalPoints).toBe(21);
    expect(result.dashboardSprintResult.issueCount).toBe(6);

    const sprintCall = writeStorage.mock.calls.find(c => c[0] === 'sprints/100.json');
    expect(sprintCall[1].issues).toHaveLength(6);
  });

  it('filters sprints by name when board.sprintFilter is set', async () => {
    const readStorage = vi.fn().mockReturnValue(null);
    const writeStorage = vi.fn();
    const fetchSprints = vi.fn().mockResolvedValue([
      { id: 100, name: 'Team Alpha Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null },
      { id: 101, name: 'Team Beta Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null },
      { id: 102, name: 'Team Alpha Sprint 2', state: 'closed', startDate: '2025-05-01', endDate: '2025-05-14', completeDate: '2025-05-15' }
    ]);
    const fetchSprintIssues = vi.fn().mockResolvedValue([]);

    const result = await processBoard({
      board: { id: 1, name: 'Board A', sprintFilter: 'Team Alpha' },
      hardRefresh: false,
      fetchSprints,
      fetchSprintIssues,
      readStorage,
      writeStorage
    });

    // Should only process Team Alpha sprints (100, 102), not Team Beta (101)
    expect(result.sprintResults).toHaveLength(2);
    expect(result.sprintResults.map(r => r.sprintName)).toEqual(
      expect.arrayContaining(['Team Alpha Sprint 1', 'Team Alpha Sprint 2'])
    );
    expect(result.sprintResults.map(r => r.sprintName)).not.toContain('Team Beta Sprint 1');
  });

  it('sprint filter is case-insensitive', async () => {
    const readStorage = vi.fn().mockReturnValue(null);
    const writeStorage = vi.fn();
    const fetchSprints = vi.fn().mockResolvedValue([
      { id: 100, name: 'TEAM ALPHA Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null },
      { id: 101, name: 'team beta Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null }
    ]);
    const fetchSprintIssues = vi.fn().mockResolvedValue([]);

    const result = await processBoard({
      board: { id: 1, name: 'Board A', sprintFilter: 'team alpha' },
      hardRefresh: false,
      fetchSprints,
      fetchSprintIssues,
      readStorage,
      writeStorage
    });

    expect(result.sprintResults).toHaveLength(1);
    expect(result.sprintResults[0].sprintName).toBe('TEAM ALPHA Sprint 1');
  });

  it('writes sprint index using teamId when provided', async () => {
    const readStorage = vi.fn().mockReturnValue(null);
    const writeStorage = vi.fn();
    const fetchSprints = vi.fn().mockResolvedValue([
      { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null }
    ]);
    const fetchSprintIssues = vi.fn().mockResolvedValue([]);

    await processBoard({
      board: { id: 1, name: 'Board A', teamId: '1_team-alpha', sprintFilter: 'Team Alpha' },
      hardRefresh: false,
      fetchSprints,
      fetchSprintIssues,
      readStorage,
      writeStorage
    });

    const indexCall = writeStorage.mock.calls.find(c => c[0] === 'sprints/team-1_team-alpha.json');
    expect(indexCall).toBeDefined();
    // Should NOT write old-style key
    const oldCall = writeStorage.mock.calls.find(c => c[0] === 'sprints/board-1.json');
    expect(oldCall).toBeUndefined();
  });

  it('falls back to board.id for sprint index when no teamId', async () => {
    const readStorage = vi.fn().mockReturnValue(null);
    const writeStorage = vi.fn();
    const fetchSprints = vi.fn().mockResolvedValue([
      { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null }
    ]);
    const fetchSprintIssues = vi.fn().mockResolvedValue([]);

    await processBoard({
      board: { id: 1, name: 'Board A' },
      hardRefresh: false,
      fetchSprints,
      fetchSprintIssues,
      readStorage,
      writeStorage
    });

    const indexCall = writeStorage.mock.calls.find(c => c[0] === 'sprints/team-1.json');
    expect(indexCall).toBeDefined();
  });

  it('does not filter sprints when sprintFilter is empty', async () => {
    const readStorage = vi.fn().mockReturnValue(null);
    const writeStorage = vi.fn();
    const fetchSprints = vi.fn().mockResolvedValue([
      { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null },
      { id: 101, name: 'Sprint 2', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null }
    ]);
    const fetchSprintIssues = vi.fn().mockResolvedValue([]);

    const result = await processBoard({
      board: { id: 1, name: 'Board A', sprintFilter: '' },
      hardRefresh: false,
      fetchSprints,
      fetchSprintIssues,
      readStorage,
      writeStorage
    });

    expect(result.sprintResults).toHaveLength(2);
  });

  it('uses cached closed sprint data when not hard refresh', async () => {
    const cachedSprint = {
      issues: [{ key: 'P-1' }],
      summary: { totalPoints: 5, buckets: {} }
    };
    const readStorage = vi.fn().mockImplementation((key) => {
      if (key === 'sprints/100.json') return cachedSprint;
      return null;
    });
    const writeStorage = vi.fn();
    const fetchSprints = vi.fn().mockResolvedValue([
      { id: 100, name: 'Sprint 1', state: 'closed', startDate: '2025-05-01', endDate: '2025-05-14', completeDate: '2025-05-15' }
    ]);
    const fetchSprintIssues = vi.fn();

    await processBoard({
      board: { id: 1, name: 'Board A' },
      hardRefresh: false,
      fetchSprints,
      fetchSprintIssues,
      readStorage,
      writeStorage
    });

    expect(fetchSprintIssues).not.toHaveBeenCalled();
  });
});

describe('performMultiProjectRefresh', () => {
  it('processes multiple projects and writes rollup summaries', async () => {
    const readStorage = vi.fn().mockImplementation((key) => {
      // Both projects have teams.json with one board each
      if (key === 'data/PROJ1/teams.json' || key === 'data/PROJ2/teams.json') {
        return {
          teams: [{ boardId: 1, boardName: 'Board A', enabled: true }]
        };
      }
      return null;
    });
    const writeStorage = vi.fn();
    const fetchBoards = vi.fn().mockResolvedValue([
      { id: 1, name: 'Board A' }
    ]);
    const fetchSprints = vi.fn().mockResolvedValue([
      { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null }
    ]);
    const fetchSprintIssues = vi.fn().mockResolvedValue([
      { key: 'P-1', summary: 'Bug', issueType: 'Bug', activityType: 'Tech Debt & Quality', storyPoints: 3, resolution: null }
    ]);

    const result = await performMultiProjectRefresh({
      projects: [
        { key: 'PROJ1', name: 'Project 1' },
        { key: 'PROJ2', name: 'Project 2' }
      ],
      hardRefresh: false,
      fetchBoards,
      fetchSprints,
      fetchSprintIssues,
      readStorage,
      writeStorage
    });

    expect(result.success).toBe(true);
    expect(result.projects).toHaveLength(2);

    // Each project writes its dashboard summary with prefixed keys
    const proj1DashCall = writeStorage.mock.calls.find(c => c[0] === 'data/PROJ1/dashboard-summary.json');
    expect(proj1DashCall).toBeDefined();
    const proj2DashCall = writeStorage.mock.calls.find(c => c[0] === 'data/PROJ2/dashboard-summary.json');
    expect(proj2DashCall).toBeDefined();

    // Org summary written
    const orgSummaryCall = writeStorage.mock.calls.find(c => c[0] === 'data/org-summary.json');
    expect(orgSummaryCall).toBeDefined();
    expect(orgSummaryCall[1].projectCount).toBe(2);
  });

  it('writes per-project summary files', async () => {
    const readStorage = vi.fn().mockImplementation((key) => {
      if (key === 'data/PROJ1/teams.json') {
        return {
          teams: [{ boardId: 1, boardName: 'Board A', enabled: true }]
        };
      }
      return null;
    });
    const writeStorage = vi.fn();
    const fetchBoards = vi.fn().mockResolvedValue([
      { id: 1, name: 'Board A' }
    ]);
    const fetchSprints = vi.fn().mockResolvedValue([
      { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null }
    ]);
    const fetchSprintIssues = vi.fn().mockResolvedValue([
      { key: 'P-1', summary: 'Feature', issueType: 'Story', activityType: 'New Features', storyPoints: 5, resolution: null }
    ]);

    await performMultiProjectRefresh({
      projects: [{ key: 'PROJ1', name: 'Project 1' }],
      hardRefresh: false,
      fetchBoards,
      fetchSprints,
      fetchSprintIssues,
      readStorage,
      writeStorage
    });

    // Project-level dashboard summary written
    const projSummaryCall = writeStorage.mock.calls.find(c => c[0] === 'data/PROJ1/dashboard-summary.json');
    expect(projSummaryCall).toBeDefined();
    expect(projSummaryCall[1].boards).toBeDefined();
  });

  it('continues processing if one project fails', async () => {
    // Simulate one project failing by making readStorage throw for the first project
    const readStorage = vi.fn().mockImplementation((key) => {
      if (key.startsWith('data/FAIL_PROJ/')) {
        throw new Error('Storage corrupted');
      }
      if (key === 'data/OK_PROJ/teams.json') {
        return {
          teams: [{ boardId: 1, boardName: 'Board A', enabled: true }]
        };
      }
      return null;
    });
    const writeStorage = vi.fn();
    const fetchBoards = vi.fn().mockResolvedValue([]);
    const fetchSprints = vi.fn().mockResolvedValue([]);
    const fetchSprintIssues = vi.fn().mockResolvedValue([]);

    const result = await performMultiProjectRefresh({
      projects: [
        { key: 'FAIL_PROJ', name: 'Will Fail' },
        { key: 'OK_PROJ', name: 'Will Succeed' }
      ],
      hardRefresh: false,
      fetchBoards,
      fetchSprints,
      fetchSprintIssues,
      readStorage,
      writeStorage
    });

    expect(result.success).toBe(true);
    expect(result.projects).toHaveLength(2);
    expect(result.projects[0].success).toBe(false);
    expect(result.projects[1].success).toBe(true);
  });

  it('uses getDeps when provided instead of default prefix logic', async () => {
    const customRead = vi.fn().mockImplementation((key) => {
      if (key === 'teams.json') return { teams: [{ boardId: 1, boardName: 'Board A', enabled: true }] };
      return null;
    });
    const customWrite = vi.fn();
    const getDeps = vi.fn().mockReturnValue({ readStorage: customRead, writeStorage: customWrite });

    const defaultReadStorage = vi.fn();
    const defaultWriteStorage = vi.fn();

    await performMultiProjectRefresh({
      projects: [{ key: 'LEGACY', name: 'Legacy Project' }],
      hardRefresh: false,
      getDeps,
      fetchSprints: vi.fn().mockResolvedValue([]),
      fetchSprintIssues: vi.fn().mockResolvedValue([]),
      readStorage: defaultReadStorage,
      writeStorage: defaultWriteStorage
    });

    expect(getDeps).toHaveBeenCalledWith('LEGACY');
    expect(customRead).toHaveBeenCalledWith('teams.json');
    expect(defaultReadStorage).not.toHaveBeenCalled();
  });
});

describe('processKanbanBoard', () => {
  function makeKanbanDeps(overrides = {}) {
    return {
      board: { id: 10, name: 'Kanban Board', teamId: 'kanban-10' },
      fetchBoardConfiguration: vi.fn().mockResolvedValue({ filterId: '555' }),
      fetchFilterJql: vi.fn().mockResolvedValue('project = PROJ AND type in (Bug, Story)'),
      fetchIssuesByJql: vi.fn().mockResolvedValue([]),
      readStorage: vi.fn().mockReturnValue(null),
      writeStorage: vi.fn(),
      ...overrides
    };
  }

  it('fetches board config, filter JQL, and issues', async () => {
    const deps = makeKanbanDeps({
      fetchIssuesByJql: vi.fn().mockResolvedValue([
        { key: 'P-1', summary: 'Bug', issueType: 'Bug', activityType: 'Tech Debt & Quality', storyPoints: 3, resolution: 'Done', resolutionDate: '2025-01-10' }
      ])
    });

    await processKanbanBoard(deps);

    expect(deps.fetchBoardConfiguration).toHaveBeenCalledWith(10);
    expect(deps.fetchFilterJql).toHaveBeenCalledWith('555');
    expect(deps.fetchIssuesByJql).toHaveBeenCalledWith(
      expect.stringContaining('project = PROJ AND type in (Bug, Story)')
    );
    expect(deps.fetchIssuesByJql).toHaveBeenCalledWith(
      expect.stringContaining('resolved >= -2w')
    );
  });

  it('strips ORDER BY from base JQL before appending date constraint', async () => {
    const deps = makeKanbanDeps({
      fetchFilterJql: vi.fn().mockResolvedValue('project = PROJ AND component = "Notebooks" ORDER BY Priority DESC'),
      fetchIssuesByJql: vi.fn().mockResolvedValue([])
    });

    await processKanbanBoard(deps);

    const jqlArg = deps.fetchIssuesByJql.mock.calls[0][0];
    // Should NOT have nested ORDER BY
    expect(jqlArg).not.toMatch(/ORDER BY.*ORDER BY/i);
    // Should have the stripped base JQL wrapped in parens
    expect(jqlArg).toContain('(project = PROJ AND component = "Notebooks")');
    // Should end with our ORDER BY
    expect(jqlArg).toMatch(/ORDER BY resolved DESC$/);
    // Should include the date constraint
    expect(jqlArg).toContain('resolved >= -2w');
  });

  it('creates a synthetic sprint with "Last 2 weeks" name', async () => {
    const deps = makeKanbanDeps();
    const result = await processKanbanBoard(deps);

    expect(result.dashboardSprint.name).toBe('Last 2 weeks');
    expect(result.dashboardSprint.state).toBe('active');
    expect(result.dashboardSprint.id).toBe('kanban-10');
  });

  it('writes sprint data and team index to storage', async () => {
    const deps = makeKanbanDeps({
      fetchIssuesByJql: vi.fn().mockResolvedValue([
        { key: 'P-1', summary: 'Bug', issueType: 'Bug', activityType: 'Tech Debt & Quality', storyPoints: 3, resolution: 'Done', resolutionDate: '2025-01-10' }
      ])
    });

    await processKanbanBoard(deps);

    const sprintCall = deps.writeStorage.mock.calls.find(c => c[0] === 'sprints/kanban-10.json');
    expect(sprintCall).toBeDefined();
    expect(sprintCall[1].issues).toHaveLength(1);
    expect(sprintCall[1].issues[0].bucket).toBe('tech-debt-quality');

    const indexCall = deps.writeStorage.mock.calls.find(c => c[0] === 'sprints/team-kanban-10.json');
    expect(indexCall).toBeDefined();
    expect(indexCall[1].sprints).toHaveLength(1);
    expect(indexCall[1].sprints[0].name).toBe('Last 2 weeks');
  });

  it('filters out disallowed issue types', async () => {
    const deps = makeKanbanDeps({
      fetchIssuesByJql: vi.fn().mockResolvedValue([
        { key: 'P-1', summary: 'Bug', issueType: 'Bug', activityType: 'Tech Debt & Quality', storyPoints: 3, resolution: 'Done', resolutionDate: '2025-01-10' },
        { key: 'P-2', summary: 'Epic', issueType: 'Epic', activityType: 'New Features', storyPoints: 50, resolution: null, resolutionDate: null },
        { key: 'P-3', summary: 'Subtask', issueType: 'Sub-task', activityType: null, storyPoints: 1, resolution: null, resolutionDate: null }
      ])
    });

    const result = await processKanbanBoard(deps);

    expect(result.dashboardSprintResult.issueCount).toBe(1);
    expect(result.dashboardSprintResult.summary.totalPoints).toBe(3);
  });

  it('returns same shape as processBoard', async () => {
    const deps = makeKanbanDeps();
    const result = await processKanbanBoard(deps);

    expect(result).toHaveProperty('board');
    expect(result).toHaveProperty('sprintResults');
    expect(result).toHaveProperty('dashboardSprint');
    expect(result).toHaveProperty('dashboardSprintResult');
    expect(result.board.id).toBe(10);
  });

  it('uses board.calculationMode', async () => {
    const deps = makeKanbanDeps({
      board: { id: 10, name: 'Kanban Board', teamId: 'kanban-10', calculationMode: 'counts' },
      fetchIssuesByJql: vi.fn().mockResolvedValue([
        { key: 'P-1', summary: 'Bug', issueType: 'Bug', activityType: 'Tech Debt & Quality', storyPoints: 3, resolution: 'Done', resolutionDate: '2025-01-10' },
        { key: 'P-2', summary: 'Story', issueType: 'Story', activityType: 'New Features', storyPoints: 5, resolution: 'Done', resolutionDate: '2025-01-11' }
      ])
    });

    const result = await processKanbanBoard(deps);

    // totalPoints always holds sum of story points; calculationMode affects percentages only
    expect(result.dashboardSprintResult.summary.totalPoints).toBe(8);
    expect(result.dashboardSprintResult.summary.calculationMode).toBe('counts');
  });
});

describe('discoverBoards with kanban', () => {
  it('discovers both scrum and kanban boards', async () => {
    const deps = makeDeps({
      fetchBoards: vi.fn().mockImplementation((projectKey, boardType) => {
        if (boardType === 'kanban') {
          return Promise.resolve([{ id: 20, name: 'Kanban Board', type: 'kanban' }]);
        }
        return Promise.resolve([{ id: 1, name: 'Scrum Board', type: 'scrum' }]);
      }),
      fetchSprints: vi.fn().mockResolvedValue([
        { state: 'active', completeDate: null, endDate: '2025-06-15' }
      ])
    });

    const result = await discoverBoards(deps);

    expect(result.boardCount).toBe(2);
    const teamsCall = deps.writeStorage.mock.calls.find(c => c[0] === 'teams.json');
    const teams = teamsCall[1].teams;
    expect(teams).toHaveLength(2);
    expect(teams.find(t => t.boardType === 'kanban')).toBeDefined();
    expect(teams.find(t => t.boardType === 'scrum')).toBeDefined();
  });

  it('skips staleness check for kanban boards', async () => {
    const deps = makeDeps({
      fetchBoards: vi.fn().mockImplementation((projectKey, boardType) => {
        if (boardType === 'kanban') {
          return Promise.resolve([{ id: 20, name: 'Kanban Board', type: 'kanban' }]);
        }
        return Promise.resolve([]);
      }),
      fetchSprints: vi.fn()
    });

    await discoverBoards(deps);

    // fetchSprints should NOT be called for kanban boards
    expect(deps.fetchSprints).not.toHaveBeenCalled();

    const teamsCall = deps.writeStorage.mock.calls.find(c => c[0] === 'teams.json');
    const kanbanTeam = teamsCall[1].teams.find(t => t.boardType === 'kanban');
    expect(kanbanTeam.stale).toBe(false);
    // New kanban boards default to disabled until explicitly enabled
    expect(kanbanTeam.enabled).toBe(false);
  });

  it('preserves existing kanban team config', async () => {
    const deps = makeDeps({
      fetchBoards: vi.fn().mockImplementation((projectKey, boardType) => {
        if (boardType === 'kanban') {
          return Promise.resolve([{ id: 20, name: 'Kanban Board', type: 'kanban' }]);
        }
        return Promise.resolve([]);
      }),
      fetchSprints: vi.fn(),
      readStorage: vi.fn().mockReturnValue({
        teams: [{
          boardId: 20,
          boardName: 'Kanban Board',
          displayName: 'Custom Kanban',
          enabled: false,
          boardType: 'kanban',
          manuallyConfigured: true
        }]
      })
    });

    await discoverBoards(deps);

    const teamsCall = deps.writeStorage.mock.calls.find(c => c[0] === 'teams.json');
    const kanbanTeam = teamsCall[1].teams.find(t => t.boardId === 20);
    expect(kanbanTeam.displayName).toBe('Custom Kanban');
    expect(kanbanTeam.boardType).toBe('kanban');
  });
});

describe('performRefresh with kanban', () => {
  it('dispatches kanban boards to processKanbanBoard', async () => {
    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([]),
      fetchSprintIssues: vi.fn().mockResolvedValue([]),
      fetchBoardConfiguration: vi.fn().mockResolvedValue({ filterId: '555' }),
      fetchFilterJql: vi.fn().mockResolvedValue('project = PROJ'),
      fetchIssuesByJql: vi.fn().mockResolvedValue([]),
      readStorage: vi.fn().mockImplementation((key) => {
        if (key === 'teams.json') {
          return {
            teams: [
              { boardId: 1, boardName: 'Scrum Board', enabled: true, boardType: 'scrum' },
              { boardId: 20, boardName: 'Kanban Board', enabled: true, boardType: 'kanban' }
            ]
          };
        }
        return null;
      })
    });

    const result = await performRefresh({ ...deps, hardRefresh: false });

    expect(result.boardCount).toBe(2);
    // Kanban board should use fetchBoardConfiguration
    expect(deps.fetchBoardConfiguration).toHaveBeenCalledWith(20);
    // Scrum board should use fetchSprints
    expect(deps.fetchSprints).toHaveBeenCalledWith(1);
  });

  it('defaults boardType to scrum when not set in teams.json', async () => {
    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([
        { id: 100, name: 'Sprint 1', state: 'active', startDate: '2025-06-01', endDate: '2025-06-14', completeDate: null }
      ]),
      fetchSprintIssues: vi.fn().mockResolvedValue([]),
      readStorage: vi.fn().mockImplementation((key) => {
        if (key === 'teams.json') {
          return {
            teams: [{ boardId: 1, boardName: 'Board A', enabled: true }]
          };
        }
        return null;
      })
    });

    const result = await performRefresh({ ...deps, hardRefresh: false });

    // Should process as scrum (fetchSprints called, not fetchBoardConfiguration)
    expect(deps.fetchSprints).toHaveBeenCalledWith(1);
    expect(result.success).toBe(true);
  });

  it('includes kanban board results in dashboard summary', async () => {
    const deps = makeDeps({
      fetchSprints: vi.fn().mockResolvedValue([]),
      fetchSprintIssues: vi.fn().mockResolvedValue([]),
      fetchBoardConfiguration: vi.fn().mockResolvedValue({ filterId: '555' }),
      fetchFilterJql: vi.fn().mockResolvedValue('project = PROJ'),
      fetchIssuesByJql: vi.fn().mockResolvedValue([
        { key: 'P-1', summary: 'Bug', issueType: 'Bug', activityType: 'Tech Debt & Quality', storyPoints: 3, resolution: 'Done', resolutionDate: '2025-01-10' }
      ]),
      readStorage: vi.fn().mockImplementation((key) => {
        if (key === 'teams.json') {
          return {
            teams: [
              { boardId: 20, boardName: 'Kanban Board', enabled: true, boardType: 'kanban', teamId: 'kanban-20' }
            ]
          };
        }
        return null;
      })
    });

    await performRefresh({ ...deps, hardRefresh: false });

    const dashCall = deps.writeStorage.mock.calls.find(c => c[0] === 'dashboard-summary.json');
    expect(dashCall).toBeDefined();
    expect(dashCall[1].boards['kanban-20']).toBeDefined();
    expect(dashCall[1].boards['kanban-20'].sprint.name).toBe('Last 2 weeks');
  });
});
