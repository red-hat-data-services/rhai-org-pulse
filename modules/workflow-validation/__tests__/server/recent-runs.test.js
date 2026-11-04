import { describe, expect, it } from 'vitest'
const { parseRecentRuns, pageRecentRuns } = require('../../server/recent-runs')

const rows = Array.from({ length: 47 }, (_, index) => ({
  suite: index % 2 ? 'release_gate' : 'ad-hoc', invocationId: `run-${String(index).padStart(2, '0')}`,
  timestamp: new Date(Date.UTC(2026, 0, index + 1)).toISOString(), rhoaiVersion: index === 0 ? '3.0' : '3.6'
}))
const request = query => parseRecentRuns({ pageSize: '20', ...query })

describe('Recent run pagination', () => {
  it('shows the newest 20 initially and visits every run exactly once in both directions', () => {
    const first = pageRecentRuns(rows, request())
    expect(first).toMatchObject({ total: 47, start: 1, end: 20, previousCursor: null })
    expect(first.rows[0].invocationId).toBe('run-46')
    const second = pageRecentRuns(rows, request({ cursor: first.nextCursor }))
    const last = pageRecentRuns(rows, request({ cursor: second.nextCursor }))
    expect(last).toMatchObject({ total: 47, start: 41, end: 47, nextCursor: null })
    expect(new Set([...first.rows, ...second.rows, ...last.rows].map(row => row.invocationId)).size).toBe(47)
    const back = pageRecentRuns(rows, request({ cursor: last.previousCursor }))
    expect(back.rows).toEqual(second.rows)
    expect(pageRecentRuns(rows, request({ cursor: back.previousCursor })).rows).toEqual(first.rows)
  })

  it('filters the full dataset and keeps filter choices outside the first page', () => {
    const first = pageRecentRuns(rows, request())
    expect(first.options.versions).toContain('3.0')
    expect(first.rows.every(row => row.rhoaiVersion !== '3.0')).toBe(true)
    const result = pageRecentRuns(rows, request({ version: '3.0', suite: 'ad-hoc', runQuery: 'RUN-00' }))
    expect(result.total).toBe(1)
    expect(result.rows[0].invocationId).toBe('run-00')
    expect(result.options.versions).toEqual(first.options.versions)
  })

  it('keeps a next-page anchor when newer runs arrive', () => {
    const first = pageRecentRuns(rows, request())
    const inserted = { suite: 'ad-hoc', invocationId: 'new-run', timestamp: '2026-03-01T00:00:00Z', rhoaiVersion: '3.6' }
    const next = pageRecentRuns([...rows, inserted], request({ cursor: first.nextCursor }))
    expect(next.total).toBe(48)
    expect(next.rows).toEqual(pageRecentRuns(rows, request({ cursor: first.nextCursor })).rows)
    expect(next.rows.some(row => first.rows.some(previous => row.invocationId === previous.invocationId))).toBe(false)
  })

  it('filters the run timestamp by inclusive UTC dates and supports oldest first', () => {
    const result = pageRecentRuns(rows, request({ dateFrom: '2026-01-02', dateTo: '2026-01-04', sortDir: 'asc' }))
    expect(result.rows.map(row => row.invocationId)).toEqual(['run-01', 'run-02', 'run-03'])
  })

  it('keeps missing and invalid times last and breaks equal-time ties by exact run identity', () => {
    const input = [
      { suite: 's', invocationId: 'z', timestamp: '2026-01-01T12:00:00Z' },
      { suite: 's', invocationId: 'a', timestamp: '2026-01-01T10:00:00-02:00' },
      { suite: 's', invocationId: 'missing', timestamp: null },
      { suite: 's', invocationId: 'invalid', timestamp: 'not-a-date' }
    ]
    for (const sortDir of ['asc', 'desc']) {
      const query = { pageSize: '1', sortDir }
      let result = pageRecentRuns(input, parseRecentRuns(query))
      const ids = []
      let next
      do {
        ids.push(...result.rows.map(row => row.invocationId))
        next = result.nextCursor
        if (next) result = pageRecentRuns(input, parseRecentRuns({ ...query, cursor: next }))
      } while (next)
      expect(ids).toEqual(['a', 'z', 'invalid', 'missing'])
    }
    expect(pageRecentRuns(input, request({ dateFrom: '2026-01-01' })).total).toBe(2)
  })

  it('rejects cursors reused with different filters, sorting, or page size', () => {
    const cursor = pageRecentRuns(rows, request()).nextCursor
    for (const changed of [{ version: '3.0' }, { sortDir: 'asc' }, { pageSize: '10' }]) {
      expect(() => parseRecentRuns({ pageSize: '20', cursor, ...changed })).toThrow(/Cursor/)
    }
  })

  it.each([
    { pageSize: '0' }, { pageSize: '201' }, { pageSize: '20x' }, { sortDir: 'sideways' },
    { dateFrom: '2026-02-31' }, { dateFrom: '2026-02-01', dateTo: '2026-01-01' },
    { version: ['3.5', '3.6'] }, { cursor: 'not-json' }, { limit: '20' }
  ])('rejects invalid page parameters: %j', values => {
    expect(() => request(values)).toThrow()
  })

  it('returns empty results with filter choices and recovers a page whose remaining rows disappeared', () => {
    const first = pageRecentRuns(rows, request())
    const empty = pageRecentRuns([], request())
    expect(empty).toMatchObject({ total: 0, rows: [], start: 0, end: 0, nextCursor: null, previousCursor: null })
    const missing = pageRecentRuns(rows, request({ runQuery: 'does-not-exist' }))
    expect(missing).toMatchObject({ total: 0, rows: [] })
    expect(missing.options.versions).toContain('3.0')
    const changed = pageRecentRuns(first.rows, request({ cursor: first.nextCursor }))
    expect(changed).toMatchObject({ rows: [], total: 20, previousCursor: '' })
  })
})
