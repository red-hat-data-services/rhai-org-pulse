/**
 * Tests for useAllocationData composable.
 * New test file for the composable that replaces the monolithic App.vue state management.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the API service module
vi.mock('../../client/services/api.js', () => ({
  getProjects: vi.fn(),
  getOrgSummary: vi.fn(),
  getProjectSummary: vi.fn(),
  getBoards: vi.fn(),
  getSprintsForBoard: vi.fn(),
  getSprintIssues: vi.fn(),
  refreshData: vi.fn()
}))

import { useAllocationData } from '../../client/composables/useAllocationData.js'
import {
  getProjects,
  getOrgSummary,
  getProjectSummary,
  getBoards,
  getSprintsForBoard,
  getSprintIssues
} from '../../client/services/api.js'

describe('useAllocationData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset module-level state by getting the composable and clearing values
    const data = useAllocationData()
    data.orgName.value = 'AI Engineering'
    data.projects.value = []
    data.orgSummary.value = null
    data.configError.value = null
    data.selectedProject.value = null
    data.selectedProjectSummary.value = null
    data.boards.value = []
    data.selectedTeam.value = null
    data.teamSprints.value = []
    data.selectedSprint.value = null
    data.teamSprintData.value = null
    data.isLoading.value = false
    data.isRefreshing.value = false
    data.lastUpdated.value = null
  })

  it('returns all expected properties', () => {
    const data = useAllocationData()
    // Org-level
    expect(data.orgName).toBeDefined()
    expect(data.projects).toBeDefined()
    expect(data.orgSummary).toBeDefined()
    expect(data.projectSummaries).toBeDefined()
    expect(data.configError).toBeDefined()
    // Project-level
    expect(data.selectedProject).toBeDefined()
    expect(data.selectedProjectSummary).toBeDefined()
    expect(data.boards).toBeDefined()
    expect(data.boardSprintData).toBeDefined()
    // Team-level
    expect(data.selectedTeam).toBeDefined()
    expect(data.teamSprints).toBeDefined()
    expect(data.selectedSprint).toBeDefined()
    expect(data.teamSprintData).toBeDefined()
    expect(data.isTeamDetailLoading).toBeDefined()
    // UI state
    expect(data.isLoading).toBeDefined()
    expect(data.isRefreshing).toBeDefined()
    expect(data.lastUpdated).toBeDefined()
    expect(data.isDataStale).toBeDefined()
    // Methods
    expect(typeof data.loadInitialData).toBe('function')
    expect(typeof data.loadOrgData).toBe('function')
    expect(typeof data.handleSelectProject).toBe('function')
    expect(typeof data.handleSelectTeam).toBe('function')
    expect(typeof data.handleSelectSprint).toBe('function')
    expect(typeof data.handleRefreshData).toBe('function')
    expect(typeof data.transformSprintData).toBe('function')
  })

  describe('loadInitialData', () => {
    it('loads projects and org data', async () => {
      getProjects.mockResolvedValue({
        orgName: 'Test Org',
        projects: [{ key: 'PROJ1', name: 'Project 1' }]
      })
      getOrgSummary.mockResolvedValue({ totalPoints: 100 })
      getProjectSummary.mockResolvedValue({ totalPoints: 50 })

      const data = useAllocationData()
      await data.loadInitialData()

      expect(data.orgName.value).toBe('Test Org')
      expect(data.projects.value).toHaveLength(1)
      expect(data.configError.value).toBeNull()
    })

    it('sets configError when no projects returned', async () => {
      getProjects.mockResolvedValue({ orgName: 'Empty Org', projects: [] })

      const data = useAllocationData()
      await data.loadInitialData()

      expect(data.configError.value).toContain('No projects configured')
    })

    it('sets configError on API failure', async () => {
      getProjects.mockRejectedValue(new Error('Network error'))

      const data = useAllocationData()
      await data.loadInitialData()

      expect(data.configError.value).toContain('Failed to load')
    })

    it('manages isLoading state correctly', async () => {
      getProjects.mockResolvedValue({ orgName: 'Test', projects: [{ key: 'P' }] })
      getOrgSummary.mockResolvedValue({})
      getProjectSummary.mockResolvedValue({})

      const data = useAllocationData()
      const promise = data.loadInitialData()
      expect(data.isLoading.value).toBe(true)
      await promise
      expect(data.isLoading.value).toBe(false)
    })
  })

  describe('handleSelectProject', () => {
    it('loads boards and project summary', async () => {
      getBoards.mockResolvedValue({ boards: [{ id: 1, name: 'Board A' }] })
      getProjectSummary.mockResolvedValue({ boards: { 1: { summary: {} } } })

      const data = useAllocationData()
      await data.handleSelectProject({ key: 'PROJ1', name: 'Project 1' })

      expect(data.selectedProject.value).toEqual({ key: 'PROJ1', name: 'Project 1' })
      expect(data.boards.value).toHaveLength(1)
    })

    it('handles API failure gracefully', async () => {
      getBoards.mockRejectedValue(new Error('API error'))
      getProjectSummary.mockRejectedValue(new Error('API error'))

      const data = useAllocationData()
      await data.handleSelectProject({ key: 'PROJ1', name: 'Project 1' })

      expect(data.boards.value).toEqual([])
    })
  })

  describe('handleSelectTeam', () => {
    it('sets selectedTeam and loads sprints', async () => {
      getSprintsForBoard.mockResolvedValue({
        sprints: [
          { id: 100, name: 'Sprint 1', state: 'active' }
        ]
      })
      getSprintIssues.mockResolvedValue({
        sprintId: 100,
        sprintName: 'Sprint 1',
        sprintState: 'active',
        issues: [],
        summary: { totalPoints: 0, buckets: {} }
      })

      const data = useAllocationData()
      await data.handleSelectTeam({ id: 42, name: 'Board A' })

      expect(data.selectedTeam.value).toEqual({ id: 42, name: 'Board A' })
      expect(data.teamSprints.value).toHaveLength(1)
    })
  })

  describe('handleSelectSprint', () => {
    it('loads sprint issues for the selected sprint', async () => {
      getSprintIssues.mockResolvedValue({
        sprintId: 200,
        sprintName: 'Sprint 2',
        sprintState: 'closed',
        issues: [],
        summary: { totalPoints: 10, buckets: {} }
      })

      const data = useAllocationData()
      data.teamSprints.value = [
        { id: 200, name: 'Sprint 2', state: 'closed' }
      ]
      data.selectedTeam.value = { id: 42, name: 'Board A' }

      await data.handleSelectSprint(200)

      expect(data.selectedSprint.value).toEqual({ id: 200, name: 'Sprint 2', state: 'closed' })
      expect(getSprintIssues).toHaveBeenCalledWith(200, expect.any(Object))
    })
  })

  describe('transformSprintData', () => {
    it('groups issues by bucket and adds percentages', () => {
      const data = useAllocationData()
      const result = data.transformSprintData({
        sprintId: 100,
        sprintName: 'Sprint 1',
        sprintState: 'active',
        startDate: '2026-01-01',
        endDate: '2026-01-14',
        summary: {
          totalPoints: 10,
          buckets: {
            'tech-debt-quality': { points: 4, completedPoints: 2 },
            'new-features': { points: 6, completedPoints: 3 }
          }
        },
        issues: [
          { bucket: 'tech-debt-quality', key: 'P-1' },
          { bucket: 'new-features', key: 'P-2' }
        ]
      })

      expect(result.sprint.id).toBe(100)
      expect(result.sprint.name).toBe('Sprint 1')
      expect(result.summary.completedPoints).toBe(5)
      expect(result.summary.buckets['tech-debt-quality'].percentage).toBe(40)
      expect(result.summary.buckets['new-features'].percentage).toBe(60)
      expect(result.issues['tech-debt-quality']).toHaveLength(1)
      expect(result.issues['new-features']).toHaveLength(1)
    })

    it('handles empty issues', () => {
      const data = useAllocationData()
      const result = data.transformSprintData({
        sprintId: 100,
        sprintName: 'Sprint 1',
        sprintState: 'active',
        summary: { totalPoints: 0, buckets: {} },
        issues: []
      })

      expect(result.issues['tech-debt-quality']).toEqual([])
      expect(result.issues['new-features']).toEqual([])
    })
  })

  describe('isDataStale', () => {
    it('returns false when lastUpdated is null', () => {
      const data = useAllocationData()
      data.lastUpdated.value = null
      expect(data.isDataStale.value).toBe(false)
    })

    it('returns false when lastUpdated is recent', () => {
      const data = useAllocationData()
      data.lastUpdated.value = new Date().toISOString()
      expect(data.isDataStale.value).toBe(false)
    })

    it('returns true when lastUpdated is over 1 hour old', () => {
      const data = useAllocationData()
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      data.lastUpdated.value = twoHoursAgo
      expect(data.isDataStale.value).toBe(true)
    })
  })
})
