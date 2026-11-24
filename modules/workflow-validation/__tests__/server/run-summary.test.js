import { afterEach, describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'

const registerRoutes = require('../../server/index')
const { recoverSkipped, summarizeRuns } = require('../../server/run-summary')
const execution = (invocation_id, workflow, counters = {}, version = '3.6') => ({
  telemetry_suite: 'release_gate', invocation_id, workflow, rhoai_version: version,
  timestamp: '2026-11-19T12:00:00Z', tasks_total: 4, tasks_passed: 2, tasks_failed: 1, tasks_skipped: 1, ...counters
})
const executions = [
  execution('run-a', 'repeated'), execution('run-a', 'repeated'), execution('run-a', 'other'),
  execution('run-b', 'legacy', { execution_id: 'legacy-execution', tasks_total: 2, tasks_passed: 1, tasks_failed: 0, tasks_skipped: undefined,
    tasks: [{ status: 'PASS' }, { status: 'SKIP' }] }),
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

function setup({ missingIssue = false, partial = false, partialImages = {}, legacyTasks = executions[3].tasks, indexedTasks = [], repeatCompositeCursor = false } = {}) {
  const requests = []
  let compositeReads = 0
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
    if (body.aggs?.suite_runs) {
      compositeReads += 1
      const after = body.aggs.suite_runs.composite.after
      const group = { buckets: after ? buckets.slice(2) : buckets.slice(0, 2) }
      if (!after || (repeatCompositeCursor && compositeReads === 2)) group.after_key = { suite: 'release_gate', invocation: 'run-b' }
      return json({ ...(partial ? { timed_out: true } : {}), aggregations: { suite_runs: group } })
    }
    if (url.includes('/workflow-executions/') && body.query.bool.must_not) {
      return json(hits([{ ...executions[3], tasks: legacyTasks }]))
    }
    if (url.includes('/workflow-task-executions/')) {
      const { executions: { aggs: { known, skipped } } } = body.aggs
      return json({ aggregations: { executions: { buckets: [{ key: 'legacy-execution', doc_count: indexedTasks.length,
        known: { doc_count: indexedTasks.filter(status => known.filter.terms.status.includes(status)).length },
        skipped: { doc_count: indexedTasks.filter(status => skipped.filter.terms.status.includes(status)).length } }] } } })
    }
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
    expect(first.body.summary).toMatchObject({ suiteRuns: 3, workflows: 5, tasks: 17, passed: 10, failed: 3, skipped: 4, bugs: 2 })
    expect(new URL(first.body.summary.bugUrl).searchParams.get('jql')).toBe(
      'key IN (RHOAIENG-1, RHOAIENG-4) AND (labels IS EMPTY OR labels NOT IN ("rca-scope-internal"))')
    expect(first.body.rows[0]).toMatchObject({ invocationId: 'run-a', rhoaiVersion: '3.7.0-ea.1', workflows: 3, tasks: 12, passed: 6, failed: 3, skipped: 3, bugs: 2 })
    expect(first.body.rows[0]).not.toHaveProperty('_bugKeys')
    const second = await get({ cursor: first.body.nextCursor })
    expect(second.body.rows[0]).toMatchObject({ invocationId: 'run-b', rhoaiVersion: '3.6', skipped: 1, bugs: 1 })
    expect(second.body.summary).toEqual(first.body.summary)
    const scans = requests.filter(request => request.body?.aggs?.suite_runs)
    expect(scans).toHaveLength(2)
    expect(scans[0].body.aggs.suite_runs.aggs.skipped_count).toEqual({ value_count: { field: 'tasks_skipped' } })
  })

  it('rejects a repeated suite aggregation cursor before sending partial results', async () => {
    const { get, requests } = setup({ repeatCompositeCursor: true })
    expect((await get()).statusCode).toBe(502)
    expect(requests).toHaveLength(2)
  })

  it('uses the resolved image version and execution fallback for summary selection', async () => {
    const { get } = setup()
    expect((await get({ versions: '3.7.0-ea.1' })).body.summary)
      .toMatchObject({ suiteRuns: 1, workflows: 3, tasks: 12, passed: 6, failed: 3, skipped: 3, bugs: 2 })
    const legacy = await get({ versions: '3.6.0' })
    expect(legacy.body.summary).toMatchObject({ suiteRuns: 1, workflows: 1, tasks: 2, skipped: 1, bugs: 1 })
    expect(legacy.body.rows[0].invocationId).toBe('run-b')
    expect((await get({ versions: ['3.6', '3.7.0-ea.1'] })).body.summary).toMatchObject({ skipped: 4, bugs: 2 })
  })

  it('filters verified bug matches before pagination and summarizes all matching runs', async () => {
    const { get } = setup()
    const first = await get({ bugsOnly: 'true' })
    expect(first.body).toMatchObject({ total: 2, bugFilterIncomplete: false, summary: { suiteRuns: 2, bugs: 2 } })
    const second = await get({ bugsOnly: 'true', cursor: first.body.nextCursor })
    expect(second.body.rows.map(row => row.invocationId)).toEqual(['run-b'])
    expect(second.body.nextCursor).toBeNull()
    expect((await get({ runQuery: 'run-c', dateFrom: '2026-11-19' })).body.summary).toMatchObject({ suiteRuns: 1, bugs: 0 })
    const narrow = await get({ suites: ['release_gate', 'aramco'], runQuery: 'run-b', dateTo: '2026-11-19' })
    expect(new URL(narrow.body.summary.bugUrl).searchParams.get('jql')).toMatch(/^key IN \(RHOAIENG-1\) /)
    expect((await get({ cursor: first.body.nextCursor })).statusCode).toBe(400)
  })

  it('keeps unverified bugs unknown and reports incomplete bug filtering', async () => {
    const { get } = setup({ missingIssue: true })
    const result = await get({ bugsOnly: 'true' })
    expect(result.body).toMatchObject({ total: 1, bugFilterIncomplete: true, summary: { bugs: 1, bugsIncomplete: true, suiteRuns: 1, tasks: 12 } })
    expect(new URL(result.body.summary.bugUrl).searchParams.get('jql')).toMatch(/^key IN \(RHOAIENG-4\) /)
    expect(result.body.rows[0]).toMatchObject({ invocationId: 'run-a', bugs: null, hasBugs: true, bugTickets: { status: 'unavailable' } })
    expect((await get({ runQuery: 'run-b' })).body).toMatchObject({ summary: { bugs: null, bugsIncomplete: true },
      rows: [{ bugs: null, hasBugs: null, bugTickets: { status: 'unavailable' } }] })
  })

  it.each([{ indexedTasks: ['PASS'] }, { indexedTasks: ['PASS', 'UNKNOWN'] }])('leaves skipped unknown for incomplete legacy task outcomes: $indexedTasks', async ({ indexedTasks }) => {
    const { get } = setup({ legacyTasks: [{ status: 'PASS' }], indexedTasks })
    expect((await get({ versions: ['3.6', '3.7.0-ea.1'] })).body.summary).toMatchObject({ passed: 7, failed: 3, skipped: null, bugs: 2 })
  })

  it('reads complete task-index outcomes when a legacy execution lacks embedded tasks', async () => {
    const { get, requests } = setup({ legacyTasks: null, indexedTasks: ['PASS', 'SKIP'] })
    const response = await get({ versions: ['3.6', '3.7.0-ea.1'] })
    expect(response.body.summary).toMatchObject({ passed: 7, failed: 3, skipped: 4, bugs: 2 })
    expect(requests.find(({ url }) => url.includes('/workflow-task-executions/')).body.query)
      .toEqual({ terms: { execution_id: ['legacy-execution'] } })
  })

  it('queries missing skipped outcomes only for matching runs', async () => {
    const { get, requests } = setup()
    await get({ runQuery: 'run-a' })
    expect(requests.filter(({ body }) => body?.query?.bool?.must_not)).toHaveLength(0)
    const response = await get({ suites: 'release_gate', runQuery: 'run-b' })
    expect(response.body.summary.skipped).toBe(1)
    const recovery = requests.filter(({ body }) => body?.query?.bool?.must_not)
    expect(recovery).toHaveLength(1)
    expect(recovery[0].body.query.bool.should).toEqual([{ bool: { filter: [
      { term: { telemetry_suite: 'release_gate' } }, { term: { invocation_id: 'run-b' } }
    ] } }])
  })

  it('scopes bug lookups to selected versions and does not reuse a different version cache', async () => {
    const { get, requests } = setup()
    await get({ versions: '3.7.0-ea.1' })
    const associations = () => requests.filter(({ body }) => body?.query?.bool?.should && !body.query.bool.must_not)
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

it('retains task-index counts from a successful batch when another has failed shards', async () => {
  const legacy = Array.from({ length: 501 }, (_, index) => ({ _source: {
    execution_id: `exec-${index}`, tasks_total: 1, telemetry_suite: 'release_gate', invocation_id: index < 500 ? 'batch-a' : 'batch-b'
  }, sort: [index] }))
  const rows = [['batch-a', 500], ['batch-b', 1]].map(([invocationId, missing]) => ({
    invocationId, suite: 'release_gate', skipped: null, _skippedCoverage: { missing, recorded: 0 }
  }))
  const search = async (index, body) => {
    if (index === 'workflow-executions') return { hits: { hits: body.search_after ? legacy.slice(500) : legacy.slice(0, 500) } }
    const ids = body.query.terms.execution_id
    return { _shards: { failed: ids.length === 500 ? 1 : 0 }, aggregations: { executions: { buckets: ids.map(key => ({
      key, doc_count: 1, known: { doc_count: 1 }, skipped: { doc_count: 1 }
    })) } } }
  }
  expect((await recoverSkipped(rows, search, () => false)).map(row => row.skipped)).toEqual([null, 1])
})

it('offers the full Jira query separately if its encoded link exceeds the URL limit', () => {
  const keys = Array.from({ length: 600 }, (_, index) => `RHOAIENG-${100000 + index}`)
  const result = summarizeRuns([{ _bugKeys: keys }], 'https://jira.example.test', false)
  expect(result.bugs).toBe(keys.length)
  expect(result.bugUrl).toBe('https://jira.example.test/issues/')
  expect(result.bugJql).toBe(`key IN (${keys.join(', ')}) AND (labels IS EMPTY OR labels NOT IN ("rca-scope-internal"))`)
})
