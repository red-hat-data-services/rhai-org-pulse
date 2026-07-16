import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'

var mockApiRequest = vi.fn()

vi.mock('@shared/client/services/api', function() {
  return {
    apiRequest: function() {
      return mockApiRequest.apply(null, arguments)
    }
  }
})

import { useDraftPlans, _resetDraftPlansForTests } from '../../../client/plan/composables/useDraftPlans.js'

var FIXTURE = {
  draft: {
    version: '3.6',
    generatedAt: '2026-07-15T00:00:00Z',
    demoMode: true,
    summary: { candidateCount: 2, scheduled: 1, belowCut: 1, byEvent: { EA1: 1, 'Below cut': 1 } },
    candidates: [
      {
        key: 'RHAISTRAT-1',
        summary: 'Scheduled feature',
        basePlacement: 'EA1',
        component: 'KubeRay',
        assignee: 'Alice',
        productFamily: 'RHOAI',
        cycleBudget: 1,
        ready: 'Plan-ready',
        readyBool: true,
        rank: 1
      },
      {
        key: 'RHAISTRAT-2',
        summary: 'Below cut feature',
        basePlacement: 'Below cut',
        component: 'KubeRay',
        assignee: 'Bob',
        productFamily: 'RHOAI',
        cycleBudget: 1,
        ready: 'Not ready',
        readyBool: false,
        rank: 2
      }
    ],
    ceilingsByComponent: { KubeRay: { EA1: 1, EA2: 0, GA: 1 } }
  },
  ceilingsByComponent: { KubeRay: { EA1: 1, EA2: 0, GA: 1 } },
  edits: {},
  meta: {
    planVersion: '3.6',
    currentUser: 'Admin',
    isPlanAdmin: true,
    frozenEvents: {},
    finalGaFrozen: false,
    locked: false
  },
  audit: [],
  session: {
    actor: 'Admin',
    canImpersonate: true,
    isPlanAdmin: true,
    demoMode: true
  }
}

function mountComposable() {
  var api
  mount(
    defineComponent({
      setup: function() {
        api = useDraftPlans()
        return function() {
          return null
        }
      }
    })
  )
  return api
}

describe('useDraftPlans', function() {
  beforeEach(function() {
    vi.clearAllMocks()
    _resetDraftPlansForTests()
    mockApiRequest.mockImplementation(function(path) {
      if (String(path).indexOf('/cycles') !== -1) {
        return Promise.resolve({
          product: 'RHOAI',
          products: ['RHOAI', 'RHAII'],
          defaultVersion: '3.6',
          cycles: [
            {
              version: '3.6',
              product: 'RHOAI',
              label: 'RHOAI 3.6',
              source: 'demo',
              demoMode: true,
              candidateCount: 2
            }
          ]
        })
      }
      return Promise.resolve(JSON.parse(JSON.stringify(FIXTURE)))
    })
  })

  it('loads editor payload into draft and view rows', async function() {
    var api = mountComposable()
    await api.loadEditor('3.6')
    await flushPromises()

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/modules/releases/draft-plans/editor/3.6?product=RHOAI'
    )
    expect(api.draft.value.demoMode).toBe(true)
    expect(api.viewRows.value).toHaveLength(2)
    expect(api.counts.value.EA1).toBe(1)
    expect(api.dirty.value).toBe(false)
  })

  it('loads available cycles and labels both products by default', async function() {
    var api = mountComposable()
    await api.loadCycles('RHOAI')
    await flushPromises()
    expect(api.availableProducts.value).toEqual(['RHOAI', 'RHAII'])
    expect(api.availableCycles.value).toHaveLength(1)
    expect(api.cycleLabel.value).toBe('RHOAI + RHAII 3.6')
    api.setProductFilter('RHAII')
    expect(api.cycleLabel.value).toBe('RHAII 3.6')
  })

  it('filters rows by event and search text', async function() {
    var api = mountComposable()
    await api.loadEditor('3.6')
    await flushPromises()

    api.filterEvent.value = 'Below cut'
    await nextTick()
    expect(api.filteredRows.value).toHaveLength(1)
    expect(api.filteredRows.value[0].key).toBe('RHAISTRAT-2')

    api.filterEvent.value = ''
    api.filterText.value = 'scheduled'
    await nextTick()
    expect(api.filteredRows.value).toHaveLength(1)
    expect(api.filteredRows.value[0].key).toBe('RHAISTRAT-1')
  })

  it('sets pendingCapacity when move would exceed ceiling', async function() {
    var api = mountComposable()
    await api.loadEditor('3.6')
    await flushPromises()

    var result = api.moveFeature('RHAISTRAT-2', 'EA1')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('capacity')
    expect(api.pendingCapacity.value).toBeTruthy()
    expect(api.dirty.value).toBe(false)

    api.confirmCapacityMove()
    expect(api.pendingCapacity.value).toBeNull()
    expect(api.dirty.value).toBe(true)
    expect(api.viewRows.value.find(function(r) { return r.key === 'RHAISTRAT-2' }).event).toBe('EA1')
  })

  it('descopes, freezes EA1, and persists editor state', async function() {
    var api = mountComposable()
    await api.loadEditor('3.6')
    await flushPromises()

    api.descopeFeature('RHAISTRAT-2')
    expect(api.counts.value.Descope).toBe(1)

    api.freeze('EA1')
    expect(api.eventFrozen('EA1')).toBe(true)
    expect(api.viewRows.value.find(function(r) { return r.key === 'RHAISTRAT-1' }).frozen).toBe(true)
    expect(api.dirty.value).toBe(true)

    mockApiRequest.mockResolvedValueOnce({ status: 'saved' })
    await api.persist()
    await flushPromises()

    expect(mockApiRequest).toHaveBeenCalledWith(
      '/modules/releases/draft-plans/editor/3.6?product=RHOAI',
      expect.objectContaining({ method: 'PUT' })
    )
    expect(api.dirty.value).toBe(false)
  })
})
