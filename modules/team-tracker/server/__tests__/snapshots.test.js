import { describe, it, expect, vi } from 'vitest'
import {
  getSnapshotPeriods,
  getCurrentPeriod,
  getCompletedPeriods,
  generateSnapshot,
  generateAndStoreSnapshot,
  loadTeamSnapshots,
  loadPersonSnapshots,
  snapshotPath,
  formatDate,
  sanitizeTeamKey,
  SNAPSHOT_EPOCH,
  PERIOD_DAYS
} from '../snapshots'

function createMockStorage(data = {}) {
  const store = { ...data }
  return {
    readFromStorage: vi.fn((key) => store[key] || null),
    writeToStorage: vi.fn((key, value) => { store[key] = value }),
    listStorageFiles: vi.fn((dir) => {
      return Object.keys(store)
        .filter(k => k.startsWith(dir + '/'))
        .map(k => k.slice(dir.length + 1))
    })
  }
}

const mockTeam = {
  displayName: 'Model Serving',
  members: [
    {
      name: 'Alice Smith',
      jiraDisplayName: 'Alice Smith',
      githubUsername: 'asmith',
      gitlabUsername: 'asmith-gl'
    },
    {
      name: 'Bob Jones',
      jiraDisplayName: 'Bob Jones',
      githubUsername: 'bjones',
      gitlabUsername: null
    }
  ]
}

const mockPersonData = {
  'people/alice_smith.json': {
    jiraDisplayName: 'Alice Smith',
    resolved: {
      count: 12, storyPoints: 25,
      issues: [
        { key: 'TEST-1', resolutionDate: '2026-01-10', storyPoints: 5, cycleTimeDays: 2.0 },
        { key: 'TEST-2', resolutionDate: '2026-01-20', storyPoints: 8, cycleTimeDays: 4.0 },
        { key: 'TEST-3', resolutionDate: '2026-02-15', storyPoints: 12, cycleTimeDays: 5.0 }
      ]
    },
    inProgress: { count: 2, storyPoints: 5, issues: [] },
    cycleTime: { avgDays: 3.5, medianDays: 2.0 }
  },
  'people/bob_jones.json': {
    jiraDisplayName: 'Bob Jones',
    resolved: {
      count: 8, storyPoints: 15,
      issues: [
        { key: 'TEST-4', resolutionDate: '2026-01-15', storyPoints: 3, cycleTimeDays: 6.0 },
        { key: 'TEST-5', resolutionDate: '2026-01-25', storyPoints: 5, cycleTimeDays: 4.0 }
      ]
    },
    inProgress: { count: 1, storyPoints: 3, issues: [] },
    cycleTime: { avgDays: 5.0, medianDays: 4.0 }
  }
}

const mockGithubCache = {
  users: {
    asmith: { totalContributions: 100 },
    bjones: { totalContributions: 50 }
  }
}

const mockGitlabCache = {
  users: {
    'asmith-gl': { totalContributions: 30 }
  }
}

describe('snapshots', () => {
  describe('formatDate', () => {
    it('formats a date as YYYY-MM-DD', () => {
      expect(formatDate(new Date('2026-01-15T00:00:00Z'))).toBe('2026-01-15')
    })
  })

  describe('sanitizeTeamKey', () => {
    it('replaces :: with --', () => {
      expect(sanitizeTeamKey('orgKey::teamName')).toBe('orgKey--teamName')
    })

    it('removes special characters', () => {
      expect(sanitizeTeamKey('org::My Team!')).toBe('org--My_Team_')
    })
  })

  describe('snapshotPath', () => {
    it('builds the correct storage path', () => {
      const end = new Date('2026-01-31T00:00:00Z')
      expect(snapshotPath('org::team', end)).toBe('snapshots/org--team/2026-01-31.json')
    })
  })

  describe('getSnapshotPeriods', () => {
    it('returns periods starting from epoch', () => {
      const periods = getSnapshotPeriods()
      expect(periods.length).toBeGreaterThan(0)
      expect(periods[0].start.getTime()).toBe(SNAPSHOT_EPOCH.getTime())
    })

    it('each period is 30 days long', () => {
      const periods = getSnapshotPeriods()
      for (const period of periods) {
        const diff = (period.end - period.start) / (1000 * 60 * 60 * 24)
        expect(diff).toBe(PERIOD_DAYS)
      }
    })

    it('periods are contiguous', () => {
      const periods = getSnapshotPeriods()
      for (let i = 1; i < periods.length; i++) {
        expect(periods[i].start.getTime()).toBe(periods[i - 1].end.getTime())
      }
    })
  })

  describe('getCurrentPeriod', () => {
    it('returns a period containing today', () => {
      const period = getCurrentPeriod()
      expect(period).not.toBeNull()
      const now = new Date()
      expect(period.start.getTime()).toBeLessThanOrEqual(now.getTime())
    })
  })

  describe('getCompletedPeriods', () => {
    it('only returns periods whose end is in the past', () => {
      const completed = getCompletedPeriods()
      const now = new Date()
      for (const period of completed) {
        expect(period.end.getTime()).toBeLessThanOrEqual(now.getTime())
      }
    })

    it('returns fewer periods than getSnapshotPeriods', () => {
      const all = getSnapshotPeriods()
      const completed = getCompletedPeriods()
      expect(completed.length).toBeLessThanOrEqual(all.length)
    })
  })

  describe('generateSnapshot', () => {
    it('generates a snapshot with correct team aggregates', () => {
      const storage = createMockStorage(mockPersonData)
      const period = { start: new Date('2026-01-01'), end: new Date('2026-01-31') }

      const snapshot = generateSnapshot(storage, 'org::team', mockTeam, period, {
        githubCache: mockGithubCache,
        gitlabCache: mockGitlabCache
      })

      expect(snapshot.periodStart).toBe('2026-01-01')
      expect(snapshot.periodEnd).toBe('2026-01-31')
      expect(snapshot.generatedAt).toBeTruthy()
      expect(snapshot.team.resolvedCount).toBe(4) // 2 + 2 (only issues in Jan period)
      expect(snapshot.team.resolvedPoints).toBe(21) // (5+8) + (3+5)
      expect(snapshot.team.inProgressCount).toBe(3) // 2 + 1
      expect(snapshot.team.avgCycleTimeDays).toBe(4.0) // (3.0 + 5.0) / 2
      expect(snapshot.team.githubContributions).toBe(150) // 100 + 50
      expect(snapshot.team.gitlabContributions).toBe(30) // 30 + 0
    })

    it('generates per-member metrics', () => {
      const storage = createMockStorage(mockPersonData)
      const period = { start: new Date('2026-01-01'), end: new Date('2026-01-31') }

      const snapshot = generateSnapshot(storage, 'org::team', mockTeam, period, {
        githubCache: mockGithubCache,
        gitlabCache: mockGitlabCache
      })

      expect(snapshot.members['Alice Smith']).toEqual({
        resolvedCount: 2,
        resolvedPoints: 13,
        inProgressCount: 2,
        avgCycleTimeDays: 3.0,
        githubContributions: 100,
        gitlabContributions: 30,
        hasGithub: true,
        hasGitlab: true
      })

      expect(snapshot.members['Bob Jones']).toEqual({
        resolvedCount: 2,
        resolvedPoints: 8,
        inProgressCount: 1,
        avgCycleTimeDays: 5.0,
        githubContributions: 50,
        gitlabContributions: 0,
        hasGithub: true,
        hasGitlab: false
      })
    })

    it('handles missing person data gracefully', () => {
      const storage = createMockStorage({}) // no person files
      const period = { start: new Date('2026-01-01'), end: new Date('2026-01-31') }

      const snapshot = generateSnapshot(storage, 'org::team', mockTeam, period, {
        githubCache: { users: {} },
        gitlabCache: { users: {} }
      })

      expect(snapshot.team.resolvedCount).toBe(0)
      expect(snapshot.team.resolvedPoints).toBe(0)
      expect(snapshot.team.avgCycleTimeDays).toBeNull()
    })

    it('deduplicates members by jiraDisplayName', () => {
      const teamWithDupes = {
        members: [
          { name: 'Alice Smith', jiraDisplayName: 'Alice Smith', githubUsername: null, gitlabUsername: null },
          { name: 'Alice Smith', jiraDisplayName: 'Alice Smith', githubUsername: null, gitlabUsername: null }
        ]
      }
      const storage = createMockStorage(mockPersonData)
      const period = { start: new Date('2026-01-01'), end: new Date('2026-01-31') }

      const snapshot = generateSnapshot(storage, 'org::team', teamWithDupes, period, {
        githubCache: { users: {} },
        gitlabCache: { users: {} }
      })

      // Should count Alice only once (2 issues in Jan period)
      expect(snapshot.team.resolvedCount).toBe(2)
      expect(Object.keys(snapshot.members)).toHaveLength(1)
    })
  })

  describe('generateAndStoreSnapshot', () => {
    it('writes snapshot to storage when none exists', () => {
      const storage = createMockStorage(mockPersonData)
      const period = { start: new Date('2026-01-01'), end: new Date('2026-01-31') }

      const snapshot = generateAndStoreSnapshot(storage, 'org::team', mockTeam, period)

      expect(storage.writeToStorage).toHaveBeenCalledWith(
        'snapshots/org--team/2026-01-31.json',
        snapshot
      )
    })

    it('returns existing snapshot without regenerating', () => {
      const existingSnapshot = { periodStart: '2026-01-01', periodEnd: '2026-01-31', team: {}, members: {} }
      const storage = createMockStorage({
        ...mockPersonData,
        'snapshots/org--team/2026-01-31.json': existingSnapshot
      })
      const period = { start: new Date('2026-01-01'), end: new Date('2026-01-31') }

      const result = generateAndStoreSnapshot(storage, 'org::team', mockTeam, period)

      expect(result).toEqual(existingSnapshot)
      expect(storage.writeToStorage).not.toHaveBeenCalled()
    })
  })

  describe('loadTeamSnapshots', () => {
    it('returns snapshots sorted by periodStart', () => {
      const storage = createMockStorage({
        'snapshots/org--team/2026-02-28.json': { periodStart: '2026-01-31', periodEnd: '2026-02-28', team: {}, members: {} },
        'snapshots/org--team/2026-01-31.json': { periodStart: '2026-01-01', periodEnd: '2026-01-31', team: {}, members: {} }
      })

      const snapshots = loadTeamSnapshots(storage, 'org::team')

      expect(snapshots).toHaveLength(2)
      expect(snapshots[0].periodStart).toBe('2026-01-01')
      expect(snapshots[1].periodStart).toBe('2026-01-31')
    })

    it('returns empty array when no snapshots exist', () => {
      const storage = createMockStorage({})
      const snapshots = loadTeamSnapshots(storage, 'org::team')
      expect(snapshots).toEqual([])
    })
  })

  describe('loadPersonSnapshots', () => {
    it('returns only snapshots that include the person', () => {
      const storage = createMockStorage({
        'snapshots/org--team/2026-01-31.json': {
          periodStart: '2026-01-01',
          periodEnd: '2026-01-31',
          generatedAt: '2026-01-31T06:00:00Z',
          team: {},
          members: {
            'Alice Smith': { resolvedCount: 12, resolvedPoints: 25, inProgressCount: 2, avgCycleTimeDays: 3.5, githubContributions: 100, gitlabContributions: 30 }
          }
        },
        'snapshots/org--team/2026-02-28.json': {
          periodStart: '2026-01-31',
          periodEnd: '2026-02-28',
          generatedAt: '2026-02-28T06:00:00Z',
          team: {},
          members: {
            'Bob Jones': { resolvedCount: 5, resolvedPoints: 10, inProgressCount: 0, avgCycleTimeDays: 4.0, githubContributions: 20, gitlabContributions: 0 }
          }
        }
      })

      const aliceSnapshots = loadPersonSnapshots(storage, 'org::team', 'Alice Smith')
      expect(aliceSnapshots).toHaveLength(1)
      expect(aliceSnapshots[0].metrics.resolvedCount).toBe(12)

      const bobSnapshots = loadPersonSnapshots(storage, 'org::team', 'Bob Jones')
      expect(bobSnapshots).toHaveLength(1)
      expect(bobSnapshots[0].metrics.resolvedCount).toBe(5)
    })

    it('returns empty array for unknown person', () => {
      const storage = createMockStorage({
        'snapshots/org--team/2026-01-31.json': {
          periodStart: '2026-01-01',
          periodEnd: '2026-01-31',
          generatedAt: '2026-01-31T06:00:00Z',
          team: {},
          members: {}
        }
      })

      const result = loadPersonSnapshots(storage, 'org::team', 'Unknown Person')
      expect(result).toEqual([])
    })
  })
})
