import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('../../client/services/allocation-api', () => ({
  getBoardSprints: vi.fn(),
  getSprintIssues: vi.fn(),
  getTeamAllocationSettings: vi.fn()
}))

vi.mock('../../client/composables/useAllocationStrategy', () => ({
  useAllocationStrategy: () => ({
    categories: { value: [{ key: 'new-features', name: 'New Features', color: 'blue', target: 40 }] },
    name: { value: 'AI Engineering 40/40/20' }
  })
}))

vi.mock('../../client/composables/useAllocationRefresh', async () => {
  const { ref } = await import('vue')
  return {
    useAllocationRefresh: () => ({ refreshing: ref(false), message: ref(''), triggerRefresh: vi.fn() })
  }
})

const { getBoardSprints, getSprintIssues, getTeamAllocationSettings } = await import('../../client/services/allocation-api')
import TeamAllocationTab from '../../client/TeamAllocationTab.vue'

const SCRUM_SPRINTS = {
  synced: true,
  lastUpdated: '2026-08-17T15:00:00.000Z',
  sprints: [{ id: 100, name: 'Sprint 1', state: 'active', startDate: '2026-08-01', endDate: '2026-08-14' }]
}
const SCRUM_ISSUES = {
  sprintId: 100, sprintName: 'Sprint 1', sprintState: 'active',
  issues: [{ key: 'X-1', bucket: 'new-features', storyPoints: 5, resolution: null }],
  summary: { totalPoints: 5, totalCount: 1, buckets: { 'new-features': { points: 5, count: 1 } } }
}

function mountTab(props) {
  return mount(TeamAllocationTab, {
    props,
    global: {
      stubs: {
        SprintSelector: true, SprintStatusBadge: true, AllocationBar: true,
        BucketBreakdown: true, MetricToggle: true, UnestimatedPanel: true, CompletionSummary: true
      }
    }
  })
}

describe('TeamAllocationTab board selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getBoardSprints.mockResolvedValue(SCRUM_SPRINTS)
    getSprintIssues.mockResolvedValue(SCRUM_ISSUES)
    getTeamAllocationSettings.mockResolvedValue({ allocationMode: 'points', configured: true, canEdit: false })
  })

  it('auto-selects the board and renders the info block when boards are present at mount', async () => {
    const wrapper = mountTab({
      team: { metadata: {} },
      teamId: 'team_1',
      teamDetail: { boards: [{ url: 'x/boards/1103', name: 'AI Hub Board', boardId: 1103 }] }
    })
    await flushPromises()

    expect(getBoardSprints).toHaveBeenCalledWith(1103, undefined)
    expect(wrapper.text()).toContain('detected as a')
    expect(wrapper.text()).toContain('Scrum board')
  })

  it('hides the settings button when the user cannot edit the team', async () => {
    const wrapper = mountTab({
      team: { metadata: {} },
      teamId: 'team_1',
      teamDetail: { boards: [{ url: 'x/boards/1103', name: 'AI Hub Board', boardId: 1103 }] }
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="allocation-settings-button"]').exists()).toBe(false)
  })

  it('shows the settings button when the user can edit the team', async () => {
    getTeamAllocationSettings.mockResolvedValue({ allocationMode: 'points', configured: true, canEdit: true })
    const wrapper = mountTab({
      team: { metadata: {} },
      teamId: 'team_1',
      teamDetail: { boards: [{ url: 'x/boards/1103', name: 'AI Hub Board', boardId: 1103 }] }
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="allocation-settings-button"]').exists()).toBe(true)
  })

  it('shows the unconfigured banner when the team has no allocation basis set', async () => {
    getTeamAllocationSettings.mockResolvedValue({ allocationMode: null, configured: false, canEdit: true })
    const wrapper = mountTab({
      team: { metadata: {} },
      teamId: 'team_1',
      teamDetail: { boards: [{ url: 'x/boards/1103', name: 'AI Hub Board', boardId: 1103 }] }
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="allocation-unconfigured-banner"]').exists()).toBe(true)
    // A manager gets a call-to-action to configure it.
    expect(wrapper.find('[data-testid="allocation-unconfigured-cta"]').exists()).toBe(true)
  })

  it('hides the unconfigured banner once a basis is configured', async () => {
    getTeamAllocationSettings.mockResolvedValue({ allocationMode: 'counts', configured: true, canEdit: true })
    const wrapper = mountTab({
      team: { metadata: {} },
      teamId: 'team_1',
      teamDetail: { boards: [{ url: 'x/boards/1103', name: 'AI Hub Board', boardId: 1103 }] }
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="allocation-unconfigured-banner"]').exists()).toBe(false)
  })

  it('selects the board when teamDetail arrives asynchronously after mount', async () => {
    // teamDetail is null at mount (the real-world async case that caused the bug)
    const wrapper = mountTab({ team: { metadata: {} }, teamId: 'team_1', teamDetail: null })
    await flushPromises()
    expect(getBoardSprints).not.toHaveBeenCalled()
    // "not set up" empty state while there are no boards
    expect(wrapper.find('[data-testid="allocation-refresh-panel"]').exists()).toBe(true)

    // teamDetail loads → board should be auto-selected and sprints fetched
    await wrapper.setProps({ teamDetail: { boards: [{ url: 'x/boards/1103', name: 'AI Hub Board', boardId: 1103 }] } })
    await flushPromises()

    expect(getBoardSprints).toHaveBeenCalledWith(1103, undefined)
    expect(wrapper.text()).toContain('Scrum board')
  })

  it('shows the never-synced state when the board has no data file', async () => {
    getBoardSprints.mockResolvedValue({ synced: false, sprints: [] })
    const wrapper = mountTab({
      team: { metadata: {} },
      teamId: 'team_1',
      teamDetail: { boards: [{ url: 'x/boards/1103', name: 'AI Hub Board', boardId: 1103 }] }
    })
    await flushPromises()
    expect(wrapper.text()).toContain("hasn't been synced yet")
  })

  it('shows the synced-but-empty state when Jira returns no sprints', async () => {
    getBoardSprints.mockResolvedValue({ synced: true, sprints: [], lastUpdated: '2026-08-17T15:00:00.000Z' })
    const wrapper = mountTab({
      team: { metadata: {} },
      teamId: 'team_1',
      teamDetail: { boards: [{ url: 'x/boards/1103', name: 'AI Hub Board', boardId: 1103 }] }
    })
    await flushPromises()
    expect(wrapper.text()).toContain('No sprints found for this board')
  })
})
