import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import BuiltInModuleSettings from '../components/BuiltInModuleSettings.vue'

const mockGetBuiltInModuleState = vi.fn()
const mockEnableModule = vi.fn()
const mockDisableModule = vi.fn()

vi.mock('../composables/useModuleAdmin', () => ({
  useModuleAdmin: () => ({
    getBuiltInModuleState: mockGetBuiltInModuleState,
    enableModule: mockEnableModule,
    disableModule: mockDisableModule
  })
}))

const sampleModules = {
  modules: [
    {
      slug: 'team-tracker',
      name: 'People & Teams',
      description: 'Delivery metrics',
      icon: 'bar-chart',
      requires: [],
      defaultEnabled: true,
      enabled: true,
      requiredBy: []
    },
    {
      slug: 'release-analysis',
      name: 'Release Analysis',
      description: 'Release tracking',
      icon: 'activity',
      requires: [],
      defaultEnabled: true,
      enabled: true,
      requiredBy: []
    }
  ]
}

describe('BuiltInModuleSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetBuiltInModuleState.mockResolvedValue(sampleModules)
  })

  it('renders module list after loading', async () => {
    const wrapper = mount(BuiltInModuleSettings)
    await flushPromises()
    expect(wrapper.text()).toContain('People & Teams')
    expect(wrapper.text()).toContain('Release Analysis')
  })

  it('shows loading state', () => {
    mockGetBuiltInModuleState.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(BuiltInModuleSettings)
    expect(wrapper.text()).toContain('Loading module state...')
  })

  it('shows error state on fetch failure', async () => {
    mockGetBuiltInModuleState.mockRejectedValue(new Error('Network error'))
    const wrapper = mount(BuiltInModuleSettings)
    await flushPromises()
    expect(wrapper.text()).toContain('Network error')
  })

  it('calls disableModule when toggling off an enabled module', async () => {
    mockDisableModule.mockResolvedValue({ disabled: 'team-tracker' })
    const wrapper = mount(BuiltInModuleSettings)
    await flushPromises()

    const toggleButtons = wrapper.findAll('button[class*="rounded-full"]')
    await toggleButtons[0].trigger('click')
    await flushPromises()

    expect(mockDisableModule).toHaveBeenCalledWith('team-tracker')
  })

  it('calls enableModule when toggling on a disabled module', async () => {
    const disabledModules = {
      modules: [{
        ...sampleModules.modules[0],
        enabled: false
      }, sampleModules.modules[1]]
    }
    mockGetBuiltInModuleState.mockResolvedValue(disabledModules)
    mockEnableModule.mockResolvedValue({ enabled: ['team-tracker'], autoEnabled: [], restartRequired: false })

    const wrapper = mount(BuiltInModuleSettings)
    await flushPromises()

    const toggleButtons = wrapper.findAll('button[class*="rounded-full"]')
    await toggleButtons[0].trigger('click')
    await flushPromises()

    expect(mockEnableModule).toHaveBeenCalledWith('team-tracker')
  })

  it('shows dependency badges', async () => {
    const modulesWithDeps = {
      modules: [{
        ...sampleModules.modules[0],
        requires: ['release-analysis'],
        requiredBy: []
      }, {
        ...sampleModules.modules[1],
        requires: [],
        requiredBy: ['team-tracker']
      }]
    }
    mockGetBuiltInModuleState.mockResolvedValue(modulesWithDeps)
    const wrapper = mount(BuiltInModuleSettings)
    await flushPromises()

    expect(wrapper.text()).toContain('Requires: Release Analysis')
    expect(wrapper.text()).toContain('Required by: People & Teams')
  })

  it('shows confirmation dialog when enabling with unmet deps', async () => {
    const modulesWithDeps = {
      modules: [{
        slug: 'a',
        name: 'Module A',
        description: 'Desc',
        icon: 'box',
        requires: ['b'],
        defaultEnabled: true,
        enabled: false,
        requiredBy: []
      }, {
        slug: 'b',
        name: 'Module B',
        description: 'Desc',
        icon: 'box',
        requires: [],
        defaultEnabled: true,
        enabled: false,
        requiredBy: ['a']
      }]
    }
    mockGetBuiltInModuleState.mockResolvedValue(modulesWithDeps)
    const wrapper = mount(BuiltInModuleSettings)
    await flushPromises()

    // Click enable on Module A (which requires disabled Module B)
    const toggleButtons = wrapper.findAll('button[class*="rounded-full"]')
    await toggleButtons[0].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('will also enable')
    expect(wrapper.text()).toContain('Module B')
  })

  it('shows restart banner when restartRequired is true', async () => {
    const disabledModules = {
      modules: [{
        ...sampleModules.modules[0],
        enabled: false
      }, sampleModules.modules[1]]
    }
    mockGetBuiltInModuleState.mockResolvedValue(disabledModules)
    mockEnableModule.mockResolvedValue({ enabled: ['team-tracker'], autoEnabled: [], restartRequired: true })

    const wrapper = mount(BuiltInModuleSettings)
    await flushPromises()

    const toggleButtons = wrapper.findAll('button[class*="rounded-full"]')
    await toggleButtons[0].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('server restart is required')
  })

  it('shows inline error when disable is blocked', async () => {
    const err = new Error('Cannot disable: required by release-analysis')
    err.status = 400
    mockDisableModule.mockRejectedValue(err)

    const wrapper = mount(BuiltInModuleSettings)
    await flushPromises()

    const toggleButtons = wrapper.findAll('button[class*="rounded-full"]')
    await toggleButtons[0].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Cannot disable')
  })
})
