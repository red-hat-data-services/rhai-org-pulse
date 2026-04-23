import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

// Mock the composable
const mockSyncStatus = {
  syncing: ref(false),
  currentPhase: ref(null),
  phaseLabel: ref(null),
  status: ref(null),
  error: ref(null),
  configDirty: ref(false),
  fetchStatus: vi.fn(),
  triggerSync: vi.fn(),
  markConfigDirty: vi.fn(),
  dismissConfigDirty: vi.fn()
}

vi.mock('../../client/composables/useSyncStatus', () => ({
  useSyncStatus: () => mockSyncStatus
}))

import SyncStatusPanel from '../../client/components/SyncStatusPanel.vue'

describe('SyncStatusPanel', () => {
  beforeEach(() => {
    mockSyncStatus.syncing.value = false
    mockSyncStatus.currentPhase.value = null
    mockSyncStatus.phaseLabel.value = null
    mockSyncStatus.status.value = null
    mockSyncStatus.error.value = null
    mockSyncStatus.configDirty.value = false
    vi.clearAllMocks()
  })

  it('renders sync button with correct label', () => {
    const wrapper = mount(SyncStatusPanel)
    expect(wrapper.text()).toContain('Sync People & Teams')
  })

  it('shows "Syncing..." when syncing is active', () => {
    mockSyncStatus.syncing.value = true
    const wrapper = mount(SyncStatusPanel)
    expect(wrapper.text()).toContain('Syncing...')
  })

  it('shows phase progress during sync', () => {
    mockSyncStatus.syncing.value = true
    mockSyncStatus.currentPhase.value = 'roster'
    mockSyncStatus.phaseLabel.value = 'Syncing people (LDAP + Sheets)...'
    const wrapper = mount(SyncStatusPanel)
    expect(wrapper.text()).toContain('Step 1/2')
    expect(wrapper.text()).toContain('Syncing people (LDAP + Sheets)...')
  })

  it('shows step 2/2 for metadata phase', () => {
    mockSyncStatus.syncing.value = true
    mockSyncStatus.currentPhase.value = 'metadata'
    mockSyncStatus.phaseLabel.value = 'Syncing team metadata...'
    const wrapper = mount(SyncStatusPanel)
    expect(wrapper.text()).toContain('Step 2/2')
  })

  it('shows config dirty banner when configDirty is true', () => {
    mockSyncStatus.configDirty.value = true
    const wrapper = mount(SyncStatusPanel)
    expect(wrapper.text()).toContain('Configuration saved')
    expect(wrapper.text()).toContain('Sync needed')
    expect(wrapper.text()).toContain('Sync Now')
  })

  it('does not show config dirty banner when configDirty is false', () => {
    mockSyncStatus.configDirty.value = false
    const wrapper = mount(SyncStatusPanel)
    expect(wrapper.text()).not.toContain('Configuration saved')
  })

  it('shows staleness badges for stale syncs', () => {
    mockSyncStatus.status.value = {
      rosterSync: { lastSyncAt: new Date(Date.now() - 3 * 86400000).toISOString() },
      metadataSync: { lastSyncAt: null },
      stale: { roster: true, metadata: false }
    }
    const wrapper = mount(SyncStatusPanel)
    expect(wrapper.text()).toContain('Stale')
  })

  it('shows "never" when no sync has occurred', () => {
    mockSyncStatus.status.value = {
      rosterSync: { lastSyncAt: null },
      metadataSync: { lastSyncAt: null },
      stale: { roster: false, metadata: false }
    }
    const wrapper = mount(SyncStatusPanel)
    const text = wrapper.text()
    expect(text).toContain('never')
  })

  it('shows error message when error exists', () => {
    mockSyncStatus.error.value = 'Something went wrong'
    const wrapper = mount(SyncStatusPanel)
    expect(wrapper.text()).toContain('Something went wrong')
  })

  it('disables sync button while syncing', () => {
    mockSyncStatus.syncing.value = true
    const wrapper = mount(SyncStatusPanel)
    const buttons = wrapper.findAll('button')
    const syncBtn = buttons.find(b => b.text().includes('Syncing...'))
    expect(syncBtn.attributes('disabled')).toBeDefined()
  })

  it('calls triggerSync when sync button is clicked', async () => {
    mockSyncStatus.triggerSync.mockResolvedValue()
    const wrapper = mount(SyncStatusPanel)
    const syncBtn = wrapper.findAll('button').find(b => b.text().includes('Sync People & Teams'))
    await syncBtn.trigger('click')
    expect(mockSyncStatus.triggerSync).toHaveBeenCalled()
  })

  it('calls dismissConfigDirty when dismiss button is clicked', async () => {
    mockSyncStatus.configDirty.value = true
    const wrapper = mount(SyncStatusPanel)
    // Find the dismiss X button (last button in the banner)
    const bannerDiv = wrapper.find('.bg-amber-50, [class*="bg-amber"]')
    const dismissBtn = bannerDiv.findAll('button').at(-1)
    await dismissBtn.trigger('click')
    expect(mockSyncStatus.dismissConfigDirty).toHaveBeenCalled()
  })
})
