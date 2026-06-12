import { describe, it, expect } from 'vitest'

const {
  extractAdfText,
  classifyEpic,
  buildInsight,
  INACTIVE_THRESHOLD_DAYS,
  CRITICAL_THRESHOLD_DAYS,
} = require('../../server/analysis')

describe('extractAdfText', () => {
  it('returns empty string for null/undefined', () => {
    expect(extractAdfText(null)).toBe('')
    expect(extractAdfText(undefined)).toBe('')
  })

  it('returns plain strings as-is', () => {
    expect(extractAdfText('hello')).toBe('hello')
  })

  it('extracts text from ADF node', () => {
    const node = { text: 'hello' }
    expect(extractAdfText(node)).toBe('hello')
  })

  it('extracts text from nested ADF content', () => {
    const node = {
      content: [
        { text: 'hello ' },
        { content: [{ text: 'world' }] },
      ],
    }
    expect(extractAdfText(node)).toBe('hello world')
  })

  it('handles arrays', () => {
    expect(extractAdfText([{ text: 'a' }, { text: 'b' }])).toBe('ab')
  })
})

describe('classifyEpic', () => {
  const today = new Date('2026-06-07T12:00:00Z')

  function makeEpic(overrides = {}) {
    return {
      children: overrides.children || [],
      last_comment: overrides.last_comment || { date: null },
      ...overrides,
    }
  }

  it('classifies as all_children_closed when all children are Closed', () => {
    const epic = makeEpic({
      children: [
        { status: 'Closed' },
        { status: 'Closed' },
      ],
      last_comment: { date: '2026-06-06T10:00:00Z' },
    })
    const result = classifyEpic(epic, today, INACTIVE_THRESHOLD_DAYS)
    expect(result.category).toBe('all_children_closed')
    expect(result.all_children_closed).toBe(true)
    expect(result.closed_children).toBe(2)
    expect(result.total_children).toBe(2)
  })

  it('classifies as active when comment is recent', () => {
    const epic = makeEpic({
      children: [{ status: 'In Progress' }],
      last_comment: { date: '2026-06-05T10:00:00Z' },
    })
    const result = classifyEpic(epic, today, INACTIVE_THRESHOLD_DAYS)
    expect(result.category).toBe('active')
  })

  it('classifies as moderate when inactive 5-30 days', () => {
    const epic = makeEpic({
      children: [{ status: 'In Progress' }],
      last_comment: { date: '2026-05-20T10:00:00Z' },
    })
    const result = classifyEpic(epic, today, INACTIVE_THRESHOLD_DAYS)
    expect(result.category).toBe('moderate')
    expect(result.days_since).toBeGreaterThan(INACTIVE_THRESHOLD_DAYS)
    expect(result.days_since).toBeLessThan(CRITICAL_THRESHOLD_DAYS)
  })

  it('classifies as critical when inactive 30+ days', () => {
    const epic = makeEpic({
      children: [{ status: 'In Progress' }],
      last_comment: { date: '2026-04-01T10:00:00Z' },
    })
    const result = classifyEpic(epic, today, INACTIVE_THRESHOLD_DAYS)
    expect(result.category).toBe('critical')
    expect(result.days_since).toBeGreaterThanOrEqual(CRITICAL_THRESHOLD_DAYS)
  })

  it('classifies as active when no comment date', () => {
    const epic = makeEpic({
      children: [{ status: 'In Progress' }],
      last_comment: { date: null },
    })
    const result = classifyEpic(epic, today, INACTIVE_THRESHOLD_DAYS)
    expect(result.category).toBe('active')
    expect(result.days_since).toBeNull()
  })

  it('builds child_summary with status counts', () => {
    const epic = makeEpic({
      children: [
        { status: 'Closed' },
        { status: 'In Progress' },
        { status: 'In Progress' },
        { status: 'To Do' },
      ],
      last_comment: { date: '2026-06-06T10:00:00Z' },
    })
    const result = classifyEpic(epic, today, INACTIVE_THRESHOLD_DAYS)
    expect(result.child_summary).toContain('1/4 Closed')
    expect(result.child_summary).toContain('2 In Progress')
    expect(result.child_summary).toContain('1 To Do')
  })

  it('returns "No children" for empty children', () => {
    const epic = makeEpic({ children: [], last_comment: { date: null } })
    const result = classifyEpic(epic, today, INACTIVE_THRESHOLD_DAYS)
    expect(result.child_summary).toBe('No children')
  })
})

describe('buildInsight', () => {
  function makeEpic(overrides = {}) {
    return {
      status: overrides.status || 'In Progress',
      last_comment: overrides.last_comment || { date: null, by: '', text: '' },
      classification: overrides.classification || {
        all_children_closed: false,
        total_children: 1,
        days_since: null,
      },
      ...overrides,
    }
  }

  it('flags all children closed with stuck status', () => {
    const epic = makeEpic({
      status: 'In Progress',
      classification: { all_children_closed: true, total_children: 3, days_since: null },
      last_comment: { by: '', text: '' },
    })
    const insight = buildInsight(epic)
    expect(insight).toContain('All 3 children closed')
    expect(insight).toContain('stuck in In Progress')
  })

  it('flags no child stories', () => {
    const epic = makeEpic({
      classification: { all_children_closed: false, total_children: 0, days_since: null },
      last_comment: { by: '', text: '' },
    })
    expect(buildInsight(epic)).toContain('No child stories created')
  })

  it('detects deprioritization keywords', () => {
    const epic = makeEpic({
      classification: { all_children_closed: false, total_children: 1, days_since: 10 },
      last_comment: { by: 'Alice', text: 'This is a nice-to-have feature' },
    })
    expect(buildInsight(epic)).toContain('Deprioritized')
  })

  it('detects blocked keywords', () => {
    const epic = makeEpic({
      classification: { all_children_closed: false, total_children: 1, days_since: 10 },
      last_comment: { by: 'Bob', text: 'We are blocked on upstream' },
    })
    expect(buildInsight(epic)).toContain('Possibly blocked')
  })

  it('flags potential duplicate children', () => {
    const epic = makeEpic({
      classification: { all_children_closed: false, total_children: 5, days_since: null },
      last_comment: { by: 'Eve', text: '' },
    })
    expect(buildInsight(epic)).toContain('duplicate child stories')
  })

  it('returns default insight when nothing special', () => {
    const epic = makeEpic({
      status: 'Review',
      classification: { all_children_closed: false, total_children: 2, days_since: null },
      last_comment: { by: 'Dan', text: 'Looks good' },
    })
    const insight = buildInsight(epic)
    expect(insight).toContain('Status: Review')
    expect(insight).toContain('Dan')
  })
})
