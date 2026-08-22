import { describe, it, expect } from 'vitest'
import { buildExecutiveSummary } from '../../../client/plan/utils/bu-feedback-summary.js'

var NOW = '2026-08-19T12:00:00.000Z'

function issue(overrides) {
  return Object.assign({
    key: 'RHOAIENG-1',
    summary: 'Test issue',
    issueType: 'Bug',
    assignee: 'Jane Smith',
    reporter: 'Alex Lee',
    priority: 'Major',
    status: 'New',
    statusCategory: 'To Do',
    resolution: 'Unresolved',
    created: '2026-06-01T12:00:00.000Z',
    updated: '2026-08-01T12:00:00.000Z',
    dueDate: null,
    resolved: null,
    inProgressAt: null,
    components: ['AI Core Dashboard'],
    fixVersions: [],
    feedbackLabels: ['AIBU_Feedback']
  }, overrides)
}

describe('buildExecutiveSummary', function() {
  it('computes avg lead time from closed issues', function() {
    var issues = [
      issue({
        key: 'A',
        statusCategory: 'Done',
        resolution: 'Done',
        created: '2026-06-01T12:00:00.000Z',
        resolved: '2026-06-11T12:00:00.000Z'
      }),
      issue({
        key: 'B',
        statusCategory: 'Done',
        resolution: 'Done',
        created: '2026-07-01T12:00:00.000Z',
        resolved: '2026-07-21T12:00:00.000Z'
      })
    ]
    var s = buildExecutiveSummary(issues, NOW)
    expect(s.avgLeadTime).toBe(15)
    expect(s.avgLeadTimeSample).toBe(2)
  })

  it('computes avg cycle time from issues with inProgressAt', function() {
    var issues = [
      issue({
        key: 'A',
        statusCategory: 'Done',
        resolved: '2026-06-11T12:00:00.000Z',
        inProgressAt: '2026-06-05T12:00:00.000Z'
      }),
      issue({
        key: 'B',
        statusCategory: 'Done',
        resolved: '2026-07-21T12:00:00.000Z',
        inProgressAt: '2026-07-11T12:00:00.000Z'
      })
    ]
    var s = buildExecutiveSummary(issues, NOW)
    expect(s.avgCycleTime).toBe(8)
    expect(s.avgCycleTimeSample).toBe(2)
  })

  it('returns null cycle time when no issues have inProgressAt', function() {
    var issues = [
      issue({
        key: 'A',
        statusCategory: 'Done',
        resolved: '2026-06-11T12:00:00.000Z',
        inProgressAt: null
      })
    ]
    var s = buildExecutiveSummary(issues, NOW)
    expect(s.avgCycleTime).toBeNull()
    expect(s.avgCycleTimeSample).toBe(0)
  })

  it('computes avg open age for open issues', function() {
    var issues = [
      issue({ key: 'A', created: '2026-08-09T12:00:00.000Z' }),
      issue({ key: 'B', created: '2026-07-20T12:00:00.000Z' })
    ]
    var s = buildExecutiveSummary(issues, NOW)
    expect(s.avgOpenAge).toBe(20)
    expect(s.avgOpenAgeSample).toBe(2)
  })

  it('computes resolution rate', function() {
    var issues = [
      issue({ key: 'A', statusCategory: 'Done', resolved: '2026-07-01T12:00:00.000Z' }),
      issue({ key: 'B' }),
      issue({ key: 'C' }),
      issue({ key: 'D' })
    ]
    var s = buildExecutiveSummary(issues, NOW)
    expect(s.resolutionRate).toBe(25)
  })

  it('computes throughput within 90-day window', function() {
    var issues = [
      issue({
        key: 'A',
        statusCategory: 'Done',
        resolved: '2026-08-01T12:00:00.000Z',
        created: '2026-07-01T12:00:00.000Z'
      }),
      issue({
        key: 'OLD',
        statusCategory: 'Done',
        resolved: '2026-01-01T12:00:00.000Z',
        created: '2025-12-01T12:00:00.000Z'
      })
    ]
    var s = buildExecutiveSummary(issues, NOW)
    expect(s.throughput).toBe(1)
  })

  it('counts WIP, stale, and unassigned open', function() {
    var issues = [
      issue({ key: 'A', statusCategory: 'In Progress', assignee: 'Jane', created: '2026-01-01T12:00:00.000Z' }),
      issue({ key: 'B', assignee: 'Unassigned', created: '2026-01-01T12:00:00.000Z' }),
      issue({ key: 'C', created: '2026-08-18T12:00:00.000Z' })
    ]
    var s = buildExecutiveSummary(issues, NOW)
    expect(s.wipCount).toBe(1)
    expect(s.staleOpenCount).toBe(2)
    expect(s.unassignedOpenCount).toBe(1)
  })

  it('ranks bottleneck components by open count then avg age', function() {
    var issues = [
      issue({ key: 'A', components: ['Serving'], created: '2026-01-01T12:00:00.000Z' }),
      issue({ key: 'B', components: ['Serving'], created: '2026-06-01T12:00:00.000Z' }),
      issue({ key: 'C', components: ['Dashboard'], created: '2026-01-01T12:00:00.000Z' })
    ]
    var s = buildExecutiveSummary(issues, NOW)
    expect(s.bottlenecks.length).toBe(2)
    expect(s.bottlenecks[0].component).toBe('Serving')
    expect(s.bottlenecks[0].openCount).toBe(2)
    expect(s.bottlenecks[1].component).toBe('Dashboard')
  })

  it('limits bottlenecks to top 5', function() {
    var issues = []
    for (var i = 0; i < 7; i++) {
      issues.push(issue({ key: 'K-' + i, components: ['C' + i] }))
    }
    var s = buildExecutiveSummary(issues, NOW)
    expect(s.bottlenecks.length).toBe(5)
  })

  it('falls back to updated when resolved is null for lead time', function() {
    var issues = [
      issue({
        key: 'A',
        statusCategory: 'Done',
        resolution: 'Done',
        resolved: null,
        created: '2026-06-01T12:00:00.000Z',
        updated: '2026-06-21T12:00:00.000Z'
      })
    ]
    var s = buildExecutiveSummary(issues, NOW)
    expect(s.avgLeadTime).toBe(20)
    expect(s.avgLeadTimeSample).toBe(1)
  })

  it('falls back to updated for cycle time when resolved is null', function() {
    var issues = [
      issue({
        key: 'A',
        statusCategory: 'Done',
        resolution: 'Done',
        resolved: null,
        inProgressAt: '2026-06-05T12:00:00.000Z',
        updated: '2026-06-15T12:00:00.000Z'
      })
    ]
    var s = buildExecutiveSummary(issues, NOW)
    expect(s.avgCycleTime).toBe(10)
    expect(s.avgCycleTimeSample).toBe(1)
  })

  it('falls back to updated for throughput when resolved is null', function() {
    var issues = [
      issue({
        key: 'RECENT',
        statusCategory: 'Done',
        resolution: 'Done',
        resolved: null,
        created: '2026-07-01T12:00:00.000Z',
        updated: '2026-08-01T12:00:00.000Z'
      }),
      issue({
        key: 'OLD',
        statusCategory: 'Done',
        resolution: 'Done',
        resolved: null,
        created: '2025-12-01T12:00:00.000Z',
        updated: '2026-01-01T12:00:00.000Z'
      })
    ]
    var s = buildExecutiveSummary(issues, NOW)
    expect(s.throughput).toBe(1)
  })

  it('handles empty issue list', function() {
    var s = buildExecutiveSummary([], NOW)
    expect(s.total).toBe(0)
    expect(s.avgLeadTime).toBeNull()
    expect(s.avgCycleTime).toBeNull()
    expect(s.avgOpenAge).toBeNull()
    expect(s.bottlenecks).toEqual([])
  })
})
