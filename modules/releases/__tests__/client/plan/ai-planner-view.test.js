import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

var mockApiRequest = vi.fn()

vi.mock('@shared/client/services/api', function() {
  return {
    apiRequest: function() {
      return mockApiRequest.apply(null, arguments)
    }
  }
})

import { _resetFeatureSchedulingForTests, useFeatureScheduling } from '../../../client/plan/composables/useFeatureScheduling.js'
import AIPlanner from '../../../client/plan/views/AIPlanner.vue'

function defaultApiResponses(overrides) {
  return Object.assign({
    '/modules/releases/draft-plans/access': { session: { uid: '' } },
    '/modules/releases/planning/ai-planner': {
      features: [{
        Key: 'RHAISTRAT-1', Summary: 'Feature one', Components: ['AI Hub'], Priority: 'Major',
        PlannedFor: '3.6 EA1 RHOAI RELEASE', Score: 30, FPDoR: '17/17', Confidence: 'committed',
        PM: 'Jane PM', DeliveryOwner: 'Someone'
      }],
      metadata: { source: 'live' }
    },
    '/modules/releases/planning/ai-planner/outcomes': { outcomes: [] }
  }, overrides)
}

function mockApi(responses) {
  mockApiRequest.mockImplementation(path => {
    const key = Object.keys(responses).find(k => String(path).indexOf(k) !== -1)
    return Promise.resolve(key ? responses[key] : {})
  })
}

describe('AIPlanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    _resetFeatureSchedulingForTests()
    mockApi(defaultApiResponses())
  })

  it('renders Feature Scheduling by default, with Executive and Roadmap not among the sub-tabs', async () => {
    const wrapper = mount(AIPlanner)
    await flushPromises()
    const tabLabels = wrapper.findAll('button').map(b => b.text())
    expect(tabLabels.some(t => t.includes('Feature Scheduling'))).toBe(true)
    expect(tabLabels.some(t => t.includes('Executive'))).toBe(true)
    expect(tabLabels.some(t => t.includes('Roadmap'))).toBe(false)
    expect(wrapper.text()).toContain('Feature Scheduling')
  })

  it('fetches once per sub-tab on its first visit, and not again on repeat tab switches', async () => {
    const wrapper = mount(AIPlanner)
    await flushPromises()
    const countAiPlannerCalls = () => mockApiRequest.mock.calls.filter(c => String(c[0]).endsWith('/ai-planner')).length
    expect(countAiPlannerCalls()).toBe(1) // FeatureSchedulingPreview's own first-mount fetch

    const featuresTab = wrapper.findAll('button').find(b => b.text().includes('Feature Scheduling'))
    const executiveTab = wrapper.findAll('button').find(b => b.text().includes('Executive'))

    await executiveTab.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('EXECUTIVE DELIVERY SUMMARY')
    // ExecutivePreview's own first mount adds exactly one more -- it isn't
    // latched together with Feature Scheduling's composable singleton instance.
    expect(countAiPlannerCalls()).toBe(2)

    // Switching back and forth again must not trigger further fetches -- both
    // sub-tabs are now latched open (v-if) and only toggled via v-show.
    await featuresTab.trigger('click')
    await executiveTab.trigger('click')
    await flushPromises()
    expect(countAiPlannerCalls()).toBe(2)
  })

  it('opens Architecture and Data Appendix via the hamburger menu, with a working Back button', async () => {
    const wrapper = mount(AIPlanner)
    await flushPromises()

    await wrapper.find('button[title="Architecture & Data Appendix"]').trigger('click')
    const archItem = wrapper.findAll('div').find(d => d.text() === '🏗 Architecture')
    await archItem.trigger('click')
    expect(wrapper.text()).toContain('AI-First Planning Pipeline')
    expect(wrapper.text()).not.toContain('Feature Scheduling')

    const backBtn = wrapper.findAll('button').find(b => b.text().includes('Back to Features'))
    await backBtn.trigger('click')
    expect(wrapper.text()).toContain('Feature Scheduling')

    await wrapper.find('button[title="Architecture & Data Appendix"]').trigger('click')
    const appendixItem = wrapper.findAll('div').find(d => d.text() === '📊 Data Appendix')
    await appendixItem.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('EA/GA Strategy')
  })

  it('resolves the signed-in PM from the session via PM_ACTORS, without a ?user= URL param', async () => {
    mockApi(defaultApiResponses({
      '/modules/releases/draft-plans/access': { session: { uid: 'wcaban' } }
    }))
    mount(AIPlanner)
    await flushPromises()
    const { filters } = useFeatureScheduling()
    expect(filters.value.pm).toBe('William Caban')
    expect(localStorage.getItem('selectedPm')).toBe('William Caban')
  })

  it('falls back to the last localStorage selection when the session actor has no PM mapping', async () => {
    localStorage.setItem('selectedPm', 'Jenny Yi')
    mockApi(defaultApiResponses({
      '/modules/releases/draft-plans/access': { session: { uid: 'someone-unmapped' } }
    }))
    mount(AIPlanner)
    await flushPromises()
    const { filters } = useFeatureScheduling()
    expect(filters.value.pm).toBe('Jenny Yi')
  })

  it('persists a manual PM filter change to localStorage', async () => {
    const wrapper = mount(AIPlanner)
    await flushPromises()
    const { filters } = useFeatureScheduling()
    filters.value = { ...filters.value, pm: 'Naina Singh' }
    await flushPromises()
    expect(localStorage.getItem('selectedPm')).toBe('Naina Singh')
    void wrapper
  })
})
