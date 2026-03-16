import { describe, it, expect } from 'vitest'
import { processSprintReport, normalizeIssue, buildCategorySummary, getStoryPoints } from '../sprint-report.js'

const JIRA_HOST = 'https://redhat.atlassian.net'

function makeRawIssue(overrides = {}) {
  return {
    key: 'RHOAIENG-100',
    summary: 'Test issue',
    typeName: 'Story',
    statusName: 'Done',
    assigneeName: 'John Doe',
    assigneeKey: 'jdoe',
    currentEstimateStatistic: { statFieldValue: { value: 3 } },
    ...overrides
  }
}

function makeRawReport(overrides = {}) {
  return {
    sprint: {
      id: 1001,
      name: 'Sprint 1',
      state: 'closed',
      startDate: '2026-01-06T00:00:00.000Z',
      endDate: '2026-01-20T00:00:00.000Z',
      completeDate: '2026-01-20T12:00:00.000Z'
    },
    contents: {
      completedIssues: [],
      issuesNotCompletedInCurrentSprint: [],
      puntedIssues: [],
      issueKeysAddedDuringSprint: {},
      ...overrides.contents
    },
    ...overrides
  }
}

describe('getStoryPoints', () => {
  it('returns value from currentEstimateStatistic', () => {
    expect(getStoryPoints({ currentEstimateStatistic: { statFieldValue: { value: 5 } } })).toBe(5)
  })

  it('falls back to estimateStatistic', () => {
    expect(getStoryPoints({
      currentEstimateStatistic: { statFieldValue: {} },
      estimateStatistic: { statFieldValue: { value: 3 } }
    })).toBe(3)
  })

  it('returns null when no points set', () => {
    expect(getStoryPoints({})).toBeNull()
  })

  it('returns null for NaN values', () => {
    expect(getStoryPoints({ currentEstimateStatistic: { statFieldValue: { value: 'abc' } } })).toBeNull()
  })
})

describe('normalizeIssue', () => {
  it('normalizes a standard issue', () => {
    const raw = makeRawIssue()
    const issue = normalizeIssue(raw, { jiraHost: JIRA_HOST, addedKeys: new Set(), completedKeys: new Set() })
    expect(issue.key).toBe('RHOAIENG-100')
    expect(issue.type).toBe('Story')
    expect(issue.storyPoints).toBe(3)
    expect(issue.effectivePoints).toBe(3)
    expect(issue.isEstimated).toBe(true)
    expect(issue.wasAddedMidSprint).toBe(false)
    expect(issue.url).toBe('https://redhat.atlassian.net/browse/RHOAIENG-100')
  })

  it('defaults unestimated issues to 1 point', () => {
    const raw = makeRawIssue({ currentEstimateStatistic: {} })
    const issue = normalizeIssue(raw, { jiraHost: JIRA_HOST, addedKeys: new Set(), completedKeys: new Set() })
    expect(issue.storyPoints).toBeNull()
    expect(issue.effectivePoints).toBe(1)
    expect(issue.isEstimated).toBe(false)
  })

  it('resolves typeId to type name when typeName is absent', () => {
    const raw = makeRawIssue({ typeName: undefined, typeId: '17' })
    const issue = normalizeIssue(raw, { jiraHost: JIRA_HOST, addedKeys: new Set(), completedKeys: new Set() })
    expect(issue.type).toBe('Story')
  })

  it('resolves typeId 3 to Task', () => {
    const raw = makeRawIssue({ typeName: undefined, typeId: '3' })
    const issue = normalizeIssue(raw, { jiraHost: JIRA_HOST, addedKeys: new Set(), completedKeys: new Set() })
    expect(issue.type).toBe('Task')
  })

  it('resolves typeId 1 to Bug', () => {
    const raw = makeRawIssue({ typeName: undefined, typeId: '1' })
    const issue = normalizeIssue(raw, { jiraHost: JIRA_HOST, addedKeys: new Set(), completedKeys: new Set() })
    expect(issue.type).toBe('Bug')
  })

  it('marks issues added mid-sprint', () => {
    const raw = makeRawIssue()
    const issue = normalizeIssue(raw, {
      jiraHost: JIRA_HOST,
      addedKeys: new Set(['RHOAIENG-100']),
      completedKeys: new Set()
    })
    expect(issue.wasAddedMidSprint).toBe(true)
  })
})

describe('buildCategorySummary', () => {
  it('computes totals correctly', () => {
    const issues = [
      { effectivePoints: 3, isEstimated: true },
      { effectivePoints: 5, isEstimated: true },
      { effectivePoints: 1, isEstimated: false }
    ]
    const summary = buildCategorySummary(issues)
    expect(summary.totalPoints).toBe(9)
    expect(summary.estimatedCount).toBe(2)
    expect(summary.unestimatedCount).toBe(1)
    expect(summary.defaultedPoints).toBe(1)
  })

  it('handles empty array', () => {
    const summary = buildCategorySummary([])
    expect(summary.totalPoints).toBe(0)
    expect(summary.issues).toEqual([])
  })
})

describe('processSprintReport', () => {
  it('processes a basic sprint report', () => {
    const report = makeRawReport({
      contents: {
        completedIssues: [
          makeRawIssue({ key: 'RHOAIENG-1' }),
          makeRawIssue({ key: 'RHOAIENG-2', currentEstimateStatistic: { statFieldValue: { value: 5 } } })
        ],
        issuesNotCompletedInCurrentSprint: [
          makeRawIssue({ key: 'RHOAIENG-3', currentEstimateStatistic: { statFieldValue: { value: 2 } } })
        ],
        puntedIssues: [],
        issueKeysAddedDuringSprint: {}
      }
    })

    const result = processSprintReport(report, 100, JIRA_HOST)

    expect(result.sprint.id).toBe(1001)
    expect(result.sprint.boardId).toBe(100)
    expect(result.committed.issues.length).toBe(3)
    expect(result.committed.totalPoints).toBe(10) // 3 + 5 + 2
    expect(result.delivered.issues.length).toBe(2)
    expect(result.delivered.totalPoints).toBe(8) // 3 + 5
    expect(result.metrics.commitmentReliabilityPoints).toBe(80) // 8/10 * 100
    expect(result.metrics.velocityPoints).toBe(8)
    expect(result.metrics.velocityCount).toBe(2)
  })

  it('categorizes added mid-sprint issues correctly', () => {
    const report = makeRawReport({
      contents: {
        completedIssues: [
          makeRawIssue({ key: 'RHOAIENG-1' }),
          makeRawIssue({ key: 'RHOAIENG-4' })
        ],
        issuesNotCompletedInCurrentSprint: [],
        puntedIssues: [],
        issueKeysAddedDuringSprint: { 'RHOAIENG-4': true }
      }
    })

    const result = processSprintReport(report, 100, JIRA_HOST)

    // RHOAIENG-1 was committed (not added mid-sprint)
    // RHOAIENG-4 was added mid-sprint
    expect(result.committed.issues.length).toBe(1)
    expect(result.committed.issues[0].key).toBe('RHOAIENG-1')
    expect(result.addedMidSprint.issues.length).toBe(1)
    expect(result.addedMidSprint.issues[0].key).toBe('RHOAIENG-4')
    expect(result.delivered.issues.length).toBe(2)
    expect(result.metrics.scopeChangeCount).toBe(1)
  })

  it('handles removed (punted) issues', () => {
    const report = makeRawReport({
      contents: {
        completedIssues: [makeRawIssue({ key: 'RHOAIENG-1' })],
        issuesNotCompletedInCurrentSprint: [],
        puntedIssues: [makeRawIssue({ key: 'RHOAIENG-2' })],
        issueKeysAddedDuringSprint: {}
      }
    })

    const result = processSprintReport(report, 100, JIRA_HOST)

    expect(result.committed.issues.length).toBe(2) // completed + punted
    expect(result.removed.issues.length).toBe(1)
    expect(result.removed.issues[0].key).toBe('RHOAIENG-2')
    expect(result.metrics.scopeChangeCount).toBe(1) // 0 added + 1 removed
  })

  it('filters to only tracked types (Story/Bug/Task)', () => {
    const report = makeRawReport({
      contents: {
        completedIssues: [
          makeRawIssue({ key: 'RHOAIENG-1', typeName: 'Story' }),
          makeRawIssue({ key: 'RHOAIENG-2', typeName: 'Epic' }),
          makeRawIssue({ key: 'RHOAIENG-3', typeName: 'Sub-task' })
        ],
        issuesNotCompletedInCurrentSprint: [],
        puntedIssues: [],
        issueKeysAddedDuringSprint: {}
      }
    })

    const result = processSprintReport(report, 100, JIRA_HOST)

    expect(result.delivered.issues.length).toBe(1)
    expect(result.delivered.issues[0].key).toBe('RHOAIENG-1')
  })

  it('handles empty sprint', () => {
    const report = makeRawReport()
    const result = processSprintReport(report, 100, JIRA_HOST)

    expect(result.committed.totalPoints).toBe(0)
    expect(result.delivered.totalPoints).toBe(0)
    expect(result.metrics.commitmentReliabilityPoints).toBe(0)
    expect(result.metrics.velocityPoints).toBe(0)
  })

  it('handles all unestimated issues', () => {
    const report = makeRawReport({
      contents: {
        completedIssues: [
          makeRawIssue({ key: 'RHOAIENG-1', currentEstimateStatistic: {} }),
          makeRawIssue({ key: 'RHOAIENG-2', currentEstimateStatistic: {} })
        ],
        issuesNotCompletedInCurrentSprint: [],
        puntedIssues: [],
        issueKeysAddedDuringSprint: {}
      }
    })

    const result = processSprintReport(report, 100, JIRA_HOST)

    expect(result.committed.totalPoints).toBe(2) // 2 * 1 default
    expect(result.committed.unestimatedCount).toBe(2)
    expect(result.committed.defaultedPoints).toBe(2)
    expect(result.delivered.totalPoints).toBe(2)
    expect(result.metrics.commitmentReliabilityPoints).toBe(100)
  })

  it('builds assignee breakdown correctly', () => {
    const report = makeRawReport({
      contents: {
        completedIssues: [
          makeRawIssue({ key: 'RHOAIENG-1', assigneeName: 'Alice', currentEstimateStatistic: { statFieldValue: { value: 3 } } }),
          makeRawIssue({ key: 'RHOAIENG-2', assigneeName: 'Bob', currentEstimateStatistic: { statFieldValue: { value: 5 } } })
        ],
        issuesNotCompletedInCurrentSprint: [
          makeRawIssue({ key: 'RHOAIENG-3', assigneeName: 'Alice', currentEstimateStatistic: { statFieldValue: { value: 2 } } })
        ],
        puntedIssues: [],
        issueKeysAddedDuringSprint: {}
      }
    })

    const result = processSprintReport(report, 100, JIRA_HOST)

    expect(result.byAssignee['Alice']).toBeDefined()
    expect(result.byAssignee['Alice'].pointsCompleted).toBe(3)
    expect(result.byAssignee['Alice'].pointsAssigned).toBe(5)
    expect(result.byAssignee['Alice'].issuesCompleted).toBe(1)
    expect(result.byAssignee['Alice'].issuesAssigned).toBe(2)
    expect(result.byAssignee['Alice'].completionRate).toBe(50)

    expect(result.byAssignee['Bob'].pointsCompleted).toBe(5)
    expect(result.byAssignee['Bob'].completionRate).toBe(100)
  })

  it('handles zero committed points without division by zero', () => {
    const report = makeRawReport({
      contents: {
        completedIssues: [],
        issuesNotCompletedInCurrentSprint: [],
        puntedIssues: [],
        issueKeysAddedDuringSprint: {}
      }
    })

    const result = processSprintReport(report, 100, JIRA_HOST)
    expect(result.metrics.commitmentReliabilityPoints).toBe(0)
    expect(result.metrics.commitmentReliabilityCount).toBe(0)
  })
})
