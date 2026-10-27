import { beforeEach, describe, expect, it, vi } from 'vitest'

const registerTechDebtRoutes = require('../../../server/tech-debt/routes')

function makeRouter() {
  const routes = {}
  return {
    get: vi.fn((path, ...handlers) => { routes[path] = handlers }),
    _routes: routes
  }
}

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this }
  }
}

function register(jira) {
  const router = makeRouter()
  registerTechDebtRoutes(router, {
    jira,
    requireAuth: function (req, res, next) { next() },
    requireScope: function () { return function (req, res, next) { next() } }
  })
  return {
    components: router._routes['/components'].at(-1),
    issues: router._routes['/issues'].at(-1)
  }
}

function jiraWithIssues(issues, overrides = {}) {
  return {
    JIRA_HOST: 'https://jira.example.test',
    jiraRequest: vi.fn(async function (path) {
      const params = new URLSearchParams(path.split('?')[1])
      if ((params.get('jql') || '').includes('SFDC_Cases_Counter')) {
        return { issues: [], isLast: true }
      }
      return { issues, isLast: true }
    }),
    ...overrides
  }
}

function rawIssue(key, overrides = {}) {
  const fields = overrides.fields || {}
  return {
    key,
    properties: overrides.properties || {},
    fields: {
      summary: 'Summary for ' + key,
      issuetype: { name: 'Bug' },
      priority: { name: 'Medium' },
      status: { name: 'Open', statusCategory: { name: 'To Do' } },
      components: [{ name: 'Model Serving' }],
      assignee: { accountId: 'person-1', displayName: 'Pat Engineer' },
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-02-01T00:00:00.000Z',
      duedate: null,
      fixVersions: [{ name: '3.0 GA' }],
      ...fields
    }
  }
}

describe('Tech Debt Prioritization routes', function () {
  beforeEach(function () {
    registerTechDebtRoutes._test.resetCache()
    vi.restoreAllMocks()
    vi.spyOn(console, 'error').mockImplementation(function () {})
  })

  it('returns sorted unique RHAI components', async function () {
    const jira = {
      jiraRequest: vi.fn(async function (path) {
        expect(path).toBe('/rest/api/3/project/RHAI/components')
        return [
          { id: '2', name: 'zeta' },
          { id: '1', name: 'Alpha' },
          { id: '3', name: 'Alpha' },
          { id: '4', name: '' }
        ]
      })
    }
    const res = makeResponse()

    await register(jira).components({}, res)

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({
      project: 'RHAI',
      components: [
        { id: '1', name: 'Alpha' },
        { id: '2', name: 'zeta' }
      ]
    })
  })

  it('returns 400 without a selected component and does not query Jira', async function () {
    const jira = { jiraRequest: vi.fn() }
    const res = makeResponse()

    await register(jira).issues({ query: {} }, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain('component')
    expect(jira.jiraRequest).not.toHaveBeenCalled()
  })

  it('queries a component-scoped five-project open Bug and Vulnerability cohort', async function () {
    const jira = jiraWithIssues([])
    const res = makeResponse()

    await register(jira).issues({ query: { component: 'Model Serving' } }, res)

    const path = jira.jiraRequest.mock.calls.map(call => call[0]).find(function (value) {
      return new URLSearchParams(value.split('?')[1]).get('fields') !== 'key'
    })
    const params = new URLSearchParams(path.split('?')[1])
    expect(params.get('jql')).toBe(registerTechDebtRoutes._test.scopedIssueJql(['Model Serving']))
    expect(params.get('jql')).toContain('component in ("Model Serving")')
    expect(params.get('fields')).toContain('customfield_10859')
    expect(params.get('fields')).toContain('customfield_10847')
    expect(params.get('fields')).toContain('reporter')
    expect(params.get('fields')).toContain('labels')
    expect(params.get('properties')).toBe('rh-sla-dt')
    const sfdcPath = jira.jiraRequest.mock.calls.map(call => call[0]).find(function (value) {
      return (new URLSearchParams(value.split('?')[1]).get('jql') || '').includes('SFDC_Cases_Counter')
    })
    expect(new URLSearchParams(sfdcPath.split('?')[1]).get('jql')).toBe(registerTechDebtRoutes._test.scopedSfdcJql(['Model Serving']))
    expect(res.body.projects).toEqual(['RHAI', 'RHAIENG', 'RHOAIENG', 'INFERENG', 'AIPCC'])
    expect(res.body.bugScoring).toEqual({ modelVersion: 'bug-v1', mode: 'active', rankingApplied: true })
    expect(res.body.queueScoring).toEqual({ mode: 'combined', rankingField: 'priorityScore' })
  })

  it('paginates Jira search results with SLA properties', async function () {
    const jira = {
      jiraRequest: vi.fn()
        .mockResolvedValueOnce({ issues: [rawIssue('RHAI-1')], isLast: false, nextPageToken: 'page-2' })
        .mockResolvedValueOnce({ issues: [rawIssue('RHAI-2')], isLast: true })
    }

    const rows = await registerTechDebtRoutes._test.fetchIssuePages(jira)

    expect(rows.map(row => row.key)).toEqual(['RHAI-1', 'RHAI-2'])
    expect(jira.jiraRequest).toHaveBeenCalledTimes(2)
    const secondParams = new URLSearchParams(jira.jiraRequest.mock.calls[1][0].split('?')[1])
    expect(secondParams.get('nextPageToken')).toBe('page-2')
    expect(secondParams.get('properties')).toBe('rh-sla-dt')
  })

  it('quotes selected component names safely in Jira JQL', function () {
    expect(registerTechDebtRoutes._test.componentJqlClause(['Model "Serving"', 'Pipelines\\Core'])).toBe(
      'component in ("Model \\"Serving\\"", "Pipelines\\\\Core")'
    )
  })

  it('paginates the SFDC key lookup used for customer-linked Bugs', async function () {
    const jira = {
      jiraRequest: vi.fn()
        .mockResolvedValueOnce({ issues: [{ key: 'RHAI-1' }], isLast: false, nextPageToken: 'page-2' })
        .mockResolvedValueOnce({ issues: [{ key: 'RHAI-2' }], isLast: true })
    }

    const keys = await registerTechDebtRoutes._test.fetchIssueKeySet(jira, registerTechDebtRoutes._test.SFDC_BUG_JQL)

    expect(Array.from(keys)).toEqual(['RHAI-1', 'RHAI-2'])
    expect(jira.jiraRequest).toHaveBeenCalledTimes(2)
    const secondParams = new URLSearchParams(jira.jiraRequest.mock.calls[1][0].split('?')[1])
    expect(secondParams.get('nextPageToken')).toBe('page-2')
    expect(secondParams.get('fields')).toBe('key')
  })

  it('normalizes, deduplicates, and applies union component matching', async function () {
    const jira = jiraWithIssues([
        rawIssue('RHAI-1', { fields: { components: [{ name: 'Model Serving' }, { name: 'Pipelines' }] } }),
        rawIssue('RHAI-1', { fields: { components: [{ name: 'Pipelines' }] } }),
        rawIssue('RHAI-2', { fields: { components: [{ name: 'Workbench' }] } }),
        rawIssue('RHAI-3', { fields: { components: [{ name: 'Unselected' }] } })
      ], { JIRA_HOST: 'https://jira.example.test/' })
    const res = makeResponse()

    await register(jira).issues({ query: { component: ['Model Serving', 'Workbench'] } }, res)

    expect(res.body.counts.total).toBe(2)
    expect(res.body.selectedComponents).toEqual(['Model Serving', 'Workbench'])
    expect(res.body.backlog.map(issue => issue.key)).toEqual(['RHAI-1', 'RHAI-2'])
    expect(res.body.backlog[0]).toMatchObject({
      link: 'https://jira.example.test/browse/RHAI-1',
      issueType: 'Bug',
      jiraPriority: 'Medium',
      priorityScore: 13,
      scoreStatus: 'scored',
      scoreModel: 'bug-v1',
      primaryBugType: { code: 'component-team', label: 'Component-team/unclassified Bug' },
      assignee: { name: 'Pat Engineer' },
      fixVersions: ['3.0 GA']
    })
  })

  it('enriches customer-linked Bugs from the SFDC key lookup and maps reporter and Release Blocker', async function () {
    const rows = [rawIssue('RHAI-1', {
      fields: {
        reporter: { accountId: 'bot-1', displayName: 'DevTestOps Jira Bot' },
        customfield_10847: { id: '16772' }
      }
    })]
    const jira = {
      JIRA_HOST: 'https://jira.example.test',
      jiraRequest: vi.fn(async function (path) {
        const params = new URLSearchParams(path.split('?')[1])
        if ((params.get('jql') || '').includes('SFDC_Cases_Counter')) {
          return { issues: [{ key: 'RHAI-1' }], isLast: true }
        }
        return { issues: rows, isLast: true }
      })
    }
    const res = makeResponse()

    await register(jira).issues({ query: { component: 'Model Serving' } }, res)

    expect(res.body.backlog[0]).toMatchObject({
      hasSfdcCases: true,
      reporter: { id: 'bot-1', name: 'DevTestOps Jira Bot' },
      releaseBlockerStatus: 'Approved',
      scoreStatus: 'scored',
      primaryBugType: { code: 'customer-linked' },
      priorityScore: 70
    })
  })

  it('filters the component cohort by Bug or Vulnerability', async function () {
    const jira = jiraWithIssues([
        rawIssue('RHAI-1', { fields: { issuetype: { name: 'Bug' } } }),
        rawIssue('RHAI-2', { fields: { issuetype: { name: 'Vulnerability' } } })
      ])
    const res = makeResponse()

    await register(jira).issues({ query: { component: 'Model Serving', issueType: 'Vulnerability' } }, res)

    expect(res.statusCode).toBe(200)
    expect(res.body.selectedIssueType).toBe('Vulnerability')
    expect(res.body.counts).toEqual({ total: 1, inFlight: 0, backlog: 1, bugs: 0, vulnerabilities: 1 })
    expect(res.body.backlog.map(issue => issue.key)).toEqual(['RHAI-2'])
  })

  it('rejects unsupported issue type filters', async function () {
    const jira = { jiraRequest: vi.fn() }
    const res = makeResponse()

    await register(jira).issues({ query: { component: 'Model Serving', issueType: 'Epic' } }, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain('Bug or Vulnerability')
    expect(jira.jiraRequest).not.toHaveBeenCalled()
  })

  it('rejects unsupported triage filters before querying Jira', async function () {
    const jira = { jiraRequest: vi.fn() }
    const res = makeResponse()

    await register(jira).issues({ query: { component: 'Model Serving', triage: 'urgent' } }, res)

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toContain('all or exceptions')
    expect(jira.jiraRequest).not.toHaveBeenCalled()
  })

  it('classifies only exact In Progress and Review statuses as in flight', async function () {
    const jira = jiraWithIssues([
        rawIssue('RHAI-1', { fields: { status: { name: 'In Progress', statusCategory: { name: 'In Progress' } } } }),
        rawIssue('RHAI-2', { fields: { status: { name: 'Review', statusCategory: { name: 'In Progress' } } } }),
        rawIssue('RHAI-3', { fields: { status: { name: 'Code Review', statusCategory: { name: 'In Progress' } } } }),
        rawIssue('RHAI-4', { fields: { status: { name: 'Open', statusCategory: { name: 'To Do' } } } })
      ])
    const res = makeResponse()

    await register(jira).issues({ query: { component: 'Model Serving' } }, res)

    expect(res.body.inFlight.map(issue => issue.key)).toEqual(['RHAI-1', 'RHAI-2'])
    expect(res.body.backlog.map(issue => issue.key)).toEqual(['RHAI-3', 'RHAI-4'])
    expect(res.body.counts).toMatchObject({ total: 4, inFlight: 2, backlog: 2 })
  })

  it('orders Bugs and Vulnerabilities together by effective score with global ranks', function () {
    const ordered = registerTechDebtRoutes._test.orderPaneIssues([
      {
        key: 'RHAI-BUG-LOW',
        issueType: 'Bug',
        priorityScore: 30,
        slaDate: null,
        dueDate: null,
        createdAt: '2026-01-01',
        scoreBreakdown: {}
      },
      {
        key: 'RHAI-CVE-TOP',
        issueType: 'Vulnerability',
        priorityScore: 95,
        slaDate: '2026-10-01',
        dueDate: '2026-10-05',
        createdAt: '2026-02-01',
        scoreBreakdown: { cvss: { value: 9.8 } }
      },
      {
        key: 'RHAI-BUG-HIGH',
        issueType: 'Bug',
        priorityScore: 90,
        slaDate: null,
        dueDate: '2026-10-02',
        createdAt: '2026-03-01',
        scoreBreakdown: {}
      }
    ], true)

    expect(ordered.map(issue => issue.key)).toEqual(['RHAI-CVE-TOP', 'RHAI-BUG-HIGH', 'RHAI-BUG-LOW'])
    expect(ordered.map(issue => issue.rank)).toEqual([1, 2, 3])
    expect(ordered.every(issue => issue.rankGroup === 'combined')).toBe(true)
  })

  it('reports pane and issue-type counts', async function () {
    const jira = jiraWithIssues([
        rawIssue('RHAI-1'),
        rawIssue('RHAI-2', { fields: { issuetype: { name: 'Vulnerability' }, status: { name: 'Review', statusCategory: { name: 'In Progress' } } } })
      ])
    const res = makeResponse()

    await register(jira).issues({ query: { component: 'Model Serving' } }, res)

    expect(res.body.counts).toEqual({ total: 2, inFlight: 1, backlog: 1, bugs: 1, vulnerabilities: 1 })
  })

  it('scores and ranks Bugs and Vulnerabilities together while keeping exceptions vulnerability-only', function () {
    const normalizeIssue = registerTechDebtRoutes._test.normalizeIssue
    const cohort = {
      fetchedAt: '2026-10-26T12:00:00.000Z',
      cacheStatus: 'hit',
      warning: null,
      issues: [
        normalizeIssue(rawIssue('RHAI-CVE-LOW', {
          properties: { 'rh-sla-dt': { value: '2027-02-01T00:00:00.000Z' } },
          fields: {
            issuetype: { name: 'Vulnerability' },
            priority: { name: 'Low' },
            duedate: '2027-02-01',
            labels: ['rhai-cve-review-possibly-resolved'],
            customfield_10859: '2.0 CVSS:3.1/test'
          }
        }), 'https://jira.example.test'),
        normalizeIssue(rawIssue('RHAI-CVE-HIGH', {
          properties: { 'rh-sla-dt': { value: '2026-10-25T00:00:00.000Z' } },
          fields: {
            issuetype: { name: 'Vulnerability' },
            priority: { name: 'Low' },
            duedate: '2026-10-25',
            labels: ['rhai-cve-review-needs-action'],
            customfield_10859: '9.8 CVSS:3.1/test'
          }
        }), 'https://jira.example.test'),
        normalizeIssue(rawIssue('RHAI-BUG-LOW', { fields: { priority: { name: 'Low' } } }), 'https://jira.example.test'),
        normalizeIssue(rawIssue('RHAI-BUG-HIGH', { fields: { priority: { name: 'Blocker' } } }), 'https://jira.example.test')
      ]
    }

    const all = registerTechDebtRoutes._test.buildCockpitResponse(
      cohort,
      ['Model Serving'],
      null,
      'all',
      new Date('2026-10-26T18:00:00.000Z')
    )

    expect(all.backlog.map(issue => issue.key)).toEqual([
      'RHAI-CVE-HIGH',
      'RHAI-BUG-HIGH',
      'RHAI-CVE-LOW',
      'RHAI-BUG-LOW'
    ])
    expect(all.backlog.map(issue => issue.rank)).toEqual([1, 2, 3, 4])
    expect(all.backlog.every(issue => issue.rankGroup === 'combined')).toBe(true)
    expect(all.backlog[0]).toMatchObject({ scoreStatus: 'scored', rawScore: 95, priorityScore: 95 })
    expect(all.backlog[1]).toMatchObject({ scoreStatus: 'scored', priorityScore: 25, scoreModel: 'bug-v1' })
    expect(all.bugScoring).toEqual({ modelVersion: 'bug-v1', mode: 'active', rankingApplied: true })
    expect(all.queueScoring).toEqual({ mode: 'combined', rankingField: 'priorityScore' })

    const exceptions = registerTechDebtRoutes._test.buildCockpitResponse(
      cohort,
      ['Model Serving'],
      null,
      'exceptions',
      new Date('2026-10-26T18:00:00.000Z')
    )
    expect(exceptions.selectedTriage).toBe('exceptions')
    expect(exceptions.backlog.map(issue => issue.key)).toEqual(['RHAI-CVE-HIGH', 'RHAI-CVE-LOW'])
    expect(exceptions.counts).toMatchObject({ total: 2, bugs: 0, vulnerabilities: 2 })
  })

  it('reuses the five-minute cohort cache and supports forced refresh', async function () {
    const jira = jiraWithIssues([rawIssue('RHAI-1')])
    const handler = register(jira).issues

    const first = makeResponse()
    await handler({ query: { component: 'Model Serving' } }, first)
    const cached = makeResponse()
    await handler({ query: { component: 'Model Serving' } }, cached)
    const refreshed = makeResponse()
    await handler({ query: { component: 'Model Serving', refresh: 'true' } }, refreshed)

    expect(jira.jiraRequest).toHaveBeenCalledTimes(4)
    expect(first.body.cacheStatus).toBe('refreshed')
    expect(cached.body.cacheStatus).toBe('hit')
    expect(refreshed.body.cacheStatus).toBe('refreshed')
  })

  it('keeps separate reusable caches for recently selected component sets', async function () {
    const jira = jiraWithIssues([rawIssue('RHAI-1')])
    const handler = register(jira).issues

    const modelServing = makeResponse()
    await handler({ query: { component: 'Model Serving' } }, modelServing)
    const workbench = makeResponse()
    await handler({ query: { component: 'Workbench' } }, workbench)
    const modelServingAgain = makeResponse()
    await handler({ query: { component: 'Model Serving' } }, modelServingAgain)

    expect(jira.jiraRequest).toHaveBeenCalledTimes(4)
    expect(modelServing.body.cacheStatus).toBe('refreshed')
    expect(workbench.body.cacheStatus).toBe('refreshed')
    expect(modelServingAgain.body.cacheStatus).toBe('hit')
  })

  it('serves stale cached data with a warning when Jira refresh fails', async function () {
    let requestCount = 0
    const jira = {
      jiraRequest: vi.fn(async function (path) {
        requestCount++
        if (requestCount > 2) throw new Error('Jira unavailable')
        const params = new URLSearchParams(path.split('?')[1])
        return (params.get('jql') || '').includes('SFDC_Cases_Counter')
          ? { issues: [], isLast: true }
          : { issues: [rawIssue('RHAI-1')], isLast: true }
      })
    }
    const handler = register(jira).issues
    await handler({ query: { component: 'Model Serving' } }, makeResponse())
    const stale = makeResponse()

    await handler({ query: { component: 'Model Serving', refresh: 'true' } }, stale)

    expect(stale.statusCode).toBe(200)
    expect(stale.body.cacheStatus).toBe('stale')
    expect(stale.body.warning).toContain('cached')
    expect(stale.body.counts.total).toBe(1)
  })

  it('returns 503 when Jira fails and no cache exists', async function () {
    const jira = { jiraRequest: vi.fn().mockRejectedValue(new Error('network failure')) }
    const res = makeResponse()

    await register(jira).issues({ query: { component: 'Model Serving' } }, res)

    expect(res.statusCode).toBe(503)
    expect(res.body.error).toContain('temporarily unavailable')
  })

  it('does not silently under-score customer impact when the SFDC lookup fails', async function () {
    const jira = {
      jiraRequest: vi.fn(async function (path) {
        const params = new URLSearchParams(path.split('?')[1])
        if ((params.get('jql') || '').includes('SFDC_Cases_Counter')) throw new Error('SFDC unavailable')
        return { issues: [rawIssue('RHAI-1')], isLast: true }
      })
    }
    const res = makeResponse()

    await register(jira).issues({ query: { component: 'Model Serving' } }, res)

    expect(res.statusCode).toBe(503)
    expect(res.body.error).toContain('temporarily unavailable')
  })

  it('returns service unavailable without a configured Jira client', async function () {
    const routes = register(null)
    const componentRes = makeResponse()
    const issueRes = makeResponse()

    await routes.components({}, componentRes)
    await routes.issues({ query: { component: 'Model Serving' } }, issueRes)

    expect(componentRes.statusCode).toBe(503)
    expect(issueRes.statusCode).toBe(503)
  })
})
