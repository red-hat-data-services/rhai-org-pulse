import { describe, expect, it } from 'vitest'

import { buildLocalAnalysis } from '../../../client/deliver/composables/useBlockerAnalysis.js'

describe('local release blocker analysis', () => {
  it('uses only approved and rejected rows and derives groups from loaded Jira data', () => {
    const result = buildLocalAnalysis([
      {
        key: 'RHOAIENG-1',
        summary: 'Approved blocker',
        releaseBlockerStatus: 'Approved',
        fixVersions: ['3.6 GA RHOAI RELEASE'],
        components: ['Serving', 'Security'],
        labels: ['prerelease-cve-remediation'],
        isRegression: 'Yes'
      },
      {
        key: 'RHOAIENG-2',
        summary: 'Rejected blocker',
        releaseBlockerStatus: 'Rejected',
        fixVersions: [],
        components: [],
        isRegression: 'No'
      },
      {
        key: 'RHOAIENG-3',
        summary: 'Still proposed',
        releaseBlockerStatus: 'Proposed'
      }
    ], '2026-10-18T00:00:00.000Z')

    expect(result.issues).toHaveLength(2)
    expect(result.aggregates.overall).toMatchObject({
      totalAnalyzed: 2,
      prereleaseCveRemediation: 1,
      regression: { yes: 1, no: 1, unknown: 0 },
      earlierIdentification: { yes: 0, no: 0, unknown: 2 }
    })
    expect(result.aggregates.byRelease.map(group => group.label)).toEqual([
      '3.6 GA RHOAI RELEASE',
      'No Fix Version'
    ])
    expect(result.aggregates.byComponent.map(group => group.label)).toEqual(['(No component)', 'Security', 'Serving'])
    expect(result.aggregates.topEarlyDetectionCategories).toEqual([{ label: 'Unknown', count: 2 }])
  })

  it('deduplicates repeated Jira rows by key', () => {
    const result = buildLocalAnalysis([
      { key: 'RHOAIENG-1', releaseBlockerStatus: 'Approved' },
      { key: 'RHOAIENG-1', releaseBlockerStatus: 'Rejected' }
    ])

    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].releaseBlocker).toBe('Approved')
  })
})
