/**
 * Tests for AllocationTrackerSettings.vue component.
 * Ported from BoardSettings.spec.js with Firebase auth removed
 * and API calls updated to use the module-prefixed service.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// Mock the API service module
vi.mock('../../client/services/api.js', () => ({
  getProjects: vi.fn().mockResolvedValue({ orgName: 'AI Engineering', projects: [] }),
  getTeams: vi.fn().mockResolvedValue({ teams: [] }),
  saveTeams: vi.fn().mockResolvedValue({ success: true }),
  discoverBoards: vi.fn().mockResolvedValue({ success: true, boardCount: 4 }),
  saveProjects: vi.fn().mockResolvedValue({ success: true })
}))

import AllocationTrackerSettings from '../../client/components/AllocationTrackerSettings.vue'
import { getProjects, getTeams, saveTeams, discoverBoards, saveProjects } from '../../client/services/api.js'

const mockProjects = [
  { key: 'RHOAIENG', name: 'OpenShift AI Engineering', pillar: 'OpenShift AI' },
  { key: 'RHAISTRAT', name: 'AI Strategy', pillar: 'AI Platform' }
]

const mockTeams = [
  { boardId: 1, boardName: 'RHOAIENG - Alpha', displayName: 'Alpha', enabled: true },
  { boardId: 2, boardName: 'RHOAIENG - Beta', displayName: 'Beta', enabled: true },
  { boardId: 3, boardName: 'RHOAIENG - Gamma', displayName: 'Gamma', enabled: false }
]

describe('AllocationTrackerSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getProjects.mockResolvedValue({ orgName: 'AI Engineering', projects: mockProjects })
    getTeams.mockResolvedValue({ teams: mockTeams })
    saveTeams.mockResolvedValue({ success: true })
    discoverBoards.mockResolvedValue({ success: true, boardCount: 4 })
    saveProjects.mockResolvedValue({ success: true })
  })

  describe('Tabs', () => {
    it('renders three tabs: Projects, Boards, and Classification', async () => {
      const wrapper = mount(AllocationTrackerSettings)
      await flushPromises()
      const tabs = wrapper.findAll('[data-testid="settings-tab"]')
      expect(tabs).toHaveLength(3)
      expect(tabs[0].text()).toBe('Projects')
      expect(tabs[1].text()).toBe('Boards')
      expect(tabs[2].text()).toBe('Classification')
    })

    it('shows Projects tab by default', async () => {
      const wrapper = mount(AllocationTrackerSettings)
      await flushPromises()
      expect(wrapper.find('[data-testid="projects-tab-content"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="boards-tab-content"]').exists()).toBe(false)
    })

    it('switches to Boards tab when clicked', async () => {
      const wrapper = mount(AllocationTrackerSettings)
      await flushPromises()
      const tabs = wrapper.findAll('[data-testid="settings-tab"]')
      await tabs[1].trigger('click')
      expect(wrapper.find('[data-testid="projects-tab-content"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="boards-tab-content"]').exists()).toBe(true)
    })
  })

  describe('Projects tab', () => {
    it('displays existing projects', async () => {
      const wrapper = mount(AllocationTrackerSettings)
      await flushPromises()
      expect(wrapper.text()).toContain('RHOAIENG')
      expect(wrapper.text()).toContain('OpenShift AI Engineering')
      expect(wrapper.text()).toContain('OpenShift AI')
      expect(wrapper.text()).toContain('RHAISTRAT')
      expect(wrapper.text()).toContain('AI Strategy')
      expect(wrapper.text()).toContain('AI Platform')
    })

    it('shows Add Project button', async () => {
      const wrapper = mount(AllocationTrackerSettings)
      await flushPromises()
      const addButton = wrapper.find('[data-testid="add-project-btn"]')
      expect(addButton.exists()).toBe(true)
    })

    it('shows inline form when Add Project is clicked', async () => {
      const wrapper = mount(AllocationTrackerSettings)
      await flushPromises()
      await wrapper.find('[data-testid="add-project-btn"]').trigger('click')
      const form = wrapper.find('[data-testid="new-project-form"]')
      expect(form.exists()).toBe(true)
      expect(form.findAll('input')).toHaveLength(3)
    })

    it('validates required fields on add', async () => {
      const wrapper = mount(AllocationTrackerSettings)
      await flushPromises()
      await wrapper.find('[data-testid="add-project-btn"]').trigger('click')
      await wrapper.find('[data-testid="confirm-add-project"]').trigger('click')
      expect(wrapper.find('[data-testid="new-project-form"]').exists()).toBe(true)
    })

    it('adds a new project to the list', async () => {
      const wrapper = mount(AllocationTrackerSettings)
      await flushPromises()
      await wrapper.find('[data-testid="add-project-btn"]').trigger('click')
      const inputs = wrapper.find('[data-testid="new-project-form"]').findAll('input')
      await inputs[0].setValue('NEWPROJ')
      await inputs[1].setValue('New Project')
      await inputs[2].setValue('New Pillar')
      await wrapper.find('[data-testid="confirm-add-project"]').trigger('click')
      expect(wrapper.text()).toContain('NEWPROJ')
      expect(wrapper.text()).toContain('New Project')
      expect(wrapper.text()).toContain('New Pillar')
    })

    it('emits saved event after successful save', async () => {
      const wrapper = mount(AllocationTrackerSettings)
      await flushPromises()
      const saveButton = wrapper.findAll('button').find(b => b.text() === 'Save')
      await saveButton.trigger('click')
      await flushPromises()
      expect(wrapper.emitted('saved')).toBeTruthy()
    })
  })

  describe('Boards tab', () => {
    async function mountAndSwitchToBoards() {
      const wrapper = mount(AllocationTrackerSettings)
      await flushPromises()
      const tabs = wrapper.findAll('[data-testid="settings-tab"]')
      await tabs[1].trigger('click')
      await flushPromises()
      return wrapper
    }

    it('renders the settings title', async () => {
      const wrapper = mount(AllocationTrackerSettings)
      await flushPromises()
      expect(wrapper.text()).toContain('Allocation Tracker Settings')
    })

    it('loads and displays teams on tab switch', async () => {
      const wrapper = await mountAndSwitchToBoards()
      expect(getTeams).toHaveBeenCalled()
      expect(wrapper.text()).toContain('Alpha')
      expect(wrapper.text()).toContain('Beta')
      expect(wrapper.text()).toContain('Gamma')
    })

    it('renders toggle switches for each board', async () => {
      const wrapper = await mountAndSwitchToBoards()
      const toggles = wrapper.findAll('input[type="checkbox"]')
      expect(toggles).toHaveLength(3)
    })

    it('reflects enabled state in toggles', async () => {
      const wrapper = await mountAndSwitchToBoards()
      const toggles = wrapper.findAll('input[type="checkbox"]')
      expect(toggles[0].element.checked).toBe(true)
      expect(toggles[1].element.checked).toBe(true)
      expect(toggles[2].element.checked).toBe(false)
    })

    it('toggles board enabled state when checkbox is clicked', async () => {
      const wrapper = await mountAndSwitchToBoards()
      const toggles = wrapper.findAll('input[type="checkbox"]')
      await toggles[0].setValue(false)
      expect(toggles[0].element.checked).toBe(false)
    })

    it('renders a Save button', async () => {
      const wrapper = await mountAndSwitchToBoards()
      const saveButton = wrapper.findAll('button').find(b => b.text().includes('Save'))
      expect(saveButton.exists()).toBe(true)
    })

    it('calls saveTeams with updated teams on Save click', async () => {
      const wrapper = await mountAndSwitchToBoards()
      const toggles = wrapper.findAll('input[type="checkbox"]')
      await toggles[0].setValue(false)
      const saveButton = wrapper.findAll('button').find(b => b.text().includes('Save'))
      await saveButton.trigger('click')
      await flushPromises()
      expect(saveTeams).toHaveBeenCalled()
      const savedTeams = saveTeams.mock.calls[0][0]
      expect(savedTeams[0].enabled).toBe(false)
      expect(savedTeams[1].enabled).toBe(true)
      expect(savedTeams[2].enabled).toBe(false)
    })

    it('renders a Discover Boards button', async () => {
      const wrapper = await mountAndSwitchToBoards()
      const discoverButton = wrapper.findAll('button').find(b => b.text().includes('Discover'))
      expect(discoverButton.exists()).toBe(true)
    })

    it('calls discover-boards when Discover Boards is clicked', async () => {
      const wrapper = await mountAndSwitchToBoards()
      const discoverButton = wrapper.findAll('button').find(b => b.text().includes('Discover'))
      await discoverButton.trigger('click')
      await flushPromises()
      expect(discoverBoards).toHaveBeenCalled()
    })

    it('shows empty state when no teams exist', async () => {
      getTeams.mockResolvedValue({ teams: [] })
      const wrapper = await mountAndSwitchToBoards()
      expect(wrapper.text()).toContain('No boards found')
      expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
    })

    it('emits saved event after successful save', async () => {
      const wrapper = await mountAndSwitchToBoards()
      const saveButton = wrapper.findAll('button').find(b => b.text().includes('Save'))
      await saveButton.trigger('click')
      await flushPromises()
      expect(wrapper.emitted('saved')).toBeTruthy()
    })
  })
})
