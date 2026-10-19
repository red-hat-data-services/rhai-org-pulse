import { describe, it, expect } from 'vitest'

const registerBlockerRoutes = require('../../../server/delivery/blockers')

function comment(author, body, accountType) {
  return {
    author: { displayName: author, accountType: accountType || 'atlassian' },
    body: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }]
    }
  }
}

const COMPLETE_ASSESSMENT = [
  'Known workarounds? Yes, apply the NetworkPolicy manually.',
  'Overall impact? Workbench creation fails for all affected clusters.',
  'Could it have been identified earlier? No, the environment was unavailable.',
  'Is this a regression? No, it is a pre-existing omission.',
  'Reviews and tests to prevent collateral damage? QE and component reviews passed.'
].join(' ')

describe('release blocker Jira field mapping', () => {
  it('builds an unfiltered historical trends query', () => {
    const jql = registerBlockerRoutes.buildHistoricalTrendsJql()

    expect(jql).toContain('cf[10847] in (16772, 16774)')
    expect(jql).not.toContain('fixVersion IN')
    expect(jql).not.toContain('status not in (Closed, Resolved)')
  })

  it('aggregates approved and rejected blockers by release and component', () => {
    const issues = [
      {
        key: 'RHOAIENG-901',
        fields: {
          fixVersions: [{ name: '3.5 GA RHOAI RELEASE' }],
          versions: [{ name: 'rhoai-3.5' }],
          components: [{ name: 'Model Serving' }],
          customfield_10847: { value: 'Approved' }
        }
      },
      {
        key: 'RHOAIENG-902',
        fields: {
          fixVersions: [{ name: '3.6 GA RHOAI RELEASE' }],
          versions: [],
          components: [{ name: 'Model Serving' }, { name: 'KubeRay' }],
          customfield_10847: { value: 'Rejected' }
        }
      }
    ]

    const trends = registerBlockerRoutes.buildHistoricalTrends(issues)

    expect(trends.releases).toEqual([
      { label: 'rhoai-3.5', approved: 1, rejected: 0, total: 1 },
      { label: '3.5 GA RHOAI RELEASE', approved: 1, rejected: 0, total: 1 },
      { label: '3.6 GA RHOAI RELEASE', approved: 0, rejected: 1, total: 1 }
    ])
    expect(trends.components).toEqual([
      { label: 'KubeRay', approved: 0, rejected: 1, total: 1 },
      { label: 'Model Serving', approved: 1, rejected: 1, total: 2 }
    ])
    expect(trends.issues.map(issue => issue.key)).toEqual(['RHOAIENG-901', 'RHOAIENG-902'])
    expect(trends.issues[0].trendReleases).toEqual(['3.5 GA RHOAI RELEASE', 'rhoai-3.5'])
  })

  it('builds the awareness query from the blocker scope and includes fix version matches', () => {
    const jql = registerBlockerRoutes.buildAwarenessTrendsJql('3.5 GA RHOAI RELEASE')

    expect(jql).toContain('project in (RHAIENG, RHOAIENG)')
    expect(jql).toContain("fixVersion IN ('3.5 GA RHOAI RELEASE')")
    expect(jql).toContain("affectedVersion IN ('3.5 GA RHOAI RELEASE')")
    expect(jql).toContain("cf[10855] IN ('3.5 GA RHOAI RELEASE')")
    expect(jql).toContain('priority in (Blocker)')
    expect(jql).toContain('cf[10847] is not EMPTY')
  })

  it('requests the fields shown in the release blockers table', () => {
    expect(registerBlockerRoutes.BLOCKER_FIELDS).toContain('issuetype')
    expect(registerBlockerRoutes.BLOCKER_FIELDS).toContain('reporter')
    expect(registerBlockerRoutes.BLOCKER_FIELDS).toContain('fixVersions')
    expect(registerBlockerRoutes.BLOCKER_FIELDS).toContain('versions')
    expect(registerBlockerRoutes.BLOCKER_FIELDS).toContain('customfield_10001')
    expect(registerBlockerRoutes.BLOCKER_FIELDS).toContain('customfield_10000')
    expect(registerBlockerRoutes.BLOCKER_FIELDS).toContain('customfield_10469')
    expect(registerBlockerRoutes.BLOCKER_FIELDS).toContain('comment')
  })

  it('requires substantive human answers for all five assessment questions', () => {
    const flags = registerBlockerRoutes.assessmentAnswerFlags({
      comments: [
        comment('Automation for Jira', [
          'Known workarounds?', 'Overall impact?', 'Could it have been identified earlier?',
          'Is this a regression?', 'Reviews and tests to prevent collateral damage?'
        ].join(' '), 'app'),
        comment('Engineer Name', COMPLETE_ASSESSMENT)
      ]
    })

    expect(flags).toEqual({
      workaround: true,
      impact: true,
      earlyCatch: true,
      regression: true,
      reviewsAndTests: true
    })
  })

  it('classifies regression status from the latest human comment', () => {
    expect(registerBlockerRoutes.regressionStatus({
      comments: [
        comment('Automation for Jira', 'Is this a regression? Yes.', 'app'),
        comment('Engineer Name', 'Is this a regression? No, the behavior never worked before.')
      ]
    })).toBe('No')

    expect(registerBlockerRoutes.regressionStatus({
      comments: [comment('Engineer Name', 'This is a regression introduced by the latest upgrade.')]
    })).toBe('Yes')

    expect(registerBlockerRoutes.regressionStatus({ comments: [] })).toBe('Unknown')
  })

  it('finds only open pull requests in red-hat-data-services repositories', () => {
    const pullRequests = registerBlockerRoutes.extractActiveRhdPullRequests({
      detail: [{
        pullRequests: [
          { name: 'Downstream fix', repositoryName: 'red-hat-data-services/kubeflow', status: 'OPEN', url: 'https://github.com/red-hat-data-services/kubeflow/pull/1' },
          { name: 'Merged downstream fix', repositoryName: 'red-hat-data-services/kubeflow', status: 'MERGED', url: 'https://github.com/red-hat-data-services/kubeflow/pull/2' },
          { name: 'Upstream fix', repositoryName: 'opendatahub-io/kubeflow', status: 'OPEN', url: 'https://github.com/opendatahub-io/kubeflow/pull/3' }
        ]
      }]
    })

    expect(pullRequests).toEqual([{
      name: 'Downstream fix',
      repository: 'red-hat-data-services/kubeflow',
      status: 'OPEN',
      url: 'https://github.com/red-hat-data-services/kubeflow/pull/1'
    }])
  })

  it('requires PM acknowledgement for z-stream blockers', () => {
    const issue = {
      fields: {
        fixVersions: [{ name: '3.5.1 GA RHOAI' }],
        customfield_10469: { displayName: 'Product Manager' },
        comment: {
          comments: [
            comment('Engineer Name', COMPLETE_ASSESSMENT),
            comment('Product Manager', 'ACK — approved for exception triage.')
          ]
        }
      }
    }
    const activePullRequests = [{ repository: 'red-hat-data-services/kubeflow', status: 'OPEN' }]
    const readiness = registerBlockerRoutes.buildTriageReadiness(issue, activePullRequests)

    expect(registerBlockerRoutes.isZStreamVersion(['3.5.1 GA RHOAI'])).toBe(true)
    expect(readiness.ready).toBe(true)
    expect(readiness.criteria).toEqual({
      fixVersion: true,
      linkedPullRequest: true,
      assessmentCompleted: true,
      pmAcknowledgement: true
    })
    expect(readiness.pmAcknowledgementRequired).toBe(true)
  })

  it('reports each missing triage requirement without requiring PM acknowledgement for y-stream', () => {
    const readiness = registerBlockerRoutes.buildTriageReadiness({
      fields: {
        fixVersions: [{ name: '3.6 GA RHOAI RELEASE' }],
        comment: { comments: [] }
      }
    }, [])

    expect(readiness.ready).toBe(false)
    expect(readiness.criteria.pmAcknowledgement).toBe(true)
    expect(readiness.missingCriteria).toEqual([
      'active red-hat-data-services PR',
      'all five assessment answers'
    ])
  })

  it('maps Jira issue metadata into the blocker row', () => {
    const issue = {
      key: 'RHOAIENG-123',
      fields: {
        summary: 'Example release blocker',
        priority: { name: 'Blocker' },
        issuetype: { name: 'Bug' },
        status: { name: 'In Progress' },
        assignee: { displayName: 'Assignee Name' },
        reporter: { displayName: 'Reporter Name' },
        fixVersions: [{ name: '3.5 GA RHOAI RELEASE' }],
        versions: [{ name: 'rhoai-3.5' }],
        components: [{ name: 'AI Pipelines' }],
        customfield_10001: { name: 'AI Pipelines' },
        customfield_10847: { value: 'Proposed' },
        created: '2026-10-01T00:00:00.000Z'
      },
      changelog: { histories: [] }
    }

    const response = registerBlockerRoutes.buildResponse(
      '3.5',
      [issue],
      [],
      null,
      'https://jira.example.com'
    )

    expect(response.blockers[0]).toMatchObject({
      key: 'RHOAIENG-123',
      summary: 'Example release blocker',
      priority: 'Blocker',
      issueType: 'Bug',
      status: 'In Progress',
      releaseBlockerStatus: 'Proposed',
      assignee: 'Assignee Name',
      reporter: 'Reporter Name',
      fixVersions: ['3.5 GA RHOAI RELEASE'],
      affectedVersions: ['rhoai-3.5'],
      components: ['AI Pipelines'],
      team: 'AI Pipelines'
    })
  })

  it('maps Jira option IDs and alternate user field shapes', () => {
    const issue = {
      key: 'RHOAIENG-456',
      fields: {
        summary: 'Mapped release blocker',
        priority: { name: 'Blocker' },
        issuetype: { name: 'Bug' },
        status: { name: 'New' },
        assignee: { name: 'assignee-name' },
        reporter: { emailAddress: 'reporter@example.com' },
        fixVersions: [],
        versions: [],
        components: [],
        customfield_10001: { value: 'Platform' },
        customfield_10847: { id: '16772' },
        created: '2026-10-01T00:00:00.000Z'
      },
      changelog: { histories: [] }
    }

    const response = registerBlockerRoutes.buildResponse(
      '3.5',
      [issue],
      [],
      null,
      'https://jira.example.com'
    )

    expect(response.blockers[0]).toMatchObject({
      releaseBlockerStatus: 'Approved',
      assignee: 'assignee-name',
      reporter: 'reporter@example.com',
      team: 'Platform'
    })
  })

  it('maps awareness rows and records the latest Proposed transition', () => {
    const issue = {
      key: 'RHOAIENG-789',
      fields: {
        summary: 'Release awareness issue',
        priority: { name: 'Blocker' },
        issuetype: { name: 'Bug' },
        status: { name: 'Review' },
        assignee: { displayName: 'Current Owner' },
        reporter: { displayName: 'Original Reporter' },
        fixVersions: [{ name: '3.5 GA RHOAI RELEASE' }],
        versions: [{ name: 'rhoai-3.5' }],
        components: [{ name: 'Model Serving' }],
        customfield_10001: { name: 'Serving' },
        customfield_10847: { value: 'Proposed' },
        comment: {
          comments: [comment('Engineer Name', 'Is this a regression? Yes, the previous release worked.')]
        },
        created: '2026-09-01T00:00:00.000Z',
        updated: '2026-10-06T00:00:00.000Z'
      },
      changelog: {
        histories: [
          {
            created: '2026-09-01T00:00:00.000Z',
            items: [{ fieldId: 'customfield_10847', toString: 'Proposed' }]
          },
          {
            created: '2026-09-03T00:00:00.000Z',
            items: [{ fieldId: 'customfield_10847', fromString: 'Proposed', toString: 'Approved' }]
          },
          {
            created: '2026-10-05T00:00:00.000Z',
            items: [{ fieldId: 'customfield_10847', fromString: 'Approved', toString: 'Proposed' }]
          }
        ]
      }
    }

    const response = registerBlockerRoutes.buildResponse(
      '3.5',
      [],
      [],
      null,
      'https://jira.example.com',
      [issue]
    )

    expect(response.awarenessTrends[0]).toMatchObject({
      key: 'RHOAIENG-789',
      summary: 'Release awareness issue',
      releaseBlockerStatus: 'Proposed',
      fixVersions: ['3.5 GA RHOAI RELEASE'],
      affectedVersions: ['rhoai-3.5'],
      components: ['Model Serving'],
      team: 'Serving',
      isRegression: 'Yes',
      latestProposedDate: '2026-10-05T00:00:00.000Z'
    })
    expect(response.awarenessTrends[0].triageReadiness).toMatchObject({
      ready: false,
      missingCriteria: ['active red-hat-data-services PR', 'all five assessment answers'],
      pmAcknowledgementRequired: false
    })
  })
})
