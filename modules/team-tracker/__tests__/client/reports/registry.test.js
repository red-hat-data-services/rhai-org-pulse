import { describe, it, expect } from 'vitest'
import { reports } from '../../../client/reports/registry'

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

  it('contains expected reports', () => {
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
})
