import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('@shared/client/services/api', () => ({
  apiRequest: vi.fn()
}))

import { apiRequest } from '@shared/client/services/api'
import PromotionGatesView from '../../client/views/PromotionGatesView.vue'

function makeJob() {
  return {
    pr_number: 80,
    trigger_id: 'gap-d7deac',
    state: 'OPEN',
    created_at: '2026-11-05T08:06:17Z',
    labels: ['gated-artifacts-promoter', 'early-gate-build-failed'],
    source_url: 'https://github.com/red-hat-data-services/gated-artifacts-promoter/pull/80',
    state_json: {
      'pull-requests': [
        {
          repo: 'odh-dashboard',
          'pr-url': 'https://github.com/red-hat-data-services/odh-dashboard/pull/2696',
          'pr-status': 'success',
          'build-observations': {
            runs: [{ name: 'odh-dashboard-run', status: 'success', url: 'https://konflux.example.com/runs/1' }]
          }
        },
        {
          repo: 'odh-model-controller',
          'pr-url': 'https://github.com/red-hat-data-services/odh-model-controller/pull/1784',
          'pr-status': 'build-failure',
          'build-observations': {
            'gate-reason': 'Required build failed',
            runs: []
          }
        }
      ],
      'creator-outcomes': [
        {
          repo: 'red-hat-data-services/odh-dashboard',
          'source-branch': 'main',
          'target-branch': 'stable',
          outcome: 'success',
          reason: 'Updated pull request #2696',
          'pr-url': 'https://github.com/red-hat-data-services/odh-dashboard/pull/2696',
          'workflow-url': 'https://github.com/example/workflow'
        },
        {
          repo: 'red-hat-data-services/odh-model-controller',
          'source-branch': 'main',
          'target-branch': 'stable',
          outcome: 'merge-failure',
          reason: 'Auto-merge failed',
          'pr-url': 'https://github.com/red-hat-data-services/odh-model-controller/pull/1784',
          'workflow-url': 'https://github.com/example/workflow-2'
        }
      ],
      'promotion-gates': [
        { id: 'component-builds', required: true, status: 'pending' },
        { id: 'early-gate-build', required: false, status: 'failed' },
        { id: 'early-gate-test', required: false, status: 'pending' }
      ]
    },
    early_gate: {
      build: {
        status: 'failed',
        pipeline_url: 'https://konflux.example.com/pipelinerun/eg-build',
        ephemeral_branch: 'eg-80-abc',
        comment_url: 'https://github.com/example/comment',
        updated_at: '2026-11-05T09:25:43Z'
      },
      test: { status: 'unknown', pipeline_url: null, ephemeral_branch: null, comment_url: null, updated_at: null }
    },
    synced_at: '2026-11-06T08:30:00Z'
  }
}

async function mountView() {
  const wrapper = mount(PromotionGatesView, {
    global: {
      provide: {
        // No moduleNav in unit tests — the view falls back to a local tab ref.
      }
    }
  })
  // Wait for the onMounted load to settle.
  await vi.waitFor(() => {
    expect(wrapper.text()).not.toContain('Loading promotion gates')
  })
  return wrapper
}

describe('PromotionGatesView', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset()
  })

  it('renders the hero verdict, stage strip and early gate details', async () => {
    vi.mocked(apiRequest).mockResolvedValue(makeJob())
    const wrapper = await mountView()

    const leaderLink = wrapper.findAll('a').find((a) => a.text().includes('Leader PR #80'))
    expect(leaderLink).toBeDefined()
    expect(leaderLink.attributes('href')).toBe('https://github.com/red-hat-data-services/gated-artifacts-promoter/pull/80')

    // Label chips
    expect(wrapper.text()).toContain('gated-artifacts-promoter')

    // Hero verdict and progress counts
    expect(wrapper.text()).toContain('Promotion blocked')
    expect(wrapper.text()).toContain('1 of 2 components promoted')
    expect(wrapper.text()).toContain('1 ok')
    expect(wrapper.text()).toContain('1 blocked')
    expect(wrapper.text()).toContain('0 pending')

    // Stage strip covers the whole flow, with the early gate details inline
    for (const stage of ['Child PRs', 'Builds', 'Early gate build', 'Early gate test', 'Merge']) {
      expect(wrapper.text()).toContain(stage)
    }
    expect(wrapper.text()).toContain('Not run')
    expect(wrapper.text()).toContain('eg-80-abc')
  })

  it('splits components into blocking and passing tables', async () => {
    vi.mocked(apiRequest).mockResolvedValue(makeJob())
    const wrapper = await mountView()

    const text = wrapper.text()
    expect(text).toContain('Blocking components')
    expect(text).toContain('Passing components')
    // Blocking comes first, passing underneath, both visible without a toggle
    expect(text.indexOf('Blocking components')).toBeLessThan(text.indexOf('Passing components'))
    expect(text).toContain('Required build failed')

    const blocking = wrapper.find('h2.text-sm.font-semibold')
    expect(blocking.exists()).toBe(true)

    // Both repos rendered, one per table
    const latestPanel = wrapper.find('div[aria-label="Latest job"]')
    expect(latestPanel.text()).toContain('odh-dashboard')
    expect(latestPanel.text()).toContain('odh-model-controller')
  })

  it('renders build links for blocking components', async () => {
    const job = makeJob()
    job.state_json['pull-requests'][1]['build-observations'].runs = [
      { name: 'odh-model-controller-build', status: 'failure', url: 'https://konflux.example.com/runs/2' },
      { name: 'odh-model-serving-api-build', status: 'failure', url: 'https://konflux.example.com/runs/3' }
    ]
    vi.mocked(apiRequest).mockResolvedValue(job)
    const wrapper = await mountView()

    const buildLink = wrapper.findAll('a').find((a) => a.text() === 'Failing builds' || a.text() === 'odh-model-controller-build')
    expect(buildLink).toBeDefined()
    const runLink = wrapper.findAll('a').find((a) => a.attributes('href') === 'https://konflux.example.com/runs/2')
    expect(runLink).toBeDefined()
  })

  it('hides the issues section when all creator outcomes succeed', async () => {
    const job = makeJob()
    job.state_json['creator-outcomes'] = [job.state_json['creator-outcomes'][0]]
    vi.mocked(apiRequest).mockResolvedValue(job)
    const wrapper = await mountView()

    expect(wrapper.text()).not.toContain('PR creation and auto-merge issues')
  })

  it('renders the issues table rows for failing outcomes', async () => {
    vi.mocked(apiRequest).mockResolvedValue(makeJob())
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('PR creation and auto-merge issues')
    expect(wrapper.text()).toContain('Auto-merge failed')
  })

  it('shows the friendly empty state on a 404', async () => {
    const err = new Error('HTTP 404')
    err.status = 404
    vi.mocked(apiRequest).mockRejectedValue(err)
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('No promotion gates data yet')
    expect(wrapper.text()).toContain('collector may not have run yet')
  })

  it('points at the settings when the dashboard API is not configured', async () => {
    const err = new Error('HTTP 503')
    err.status = 503
    vi.mocked(apiRequest).mockRejectedValue(err)
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('Dashboard API not configured')
    expect(wrapper.text()).toContain('settings')
  })

  it('renders the release branches tab with diff links', async () => {
    vi.mocked(apiRequest).mockResolvedValue(makeJob())
    const wrapper = await mountView()

    await wrapper.findAll('button').find((b) => b.text() === 'Release branches').trigger('click')

    const diffLink = wrapper.findAll('a').find((a) => a.text() === 'main → stable')
    expect(diffLink).toBeDefined()
    expect(diffLink.attributes('href')).toBe('https://github.com/red-hat-data-services/odh-dashboard/compare/stable...main')
  })
})
