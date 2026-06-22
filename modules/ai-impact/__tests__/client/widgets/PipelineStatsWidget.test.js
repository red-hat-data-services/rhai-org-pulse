import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import PipelineStatsWidget from '../../../client/widgets/PipelineStatsWidget.vue'

const mockRfeLoading = ref(false)
vi.mock('../../../client/composables/useAIImpact', () => ({
  useAIImpact: () => ({
    rfeData: ref(null),
    loading: mockRfeLoading,
    load: vi.fn()
  })
}))

const mockFeatureLoading = ref(false)
vi.mock('../../../client/composables/useFeatures', () => ({
  useFeatures: () => ({
    features: ref({}),
    featureLoading: mockFeatureLoading,
    loadFeatures: vi.fn()
  })
}))

const mockAssessmentLoading = ref(false)
vi.mock('../../../client/composables/useAssessments', () => ({
  useAssessments: () => ({
    assessments: ref({}),
    assessmentLoading: mockAssessmentLoading,
    loadAssessments: vi.fn()
  })
}))

const mockStats = ref({ reviseRfes: 3, reviewFeatures: 5, queuedForStrat: 2, signedOffFeatures: 8 })
vi.mock('../../../client/composables/useForYou', () => ({
  useForYou: () => ({
    stats: mockStats
  })
}))

const mockMode = ref('auto')
const mockManualComponents = ref([])
const mockSetMode = vi.fn()
const mockSetManualComponents = vi.fn()
vi.mock('../../../client/composables/useForYouPreferences', () => ({
  useForYouPreferences: () => ({
    mode: mockMode,
    manualComponents: mockManualComponents,
    setMode: mockSetMode,
    setManualComponents: mockSetManualComponents
  })
}))

const mockDefinitions = ref({ personFields: [] })
vi.mock('@shared/client/composables/useFieldDefinitions', () => ({
  useFieldDefinitions: () => ({
    definitions: mockDefinitions,
    loading: ref(false),
    fetchDefinitions: vi.fn()
  })
}))

vi.mock('../../../client/components/ForYouSettings.vue', () => ({
  default: { template: '<div class="settings-stub">Settings</div>', props: ['mode', 'manualComponents', 'availableComponents', 'componentsLoading'] }
}))

beforeEach(() => {
  mockRfeLoading.value = false
  mockFeatureLoading.value = false
  mockAssessmentLoading.value = false
  mockStats.value = { reviseRfes: 3, reviewFeatures: 5, queuedForStrat: 2, signedOffFeatures: 8 }
  mockMode.value = 'auto'
  mockManualComponents.value = []
  mockSetMode.mockClear()
  mockSetManualComponents.mockClear()
})

describe('PipelineStatsWidget', () => {
  it('mounts with size prop and renders header', async () => {
    const wrapper = mount(PipelineStatsWidget, { props: { size: 'half' } })
    await flushPromises()
    expect(wrapper.text()).toContain('Pipeline Stats')
  })

  it('accepts full size prop', async () => {
    const wrapper = mount(PipelineStatsWidget, { props: { size: 'full' } })
    await flushPromises()
    expect(wrapper.text()).toContain('Pipeline Stats')
  })

  it('shows loading skeleton when data is loading', async () => {
    mockRfeLoading.value = true
    const wrapper = mount(PipelineStatsWidget, { props: { size: 'half' } })
    await flushPromises()
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders four stat cards with correct values', async () => {
    const wrapper = mount(PipelineStatsWidget, { props: { size: 'half' } })
    await flushPromises()
    expect(wrapper.text()).toContain('RFEs to Revise')
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('Features to Review')
    expect(wrapper.text()).toContain('5')
    expect(wrapper.text()).toContain('Ready for Strategy')
    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('Signed Off')
    expect(wrapper.text()).toContain('8')
  })

  it('renders stat cards in 2-column grid', async () => {
    const wrapper = mount(PipelineStatsWidget, { props: { size: 'half' } })
    await flushPromises()
    const grid = wrapper.find('.grid.grid-cols-2')
    expect(grid.exists()).toBe(true)
  })

  it('updates when stats change', async () => {
    const wrapper = mount(PipelineStatsWidget, { props: { size: 'half' } })
    await flushPromises()
    expect(wrapper.text()).toContain('3')
    mockStats.value = { reviseRfes: 10, reviewFeatures: 0, queuedForStrat: 0, signedOffFeatures: 0 }
    await flushPromises()
    expect(wrapper.text()).toContain('10')
  })

  it('applies color-coded classes to stat cards', async () => {
    const wrapper = mount(PipelineStatsWidget, { props: { size: 'half' } })
    await flushPromises()
    const cards = wrapper.findAll('.rounded-lg.border.p-3')
    expect(cards.length).toBe(4)
    expect(cards[0].classes().some(c => c.includes('red'))).toBe(true)
    expect(cards[1].classes().some(c => c.includes('amber'))).toBe(true)
    expect(cards[2].classes().some(c => c.includes('blue'))).toBe(true)
    expect(cards[3].classes().some(c => c.includes('green'))).toBe(true)
  })

  it('renders settings gear button', async () => {
    const wrapper = mount(PipelineStatsWidget, { props: { size: 'half' } })
    await flushPromises()
    const settingsBtn = wrapper.find('button[title="Component settings"]')
    expect(settingsBtn.exists()).toBe(true)
  })

  it('toggles settings panel on gear click', async () => {
    const wrapper = mount(PipelineStatsWidget, { props: { size: 'half' } })
    await flushPromises()
    expect(wrapper.find('.settings-stub').exists()).toBe(false)
    const settingsBtn = wrapper.find('button[title="Component settings"]')
    await settingsBtn.trigger('click')
    expect(wrapper.find('.settings-stub').exists()).toBe(true)
  })
})
