import { describe, it, expect, vi } from 'vitest'

vi.mock('@/platform-loader', () => ({
  loadAllocationStrategy: () => ({
    id: 'ai-eng-40-40-20',
    name: '40/40/20 Allocation',
    description: 'AI Engineering allocation strategy',
    categories: [
      { key: 'tech-debt-quality', name: 'Tech Debt & Quality', color: 'amber', target: 40 },
      { key: 'new-features', name: 'New Features', color: 'blue', target: 40 },
      { key: 'learning-enablement', name: 'Learning & Enablement', color: 'green', target: 20 }
    ]
  })
}))

const { reports } = await import('../../../client/reports/registry')

describe('Report Registry', () => {
  it('has at least one report', () => {
    expect(reports.length).toBeGreaterThan(0)
  })

  it('all entries have required fields', () => {
    for (const report of reports) {
      expect(report).toHaveProperty('id')
      expect(report).toHaveProperty('title')
      expect(report).toHaveProperty('description')
      expect(report).toHaveProperty('icon')
      expect(report).toHaveProperty('tags')
      expect(report).toHaveProperty('component')
      expect(report).toHaveProperty('filters')
      expect(typeof report.id).toBe('string')
      expect(typeof report.title).toBe('string')
      expect(typeof report.description).toBe('string')
      expect(typeof report.icon).toBe('string')
      expect(Array.isArray(report.tags)).toBe(true)
      expect(typeof report.component).toBe('function')
      expect(Array.isArray(report.filters)).toBe(true)
    }
  })

  it('all IDs are unique', () => {
    const ids = reports.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('contains expected reports when strategy is configured', () => {
    const ids = reports.map(r => r.id)
    expect(ids).toContain('trends')
    expect(ids).toContain('team-comparison')
    expect(ids).toContain('allocation')
  })

  it('trends report uses org and team filters', () => {
    const trends = reports.find(r => r.id === 'trends')
    expect(trends.filters).toEqual(['org', 'team'])
  })

  it('allocation report uses no shared filters', () => {
    const allocation = reports.find(r => r.id === 'allocation')
    expect(allocation.filters).toEqual([])
  })

  it('allocation report description includes strategy name', () => {
    const allocation = reports.find(r => r.id === 'allocation')
    expect(allocation.description).toContain('40/40/20 Allocation')
  })
})

describe('Report Registry without strategy', () => {
  it('excludes allocation report when no strategy configured', async () => {
    vi.resetModules()
    vi.doMock('@/platform-loader', () => ({
      loadAllocationStrategy: () => null
    }))
    const { reports: reportsNoStrategy } = await import('../../../client/reports/registry')
    const ids = reportsNoStrategy.map(r => r.id)
    expect(ids).not.toContain('allocation')
    vi.doUnmock('@/platform-loader')
  })
})
