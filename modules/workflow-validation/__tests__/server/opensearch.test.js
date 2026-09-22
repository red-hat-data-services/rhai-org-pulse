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

  it('rejects invalid, non-HTTP, and credential-bearing endpoint configuration', () => {
    expect(() => getOpenSearchConfig({}, { WORKFLOW_VALIDATION_OPENSEARCH_URL: 'not a URL' }))
      .toThrow(/valid HTTP/)
    expect(() => getOpenSearchConfig({}, { WORKFLOW_VALIDATION_OPENSEARCH_URL: 'file:///tmp/opensearch' }))
      .toThrow(/credential-free HTTP/)
    expect(() => getOpenSearchConfig({}, { WORKFLOW_VALIDATION_OPENSEARCH_URL: 'https://user:secret@search.example' }))
      .toThrow(/credential-free HTTP/)
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

  it('scopes executions to a concrete test run invocation', () => {
    expect(runFilters({ testSuite: 'productization', invocationId: 'invocation-2' }).bool.filter)
      .toEqual(expect.arrayContaining([
        { term: { telemetry_suite: 'productization' } },
        { term: { invocation_id: 'invocation-2' } }
      ]))
  })

  it('uses telemetry_suite, never telemetry_origin, for stakeholder suite filters', async () => {
    const suiteFilter = JSON.stringify(runFilters({ testSuite: 'release-gate' }))
    expect(suiteFilter).toContain('telemetry_suite')
    expect(suiteFilter).not.toContain('telemetry_origin')
    expect(bugFilters({ testSuite: 'release-gate' }).bool.filter)
      .toContainEqual({ term: { telemetry_suite: 'release-gate' } })

    vi.stubGlobal('fetch', vi.fn((url, options) => {
      const body = JSON.parse(options.body)
      expect(url).toContain(`/${RUNS_INDEX}/`)
      expect(body.aggs.test_suites.terms.field).toBe('telemetry_suite')
      expect(JSON.stringify(body)).not.toContain('telemetry_origin')
      return Promise.resolve(jsonResponse({ aggregations: {} }))
    }))
    const routes = register()
    await routes['/filters'].at(-1)({ query: {} }, makeResponse())
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

  it('requires a Jira ID when listing product bugs', () => {
    expect(bugFilters({ category: 'PRODUCT_BUG' }).bool.filter).toContainEqual({
      exists: { field: 'bug_key' }
    })
    expect(bugFilters({ category: 'ENVIRONMENT' }).bool.filter)
      .not.toContainEqual({ exists: { field: 'bug_key' } })
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
      expect(JSON.stringify(body.query)).toContain('impacted_workflows')
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

  it('links workflow history RCAs through workflow or impacted_workflows', async () => {
    process.env.WORKFLOW_VALIDATION_OPENSEARCH_URL = 'https://search.example'
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      const body = JSON.parse(options.body)
      if (url.includes(`/${RUNS_INDEX}/`)) {
        return Promise.resolve(jsonResponse({ hits: { hits: [{
          _id: 'storage-id',
          _source: { execution_id: 'execution-1', run_id: 'run-1', workflow: 'workflow-a' }
        }] } }))
      }
      expect(url).toContain(`/${BUGS_INDEX}/`)
      expect(body.query.bool.filter).toContainEqual({ terms: { run_id: ['run-1'] } })
      expect(body.query.bool.should).toEqual([
        { term: { workflow: 'workflow-a' } },
        { term: { impacted_workflows: 'workflow-a' } }
      ])
      expect(body.query.bool.minimum_should_match).toBe(1)
      return Promise.resolve(jsonResponse({ hits: { hits: [{
        _id: 'rca-1',
        _source: { root_cause_id: 'rca-1', run_id: 'run-1', impacted_workflows: ['workflow-a'] }
      }] } }))
    }))
    const routes = register()
    const response = makeResponse()

    await routes['/workflow-history'].at(-1)({ query: { workflow: 'workflow-a' } }, response)

    expect(response.statusCode).toBe(200)
    expect(response.body.runs[0].execution_id).toBe('execution-1')
    expect(response.body.bugs[0].root_cause_id).toBe('rca-1')
  })

  it('correlates filtered Jira occurrences through workflow or impacted_workflows', async () => {
    process.env.WORKFLOW_VALIDATION_OPENSEARCH_URL = 'https://search.example'
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      const body = JSON.parse(options.body)
      if (url.includes(`/${RUNS_INDEX}/`)) {
        return Promise.resolve(jsonResponse({ hits: { hits: [{
          _source: { execution_id: 'execution-1', run_id: 'run-1', workflow: 'workflow-a' }
        }] } }))
      }
      expect(url).toContain(`/${BUGS_INDEX}/`)
      const workflowCorrelation = body.query.bool.filter.find((filter) => filter.bool?.should)
      expect(workflowCorrelation.bool.should).toEqual([
        { terms: { workflow: ['workflow-a'] } },
        { terms: { impacted_workflows: ['workflow-a'] } }
      ])
      return Promise.resolve(jsonResponse({
        hits: { total: { value: 0 }, hits: [] }, aggregations: {}
      }))
    }))
    const routes = register()

    await routes['/bugs'].at(-1)({ query: { verdict: 'FAIL' } }, makeResponse())
  })

  it('compares execution results for each test across two exact test runs', async () => {
    const bugQueries = []
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      const body = JSON.parse(options.body)
      if (url.includes(`/${BUGS_INDEX}/`)) {
        bugQueries.push(body.query)
        return Promise.resolve(jsonResponse({ hits: { hits: [] } }))
      }
      const serialized = JSON.stringify(body.query)
      const invocation = serialized.includes('run-old') ? 'run-old' : 'run-new'
      const version = invocation === 'run-old' ? '3.5' : '3.6'
      const passed = invocation === 'run-old' ? 1 : 3
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

    await routes['/run-compare'].at(-1)({ query: { baselineInvocation: 'run-old', targetInvocation: 'run-new', testSuite: 'productization' } }, response)

    expect(response.body.baseline).toEqual({ invocationId: 'run-old', version: '3.5', tests: 1 })
    expect(response.body.target).toEqual({ invocationId: 'run-new', version: '3.6', tests: 1 })
    expect(response.body.rows[0]).toMatchObject({
      workflow: 'shared-test', change: 'higher', passRateChange: 0.5,
      baseline: { executions: 4, passed: 1, failed: 3, passRate: 0.25, latest: { execution_id: '3.5-latest' } },
      target: { executions: 4, passed: 3, failed: 1, passRate: 0.75, latest: { execution_id: '3.6-latest' }, productBugs: [] }
    })
    expect(bugQueries).toHaveLength(2)
    expect(bugQueries[0].bool.filter).toContainEqual({ terms: { run_id: ['run-old'] } })
    expect(bugQueries[1].bool.filter).toContainEqual({ terms: { run_id: ['run-new'] } })
  })

  it('treats errors as unsuccessful without collapsing them into failed verdicts', () => {
    expect(runFilters({ verdict: 'ERROR' }).bool.filter)
      .toContainEqual({ term: { verdict: 'ERROR' } })
    expect(runFilters({ verdict: 'UNSUCCESSFUL' }).bool.filter)
      .toContainEqual({ terms: { verdict: ['FAIL', 'ERROR'] } })
  })

  it('groups test runs by explicit suite and invocation', async () => {
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      const body = JSON.parse(options.body)
      if (url.includes(`/${BUGS_INDEX}/`)) return Promise.resolve(jsonResponse({ hits: { hits: [] } }))
      expect(body.aggs.suite_runs.composite.sources).toEqual([
        { suite: { terms: { field: 'telemetry_suite' } } },
        { invocation: { terms: { field: 'invocation_id' } } }
      ])
      return Promise.resolve(jsonResponse({ aggregations: { suite_runs: { buckets: [{
        key: { suite: 'productization', invocation: 'invocation-1' }, doc_count: 3,
        pass_rate: { value: 2 / 3 }, passed: { doc_count: 2 }, failed: { doc_count: 1 }, errors: { doc_count: 0 },
        duration: { value: 180 }, duration_count: { value: 3 },
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
      passed: 2, failed: 1, passRate: 2 / 3, duration: 180, rhodsOperatorDigest: 'abcdef0123456789'
    })])
  })

  it('returns exact tests for one test run', async () => {
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      const body = JSON.parse(options.body)
      if (url.includes(`/${BUGS_INDEX}/`)) return Promise.resolve(jsonResponse({ hits: { hits: [] } }))
      expect(body.query.bool.filter).toContainEqual({ term: { telemetry_suite: 'productization' } })
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

  it('returns every test and separates new from known product bugs for a test run', async () => {
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      const body = JSON.parse(options.body)
      if (url.includes(`/${RUNS_INDEX}/`) && body._source?.includes('execution_id')) {
        const dashboardShape = body._source.includes('tasks_passed')
        return Promise.resolve(jsonResponse({ hits: { hits: dashboardShape ? [{
          _id: 'execution-a', _source: { execution_id: 'execution-a', run_id: 'run-1', workflow: 'test-a', verdict: 'PASS' }, sort: ['2026-09-16', 'execution-a']
        }, {
          _id: 'execution-b', _source: { execution_id: 'execution-b', run_id: 'run-1', workflow: 'test-b', verdict: 'FAIL' }, sort: ['2026-09-16', 'execution-b']
        }] : [{
          _source: { execution_id: 'execution-a', run_id: 'run-1', workflow: 'test-a' }, sort: ['2026-09-16', 'execution-a']
        }, {
          _source: { execution_id: 'execution-b', run_id: 'run-1', workflow: 'test-b' }, sort: ['2026-09-16', 'execution-b']
        }] } }))
      }
      if (url.includes(`/${RUNS_INDEX}/`)) return Promise.resolve(jsonResponse({ aggregations: {} }))
      if (body.size === 0) return Promise.resolve(jsonResponse({ aggregations: {} }))
      return Promise.resolve(jsonResponse({ hits: { hits: [{
        _id: 'new-bug', _source: { root_cause_id: 'new-bug', run_id: 'run-1', workflow: 'test-a', category: 'PRODUCT_BUG', opened: true, bug_key: 'RHOAIENG-1' }, sort: ['2026-09-16', 'new-bug']
      }, {
        _id: 'known-bug', _source: { root_cause_id: 'known-bug', run_id: 'run-1', workflow: 'test-b', category: 'PRODUCT_BUG', opened: false, action: 'EXISTING', bug_key: 'RHOAIENG-2' }, sort: ['2026-09-16', 'known-bug']
      }] } }))
    }))
    const routes = register()
    const response = makeResponse()
    await routes['/charts'].at(-1)({ query: {
      version: '3.6', testSuite: 'productization', invocationId: 'invocation-1'
    } }, response)

    expect(response.body.tests).toHaveLength(2)
    expect(response.body.tests[0].productBugs).toEqual([expect.objectContaining({ bug_key: 'RHOAIENG-1' })])
    expect(response.body.newProductBugs).toEqual([expect.objectContaining({ bug_key: 'RHOAIENG-1' })])
    expect(response.body.knownProductBugs).toEqual([expect.objectContaining({ bug_key: 'RHOAIENG-2' })])
    expect(response.body).not.toHaveProperty('failedTests')
    expect(response.body).not.toHaveProperty('recentTests')
  })

  it('requires charts to be scoped to one concrete test run', async () => {
    const routes = register()
    const response = makeResponse()
    await routes['/charts'].at(-1)({ query: { testSuite: 'release-gate' } }, response)
    expect(response.statusCode).toBe(400)
    expect(response.body.error).toMatch(/test suite and test run/i)
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

    await routes['/runs'].at(-1)({ query: { size: '-10' } }, makeResponse())
    expect(requests[3].size).toBe(2)
    await routes['/runs'].at(-1)({ query: { size: '10000' } }, makeResponse())
    expect(requests[4].size).toBe(201)

    const invalid = makeResponse()
    await routes['/runs'].at(-1)({ query: { cursor: 'not-a-cursor' } }, invalid)
    expect(invalid.statusCode).toBe(400)
  })

  it('clamps bug page sizes to the supported range', async () => {
    const requests = []
    vi.stubGlobal('fetch', vi.fn((url, options) => {
      requests.push(JSON.parse(options.body))
      return Promise.resolve(jsonResponse({ hits: { total: { value: 0 }, hits: [] }, aggregations: {} }))
    }))
    const routes = register()
    await routes['/bugs'].at(-1)({ query: { size: '-1' } }, makeResponse())
    await routes['/bugs'].at(-1)({ query: { size: '10000' } }, makeResponse())
    expect(requests.map((body) => body.size)).toEqual([2, 201])
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
          avg_duration: { value: null }, turns: { value: 5 }, turns_count: { value: 1 },
          suite_duration: { value: 60 }, suite_duration_count: { value: 2 },
          latest_metadata: { hits: { hits: [{ _source: {
            rhoai_version: '3.6.0-ea.1', rhods_operator_digest: 'abcdef0123456789'
          } }] } }
        } }))
      }
      return Promise.resolve(jsonResponse({ aggregations: {} }))
    }))
    const response = makeResponse()
    await register()['/overview'].at(-1)({ query: {} }, response)
    expect(response.body.runs).toMatchObject({
      total: 2, tasksTotal: null, tasksPassed: null, tasksFailed: null,
      aiCost: null, infraCost: null, avgDuration: null, turns: null,
      suiteDuration: 60, version: '3.6.0-ea.1', rhodsOperatorDigest: 'abcdef0123456789'
    })
  })
})
