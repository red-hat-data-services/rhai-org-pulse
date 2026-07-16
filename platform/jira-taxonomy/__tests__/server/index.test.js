import { describe, it, expect, vi, beforeEach } from 'vitest'

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
