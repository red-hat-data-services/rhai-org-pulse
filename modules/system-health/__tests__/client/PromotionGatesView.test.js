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

  it('renders the leader PR header, gates and early gate blocks', async () => {
    vi.mocked(apiRequest).mockResolvedValue(makeJob())
    const wrapper = await mountView()

    const leaderLink = wrapper.findAll('a').find((a) => a.text().includes('Leader PR #80'))
    expect(leaderLink).toBeDefined()
    expect(leaderLink.attributes('href')).toBe('https://github.com/red-hat-data-services/gated-artifacts-promoter/pull/80')

    // Label chips
    expect(wrapper.text()).toContain('gated-artifacts-promoter')

    // Gate cards with required/optional markers
    expect(wrapper.text()).toContain('Component builds')
    expect(wrapper.text()).toContain('Early gate build')
    expect(wrapper.text()).toContain('Optional')

    // Early gate build block shows its links; test block shows not run yet
    expect(wrapper.text()).toContain('eg-80-abc')
    expect(wrapper.text()).toContain('Not run yet')
  })

  it('renders the components table with statuses, blocking reasons and build links', async () => {
    vi.mocked(apiRequest).mockResolvedValue(makeJob())
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('1 ok · 1 failing · 0 pending')
    expect(wrapper.text()).toContain('odh-dashboard')
    expect(wrapper.text()).toContain('odh-model-controller')
    expect(wrapper.text()).toContain('Required build failed')

    const buildLink = wrapper.findAll('a').find((a) => a.text() === 'odh-dashboard-run')
    expect(buildLink).toBeDefined()
    expect(buildLink.attributes('href')).toBe('https://konflux.example.com/runs/1')
  })

  it('renders the issues section and the positive line when all outcomes succeed', async () => {
    const job = makeJob()
    job.state_json['creator-outcomes'] = [job.state_json['creator-outcomes'][0]]
    vi.mocked(apiRequest).mockResolvedValue(job)
    const wrapper = await mountView()

    expect(wrapper.text()).toContain('No PR creation or auto-merge issues')
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
    expect(wrapper.text()).toContain('dashboard collector configured')
  })

  it('renders the release branches tab with diff links', async () => {
    vi.mocked(apiRequest).mockResolvedValue(makeJob())
    const wrapper = await mountView()

    await wrapper.findAll('button').find((b) => b.text() === 'Release branches').trigger('click')

    const diffLink = wrapper.findAll('a').find((a) => a.text() === 'stable…main')
    expect(diffLink).toBeDefined()
    expect(diffLink.attributes('href')).toBe('https://github.com/red-hat-data-services/odh-dashboard/compare/stable...main')
  })

  it('filters the components table by problems only', async () => {
    vi.mocked(apiRequest).mockResolvedValue(makeJob())
    const wrapper = await mountView()

    await wrapper.find('select').setValue('problems')
    const latestPanel = wrapper.find('div[aria-label="Latest job"]')
    expect(latestPanel.text()).not.toContain('odh-dashboard')
    expect(latestPanel.text()).toContain('odh-model-controller')
  })
})
