import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

const registerTriageRequestRoutes = require('../../server/triage-requests')
const {
  TRIAGE_LEAD_BUSINESS_DAYS,
  COMPONENT_NAME,
  DEFAULT_TRIAGE_ASSIGNEE_EMAIL,
  validateRpmRequest,
  validateChannelRequest,
  buildRpmSummary,
  buildChannelSummary,
  buildTriageEpicFields,
  resolveTriageAssigneeEmail
} = registerTriageRequestRoutes._testExports
const {
  earliestBusinessDate,
  _lastSubmission,
  _pendingSubmissions
} = require('../../server/request-common')

const NOW = new Date('2026-10-28T12:00:00Z')
// 20 business days after Wed 2026-10-28.
const EARLIEST = '2026-11-25'

function makeRouter() {
  const routes = { post: {} }
  return {
    post: vi.fn(function (path, ...handlers) { routes.post[path] = handlers }),
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

function commonBody(overrides = {}) {
  return {
    team: 'AIPCC Ecosystems',
    project: 'RHAI',
    jira_id: 'RHAISTRAT-42',
    justification: 'Needed for the new accelerator',
    delivery_timeline: EARLIEST,
    ...overrides
  }
}

function rpmBody(overrides = {}) {
  return commonBody({
    rpm_name: 'gcc-toolset-14',
    version: '14.2.1',
    source_url: 'https://koji.fedoraproject.org/koji/packageinfo?packageID=1',
    source_details: '',
    channels: ['cuda13.0-torch2.11-ubi9', 'rocm6.4-torch2.11-ubi9'],
    release_target: null,
    release_commitment: '',
    ...overrides
  })
}

function channelBody(overrides = {}) {
  return commonBody({
    torch_version: '2.12',
    accelerator: 'ROCm 10.4',
    os: 'RHEL 10',
    ...overrides
  })
}

function makeJira(overrides = {}) {
  return {
    JIRA_HOST: 'https://redhat.atlassian.net',
    jiraRequest: vi.fn(async (path, opts = {}) => {
      const method = (opts.method || 'GET').toUpperCase()
      if (path.startsWith('/rest/api/3/user/search')) {
        const query = new URLSearchParams(path.split('?')[1]).get('query')
        return [{ accountId: 'acc-' + query, emailAddress: query }]
      }
      if (path === '/rest/api/3/issue' && method === 'POST') return { key: 'RHAI-321', id: '10321' }
      if (method === 'PUT') return {}
      if (path.includes('fields=summary')) {
        return { key: path.split('/').pop().split('?')[0], fields: { summary: 'Approved STRAT' } }
      }
      throw new Error('Unexpected jiraRequest in mock: ' + method + ' ' + path)
    }),
    ...overrides
  }
}

function register(deps = {}, secrets = {}) {
  const router = makeRouter()
  const context = {
    secrets: { JIRA_EMAIL: 'svc@redhat.com', JIRA_TOKEN: 'token', ...secrets },
    resolveSecret: vi.fn(() => null),
    requireAuth: vi.fn(function (_req, _res, next) { next() })
  }
  registerTriageRequestRoutes(router, context, { now: () => NOW, ...deps })
  return { router, context }
}

async function call(router, path, req) {
  const handlers = router._routes.post[path]
  const res = makeRes()
  await handlers[handlers.length - 1]({ userEmail: 'jane@redhat.com', ...req }, res)
  return res
}

function epicPost(jira) {
  return jira.jiraRequest.mock.calls.find(c => c[0] === '/rest/api/3/issue' && c[1] && c[1].method === 'POST')
}

describe('triage-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _lastSubmission.clear()
    _pendingSubmissions.clear()
    delete process.env.DEMO_MODE
  })

  describe('route registration and OpenAPI', () => {
    it('registers both POST routes behind requireAuth', () => {
      const { router, context } = register()
      expect(Object.keys(router._routes.post)).toEqual(['/rpm-requests', '/channel-requests'])
      for (const handlers of Object.values(router._routes.post)) {
        expect(handlers[0]).toBe(context.requireAuth)
      }
    })

    it('annotates both routes', () => {
      const source = readFileSync(new URL('../../server/triage-requests.js', import.meta.url), 'utf8')
      expect(source).toContain('/api/modules/product-builds/rpm-requests:')
      expect(source).toContain('/api/modules/product-builds/channel-requests:')
    })
  })

  describe('delivery date floor', () => {
    it('is 20 business days and never calls itself an SLA', () => {
      expect(TRIAGE_LEAD_BUSINESS_DAYS).toBe(20)
      expect(earliestBusinessDate(20, NOW)).toBe(EARLIEST)
      const { errors } = validateChannelRequest(channelBody({ delivery_timeline: '2026-11-24' }), { now: NOW })
      expect(errors.delivery_timeline).toBe(`Delivery date must be on or after ${EARLIEST}`)
      expect(errors.delivery_timeline).not.toMatch(/SLA/i)
      expect(validateRpmRequest(rpmBody(), { now: NOW }).valid).toBe(true)
    })

    it('rejects calendar dates that do not exist instead of rolling them over', () => {
      const { errors } = validateRpmRequest(rpmBody({ delivery_timeline: '2027-02-31' }), { now: NOW })
      expect(errors.delivery_timeline).toBe('Delivery timeline must be a valid date in YYYY-MM-DD format')
    })
  })

  describe('validateRpmRequest', () => {
    it('requires the common fields', () => {
      const { errors } = validateRpmRequest(rpmBody({ team: '', jira_id: 'nope', justification: ' ', delivery_timeline: 'x' }), { now: NOW })
      expect(Object.keys(errors).sort()).toEqual(['delivery_timeline', 'jira_id', 'justification', 'team'])
    })

    it('validates the RPM name and version', () => {
      expect(validateRpmRequest(rpmBody({ rpm_name: 'gcc-c++' }), { now: NOW }).valid).toBe(true)
      expect(validateRpmRequest(rpmBody({ rpm_name: 'bad name' }), { now: NOW }).errors.rpm_name).toBeTruthy()
      expect(validateRpmRequest(rpmBody({ version: '1.0~rc1' }), { now: NOW }).valid).toBe(true)
      expect(validateRpmRequest(rpmBody({ version: '1 0' }), { now: NOW }).errors.version).toBeTruthy()
    })

    it('needs a source URL or free text source details', () => {
      expect(validateRpmRequest(rpmBody({ source_url: '', source_details: '' }), { now: NOW }).errors.source_url)
        .toBe('Provide a source URL or describe where the RPM comes from')
      expect(validateRpmRequest(rpmBody({ source_url: '', source_details: 'EPEL 10' }), { now: NOW }).valid).toBe(true)
      expect(validateRpmRequest(rpmBody({ source_url: 'ftp://x' }), { now: NOW }).errors.source_url)
        .toBe('Source URL must be an HTTP or HTTPS URL')
    })

    it('requires at least one valid channel and removes duplicates', () => {
      expect(validateRpmRequest(rpmBody({ channels: [] }), { now: NOW }).errors.channels).toBe('Select at least one channel')
      expect(validateRpmRequest(rpmBody({ channels: 'cuda' }), { now: NOW }).errors.channels).toBe('Select at least one channel')
      expect(validateRpmRequest(rpmBody({ channels: ['bad channel'] }), { now: NOW }).errors.channels).toBeTruthy()
      const { request } = validateRpmRequest(rpmBody({ channels: ['a1', ' a1 ', 'b2'] }), { now: NOW })
      expect(request.channels).toEqual(['a1', 'b2'])
    })
  })

  describe('validateChannelRequest', () => {
    it('requires torch version, accelerator and OS as free text', () => {
      const { errors } = validateChannelRequest(channelBody({ torch_version: '', accelerator: ' ', os: undefined }), { now: NOW })
      expect(errors).toMatchObject({
        torch_version: 'Torch version is required',
        accelerator: 'Accelerator is required',
        os: 'Operating system is required'
      })
      expect(validateChannelRequest(channelBody({ accelerator: 'x'.repeat(201) }), { now: NOW }).errors.accelerator)
        .toBe('Accelerator must be at most 200 characters')
    })
  })

  describe('Epic fields', () => {
    it('builds an RPM Epic with the AIPCC Ecosystems component and triage labels', () => {
      const { request } = validateRpmRequest(rpmBody(), { now: NOW })
      const fields = buildTriageEpicFields('rpm', request, 'jane@redhat.com', {
        jiraHost: 'https://redhat.atlassian.net', reporterAccountId: 'acc-1', jiraProject: 'RHAI'
      })
      expect(COMPONENT_NAME).toBe('AIPCC Ecosystems')
      expect(fields).toMatchObject({
        project: { key: 'RHAI' },
        issuetype: { name: 'Epic' },
        summary: 'gcc-toolset-14 14.2.1 RPM request',
        labels: ['rpm-request', 'org-pulse-filed', 'team-aipcc-ecosystems'],
        duedate: EARLIEST,
        security: { name: 'Red Hat Employee' },
        components: [{ name: 'AIPCC Ecosystems' }],
        customfield_10011: 'gcc-toolset-14 14.2.1 RPM request',
        reporter: { accountId: 'acc-1' }
      })
      expect(fields.labels).not.toContain('package')
      expect(fields.labels).not.toContain('dashboard-filed')
      expect(JSON.stringify(fields.description)).toContain('cuda13.0-torch2.11-ubi9, rocm6.4-torch2.11-ubi9')
    })

    it('summarises channel requests and caps the summary length', () => {
      const { request } = validateChannelRequest(channelBody(), { now: NOW })
      expect(buildChannelSummary(request)).toBe('New channel request: torch 2.12, ROCm 10.4, RHEL 10')
      const long = buildChannelSummary({ ...request, os: 'x'.repeat(300) })
      expect(long.length).toBe(255)
      expect(buildRpmSummary({ rpmName: 'zlib', version: '' })).toBe('zlib RPM request')
    })
  })

  describe('triage assignee', () => {
    it('defaults to Einat and can be overridden', () => {
      expect(DEFAULT_TRIAGE_ASSIGNEE_EMAIL).toBe('epacific@redhat.com')
      expect(resolveTriageAssigneeEmail({})).toBe('epacific@redhat.com')
      expect(resolveTriageAssigneeEmail({ REQUEST_TRIAGE_ASSIGNEE_EMAIL: ' Triage@RedHat.com ' })).toBe('triage@redhat.com')
    })
  })

  describe('POST handlers', () => {
    it('files an RPM Epic, sets the release target, and assigns it for triage', async () => {
      const jira = makeJira()
      const { router } = register({ jiraClient: jira })
      const res = await call(router, '/rpm-requests', { body: rpmBody({ release_target: ['3.6'] }) })

      expect(res._status).toBe(201)
      expect(res._json).toMatchObject({
        status: 'created',
        requester: 'jane@redhat.com',
        jira: { key: 'RHAI-321', url: 'https://redhat.atlassian.net/browse/RHAI-321', project: 'RHAI' },
        related_issue: { key: 'RHAISTRAT-42' },
        reporter_set: true,
        release_target_set: true,
        assignee: { assigned: true, email: 'epacific@redhat.com' }
      })
      expect(epicPost(jira)[1].body.fields.components).toEqual([{ name: 'AIPCC Ecosystems' }])
      expect(jira.jiraRequest).toHaveBeenCalledWith('/rest/api/3/issue/RHAI-321/assignee', {
        method: 'PUT',
        body: { accountId: 'acc-epacific@redhat.com' }
      })
    })

    it('files a channel Epic in the pinned project and assigns the configured owner', async () => {
      const jira = makeJira()
      const { router } = register({ jiraClient: jira }, {
        PACKAGE_REQUEST_JIRA_PROJECT: 'TP',
        REQUEST_TRIAGE_ASSIGNEE_EMAIL: 'triage@redhat.com'
      })
      const res = await call(router, '/channel-requests', { body: channelBody() })

      expect(res._status).toBe(201)
      expect(res._json.jira.project).toBe('TP')
      expect(res._json).not.toHaveProperty('release_target_set')
      expect(res._json.assignee).toEqual({ assigned: true, email: 'triage@redhat.com' })
      expect(epicPost(jira)[1].body.fields).toMatchObject({
        project: { key: 'TP' },
        labels: ['channel-request', 'org-pulse-filed', 'team-aipcc-ecosystems']
      })
    })

    it('still files the Epic when the assignee cannot be set', async () => {
      const jira = makeJira()
      const base = jira.jiraRequest.getMockImplementation()
      jira.jiraRequest.mockImplementation(async (path, opts = {}) => {
        if (path.endsWith('/assignee')) throw new Error('Jira API error (403): no permission')
        return base(path, opts)
      })
      const { router } = register({ jiraClient: jira })
      const res = await call(router, '/channel-requests', { body: channelBody() })
      expect(res._status).toBe(201)
      expect(res._json.assignee).toMatchObject({ assigned: false, error: 'Jira API error (403): no permission' })
    })

    it('retries without the reporter when Jira rejects it', async () => {
      const jira = makeJira()
      const base = jira.jiraRequest.getMockImplementation()
      let attempts = 0
      jira.jiraRequest.mockImplementation(async (path, opts = {}) => {
        if (path === '/rest/api/3/issue' && opts.method === 'POST' && attempts++ === 0) {
          throw new Error('Jira API error (400): {"errors":{"reporter":"cannot be set"}}')
        }
        return base(path, opts)
      })
      const { router } = register({ jiraClient: jira })
      const res = await call(router, '/rpm-requests', { body: rpmBody() })
      expect(res._status).toBe(201)
      expect(res._json.reporter_set).toBe(false)
    })

    it('rejects an unknown related Jira issue', async () => {
      const jira = makeJira()
      const base = jira.jiraRequest.getMockImplementation()
      jira.jiraRequest.mockImplementation(async (path, opts = {}) => {
        if (path.includes('fields=summary')) throw new Error('Jira API error (404)')
        return base(path, opts)
      })
      const { router } = register({ jiraClient: jira })
      const res = await call(router, '/channel-requests', { body: channelBody() })
      expect(res._status).toBe(422)
      expect(res._json.fields.jira_id).toContain('RHAISTRAT-42')
      expect(epicPost(jira)).toBeUndefined()
    })

    it('returns 422 field errors, 400 for non-objects and 401 without identity', async () => {
      const { router } = register({ jiraClient: makeJira() })
      const invalid = await call(router, '/rpm-requests', { body: rpmBody({ channels: [] }) })
      expect(invalid._status).toBe(422)
      expect(invalid._json.fields.channels).toBe('Select at least one channel')
      expect((await call(router, '/rpm-requests', { body: [] }))._status).toBe(400)
      expect((await call(router, '/rpm-requests', { userEmail: '', body: rpmBody() }))._status).toBe(401)
    })

    it('reports Jira creation failures and missing Jira configuration', async () => {
      const jira = makeJira()
      const base = jira.jiraRequest.getMockImplementation()
      jira.jiraRequest.mockImplementation(async (path, opts = {}) => {
        if (path === '/rest/api/3/issue' && opts.method === 'POST') throw new Error('Jira API error (500): boom')
        return base(path, opts)
      })
      const failing = register({ jiraClient: jira }).router
      const res = await call(failing, '/rpm-requests', { body: rpmBody() })
      expect(res._status).toBe(502)
      expect(res._json.error).toBe('Failed to create Jira Epic: Jira API error (500): boom')

      const router = makeRouter()
      registerTriageRequestRoutes(router, { secrets: {} }, { now: () => NOW })
      expect((await call(router, '/channel-requests', { body: channelBody() }))._status).toBe(503)
    })

    it('rate limits each request type separately after a successful filing', async () => {
      const { router } = register({ jiraClient: makeJira() })
      expect((await call(router, '/rpm-requests', { body: rpmBody() }))._status).toBe(201)
      const second = await call(router, '/rpm-requests', { body: rpmBody() })
      expect(second._status).toBe(429)
      expect(second._json.error).toBe('Rate limited: one RPM request per user per 60 seconds')
      expect((await call(router, '/channel-requests', { body: channelBody() }))._status).toBe(201)
    })

    it('returns a deterministic demo response without calling Jira', async () => {
      const jira = makeJira()
      const { router } = register({ jiraClient: jira, isDemoMode: true })
      const res = await call(router, '/channel-requests', { body: channelBody() })
      expect(res._status).toBe(200)
      expect(res._json).toEqual({
        status: 'created',
        demo: true,
        requester: 'jane@redhat.com',
        summary: 'New channel request: torch 2.12, ROCm 10.4, RHEL 10',
        jira: { key: 'RHAI-DEMO', url: null, project: 'RHAI' },
        reporter_set: false,
        assignee: { assigned: false, email: 'epacific@redhat.com', reason: 'demo mode' }
      })
      expect(jira.jiraRequest).not.toHaveBeenCalled()
    })
  })
})
