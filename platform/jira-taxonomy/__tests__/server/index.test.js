import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeStorage(initial = {}) {
  const data = { ...initial }
  return {
    readFromStorage: vi.fn(async (key) => data[key] ? JSON.parse(JSON.stringify(data[key])) : null),
    writeToStorage: vi.fn(async (key, val) => { data[key] = JSON.parse(JSON.stringify(val)) }),
    _data: data
  }
}

function setupRoutes(storageData = {}) {
  const handlers = {}
  const mockRouter = {
    get(path, ...args) { handlers[`GET ${path}`] = args },
    post(path, ...args) { handlers[`POST ${path}`] = args },
    put(path, ...args) { handlers[`PUT ${path}`] = args },
    delete(path, ...args) { handlers[`DELETE ${path}`] = args }
  }

  const storage = makeStorage(storageData)
  const context = {
    storage,
    requireAdmin: (req, res, next) => next(),
    requireScope: () => (req, res, next) => next()
  }

  const registerRoutes = require('../../server/index')
  registerRoutes(mockRouter, context)

  return { handlers, storage }
}

function callHandler(handlerArgs, req) {
  const handler = handlerArgs[handlerArgs.length - 1]
  const res = {
    _status: 200,
    _body: null,
    _headers: {},
    status(code) { res._status = code; return res },
    json(body) { res._body = body; return res },
    set(key, val) { res._headers[key] = val; return res }
  }
  const result = handler(req, res)
  if (result && typeof result.then === 'function') {
    return result.then(() => res).catch(() => res)
  }
  return Promise.resolve(res)
}

const sampleFieldOptions = {
  name: 'components',
  label: 'Components',
  values: ['Authorino', 'Dashboard', 'Notebooks'],
  source: 'jira',
  sourceProject: 'RHAI',
  syncedAt: '2026-07-01T12:00:00.000Z',
  richValues: {
    Authorino: { id: '10001', description: 'Auth service', lead: { displayName: 'Alice', emailAddress: 'alice@redhat.com' }, assigneeType: 'COMPONENT_LEAD' },
    Dashboard: { id: '10003', description: 'Web console', lead: { displayName: 'Charlie', emailAddress: 'charlie@redhat.com' }, assigneeType: 'COMPONENT_LEAD' },
    Notebooks: { id: '10008', description: 'Jupyter notebooks', lead: null, assigneeType: 'PROJECT_DEFAULT' }
  }
}

describe('GET /jira-components', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns components from field-options store', async () => {
    const { handlers } = setupRoutes({ 'team-data/field-options/component.json': sampleFieldOptions })
    const res = await callHandler(handlers['GET /jira-components'], {})
    expect(res._status).toBe(200)
    expect(res._body.components).toHaveLength(3)
    expect(res._body.components[0].name).toBe('Authorino')
    expect(res._body.components[0].description).toBe('Auth service')
    expect(res._body.components[0].lead.displayName).toBe('Alice')
    expect(res._body.project).toBe('RHAI')
    expect(res._body.fetchedAt).toBe('2026-07-01T12:00:00.000Z')
    expect(res._body.source).toBe('jira')
  })

  it('returns empty response when field-options file is missing', async () => {
    const { handlers } = setupRoutes({})
    const res = await callHandler(handlers['GET /jira-components'], {})
    expect(res._status).toBe(200)
    expect(res._body.components).toEqual([])
    expect(res._body.fetchedAt).toBeNull()
    expect(res._body.project).toBeNull()
  })

  it('handles components without rich values', async () => {
    const minimal = {
      name: 'components',
      values: ['Alpha', 'Beta'],
      source: 'jira',
      sourceProject: 'DEMO',
      syncedAt: '2026-07-01T00:00:00Z'
    }
    const { handlers } = setupRoutes({ 'team-data/field-options/component.json': minimal })
    const res = await callHandler(handlers['GET /jira-components'], {})
    expect(res._status).toBe(200)
    expect(res._body.components).toHaveLength(2)
    expect(res._body.components[0].name).toBe('Alpha')
    expect(res._body.components[0].description).toBe('')
    expect(res._body.components[0].lead).toBeNull()
  })

  it('uses updatedAt as fetchedAt when syncedAt is absent', async () => {
    const noSync = {
      name: 'components',
      values: ['A'],
      updatedAt: '2026-06-15T00:00:00Z'
    }
    const { handlers } = setupRoutes({ 'team-data/field-options/component.json': noSync })
    const res = await callHandler(handlers['GET /jira-components'], {})
    expect(res._body.fetchedAt).toBe('2026-06-15T00:00:00Z')
  })
})

describe('POST /jira-components/request', () => {
  let testUserCounter = 0

  beforeEach(() => {
    vi.resetModules()
    mockFetch.mockReset()
    delete process.env.DEMO_MODE
    // Each test gets a unique email to avoid cross-test rate limiting
    testUserCounter++
  })

  function uniqueEmail() {
    return `test${testUserCounter}@redhat.com`
  }

  const validPayload = {
    preRequestConfirmation: ['item1', 'item2', 'item3', 'item4'],
    proposedName: 'Test Component',
    description: 'A test component',
    justification: 'Needed for testing',
    owningPm: 'Jane Doe',
    pmDirectorApproval: 'John Smith',
    engineeringTeamAndManager: 'Platform Team - Bob Jones',
    componentLead: 'Alice Williams',
    leadershipAlignment: ['PM approved', 'Eng approved']
  }

  it('submits valid request to Google Form and returns success', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const email = uniqueEmail()
    const { handlers } = setupRoutes({})
    const res = await callHandler(handlers['POST /jira-components/request'], {
      body: validPayload,
      userEmail: email
    })
    expect(res._status).toBe(200)
    expect(res._body.success).toBe(true)
    expect(res._body.submittedBy).toBe(email)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('google.com/forms'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('returns 400 for missing required fields', async () => {
    const { handlers } = setupRoutes({})
    const res = await callHandler(handlers['POST /jira-components/request'], {
      body: { proposedName: 'Test' },
      userEmail: uniqueEmail()
    })
    expect(res._status).toBe(400)
    expect(res._body.error).toBe('Validation failed')
    expect(res._body.details.length).toBeGreaterThan(0)
  })

  it('returns 502 when Google Form fails but saves locally', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 })
    const email = uniqueEmail()
    const { handlers, storage } = setupRoutes({})
    const res = await callHandler(handlers['POST /jira-components/request'], {
      body: validPayload,
      userEmail: email
    })
    expect(res._status).toBe(502)
    expect(res._body.savedLocally).toBe(true)
    expect(storage.writeToStorage).toHaveBeenCalledWith(
      'component-requests-log.json',
      expect.objectContaining({ submissions: expect.any(Array) })
    )
  })

  it('logs submission in component-requests-log.json', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const email = uniqueEmail()
    const { handlers, storage } = setupRoutes({})
    await callHandler(handlers['POST /jira-components/request'], {
      body: validPayload,
      userEmail: email
    })
    expect(storage.writeToStorage).toHaveBeenCalledWith(
      'component-requests-log.json',
      expect.objectContaining({
        submissions: expect.arrayContaining([
          expect.objectContaining({
            submittedBy: email,
            payload: validPayload
          })
        ])
      })
    )
  })

  it('returns 400 for proposedName exceeding 200 characters', async () => {
    const { handlers } = setupRoutes({})
    const res = await callHandler(handlers['POST /jira-components/request'], {
      body: { ...validPayload, proposedName: 'x'.repeat(201) },
      userEmail: uniqueEmail()
    })
    expect(res._status).toBe(400)
    expect(res._body.details).toContain('proposedName must be 200 characters or fewer')
  })

  it('skips Google Form POST in demo mode', async () => {
    process.env.DEMO_MODE = 'true'
    const { handlers } = setupRoutes({})
    const res = await callHandler(handlers['POST /jira-components/request'], {
      body: validPayload,
      userEmail: uniqueEmail()
    })
    expect(res._status).toBe(200)
    expect(res._body.demo).toBe(true)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('resolves submitter email from registry when userUid is present', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    const registry = {
      people: { 'uid123': { email: 'resolved@redhat.com' } }
    }
    const { handlers } = setupRoutes({ 'team-data/registry.json': registry })
    const res = await callHandler(handlers['POST /jira-components/request'], {
      body: validPayload,
      userEmail: uniqueEmail(),
      userUid: 'uid123'
    })
    expect(res._status).toBe(200)
    expect(res._body.submittedBy).toBe('resolved@redhat.com')
  })
})
