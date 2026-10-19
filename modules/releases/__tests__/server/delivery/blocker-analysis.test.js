import { describe, expect, it } from 'vitest'

const analysis = require('../../../server/delivery/blocker-analysis')

function comment(text, accountType) {
  return {
    author: { displayName: accountType === 'app' ? 'Automation for Jira' : 'Engineer' , accountType: accountType || 'atlassian' },
    body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
  }
}

describe('release blocker analysis helpers', () => {
  it('extracts relevant human comment answers and ignores automation', () => {
    const signals = analysis.extractCommentSignals([
      comment('Is this a regression? Yes. Could this issue have been identified earlier? Add an upgrade test.', 'app'),
      comment('Is this a regression? Yes, the previous release worked. Could this issue have been identified earlier? Yes, an upgrade test would catch it.')
    ])

    expect(signals.regressionEvidence.join(' ')).toContain('the previous release worked')
    expect(signals.earlyDetectionResponse).toBe('Yes, an upgrade test would catch it.')
    expect(signals.relevantExcerpts).toHaveLength(1)
  })

  it('selects the most recent Proposed transition', () => {
    expect(analysis.getMostRecentProposedDate([
      { created: '2026-09-01T00:00:00Z', items: [{ fieldId: 'customfield_10847', toString: 'Proposed' }] },
      { created: '2026-10-01T00:00:00Z', items: [{ field: 'Release Blocker', toString: 'Proposed' }] }
    ])).toBe('2026-10-01T00:00:00.000Z')
  })

  it('classifies early-identification answers and derives prevention guidance', () => {
    const classified = analysis.classifyCommentAnalysis([
      comment('Could this issue have been identified earlier? Yes, an automated integration test would have caught the upgrade path.')
    ])

    expect(classified).toMatchObject({
      couldIdentifyEarlier: 'Yes',
      earlyDetectionCategory: 'Missing automated tests',
      preventionCategory: 'Add or expand automated tests'
    })
    expect(classified.prevention).toContain('automated tests')
    expect(classified.earlyIdentificationEvidence).toContain('Human Jira comment response')
  })

  it('classifies environment answers and preserves Unknown when no answer exists', () => {
    expect(analysis.classifyCommentAnalysis([
      comment('Could it have been identified earlier? No, the environment was unavailable during validation.')
    ])).toMatchObject({
      couldIdentifyEarlier: 'No',
      earlyDetectionCategory: 'Environment/configuration issue',
      preventionCategory: 'Fix environment/configuration'
    })

    expect(analysis.classifyCommentAnalysis([comment('The issue was reviewed by the team.')])).toMatchObject({
      couldIdentifyEarlier: 'Unknown',
      earlyDetectionCategory: 'Unknown',
      preventionCategory: 'Unknown',
      prevention: null
    })

    expect(analysis.classifyCommentAnalysis([
      comment('Could this issue have been identified earlier? It would have been detected only when we tested the build image on Power.')
    ])).toMatchObject({
      couldIdentifyEarlier: 'Yes',
      earlyDetectionCategory: 'Build validation gap',
      preventionCategory: 'Add build validation'
    })
  })

  it('normalizes duplicate detection labels and derives historical aggregates', () => {
    const normalized = analysis.normalizeBlockerAnalysisSnapshot({
      generatedAt: '2026-10-18T06:00:00Z',
      issues: [
        {
          key: 'RHOAIENG-1',
          releaseBlocker: 'Approved',
          fixVersions: ['3.5 GA'],
          components: ['Serving'],
          labels: ['prerelease-cve-remediation'],
          regression: 'Yes',
          couldIdentifyEarlier: 'No',
          earlyDetectionCategory: 'Missing automated test',
          preventionCategory: 'tests'
        },
        {
          key: 'RHOAIENG-2',
          releaseBlocker: 'Rejected',
          fixVersions: [],
          components: [],
          regression: 'maybe',
          couldIdentifyEarlier: 'Unknown',
          earlyDetectionCategory: 'Unknown'
        }
      ]
    })

    expect(normalized.error).toBeNull()
    expect(normalized.snapshot.issues[0].earlyDetectionCategory).toBe('Missing automated tests')
    expect(normalized.snapshot.issues[0].preventionCategory).toBe('Add or expand automated tests')
    expect(normalized.snapshot.aggregates.overall).toMatchObject({
      totalAnalyzed: 2,
      prereleaseCveRemediation: 1,
      regression: { yes: 1, no: 0, unknown: 1 },
      earlierIdentification: { yes: 0, no: 1, unknown: 1 }
    })
    expect(normalized.snapshot.aggregates.byRelease.map(group => group.label)).toEqual(['3.5 GA', 'No Fix Version'])
  })

  it('rejects duplicate keys and unsupported outcomes', () => {
    expect(analysis.validateBlockerAnalysisSnapshot({ issues: [{ key: 'RHOAIENG-1', releaseBlocker: 'Proposed' }] })).toContain('releaseBlocker')
    expect(analysis.validateBlockerAnalysisSnapshot({ issues: [
      { key: 'RHOAIENG-1', releaseBlocker: 'Approved' },
      { key: 'RHOAIENG-1', releaseBlocker: 'Rejected' }
    ] })).toContain('duplicate issue key')
  })
})
