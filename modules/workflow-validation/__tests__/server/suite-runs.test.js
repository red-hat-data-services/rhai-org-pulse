import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import * as versionRules from '../../lib/versions.js'

const registerRoutes = require('../../server/index')
const { RUNS_INDEX, SUITE_RUNS_INDEX } = require('../../server/opensearch')
const { addSuiteRuns, suiteRunDetail } = require('../../server/suite-runs')
const { parseRecentRuns, pageRecentRuns } = require('../../server/recent-runs')(versionRules)

const workflow = number => ({ workflow_id: `workflow-${String(number).padStart(2, '0')}`, title: `Workflow ${number}` })
const expected = Array.from({ length: 30 }, (_, index) => workflow(index + 1))
const announcement = (invocation_id, values = {}) => ({ suite: 'release-gate', telemetry_suite: 'release_gate', invocation_id,
  expected_workflows: expected, expected_total: expected.length, ...values })
const row = (invocationId, suite = 'release_gate') => ({ suite, invocationId, timestamp: '2026-11-25T12:00:00Z', rhoaiVersion: '3.6' })
const hits = docs => ({ hits: { hits: docs.map(_source => ({ _source })) } })
const missingIndex = () => Object.assign(new Error('OpenSearch request failed with 404'), { code: 'OS_ERROR', status: 404 })
/** Aggregation bucket of one run: the distinct ids it recorded and how many executions carried one. */
const ranBucket = (invocation, ids, { executions = ids.length, identified = executions } = {}) => ({
  key: { suite: 'release_gate', invocation }, doc_count: executions, identified: { value: identified },
  workflow_ids: { sum_other_doc_count: 0, buckets: [...new Set(ids)].map(key => ({ key, doc_count: ids.filter(id => id === key).length })) }
})
/** Search stub: announcements from one index, ran-workflow buckets from the other. */
function searchWith({ announcements = [], ran = [], announcementError, ranError } = {}) {
  const requests = []
  const search = vi.fn(async (index, body) => {
    requests.push({ index, body })
    if (index === SUITE_RUNS_INDEX) { if (announcementError) throw announcementError; return hits(announcements) }
    if (ranError) throw ranError
    return { aggregations: { suite_runs: { buckets: ran } } }
  })
  return { search, requests }
}
const ids = numbers => numbers.map(number => workflow(number).workflow_id)

afterEach(() => vi.unstubAllGlobals())

describe('Suite runs: expected versus ran', () => {
  it('reports 28 of 30 and names the two workflows that did not run', async () => {
    const all = expected.map(item => item.workflow_id)
    const { search } = searchWith({ announcements: [announcement('run-a')], ran: [ranBucket('run-a', all.slice(0, 28))] })
    const [result] = await addSuiteRuns([row('run-a')], search)
    expect(result).toMatchObject({ suite: 'release_gate', invocationId: 'run-a', suiteRun: true, suiteName: 'release-gate',
      workflowsExpected: 30, workflowsRan: 28 })
    expect(result.workflowsMissing).toEqual([
      { workflowId: 'workflow-29', title: 'Workflow 29' }, { workflowId: 'workflow-30', title: 'Workflow 30' }
    ])
  })

  it('counts a workflow executed twice once, and ignores a workflow the suite did not expect', async () => {
    const two = [workflow(1), workflow(2)]
    const { search } = searchWith({ announcements: [announcement('run-a', { expected_workflows: [...two, two[0]] })],
      ran: [ranBucket('run-a', [...ids([1, 1, 1]), 'not-in-the-suite'])] })
    const [result] = await addSuiteRuns([row('run-a')], search)
    expect(result).toMatchObject({ workflowsExpected: 2, workflowsRan: 1 })
    expect(result.workflowsMissing).toEqual([{ workflowId: 'workflow-02', title: 'Workflow 2' }])
  })

  it('marks a run with an announcement as a suite run and a run carrying only the label as ad hoc', async () => {
    const { search, requests } = searchWith({ announcements: [announcement('announced')], ran: [ranBucket('announced', ids([1]))] })
    const result = await addSuiteRuns([row('announced'), row('same-label-no-announcement'), row('announced', 'other_suite')], search)
    expect(result.map(item => item.suiteRun)).toEqual([true, false, false])
    expect(result[1]).toEqual({ ...row('same-label-no-announcement'), suiteRun: false })
    // Only announced runs are correlated with their executions.
    const correlation = requests.find(request => request.index === RUNS_INDEX)
    expect(correlation.body.query.bool.should).toHaveLength(1)
    expect(correlation.body.aggs.suite_runs.aggs.workflow_ids).toEqual({ terms: { field: 'workflow_id', size: 1000 } })
  })

  it('leaves the ran count unknown unless every execution recorded a workflow id', async () => {
    for (const ran of [[], [ranBucket('run-a', [], { executions: 3, identified: 0 })], [ranBucket('run-a', ids([1, 2]), { executions: 3, identified: 2 })]]) {
      const { search } = searchWith({ announcements: [announcement('run-a')], ran })
      const [result] = await addSuiteRuns([row('run-a')], search)
      expect(result).toMatchObject({ suiteRun: true, workflowsExpected: 30, workflowsRan: null, workflowsMissing: null })
    }
    const { search } = searchWith({ announcements: [announcement('run-a')], ranError: new Error('search failed') })
    expect((await addSuiteRuns([row('run-a')], search))[0]).toMatchObject({ suiteRun: true, workflowsRan: null })
  })

  it('treats a missing announcement index as no suite runs and reads no executions', async () => {
    const { search, requests } = searchWith({ announcementError: missingIndex() })
    expect(await addSuiteRuns([row('run-a')], search)).toEqual([{ ...row('run-a'), suiteRun: false }])
    expect(requests).toHaveLength(1)
  })

  it('returns the rows unchanged when announcements cannot be read', async () => {
    const rows = [row('run-a')]
    for (const announcementError of [new Error('unreachable'), Object.assign(new Error('forbidden'), { status: 403 })]) {
      expect(await addSuiteRuns(rows, searchWith({ announcementError }).search)).toBe(rows)
    }
    const partial = vi.fn(async () => ({ timed_out: true, hits: { hits: [] } }))
    expect(await addSuiteRuns(rows, partial)).toBe(rows)
  })

  it('skips malformed announcements', async () => {
    const { search } = searchWith({ announcements: [{ telemetry_suite: 'release_gate', invocation_id: 'run-a' },
      { telemetry_suite: 'release_gate', expected_workflows: [] }, announcement('run-b', { expected_workflows: [{ title: 'No id' }, workflow(1)] })],
    ran: [ranBucket('run-b', ids([1]))] })
    const result = await addSuiteRuns([row('run-a'), row('run-b')], search)
    expect(result[0]).toEqual({ ...row('run-a'), suiteRun: false })
    expect(result[1]).toMatchObject({ suiteRun: true, workflowsExpected: 1, workflowsRan: 1, workflowsMissing: [] })
  })

  it('describes one run from its executions', async () => {
    const two = { expected_workflows: [workflow(1), workflow(2)] }
    const executions = [{ workflow_id: 'workflow-01' }, { workflow_id: 'workflow-01' }]
    const one = announcements => searchWith({ announcements }).search
    expect(await suiteRunDetail('release_gate', 'run-a', executions, one([announcement('run-a', two)]))).toEqual({
      suiteRun: true, suiteName: 'release-gate', workflowsExpected: 2, workflowsRan: 1,
      workflowsMissing: [{ workflowId: 'workflow-02', title: 'Workflow 2' }] })
    expect(await suiteRunDetail('release_gate', 'run-a', [{ workflow_id: 'workflow-01' }, {}], one([announcement('run-a', two)])))
      .toMatchObject({ suiteRun: true, workflowsExpected: 2, workflowsRan: null, workflowsMissing: null })
    expect(await suiteRunDetail('release_gate', 'run-a', executions, one([]))).toEqual({ suiteRun: false })
    expect(await suiteRunDetail('release_gate', 'run-a', executions, searchWith({ announcementError: missingIndex() }).search)).toEqual({ suiteRun: false })
    expect(await suiteRunDetail('release_gate', 'run-a', executions, searchWith({ announcementError: new Error('unreachable') }).search)).toEqual({})
  })
})

describe('Suite runs in the paged run list', () => {
  const rows = [
    { ...row('suite-run'), suiteRun: true, suiteName: 'release-gate', workflowsExpected: 2, workflowsRan: 1,
      workflowsMissing: [{ workflowId: 'workflow-02', title: 'Workflow 2' }], timestamp: '2026-11-25T12:00:00Z' },
    { ...row('ad-hoc-run'), suiteRun: false, timestamp: '2026-11-24T12:00:00Z' },
    { ...row('unknown-run'), timestamp: '2026-11-23T12:00:00Z' }
  ]
  const request = query => parseRecentRuns({ pageSize: '20', ...query })

  it('returns suite-run fields for announced runs, the ad hoc mark for others, and nothing when unknown', () => {
    const page = pageRecentRuns(rows, request())
    expect(page.rows[0]).toMatchObject({ invocationId: 'suite-run', suiteRun: true, suiteName: 'release-gate',
      workflowsExpected: 2, workflowsRan: 1, workflowsMissing: [{ workflowId: 'workflow-02', title: 'Workflow 2' }] })
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
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
      const body = options?.body ? JSON.parse(options.body) : null
      if (url.includes('_field_caps')) return json({ fields: { invocation_id: { keyword: { searchable: true, aggregatable: true } } } })
      if (url.includes('/workflow-execution-images/')) return json({ aggregations: { builds: { buckets: [] } } })
      if (url.includes(`/${SUITE_RUNS_INDEX}/`)) return announcementStatus === 200 ? json(hits(announcements)) : json({ error: 'failed' }, announcementStatus)
      if (url.includes('/workflow-root-causes/')) return json(hits([]))
      if (body.aggs?.suite_runs?.aggs?.workflow_ids) return json({ aggregations: { suite_runs: { buckets: [ranBucket('run-a', ids([1, 1]))] } } })
      if (body.aggs?.suite_runs) return json({ aggregations: { suite_runs: { buckets: ['run-a', 'run-b'].map(invocation => ({
        key: { suite: 'release_gate', invocation }, doc_count: 2, latest: hits([executions[0]]) })) } } })
      if (url.includes(`/${RUNS_INDEX}/`)) return json({ hits: { hits: executions.map((_source, index) => ({ _id: `execution-${index}`, _source })) } })
      throw new Error(`Unexpected test request: ${url}`)
    }))
    const routes = {}
    registerRoutes({ get: (path, ...handlers) => { routes[path] = handlers }, post() {} }, { requireAuth() {}, secrets: {} })
    return async (path, request) => {
      const res = Object.assign(new EventEmitter(), { statusCode: 200,
        status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
      await routes[path].at(-1)(request, res)
      return res
    }
  }

  it('marks suite and ad hoc runs in the paged list and filters to suite runs', async () => {
    const get = setup()
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

  it.each([[404, false], [500, undefined]])('renders the list when the announcement index answers %i', async (announcementStatus, suiteRun) => {
    const all = await setup({ announcementStatus })('/test-suites', { query: { pageSize: '20' } })
    expect(all.statusCode).toBe(200)
    expect(all.body.rows).toHaveLength(2)
    expect(all.body.rows.map(item => item.suiteRun)).toEqual([suiteRun, suiteRun])
  })

  it('adds expected versus ran to the run detail', async () => {
    const detail = await setup()('/test-suites/:suite/:invocationId', { params: { suite: 'release_gate', invocationId: 'run-a' }, query: {} })
    expect(detail.statusCode).toBe(200)
    expect(detail.body).toMatchObject({ suite: 'release_gate', invocationId: 'run-a', suiteRun: true, suiteName: 'release-gate',
      workflowsExpected: 2, workflowsRan: 1, workflowsMissing: [{ workflowId: 'workflow-02', title: 'Workflow 2' }] })
    expect(detail.body.summary.tests).toBe(2)
    const adHoc = await setup({ announcements: [] })('/test-suites/:suite/:invocationId', { params: { suite: 'release_gate', invocationId: 'run-a' }, query: {} })
    expect(adHoc.body).toMatchObject({ suiteRun: false, summary: { tests: 2 } })
    const unknown = await setup({ announcementStatus: 500 })('/test-suites/:suite/:invocationId', { params: { suite: 'release_gate', invocationId: 'run-a' }, query: {} })
    expect(unknown.statusCode).toBe(200)
    expect(unknown.body).not.toHaveProperty('suiteRun')
  })
})
