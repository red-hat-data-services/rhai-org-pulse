import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn()
}))

import { apiRequest } from '@shared/client/services/api'
import {
  usePromotionGates,
  isPrProblem,
  prProblemReason,
  compactReason,
  failureLinksByRepo,
  promotionVerdict,
  summarizePullRequests,
  buildDiffUrl,
  joinReleaseBranches
} from '../../client/composables/usePromotionGates.js'

function makeJob() {
  return {
    pr_number: 80,
    trigger_id: 'gap-d7deac',
    state: 'OPEN',
    source_url: 'https://github.com/red-hat-data-services/gated-artifacts-promoter/pull/80',
    state_json: {
      'pull-requests': [
        {
          repo: 'odh-dashboard',
          'pr-url': 'https://github.com/red-hat-data-services/odh-dashboard/pull/2696',
          'pr-status': 'success',
          'build-observations': {
            'gate-reason': null,
            runs: [{ name: 'run-a', status: 'success', reason: 'Completed', url: 'https://konflux/run-a' }]
          }
        },
        {
          repo: 'odh-model-controller',
          'pr-url': 'https://github.com/red-hat-data-services/odh-model-controller/pull/1784',
          'pr-status': 'build-failure',
          'build-observations': {
            'gate-reason': 'Required build failed',
            runs: [
              { name: 'run-b', status: 'failure', reason: 'Step failed', url: 'https://konflux/run-b' },
              { name: 'run-c', status: 'success', reason: 'Completed', url: 'https://konflux/run-c' }
            ]
          }
        },
        {
          repo: 'kserve',
          'pr-url': 'https://github.com/red-hat-data-services/kserve/pull/22',
          'pr-status': 'build-pending',
          'build-observations': { runs: [] }
        }
      ],
      'creator-outcomes': [
        {
          repo: 'red-hat-data-services/odh-dashboard',
          'source-branch': 'main',
          'target-branch': 'stable',
          outcome: 'success',
          reason: 'Updated pull request #2696',
          'pr-url': 'https://github.com/red-hat-data-services/odh-dashboard/pull/2696'
        },
        {
          repo: 'red-hat-data-services/MLServer',
          'source-branch': 'main',
          'target-branch': 'stable',
          outcome: 'success',
          reason: 'Target branch is already up to date.',
          'pr-url': ''
        }
      ],
      'promotion-gates': [
        { id: 'component-builds', required: true, status: 'pending' }
      ]
    },
    synced_at: '2026-11-06T08:30:00Z'
  }
}

describe('usePromotionGates', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset()
  })

  it('loadLatest exposes the job and derived collections', async () => {
    vi.mocked(apiRequest).mockResolvedValue(makeJob())

    const gates = usePromotionGates()
    await gates.loadLatest()

    expect(apiRequest).toHaveBeenCalledWith('/modules/system-health/promotion-gates/latest')
    expect(gates.job.value.pr_number).toBe(80)
    expect(gates.pullRequests.value).toHaveLength(3)
    expect(gates.gates.value).toEqual([{ id: 'component-builds', required: true, status: 'pending' }])
    expect(gates.issues.value).toEqual([])
    expect(gates.error.value).toBeNull()
    expect(gates.notFound.value).toBe(false)
  })

  it('loadLatest records notFound on a 404', async () => {
    const err = new Error('HTTP 404')
    err.status = 404
    vi.mocked(apiRequest).mockRejectedValue(err)

    const gates = usePromotionGates()
    await gates.loadLatest()

    expect(gates.notFound.value).toBe(true)
    expect(gates.job.value).toBeNull()
    expect(gates.error.value).toBeNull()
  })

  it('loadLatest records notConfigured on a 503', async () => {
    const err = new Error('Promotion Gates API not configured')
    err.status = 503
    vi.mocked(apiRequest).mockRejectedValue(err)

    const gates = usePromotionGates()
    await gates.loadLatest()

    expect(gates.notConfigured.value).toBe(true)
    expect(gates.error.value).toBeNull()
  })

  it('loadLatest records the error message on other failures', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('network down'))

    const gates = usePromotionGates()
    await gates.loadLatest()

    expect(gates.error.value).toMatch(/network down/)
    expect(gates.notFound.value).toBe(false)
  })
})

describe('pull-request helpers', () => {
  const prs = makeJob().state_json['pull-requests']

  it('treats any status other than success as a problem', () => {
    expect(isPrProblem(prs[0])).toBe(false)
    expect(isPrProblem(prs[1])).toBe(true)
    expect(isPrProblem(prs[2])).toBe(true)
    expect(isPrProblem({})).toBe(true)
  })

  it('prefers the gate reason, then the first failing run reason', () => {
    expect(prProblemReason(prs[1])).toBe('Required build failed')
    expect(prProblemReason(prs[2])).toBe('build-pending')
  })

  it('summarizes ok / failing / pending counts', () => {
    expect(summarizePullRequests(prs)).toEqual({ ok: 1, failing: 1, pending: 1, total: 3 })
    expect(summarizePullRequests(null)).toEqual({ ok: 0, failing: 0, pending: 0, total: 0 })
  })
})

describe('joinReleaseBranches', () => {
  it('joins pull-requests and creator-outcomes on repo, case-insensitively', () => {
    const rows = joinReleaseBranches(makeJob().state_json)

    expect(rows).toHaveLength(4)

    const dashboard = rows.find((r) => r.repo === 'odh-dashboard')
    expect(dashboard.prUrl).toContain('odh-dashboard/pull/2696')
    expect(dashboard.targetBranch).toBe('stable')
    expect(dashboard.sourceBranch).toBe('main')
    expect(dashboard.diffUrl).toBe('https://github.com/red-hat-data-services/odh-dashboard/compare/stable...main')

    // Creator outcome without a matching child PR still gets a row
    const mlserver = rows.find((r) => r.repo === 'MLServer')
    expect(mlserver.prUrl).toBeNull()
    expect(mlserver.reason).toBe('Target branch is already up to date.')
    expect(mlserver.diffUrl).toBe('https://github.com/red-hat-data-services/MLServer/compare/stable...main')

    // Pull-request without a creator outcome keeps defaults
    const kserve = rows.find((r) => r.repo === 'kserve')
    expect(kserve.targetBranch).toBeNull()
    expect(kserve.diffUrl).toBe('https://github.com/red-hat-data-services/kserve/compare/stable...main')
  })

  it('returns an empty array without state', () => {
    expect(joinReleaseBranches(null)).toEqual([])
  })
})

describe('buildDiffUrl', () => {
  it('defaults to stable...main', () => {
    expect(buildDiffUrl('odh-dashboard', null, null))
      .toBe('https://github.com/red-hat-data-services/odh-dashboard/compare/stable...main')
  })

  it('uses the provided branches', () => {
    expect(buildDiffUrl('odh-dashboard', 'stable-3.6', 'main-3.6'))
      .toBe('https://github.com/red-hat-data-services/odh-dashboard/compare/stable-3.6...main-3.6')
  })
})

describe('promotionVerdict', () => {
  const job = (state, statuses) => ({
    state,
    state_json: { 'pull-requests': statuses.map((prStatus, i) => ({ repo: `r${i}`, 'pr-status': prStatus })) },
    early_gate: { build: { status: 'succeeded' } }
  })

  it('is complete only when every component is promoted and the leader PR merged', () => {
    expect(promotionVerdict(job('MERGED', ['success', 'success']))).toBe('complete')
  })

  it('does not call a closed, unmerged leader PR complete', () => {
    expect(promotionVerdict(job('CLOSED', ['success', 'success']))).toBe('progress')
  })

  it('is blocked on a failing build', () => {
    expect(promotionVerdict(job('OPEN', ['success', 'build-failure']))).toBe('blocked')
  })

  it('is empty without components', () => {
    expect(promotionVerdict(job('OPEN', []))).toBe('empty')
  })
})


describe('failureLinksByRepo', () => {
  it('groups Jira keys and Slack threads per repo', () => {
    const job = {
      failure_links: [
        { repo: 'kserve', label: 'a', jira_url: 'https://stage-redhat.atlassian.net/browse/RHAI-240', slack_url: 'https://redhat-internal.slack.com/x' },
        { repo: 'kserve', label: 'b', jira_url: 'https://redhat.atlassian.net/browse/RHAI-241', slack_url: 'https://redhat-internal.slack.com/x' }
      ]
    }
    const byRepo = failureLinksByRepo(job)
    expect(byRepo.kserve.jira.map((j) => j.key)).toEqual(['RHAI-240', 'RHAI-241'])
    // the same Slack thread is listed once
    expect(byRepo.kserve.slack).toHaveLength(1)
  })

  it('tolerates a job without links', () => {
    expect(failureLinksByRepo({})).toEqual({})
    expect(failureLinksByRepo(null)).toEqual({})
  })
})


describe('compactReason', () => {
  const runs = [{ component: 'odh-data-connect-hub-flight-v3-7-ea-1' }]

  it('drops the component name and the (+N more) suffix', () => {
    expect(
      compactReason('odh-data-connect-hub-flight-v3-7-ea-1 Konflux failure: Failed (+1 more)', runs)
    ).toBe('Failed')
  })

  it('keeps a meaningful failure mode', () => {
    expect(compactReason('odh-kserve-agent-v3-7-ea-1 Konflux failure: CouldntGetTask', runs)).toBe(
      'CouldntGetTask'
    )
    expect(
      compactReason('Konflux lookup unavailable: PR-associated PipelineRun has an unknown trigger event', [])
    ).toBe('PR-associated PipelineRun has an unknown trigger event')
  })

  it('leaves a reason without a component prefix alone', () => {
    const merge = 'main-release-feasibility (rhoai-3.7-ea.1) concluded failure'
    expect(compactReason(merge, [])).toBe(merge)
  })
})
