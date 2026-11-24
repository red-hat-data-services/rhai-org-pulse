import { afterEach, describe, expect, it, vi } from 'vitest'

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

describe('release blocker summary route', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches all matching Jira issues, caches the totals, and surfaces Jira failures', async () => {
    var now = Date.parse('2026-11-24T12:00:00.000Z')
    vi.spyOn(Date, 'now').mockImplementation(() => now)

    var fetchCount = 0
    var failVersionProject = null
    const fetchAllJqlResults = vi.fn(async (_jql, _fields, options) => {
      fetchCount++
      if (fetchCount === 2) throw new Error('Jira unavailable')
      expect(options).toEqual({ maxResults: 100 })
      return [
        { key: 'RHOAIENG-1', fields: { project: { key: 'RHOAIENG' }, fixVersions: [{ name: 'RHOAI Next' }], customfield_10847: { value: 'Proposed' } } },
        { key: 'RHAI-2', fields: { project: { key: 'RHAI' }, fixVersions: [{ name: 'RHAI Next' }], customfield_10847: { id: '16772' } } },
        { key: 'AIPCC-3', fields: { project: { key: 'AIPCC' }, fixVersions: [{ name: 'AIPCC Next' }], customfield_10847: { value: 'Rejected' } } },
        { key: 'RHOAIENG-4', fields: { project: { key: 'RHOAIENG' }, fixVersions: [{ name: 'RHOAI Past' }], customfield_10847: { value: 'Approved' } } },
        { key: 'RHAI-5', fields: { project: { key: 'RHAI' }, fixVersions: [], customfield_10847: { value: 'Proposed' } } }
      ]
    })
    const router = makeRouter()
    const pass = (_req, _res, next) => next()
    const jiraRequest = vi.fn(async path => {
      const project = decodeURIComponent(path).split('/').at(-2)
      if (project === failVersionProject) throw new Error('Version catalog unavailable for ' + project)
      return [
        { name: `${project.replace('ENG', '')} Next`, releaseDate: '2026-12-01', released: false, archived: false },
        { name: `${project.replace('ENG', '')} Past`, releaseDate: '2026-11-23', released: false, archived: false }
      ]
    })

    await registerBlockerRoutes(router, {
      storage: { readFromStorage: async () => null, writeToStorage: async () => {} },
      requireAuth: pass,
      requireScope: () => pass,
      jira: { JIRA_HOST: 'https://jira.example', jiraRequest, fetchAllJqlResults }
    })

    const first = await router.dispatch('GET', '/blockers/summary', {})
    expect(first._status).toBe(200)
    expect(first._body).toMatchObject({ total: 3, proposed: 1, approved: 1, rejected: 1 })
    expect(fetchAllJqlResults).toHaveBeenCalledWith(
      registerBlockerRoutes.buildOrganizationSummaryJql(),
      registerBlockerRoutes.BLOCKER_SUMMARY_FIELDS,
      { maxResults: 100 }
    )
    expect(jiraRequest).toHaveBeenCalledTimes(5)

    const cached = await router.dispatch('GET', '/blockers/summary', {})
    expect(cached._body).toEqual(first._body)
    expect(fetchAllJqlResults).toHaveBeenCalledTimes(1)
    expect(jiraRequest).toHaveBeenCalledTimes(5)

    now += (5 * 60 * 1000) + 1
    const failed = await router.dispatch('GET', '/blockers/summary', {})
    expect(failed._status).toBe(500)
    expect(failed._body.error).toContain('Jira unavailable')

    now += (5 * 60 * 1000) + 1
    failVersionProject = 'RHAI'
    const catalogFailed = await router.dispatch('GET', '/blockers/summary', {})
    expect(catalogFailed._status).toBe(500)
    expect(catalogFailed._body.error).toContain('Version catalog unavailable for RHAI')
  })

  it('shares an in-flight five-project version catalog between summary and Awareness requests', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2030-01-01T12:00:00.000Z'))
    const fetchAllJqlResults = vi.fn(async () => [])
    const jiraRequest = vi.fn(async path => {
      await new Promise(resolve => setTimeout(resolve, 5))
      return [{
        name: decodeURIComponent(path).split('/').at(-2) + ' Next',
        releaseDate: '2030-02-01',
        released: false,
        archived: false
      }]
    })
    const router = makeRouter()
    const pass = (_req, _res, next) => next()

    await registerBlockerRoutes(router, {
      storage: { readFromStorage: async () => null, writeToStorage: async () => {} },
      requireAuth: pass,
      requireScope: () => pass,
      jira: { JIRA_HOST: 'https://jira.example', jiraRequest, fetchAllJqlResults }
    })

    const [summary, awareness] = await Promise.all([
      router.dispatch('GET', '/blockers/summary', {}),
      router.dispatch('GET', '/blockers/awareness', {})
    ])

    expect(summary._status).toBe(200)
    expect(awareness._status).toBe(200)
    expect(fetchAllJqlResults).toHaveBeenCalledTimes(2)
    expect(jiraRequest).toHaveBeenCalledTimes(5)
  })
})
