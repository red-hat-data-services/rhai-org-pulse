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

describe('release blocker Awareness route', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('splits the organization-wide cohort into Awareness and Proposed readiness rows, caches it, and surfaces Jira failures', async () => {
    var now = Date.parse('2026-11-24T12:00:00.000Z')
    vi.spyOn(Date, 'now').mockImplementation(() => now)

    var fetchCount = 0
    var failVersionProject = null
    const fetchAllJqlResults = vi.fn(async (_jql, _fields, options) => {
      fetchCount++
      if (fetchCount === 2) throw new Error('Jira unavailable')
      expect(options).toEqual({ expand: 'changelog', maxResults: 100 })
      return [
        {
          key: 'RHOAIENG-100',
          fields: {
            project: { key: 'RHOAIENG' },
            fixVersions: [{ name: 'RHOAI Next' }],
            summary: 'Approved closed blocker',
            status: { name: 'Closed' },
            customfield_10847: { id: '16772' },
            created: '2026-11-01T00:00:00.000Z',
            updated: '2026-11-24T00:00:00.000Z'
          }
        },
        {
          key: 'AIPCC-200',
          fields: {
            project: { key: 'AIPCC' },
            fixVersions: [{ name: 'AIPCC Next' }],
            summary: 'Rejected resolved blocker',
            status: { name: 'Resolved' },
            customfield_10847: { value: 'Rejected' },
            created: '2026-11-02T00:00:00.000Z',
            updated: '2026-11-23T00:00:00.000Z'
          }
        },
        {
          id: '300',
          key: 'RHAI-300',
          fields: {
            project: { key: 'RHAI' },
            summary: 'Proposed closed blocker',
            status: { name: 'Closed' },
            customfield_10847: { id: '16773' },
            fixVersions: [{ name: 'RHAI Next' }],
            created: '2026-11-03T00:00:00.000Z',
            updated: '2026-11-24T01:00:00.000Z'
          },
          changelog: {
            histories: [{
              created: '2026-11-24T01:00:00.000Z',
              items: [{ field: 'Release Blocker', toString: 'Proposed' }]
            }]
          }
        },
        {
          id: '301',
          key: 'INFERENG-301',
          fields: {
            project: { key: 'INFERENG' },
            fixVersions: [{ name: 'INFER Next' }],
            summary: 'Proposed blocker with unavailable PR evidence',
            status: { name: 'Resolved' },
            customfield_10847: { value: 'Proposed' },
            created: '2026-11-02T00:00:00.000Z',
            updated: '2026-11-23T01:00:00.000Z'
          }
        },
        {
          id: '302',
          key: 'RHOAIENG-302',
          fields: {
            project: { key: 'RHOAIENG' },
            fixVersions: [{ name: 'RHOAI Past' }],
            summary: 'Historical blocker excluded before readiness enrichment',
            status: { name: 'Closed' },
            customfield_10847: { value: 'Proposed' },
            created: '2026-10-01T00:00:00.000Z',
            updated: '2026-10-02T00:00:00.000Z'
          }
        }
      ]
    })
    const router = makeRouter()
    const pass = (_req, _res, next) => next()
    const jiraRequest = vi.fn(async path => {
      if (path.includes('/project/')) {
        const project = decodeURIComponent(path).split('/').at(-2)
        if (project === failVersionProject) throw new Error('Version catalog unavailable for ' + project)
        return [
          { name: `${project.replace('ENG', '')} Next`, releaseDate: '2026-12-01', released: false, archived: false },
          { name: `${project.replace('ENG', '')} Past`, releaseDate: '2026-11-23', released: false, archived: false }
        ]
      }
      if (path.includes('issueId=301')) throw new Error('Dev status unavailable')
      return {
        detail: [{
          pullRequests: [{
            name: 'Fix blocker',
            repositoryName: 'red-hat-data-services/example',
            status: 'OPEN',
            url: 'https://github.com/red-hat-data-services/example/pull/1'
          }]
        }]
      }
    })

    await registerBlockerRoutes(router, {
      storage: { readFromStorage: async () => null, writeToStorage: async () => {} },
      requireAuth: pass,
      requireScope: () => pass,
      jira: { JIRA_HOST: 'https://jira.example', jiraRequest, fetchAllJqlResults }
    })

    const first = await router.dispatch('GET', '/blockers/awareness', {})
    expect(first._status).toBe(200)
    expect(first._body.total).toBe(2)
    expect(first._body.issues.map(issue => [issue.key, issue.status, issue.releaseBlockerStatus])).toEqual([
      ['RHOAIENG-100', 'Closed', 'Approved'],
      ['AIPCC-200', 'Resolved', 'Rejected']
    ])
    expect(first._body.proposedTotal).toBe(2)
    expect(first._body.proposedIssues).toHaveLength(2)
    expect(first._body.proposedIssues[0]).toMatchObject({
      key: 'RHAI-300',
      status: 'Closed',
      releaseBlockerStatus: 'Proposed',
      latestProposedDate: '2026-11-24T01:00:00.000Z',
      triageReadiness: {
        ready: false,
        criteria: {
          fixVersion: true,
          linkedPullRequest: true,
          assessmentCompleted: false,
          pmAcknowledgement: true
        }
      }
    })
    expect(first._body.proposedIssues[1]).toMatchObject({
      key: 'INFERENG-301',
      status: 'Resolved',
      triageReadiness: { criteria: { linkedPullRequest: false } }
    })
    expect(jiraRequest).toHaveBeenCalledTimes(7)
    expect(fetchAllJqlResults).toHaveBeenCalledWith(
      registerBlockerRoutes.buildOrganizationAwarenessJql(),
      registerBlockerRoutes.BLOCKER_FIELDS,
      { expand: 'changelog', maxResults: 100 }
    )

    const cached = await router.dispatch('GET', '/blockers/awareness', {})
    expect(cached._body).toEqual(first._body)
    expect(fetchAllJqlResults).toHaveBeenCalledTimes(1)
    expect(jiraRequest).toHaveBeenCalledTimes(7)

    now += (5 * 60 * 1000) + 1
    const failed = await router.dispatch('GET', '/blockers/awareness', {})
    expect(failed._status).toBe(500)
    expect(failed._body.error).toContain('Jira unavailable')

    now += (5 * 60 * 1000) + 1
    failVersionProject = 'AIPCC'
    const catalogFailed = await router.dispatch('GET', '/blockers/awareness', {})
    expect(catalogFailed._status).toBe(500)
    expect(catalogFailed._body.error).toContain('Version catalog unavailable for AIPCC')
  })
})
