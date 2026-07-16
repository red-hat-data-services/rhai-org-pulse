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
        placeReason: 'earliest_fit_component_ceiling',
        capacitySource: 'jira_baseline',
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
        placeReason: 'component_budget_exhausted',
        capacitySource: 'jira_baseline',
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
    email: 'local-dev@redhat.com',
    canImpersonate: true,
    isPlanAdmin: true,
    demoMode: true
  }
}

function mountView() {
  return mount(DraftPlansView, {
    attachTo: document.body,
    global: {
      stubs: {
        Teleport: true
      }
    }
  })
}

describe('DraftPlansView', function() {
  var confirmSpy

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
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(function() {
    confirmSpy.mockRestore()
  })

  it('keeps red-pen controls in the table and details in the drawer', async function() {
    var wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('RHOAI + RHAII 3.6 Draft Plan')
    expect(wrapper.text()).toContain('Acting as')
    expect(wrapper.text()).toContain('RHAISTRAT-1')
    expect(wrapper.text()).toContain('Descope')
    expect(wrapper.text()).toContain('Move…')

    var titleCell = wrapper.findAll('td').find(function(td) {
      return td.text().includes('Below cut feature')
    })
    await titleCell.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Packer / capacity')
    expect(wrapper.text()).toContain('Place reason')
    expect(wrapper.text()).not.toContain('Red-pen actions')
    expect(wrapper.text()).not.toContain('Owner approve')
    wrapper.unmount()
  })

  it('shows capacity dialog on over-ceiling Move from the table', async function() {
    var wrapper = mountView()
    await flushPromises()

    var moveSelect = wrapper.find('select[aria-label="Move RHAISTRAT-2"]')
    expect(moveSelect.exists()).toBe(true)
    await moveSelect.setValue('EA1')
    await flushPromises()

    expect(wrapper.text()).toContain('Over capacity')
    var moveAnyway = wrapper.findAll('button').find(function(b) {
      return b.text() === 'Move anyway'
    })
    await moveAnyway.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Unsaved')
    wrapper.unmount()
  })

  it('freezes EA1 from toolbar', async function() {
    var wrapper = mountView()
    await flushPromises()

    var freezeBtn = wrapper.findAll('button').find(function(b) {
      return b.text() === 'Freeze EA1'
    })
    expect(freezeBtn).toBeTruthy()
    await freezeBtn.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Unfreeze EA1')
    expect(wrapper.text()).toContain('Unsaved')
    wrapper.unmount()
  })

  it('shows empty state when load fails', async function() {
    mockApiRequest.mockImplementation(function(path) {
      if (String(path).indexOf('/cycles') !== -1) {
        return Promise.resolve({
          product: 'RHOAI',
          products: ['RHOAI', 'RHAII'],
          defaultVersion: '3.6',
          cycles: [{ version: '3.6', label: 'RHOAI 3.6', source: 'demo', demoMode: true }]
        })
      }
      return Promise.reject(new Error('boom'))
    })
    var wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('boom')
    expect(wrapper.text()).toContain('No draft plan loaded')
    wrapper.unmount()
  })
})
