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

  it('falls back to the BIG_ROCKS outcomes table when the live outcomes API returns nothing', async () => {
    // The generic mock above has no .outcomes key, so loadOutcomes() leaves liveOutcomes null.
    const wrapper = mount(ExecutivePreview)
    await flushPromises()
    const row = wrapper.findAll('tbody tr').find(r => r.text().includes('Upgrade Support'))
    expect(row).toBeTruthy()
    expect(row.text()).toContain('2/2')
  })

  it('narrows the fallback summary when a release is selected, independent of the global placementCounts', async () => {
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

  it('sources the outcomes table from the live API when it returns a non-empty list', async () => {
    mockApiRequest.mockImplementation(path => {
      if (String(path).indexOf('/outcomes') !== -1) {
        return Promise.resolve({
          outcomes: [
            { key: 'RHAISTRAT-3004', title: 'Live Outcome', outcomeNumber: 1, inPlan: 1, total: 2, percentComplete: 50, confidence: 72, status: 'Confident', linkedVersions: ['3.6 EA1 RHOAI RELEASE'] }
          ]
        })
      }
      return Promise.resolve({
        features: [{
          Key: 'RHAISTRAT-1', Summary: 'Feature one', Components: ['AI Hub'], Priority: 'Major',
          PlannedFor: '3.6 EA1 RHOAI RELEASE', Score: 30, FPDoR: '17/17', Confidence: 'committed',
          PM: 'Jane PM', DeliveryOwner: 'Someone'
        }],
        metadata: { source: 'live' }
      })
    })

    const wrapper = mount(ExecutivePreview)
    await flushPromises()

    expect(wrapper.text()).toContain('RHAISTRAT-3004')
    expect(wrapper.text()).toContain('Live Outcome')
    expect(wrapper.text()).toContain('1 of 1 ranked, from Jira plan view 7384')
    expect(wrapper.text()).not.toContain('Upgrade Support') // BIG_ROCKS fallback table not shown
  })

  it('filters the live outcomes table by the selected release (linkedVersions substring match)', async () => {
    mockApiRequest.mockImplementation(path => {
      if (String(path).indexOf('/outcomes') !== -1) {
        return Promise.resolve({
          outcomes: [
            { key: 'RHAISTRAT-1', title: 'EA1 Outcome', outcomeNumber: 1, inPlan: 0, total: 0, percentComplete: 0, confidence: 0, status: 'No features in plan', linkedVersions: ['3.6 EA1 RHOAI RELEASE'] },
            { key: 'RHAISTRAT-2', title: 'GA Outcome', outcomeNumber: 2, inPlan: 0, total: 0, percentComplete: 0, confidence: 0, status: 'No features in plan', linkedVersions: ['3.6 GA RHOAI RELEASE'] }
          ]
        })
      }
      return Promise.resolve({
        features: [{
          Key: 'RHAISTRAT-1', Summary: 'Feature one', Components: ['AI Hub'], Priority: 'Major',
          PlannedFor: '3.6 EA1 RHOAI RELEASE', Score: 30, FPDoR: '17/17', Confidence: 'committed',
          PM: 'Jane PM', DeliveryOwner: 'Someone'
        }],
        metadata: { source: 'live' }
      })
    })

    const wrapper = mount(ExecutivePreview)
    await flushPromises()
    expect(wrapper.text()).toContain('EA1 Outcome')
    expect(wrapper.text()).toContain('GA Outcome')

    const select = wrapper.find('select')
    await select.setValue('3.6 EA1 RHOAI RELEASE')
    await flushPromises()
    expect(wrapper.text()).toContain('EA1 Outcome')
    expect(wrapper.text()).not.toContain('GA Outcome')
  })
})
