import { describe, expect, it } from 'vitest'
import { buildPoHubJqlSections } from '../../../client/plan/utils/po-hub-jql'

const backlog = require('../../../../../fixtures/releases/po-hub/backlog.json')

function queryFor(sections, title) {
  return sections.find(section => section.title === title)?.query
}

describe('PO Hub release JQL', () => {
  it('shows no searches until a release is selected', () => {
    expect(buildPoHubJqlSections(backlog.jql, [], backlog.releases)).toEqual([])
  })

  it('scopes Strategies and Epics to the selected Jira Target Versions with a Fix Version fallback', () => {
    const gaSections = buildPoHubJqlSections(backlog.jql, ['rhoai-3.6.GA'], backlog.releases)
    const strategy = queryFor(gaSections, 'RHAISTRAT Strategies')
    const epic = queryFor(gaSections, 'AIPCC and PACKAGE Epics')
    for (const query of [strategy, epic]) {
      expect(query).toContain('"Target Version" in ("3.6 GA RHOAI RELEASE", "3.6 GA RHAII RELEASE", "3.6 GA RHELAI RELEASE")')
      expect(query).toContain('"Target Version" is EMPTY AND fixVersion in ("3.6 GA RHOAI RELEASE", "3.6 GA RHAII RELEASE", "3.6 GA RHELAI RELEASE")')
      expect(query).not.toContain('3.6 EA2')
      expect(query).not.toContain('3.5 EA2')
      expect(query).toMatch(/AND \(.+\) ORDER BY "cf\[10855\]" ASC, Rank ASC$/)
    }

    const both = queryFor(buildPoHubJqlSections(backlog.jql, ['rhoai-3.6.EA2', 'rhoai-3.6.GA'], backlog.releases), 'RHAISTRAT Strategies')
    expect(both).toContain('3.6 EA2 RHOAI RELEASE')
    expect(both).toContain('3.6 GA RHOAI RELEASE')
  })

  it('uses loaded issue keys for summary-grouped and Other release lanes', () => {
    const releases = [
      { name: 'rhoai-3.6.GA', features: [{ key: 'AIPCC-1' }], initiatives: [{ key: 'AIPCC-2' }] },
      { name: 'Other releases', strategies: [{ key: 'RHAISTRAT-3' }], epics: [{ key: 'AIPCC-4' }] },
    ]
    const gaSections = buildPoHubJqlSections(backlog.jql, ['rhoai-3.6.GA'], releases)
    expect(queryFor(gaSections, 'Features')).toContain('key in (AIPCC-1)')
    expect(queryFor(gaSections, 'Initiatives')).toContain('key in (AIPCC-2)')
    expect(queryFor(gaSections, 'Plan ranking')).toContain('key in (AIPCC-1, AIPCC-2)')

    const otherSections = buildPoHubJqlSections(backlog.jql, ['Other releases'], releases)
    expect(queryFor(otherSections, 'RHAISTRAT Strategies')).toContain('key in (RHAISTRAT-3)')
    expect(queryFor(otherSections, 'AIPCC and PACKAGE Epics')).toContain('key in (AIPCC-4)')

    const unversioned = queryFor(buildPoHubJqlSections(backlog.jql, ['Unversioned / Cross-Release'], releases), 'RHAISTRAT Strategies')
    expect(unversioned).toContain('"Target Version" is EMPTY AND fixVersion is EMPTY')
  })
})
