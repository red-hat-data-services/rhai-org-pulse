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

import { _resetFeatureSchedulingForTests } from '../../../client/plan/composables/useFeatureScheduling.js'
import RoadmapPreview from '../../../client/plan/views/RoadmapPreview.vue'

function apiFeature(overrides) {
  return Object.assign({
    Key: 'RHAISTRAT-1',
    Summary: 'Feature one',
    Components: ['AI Hub'],
    Priority: 'Major',
    Outcome: 'Upgrade Support',
    PlannedFor: '3.6 EA1 RHOAI RELEASE',
    Score: 30,
    FPDoR: '17/17',
    Confidence: 'committed',
    PM: 'Jane PM',
    DeliveryOwner: 'Someone'
  }, overrides)
}

describe('RoadmapPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    _resetFeatureSchedulingForTests()
    mockApiRequest.mockResolvedValue({
      features: [
        apiFeature({ Key: 'RHAISTRAT-1' }),
        apiFeature({ Key: 'RHAISTRAT-2' }),
        apiFeature({ Key: 'RHAISTRAT-3', Outcome: '', Components: [] })
      ],
      metadata: { source: 'live' },
      lastSyncedAt: null
    })
  })

  it('renders one row per outcome with at least one in-scope feature', async () => {
    const wrapper = mount(RoadmapPreview)
    await flushPromises()
    expect(wrapper.text()).toContain('Upgrade Support')
    expect(wrapper.findAll('tbody tr').length).toBe(1)
  })

  it('shows a drilldown list on cell click, and hides it again on a second click', async () => {
    const wrapper = mount(RoadmapPreview)
    await flushPromises()
    const ea1Cell = wrapper.findAll('td.cursor-pointer')[0]
    await ea1Cell.trigger('click')
    expect(wrapper.text()).toContain('2 features')
    expect(wrapper.text()).toContain('RHAISTRAT-1')

    await ea1Cell.trigger('click')
    expect(wrapper.text()).not.toContain('2 features')
  })
})
