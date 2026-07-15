import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

var mockApiRequest = vi.fn()

vi.mock('@shared/client/services/api', function() {
  return {
    apiRequest: function() {
      return mockApiRequest.apply(null, arguments)
    }
  }
})

import DraftPlansView from '../../../client/plan/views/DraftPlansView.vue'
import { _resetDraftPlansForTests } from '../../../client/plan/composables/useDraftPlans.js'

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
    frozenEvents: {},
    finalGaFrozen: false,
    locked: false
  },
  audit: []
}

function mountView() {
  return mount(DraftPlansView, {
    attachTo: document.body
  })
}

describe('DraftPlansView', function() {
  var confirmSpy

  beforeEach(function() {
    vi.clearAllMocks()
    _resetDraftPlansForTests()
    mockApiRequest.mockResolvedValue(JSON.parse(JSON.stringify(FIXTURE)))
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(function() {
    confirmSpy.mockRestore()
  })

  it('loads demo draft and shows banner + feature keys', async function() {
    var wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Demo fixture')
    expect(wrapper.text()).toContain('RHAISTRAT-1')
    expect(wrapper.text()).toContain('RHAISTRAT-2')
    expect(wrapper.text()).toContain('Draft Plans')
    wrapper.unmount()
  })

  it('shows capacity dialog on over-ceiling Move and confirms override', async function() {
    var wrapper = mountView()
    await flushPromises()

    var row = wrapper.findAll('tbody tr').find(function(tr) {
      return tr.text().includes('RHAISTRAT-2')
    })
    expect(row).toBeTruthy()

    var select = row.find('select')
    await select.setValue('EA1')
    await flushPromises()

    expect(wrapper.text()).toContain('Over capacity')
    var moveAnyway = wrapper.findAll('button').find(function(b) {
      return b.text() === 'Move anyway'
    })
    expect(moveAnyway).toBeTruthy()
    await moveAnyway.trigger('click')
    await flushPromises()

    expect(wrapper.text()).not.toContain('Over capacity')
    expect(wrapper.text()).toContain('Unsaved changes')
    wrapper.unmount()
  })

  it('freezes EA1 from admin controls and marks rows frozen', async function() {
    var wrapper = mountView()
    await flushPromises()

    var freezeBtn = wrapper.findAll('button').find(function(b) {
      return b.text() === 'Freeze EA1'
    })
    expect(freezeBtn).toBeTruthy()
    await freezeBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Unfreeze EA1')
    expect(wrapper.text()).toContain('Unsaved changes')

    var frozenRow = wrapper.findAll('tbody tr').find(function(tr) {
      return tr.text().includes('RHAISTRAT-1')
    })
    expect(frozenRow.classes().join(' ')).toMatch(/opacity-60/)
    wrapper.unmount()
  })

  it('shows empty state when load fails', async function() {
    mockApiRequest.mockRejectedValueOnce(new Error('boom'))
    var wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('boom')
    expect(wrapper.text()).toContain('No draft plan loaded')
    wrapper.unmount()
  })
})
