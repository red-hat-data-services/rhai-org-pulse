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
import ExecutivePreview from '../../../client/plan/views/ExecutivePreview.vue'

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

describe('ExecutivePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    _resetFeatureSchedulingForTests()
    mockApiRequest.mockResolvedValue({
      features: [
        apiFeature({ Key: 'RHAISTRAT-1' }),
        apiFeature({ Key: 'RHAISTRAT-2', PlannedFor: '3.6 ga release' }),
        apiFeature({ Key: 'RHAISTRAT-3', Outcome: '', Components: [] })
      ],
      metadata: { source: 'live' },
      lastSyncedAt: null
    })
  })

  it('loads data and renders the delivery-confidence banner + placement cards', async () => {
    const wrapper = mount(ExecutivePreview)
    await flushPromises()
    expect(mockApiRequest).toHaveBeenCalledWith('/modules/releases/planning/ai-planner')
    expect(wrapper.text()).toContain('EXECUTIVE DELIVERY SUMMARY')
    expect(wrapper.text()).toContain('Delivery Confidence')
    expect(wrapper.text()).toContain('Features In Plan')
  })

  it('lists Upgrade Support in the outcomes table with the right in-plan count', async () => {
    const wrapper = mount(ExecutivePreview)
    await flushPromises()
    const row = wrapper.findAll('tbody tr').find(r => r.text().includes('Upgrade Support'))
    expect(row).toBeTruthy()
    expect(row.text()).toContain('2/2')
  })

  it('narrows the summary when a release is selected, independent of the global placementCounts', async () => {
    const wrapper = mount(ExecutivePreview)
    await flushPromises()
    const before = wrapper.text()
    expect(before).toContain('3')

    const select = wrapper.find('select')
    await select.setValue('3.6 ga release')
    await flushPromises()

    const row = wrapper.findAll('tbody tr').find(r => r.text().includes('Upgrade Support'))
    expect(row.text()).toContain('1/1')
  })

  it('does not render a "CVE load by owner" table (not ported)', async () => {
    const wrapper = mount(ExecutivePreview)
    await flushPromises()
    expect(wrapper.text()).not.toContain('CVE load by owner')
  })
})
