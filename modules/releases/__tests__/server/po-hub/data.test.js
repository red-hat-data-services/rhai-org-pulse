import { describe, expect, it, vi } from 'vitest'

const { createPoHubService, STRATEGY_JQL, EPIC_JQL, REVIEW_READY_PACKAGE_JQL } = require('../../../server/po-hub/data')

function issue(key, fields) { return { key, fields } }
function version(name) { return { name } }

function fakeJira() {
  const fetchAllJqlResults = vi.fn(async jql => {
    if (jql === 'project = "AIPCC" AND component = "AIPCC Ecosystems" AND issuetype = Feature AND status != Closed') return [
      issue('AIPCC-10', { summary: '3.6 EA1 feature', status: { name: 'New' } })
    ]
    if (jql === 'project = "AIPCC" AND component = "AIPCC Ecosystems" AND issuetype = Initiative AND status != Closed') return [
      issue('AIPCC-11', { summary: '3.6 EA1 initiative', status: { name: 'New' } })
    ]
    if (jql === STRATEGY_JQL) return [
      issue('RHAISTRAT-1', { summary: 'EA2 strategy', status: { name: 'In Progress' }, customfield_10855: [version('3.6 EA2 RHOAI RELEASE')], fixVersions: [] }),
      issue('RHAISTRAT-2', { summary: 'GA strategy', status: { name: 'In Progress' }, customfield_10855: [], fixVersions: [version('3.6 GA RHOAI RELEASE')] }),
      issue('RHAISTRAT-3', { summary: 'Old EA1 strategy', status: { name: 'In Progress' }, customfield_10855: [version('3.6 EA1 RHOAI RELEASE')], fixVersions: [version('3.6 GA RHOAI RELEASE')] }),
      issue('RHAISTRAT-4', { summary: 'No version strategy', status: { name: 'New' }, customfield_10855: [], fixVersions: [] }),
      issue('RHAISTRAT-5', { summary: 'Future strategy', status: { name: 'New' }, customfield_10855: [version('3.7 EA1 RHOAI RELEASE')], fixVersions: [] }),
      issue('RHAISTRAT-6', { summary: 'Cross-release strategy', status: { name: 'New' }, customfield_10855: [version('3.6 EA1 RHOAI RELEASE'), version('3.6 EA2 RHOAI RELEASE')], fixVersions: [] })
    ]
    if (jql === EPIC_JQL) return [
      issue('AIPCC-20', {
        summary: 'Example package update request', project: { key: 'AIPCC' }, status: { name: 'Review' },
        labels: ['package'], customfield_10855: [version('3.6 EA2 RHOAI RELEASE')], fixVersions: []
      }),
      issue('AIPCC-22', { summary: 'EA1 Epic', status: { name: 'New' }, customfield_10855: [version('3.6 EA1 RHOAI RELEASE')], fixVersions: [] }),
      issue('AIPCC-23', { summary: 'Future Epic', status: { name: 'New' }, customfield_10855: [version('3.7 GA RHOAI RELEASE')], fixVersions: [] }),
      issue('AIPCC-24', { summary: 'No version Epic', status: { name: 'New' }, customfield_10855: [], fixVersions: [] })
    ]
    if (jql === REVIEW_READY_PACKAGE_JQL) return [
      issue('AIPCC-20', { summary: 'Example package update request', status: { name: 'Review' }, labels: ['package'], customfield_10855: [version('3.6 EA2 RHOAI RELEASE')] }),
      issue('AIPCC-21', { summary: 'Still open package request', status: { name: 'Review' }, labels: ['package'], customfield_10855: [version('3.6 EA2 RHOAI RELEASE')] })
    ]
    if (jql.startsWith('parent IN (AIPCC-20, AIPCC-21)')) return [
      issue('AIPCC-201', { parent: { key: 'AIPCC-20' }, summary: 'Build', status: { name: 'Closed' }, issuetype: { name: 'Story' } }),
      issue('AIPCC-211', { parent: { key: 'AIPCC-21' }, summary: 'Build', status: { name: 'In Progress' }, issuetype: { name: 'Story' } })
    ]
    return []
  })
  return { fetchAllJqlResults }
}

describe('PO Hub Jira data', () => {
  it('places target versions before fix-version fallback and qualifies only closed-child packages', async () => {
    const jira = fakeJira()
    const service = createPoHubService(jira)
    const data = await service.fetchBacklogData()
    const ea2 = data.releases.find(release => release.name === 'rhoai-3.6.EA2')
    const ga = data.releases.find(release => release.name === 'rhoai-3.6.GA')
    const other = data.releases.find(release => release.name === 'Other releases')
    const unversioned = data.releases.find(release => release.name === 'Unversioned / Cross-Release')

    expect(data.releases.map(release => release.name)).toEqual([
      'rhoai-3.5.EA2', 'rhoai-3.6.EA2', 'rhoai-3.6.GA', 'Other releases', 'Unversioned / Cross-Release'
    ])
    expect(ea2.strategies.map(item => item.key)).toEqual(['RHAISTRAT-1', 'RHAISTRAT-6'])
    expect(ga.strategies.map(item => item.key)).toEqual(['RHAISTRAT-2'])
    expect(other.strategies.map(item => item.key)).toEqual(['RHAISTRAT-3', 'RHAISTRAT-5'])
    expect(other.features.map(item => item.key)).toEqual(['AIPCC-10'])
    expect(other.initiatives.map(item => item.key)).toEqual(['AIPCC-11'])
    expect(other.epics.map(item => item.key)).toEqual(['AIPCC-22', 'AIPCC-23'])
    expect(unversioned.strategies.map(item => item.key)).toEqual(['RHAISTRAT-4'])
    expect(unversioned.epics.map(item => item.key)).toEqual(['AIPCC-24'])
    expect(ea2.epics.map(item => item.key)).toEqual(['AIPCC-20'])
    expect(ea2.reviewReadyPackages.map(item => item.key)).toEqual(['AIPCC-20'])
    expect(ea2.reviewReadyPackages[0].progress).toEqual({ total: 1, closed: 1 })
    expect(data.jql).toEqual({ strategies: STRATEGY_JQL, epics: EPIC_JQL, reviewReadyPackages: REVIEW_READY_PACKAGE_JQL })
    expect(jira.fetchAllJqlResults.mock.calls.filter(([jql]) => jql.startsWith('parent IN (')).length).toBe(3)

    const initialCalls = jira.fetchAllJqlResults.mock.calls.length
    expect(await service.fetchBacklogData()).toBe(data)
    expect(jira.fetchAllJqlResults).toHaveBeenCalledTimes(initialCalls)
    await service.fetchBacklogData({ force: true })
    expect(jira.fetchAllJqlResults.mock.calls.length).toBeGreaterThan(initialCalls)
  })
})
