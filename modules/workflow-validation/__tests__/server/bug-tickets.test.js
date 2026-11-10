import { afterEach, describe, expect, it, vi } from 'vitest'

const { createBugTickets } = require('../../server/bug-tickets')
const row = { suite: 'release_gate', invocationId: 'run-1', rhoaiVersion: '3.6', timestamp: '2026-11-01T00:00:00Z' }
const execution = { telemetry_suite: row.suite, invocation_id: row.invocationId, workflow: 'workflow-a' }
const finding = { run_id: row.invocationId, workflow: 'workflow-a', bug_key: 'RHOAIENG-1' }
const hit = source => ({ _source: source })
const issue = (key, labels = []) => ({ key, fields: { labels } })

/** Exercise the real association and label resolver against explicit service responses. */
function setup({ executions = [execution], findings = [finding], issues = [issue('RHOAIENG-1')] } = {}) {
  const search = vi.fn(async index => ({ hits: { hits: (index === 'workflow-executions' ? executions : findings).map(hit) } }))
  const client = { JIRA_HOST: 'https://redhat.atlassian.net', jiraRequest: vi.fn(async () => ({ issues, isLast: true })) }
  const getJiraClient = vi.fn(() => client)
  return { search, client, getJiraClient, enrich: createBugTickets({ getJiraClient }) }
}

afterEach(() => vi.useRealTimers())

describe('recent-run bug ticket links', () => {
  it('keeps existing and new tickets of every RCA category and excludes only the Jira label', async () => {
    const test = setup({ findings: [
      { ...finding, category: 'PRODUCT_BUG', action: 'FILED', opened: true },
      { ...finding, bug_key: 'RHOAIENG-2', category: 'AUTOMATION_BUG', action: 'EXISTING', opened: false },
      { ...finding, bug_key: 'RHOAIENG-3', category: 'PRODUCT_BUG' },
      { ...finding, bug_key: 'RHOAIENG-1', impacted_workflows: ['workflow-a'] },
      { ...finding, bug_key: 'RHOAIENG-99', run_id: 'other-run' },
    ], issues: [issue('RHOAIENG-1'), issue('RHOAIENG-2', ['other-label']), issue('RHOAIENG-3', ['rca-scope-internal'])] })
    const [result] = await test.enrich([row], test)
    expect(result).toMatchObject({ ...row, bugTickets: { status: 'ready' } })
    expect(new URL(result.bugTickets.url).searchParams.get('jql')).toBe(
      'key IN (RHOAIENG-1, RHOAIENG-2) AND (labels IS EMPTY OR labels NOT IN ("rca-scope-internal"))')
    expect(test.client.jiraRequest).toHaveBeenCalledTimes(1)
    expect(test.client.jiraRequest.mock.calls[0][1].body).toMatchObject({ fields: ['labels'], jql: 'key IN (RHOAIENG-1, RHOAIENG-2, RHOAIENG-3)' })
    expect(JSON.stringify(test.search.mock.calls)).not.toMatch(/category|opened|rhoai_version/)
  })

  it('keeps two suites sharing an invocation separate and honors impacted workflows', async () => {
    const other = { ...row, suite: 'ad_hoc' }
    const test = setup({ executions: [execution, { ...execution, telemetry_suite: other.suite, workflow: 'workflow-b' }], findings: [
      { ...finding, workflow: 'representative-elsewhere', impacted_workflows: ['workflow-a'] },
      { ...finding, workflow: 'workflow-b', bug_key: 'RHOAIENG-2' },
    ], issues: [issue('RHOAIENG-1'), issue('RHOAIENG-2')] })
    const results = await test.enrich([row, other], test)
    expect(new URL(results[0].bugTickets.url).searchParams.get('jql')).toMatch(/^key IN \(RHOAIENG-1\)/)
    expect(new URL(results[1].bugTickets.url).searchParams.get('jql')).toMatch(/^key IN \(RHOAIENG-2\)/)
    expect(test.search.mock.calls[0][1].query.bool.should).toHaveLength(2)
  })

  it('returns empty for an Internal-only run and for a run with no recorded tickets', async () => {
    const internal = setup({ issues: [issue('RHOAIENG-1', ['rca-scope-internal'])] })
    expect((await internal.enrich([row], internal))[0].bugTickets).toEqual({ status: 'empty' })
    const none = setup({ findings: [] })
    expect((await none.enrich([row], none))[0].bugTickets).toEqual({ status: 'empty' })
    expect(none.getJiraClient).not.toHaveBeenCalled()
  })

  it('does not call services for an empty page', async () => {
    const test = setup()
    expect(await test.enrich([], test)).toEqual([])
    expect(test.search).not.toHaveBeenCalled()
  })

  it.each([
    { name: 'an inaccessible ticket', issues: [] },
    { name: 'missing labels', issues: [{ key: 'RHOAIENG-1', fields: {} }] },
  ])('keeps $name unknown instead of reporting no tickets', async ({ issues }) => {
    const test = setup({ issues })
    expect((await test.enrich([row], test))[0].bugTickets).toEqual({ status: 'unavailable' })
  })

  it('preserves metadata and known-empty rows when Jira fails or credentials are absent', async () => {
    const empty = { ...row, invocationId: 'run-2' }
    const test = setup({ executions: [execution, { ...execution, invocation_id: empty.invocationId }] })
    test.client.jiraRequest.mockRejectedValue(new Error('Jira unavailable'))
    const results = await test.enrich([row, empty], test)
    expect(results[0]).toEqual({ ...row, bugTickets: { status: 'unavailable' } })
    expect(results[1].bugTickets).toEqual({ status: 'empty' })
    test.getJiraClient.mockImplementation(() => { throw new Error('Missing credentials') })
    expect((await test.enrich([row], test))[0].bugTickets).toEqual({ status: 'unavailable' })
  })

  it.each([
    { executions: [], findings: [finding] },
    { executions: [{ ...execution, workflow: undefined }], findings: [finding] },
    { executions: [execution], findings: [{ ...finding, workflow: undefined }] },
    { executions: [execution], findings: [{ ...finding, bug_key: 'BAD) OR project = SECRET' }] },
  ])('does not invent associations for missing or invalid data: %j', async (data) => {
    const test = setup(data)
    expect((await test.enrich([row], test))[0].bugTickets).toEqual({ status: 'unavailable' })
    expect(test.client.jiraRequest).not.toHaveBeenCalled()
  })

  it('reads root-cause pages beyond 500 occurrences and deduplicates ticket keys', async () => {
    const test = setup({ issues: [issue('RHOAIENG-1'), issue('RHOAIENG-2')] })
    test.search.mockImplementation(async (index, body) => {
      if (index === 'workflow-executions') return { hits: { hits: [hit(execution)] } }
      if (!body.search_after) return { hits: { hits: Array.from({ length: 500 }, (_, i) => ({ ...hit(finding), sort: [String(i)] })) } }
      expect(body.search_after).toEqual(['499'])
      return { hits: { hits: [hit({ ...finding, bug_key: 'RHOAIENG-2' })] } }
    })
    const [result] = await test.enrich([row], test)
    expect(new URL(result.bugTickets.url).searchParams.get('jql')).toContain('key IN (RHOAIENG-1, RHOAIENG-2)')
  })

  it('follows Jira cursors and requires complete label results', async () => {
    const test = setup({ findings: [finding, { ...finding, bug_key: 'RHOAIENG-2' }] })
    test.client.jiraRequest.mockResolvedValueOnce({ issues: [issue('RHOAIENG-1')], isLast: false, nextPageToken: 'page-2' })
      .mockResolvedValueOnce({ issues: [issue('RHOAIENG-2')], isLast: true })
    expect((await test.enrich([row], test))[0].bugTickets.status).toBe('ready')
    expect(test.client.jiraRequest.mock.calls[1][1].body.nextPageToken).toBe('page-2')
    test.client.jiraRequest.mockResolvedValue({ issues: [issue('RHOAIENG-1')], isLast: false })
    expect((await test.enrich([row], { ...test, refresh: true }))[0].bugTickets.status).toBe('unavailable')
  })

  it('bounds Jira batches and includes every key in the link', async () => {
    const findings = Array.from({ length: 105 }, (_, i) => ({ ...finding, bug_key: `RHOAIENG-${i + 1}` }))
    const test = setup({ findings })
    test.client.jiraRequest.mockImplementation(async (_path, { body }) => ({
      issues: body.jql.match(/RHOAIENG-\d+/g).map(key => issue(key)), isLast: true
    }))
    const [result] = await test.enrich([row], test)
    expect(test.client.jiraRequest).toHaveBeenCalledTimes(2)
    const jql = new URL(result.bugTickets.url).searchParams.get('jql')
    expect(jql.match(/RHOAIENG-\d+/g)).toHaveLength(105)
  })

  it('caches verified labels for one minute and refreshes label changes explicitly', async () => {
    vi.useFakeTimers()
    const test = setup()
    await test.enrich([row], test)
    await test.enrich([row], test)
    expect(test.client.jiraRequest).toHaveBeenCalledTimes(1)
    test.client.jiraRequest.mockResolvedValue({ issues: [issue('RHOAIENG-1', ['rca-scope-internal'])], isLast: true })
    expect((await test.enrich([row], { ...test, refresh: true }))[0].bugTickets.status).toBe('empty')
    await vi.advanceTimersByTimeAsync(60_001)
    await test.enrich([row], test)
    expect(test.client.jiraRequest).toHaveBeenCalledTimes(3)
  })

  it('bounds the wait for an unresponsive Jira service', async () => {
    vi.useFakeTimers()
    const test = setup()
    test.client.jiraRequest.mockImplementation(() => new Promise(() => {}))
    const result = test.enrich([row], test)
    await vi.advanceTimersByTimeAsync(10_001)
    expect((await result)[0].bugTickets.status).toBe('unavailable')
  })

  it('does not treat a partial OpenSearch response as empty', async () => {
    const test = setup()
    test.search.mockResolvedValue({ timed_out: true, hits: { hits: [] } })
    expect((await test.enrich([row], test))[0].bugTickets.status).toBe('unavailable')
  })
})
