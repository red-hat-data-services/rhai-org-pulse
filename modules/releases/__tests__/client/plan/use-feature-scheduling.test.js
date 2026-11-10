import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

var mockApiRequest = vi.fn()

vi.mock('@shared/client/services/api', function() {
  return {
    apiRequest: function() {
      return mockApiRequest.apply(null, arguments)
    }
  }
})

import { useFeatureScheduling, _resetFeatureSchedulingForTests } from '../../../client/plan/composables/useFeatureScheduling.js'

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
    Labels: '',
    'Fix Version': '',
    'Release Type': 'GA',
    PM: 'Jane PM',
    DeliveryOwner: 'Someone',
    OutcomeNumber: 1
  }, overrides)
}

var SNAPSHOT = {
  features: [
    apiFeature({ Key: 'RHAISTRAT-1', PM: 'Jane PM' }),
    apiFeature({ Key: 'RHAISTRAT-2', PM: 'Other PM', PlannedFor: '3.6 ga release', Components: ['AI Core Platform'] }),
    apiFeature({ Key: 'RHAISTRAT-3', Components: [], PM: 'Other PM' })
  ],
  metadata: { source: 'live' },
  lastSyncedAt: '2026-11-04T00:00:00.000Z'
}

function mountComposable() {
  var api
  mount(
    defineComponent({
      setup: function() {
        api = useFeatureScheduling()
        return function() { return null }
      }
    })
  )
  return api
}

describe('useFeatureScheduling', function() {
  beforeEach(function() {
    vi.clearAllMocks()
    localStorage.clear()
    _resetFeatureSchedulingForTests()
    mockApiRequest.mockResolvedValue(JSON.parse(JSON.stringify(SNAPSHOT)))
  })

  it('loads and schedules features from GET /modules/releases/planning/ai-planner', async function() {
    var api = mountComposable()
    await api.loadFeatures()
    await flushPromises()

    expect(mockApiRequest).toHaveBeenCalledWith('/modules/releases/planning/ai-planner')
    expect(api.scheduledRows.value).toHaveLength(3)
    // RHAISTRAT-3 has no components -> hard-gated to "No" by schedule()
    var three = api.scheduledRows.value.find(function(r) { return r['Key'] === 'RHAISTRAT-3' })
    expect(three._place).toBe('No')
    expect(api.dataSource.value).toBe('live')
  })

  it('placement counts cover all scheduled rows, ignoring active filters', async function() {
    var api = mountComposable()
    await api.loadFeatures()
    await flushPromises()

    api.filters.value = Object.assign({}, api.filters.value, { pm: 'Jane PM' })
    expect(api.displayRows.value.length).toBeLessThan(api.scheduledRows.value.length)
    var total = api.placementCounts.value.EA1 + api.placementCounts.value.EA2 + api.placementCounts.value.GA + api.placementCounts.value.No
    expect(total).toBe(api.scheduledRows.value.length)
  })

  it('filters displayRows by the live PM field', async function() {
    var api = mountComposable()
    await api.loadFeatures()
    await flushPromises()

    api.filters.value = Object.assign({}, api.filters.value, { pm: 'Jane PM' })
    expect(api.displayRows.value.map(function(r) { return r['Key'] })).toEqual(['RHAISTRAT-1'])
  })

  it('persists approvals to the _feat_approvals localStorage key', async function() {
    var api = mountComposable()
    await api.loadFeatures()
    await flushPromises()

    api.toggleApproval('RHAISTRAT-1', 'pm')
    expect(api.approvals.value['RHAISTRAT-1'].pm).toBe(true)
    expect(JSON.parse(localStorage.getItem('_feat_approvals'))['RHAISTRAT-1'].pm).toBe(true)

    api.toggleApproval('RHAISTRAT-1', 'do')
    expect(api.recommendedCount.value).toBe(1)
  })

  it('setSort toggles direction on repeat clicks and resets on a new column', async function() {
    var api = mountComposable()
    expect(api.sortCol.value).toBe('OutcomeNumber')
    api.setSort('Priority')
    expect(api.sortCol.value).toBe('Priority')
    expect(api.sortAsc.value).toBe(true)
    api.setSort('Priority')
    expect(api.sortAsc.value).toBe(false)
    api.setSort('FPDoR')
    expect(api.sortCol.value).toBe('FPDoR')
    expect(api.sortAsc.value).toBe(true)
  })

  it('computes an urgent PM review rollup and applyUrgentFilter narrows displayRows', async function() {
    var api = mountComposable()
    await api.loadFeatures()
    await flushPromises()

    api.filters.value = Object.assign({}, api.filters.value, { pm: 'Jane PM' })
    expect(api.pmReviewStatus.value.needReviewCount).toBeGreaterThan(0)

    api.toggleApproval('RHAISTRAT-1', 'pm')
    // Now reviewed, so it should no longer be urgent even if risk/confidence would qualify.
    expect(api.pmReviewStatus.value.urgentKeys).not.toContain('RHAISTRAT-1')
  })

  it('aggregates roadmapRows from the BIG_ROCKS fallback and toggles drilldown on repeat clicks', async function() {
    mockApiRequest.mockResolvedValueOnce({
      features: [
        apiFeature({ Key: 'RHAISTRAT-1', Outcome: 'Upgrade Support', PlannedFor: '3.6 EA1 RHOAI RELEASE' }),
        apiFeature({ Key: 'RHAISTRAT-2', Outcome: 'Upgrade Support', PlannedFor: '3.6 EA1 RHOAI RELEASE' })
      ],
      metadata: { source: 'live' },
      lastSyncedAt: null
    })
    var api = mountComposable()
    await api.loadFeatures()
    await flushPromises()

    var row = api.roadmapRows.value.find(function(r) { return r.name === 'Upgrade Support' })
    expect(row).toBeTruthy()
    expect(row.phases.EA1.c).toBe(2)

    expect(api.roadmapDrilldown.value).toBeNull()
    api.showRoadmapDrilldown('Upgrade Support', 'EA1')
    expect(api.roadmapDrilldown.value.feats).toHaveLength(2)
    api.showRoadmapDrilldown('Upgrade Support', 'EA1')
    expect(api.roadmapDrilldown.value).toBeNull()
  })

  it('Executive aggregates (filteredPlacementCounts/deliveryConfidenceSummary/workMix/outcomesStats) honor the active filters', async function() {
    var api = mountComposable()
    await api.loadFeatures()
    await flushPromises()

    // Unfiltered: 3 features -- RHAISTRAT-1 EA1, RHAISTRAT-2 GA, RHAISTRAT-3 No (no components)
    expect(api.filteredPlacementCounts.value).toEqual({ EA1: 1, EA2: 0, GA: 1, No: 1 })
    expect(api.deliveryConfidenceSummary.value.total).toBe(3)
    expect(api.deliveryConfidenceSummary.value.totalInPlan).toBe(2)

    api.filters.value = Object.assign({}, api.filters.value, { pm: 'Jane PM' })
    // Only RHAISTRAT-1 has PM 'Jane PM'
    expect(api.filteredPlacementCounts.value).toEqual({ EA1: 1, EA2: 0, GA: 0, No: 0 })
    expect(api.deliveryConfidenceSummary.value.total).toBe(1)

    var mix = api.workMix.value
    expect(mix.map(function(m) { return m.key })).toEqual(['features', 'bugs', 'research'])

    expect(api.outcomesStats.value.stats).toBeTruthy()
    // placementCounts (Feature Scheduling's own cards) stays global regardless of filters
    expect(api.placementCounts.value).toEqual({ EA1: 1, EA2: 0, GA: 1, No: 1 })
  })
})
