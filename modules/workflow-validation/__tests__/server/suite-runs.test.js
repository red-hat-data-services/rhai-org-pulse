import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import * as versionRules from '../../lib/versions.js'

const registerRoutes = require('../../server/index')
const { RUNS_INDEX, SUITE_RUNS_INDEX } = require('../../server/opensearch')
const { markSuiteRuns, addCoverage, suiteRunDetail } = require('../../server/suite-runs')
const { parseRecentRuns, pageRecentRuns } = require('../../server/recent-runs')(versionRules)

const workflow = number => ({ workflow_id: `workflow-${String(number).padStart(2, '0')}`, title: `Workflow ${number}` })
const expected = Array.from({ length: 30 }, (_, index) => workflow(index + 1))
const ids = numbers => numbers.map(number => workflow(number).workflow_id)
const announcement = (invocation_id, values = {}) => ({ suite: 'release-gate', telemetry_suite: 'release_gate', invocation_id,
  expected_workflows: expected, expected_total: expected.length, ...values })
const row = (invocationId, suite = 'release_gate') => ({ suite, invocationId, timestamp: '2026-11-25T12:00:00Z', rhoaiVersion: '3.6' })
const suiteRun = invocationId => ({ ...row(invocationId), suiteRun: true })
const hits = docs => ({ hits: { total: { value: docs.length }, hits: docs.map(_source => ({ _source })) } })
const missingIndex = () => Object.assign(new Error('OpenSearch request failed with 404'), { code: 'OS_ERROR', status: 404 })
/** Aggregation bucket of one run: the distinct ids it recorded and how many executions carried one. */
const ranBucket = (invocation, ran, { executions = ran.length, identified = executions } = {}) => ({
  key: { suite: 'release_gate', invocation }, doc_count: executions, identified: { value: identified },
  workflow_ids: { sum_other_doc_count: 0, buckets: [...new Set(ran)].map(key => ({ key, doc_count: ran.filter(id => id === key).length })) }
})
/** True when a query built from run pairs selects the announcement. */
const selects = (body, doc) => !body.query || body.query.bool.should.some(pair => pair.bool.filter[0].term.telemetry_suite === doc.telemetry_suite
  && pair.bool.filter[1].term.invocation_id === doc.invocation_id)
/** Search stub: announcements from one index, ran-workflow buckets from the other. */
function searchWith({ announcements = [], ran = [], announcementError, ranError, ranResponse = {} } = {}) {
  const requests = []
  const search = vi.fn(async (index, body) => {
    requests.push({ index, body })
    if (index === SUITE_RUNS_INDEX) {
      if (announcementError) throw announcementError
      return hits(announcements.filter(doc => selects(body, doc)))
    }
    if (ranError) throw ranError
    return { ...ranResponse, aggregations: { suite_runs: { buckets: ran } } }
  })
  return { search, requests }
}

afterEach(() => vi.unstubAllGlobals())

describe('Suite runs: marking announced runs', () => {
  it('marks a run with an announcement as a suite run and a run carrying only the label as ad hoc', async () => {
    const { search, requests } = searchWith({ announcements: [announcement('announced')] })
    const rows = [row('announced'), row('same-label-no-announcement'), row('announced', 'other_suite')]
    expect(await markSuiteRuns(rows, search)).toEqual([
      { ...rows[0], suiteRun: true }, { ...rows[1], suiteRun: false }, { ...rows[2], suiteRun: false }])
    // The scan reads identities only: no expected workflows and no executions.
    expect(requests).toHaveLength(1)
    expect(requests[0].body._source).toEqual(['telemetry_suite', 'invocation_id'])
  })

  it('treats a missing announcement index as no suite runs', async () => {
    const { search } = searchWith({ announcementError: missingIndex() })
    expect(await markSuiteRuns([row('run-a')], search)).toEqual([{ ...row('run-a'), suiteRun: false }])
  })

  it('returns the rows unchanged when announcements cannot be read', async () => {
    const rows = [row('run-a')]
    for (const announcementError of [new Error('unreachable'), Object.assign(new Error('forbidden'), { status: 403 })]) {
      expect(await markSuiteRuns(rows, searchWith({ announcementError }).search)).toBe(rows)
    }
    expect(await markSuiteRuns(rows, vi.fn(async () => ({ timed_out: true, hits: { hits: [] } })))).toBe(rows)
    expect(await markSuiteRuns(rows, vi.fn(async () => ({ _shards: { failed: 1 }, hits: { hits: [] } })))).toBe(rows)
  })

  it('ignores an announcement without a run identity', async () => {
    const { search } = searchWith({ announcements: [{ telemetry_suite: 'release_gate' }, { invocation_id: 'run-a' }] })
    expect(await markSuiteRuns([row('run-a')], search)).toEqual([{ ...row('run-a'), suiteRun: false }])
  })
})

describe('Suite runs: expected versus ran', () => {
  it('reports 28 of 30 and names the two workflows that did not run', async () => {
    const all = expected.map(item => item.workflow_id)
    const { search } = searchWith({ announcements: [announcement('run-a')], ran: [ranBucket('run-a', all.slice(0, 28))] })
    const [result] = await addCoverage([suiteRun('run-a')], search)
    expect(result).toMatchObject({ suite: 'release_gate', invocationId: 'run-a', suiteRun: true, suiteName: 'release-gate',
      workflowsExpected: 30, workflowsRan: 28 })
    expect(result.workflowsMissing).toEqual([
      { workflowId: 'workflow-29', title: 'Workflow 29' }, { workflowId: 'workflow-30', title: 'Workflow 30' }
    ])
  })

  it('counts a workflow executed twice once, and ignores a workflow the suite did not expect', async () => {
    const two = [workflow(1), workflow(2)]
    const { search } = searchWith({ announcements: [announcement('run-a', { expected_workflows: [...two, two[0], { title: 'No id' }] })],
      ran: [ranBucket('run-a', [...ids([1, 1, 1]), 'not-in-the-suite'])] })
    const [result] = await addCoverage([suiteRun('run-a')], search)
    expect(result).toMatchObject({ workflowsExpected: 2, workflowsRan: 1 })
    expect(result.workflowsMissing).toEqual([{ workflowId: 'workflow-02', title: 'Workflow 2' }])
  })

  it('reads coverage only for the suite runs it is given', async () => {
    const { search, requests } = searchWith({ announcements: [announcement('run-a'), announcement('not-on-this-page')], ran: [ranBucket('run-a', ids([1]))] })
    const adHoc = { ...row('ad-hoc'), suiteRun: false }, unknown = row('unknown')
    const result = await addCoverage([suiteRun('run-a'), adHoc, unknown], search)
    expect(result[1]).toBe(adHoc)
    expect(result[2]).toBe(unknown)
    expect(requests.map(request => request.index)).toEqual([SUITE_RUNS_INDEX, RUNS_INDEX])
    for (const request of requests) expect(request.body.query.bool.should).toHaveLength(1)
    expect(requests[1].body.aggs.suite_runs.aggs.workflow_ids).toEqual({ terms: { field: 'workflow_id', size: 1000 } })
    // A page without suite runs costs no search.
    const none = searchWith()
    const rows = [adHoc, unknown]
    expect(await addCoverage(rows, none.search)).toBe(rows)
    expect(none.requests).toHaveLength(0)
  })

  it('leaves the ran count unknown unless the result is complete and every execution recorded a workflow id', async () => {
    const all = expected.map(item => item.workflow_id)
    const unknown = { suiteRun: true, workflowsExpected: 30, workflowsRan: null, workflowsMissing: null }
    for (const ran of [[], [ranBucket('run-a', [], { executions: 3, identified: 0 })], [ranBucket('run-a', ids([1, 2]), { executions: 3, identified: 2 })]]) {
      const { search } = searchWith({ announcements: [announcement('run-a')], ran })
      expect((await addCoverage([suiteRun('run-a')], search))[0]).toMatchObject(unknown)
    }
    // A partial execution result must never report a workflow as missing.
    for (const ranResponse of [{ timed_out: true }, { _shards: { failed: 1 } }]) {
      const { search } = searchWith({ announcements: [announcement('run-a')], ran: [ranBucket('run-a', all.slice(0, 28))], ranResponse })
      expect((await addCoverage([suiteRun('run-a')], search))[0]).toMatchObject(unknown)
    }
    const { search } = searchWith({ announcements: [announcement('run-a')], ranError: new Error('search failed') })
    expect((await addCoverage([suiteRun('run-a')], search))[0]).toMatchObject(unknown)
  })

  it('keeps the suite-run mark without counts when the expected workflows cannot be read', async () => {
    const noCoverage = { ...suiteRun('run-a'), suiteName: null, workflowsExpected: null, workflowsRan: null, workflowsMissing: null }
    const unreadable = searchWith({ announcementError: new Error('unreachable') })
    expect(await addCoverage([suiteRun('run-a')], unreadable.search)).toEqual([noCoverage])
    expect(unreadable.requests).toHaveLength(1)
    const malformed = searchWith({ announcements: [{ telemetry_suite: 'release_gate', invocation_id: 'run-a' }] })
    expect(await addCoverage([suiteRun('run-a')], malformed.search)).toEqual([noCoverage])
  })

  it('describes one run', async () => {
    const two = { expected_workflows: [workflow(1), workflow(2)] }
    const ran = [ranBucket('run-a', ids([1, 1]))]
    expect(await suiteRunDetail('release_gate', 'run-a', searchWith({ announcements: [announcement('run-a', two)], ran }).search)).toEqual({
      suiteRun: true, suiteName: 'release-gate', workflowsExpected: 2, workflowsRan: 1,
      workflowsMissing: [{ workflowId: 'workflow-02', title: 'Workflow 2' }] })
    expect(await suiteRunDetail('release_gate', 'run-a', searchWith({ announcements: [announcement('run-a', two)],
      ran: [ranBucket('run-a', ids([1]), { executions: 2, identified: 1 })] }).search))
      .toMatchObject({ suiteRun: true, workflowsExpected: 2, workflowsRan: null, workflowsMissing: null })
    expect(await suiteRunDetail('release_gate', 'run-a', searchWith({ announcements: [announcement('another-run')], ran }).search)).toEqual({ suiteRun: false })
    expect(await suiteRunDetail('release_gate', 'run-a', searchWith({ announcementError: missingIndex() }).search)).toEqual({ suiteRun: false })
    expect(await suiteRunDetail('release_gate', 'run-a', searchWith({ announcementError: new Error('unreachable') }).search)).toEqual({})
    expect(await suiteRunDetail('release_gate', 'run-a', vi.fn(async () => ({ timed_out: true, hits: { total: { value: 0 }, hits: [] } })))).toEqual({})
  })
})

describe('Suite runs in the paged run list', () => {
  const rows = [
    { ...suiteRun('suite-run'), timestamp: '2026-11-25T12:00:00Z' },
    { ...row('ad-hoc-run'), suiteRun: false, timestamp: '2026-11-24T12:00:00Z' },
    { ...row('unknown-run'), timestamp: '2026-11-23T12:00:00Z' }
  ]
  const request = query => parseRecentRuns({ pageSize: '20', ...query })

  it('returns the suite-run mark for announced runs, the ad hoc mark for others, and nothing when unknown', () => {
    const page = pageRecentRuns(rows, request())
    expect(page.rows[0]).toEqual({ suite: 'release_gate', invocationId: 'suite-run', timestamp: '2026-11-25T12:00:00Z',
      rhoaiVersion: '3.6', buildDate: null, buildDateStatus: null, suiteRun: true,
      suiteName: null, workflowsExpected: null, workflowsRan: null, workflowsMissing: null })
    expect(page.rows[1]).toEqual({ suite: 'release_gate', invocationId: 'ad-hoc-run', timestamp: '2026-11-24T12:00:00Z',
      rhoaiVersion: '3.6', buildDate: null, buildDateStatus: null, suiteRun: false })
    expect(page.rows[2]).toEqual({ suite: 'release_gate', invocationId: 'unknown-run', timestamp: '2026-11-23T12:00:00Z',
      rhoaiVersion: '3.6', buildDate: null, buildDateStatus: null })
  })

  it('keeps ad hoc runs by default and hides them with suiteRunsOnly', () => {
    expect(pageRecentRuns(rows, request()).total).toBe(3)
    const filtered = pageRecentRuns(rows, request({ suiteRunsOnly: 'true', includeSummary: 'true' }))
    expect(filtered.rows.map(item => item.invocationId)).toEqual(['suite-run'])
    expect(filtered.summary.suiteRuns).toBe(1)
    expect(filtered.options.suites).toEqual(['release_gate'])
  })

  it('binds a cursor to the filter and leaves existing cursor scopes unchanged when it is off', () => {
    expect(request({ suiteRunsOnly: 'false' }).scope).toBe(request().scope)
    expect(request({ suiteRunsOnly: 'true' }).scope).not.toBe(request().scope)
    const many = Array.from({ length: 3 }, (_, index) => ({ ...rows[0], invocationId: `suite-run-${index}` }))
    const first = pageRecentRuns(many, request({ pageSize: '1', suiteRunsOnly: 'true' }))
    expect(() => request({ pageSize: '1', cursor: first.nextCursor })).toThrow(/Cursor/)
    expect(pageRecentRuns(many, request({ pageSize: '1', suiteRunsOnly: 'true', cursor: first.nextCursor })).start).toBe(2)
  })

  it.each([{ suiteRunsOnly: 'yes' }, { pageSize: undefined, suiteRunsOnly: 'true' }])('rejects %j', query => {
    expect(() => request(query)).toThrow()
  })
})

describe('Suite runs through the routes', () => {
  const executions = [
    { telemetry_suite: 'release_gate', invocation_id: 'run-a', workflow: 'first', workflow_id: 'workflow-01', verdict: 'PASS', timestamp: '2026-11-25T12:00:00Z' },
    { telemetry_suite: 'release_gate', invocation_id: 'run-a', workflow: 'first again', workflow_id: 'workflow-01', verdict: 'FAIL', timestamp: '2026-11-25T11:00:00Z' }
  ]
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
  function setup({ announcements = [announcement('run-a', { expected_workflows: [workflow(1), workflow(2)] })], announcementStatus = 200 } = {}) {
    const requests = []
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
      const body = options?.body ? JSON.parse(options.body) : null
      requests.push({ url, body })
      if (url.includes('_field_caps')) return json({ fields: { invocation_id: { keyword: { searchable: true, aggregatable: true } } } })
      if (url.includes('/workflow-execution-images/')) return json({ aggregations: { builds: { buckets: [] } } })
      if (url.includes(`/${SUITE_RUNS_INDEX}/`)) return announcementStatus === 200
        ? json(hits(announcements.filter(doc => selects(body, doc)))) : json({ error: 'failed' }, announcementStatus)
      if (url.includes('/workflow-root-causes/')) return json(hits([]))
      if (body.aggs?.suite_runs?.aggs?.workflow_ids) return json({ aggregations: { suite_runs: { buckets: [ranBucket('run-a', ids([1, 1]))] } } })
      if (body.aggs?.suite_runs) return json({ aggregations: { suite_runs: { buckets: ['run-a', 'run-b'].map(invocation => ({
        key: { suite: 'release_gate', invocation }, doc_count: 2, latest: hits([executions[0]]) })) } } })
      if (url.includes(`/${RUNS_INDEX}/`)) return json({ hits: { hits: executions.map((_source, index) => ({ _id: `execution-${index}`, _source })) } })
      throw new Error(`Unexpected test request: ${url}`)
    }))
    const routes = {}
    registerRoutes({ get: (path, ...handlers) => { routes[path] = handlers }, post() {} }, { requireAuth() {}, secrets: {} })
    const get = async (path, request) => {
      const res = Object.assign(new EventEmitter(), { statusCode: 200,
        status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
      await routes[path].at(-1)(request, res)
      return res
    }
    return { get, requests }
  }
  const detail = { params: { suite: 'release_gate', invocationId: 'run-a' }, query: {} }

  it('marks suite and ad hoc runs in the paged list and filters to suite runs', async () => {
    const { get } = setup()
    const all = await get('/test-suites', { query: { pageSize: '20' } })
    expect(all.statusCode).toBe(200)
    const byRun = Object.fromEntries(all.body.rows.map(item => [item.invocationId, item]))
    expect(byRun['run-a']).toMatchObject({ suiteRun: true, suiteName: 'release-gate', workflowsExpected: 2, workflowsRan: 1,
      workflowsMissing: [{ workflowId: 'workflow-02', title: 'Workflow 2' }] })
    expect(byRun['run-b']).toMatchObject({ suiteRun: false })
    expect(byRun['run-b']).not.toHaveProperty('workflowsExpected')
    const only = await get('/test-suites', { query: { pageSize: '20', suiteRunsOnly: 'true' } })
    expect(only.body.rows.map(item => item.invocationId)).toEqual(['run-a'])
  })

  it('reads coverage for the returned page only', async () => {
    const { get, requests } = setup({ announcements: [announcement('run-a'), announcement('run-b')] })
    const first = await get('/test-suites', { query: { pageSize: '1' } })
    expect(first.body.rows).toHaveLength(1)
    expect(first.body.total).toBe(2)
    const coverage = requests.filter(request => request.body?.query?.bool?.should)
    expect(coverage.map(request => request.body.query.bool.should.length)).toEqual([1, 1])
  })

  it.each([[404, false], [500, undefined]])('renders the list when the announcement index answers %i', async (announcementStatus, suiteRunMark) => {
    const all = await setup({ announcementStatus }).get('/test-suites', { query: { pageSize: '20' } })
    expect(all.statusCode).toBe(200)
    expect(all.body.rows).toHaveLength(2)
    expect(all.body.rows.map(item => item.suiteRun)).toEqual([suiteRunMark, suiteRunMark])
  })

  it('adds expected versus ran to the run detail', async () => {
    const announced = await setup().get('/test-suites/:suite/:invocationId', detail)
    expect(announced.statusCode).toBe(200)
    expect(announced.body).toMatchObject({ suite: 'release_gate', invocationId: 'run-a', suiteRun: true, suiteName: 'release-gate',
      workflowsExpected: 2, workflowsRan: 1, workflowsMissing: [{ workflowId: 'workflow-02', title: 'Workflow 2' }] })
    expect(announced.body.summary.tests).toBe(2)
    const adHoc = await setup({ announcements: [] }).get('/test-suites/:suite/:invocationId', detail)
    expect(adHoc.body).toMatchObject({ suiteRun: false, summary: { tests: 2 } })
    const unknown = await setup({ announcementStatus: 500 }).get('/test-suites/:suite/:invocationId', detail)
    expect(unknown.statusCode).toBe(200)
    expect(unknown.body).not.toHaveProperty('suiteRun')
  })
})
