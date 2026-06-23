// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { createJiraClient } from '../../../server/allocation/jira-client.js';

// Simulate the extraFields that the AI Eng strategy provides
const AI_ENG_EXTRA_FIELDS = {
  fieldIds: ['customfield_10464'],
  extract: (_issue, fields) => ({
    activityType: fields.customfield_10464?.value || null
  })
};

describe('createJiraClient', () => {
  const jiraHost = 'https://jira.example.com';

  describe('fetchBoards', () => {
    it('fetches all boards with pagination', async () => {
      const jiraRequest = vi.fn()
        .mockResolvedValueOnce({
          values: [
            { id: 1, name: 'Board A' },
            { id: 2, name: 'Board B' }
          ],
          isLast: false
        })
        .mockResolvedValueOnce({
          values: [{ id: 3, name: 'Board C' }],
          isLast: true
        });

      const client = createJiraClient({ jiraRequest, jiraHost });
      const boards = await client.fetchBoards('PROJ');

      expect(boards).toEqual([
        { id: 1, name: 'Board A', projectKey: 'PROJ', type: 'scrum' },
        { id: 2, name: 'Board B', projectKey: 'PROJ', type: 'scrum' },
        { id: 3, name: 'Board C', projectKey: 'PROJ', type: 'scrum' }
      ]);
      expect(jiraRequest).toHaveBeenCalledTimes(2);
      expect(jiraRequest.mock.calls[0][0]).toContain('projectKeyOrId=PROJ');
      expect(jiraRequest.mock.calls[0][0]).toContain('startAt=0');
      expect(jiraRequest.mock.calls[1][0]).toContain('startAt=50');
    });

    it('handles single page of results', async () => {
      const jiraRequest = vi.fn().mockResolvedValueOnce({
        values: [{ id: 1, name: 'Board A' }],
        isLast: true
      });

      const client = createJiraClient({ jiraRequest, jiraHost });
      const boards = await client.fetchBoards('PROJ');

      expect(boards).toEqual([{ id: 1, name: 'Board A', projectKey: 'PROJ', type: 'scrum' }]);
      expect(jiraRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchSprints', () => {
    it('fetches all sprints for a board with pagination', async () => {
      const jiraRequest = vi.fn().mockResolvedValueOnce({
        values: [
          { id: 100, name: 'Sprint 1', state: 'closed', startDate: '2025-01-01', endDate: '2025-01-14', completeDate: '2025-01-15' },
          { id: 101, name: 'Sprint 2', state: 'active', startDate: '2025-01-15', endDate: '2025-01-28', completeDate: null }
        ],
        isLast: true
      });

      const client = createJiraClient({ jiraRequest, jiraHost });
      const sprints = await client.fetchSprints(42);

      expect(sprints).toEqual([
        { id: 100, name: 'Sprint 1', state: 'closed', startDate: '2025-01-01', endDate: '2025-01-14', completeDate: '2025-01-15', boardId: 42 },
        { id: 101, name: 'Sprint 2', state: 'active', startDate: '2025-01-15', endDate: '2025-01-28', completeDate: null, boardId: 42 }
      ]);
      expect(jiraRequest.mock.calls[0][0]).toContain('/board/42/sprint');
    });

    it('normalizes missing dates to null', async () => {
      const jiraRequest = vi.fn().mockResolvedValueOnce({
        values: [{ id: 100, name: 'Sprint 1', state: 'future' }],
        isLast: true
      });

      const client = createJiraClient({ jiraRequest, jiraHost });
      const sprints = await client.fetchSprints(42);

      expect(sprints[0].startDate).toBeNull();
      expect(sprints[0].endDate).toBeNull();
      expect(sprints[0].completeDate).toBeNull();
    });
  });

  describe('fetchBoardConfiguration', () => {
    it('fetches filter ID from board configuration', async () => {
      const jiraRequest = vi.fn().mockResolvedValueOnce({
        filter: { id: '12345' },
        name: 'Board Config'
      });

      const client = createJiraClient({ jiraRequest, jiraHost });
      const result = await client.fetchBoardConfiguration(42);

      expect(result).toEqual({ filterId: '12345' });
      expect(jiraRequest).toHaveBeenCalledWith('/rest/agile/1.0/board/42/configuration');
    });
  });

  describe('fetchFilterJql', () => {
    it('fetches JQL from a filter using v3 API', async () => {
      const jiraRequest = vi.fn().mockResolvedValueOnce({
        id: '12345',
        name: 'My Filter',
        jql: 'project = PROJ AND type = Bug'
      });

      const client = createJiraClient({ jiraRequest, jiraHost });
      const result = await client.fetchFilterJql('12345');

      expect(result).toBe('project = PROJ AND type = Bug');
      expect(jiraRequest).toHaveBeenCalledWith('/rest/api/3/filter/12345');
    });
  });

  describe('fetchIssuesByJql', () => {
    it('fetches and transforms issues via POST to v3 search endpoint', async () => {
      const jiraRequest = vi.fn().mockResolvedValueOnce({
        issues: [
          {
            key: 'PROJ-1',
            fields: {
              summary: 'Fix bug',
              issuetype: { name: 'Bug' },
              status: { name: 'Done' },
              assignee: { displayName: 'Alice' },
              customfield_10028: 3,
              customfield_10464: { value: 'Tech Debt & Quality' },
              resolution: { name: 'Done' },
              resolutiondate: '2025-01-10'
            }
          }
        ],
        isLast: true
      });

      const client = createJiraClient({ jiraRequest, jiraHost, extraFields: AI_ENG_EXTRA_FIELDS });
      const issues = await client.fetchIssuesByJql('project = PROJ');

      expect(issues).toHaveLength(1);
      expect(issues[0]).toEqual({
        key: 'PROJ-1',
        summary: 'Fix bug',
        issueType: 'Bug',
        status: 'Done',
        assignee: 'Alice',
        storyPoints: 3,
        activityType: 'Tech Debt & Quality',
        resolution: 'Done',
        resolutionDate: '2025-01-10',
        url: 'https://jira.example.com/browse/PROJ-1'
      });
      expect(jiraRequest).toHaveBeenCalledWith(
        '/rest/api/3/search/jql',
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            jql: 'project = PROJ',
            maxResults: 100
          })
        })
      );
    });

    it('paginates using cursor-based nextPageToken', async () => {
      const jiraRequest = vi.fn()
        .mockResolvedValueOnce({
          issues: [{ key: 'PROJ-1', fields: { summary: 'A', issuetype: { name: 'Bug' }, status: { name: 'Done' }, assignee: null, customfield_10028: null, resolution: null, resolutiondate: null } }],
          nextPageToken: 'token-page-2',
          isLast: false
        })
        .mockResolvedValueOnce({
          issues: [{ key: 'PROJ-2', fields: { summary: 'B', issuetype: { name: 'Story' }, status: { name: 'Done' }, assignee: null, customfield_10028: null, resolution: null, resolutiondate: null } }],
          isLast: true
        });

      const client = createJiraClient({ jiraRequest, jiraHost });
      const issues = await client.fetchIssuesByJql('project = PROJ');

      expect(issues).toHaveLength(2);
      expect(jiraRequest).toHaveBeenCalledTimes(2);
      expect(jiraRequest.mock.calls[0][1].body).not.toHaveProperty('nextPageToken');
      expect(jiraRequest.mock.calls[1][1].body.nextPageToken).toBe('token-page-2');
    });

    it('terminates when isLast is true', async () => {
      const jiraRequest = vi.fn().mockResolvedValueOnce({
        issues: [{ key: 'PROJ-1', fields: { summary: 'A', issuetype: { name: 'Bug' }, status: { name: 'Done' }, assignee: null, customfield_10028: null, resolution: null, resolutiondate: null } }],
        isLast: true,
        nextPageToken: 'should-not-be-used'
      });

      const client = createJiraClient({ jiraRequest, jiraHost });
      const issues = await client.fetchIssuesByJql('project = PROJ');

      expect(issues).toHaveLength(1);
      expect(jiraRequest).toHaveBeenCalledTimes(1);
    });

    it('terminates when nextPageToken is absent (no isLast field)', async () => {
      const jiraRequest = vi.fn().mockResolvedValueOnce({
        issues: [{ key: 'PROJ-1', fields: { summary: 'A', issuetype: { name: 'Bug' }, status: { name: 'Done' }, assignee: null, customfield_10028: null, resolution: null, resolutiondate: null } }]
      });

      const client = createJiraClient({ jiraRequest, jiraHost });
      const issues = await client.fetchIssuesByJql('project = PROJ');

      expect(issues).toHaveLength(1);
      expect(jiraRequest).toHaveBeenCalledTimes(1);
    });

    it('requests extra fields when strategy provides them', async () => {
      const jiraRequest = vi.fn().mockResolvedValueOnce({
        issues: [],
        isLast: true
      });

      const client = createJiraClient({ jiraRequest, jiraHost, extraFields: AI_ENG_EXTRA_FIELDS });
      await client.fetchIssuesByJql('project = PROJ');

      const body = jiraRequest.mock.calls[0][1].body;
      expect(body.fields).toContain('customfield_10028');
      expect(body.fields).toContain('customfield_10464');
      expect(body.fields).toContain('resolution');
      expect(body.fields).toContain('resolutiondate');
    });

    it('requests only base fields when no extraFields provided', async () => {
      const jiraRequest = vi.fn().mockResolvedValueOnce({
        issues: [],
        isLast: true
      });

      const client = createJiraClient({ jiraRequest, jiraHost });
      await client.fetchIssuesByJql('project = PROJ');

      const body = jiraRequest.mock.calls[0][1].body;
      expect(body.fields).toContain('customfield_10028');
      expect(body.fields).not.toContain('customfield_10464');
    });
  });

  describe('fetchBoards with boardType', () => {
    it('defaults to scrum board type', async () => {
      const jiraRequest = vi.fn().mockResolvedValueOnce({
        values: [{ id: 1, name: 'Board A' }],
        isLast: true
      });

      const client = createJiraClient({ jiraRequest, jiraHost });
      await client.fetchBoards('PROJ');

      expect(jiraRequest.mock.calls[0][0]).toContain('type=scrum');
    });

    it('accepts kanban board type', async () => {
      const jiraRequest = vi.fn().mockResolvedValueOnce({
        values: [{ id: 1, name: 'Kanban Board' }],
        isLast: true
      });

      const client = createJiraClient({ jiraRequest, jiraHost });
      const boards = await client.fetchBoards('PROJ', 'kanban');

      expect(jiraRequest.mock.calls[0][0]).toContain('type=kanban');
      expect(boards[0]).toEqual({ id: 1, name: 'Kanban Board', projectKey: 'PROJ', type: 'kanban' });
    });

    it('includes type field on returned boards', async () => {
      const jiraRequest = vi.fn().mockResolvedValueOnce({
        values: [{ id: 1, name: 'Board A' }],
        isLast: true
      });

      const client = createJiraClient({ jiraRequest, jiraHost });
      const boards = await client.fetchBoards('PROJ', 'scrum');

      expect(boards[0].type).toBe('scrum');
    });
  });

  describe('fetchBoardType', () => {
    it('returns board type from Jira API', async () => {
      const jiraRequest = vi.fn().mockResolvedValueOnce({
        id: 42,
        name: 'My Board',
        type: 'kanban'
      });

      const client = createJiraClient({ jiraRequest, jiraHost });
      const type = await client.fetchBoardType(42);

      expect(type).toBe('kanban');
      expect(jiraRequest).toHaveBeenCalledWith('/rest/agile/1.0/board/42');
    });

    it('defaults to scrum when type field is missing', async () => {
      const jiraRequest = vi.fn().mockResolvedValueOnce({
        id: 42,
        name: 'My Board'
      });

      const client = createJiraClient({ jiraRequest, jiraHost });
      const type = await client.fetchBoardType(42);

      expect(type).toBe('scrum');
    });
  });

  describe('fetchSprintIssues', () => {
    it('fetches and transforms issue fields correctly with extraFields', async () => {
      const jiraRequest = vi.fn().mockResolvedValueOnce({
        total: 2,
        issues: [
          {
            key: 'PROJ-1',
            fields: {
              summary: 'Fix bug',
              issuetype: { name: 'Bug' },
              status: { name: 'Done' },
              assignee: { displayName: 'Alice' },
              customfield_10028: 3,
              customfield_10464: { value: 'Tech Debt & Quality' },
              resolution: { name: 'Done' },
              resolutiondate: '2025-01-10'
            }
          },
          {
            key: 'PROJ-2',
            fields: {
              summary: 'Add feature',
              issuetype: { name: 'Story' },
              status: { name: 'In Progress' },
              assignee: null,
              customfield_10028: null,
              customfield_10464: null,
              resolution: null,
              resolutiondate: null
            }
          }
        ]
      });

      const client = createJiraClient({ jiraRequest, jiraHost, extraFields: AI_ENG_EXTRA_FIELDS });
      const issues = await client.fetchSprintIssues(200);

      expect(issues).toHaveLength(2);
      expect(issues[0]).toEqual({
        key: 'PROJ-1',
        summary: 'Fix bug',
        issueType: 'Bug',
        status: 'Done',
        assignee: 'Alice',
        storyPoints: 3,
        activityType: 'Tech Debt & Quality',
        resolution: 'Done',
        resolutionDate: '2025-01-10',
        url: 'https://jira.example.com/browse/PROJ-1'
      });
      expect(issues[1].assignee).toBeNull();
      expect(issues[1].storyPoints).toBeNull();
      expect(issues[1].activityType).toBeNull();
    });

    it('paginates when total exceeds maxResults', async () => {
      const jiraRequest = vi.fn()
        .mockResolvedValueOnce({
          total: 101,
          issues: [{ key: 'PROJ-1', fields: { summary: 'A', issuetype: { name: 'Bug' }, status: { name: 'Done' }, assignee: null, customfield_10028: null, resolution: null, resolutiondate: null } }]
        })
        .mockResolvedValueOnce({
          total: 101,
          issues: [{ key: 'PROJ-2', fields: { summary: 'B', issuetype: { name: 'Story' }, status: { name: 'Done' }, assignee: null, customfield_10028: null, resolution: null, resolutiondate: null } }]
        });

      const client = createJiraClient({ jiraRequest, jiraHost });
      const issues = await client.fetchSprintIssues(200);

      expect(issues).toHaveLength(2);
      expect(jiraRequest).toHaveBeenCalledTimes(2);
      expect(jiraRequest.mock.calls[0][0]).toContain('startAt=0');
      expect(jiraRequest.mock.calls[1][0]).toContain('startAt=100');
    });

    it('requests extra fields in Sprint Report API URL', async () => {
      const jiraRequest = vi.fn().mockResolvedValueOnce({
        total: 0,
        issues: []
      });

      const client = createJiraClient({ jiraRequest, jiraHost, extraFields: AI_ENG_EXTRA_FIELDS });
      await client.fetchSprintIssues(200);

      expect(jiraRequest.mock.calls[0][0]).toContain('customfield_10028');
      expect(jiraRequest.mock.calls[0][0]).toContain('customfield_10464');
    });
  });
});
