import { describe, it, expect, vi } from 'vitest'
const {
  fetchOutcomeChildren,
  normalizeChild,
  versionNames
} = require('../../../server/planning/outcome-children-fetch')

describe('versionNames', () => {
  it('handles arrays of version objects', () => {
    expect(versionNames([{ name: 'rhoai-3.6' }, { value: 'rhoai-3.5' }])).toEqual(['rhoai-3.6', 'rhoai-3.5'])
  })

  it('handles string and empty', () => {
    expect(versionNames('rhoai-3.6')).toEqual(['rhoai-3.6'])
    expect(versionNames(null)).toEqual([])
  })
})

describe('normalizeChild', () => {
  it('maps parent from fields.parent', () => {
    const child = normalizeChild({
      key: 'RHAISTRAT-1671',
      fields: {
        summary: 'Child feature',
        status: { name: 'Review' },
        issuetype: { name: 'Feature' },
        priority: { name: 'Major' },
        parent: { key: 'RHAISTRAT-2000' },
        customfield_10855: [{ name: 'rhoai-3.5' }],
        labels: ['3.5-candidate'],
        components: [{ name: 'Serving' }],
        fixVersions: [{ name: 'rhoai-3.5' }]
      }
    })
    expect(child.key).toBe('RHAISTRAT-1671')
    expect(child.parentKey).toBe('RHAISTRAT-2000')
    expect(child.status).toBe('Review')
    expect(child.targetVersions).toEqual(['rhoai-3.5'])
    expect(child.components).toEqual(['Serving'])
  })

  it('falls back to Epic Link field', () => {
    const child = normalizeChild({
      key: 'RHAISTRAT-99',
      fields: {
        summary: 'Epic-linked',
        status: { name: 'New' },
        issuetype: { name: 'Feature' },
        customfield_10014: 'RHAISTRAT-2000'
      }
    })
    expect(child.parentKey).toBe('RHAISTRAT-2000')
  })
})

describe('fetchOutcomeChildren', () => {
  it('returns empty map when jira client missing', async () => {
    expect(await fetchOutcomeChildren(null, ['RHAISTRAT-2000'])).toEqual({})
    expect(await fetchOutcomeChildren({}, ['RHAISTRAT-2000'])).toEqual({})
  })

  it('queries Jira and groups children by parent outcome', async () => {
    const fetchAllJqlResults = vi.fn().mockResolvedValue([
      {
        key: 'RHAISTRAT-1671',
        fields: {
          summary: 'In index eventually',
          status: { name: 'New' },
          issuetype: { name: 'Feature' },
          parent: { key: 'RHAISTRAT-2000' },
          customfield_10855: [{ name: 'rhoai-3.6' }]
        }
      },
      {
        key: 'RHAISTRAT-1746',
        fields: {
          summary: 'No TV',
          status: { name: 'Backlog' },
          issuetype: { name: 'Feature' },
          parent: { key: 'RHAISTRAT-2000' }
        }
      }
    ])

    const byOutcome = await fetchOutcomeChildren(
      { fetchAllJqlResults: fetchAllJqlResults },
      ['RHAISTRAT-2000', 'bad key', 'RHAISTRAT-2000']
    )

    expect(fetchAllJqlResults).toHaveBeenCalledTimes(1)
    const jql = fetchAllJqlResults.mock.calls[0][0]
    expect(jql).toContain('parent in (RHAISTRAT-2000)')
    expect(jql).toContain('"Epic Link" in (RHAISTRAT-2000)')
    expect(jql).toContain('issuetype in (Feature, Initiative)')
    expect(byOutcome['RHAISTRAT-2000']).toHaveLength(2)
    expect(byOutcome['RHAISTRAT-2000'][0].key).toBe('RHAISTRAT-1671')
  })
})
