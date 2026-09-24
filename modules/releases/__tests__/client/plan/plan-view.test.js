import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import PlanView from '../../../client/views/PlanView.vue'

vi.mock('@shared/client/services/api', function() {
  return {
    apiRequest: vi.fn()
  }
})

vi.mock('../../../client/plan/views/DashboardView.vue', function() {
  return { default: { name: 'DashboardView', template: '<div>Big Rocks</div>' } }
})
vi.mock('../../../client/plan/views/FeatureReadinessView.vue', function() {
  return { default: { name: 'FeatureReadinessView', template: '<div>Features</div>' } }
})
vi.mock('../../../client/plan/views/DraftPlansView.vue', function() {
  return { default: { name: 'DraftPlansView', template: '<div>Draft Plans Body</div>' } }
})
vi.mock('../../../client/plan/views/BuFeedbackView.vue', function() {
  return { default: { name: 'BuFeedbackView', template: '<div>Feedback</div>' } }
})
vi.mock('../../../client/plan/views/PmHubView.vue', function() {
  return { default: { name: 'PmHubView', template: '<div>PM Hub</div>' } }
})
vi.mock('../../../client/plan/views/AIPlanner.vue', function() {
  return { default: { name: 'AIPlanner', template: '<div data-testid="ai-planner">AI-First Release Planner</div>' } }
})

import { apiRequest } from '@shared/client/services/api'

function mountPlanView(params) {
  var paramsRef = ref(params || {})
  return mount(PlanView, {
    global: {
      provide: {
        moduleNav: {
          params: paramsRef,
          updateParams: vi.fn()
        }
      }
    }
  })
}

describe('PlanView Draft Plans gate', function() {
  beforeEach(function() {
    vi.clearAllMocks()
  })

  afterEach(function() {
    vi.clearAllMocks()
  })

  it('hides Plan Approval tab when access is denied', async function() {
    apiRequest.mockResolvedValue({ canViewDraftPlans: false })
    var wrapper = mountPlanView()
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).not.toContain('Plan Approval')
    expect(apiRequest).toHaveBeenCalledWith('/modules/releases/draft-plans/access')
  })

  it('shows Plan Approval tab when access is allowed', async function() {
    apiRequest.mockResolvedValue({ canViewDraftPlans: true })
    var wrapper = mountPlanView()
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('Plan Approval')
  })

  it('does not deep-link into Draft Plans when gated', async function() {
    apiRequest.mockResolvedValue({ canViewDraftPlans: false })
    var wrapper = mountPlanView({ tab: 'draft-plans' })
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).not.toContain('Draft Plans Body')
    expect(wrapper.text()).toContain('Big Rocks')
  })
})

describe('PlanView AI Planner tab', function() {
  beforeEach(function() {
    vi.clearAllMocks()
  })

  afterEach(function() {
    vi.clearAllMocks()
  })

  it('shows AI Planner tab in nav', async function() {
    apiRequest.mockResolvedValue({ canViewDraftPlans: false })
    var wrapper = mountPlanView()
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('AI Planner')
  })

  it('renders AIPlanner component when ai-planner tab is active', async function() {
    apiRequest.mockResolvedValue({ canViewDraftPlans: false })
    var wrapper = mountPlanView({ tab: 'ai-planner' })
    await flushPromises()
    await nextTick()

    expect(wrapper.find('[data-testid="ai-planner"]').exists()).toBe(true)
  })

  it('switches to AI Planner when tab button is clicked', async function() {
    apiRequest.mockResolvedValue({ canViewDraftPlans: false })
    var wrapper = mountPlanView()
    await flushPromises()
    await nextTick()

    var buttons = wrapper.findAll('button')
    var aiPlannerBtn = buttons.find(function(b) { return b.text() === 'AI Planner' })
    expect(aiPlannerBtn).toBeDefined()

    await aiPlannerBtn.trigger('click')
    await nextTick()

    expect(wrapper.find('[data-testid="ai-planner"]').exists()).toBe(true)
  })
})
