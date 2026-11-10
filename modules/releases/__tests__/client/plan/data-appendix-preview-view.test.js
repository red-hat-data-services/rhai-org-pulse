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
import DataAppendixPreview from '../../../client/plan/views/DataAppendixPreview.vue'

function apiFeature(overrides) {
  return Object.assign({
    Key: 'RHAISTRAT-1',
    Summary: 'Feature one',
    Components: ['AI Hub'],
    Team: 'RHOAI AI Hub',
    Priority: 'Major',
    PlannedFor: '3.6 EA1 RHOAI RELEASE',
    Score: 30,
    FPDoR: '17/17',
    Confidence: 'committed',
    PM: 'Jane PM',
    DeliveryOwner: 'Someone'
  }, overrides)
}

describe('DataAppendixPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    _resetFeatureSchedulingForTests()
    mockApiRequest.mockResolvedValue({
      features: [
        apiFeature({ Key: 'RHAISTRAT-1' }),
        apiFeature({ Key: 'RHAISTRAT-2', Components: [], PM: '' }) // hard-gated to No
      ],
      metadata: { source: 'live' },
      lastSyncedAt: null
    })
  })

  it('loads data and renders the static reference sections', async () => {
    const wrapper = mount(DataAppendixPreview)
    await flushPromises()
    expect(mockApiRequest).toHaveBeenCalledWith('/modules/releases/planning/ai-planner')
    expect(wrapper.text()).toContain('EA/GA Strategy')
    expect(wrapper.text()).toContain('ML Model')
  })

  it('lists AI Hub in the Component Capacity table with its usage and ceiling', async () => {
    const wrapper = mount(DataAppendixPreview)
    await flushPromises()
    const row = wrapper.findAll('tbody tr').find(r => r.text().startsWith('AI Hub'))
    expect(row).toBeTruthy()
    // CAP['AI Hub'] = {EA1:1, EA2:2, GA:1}; 1 feature in EA1 -> not over ceiling
    expect(row.text()).toContain('✓ OK')
  })

  it('shows the excluded feature in the Exclusion Breakdown table', async () => {
    const wrapper = mount(DataAppendixPreview)
    await flushPromises()
    expect(wrapper.text()).toContain('RHAISTRAT-2')
    expect(wrapper.text()).toContain('Assign a Target Version')
  })
})
