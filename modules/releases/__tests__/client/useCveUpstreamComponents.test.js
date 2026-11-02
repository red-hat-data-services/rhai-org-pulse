import { ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { BASE_JQL } from '../../client/reports/composables/useCveAggregation.js'
import { useCveUpstreamComponents } from '../../client/reports/composables/useCveUpstreamComponents.js'

const JIRA_SEARCH_BASE = 'https://jira.example/issues/?jql='

function issue(key, labels, upstreamComponent, overrides = {}) {
  return {
    key,
    status: 'New',
    labels,
    upstreamComponent,
    versions: ['rhoai-2.17'],
    ...overrides
  }
}

function report(records, selectedEcosystem = '') {
  const data = ref({
    upstreamComponentDataVersion: 1,
    jiraSearchBase: JIRA_SEARCH_BASE,
    openIssueRecords: records
  })
  const selected = ref(selectedEcosystem)
  return { model: useCveUpstreamComponents(data, selected), selected, data }
}

describe('useCveUpstreamComponents', () => {
  it('groups case-insensitive normalized names and infers known ecosystems for unknown tickets', () => {
    const { model, selected } = report([
      issue('RHAI-PILLOW-KNOWN', ['ecosystem:pypi'], 'Pillow'),
      issue('RHAI-PILLOW-UNKNOWN', ['ecosystem:Unknown'], ' pillow '),
      issue('RHAI-OTHER', ['ecosystem:rpm'], 'Other'),
      issue('RHAI-UNKNOWN-ONLY', ['ecosystem:Unknown'], 'unknown-only'),
      issue('RHAI-MISSING', ['ecosystem:pypi'], null),
      issue('RHAI-BLANK', ['ecosystem:golang'], '   '),
      issue('RHAI-PREFIX-BLANK', ['ecosystem:golang'], 'gOlAnG;   ')
    ])

    expect(model.metadataReady.value).toBe(true)
    expect(model.totalOpen.value).toBe(4)
    expect(model.ecosystems.value).toEqual(['Unknown', 'pypi', 'rpm'])
    expect(model.ecosystemBreakdown.value).toEqual([
      { ecosystem: 'pypi', count: 2, pct: 50 },
      { ecosystem: 'Unknown', count: 1, pct: 25 },
      { ecosystem: 'rpm', count: 1, pct: 25 }
    ])
    expect(model.componentRows.value).toEqual([
      { component: 'pillow', ecosystems: ['pypi'], count: 2, jiraUrl: expect.any(String) },
      { component: 'other', ecosystems: ['rpm'], count: 1, jiraUrl: expect.any(String) },
      { component: 'unknown-only', ecosystems: ['Unknown'], count: 1, jiraUrl: expect.any(String) }
    ])

    selected.value = 'pypi'
    expect(model.filteredRows.value).toEqual([model.componentRows.value[0]])
    expect(model.filteredRows.value[0].count).toBe(2)
    expect(model.ecosystemBreakdown.value[0].count).toBe(2)
    selected.value = ''
    expect(model.filteredRows.value).toEqual(model.componentRows.value)
  })

  it('gates legacy snapshots but treats a refreshed empty snapshot as ready', () => {
    const legacyPayload = {
      openIssueRecords: [issue('RHAI-OLD', [], 'old-package')]
    }
    const legacy = useCveUpstreamComponents(ref(legacyPayload), ref(''))

    expect(legacy.metadataReady.value).toBe(false)
    expect(legacy.totalOpen.value).toBe(0)
    expect(legacy.ecosystemBreakdown.value).toEqual([])
    expect(legacy.componentRows.value).toEqual([])
    for (const version of [0, 2]) {
      const unsupported = useCveUpstreamComponents(ref({
        ...legacyPayload,
        upstreamComponentDataVersion: version
      }), ref(''))
      expect(unsupported.metadataReady.value).toBe(false)
      expect(unsupported.componentRows.value).toEqual([])
    }

    const empty = useCveUpstreamComponents(ref({
      upstreamComponentDataVersion: 1,
      jiraSearchBase: JIRA_SEARCH_BASE,
      openIssueRecords: []
    }), ref(''))

    expect(empty.metadataReady.value).toBe(true)
    expect(empty.totalOpen.value).toBe(0)
    expect(empty.ecosystems.value).toEqual([])
    expect(empty.ecosystemBreakdown.value).toEqual([])
    expect(empty.componentRows.value).toEqual([])
    expect(empty.multipleEcosystemCount.value).toBe(0)
  })

  it('uses the current Jira host when a schema-v1 payload omits its search base', () => {
    const model = useCveUpstreamComponents(ref({
      upstreamComponentDataVersion: 1,
      openIssueRecords: [issue('RHAI-FALLBACK', ['ecosystem:pypi'], 'fickling')]
    }), ref(''))

    expect(model.componentRows.value[0].jiraUrl).toMatch(
      /^https:\/\/redhat\.atlassian\.net\/issues\/\?jql=/
    )
  })

  it('counts unique tickets once per normalized component and derives multi-ecosystem slices by group', () => {
    const { model, selected } = report([
      issue('RHAI-SHARED-PYPI', ['ecosystem:pypi'], 'shared', { versions: ['rhoai-2.17'] }),
      issue('RHAI-SHARED-PYPI', ['ecosystem:pypi'], 'SHARED', { versions: ['rhoai-2.17'] }),
      issue('RHAI-SHARED-RPM', ['ecosystem:rpm'], ' SHARED ', { versions: ['rhoai-3.0'] }),
      issue('RHAI-SHARED-UNKNOWN', ['ecosystem:uNkNoWn'], 'Shared', { versions: ['rhoai-3.1'] }),
      issue('RHAI-PYPI', [' ecosystem:pypi ', 'ecosystem:pypi'], 'pypi-only'),
      issue('RHAI-UNKNOWN-ONLY', ['ecosystem:unknown'], 'unknown-only'),
      issue('RHAI-MISSING', ['ecosystem:golang'], null),
      issue('RHAI-BLANK', ['ecosystem:golang'], '   '),
      issue('RHAI-CLOSED', ['ecosystem:ruby'], 'closed-package', { status: 'cLoSeD' }),
      issue('RHAI-RESOLVED', ['ecosystem:ruby'], 'resolved-package', { status: 'RESOLVED' })
    ])

    expect(model.totalOpen.value).toBe(5)
    expect(model.ecosystemBreakdown.value).toEqual([
      { ecosystem: 'Multiple ecosystems', count: 3, pct: 60 },
      { ecosystem: 'Unknown', count: 1, pct: 20 },
      { ecosystem: 'pypi', count: 1, pct: 20 }
    ])
    expect(model.multipleEcosystemCount.value).toBe(3)
    expect(model.ecosystems.value).toEqual(['Unknown', 'pypi', 'rpm'])
    expect(model.ecosystems.value).not.toContain('Multiple ecosystems')
    expect(model.componentRows.value).toEqual([
      { component: 'shared', ecosystems: ['pypi', 'rpm'], count: 3, jiraUrl: expect.any(String) },
      { component: 'pypi-only', ecosystems: ['pypi'], count: 1, jiraUrl: expect.any(String) },
      { component: 'unknown-only', ecosystems: ['Unknown'], count: 1, jiraUrl: expect.any(String) }
    ])

    selected.value = 'rpm'
    expect(model.filteredRows.value).toEqual([model.componentRows.value[0]])
    expect(model.filteredRows.value[0].count).toBe(3)
    selected.value = 'Unknown'
    expect(model.filteredRows.value.map(row => row.component)).toEqual(['unknown-only'])
    expect(model.ecosystemBreakdown.value).toHaveLength(3)
  })

  it('strips only a leading golang prefix and displays one lowercase row per casefolded name', () => {
    const { model } = report([
      issue('RHAI-PKG', ['ecosystem:pypi'], ' pkg '),
      issue('RHAI-PKG-EXTRA', ['ecosystem:pypi'], 'pkg-extra'),
      issue('RHAI-PATH-V2', ['ecosystem:pypi'], 'path-v2'),
      issue('RHAI-GO-LOWER', ['ecosystem:golang'], ' GoLaNg; Example.Org/Lib/V2 '),
      issue('RHAI-GO-UPPER', ['ecosystem:golang'], 'golang; EXAMPLE.ORG/LIB/V2'),
      issue('RHAI-FICKLING-UPPER', ['ecosystem:pypi'], 'Fickling'),
      issue('RHAI-FICKLING-LOWER', ['ecosystem:pypi'], ' fickling '),
      issue('RHAI-PREFIX-ONLY', ['ecosystem:golang'], 'GOLANG;   ')
    ])

    expect(model.componentRows.value).toEqual([
      { component: 'example.org/lib/v2', ecosystems: ['golang'], count: 2, jiraUrl: expect.any(String) },
      { component: 'fickling', ecosystems: ['pypi'], count: 2, jiraUrl: expect.any(String) },
      { component: 'path-v2', ecosystems: ['pypi'], count: 1, jiraUrl: expect.any(String) },
      { component: 'pkg', ecosystems: ['pypi'], count: 1, jiraUrl: expect.any(String) },
      { component: 'pkg-extra', ecosystems: ['pypi'], count: 1, jiraUrl: expect.any(String) }
    ])
  })

  it('builds encoded phrase-search links without ecosystem, key, or version constraints', () => {
    const component = 'pkg "Quoted"\\path'
    const { model } = report([
      issue('RHAI-ESCAPED', ['ecosystem:pypi'], component),
      issue('RHAI-UNKNOWN', ['ecosystem:Unknown'], 'unknown-package'),
      issue('RHAI-GO', ['ecosystem:golang'], 'github.com/kubeflow/pipelines'),
      issue('RHAI-HYPHEN', ['ecosystem:pypi'], 'pkg-extra')
    ])
    const row = model.componentRows.value.find(item => item.component === component.toLowerCase())
    const jql = decodeURIComponent(row.jiraUrl.slice(JIRA_SEARCH_BASE.length))

    expect(row.jiraUrl).toContain('%20')
    expect(row.jiraUrl).toContain('%22')
    expect(row.jiraUrl).toContain('%5C')
    expect(jql).toBe(`${BASE_JQL} AND ${String.raw`cf[10632] ~ "\"pkg \\\"quoted\\\"\\\\path\""`}`)
    expect(jql).toContain('status not in (Closed, Resolved)')
    expect(jql).not.toMatch(/\bkey\s+in\b/i)
    expect(jql).not.toMatch(/Target Version|fixVersion/i)
    expect(jql).not.toContain('labels = "ecosystem:')

    for (const item of model.componentRows.value) {
      const itemJql = decodeURIComponent(item.jiraUrl.slice(JIRA_SEARCH_BASE.length))
      expect(itemJql).toMatch(/^.+ AND cf\[10632\] ~/)
      expect(itemJql).not.toContain('labels = "ecosystem:')
    }

    const goRow = model.componentRows.value.find(item => item.component === 'github.com/kubeflow/pipelines')
    expect(decodeURIComponent(goRow.jiraUrl.slice(JIRA_SEARCH_BASE.length))).toContain(
      String.raw`cf[10632] ~ "\"github.com\\/kubeflow\\/pipelines\""`
    )
    const hyphenRow = model.componentRows.value.find(item => item.component === 'pkg-extra')
    expect(decodeURIComponent(hyphenRow.jiraUrl.slice(JIRA_SEARCH_BASE.length))).toContain(
      String.raw`cf[10632] ~ "\"pkg\\-extra\""`
    )
  })

  it('reactively infers ecosystem membership when known metadata arrives later', () => {
    const { model, data } = report([
      issue('RHAI-PILLOW-UNKNOWN', ['ecosystem:Unknown'], 'Pillow')
    ])

    expect(model.totalOpen.value).toBe(1)
    expect(model.ecosystems.value).toEqual(['Unknown'])
    expect(model.componentRows.value[0]).toMatchObject({
      component: 'pillow',
      ecosystems: ['Unknown'],
      count: 1
    })
    expect(model.ecosystemBreakdown.value).toEqual([
      { ecosystem: 'Unknown', count: 1, pct: 100 }
    ])

    data.value = {
      ...data.value,
      openIssueRecords: [
        ...data.value.openIssueRecords,
        issue('RHAI-PILLOW-KNOWN', ['ecosystem:pypi'], 'PILLOW')
      ]
    }

    expect(model.totalOpen.value).toBe(2)
    expect(model.ecosystems.value).toEqual(['pypi'])
    expect(model.componentRows.value).toEqual([
      { component: 'pillow', ecosystems: ['pypi'], count: 2, jiraUrl: expect.any(String) }
    ])
    expect(model.ecosystemBreakdown.value).toEqual([
      { ecosystem: 'pypi', count: 2, pct: 100 }
    ])
  })

  it('rounds donut percentages to two decimals using unique component tickets', () => {
    const { model } = report([
      issue('RHAI-ONE', ['ecosystem:pypi'], 'one'),
      issue('RHAI-TWO', ['ecosystem:golang'], 'two'),
      issue('RHAI-THREE', ['ecosystem:golang'], 'three')
    ])

    expect(model.totalOpen.value).toBe(3)
    expect(model.ecosystemBreakdown.value).toEqual([
      { ecosystem: 'golang', count: 2, pct: 66.67 },
      { ecosystem: 'pypi', count: 1, pct: 33.33 }
    ])
  })
})
