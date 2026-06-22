import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import FeatureBoardWidget from '../../../client/widgets/FeatureBoardWidget.vue'

const mockNavigateTo = vi.fn()

vi.mock('@shared/client/composables/useModuleLink', () => ({
  useModuleLink: () => ({
    navigateTo: mockNavigateTo,
    linkTo: vi.fn()
  })
}))

const mockRfeLoading = ref(false)
vi.mock('../../../client/composables/useAIImpact', () => ({
  useAIImpact: () => ({
    rfeData: ref({ jiraHost: 'https://jira.example.com' }),
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

const mockDefinitions = ref({ personFields: [], teamFields: [] })
vi.mock('@shared/client/composables/useFieldDefinitions', () => ({
  useFieldDefinitions: () => ({
    definitions: mockDefinitions,
    loading: ref(false),
    fetchDefinitions: vi.fn()
  })
}))

const mockWizardSeen = ref(true)
const mockMode = ref('auto')
const mockManualComponents = ref([])
vi.mock('../../../client/composables/useForYouPreferences', () => ({
  useForYouPreferences: () => ({
    mode: mockMode,
    manualComponents: mockManualComponents,
    wizardSeen: mockWizardSeen,
    setMode: vi.fn(),
    setManualComponents: vi.fn(),
    markWizardSeen: vi.fn()
  })
}))

const mockBoardColumns = ref([])
const mockStageFilter = ref('')
const mockPriorityFilter = ref('')
const mockComponentFilter = ref('')
const mockAvailableItemComponents = ref([])
vi.mock('../../../client/composables/useForYou', () => ({
  useForYou: () => ({
    boardColumns: mockBoardColumns,
    stageFilter: mockStageFilter,
    priorityFilter: mockPriorityFilter,
    componentFilter: mockComponentFilter,
    availableItemComponents: mockAvailableItemComponents
  })
}))

// Stub child components
vi.mock('../../../client/components/ForYouSettings.vue', () => ({
  default: { template: '<div class="settings-stub">Settings</div>', props: ['mode', 'manualComponents', 'availableComponents', 'componentsLoading'] }
}))
vi.mock('../../../client/components/ForYouBoardTab.vue', () => ({
  default: { template: '<div class="board-tab-stub">Board Tab</div>', props: ['boardColumns', 'stageFilter', 'priorityFilter', 'stageOptions', 'priorityOptions', 'componentFilter', 'availableItemComponents', 'jiraHost'] }
}))

beforeEach(() => {
  mockRfeLoading.value = false
  mockFeatureLoading.value = false
  mockAssessmentLoading.value = false
  mockWizardSeen.value = true
  mockMode.value = 'auto'
  mockNavigateTo.mockClear()
})

describe('FeatureBoardWidget', () => {
  it('mounts with size prop and renders header', async () => {
    const wrapper = mount(FeatureBoardWidget, { props: { size: 'full' } })
    await flushPromises()
    expect(wrapper.text()).toContain('Feature Board')
  })

  it('accepts half size prop', async () => {
    const wrapper = mount(FeatureBoardWidget, { props: { size: 'half' } })
    await flushPromises()
    expect(wrapper.text()).toContain('Feature Board')
  })

  it('shows loading skeleton when data is loading', async () => {
    mockRfeLoading.value = true
    const wrapper = mount(FeatureBoardWidget, { props: { size: 'full' } })
    await flushPromises()
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('shows setup notice when wizard not seen', async () => {
    mockWizardSeen.value = false
    const wrapper = mount(FeatureBoardWidget, { props: { size: 'full' } })
    await flushPromises()
    expect(wrapper.text()).toContain('Complete setup in')
    expect(wrapper.text()).toContain('RFE Action Items')
  })

  it('hides setup notice when wizard is seen', async () => {
    mockWizardSeen.value = true
    const wrapper = mount(FeatureBoardWidget, { props: { size: 'full' } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('Complete setup in')
  })

  it('renders ForYouBoardTab when loaded', async () => {
    const wrapper = mount(FeatureBoardWidget, { props: { size: 'full' } })
    await flushPromises()
    expect(wrapper.find('.board-tab-stub').exists()).toBe(true)
  })

  it('renders settings gear button', async () => {
    const wrapper = mount(FeatureBoardWidget, { props: { size: 'full' } })
    await flushPromises()
    const settingsBtn = wrapper.find('button[title="Component settings"]')
    expect(settingsBtn.exists()).toBe(true)
  })

  it('toggles settings panel on gear click', async () => {
    const wrapper = mount(FeatureBoardWidget, { props: { size: 'full' } })
    await flushPromises()
    expect(wrapper.find('.settings-stub').exists()).toBe(false)
    await wrapper.find('button[title="Component settings"]').trigger('click')
    expect(wrapper.find('.settings-stub').exists()).toBe(true)
  })
})
