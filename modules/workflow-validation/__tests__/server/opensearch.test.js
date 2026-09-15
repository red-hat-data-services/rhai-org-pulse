import { afterEach, describe, expect, it, vi } from 'vitest'

const {
  RUNS_INDEX,
  TASKS_INDEX,
  BUGS_INDEX,
  getOpenSearchConfig,
  createOpenSearchClient,
  bugFilters,
  runFilters,
  taskFilters,
  timestampRange
} = require('../../server/opensearch')
const registerRoutes = require('../../server/index')

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function makeRouter() {
  const routes = {}
  return {
    get(path, ...handlers) { routes[path] = handlers },
    routes
  }
}

function makeResponse() {
  const response = {
    statusCode: 200,
    body: null,
    status(code) { response.statusCode = code; return response },
    json(body) { response.body = body; return response }
  }
  return response
}

function register(secrets = {}) {
  const router = makeRouter()
  registerRoutes(router, { requireAuth: vi.fn(), secrets })
  return router.routes
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.WORKFLOW_VALIDATION_OPENSEARCH_URL
})

describe('OpenSearch runtime client', () => {
  it('uses runtime URL configuration and preserves the local POC default', () => {
    expect(getOpenSearchConfig({}, {})).toEqual({
      url: 'http://localhost:9200', username: '', password: '', authenticated: false
    })
    expect(getOpenSearchConfig({}, { WORKFLOW_VALIDATION_OPENSEARCH_URL: 'https://search.example/' }).url)
      .toBe('https://search.example')
  })

  it('adds backend-only Basic authentication without putting credentials in the URL', async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse({ count: 1 }))
    const client = createOpenSearchClient({
      url: 'https://search.example', username: 'reader', password: 'secret'
    }, request)

    await client.search(RUNS_INDEX, { size: 0 })

    const [url, options] = request.mock.calls[0]
    expect(url).toBe(`https://search.example/${RUNS_INDEX}/_search`)
    expect(options.headers.Authorization).toBe(`Basic ${Buffer.from('reader:secret').toString('base64')}`)
    expect(JSON.stringify(options)).not.toContain('WORKFLOW_VALIDATION_OPENSEARCH_PASSWORD')
  })

  it('supports an unauthenticated local POC and rejects partial credentials', async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse({ hits: { hits: [] } }))
    await createOpenSearchClient({ url: 'http://localhost:9200' }, request)
      .search(RUNS_INDEX, { query: { match_all: {} } })
    expect(request.mock.calls[0][1].headers).not.toHaveProperty('Authorization')
    expect(() => createOpenSearchClient({ username: 'reader' }, request)).toThrow(/configured together/)
  })

  it('checks all three index shapes without requiring cluster-level permissions', async () => {
    const counts = { [RUNS_INDEX]: 146, [TASKS_INDEX]: 1082, [BUGS_INDEX]: 43 }
    const request = vi.fn((url) => {
      const index = Object.keys(counts).find((name) => url.includes(`/${name}/`))
      return Promise.resolve(jsonResponse({ count: counts[index] }))
    })
    const result = await createOpenSearchClient({}, request).status()
    expect(result).toEqual({ executions: 146, tasks: 1082, rootCauses: 43 })
    expect(request.mock.calls.every(([url]) => url.endsWith('/_count'))).toBe(true)
  })

  it('registers secret validation and redacted module diagnostics', async () => {
    process.env.WORKFLOW_VALIDATION_OPENSEARCH_URL = 'https://search.example'
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse({ count: 1 }))))
    const router = makeRouter()
    let validator
    let diagnostics
    registerRoutes(router, {
      requireAuth: vi.fn(),
      secrets: { WORKFLOW_VALIDATION_OPENSEARCH_USERNAME: 'reader', WORKFLOW_VALIDATION_OPENSEARCH_PASSWORD: 'secret' },
      registerSecretValidator: vi.fn((key, fn) => {
        expect(key).toBe('WORKFLOW_VALIDATION_OPENSEARCH_PASSWORD')
        validator = fn
      }),
      registerDiagnostics: vi.fn((fn) => { diagnostics = fn })
    })

    expect(await validator()).toEqual({
      valid: true, message: 'Read-only OpenSearch indices are reachable'
    })
    const result = await diagnostics()
    expect(result).toMatchObject({
      status: 'ok', endpoint: 'https://search.example', authenticationConfigured: true
    })
    expect(JSON.stringify(result)).not.toContain('reader')
    expect(JSON.stringify(result)).not.toContain('secret')
  })
})

describe('workflow-validation live schema routes', () => {
  it('uses canonical workflow identity and never maps run verdict to task status', () => {
    expect(JSON.stringify(runFilters({ workflow: 'wf-a', verdict: 'PASS' })))
      .toContain('"workflow":"wf-a"')
    const tasks = JSON.stringify(taskFilters({ workflow: 'wf-a', verdict: 'PASS' }))
    expect(tasks).toContain('"workflow":"wf-a"')
    expect(tasks).not.toContain('verdict')
    expect(tasks).not.toContain('status')
  })

  it('scopes executions to a concrete test suite invocation', () => {
    expect(runFilters({ testSuite: 'productization', invocationId: 'invocation-2' }).bool.filter)
      .toEqual(expect.arrayContaining([
        { term: { telemetry_origin: 'productization' } },
        { term: { invocation_id: 'invocation-2' } }
      ]))
  })

  it('searches text that is visible in each list', () => {
    const tests = JSON.stringify(runFilters({ q: 'fraud' }))
    expect(tests).toContain('workflow_label')
    expect(tests).toContain('workflow')
    expect(tests).not.toContain('summary_text')

    const activity = JSON.stringify(bugFilters({ q: 'timed out' }))
    expect(activity).toContain('error_summary')
    expect(activity).toContain('reasoning')
    expect(activity).not.toContain('suggested_remediation')
    expect(activity).not.toContain('workaround')
  })

  it('applies the same inclusive date range to execution, task, and RCA queries', () => {
    const dates = { dateFrom: '2026-09-01', dateTo: '2026-09-14' }
    const expected = { range: { timestamp: {
      gte: '2026-09-01', lte: '2026-09-14T23:59:59.999Z'
    } } }
    expect(timestampRange(dates)).toEqual(expected)
    for (const query of [runFilters(dates), taskFilters(dates), bugFilters(dates)]) {
      expect(query.bool.filter).toContainEqual(expected)
    }
  })

  it('links independent task documents by execution_id and RCAs by run_id plus workflow', async () => {
    process.env.WORKFLOW_VALIDATION_OPENSEARCH_URL = 'https://search.example'
    const fetchMock = vi.fn((url, options) => {
      const body = JSON.parse(options.body)
      if (url.includes(`/${RUNS_INDEX}/`)) {
        return Promise.resolve(jsonResponse({ hits: { hits: [{
          _id: 'opaque-execution',
          _source: { execution_id: 'opaque-execution', run_id: 'run-1', workflow: 'workflow-a' }
        }] } }))
      }
      if (url.includes(`/${TASKS_INDEX}/`)) {
        expect(body.query).toEqual({ term: { execution_id: 'opaque-execution' } })
        return Promise.resolve(jsonResponse({ hits: { hits: [{
          _id: 'task-1', _source: { task_execution_id: 'task-1', execution_id: 'opaque-execution', task: 'step', status: 'PASS' }
        }] } }))
      }
      expect(url).toContain(`/${BUGS_INDEX}/`)
      expect(JSON.stringify(body.query)).toContain('run-1')
      expect(JSON.stringify(body.query)).toContain('workflow-a')
      expect(JSON.stringify(body.query)).not.toContain('impacted_workflows')
      return Promise.resolve(jsonResponse({ hits: { hits: [{
        _id: 'rca-1', _source: { root_cause_id: 'rca-1', run_id: 'run-1', workflow: 'workflow-a' }
      }] } }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const routes = register({ WORKFLOW_VALIDATION_OPENSEARCH_USERNAME: 'reader', WORKFLOW_VALIDATION_OPENSEARCH_PASSWORD: 'secret' })
    const response = makeResponse()

    await routes['/runs/:executionId'].at(-1)({ params: { executionId: 'opaque-execution' } }, response)

    expect(response.body.run.execution_id).toBe('opaque-execution')
    expect(response.body.tasks[0].task_execution_id).toBe('task-1')
    expect(response.body.bugs[0].root_cause_id).toBe('rca-1')
    expect(response.body.run).not.toHaveProperty('tasks_total')
  })

  it('compares aggregate execution pass rates for each test across RHOAI versions', async () => {
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      const body = JSON.parse(options.body)
      if (url.includes(`/${BUGS_INDEX}/`)) {
        return Promise.resolve(jsonResponse({ hits: { hits: [] } }))
      }
      const serialized = JSON.stringify(body.query)
      const version = serialized.includes('3.5') ? '3.5' : '3.6'
      const passed = version === '3.5' ? 1 : 3
      return Promise.resolve(jsonResponse({ aggregations: { tests: { buckets: [{
        key: { workflow: 'shared-test' },
        doc_count: 4,
        passed: { doc_count: passed },
        failed: { doc_count: 4 - passed },
        latest: { hits: { hits: [{
          _id: `${version}-latest`,
          _source: { execution_id: `${version}-latest`, run_id: `${version}-run`, workflow: 'shared-test', rhoai_version: version }
        }] } }
      }] } } }))
    }))
    const routes = register()
    const response = makeResponse()

    await routes['/version-compare'].at(-1)({ query: { baseline: '3.5', target: '3.6' } }, response)

    expect(response.body.baseline).toEqual({ version: '3.5', tests: 1 })
    expect(response.body.target).toEqual({ version: '3.6', tests: 1 })
    expect(response.body.rows[0]).toMatchObject({
      workflow: 'shared-test', change: 'higher', passRateChange: 0.5,
      baseline: { executions: 4, passed: 1, failed: 3, passRate: 0.25, latest: { execution_id: '3.5-latest' } },
      target: { executions: 4, passed: 3, failed: 1, passRate: 0.75, latest: { execution_id: '3.6-latest' }, productBugs: [] }
    })
  })

  it('treats errors as unsuccessful without collapsing them into failed verdicts', () => {
    expect(runFilters({ verdict: 'ERROR' }).bool.filter)
      .toContainEqual({ term: { verdict: 'ERROR' } })
    expect(runFilters({ verdict: 'UNSUCCESSFUL' }).bool.filter)
      .toContainEqual({ terms: { verdict: ['FAIL', 'ERROR'] } })
  })

  it('groups test suite executions by explicit origin and invocation', async () => {
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      const body = JSON.parse(options.body)
      if (url.includes(`/${BUGS_INDEX}/`)) return Promise.resolve(jsonResponse({ hits: { hits: [] } }))
      expect(body.aggs.suite_runs.composite.sources).toEqual([
        { suite: { terms: { field: 'telemetry_origin' } } },
        { invocation: { terms: { field: 'invocation_id' } } }
      ])
      return Promise.resolve(jsonResponse({ aggregations: { suite_runs: { buckets: [{
        key: { suite: 'productization', invocation: 'invocation-1' }, doc_count: 3,
        pass_rate: { value: 2 / 3 }, passed: { doc_count: 2 }, failed: { doc_count: 1 }, errors: { doc_count: 0 },
        latest: { hits: { hits: [{ _source: {
          timestamp: '2026-09-15T10:00:00Z', rhoai_version: '3.6',
          rhods_operator_digest: 'abcdef0123456789', run_id: 'run-1'
        } }] } }
      }] } } }))
    }))
    const routes = register()
    const response = makeResponse()
    await routes['/test-suites'].at(-1)({ query: { suite: 'productization', latest: 'true' } }, response)
    expect(response.body.rows).toEqual([expect.objectContaining({
      suite: 'productization', invocationId: 'invocation-1', tests: 3,
      passed: 2, failed: 1, passRate: 2 / 3, rhodsOperatorDigest: 'abcdef0123456789'
    })])
  })

  it('returns exact tests for one test suite execution', async () => {
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      const body = JSON.parse(options.body)
      if (url.includes(`/${BUGS_INDEX}/`)) return Promise.resolve(jsonResponse({ hits: { hits: [] } }))
      expect(body.query.bool.filter).toContainEqual({ term: { telemetry_origin: 'productization' } })
      expect(body.query.bool.filter).toContainEqual({ term: { invocation_id: 'invocation-1' } })
      return Promise.resolve(jsonResponse({ hits: { hits: [{
        _id: 'execution-1', _source: {
          execution_id: 'execution-1', run_id: 'run-1', workflow: 'test-a', verdict: 'PASS',
          timestamp: '2026-09-15T10:00:00Z', rhoai_version: '3.6', rhods_operator_digest: 'abcdef0123456789'
        }
      }] } }))
    }))
    const routes = register()
    const response = makeResponse()
    await routes['/test-suites/:suite/:invocationId'].at(-1)({ params: { suite: 'productization', invocationId: 'invocation-1' } }, response)
    expect(response.body.summary).toMatchObject({ tests: 1, passed: 1, failed: 0, errors: 0, passRate: 1 })
    expect(response.body.tests[0]).toMatchObject({ execution_id: 'execution-1', productBugs: [] })
  })

  it('deduplicates infrastructure cost by run_id and contains no legacy path-derived fields', async () => {
    const bodies = []
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      bodies.push(JSON.parse(options.body))
      return Promise.resolve(jsonResponse({ aggregations: {} }))
    }))
    const routes = register()
    const response = makeResponse()

    await routes['/overview'].at(-1)({ query: {} }, response)

    const infraQuery = bodies.find((body) => body.aggs?.runs?.composite)
    expect(infraQuery.aggs.runs.composite.sources)
      .toEqual([{ runId: { terms: { field: 'run_id' } } }])
    expect(infraQuery.aggs.runs.aggs.infraCost.max.field).toBe('infra_cost_usd')
    expect(JSON.stringify(bodies)).not.toMatch(/run_key|test_name|spec_path|artifact_dir|playwright_project/)
  })

  it('uses opaque search-after cursors and rejects malformed cursors', async () => {
    const requests = []
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      const body = JSON.parse(options.body)
      requests.push(body)
      return Promise.resolve(jsonResponse({
        hits: { total: { value: 3 }, hits: [
          { _id: 'a', sort: [100, 'a'], _source: { execution_id: 'a' } },
          { _id: 'b', sort: [90, 'b'], _source: { execution_id: 'b' } }
        ] }
      }))
    }))
    const routes = register()
    const first = makeResponse()
    await routes['/runs'].at(-1)({ query: { size: '1' } }, first)
    expect(first.body.runs).toHaveLength(1)
    expect(first.body.nextCursor).toBeTruthy()
    expect(requests[0]).not.toHaveProperty('from')
    expect(requests[0].sort[0]).toEqual({ timestamp: { order: 'desc', missing: '_last' } })

    const second = makeResponse()
    await routes['/runs'].at(-1)({ query: { size: '1', cursor: first.body.nextCursor } }, second)
    expect(requests[1].search_after).toEqual([100, 'a'])

    const sorted = makeResponse()
    await routes['/runs'].at(-1)({ query: { size: '1', sortBy: 'workflow', sortDir: 'asc' } }, sorted)
    expect(requests[2].sort[0]).toEqual({ workflow: { order: 'asc', missing: '_last' } })

    const invalid = makeResponse()
    await routes['/runs'].at(-1)({ query: { cursor: 'not-a-cursor' } }, invalid)
    expect(invalid.statusCode).toBe(400)
  })

  it('returns null for incomplete optional aggregate metrics', async () => {
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      const body = JSON.parse(options.body)
      if (body.aggs?.runs?.composite) {
        return Promise.resolve(jsonResponse({ aggregations: { runs: { buckets: [] } } }))
      }
      if (body.aggs?.values && body.aggs?.linkable) {
        return Promise.resolve(jsonResponse({ aggregations: {
          values: { value: 0 }, linkable: { values: { value: 0 } }
        } }))
      }
      if (url.includes(`/${RUNS_INDEX}/`)) {
        return Promise.resolve(jsonResponse({ aggregations: {
          runs: { value: 2 }, pass_rate: { value: null }, passed: { doc_count: 0 }, failed: { doc_count: 0 },
          tasks_total: { value: 4 }, tasks_total_count: { value: 1 },
          tasks_passed: { value: 3 }, tasks_passed_count: { value: 1 },
          tasks_failed: { value: 1 }, tasks_failed_count: { value: 1 },
          ai_cost: { value: 2 }, ai_cost_count: { value: 1 },
          avg_duration: { value: null }, turns: { value: 5 }, turns_count: { value: 1 }
        } }))
      }
      return Promise.resolve(jsonResponse({ aggregations: {} }))
    }))
    const response = makeResponse()
    await register()['/overview'].at(-1)({ query: {} }, response)
    expect(response.body.runs).toMatchObject({
      total: 2, tasksTotal: null, tasksPassed: null, tasksFailed: null,
      aiCost: null, infraCost: null, avgDuration: null, turns: null
    })
  })
})
