import { describe, expect, it } from 'vitest'
import * as versionRules from '../../lib/versions.js'
const { parseRecentRuns, pageRecentRuns } = require('../../server/recent-runs')(versionRules)

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

  it('round-trips long IDs using bounded cursors without truncating returned identities', () => {
    const suite = 's'.repeat(9000)
    const input = ['a', 'b', 'c'].map(id => ({ suite, invocationId: 'i'.repeat(9000) + id, timestamp: rows[0].timestamp }))
    const query = { pageSize: '1' }
    const first = pageRecentRuns(input, parseRecentRuns(query))
    expect(first.rows[0].suite).toBe(suite)
    expect(first.nextCursor.length).toBeLessThan(512)
    const second = pageRecentRuns(input, parseRecentRuns({ ...query, cursor: first.nextCursor }))
    expect(second.rows[0].invocationId).toBe(input[1].invocationId)
    const previous = pageRecentRuns(input, parseRecentRuns({ ...query, cursor: second.previousCursor }))
    expect(previous.rows).toEqual(first.rows)
    const last = pageRecentRuns(input, parseRecentRuns({ ...query, cursor: second.nextCursor, refresh: 'true' }))
    expect(last.rows).toEqual([input[2]])
    expect(last.nextCursor).toBeNull()
  })

  it('accepts earlier raw-ID cursors and resets safely when a hashed anchor was deleted', () => {
    const first = pageRecentRuns(rows, request())
    const decoded = JSON.parse(Buffer.from(first.nextCursor, 'base64url').toString())
    const origin = first.rows.at(-1)
    const old = Buffer.from(JSON.stringify({ ...decoded, v: 1,
      anchor: [Date.parse(origin.timestamp), origin.suite, origin.invocationId] })).toString('base64url')
    expect(pageRecentRuns(rows, request({ cursor: old })).rows).toEqual(pageRecentRuns(rows, request({ cursor: first.nextCursor })).rows)
    expect(pageRecentRuns(rows.filter(row => row.invocationId !== origin.invocationId), request({ cursor: first.nextCursor })))
      .toMatchObject({ rows: [], total: 46, previousCursor: '' })
    const malformed = Buffer.from(JSON.stringify({ ...decoded, anchor: [null, 'short-hash', {}] })).toString('base64url')
    expect(() => request({ cursor: malformed })).toThrow(/Cursor/)
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
    { version: ['3.5', '3.6'] }, { cursor: 'not-json' }, { limit: '20' }, { refresh: 'maybe' }
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


describe('Recent Runs multi-version and column sorting', () => {
  const releases = ['3.6.0', '3.6.0-ea.2', '3.6.0-ea.1', '3.6', '3.5.2', '3.10.0', null]
  const input = Array.from({ length: 83 }, (_, index) => ({ suite: ['z-suite', 'ad_hoc', 'Release-Gate'][index % 3], invocationId: `item-${index}`,
    timestamp: index % 11 ? new Date(Date.UTC(2026, 0, index % 23 + 1)).toISOString() : null, rhoaiVersion: releases[index % releases.length] }))

  it('matches both legacy 3.6 and 3.6.0 while keeping EA releases separate', () => {
    const sample = [{ ...rows[0], rhoaiVersion: '3.6.0 EA1' }, { ...rows[1], rhoaiVersion: '3.6.0-ea.1' }, { ...rows[2], rhoaiVersion: '3.6.0' }, { ...rows[3], rhoaiVersion: '3.6' }]
    const result = pageRecentRuns(sample, request({ versions: ['3.6.0-ea.1', '3.6.0'] }))
    expect(result.total).toBe(4)
    expect(result.options.versions).toEqual(['3.6.0', '3.6.0-ea.1'])
    expect(pageRecentRuns(sample, request({ versions: '3.6.0' })).total).toBe(2)
    expect(pageRecentRuns(sample, request({ version: '3.6' })).total).toBe(2)
  })

  it.each(['timestamp', 'version', 'suite'])('traverses the whole dataset in both directions sorted by %s', sortField => {
    for (const sortDir of ['asc', 'desc']) {
      const query = { pageSize: '7', sortField, sortDir }
      let page = pageRecentRuns(input, parseRecentRuns(query))
      const pages = [page], all = [...page.rows]
      while (page.nextCursor) {
        page = pageRecentRuns(input, parseRecentRuns({ ...query, cursor: page.nextCursor }))
        pages.push(page); all.push(...page.rows)
        expect(pages.length).toBeLessThan(20)
      }
      expect(all).toHaveLength(input.length)
      expect(new Set(all.map(row => JSON.stringify([row.suite, row.invocationId]))).size).toBe(input.length)
      const expected = pageRecentRuns(input, parseRecentRuns({ pageSize: '200', sortField, sortDir })).rows
      expect(all).toEqual(expected)
      for (let index = pages.length - 1; index > 0; index--) {
        const previous = pageRecentRuns(input, parseRecentRuns({ ...query, cursor: pages[index].previousCursor }))
        expect(previous.rows).toEqual(pages[index - 1].rows)
      }
    }
  })

  it.each(['asc', 'desc'])('keeps invalid versions last through forward and backward %s pagination', sortDir => {
    const sample = ['3.6.0', 'broken', null, '3.5.0', '', 'custom'].map((rhoaiVersion, index) =>
      ({ suite: 'suite', invocationId: `id-${index}`, rhoaiVersion, timestamp: rows[0].timestamp }))
    const query = { pageSize: '1', sortField: 'version', sortDir }
    let page = pageRecentRuns(sample, request(query))
    const pages = [page]
    while (page.nextCursor) {
      page = pageRecentRuns(sample, request({ ...query, cursor: page.nextCursor }))
      pages.push(page)
      expect(pages.length).toBeLessThanOrEqual(sample.length)
    }
    expect(pages.flatMap(page => page.rows.map(row => row.invocationId)))
      .toEqual([...(sortDir === 'asc' ? ['id-3', 'id-0'] : ['id-0', 'id-3']), 'id-1', 'id-2', 'id-4', 'id-5'])
    for (let index = pages.length - 1; index > 0; index--)
      expect(pageRecentRuns(sample, request({ ...query, cursor: pages[index].previousCursor })).rows).toEqual(pages[index - 1].rows)
  })

  it('keeps cursor scope stable when unknown labels differ only in case or numeric spelling', () => {
    const sample = ['Custom', 'custom', 'build2', 'build02'].map((rhoaiVersion, index) => ({ ...rows[index], rhoaiVersion }))
    const versions = sample.map(row => row.rhoaiVersion)
    const query = { pageSize: '1', versions }
    const first = pageRecentRuns(sample, request(query))
    expect(pageRecentRuns(sample, request({ ...query, versions: [...versions].reverse(), cursor: first.nextCursor })).start).toBe(2)
  })

  it('uses release order for versions and visible suite names for alphabetic sorting', () => {
    const version = pageRecentRuns(input, request({ sortField: 'version' }))
    expect(version.rows[0].rhoaiVersion).toBe('3.10.0')
    const suite = pageRecentRuns(input, request({ sortField: 'suite', sortDir: 'asc' }))
    expect(suite.rows[0].suite).toBe('ad_hoc')
    const reversed = pageRecentRuns(input, request({ sortField: 'suite', sortDir: 'desc' }))
    expect(reversed.rows[0].suite).toBe('z-suite')
  })

  it('binds cursors to the selected set and column while allowing equivalent selection order', () => {
    const query = { versions: ['3.6.0', '3.5.2'], sortField: 'version' }
    const first = pageRecentRuns(input, request({ ...query, pageSize: '3' }))
    const normal = pageRecentRuns(input, request({ ...query, pageSize: '3', cursor: first.nextCursor }))
    const reordered = pageRecentRuns(input, request({ versions: ['3.5.2', '03.06.00'], sortField: 'version', pageSize: '3', cursor: first.nextCursor }))
    expect(reordered.rows).toEqual(normal.rows)
    expect(() => request({ ...query, pageSize: '3', cursor: first.nextCursor, sortField: 'suite' })).toThrow(/Cursor/)
    expect(() => request({ ...query, pageSize: '3', cursor: first.nextCursor, versions: ['3.6.0'] })).toThrow(/Cursor/)
  })

  it('continues real v1/v2 bookmarks using their original scope', () => {
    const { createHash } = require('node:crypto')
    const first = pageRecentRuns(rows, request())
    const origin = first.rows.at(-1)
    const scope = createHash('sha256').update(JSON.stringify([{ version: '', suite: '', runQuery: '', dateFrom: '', dateTo: '' }, 'desc', 20])).digest('hex')
    for (const v of [1, 2]) {
      const identity = value => v === 1 ? value : createHash('sha256').update(value).digest('hex')
      const cursor = Buffer.from(JSON.stringify({ v, scope, direction: 'after', anchor: [Date.parse(origin.timestamp), identity(origin.suite), identity(origin.invocationId)] })).toString('base64url')
      expect(pageRecentRuns(rows, request({ cursor })).rows).toEqual(pageRecentRuns(rows, request({ cursor: first.nextCursor })).rows)
    }
  })

  it.each(['timestamp', 'version'])('never repeats the anchor when its %s changes', sortField => {
    const query = { pageSize: '3', sortField }
    const first = pageRecentRuns(input, request(query))
    const origin = first.rows.at(-1)
    const updated = input.map(row => row.invocationId === origin.invocationId ? { ...row, timestamp: '1990-01-01T00:00:00Z', rhoaiVersion: '1.0.0' } : row)
    const next = pageRecentRuns(updated, request({ ...query, cursor: first.nextCursor }))
    expect(next.rows.some(row => row.invocationId === origin.invocationId)).toBe(false)
  })

  it.each([{ versions: [''] }, { versions: [{}] }, { versions: Array(51).fill('3.6.0') }, { versions: '3.6.0', version: '3.5.0' }, { sortField: 'execution_id' }])('rejects malformed multi-version/sort parameters %j', query => {
    expect(() => request(query)).toThrow()
  })
})
