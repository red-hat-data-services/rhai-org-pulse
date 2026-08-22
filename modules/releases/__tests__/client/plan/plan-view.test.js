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

  it('hides Draft Plans tab when access is denied', async function() {
    apiRequest.mockResolvedValue({ canViewDraftPlans: false })
    var wrapper = mountPlanView()
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).not.toContain('Draft Plans')
    expect(apiRequest).toHaveBeenCalledWith('/modules/releases/draft-plans/access')
  })

  it('shows Draft Plans tab when access is allowed', async function() {
    apiRequest.mockResolvedValue({ canViewDraftPlans: true })
    var wrapper = mountPlanView()
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('Draft Plans')
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
