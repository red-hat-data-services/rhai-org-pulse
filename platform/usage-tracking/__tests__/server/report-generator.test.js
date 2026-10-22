// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { parseEvents, generateReport } from '../../server/report-generator.js'

describe('parseEvents', () => {
  it('parses JSONL content', () => {
    const content = '{"ts":"2026-10-12T00:00:00Z","module":"ai-impact","action":"view"}\n{"ts":"2026-10-12T00:01:00Z","module":"releases","action":"view"}\n'
    const events = parseEvents(content)
    expect(events).toHaveLength(2)
    expect(events[0].module).toBe('ai-impact')
    expect(events[1].module).toBe('releases')
  })

  it('skips invalid JSON lines', () => {
    const content = '{"valid":true}\nnot json\n{"also":"valid"}\n'
    const events = parseEvents(content)
    expect(events).toHaveLength(2)
  })

  it('returns empty array for null', () => {
    expect(parseEvents(null)).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseEvents('')).toEqual([])
  })
})

describe('generateReport', () => {
  const sampleEvents = [
    { ts: '2026-10-12T10:00:00Z', module: 'ai-impact', view: 'autofix', action: 'view', userId: 'user1', persona: 'developer', org: 'rhai' },
    { ts: '2026-10-12T10:01:00Z', module: 'ai-impact', view: 'autofix', action: 'filter', target: 'timeWindow:month', userId: 'user1', persona: 'developer', org: 'rhai' },
    { ts: '2026-10-12T10:02:00Z', module: 'ai-impact', view: 'rfe-review', action: 'view', userId: 'user2', persona: 'engineering-manager', org: 'rhai' },
    { ts: '2026-10-12T10:03:00Z', module: 'ai-impact', view: 'autofix', action: 'navigate', target: 'rfe-review', userId: 'user1', persona: 'developer', org: 'rhai' },
    { ts: '2026-10-12T10:04:00Z', module: 'releases', view: 'pipeline', action: 'view', userId: 'user1', persona: 'developer', org: 'rhai' },
    { ts: '2026-10-12T10:05:00Z', module: 'ai-impact', view: 'autofix', action: 'view', userId: 'user1', persona: 'developer', org: 'rhai' }
  ]

  it('generates a report with summary section', () => {
    const report = generateReport(sampleEvents, '2026-10-06', '2026-10-12')
    expect(report).toContain('SUMMARY')
    expect(report).toContain('Total visits:')
    expect(report).toContain('Total interactions:')
    expect(report).toContain('Distinct users:')
  })

  it('counts visits and interactions correctly', () => {
    const report = generateReport(sampleEvents, '2026-10-06', '2026-10-12')
    expect(report).toContain('Total visits:        4')
    expect(report).toContain('Total interactions:  2')
    expect(report).toContain('Distinct users:      2')
  })

  it('includes BY MODULE section', () => {
    const report = generateReport(sampleEvents, '2026-10-06', '2026-10-12')
    expect(report).toContain('BY MODULE')
    expect(report).toContain('ai-impact')
    expect(report).toContain('releases')
  })

  it('includes AI IMPACT BREAKDOWN section', () => {
    const report = generateReport(sampleEvents, '2026-10-06', '2026-10-12')
    expect(report).toContain('AI IMPACT BREAKDOWN')
    expect(report).toContain('autofix')
    expect(report).toContain('rfe-review')
  })

  it('includes BY PERSONA section', () => {
    const report = generateReport(sampleEvents, '2026-10-06', '2026-10-12')
    expect(report).toContain('BY PERSONA')
    expect(report).toContain('developer')
    expect(report).toContain('engineering-manager')
  })

  it('includes navigation flows', () => {
    const report = generateReport(sampleEvents, '2026-10-06', '2026-10-12')
    expect(report).toContain('NAVIGATION FLOWS')
    expect(report).toContain('autofix → rfe-review')
  })

  it('includes measurement gaps', () => {
    const report = generateReport(sampleEvents, '2026-10-06', '2026-10-12')
    expect(report).toContain('MEASUREMENT GAPS')
    expect(report).toContain('system-health')
  })

  it('includes period dates', () => {
    const report = generateReport(sampleEvents, '2026-10-06', '2026-10-12')
    expect(report).toContain('2026-10-06')
    expect(report).toContain('2026-10-12')
  })

  it('handles empty events array', () => {
    const report = generateReport([], '2026-10-06', '2026-10-12')
    expect(report).toContain('Total visits:        0')
    expect(report).toContain('Distinct users:      0')
  })

  it('handles __proto__ module and view without crashing', () => {
    const poisonEvents = [
      { ts: '2026-10-12T10:00:00Z', module: '__proto__', view: '__proto__', action: 'view', userId: 'u1', persona: 'dev' },
      { ts: '2026-10-12T10:01:00Z', module: 'constructor', view: 'toString', action: 'view', userId: 'u2', persona: 'dev' },
      { ts: '2026-10-12T10:02:00Z', module: 'ai-impact', view: '__proto__', action: 'view', userId: 'u1', persona: 'dev' }
    ]
    const report = generateReport(poisonEvents, '2026-10-06', '2026-10-12')
    expect(report).toContain('__proto__')
    expect(report).toContain('constructor')
    expect(report).toContain('Total visits:        3')
    expect({}.visits).toBeUndefined()
  })

  it('accepts custom knownModules for measurement gaps', () => {
    const report = generateReport(sampleEvents, '2026-10-06', '2026-10-12', ['ai-impact', 'releases', 'custom-module'])
    expect(report).toContain('custom-module')
    expect(report).not.toContain('system-health')
  })
})
