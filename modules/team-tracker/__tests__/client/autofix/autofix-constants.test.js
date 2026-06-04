import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeTeamMetrics, buildTeamTrendData, STATE_OPTIONS } from '../../../client/components/autofix/autofix-constants.js'

describe('autofix-constants', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('computeTeamMetrics', () => {
    it('computes correct metrics for a set of issues', () => {
      const issues = [
        { key: 'A-1', created: '2026-05-20', pipelineState: 'autofix-merged', issueType: 'Bug' },
        { key: 'A-2', created: '2026-05-21', pipelineState: 'autofix-review', issueType: 'Bug' },
        { key: 'A-3', created: '2026-05-22', pipelineState: 'autofix-rejected', issueType: 'Story' },
        { key: 'A-4', created: '2026-05-23', pipelineState: 'autofix-max-retries', issueType: 'Bug' },
        { key: 'A-5', created: '2026-05-24', pipelineState: 'triage-pending', issueType: 'Bug' },
        { key: 'A-6', created: '2026-01-01', pipelineState: 'autofix-merged', issueType: 'Bug' } // outside month window
      ]

      const result = computeTeamMetrics(issues, 'month')

      expect(result.windowTotal).toBe(5)
      expect(result.totalIssues).toBe(6)
      expect(result.autofixStates.merged).toBe(1)
      expect(result.autofixStates.review).toBe(1)
      expect(result.autofixStates.rejected).toBe(1)
      expect(result.autofixStates.maxRetries).toBe(1)
      expect(result.terminalTotal).toBe(3) // merged + rejected + maxRetries
      expect(result.successRate).toBe(33) // 1/3 = 33%
    })
  })

  describe('buildTeamTrendData', () => {
    it('produces correct weekly buckets for month time window', () => {
      const issues = [
        { key: 'A-1', created: '2026-05-28', pipelineState: 'autofix-merged' },
        { key: 'A-2', created: '2026-05-29', pipelineState: 'autofix-review' },
        { key: 'A-3', created: '2026-05-15', pipelineState: 'triage-pending' }
      ]

      const result = buildTeamTrendData(issues, 'month')

      expect(result).toHaveLength(8) // month = 8 weekly buckets
      expect(result[result.length - 1].date).toBe('2026-06-01')
      // Verify each bucket has expected fields
      for (const point of result) {
        expect(point).toHaveProperty('date')
        expect(point).toHaveProperty('triaged')
        expect(point).toHaveProperty('autofixed')
        expect(point).toHaveProperty('merged')
        expect(point).toHaveProperty('review')
      }
    })
  })

  describe('STATE_OPTIONS', () => {
    it('contains all expected pipeline states', () => {
      const values = STATE_OPTIONS.map(o => o.value)
      expect(values).toContain('all')
      expect(values).toContain('triage-pending')
      expect(values).toContain('triage-missing-info')
      expect(values).toContain('triage-not-fixable')
      expect(values).toContain('triage-stale')
      expect(values).toContain('autofix-ready')
      expect(values).toContain('autofix-pending')
      expect(values).toContain('autofix-review')
      expect(values).toContain('autofix-ci-failing')
      expect(values).toContain('autofix-merged')
      expect(values).toContain('autofix-rejected')
      expect(values).toContain('autofix-max-retries')
      expect(values).toContain('autofix-researched')
      expect(values).toContain('autofix-blocked')
    })
  })
})
