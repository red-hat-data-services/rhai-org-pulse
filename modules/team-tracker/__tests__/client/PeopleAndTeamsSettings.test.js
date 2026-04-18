import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

// Mock useRosterSync
const mockRosterSync = {
  config: ref(null),
  saving: ref(false),
  syncing: ref(false),
  isConfigured: ref(false),
  fetchConfig: vi.fn(async () => {}),
  saveConfig: vi.fn(async (data) => data),
  discoverSheets: vi.fn(async () => [])
}

vi.mock('../../client/composables/useRosterSync', () => ({
  useRosterSync: () => mockRosterSync
}))

// Mock useOrgRoster
const mockOrgRoster = {
  loadSheetOrgs: vi.fn(async () => ({ sheetOrgs: [] })),
  loadConfiguredOrgs: vi.fn(async () => ({ configuredOrgs: [] })),
  loadConfig: vi.fn(async () => ({ teamBoardsTab: '', orgNameMapping: {} })),
  saveConfig: vi.fn(async () => {})
}

vi.mock('../../client/composables/useOrgRoster', () => ({
  useOrgRoster: () => mockOrgRoster
}))

import PeopleAndTeamsSettings from '../../client/components/PeopleAndTeamsSettings.vue'

describe('PeopleAndTeamsSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRosterSync.config.value = {
      configured: true,
      orgRoots: [{ uid: 'shgriffi', displayName: 'AI Platform' }],
      githubOrgs: ['opendatahub-io'],
      gitlabInstances: [],
      googleSheetId: 'abc123',
      sheetNames: [],
      teamStructure: {
        nameColumn: "Associate's Name",
        teamGroupingColumn: 'Scrum Team Name',
        customFields: []
      }
    }
    mockRosterSync.saving.value = false
  })

  it('renders all sections', async () => {
    const wrapper = mount(PeopleAndTeamsSettings)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Org Roots')
    expect(wrapper.text()).toContain('Google Sheets Integration')
    expect(wrapper.text()).toContain('Column Mappings')
    expect(wrapper.text()).toContain('Custom Fields')
    expect(wrapper.text()).toContain('Username Inference')
    expect(wrapper.text()).toContain('Save Configuration')
  })

  it('renders with config data and populates form after config load', async () => {
    // Set fetchConfig to update the ref, triggering the watcher
    mockRosterSync.fetchConfig.mockImplementation(async () => {
      mockRosterSync.config.value = {
        configured: true,
        orgRoots: [{ uid: 'shgriffi', displayName: 'AI Platform' }],
        githubOrgs: [],
        gitlabInstances: [],
        googleSheetId: '',
        sheetNames: [],
        teamStructure: null
      }
    })
    const wrapper = mount(PeopleAndTeamsSettings)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    await new Promise(r => setTimeout(r, 50))
    await wrapper.vm.$nextTick()

    // Should show the org root inputs
    expect(wrapper.text()).toContain('Kerberos UID')
    expect(wrapper.text()).toContain('Display Name')
  })

  it('disables save when no org roots are configured', async () => {
    mockRosterSync.config.value = null
    mockRosterSync.fetchConfig.mockImplementation(async () => {
      // Leave config as null to simulate unconfigured state
    })

    const wrapper = mount(PeopleAndTeamsSettings)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save Configuration'))
    // With no org roots, the button should be disabled
    expect(saveBtn.attributes('disabled')).toBe('')
  })

  it('emits config-saved with structureAffecting=true when org roots change', async () => {
    mockRosterSync.fetchConfig.mockImplementation(async () => {
      mockRosterSync.config.value = {
        configured: true,
        orgRoots: [{ uid: 'shgriffi', displayName: 'AI Platform' }],
        githubOrgs: [],
        gitlabInstances: [],
        googleSheetId: '',
        sheetNames: [],
        teamStructure: null
      }
    })
    const wrapper = mount(PeopleAndTeamsSettings)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    await new Promise(r => setTimeout(r, 50))
    await wrapper.vm.$nextTick()

    // Modify the uid input
    const inputs = wrapper.findAll('input')
    const uidInput = inputs.find(i => i.element.value === 'shgriffi')
    if (uidInput) {
      await uidInput.setValue('newuid')
    }

    mockRosterSync.saveConfig.mockResolvedValue({})
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save Configuration'))
    await saveBtn.trigger('click')

    await new Promise(r => setTimeout(r, 100))
    await wrapper.vm.$nextTick()

    const events = wrapper.emitted('config-saved')
    expect(events).toBeTruthy()
    expect(events[0][0].structureAffecting).toBe(true)
  })

  it('emits toast on successful save', async () => {
    mockRosterSync.fetchConfig.mockImplementation(async () => {
      mockRosterSync.config.value = {
        configured: true,
        orgRoots: [{ uid: 'test', displayName: 'Test' }],
        githubOrgs: [],
        gitlabInstances: [],
        googleSheetId: '',
        sheetNames: [],
        teamStructure: null
      }
    })
    const wrapper = mount(PeopleAndTeamsSettings)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    await new Promise(r => setTimeout(r, 50))
    await wrapper.vm.$nextTick()

    mockRosterSync.saveConfig.mockResolvedValue({})
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save Configuration'))
    await saveBtn.trigger('click')

    await new Promise(r => setTimeout(r, 100))

    const events = wrapper.emitted('toast')
    expect(events).toBeTruthy()
    expect(events[0][0].type).toBe('success')
  })

  it('shows save error message on failure', async () => {
    mockRosterSync.fetchConfig.mockImplementation(async () => {
      mockRosterSync.config.value = {
        configured: true,
        orgRoots: [{ uid: 'test', displayName: 'Test' }],
        githubOrgs: [],
        gitlabInstances: [],
        googleSheetId: '',
        sheetNames: [],
        teamStructure: null
      }
    })
    const wrapper = mount(PeopleAndTeamsSettings)
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    mockRosterSync.saveConfig.mockRejectedValue(new Error('Network error'))
    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('Save Configuration'))
    await saveBtn.trigger('click')

    await new Promise(r => setTimeout(r, 100))
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Roster sync config save failed')
  })
})
