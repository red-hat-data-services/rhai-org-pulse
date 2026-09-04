import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

const registerPackageRequestRoutes = require('../../server/package-requests')
const {
  validateRequest,
  isAtLeastDaysFromToday,
  buildEpicSummary,
  buildEpicName,
  sanitizeTeamLabel,
  buildAdfDescription,
  buildEpicFields,
  buildDuplicateJql,
  buildPipelineVariables,
  checkPypiPackage,
  getGitlabToken,
  checkRateLimit,
  recordSubmission,
  _lastSubmission,
  AIPCC_PROJECT,
  SECURITY_NAME,
  COMPONENT_NAME,
  EPIC_NAME_FIELD
} = registerPackageRequestRoutes._testExports

// --- Test helpers ---

function makeRouter() {
  const routes = { get: {}, post: {} }
  return {
    get: vi.fn(function (path, ...handlers) {
      routes.get[path] = handlers
    }),
    post: vi.fn(function (path, ...handlers) {
      routes.post[path] = handlers
    }),
    _routes: routes
  }
}

function makeRes() {
  const res = {
    _status: 200,
    _json: null,
    status(code) { res._status = code; return res },
    json(data) { res._json = data; return res }
  }
  return res
}

function isoDaysFromNow(days) {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function validBody(overrides = {}) {
  return {
    team: 'Platform',
    package_name: 'vllm',
    extras: ['cu12'],
    package_source: 'pypi',
    source_url: 'https://pypi.org/project/vllm/',
    version: '2.5.1',
    other_hardware: '',
    hardware_defaults_acknowledged: true,
    jira_id: 'AIPCC-42',
    justification: 'Needed for CUDA wheel builds',
    delivery_timeline: isoDaysFromNow(30),
    release_target: ['3.4'],
    release_commitment: '3.4 GA',
    testing_requirements: '',
    testing_defaults_acknowledged: true,
    backport_versions: null,
    ...overrides
  }
}

function makeJira(overrides = {}) {
  const base = {
    JIRA_HOST: 'https://redhat.atlassian.net',
    jiraRequest: vi.fn(async (path, opts = {}) => {
      const method = (opts.method || 'GET').toUpperCase()
      if (path.startsWith('/rest/api/3/user/search')) {
        return { users: [{ accountId: 'acc-1', email: 'jane@redhat.com' }] }
      }
      if (path === '/rest/api/3/issue' && method === 'POST') {
        return { key: 'AIPCC-999', id: '10999' }
      }
      if (method === 'PUT') {
        return {}
      }
      if (path.startsWith('/rest/api/3/issue/') && path.includes('fields=summary')) {
        const key = path.split('/').pop().split('?')[0]
        return { key, fields: { summary: 'Related issue summary' } }
      }
      throw new Error('Unexpected jiraRequest in mock: ' + method + ' ' + path)
    }),
    fetchAllJqlResults: vi.fn(async () => [])
  }
  return { ...base, ...overrides }
}

function makeFetch(impl) {
  return vi.fn(impl || (async (url, opts = {}) => {
    const method = (opts.method || 'GET').toUpperCase()
    if (String(url).startsWith('https://pypi.org/pypi/')) {
      return { ok: true, status: 200, json: async () => ({ name: 'vllm' }) }
    }
    if (String(url).includes('/api/v4/projects/') && method === 'POST') {
      return {
        ok: true,
        status: 201,
        json: async () => ({ id: 777, web_url: 'https://gitlab.com/test/proj/-/pipelines/777' })
      }
    }
    return { ok: false, status: 500, text: async () => 'unexpected fetch: ' + url }
  }))
}

function makeContext(overrides = {}) {
  return {
    secrets: {
      JIRA_EMAIL: 'svc@redhat.com',
      JIRA_TOKEN: 'jira-token',
      GITLAB_TOKEN: 'gitlab-token'
    },
    resolveSecret: vi.fn(() => null),
    requireAuth: vi.fn(function (_req, _res, next) { next() }),
    ...overrides
  }
}

function register(deps = {}, contextOverrides = {}) {
  const router = makeRouter()
  const context = makeContext(contextOverrides)
  registerPackageRequestRoutes(router, context, deps)
  return { router, context }
}

async function callHandler(router, req) {
  const handlers = router._routes.post['/package-requests']
  const handler = handlers[handlers.length - 1]
  const res = makeRes()
  await handler(req, res)
  return res
}

function adfTextOf(node) {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (node.type === 'text') return node.text || ''
  if (Array.isArray(node.content)) return node.content.map(adfTextOf).join('')
  return ''
}

function epicPostCall(jira) {
  return jira.jiraRequest.mock.calls.find(
    c => c[0] === '/rest/api/3/issue' && c[1] && c[1].method === 'POST'
  )
}

describe('package-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _lastSubmission.clear()
    delete process.env.DEMO_MODE
  })

  describe('route registration and OpenAPI', () => {
    it('registers POST /package-requests with requireAuth as the first middleware', () => {
      const { router, context } = register()
      const handlers = router._routes.post['/package-requests']
      expect(handlers).toBeDefined()
      expect(handlers[0]).toBe(context.requireAuth)
      expect(typeof handlers[handlers.length - 1]).toBe('function')
    })

    it('includes a complete @openapi annotation for the endpoint', () => {
      const source = readFileSync(require.resolve('../../server/package-requests.js'), 'utf8')
      expect(source).toContain('@openapi')
      expect(source).toContain('/api/modules/product-builds/package-requests:')
      expect(source).toMatch(/post:/)
      for (const field of [
        'team', 'package_name', 'extras', 'package_source', 'source_url', 'version',
        'other_hardware', 'hardware_defaults_acknowledged', 'jira_id', 'justification',
        'delivery_timeline', 'release_target', 'release_commitment',
        'testing_requirements', 'testing_defaults_acknowledged', 'backport_versions'
      ]) {
        expect(source).toContain(field)
      }
      for (const status of ['200', '201', '400', '401', '409', '422', '429', '502', '503']) {
        expect(source).toContain(status + ':')
      }
    })
  })

  describe('identity derivation', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const { router } = register({ isDemoMode: true })
      const res = await callHandler(router, { body: validBody() })
      expect(res._status).toBe(401)
    })

    it('rejects requests with an empty email string with 401', async () => {
      const { router } = register({ isDemoMode: true })
      const res = await callHandler(router, { userEmail: '   ', body: validBody() })
      expect(res._status).toBe(401)
    })

    it('derives the requester from req.userEmail', async () => {
      const { router } = register({ isDemoMode: true })
      const res = await callHandler(router, {
        userEmail: 'Jane@RedHat.com',
        body: validBody()
      })
      expect(res._status).toBe(200)
      expect(res._json.requester).toBe('jane@redhat.com')
    })

    it('falls back to req.user.email when req.userEmail is absent', async () => {
      const { router } = register({ isDemoMode: true })
      const res = await callHandler(router, {
        user: { email: 'bob@redhat.com' },
        body: validBody()
      })
      expect(res._status).toBe(200)
      expect(res._json.requester).toBe('bob@redhat.com')
    })

    it('ignores a requester value in the JSON body', async () => {
      const { router } = register({ isDemoMode: true })
      const res = await callHandler(router, {
        userEmail: 'jane@redhat.com',
        body: validBody({ requester: 'evil@example.com' })
      })
      expect(res._status).toBe(200)
      expect(res._json.requester).toBe('jane@redhat.com')
      expect(JSON.stringify(res._json)).not.toContain('evil@example.com')
    })
  })

  describe('validation', () => {
    async function expect422(body, field) {
      const { router } = register({ jiraClient: makeJira(), fetch: makeFetch() })
      const res = await callHandler(router, { userEmail: 'jane@redhat.com', body })
      expect(res._status).toBe(422)
      expect(res._json.fields).toHaveProperty(field)
      return res
    }

    it('returns 400 when the body is not a JSON object', async () => {
      const { router } = register()
      const res = await callHandler(router, { userEmail: 'jane@redhat.com', body: 'not-an-object' })
      expect(res._status).toBe(400)
    })

    it('rejects package names that do not match the pattern', async () => {
      await expect422(validBody({ package_name: '1bad' }), 'package_name')
      await expect422(validBody({ package_name: '' }), 'package_name')
      await expect422(validBody({ package_name: 'has space' }), 'package_name')
    })

    it('rejects extras with unsafe identifiers', async () => {
      await expect422(validBody({ extras: ['cu 12'] }), 'extras')
      await expect422(validBody({ extras: ['cu/12'] }), 'extras')
    })

    it('rejects duplicate extras', async () => {
      await expect422(validBody({ extras: ['cu12', 'CU12'] }), 'extras')
    })

    it('requires a source URL for git and other sources', async () => {
      await expect422(validBody({ package_source: 'git', source_url: null }), 'source_url')
      await expect422(validBody({ package_source: 'git', source_url: 'ftp://example.com/repo' }), 'source_url')
      await expect422(validBody({ package_source: 'other', source_url: '' }), 'source_url')
    })

    it('rejects invalid package sources', async () => {
      await expect422(validBody({ package_source: 'cargo' }), 'package_source')
    })

    it('rejects invalid Jira keys', async () => {
      await expect422(validBody({ jira_id: 'aipcc-42' }), 'jira_id')
      await expect422(validBody({ jira_id: 'A-42' }), 'jira_id')
      await expect422(validBody({ jira_id: 'AIPCC-42-' }), 'jira_id')
      await expect422(validBody({ jira_id: '' }), 'jira_id')
    })

    it('requires a non-empty justification', async () => {
      await expect422(validBody({ justification: '   ' }), 'justification')
    })

    it('requires the delivery timeline to be at least 8 calendar days out', async () => {
      await expect422(validBody({ delivery_timeline: isoDaysFromNow(7) }), 'delivery_timeline')
      await expect422(validBody({ delivery_timeline: 'not-a-date' }), 'delivery_timeline')
    })

    it('accepts a delivery timeline exactly 8 days out', async () => {
      const { router } = register({ isDemoMode: true })
      const res = await callHandler(router, {
        userEmail: 'jane@redhat.com',
        body: validBody({ delivery_timeline: isoDaysFromNow(8) })
      })
      expect(res._status).toBe(200)
      expect(res._json.demo).toBe(true)
    })

    it('requires hardware details or the hardware acknowledgement', async () => {
      await expect422(
        validBody({ other_hardware: '', hardware_defaults_acknowledged: false }),
        'other_hardware'
      )
    })

    it('accepts hardware defaults via the acknowledgement flag', async () => {
      const { router } = register({ isDemoMode: true })
      const res = await callHandler(router, {
        userEmail: 'jane@redhat.com',
        body: validBody({ other_hardware: '', hardware_defaults_acknowledged: true })
      })
      expect(res._status).toBe(200)
    })

    it('accepts hardware details without the acknowledgement flag', async () => {
      const { router } = register({ isDemoMode: true })
      const res = await callHandler(router, {
        userEmail: 'jane@redhat.com',
        body: validBody({ other_hardware: '2x H100', hardware_defaults_acknowledged: false })
      })
      expect(res._status).toBe(200)
    })

    it('requires testing requirements or the testing acknowledgement', async () => {
      await expect422(
        validBody({ testing_requirements: '', testing_defaults_acknowledged: false }),
        'testing_requirements'
      )
    })

    it('accepts testing requirements without the acknowledgement flag', async () => {
      const { router } = register({ isDemoMode: true })
      const res = await callHandler(router, {
        userEmail: 'jane@redhat.com',
        body: validBody({ testing_requirements: 'Run full wheel test suite', testing_defaults_acknowledged: false })
      })
      expect(res._status).toBe(200)
    })

    it('collects multiple field errors at once', async () => {
      const res = await expect422(
        validBody({ package_name: '1bad', justification: '', jira_id: 'nope' }),
        'package_name'
      )
      expect(res._json.fields).toHaveProperty('justification')
      expect(res._json.fields).toHaveProperty('jira_id')
    })
  })

  describe('demo mode', () => {
    it('returns a deterministic demo success and makes no external calls', async () => {
      const jira = makeJira()
      const fetchMock = makeFetch()
      const fetchIndex = vi.fn(async () => ({ found: false, files: [] }))
      const { router } = register({ jiraClient: jira, fetch: fetchMock, fetchIndex })

      process.env.DEMO_MODE = 'true'
      const req = { userEmail: 'jane@redhat.com', body: validBody() }
      const first = await callHandler(router, req)
      const second = await callHandler(router, req)

      expect(first._status).toBe(200)
      expect(first._json).toEqual({
        status: 'created',
        demo: true,
        requester: 'jane@redhat.com',
        summary: 'vllm[cu12] package update request',
        jira: { key: 'AIPCC-DEMO', url: null },
        pipeline: { triggered: false, reason: 'demo mode' }
      })
      // Rate limited on the immediate second submission (still no external calls).
      expect(second._status).toBe(429)
      expect(jira.jiraRequest).not.toHaveBeenCalled()
      expect(jira.fetchAllJqlResults).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(fetchIndex).not.toHaveBeenCalled()
    })

    it('produces identical demo responses for the same input', async () => {
      const { router } = register({ isDemoMode: true })
      const req = { userEmail: 'jane@redhat.com', body: validBody() }
      _lastSubmission.clear()
      const a = await callHandler(router, req)
      _lastSubmission.clear()
      const b = await callHandler(router, req)
      expect(a._json).toEqual(b._json)
    })
  })

  describe('duplicate detection (409)', () => {
    it('returns 409 with existing tickets when a recent duplicate Epic exists', async () => {
      const jira = makeJira({
        fetchAllJqlResults: vi.fn(async (jql) => {
          expect(jql).toContain('project = AIPCC')
          expect(jql).toContain('issuetype = Epic')
          return [{
            key: 'AIPCC-100',
            fields: {
              summary: 'vllm[cu12] package update request',
              status: { name: 'To Do' },
              created: '2026-06-01T00:00:00.000Z'
            }
          }]
        })
      })
      const { router } = register({ jiraClient: jira, fetch: makeFetch(), fetchIndex: vi.fn(async () => ({ found: false, files: [] })) })

      const res = await callHandler(router, { userEmail: 'jane@redhat.com', body: validBody() })
      expect(res._status).toBe(409)
      expect(res._json.existing_tickets).toEqual([
        {
          key: 'AIPCC-100',
          summary: 'vllm[cu12] package update request',
          status: 'To Do',
          created: '2026-06-01T00:00:00.000Z',
          url: 'https://redhat.atlassian.net/browse/AIPCC-100'
        }
      ])
      expect(epicPostCall(jira)).toBeUndefined()
    })

    it('proceeds when the duplicate search fails (fail open)', async () => {
      const jira = makeJira({
        fetchAllJqlResults: vi.fn(async () => {
          throw new Error('search exploded')
        })
      })
      const { router } = register({ jiraClient: jira, fetch: makeFetch(), fetchIndex: vi.fn(async () => ({ found: false, files: [] })) })
      const res = await callHandler(router, { userEmail: 'jane@redhat.com', body: validBody() })
      expect(res._status).toBe(201)
    })

    it('returns 422 when the related Jira issue cannot be verified', async () => {
      const jira = makeJira({
        jiraRequest: vi.fn(async (path) => {
          if (path.startsWith('/rest/api/3/issue/') && path.includes('fields=summary')) {
            throw new Error('Jira API error (404): not found')
          }
          throw new Error('Unexpected jiraRequest in mock: ' + path)
        })
      })
      const { router } = register({ jiraClient: jira, fetch: makeFetch(), fetchIndex: vi.fn(async () => ({ found: false, files: [] })) })
      const res = await callHandler(router, { userEmail: 'jane@redhat.com', body: validBody() })
      expect(res._status).toBe(422)
      expect(res._json.fields.jira_id).toContain('AIPCC-42')
    })
  })

  describe('production index warning', () => {
    it('returns a 200 warning and does not create an Epic when the package is in production', async () => {
      const fetchIndex = vi.fn(async (url) => url.includes('/3.4/')
        ? { indexExists: true, found: true, files: [{ filename: 'vllm-2.5.1-cp312-none-any.whl', url: 'x' }] }
        : { indexExists: true, found: false, files: [] })
      const jira = makeJira()
      const { router } = register({ jiraClient: jira, fetch: makeFetch(), fetchIndex })

      const res = await callHandler(router, { userEmail: 'jane@redhat.com', body: validBody() })
      expect(res._status).toBe(200)
      expect(res._json.status).toBe('warning')
      expect(res._json.warning).toBe('package_already_in_production')
      expect(res._json.package_name).toBe('vllm')
      expect(res._json.found_in).toHaveLength(1)
      expect(res._json.found_in[0].product_version).toBe('3.4')
      expect(res._json.found_in[0].files).toContain('vllm-2.5.1-cp312-none-any.whl')
      expect(epicPostCall(jira)).toBeUndefined()
    })

    it('does not consume the rate-limit slot for a warning, so an immediate skip retry succeeds', async () => {
      const fetchIndex = vi.fn(async (url) => url.includes('/3.4/')
        ? { indexExists: true, found: true, files: [{ filename: 'vllm-2.5.1-cp312-none-any.whl', url: 'x' }] }
        : { indexExists: true, found: false, files: [] })
      const jira = makeJira()
      const { router } = register({ jiraClient: jira, fetch: makeFetch(), fetchIndex })

      const first = await callHandler(router, { userEmail: 'jane@redhat.com', body: validBody() })
      expect(first._status).toBe(200)
      expect(first._json.status).toBe('warning')

      // Immediate retry with the explicit acknowledgement must not hit the 60s rate limit.
      const retry = await callHandler(router, {
        userEmail: 'jane@redhat.com',
        body: validBody({ skip_production_check: true })
      })
      expect(retry._status).toBe(201)
      expect(retry._json.jira.key).toBe('AIPCC-999')
    })

    it('skips the production check when skip_production_check is true', async () => {
      const fetchIndex = vi.fn(async () => ({ found: false, files: [] }))
      const { router } = register({
        jiraClient: makeJira(),
        fetch: makeFetch(),
        fetchIndex
      })
      const res = await callHandler(router, {
        userEmail: 'jane@redhat.com',
        body: validBody({ skip_production_check: true })
      })
      expect(res._status).toBe(201)
      expect(fetchIndex).not.toHaveBeenCalled()
    })

    it('returns 422 when a pypi source package is not found on PyPI', async () => {
      const fetchMock = makeFetch(async (url) => {
        if (String(url).startsWith('https://pypi.org/pypi/')) {
          return { ok: false, status: 404, text: async () => 'not found' }
        }
        return { ok: true, status: 200, json: async () => ({}) }
      })
      const { router } = register({ jiraClient: makeJira(), fetch: fetchMock, fetchIndex: vi.fn(async () => ({ found: false, files: [] })) })
      const res = await callHandler(router, { userEmail: 'jane@redhat.com', body: validBody() })
      expect(res._status).toBe(422)
      expect(res._json.fields.package_source).toContain('not found on PyPI')
    })
  })

  describe('successful creation', () => {
    it('creates the AIPCC Epic, sets release target, and triggers the pipeline', async () => {
      const jira = makeJira()
      const fetchMock = makeFetch()
      const fetchIndex = vi.fn(async () => ({ found: false, files: [] }))
      const { router } = register({ jiraClient: jira, fetch: fetchMock, fetchIndex })

      const res = await callHandler(router, {
        userEmail: 'jane@redhat.com',
        body: validBody()
      })

      expect(res._status).toBe(201)
      expect(res._json.status).toBe('created')
      expect(res._json.requester).toBe('jane@redhat.com')
      expect(res._json.jira).toEqual({
        key: 'AIPCC-999',
        id: '10999',
        url: 'https://redhat.atlassian.net/browse/AIPCC-999',
        summary: 'vllm[cu12] package update request'
      })
      expect(res._json.release_target_set).toBe(true)
      expect(res._json.pipeline).toEqual({
        triggered: true,
        pipeline_id: 777,
        web_url: 'https://gitlab.com/test/proj/-/pipelines/777'
      })

      // Epic creation payload
      const post = epicPostCall(jira)
      expect(post).toBeDefined()
      const fields = post[1].body.fields
      expect(fields.project).toEqual({ key: AIPCC_PROJECT })
      expect(fields.issuetype).toEqual({ name: 'Epic' })
      expect(fields.summary).toBe('vllm[cu12] package update request')
      expect(fields.labels).toContain('package')
      expect(fields.labels).toContain('dashboard-filed')
      expect(fields.labels).toContain('team-platform')
      expect(fields.duedate).toBe(isoDaysFromNow(30))
      expect(fields.security).toEqual({ name: SECURITY_NAME })
      expect(fields.components).toEqual([{ name: COMPONENT_NAME }])
      expect(fields[EPIC_NAME_FIELD]).toBe('vllm package update request')
      expect(fields[EPIC_NAME_FIELD]).not.toBe('Platform')
      expect(fields.reporter).toEqual({ accountId: 'acc-1' })

      // ADF description contains every request field
      const descText = adfTextOf(fields.description)
      expect(descText).toContain('Team: Platform')
      expect(descText).toContain('Package: vllm[cu12] 2.5.1')
      expect(descText).toContain('Requester: jane@redhat.com')
      expect(descText).toContain('Package source: pypi')
      expect(descText).toContain('https://pypi.org/project/vllm/')
      expect(descText).toContain('Hardware defaults acknowledged: yes')
      expect(descText).toContain('Justification: Needed for CUDA wheel builds')
      expect(descText).toContain('Target Date: ' + isoDaysFromNow(30))
      expect(descText).toContain('Related Jira Ticket: AIPCC-42')
      expect(descText).toContain('Release Commitment: 3.4 GA')
      expect(descText).toContain('Testing requirements: N/A')
      expect(descText).toContain('Testing defaults acknowledged: yes')
      expect(descText).toContain('Release target: 3.4')

      // Release target custom field update (non-fatal path succeeded)
      const put = jira.jiraRequest.mock.calls.find(
        c => c[0] === '/rest/api/3/issue/AIPCC-999' && c[1] && c[1].method === 'PUT'
      )
      expect(put).toBeDefined()
      expect(put[1].body.fields).toEqual({
        customfield_10855: [{ name: '3.4' }]
      })

      // Pipeline trigger used the GitLab token and carried the request variables
      const pipelineCall = fetchMock.mock.calls.find(
        c => String(c[0]).includes('/api/v4/projects/') && (c[1].method || 'GET') === 'POST'
      )
      expect(pipelineCall).toBeDefined()
      expect(String(pipelineCall[0])).toContain('/projects/redhat%2Frhel-ai%2Fcore%2Fpackage-onboarding/pipelines')
      expect(pipelineCall[1].headers['PRIVATE-TOKEN']).toBe('gitlab-token')
      const pipelineBody = JSON.parse(pipelineCall[1].body)
      expect(pipelineBody.variables.PACKAGE_NAME).toBe('vllm[cu12]')
      expect(pipelineBody.variables.JIRA_TICKET_ID).toBe('AIPCC-999')
      expect(pipelineBody.variables.PACKAGE_VERSION).toBe('2.5.1')
      expect(pipelineBody.variables.PACKAGE_REQUEST_EPIC).toBeUndefined()
    })

    it('still succeeds when the pipeline trigger fails (non-fatal)', async () => {
      const fetchMock = makeFetch(async (url, opts = {}) => {
        if (String(url).includes('/api/v4/projects/') && (opts.method || 'GET') === 'POST') {
          return { ok: false, status: 500, text: async () => 'pipeline exploded' }
        }
        return { ok: true, status: 200, json: async () => ({}) }
      })
      const jira = makeJira()
      const { router } = register({ jiraClient: jira, fetch: fetchMock, fetchIndex: vi.fn(async () => ({ found: false, files: [] })) })

      const res = await callHandler(router, { userEmail: 'jane@redhat.com', body: validBody() })
      expect(res._status).toBe(201)
      expect(res._json.jira.key).toBe('AIPCC-999')
      expect(res._json.pipeline.triggered).toBe(false)
      expect(res._json.pipeline.error).toContain('500')
      expect(epicPostCall(jira)).toBeDefined()
    })

    it('reports the pipeline as skipped when no GitLab token is configured', async () => {
      const { router } = register(
        { jiraClient: makeJira(), fetch: makeFetch(), fetchIndex: vi.fn(async () => ({ found: false, files: [] })) },
        { secrets: { JIRA_EMAIL: 'svc@redhat.com', JIRA_TOKEN: 'jira-token' } }
      )
      const res = await callHandler(router, { userEmail: 'jane@redhat.com', body: validBody() })
      expect(res._status).toBe(201)
      expect(res._json.pipeline).toEqual({ triggered: false, reason: 'gitlab_token_not_configured' })
    })

    it('uses the nightly pipeline token as a fallback', async () => {
      const fetchMock = makeFetch()
      const { router } = register(
        { jiraClient: makeJira(), fetch: fetchMock, fetchIndex: vi.fn(async () => ({ found: false, files: [] })) },
        { secrets: { JIRA_EMAIL: 'svc@redhat.com', JIRA_TOKEN: 'jira-token', NIGHTLY_PIPELINE_GITLAB_TOKEN: 'nightly-token' } }
      )
      const res = await callHandler(router, { userEmail: 'jane@redhat.com', body: validBody() })
      expect(res._status).toBe(201)
      expect(res._json.pipeline.triggered).toBe(true)
      const pipelineCall = fetchMock.mock.calls.find(
        c => String(c[0]).includes('/api/v4/projects/') && (c[1].method || 'GET') === 'POST'
      )
      expect(pipelineCall[1].headers['PRIVATE-TOKEN']).toBe('nightly-token')
    })

    it('returns 503 when Jira is not configured', async () => {
      const { router } = register({}, { secrets: {} })
      const res = await callHandler(router, { userEmail: 'jane@redhat.com', body: validBody() })
      expect(res._status).toBe(503)
    })
  })

  describe('rate limiting (429)', () => {
    it('allows one submission per user per 60 seconds', async () => {
      const deps = {
        jiraClient: makeJira(),
        fetch: makeFetch(),
        fetchIndex: vi.fn(async () => ({ found: false, files: [] }))
      }
      const { router } = register(deps)
      const first = await callHandler(router, { userEmail: 'jane@redhat.com', body: validBody() })
      expect(first._status).toBe(201)

      const second = await callHandler(router, { userEmail: 'jane@redhat.com', body: validBody() })
      expect(second._status).toBe(429)
      expect(second._json.retry_after_seconds).toBeGreaterThanOrEqual(1)
      expect(second._json.retry_after_seconds).toBeLessThanOrEqual(60)

      // A different user is not blocked
      const third = await callHandler(router, { userEmail: 'other@redhat.com', body: validBody() })
      expect(third._status).toBe(201)
    })
  })

  describe('helper functions', () => {
    it('validateRequest normalizes the request', () => {
      const { valid, errors, request } = validateRequest(validBody(), {
        now: new Date()
      })
      expect(valid).toBe(true)
      expect(errors).toEqual({})
      expect(request.packageName).toBe('vllm')
      expect(request.extras).toEqual(['cu12'])
      expect(request.source).toBe('pypi')
      expect(request.hardwareAck).toBe(true)
      expect(request.testingAck).toBe(true)
      expect(request.releaseTarget).toEqual(['3.4'])
      expect(request.backportVersions).toBeNull()
      expect(request.skipProductionCheck).toBe(false)
    })

    it('validateRequest accepts explicit hardware and testing text without flags', () => {
      const { valid } = validateRequest(validBody({
        other_hardware: '2x H100',
        hardware_defaults_acknowledged: false,
        testing_requirements: 'Full suite',
        testing_defaults_acknowledged: false
      }))
      expect(valid).toBe(true)
    })

    it('isAtLeastDaysFromToday uses calendar days', () => {
      const now = new Date('2026-01-10T12:00:00Z')
      expect(isAtLeastDaysFromToday('2026-01-18', 8, now)).toBe(true)
      expect(isAtLeastDaysFromToday('2026-01-17', 8, now)).toBe(false)
      expect(isAtLeastDaysFromToday('2026-01-10', 8, now)).toBe(false)
    })

    it('buildEpicSummary formats the summary', () => {
      expect(buildEpicSummary('vllm', ['cu12'])).toBe('vllm[cu12] package update request')
      expect(buildEpicSummary('vllm', ['cu12', 'dev'])).toBe('vllm[cu12,dev] package update request')
      expect(buildEpicSummary('vllm', null)).toBe('vllm package update request')
      expect(buildEpicSummary('vllm', [])).toBe('vllm package update request')
    })

    it('sanitizeTeamLabel produces safe Jira labels', () => {
      expect(sanitizeTeamLabel('Platform Eng')).toBe('team-platform-eng')
      expect(sanitizeTeamLabel('AI-ML')).toBe('team-ai-ml')
      expect(sanitizeTeamLabel('!!!')).toBe('team-unknown')
    })

    it('buildAdfDescription states explicit hardware/testing acknowledgements', () => {
      const base = validateRequest(validBody()).request
      const acked = adfTextOf(buildAdfDescription(base, 'j@r.com', 'https://redhat.atlassian.net'))
      expect(acked).toContain('Hardware defaults acknowledged: yes')
      expect(acked).toContain('Testing defaults acknowledged: yes')

      const explicit = validateRequest(validBody({
        other_hardware: '2x H100',
        hardware_defaults_acknowledged: false,
        testing_requirements: 'Full suite',
        testing_defaults_acknowledged: false
      })).request
      const explicitText = adfTextOf(buildAdfDescription(explicit, 'j@r.com', 'https://redhat.atlassian.net'))
      expect(explicitText).toContain('Other hardware: 2x H100')
      expect(explicitText).toContain('Hardware defaults acknowledged: no')
      expect(explicitText).toContain('Testing requirements: Full suite')
      expect(explicitText).toContain('Testing defaults acknowledged: no')
    })

    it('buildEpicFields sets Epic Name and omits reporter when the accountId is unknown', () => {
      const request = validateRequest(validBody()).request
      const fields = buildEpicFields(request, 'j@r.com', { jiraHost: 'https://redhat.atlassian.net' })
      expect(fields.reporter).toBeUndefined()
      expect(fields[EPIC_NAME_FIELD]).toBe('vllm package update request')
      expect(fields.labels).toEqual(['package', 'dashboard-filed', 'team-platform'])
    })

    it('buildEpicName matches the legacy Epic Name template', () => {
      expect(buildEpicName('vllm')).toBe('vllm package update request')
    })

    it('buildDuplicateJql targets recent AIPCC package Epics', () => {
      const jql = buildDuplicateJql('vllm')
      expect(jql).toContain('project = AIPCC')
      expect(jql).toContain('issuetype = Epic')
      expect(jql).toContain('"package", "dashboard-filed"')
      expect(jql).toContain('summary ~ "*vllm*"')
      expect(jql).toContain('created >= -30d')
    })

    it('buildPipelineVariables carries the request into pipeline variables', () => {
      const request = validateRequest(validBody()).request
      const vars = buildPipelineVariables(request, 'AIPCC-999')
      expect(vars).toEqual({
        PACKAGE_NAME: 'vllm[cu12]',
        JIRA_TICKET_ID: 'AIPCC-999',
        PACKAGE_VERSION: '2.5.1'
      })
    })

    it('getGitlabToken prefers GITLAB_TOKEN over the nightly fallback', () => {
      expect(getGitlabToken({ GITLAB_TOKEN: 'a', NIGHTLY_PIPELINE_GITLAB_TOKEN: 'b' })).toBe('a')
      expect(getGitlabToken({ NIGHTLY_PIPELINE_GITLAB_TOKEN: 'b' })).toBe('b')
      expect(getGitlabToken({})).toBeNull()
    })

    it('checkPypiPackage reports found/missing and throws on API errors', async () => {
      const okFetch = vi.fn(async () => ({ ok: true, status: 200 }))
      await expect(checkPypiPackage('vllm', okFetch)).resolves.toEqual({ found: true })
      expect(okFetch.mock.calls[0][0]).toBe('https://pypi.org/pypi/vllm/json')

      const notFound = vi.fn(async () => ({ ok: false, status: 404 }))
      await expect(checkPypiPackage('vllm', notFound)).resolves.toEqual({ found: false })

      const broken = vi.fn(async () => ({ ok: false, status: 500 }))
      await expect(checkPypiPackage('vllm', broken)).rejects.toThrow('HTTP 500')
    })

    it('checkRateLimit and recordSubmission enforce the 60 second window', () => {
      const t0 = 1_000_000
      expect(checkRateLimit('a@b.com', t0)).toEqual({ allowed: true, retryAfterSeconds: 0 })

      recordSubmission('a@b.com', t0)
      const blocked = checkRateLimit('A@B.COM', t0 + 30_000)
      expect(blocked.allowed).toBe(false)
      expect(blocked.retryAfterSeconds).toBe(30)

      expect(checkRateLimit('a@b.com', t0 + 61_000).allowed).toBe(true)
    })
  })
})
