import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('../../../client/services/allocation-api', () => ({
  updateTeamAllocationSettings: vi.fn(),
  updateTeamBoards: vi.fn(),
  getBoardAllSprints: vi.fn(),
  // Real substring logic so preview assertions are meaningful.
  sprintMatchesFilter: (name, filter) => {
    const f = (filter || '').trim().toLowerCase()
    if (!f) return true
    return String(name || '').toLowerCase().includes(f)
  }
}))

const mockTriggerRefresh = vi.fn().mockResolvedValue({ status: 'started' })
vi.mock('../../../client/composables/useAllocationRefresh', () => ({
  useAllocationRefresh: () => ({ refreshing: { value: false }, message: { value: '' }, triggerRefresh: mockTriggerRefresh })
}))

const { updateTeamAllocationSettings, updateTeamBoards, getBoardAllSprints } = await import('../../../client/services/allocation-api')
import AllocationSettingsModal from '../../../client/allocation/AllocationSettingsModal.vue'

function mountModal(currentMode = 'points', extraProps = {}) {
  return mount(AllocationSettingsModal, { props: { teamId: 'team_1', currentMode, ...extraProps } })
}

describe('AllocationSettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateTeamAllocationSettings.mockResolvedValue({ allocationMode: 'counts' })
    updateTeamBoards.mockResolvedValue({ boards: [] })
    getBoardAllSprints.mockResolvedValue({ sprints: [] })
  })

  it('requires an explicit choice on first-time config (no mode pre-selected)', async () => {
    const wrapper = mountModal(null)
    expect(wrapper.find('[data-testid="allocation-settings-firsttime"]').exists()).toBe(true)
    expect(wrapper.get('input[value="points"]').element.checked).toBe(false)
    expect(wrapper.get('input[value="counts"]').element.checked).toBe(false)
    expect(wrapper.get('[data-testid="allocation-settings-save"]').attributes('disabled')).toBeDefined()

    await wrapper.get('input[value="points"]').setValue()
    expect(wrapper.get('[data-testid="allocation-settings-save"]').attributes('disabled')).toBeUndefined()
  })

  it('disables Save until the mode changes', async () => {
    const wrapper = mountModal('points')
    expect(wrapper.get('[data-testid="allocation-settings-save"]').attributes('disabled')).toBeDefined()

    await wrapper.get('input[value="counts"]').setValue()
    expect(wrapper.get('[data-testid="allocation-settings-save"]').attributes('disabled')).toBeUndefined()
  })

  it('persists the new mode, triggers a refresh, and emits saved', async () => {
    const wrapper = mountModal('points')
    await wrapper.get('input[value="counts"]').setValue()
    await wrapper.get('[data-testid="allocation-settings-save"]').trigger('click')
    await flushPromises()

    expect(updateTeamAllocationSettings).toHaveBeenCalledWith('team_1', 'counts')
    expect(mockTriggerRefresh).toHaveBeenCalledWith({ teamId: 'team_1' })
    expect(wrapper.emitted('saved')).toBeTruthy()
    expect(wrapper.emitted('saved')[0]).toEqual([{ allocationMode: 'counts', sprintFilter: '' }])
  })

  it('shows a permission error on 403 and does not emit saved', async () => {
    const err = new Error('forbidden'); err.status = 403
    updateTeamAllocationSettings.mockRejectedValue(err)

    const wrapper = mountModal('points')
    await wrapper.get('input[value="counts"]').setValue()
    await wrapper.get('[data-testid="allocation-settings-save"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="allocation-settings-error"]').text()).toContain("don't have permission")
    expect(wrapper.emitted('saved')).toBeFalsy()
  })

  it('emits close on Cancel', async () => {
    const wrapper = mountModal('points')
    const cancel = wrapper.findAll('button').find(b => b.text() === 'Cancel')
    await cancel.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  // --- Sprint filter section ---
  const BOARD = { boardId: 1103, name: 'AI Hub Board', url: 'x/boards/1103', sprintFilter: '' }
  const SPRINTS = [
    { id: 1, name: 'AI Hub Sprint 26-13', state: 'active' },
    { id: 2, name: 'Other Team Sprint 5', state: 'active' },
    { id: 3, name: 'AI Hub Sprint 26-12', state: 'closed' }
  ]

  it('previews included vs excluded sprints as the filter changes', async () => {
    getBoardAllSprints.mockResolvedValue({ sprints: SPRINTS })
    const wrapper = mountModal('points', { board: BOARD, boards: [BOARD] })
    await flushPromises()

    // No filter → all included
    expect(wrapper.get('[data-testid="sprint-preview-count"]').text()).toContain('3 of 3')

    await wrapper.get('[data-testid="sprint-filter-input"]').setValue('AI Hub')
    expect(wrapper.get('[data-testid="sprint-preview-count"]').text()).toContain('2 of 3')

    // Excluded sprint is struck through
    const rows = wrapper.get('[data-testid="sprint-preview-list"]').findAll('li')
    const other = rows.find(r => r.text().includes('Other Team'))
    expect(other.find('.line-through').exists()).toBe(true)
  })

  it('persists a changed sprint filter via the boards PATCH and refreshes', async () => {
    getBoardAllSprints.mockResolvedValue({ sprints: SPRINTS })
    const wrapper = mountModal('points', { board: BOARD, boards: [BOARD] })
    await flushPromises()

    await wrapper.get('[data-testid="sprint-filter-input"]').setValue('AI Hub')
    await wrapper.get('[data-testid="allocation-settings-save"]').trigger('click')
    await flushPromises()

    expect(updateTeamBoards).toHaveBeenCalledWith('team_1', [{ ...BOARD, sprintFilter: 'AI Hub' }])
    expect(mockTriggerRefresh).toHaveBeenCalledWith({ teamId: 'team_1' })
    expect(wrapper.emitted('saved')[0]).toEqual([{ allocationMode: 'points', sprintFilter: 'AI Hub' }])
  })

  it('does not call the boards PATCH when only the basis changed', async () => {
    getBoardAllSprints.mockResolvedValue({ sprints: SPRINTS })
    const wrapper = mountModal('points', { board: BOARD, boards: [BOARD] })
    await flushPromises()

    await wrapper.get('input[value="counts"]').setValue()
    await wrapper.get('[data-testid="allocation-settings-save"]').trigger('click')
    await flushPromises()

    expect(updateTeamAllocationSettings).toHaveBeenCalledWith('team_1', 'counts')
    expect(updateTeamBoards).not.toHaveBeenCalled()
  })

  it('shows a Kanban notice instead of the filter for kanban boards', async () => {
    getBoardAllSprints.mockResolvedValue({ sprints: [], boardType: 'kanban' })
    const wrapper = mountModal('points', { board: BOARD, boards: [BOARD] })
    await flushPromises()
    expect(wrapper.find('[data-testid="sprint-filter-input"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Kanban board')
  })
})
