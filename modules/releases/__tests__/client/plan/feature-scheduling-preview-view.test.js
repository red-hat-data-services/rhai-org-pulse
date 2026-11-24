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
import FeatureSchedulingPreview from '../../../client/plan/views/FeatureSchedulingPreview.vue'

function apiFeature(overrides) {
  return Object.assign({
    Key: 'RHAISTRAT-1',
    Summary: 'Feature one',
    Components: ['AI Hub'],
    Team: 'RHOAI AI Hub',
    Priority: 'Major',
    Outcome: 'RHAISTRAT-1339',
    PlannedFor: '3.6 EA1 RHOAI RELEASE',
    Score: 30,
    FPDoR: '17/17',
    'Failed FPDoR Items': '',
    Confidence: 'committed',
    PM: 'Jane PM',
    DeliveryOwner: 'Someone',
    OutcomeNumber: 1
  }, overrides)
}

var SNAPSHOT = {
  features: [
    apiFeature({ Key: 'RHAISTRAT-1', Priority: 'Blocker' }),
    apiFeature({ Key: 'RHAISTRAT-2', PlannedFor: '3.6 ga release', Priority: 'Minor' }),
    apiFeature({ Key: 'RHAISTRAT-3', Components: [], PM: 'Other PM' })
  ],
  metadata: { source: 'live' },
  lastSyncedAt: '2026-11-04T00:00:00.000Z'
}

describe('FeatureSchedulingPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    _resetFeatureSchedulingForTests()
    mockApiRequest.mockResolvedValue(JSON.parse(JSON.stringify(SNAPSHOT)))
  })

  it('loads data on mount and renders one row per scheduled feature', async () => {
    const wrapper = mount(FeatureSchedulingPreview)
    await flushPromises()
    expect(mockApiRequest).toHaveBeenCalledWith('/modules/releases/planning/ai-planner')
    expect(wrapper.findAll('tbody tr').length).toBe(3)
  })

  // Nov 24 2026: Placement summary cards removed (using column order from iframe instead)
  // it('renders placement summary cards that total the full dataset', async () => {
  //   const wrapper = mount(FeatureSchedulingPreview)
  //   await flushPromises()
  //   // RHAISTRAT-1 -> EA1, RHAISTRAT-2 -> GA, RHAISTRAT-3 -> No (no components)
  //   const cardNumbers = wrapper.findAll('.grid > div').map(d => d.find('.text-lg').text())
  //   expect(cardNumbers).toEqual(['1', '0', '1', '1', '0'])
  // })

  it('exports the currently filtered/sorted rows to CSV on Export click (PR #1877)', async () => {
    var capturedBlob = null
    var clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    var createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation(function(blob) {
      capturedBlob = blob
      return 'blob:mock-url'
    })

    const wrapper = mount(FeatureSchedulingPreview)
    await flushPromises()
    const exportBtn = wrapper.findAll('button').find(b => b.text().includes('Export CSV'))
    expect(exportBtn).toBeTruthy()
    await exportBtn.trigger('click')

    expect(clickSpy).toHaveBeenCalled()
    expect(createObjectURLSpy).toHaveBeenCalled()
    const csv = await capturedBlob.text()
    expect(csv.split('\n')[0]).toBe(
      'Rank,Key,Title,FPDoR,Weighted FPDoR,Readiness Issues,Risk,Target Versions,Fix Version,Components,Team,Priority,Confidence,Placement,Confidence%,PM,Outcome'
    )
    expect(csv).toContain('RHAISTRAT-1')

    clickSpy.mockRestore()
    createObjectURLSpy.mockRestore()
  })

  it('toggles sort direction when a sortable header is clicked twice', async () => {
    const wrapper = mount(FeatureSchedulingPreview)
    await flushPromises()
    const keyHeader = wrapper.findAll('th').find(th => th.text().includes('Feature Key'))
    await keyHeader.trigger('click')
    expect(keyHeader.text()).toContain('▲')
    await keyHeader.trigger('click')
    expect(keyHeader.text()).toContain('▼')
  })

  it('narrows the table via the filter bar PM select', async () => {
    const wrapper = mount(FeatureSchedulingPreview)
    await flushPromises()
    expect(wrapper.findAll('tbody tr').length).toBe(3)

    const pmSelect = wrapper.findAll('select').find(s => s.findAll('option').some(o => o.text() === 'Jane PM'))
    await pmSelect.setValue('Jane PM')
    await flushPromises()
    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBe(2)
    expect(rows.map(r => r.text()).join(' ')).not.toContain('RHAISTRAT-3')
  })
})
