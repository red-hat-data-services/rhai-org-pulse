import { describe, it, expect, vi } from 'vitest'
import { createJiraClient } from '../jira-client.js'

describe('createJiraClient', () => {
  function createMockClient(mockResponses = {}) {
    const jiraRequest = vi.fn(async (path) => {
      for (const [pattern, response] of Object.entries(mockResponses)) {
        if (path.includes(pattern)) {
          return typeof response === 'function' ? response(path) : response
        }
      }
      throw new Error(`Unexpected path: ${path}`)
    })

    const client = createJiraClient({
      jiraRequest,
      jiraHost: 'https://redhat.atlassian.net'
    })

    return { client, jiraRequest }
  }

  describe('fetchBoards', () => {
    it('fetches all boards with pagination', async () => {
      const { client, jiraRequest } = createMockClient({
        'board?': (path) => {
          if (path.includes('startAt=0')) {
            return {
              values: [
                { id: 1, name: 'Board 1' },
                { id: 2, name: 'Board 2' }
              ],
              isLast: true
            }
          }
        }
      })

      const boards = await client.fetchBoards()
      expect(boards).toHaveLength(2)
      expect(boards[0]).toEqual({ id: 1, name: 'Board 1', projectKey: 'RHOAIENG' })
      expect(jiraRequest).toHaveBeenCalledTimes(1)
    })

    it('handles multi-page results', async () => {
      const { client, jiraRequest } = createMockClient({
        'board?': (path) => {
          if (path.includes('startAt=0')) {
            return { values: [{ id: 1, name: 'Board 1' }], isLast: false }
          }
          if (path.includes('startAt=50')) {
            return { values: [{ id: 2, name: 'Board 2' }], isLast: true }
          }
        }
      })

      const boards = await client.fetchBoards()
      expect(boards).toHaveLength(2)
      expect(jiraRequest).toHaveBeenCalledTimes(2)
    })
  })

  describe('fetchSprints', () => {
    it('fetches sprints for a board', async () => {
      const { client } = createMockClient({
        'sprint?': () => ({
          values: [{
            id: 100,
            name: 'Sprint 1',
            state: 'closed',
            startDate: '2026-01-01',
            endDate: '2026-01-14',
            completeDate: '2026-01-14'
          }],
          isLast: true
        })
      })

      const sprints = await client.fetchSprints(42)
      expect(sprints).toHaveLength(1)
      expect(sprints[0]).toEqual({
        id: 100,
        name: 'Sprint 1',
        state: 'closed',
        startDate: '2026-01-01',
        endDate: '2026-01-14',
        completeDate: '2026-01-14',
        boardId: 42
      })
    })
  })

  describe('fetchSprintReport', () => {
    it('calls greenhopper sprint report API', async () => {
      const { client, jiraRequest } = createMockClient({
        'sprintreport': () => ({
          sprint: { id: 100, name: 'Sprint 1' },
          contents: {}
        })
      })

      const report = await client.fetchSprintReport(42, 100)
      expect(report.sprint.id).toBe(100)
      expect(jiraRequest).toHaveBeenCalledWith(
        '/rest/greenhopper/1.0/rapid/charts/sprintreport?rapidViewId=42&sprintId=100'
      )
    })
  })
})
