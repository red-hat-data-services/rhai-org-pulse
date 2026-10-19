import { describe, expect, it } from 'vitest'

const registerBlockerRoutes = require('../../../server/delivery/blockers')

function makeRouter() {
  const handlers = {}
  return {
    get(path, ...fns) { handlers[`GET ${path}`] = fns },
    post(path, ...fns) { handlers[`POST ${path}`] = fns },
    dispatch(method, path, req) {
      const fns = handlers[`${method} ${path}`]
      const res = {
        _status: 200,
        _body: null,
        status(code) { this._status = code; return this },
        json(body) { this._body = body; return this }
      }
      let index = 0
      const next = async () => {
        const fn = fns[index++]
        if (fn) await fn(req || {}, res, next)
      }
      return next().then(() => res)
    }
  }
}

function issue(key, outcome) {
  return {
    key,
    link: `https://jira.example/browse/${key}`,
    summary: key,
    components: ['Serving'],
    fixVersions: ['3.5 GA'],
    releaseBlocker: outcome,
    labels: [],
    regression: 'Unknown',
    couldIdentifyEarlier: 'Unknown'
  }
}

describe('release blocker analysis routes', () => {
  it('returns 404 when no snapshot exists and stores validated bulk data', async () => {
    const store = {}
    const storage = {
      readFromStorage: async key => store[key] || null,
      writeToStorage: async (key, value) => { store[key] = value }
    }
    const router = makeRouter()
    const pass = (_req, _res, next) => next()
    await registerBlockerRoutes(router, {
      storage,
      requireAuth: pass,
      requireScope: () => pass,
      jira: { JIRA_HOST: 'https://jira.example', jiraRequest: async () => ({}), fetchAllJqlResults: async () => [] }
    })

    const missing = await router.dispatch('GET', '/blockers/analysis', {})
    expect(missing._status).toBe(404)

    const uploaded = await router.dispatch('POST', '/blockers/analysis/bulk', {
      body: { generatedAt: '2026-10-18T06:00:00Z', issues: [issue('RHOAIENG-1', 'Approved')] }
    })
    expect(uploaded._status).toBe(200)
    expect(uploaded._body.issueCount).toBe(1)
    expect(store['releases/delivery/blocker-analysis.json'].aggregates.overall.totalAnalyzed).toBe(1)

    const found = await router.dispatch('GET', '/blockers/analysis', {})
    expect(found._status).toBe(200)
    expect(found._body.aggregates.overall.regression.unknown).toBe(1)
  })

  it('rejects malformed analysis payloads without replacing the snapshot', async () => {
    const store = {}
    const storage = {
      readFromStorage: async key => store[key] || null,
      writeToStorage: async (key, value) => { store[key] = value }
    }
    const router = makeRouter()
    const pass = (_req, _res, next) => next()
    await registerBlockerRoutes(router, {
      storage,
      requireAuth: pass,
      requireScope: () => pass,
      jira: { JIRA_HOST: 'https://jira.example', jiraRequest: async () => ({}), fetchAllJqlResults: async () => [] }
    })

    const rejected = await router.dispatch('POST', '/blockers/analysis/bulk', { body: { issues: [{ key: 'bad', releaseBlocker: 'Proposed' }] } })
    expect(rejected._status).toBe(400)
    expect(store['releases/delivery/blocker-analysis.json']).toBeUndefined()
  })
})
