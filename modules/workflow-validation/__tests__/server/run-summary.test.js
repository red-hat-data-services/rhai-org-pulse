import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'

const registerRoutes = require('../../server/index')
const execution = (invocation_id, workflow, counters = {}, version = '3.6') => ({
  telemetry_suite: 'release_gate', invocation_id, workflow, rhoai_version: version,
  timestamp: '2026-11-19T12:00:00Z', tasks_total: 4, tasks_passed: 2, tasks_failed: 1, tasks_skipped: 1, ...counters
})
const executions = [
  execution('run-a', 'repeated'), execution('run-a', 'repeated'), execution('run-a', 'other'),
  execution('run-b', 'legacy', { tasks_total: 2, tasks_passed: 2, tasks_failed: 0, tasks_skipped: undefined }),
  execution('run-c', 'older', { tasks_total: 3, tasks_passed: 3, tasks_failed: 0, tasks_skipped: 0 }, '3.5.2')
]
const findings = [
  { run_id: 'run-a', workflow: 'repeated', bug_key: 'RHOAIENG-1' },
  { run_id: 'run-a', impacted_workflows: ['other'], bug_key: 'RHOAIENG-1' },
  { run_id: 'run-a', workflow: 'other', bug_key: 'RHOAIENG-2' },
  { run_id: 'run-a', workflow: 'other', bug_key: 'RHOAIENG-4' },
  { run_id: 'run-b', workflow: 'legacy', bug_key: 'RHOAIENG-1' }
]
const json = data => ({ ok: true, json: async () => data })
const hits = data => ({ hits: { hits: data.map(_source => ({ _source })) } })
const buckets = ['run-a', 'run-b', 'run-c'].map(invocation => {
  const docs = executions.filter(doc => doc.invocation_id === invocation)
  return { key: { suite: 'release_gate', invocation }, doc_count: docs.length,
    latest: hits([docs[0]]), ...Object.fromEntries(Object.entries({ tasks: 'tasks_total', passed: 'tasks_passed', failed: 'tasks_failed', skipped: 'tasks_skipped' }).flatMap(([key, field]) => [
      [key, { value: docs.reduce((sum, doc) => sum + (doc[field] || 0), 0) }],
      [`${key}_count`, { value: docs.filter(doc => doc[field] !== undefined).length }]
    ])) }
})

function setup({ missingIssue = false, partial = false, partialImages = {} } = {}) {
  const requests = []
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    const body = options?.body ? JSON.parse(options.body) : null
    requests.push({ url, body })
    if (url.includes('/rest/api/3/search/jql')) return json({ issues: ['RHOAIENG-1', 'RHOAIENG-2', 'RHOAIENG-4']
      .filter(key => body.jql.includes(key) && (!missingIssue || key !== 'RHOAIENG-1'))
      .map(key => ({ key, fields: { labels: key === 'RHOAIENG-2' ? ['rca-scope-internal'] : [] } })), isLast: true })
    if (url.includes('_field_caps')) return json({ fields: { invocation_id: { keyword: { searchable: true, aggregatable: true } } } })
    if (url.includes('/workflow-execution-images/')) return json({ ...partialImages, aggregations: { builds: { buckets: [{ key: 'run-a',
      latestImage: hits([{ operator_image: { version: 'v3.7.0-ea.1' } }])
    }] } } })
    if (body.aggs?.suite_runs) return json({ ...(partial ? { timed_out: true } : {}), aggregations: { suite_runs: body.aggs.suite_runs.composite.after
      ? { buckets: buckets.slice(2) } : { buckets: buckets.slice(0, 2), after_key: { suite: 'release_gate', invocation: 'run-b' } } } })
    if (url.includes('/workflow-executions/')) return json(hits(executions.filter(doc => body.query.bool.should.some(clause =>
      clause.bool.filter.every(filter => Object.entries(filter.term).every(([key, value]) => doc[key] === value))))))
    if (url.includes('/workflow-root-causes/')) return json(hits(findings.filter(doc => body.query.bool.filter[0].terms.run_id.includes(doc.run_id))))
    throw new Error(`Unexpected test request: ${url}`)
  }))
  const routes = {}
  registerRoutes({ get: (path, ...handlers) => { routes[path] = handlers }, post() {} }, {
    requireAuth() {}, secrets: { JIRA_EMAIL: 'reader@example.test', JIRA_TOKEN: 'test-token' }
  })
  async function get(query = {}) {
    const res = Object.assign(new EventEmitter(), { statusCode: 200,
      status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })
    await routes['/test-suites'].at(-1)({ query: { pageSize: '1', includeBugs: 'false', includeBugTickets: 'true', includeSummary: 'true', ...query } }, res)
    return res
  }
  return { get, requests }
}

afterEach(() => vi.unstubAllGlobals())

describe('Recent Runs version summary API', () => {
  it('counts every execution including repeated workflows, across composite pages and table pages', async () => {
    const { get, requests } = setup()
    const first = await get()
    expect(first.statusCode).toBe(200)
    expect(first.body.summary).toEqual({ suiteRuns: 3, workflows: 5, tasks: 17, passed: 11, failed: 3, skipped: null, bugs: 2 })
    expect(first.body.rows[0]).toMatchObject({ invocationId: 'run-a', rhoaiVersion: '3.7.0-ea.1', workflows: 3, tasks: 12, passed: 6, failed: 3, skipped: 3, bugs: 2 })
    expect(first.body.rows[0]).not.toHaveProperty('_bugKeys')
    const second = await get({ cursor: first.body.nextCursor })
    expect(second.body.rows[0]).toMatchObject({ invocationId: 'run-b', rhoaiVersion: '3.6', skipped: null, bugs: 1 })
    expect(second.body.summary).toEqual(first.body.summary)
    const scans = requests.filter(request => request.body?.aggs?.suite_runs)
    expect(scans).toHaveLength(2)
    expect(scans[0].body.aggs.suite_runs.aggs.skipped_count).toEqual({ value_count: { field: 'tasks_skipped' } })
  })

  it('uses the resolved image version and execution fallback for summary selection', async () => {
    const { get } = setup()
    expect((await get({ versions: '3.7.0-ea.1' })).body.summary)
      .toEqual({ suiteRuns: 1, workflows: 3, tasks: 12, passed: 6, failed: 3, skipped: 3, bugs: 2 })
    const legacy = await get({ versions: '3.6.0' })
    expect(legacy.body.summary).toMatchObject({ suiteRuns: 1, workflows: 1, tasks: 2, skipped: null, bugs: 1 })
    expect(legacy.body.rows[0].invocationId).toBe('run-b')
    expect((await get({ versions: ['3.6', '3.7.0-ea.1'] })).body.summary.bugs).toBe(2)
  })

  it('filters verified bug matches before pagination and keeps summary scope independent of table filters', async () => {
    const { get } = setup()
    const first = await get({ bugsOnly: 'true' })
    expect(first.body).toMatchObject({ total: 2, bugFilterIncomplete: false, summary: { suiteRuns: 3, bugs: 2 } })
    const second = await get({ bugsOnly: 'true', cursor: first.body.nextCursor })
    expect(second.body.rows.map(row => row.invocationId)).toEqual(['run-b'])
    expect(second.body.nextCursor).toBeNull()
    expect((await get({ runQuery: 'run-c', dateFrom: '2026-11-19' })).body.summary).toEqual(first.body.summary)
    expect((await get({ cursor: first.body.nextCursor })).statusCode).toBe(400)
  })

  it('keeps unverified bugs unknown and reports incomplete bug filtering', async () => {
    const { get } = setup({ missingIssue: true })
    const result = await get({ bugsOnly: 'true' })
    expect(result.body).toMatchObject({ total: 1, bugFilterIncomplete: true, summary: { bugs: null, suiteRuns: 3, tasks: 17 } })
    expect(result.body.rows[0]).toMatchObject({ invocationId: 'run-a', bugs: null, hasBugs: true, bugTickets: { status: 'unavailable' } })
    expect((await get({ runQuery: 'run-b' })).body.rows[0]).toMatchObject({ bugs: null, hasBugs: null, bugTickets: { status: 'unavailable' } })
  })

  it('scopes bug lookups to selected versions and does not reuse a different version cache', async () => {
    const { get, requests } = setup()
    await get({ versions: '3.7.0-ea.1' })
    const associations = () => requests.filter(({ body }) => body?.query?.bool?.should)
    expect(associations()).toHaveLength(1)
    expect(associations()[0].body.query.bool.should).toHaveLength(1)
    expect(associations()[0].body.query.bool.should[0].bool.filter[1]).toEqual({ term: { invocation_id: 'run-a' } })
    expect(requests.find(({ url }) => url.includes('/workflow-root-causes/')).body.query.bool.filter[0]).toEqual({ terms: { run_id: ['run-a'] } })
    const legacy = await get({ versions: '3.6.0' })
    expect(legacy.body.summary.bugs).toBe(1)
    expect(associations()).toHaveLength(2)
    expect(associations()[1].body.query.bool.should[0].bool.filter[1]).toEqual({ term: { invocation_id: 'run-b' } })
    await get({ versions: '3.6' })
    expect(associations()).toHaveLength(2)
    await get({ versions: '9.9.9' })
    expect(associations()).toHaveLength(2)
    expect(requests.filter(({ url }) => url.includes('/workflow-root-causes/'))).toHaveLength(2)
  })

  it('makes no association or Jira request for an empty version selection result', async () => {
    const { get, requests } = setup()
    expect((await get({ versions: '9.9.9' })).body.summary.bugs).toBe(0)
    expect(requests.some(({ url }) => url.includes('/workflow-root-causes/') || url.includes('/rest/api/3/'))).toBe(false)
    expect(requests.some(({ body }) => body?.query?.bool?.should)).toBe(false)
  })

  it.each([{ timed_out: true }, { _shards: { failed: 1 } }])('rejects partial image responses: %j', async partialImages => {
    const { get } = setup({ partialImages })
    expect((await get()).statusCode).toBe(502)
  })

  it('returns zero for a version with no runs and rejects partial execution aggregations', async () => {
    const { get } = setup()
    expect((await get({ versions: '9.9.9' })).body.summary)
      .toEqual({ suiteRuns: 0, workflows: 0, tasks: 0, passed: 0, failed: 0, skipped: 0, bugs: 0 })
    const partial = setup({ partial: true })
    expect((await partial.get()).statusCode).toBe(502)
  })

  it.each([{ includeSummary: 'yes' }, { bugsOnly: [] }, { pageSize: undefined, bugsOnly: 'true' }])('validates summary and bug-filter parameters: %j', async query => {
    const { get } = setup()
    expect((await get(query)).statusCode).toBe(400)
  })
})
