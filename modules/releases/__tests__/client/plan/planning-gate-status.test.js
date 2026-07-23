import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlanningGateStatus from '../../../client/plan/components/PlanningGateStatus.vue'

function makeFpdor(overrides) {
  return Object.assign({
    passedCount: 10,
    totalCount: 13,
    items: [
      { name: 'Requirements Clarity', pass: true, detail: 'scope >= 2', humanVerified: false },
      { name: 'Acceptance Criteria', pass: true, detail: 'testability >= 2', humanVerified: false },
      { name: 'Scope Defined', pass: true, detail: '3 epics', humanVerified: false },
      { name: 'RICE Score', pass: true, detail: 'riceScore = 42', humanVerified: false },
      { name: 'Cross-functional Engineering', pass: false, detail: 'only 1 eng component', humanVerified: false },
      { name: 'Documentation', pass: true, detail: 'docsRequired Yes', humanVerified: false },
      { name: 'UXD', pass: true, detail: 'UXD component', humanVerified: false },
      { name: 'Architectural Alignment', pass: true, detail: 'architecture >= 2', humanVerified: false },
      { name: 'Risks & Assumptions', pass: true, detail: 'feasibility >= 2', humanVerified: false },
      { name: 'Release Type', pass: true, detail: 'GA', humanVerified: false },
      { name: 'Target Version', pass: false, detail: 'no target version', humanVerified: false },
      { name: 'Assignee', pass: true, detail: 'jdoe@redhat.com', humanVerified: false },
      { name: 'PM Assigned', pass: true, detail: 'pmuser', humanVerified: false }
    ]
  }, overrides)
}

describe('PlanningGateStatus', function() {
  it('shows Ready badge for ready-for-execution status', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { planningStatus: 'ready-for-execution' }
    })
    expect(wrapper.text()).toContain('Ready')
  })

  it('shows In Planning badge for in-planning status', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { planningStatus: 'in-planning' }
    })
    expect(wrapper.text()).toContain('In Planning')
  })

  it('shows Not Ready badge for not-ready status', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { planningStatus: 'not-ready' }
    })
    expect(wrapper.text()).toContain('Not Ready')
  })

  it('renders FPDoR items with pass/fail icons', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { planningStatus: 'in-planning', fpdor: makeFpdor() }
    })
    expect(wrapper.text()).toContain('FPDoR Readiness')
    expect(wrapper.text()).toContain('10/13 passed')
    expect(wrapper.text()).toContain('Requirements Clarity')
    expect(wrapper.text()).toContain('Cross-functional Engineering')
    expect(wrapper.text()).toContain('Target Version')
  })

  it('shows detail text for failing FPDoR items', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { planningStatus: 'in-planning', fpdor: makeFpdor() }
    })
    expect(wrapper.text()).toContain('only 1 eng component')
    expect(wrapper.text()).toContain('no target version')
  })

  it('does not show detail for passing FPDoR items', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { planningStatus: 'ready-for-execution', fpdor: makeFpdor() }
    })
    expect(wrapper.text()).not.toContain('scope >= 2')
  })

  it('shows all-passed count with green styling', function() {
    var fpdor = makeFpdor({
      passedCount: 13,
      items: makeFpdor().items.map(function(item) { return Object.assign({}, item, { pass: true }) })
    })
    var wrapper = mount(PlanningGateStatus, {
      props: { planningStatus: 'ready-for-execution', fpdor: fpdor }
    })
    expect(wrapper.text()).toContain('13/13 passed')
  })

  it('shows humanVerified badge on items with sign-off', function() {
    var fpdor = makeFpdor({
      items: makeFpdor().items.map(function(item) {
        if (item.name === 'Requirements Clarity') {
          return Object.assign({}, item, { humanVerified: true })
        }
        return item
      })
    })
    var wrapper = mount(PlanningGateStatus, {
      props: { planningStatus: 'ready-for-execution', fpdor: fpdor }
    })
    expect(wrapper.text()).toContain('Verified')
  })

  it('does not show humanVerified badge when not set', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { planningStatus: 'ready-for-execution', fpdor: makeFpdor() }
    })
    expect(wrapper.text()).not.toContain('Verified')
  })

  it('renders gracefully with null fpdor', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { planningStatus: 'in-planning', fpdor: null }
    })
    expect(wrapper.text()).toContain('Status')
    expect(wrapper.text()).not.toContain('FPDoR')
  })

  it('renders gracefully with no props', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: {}
    })
    expect(wrapper.text()).toContain('Status')
  })

  it('does not accept dor or dod props', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { planningStatus: 'ready-for-execution' }
    })
    expect(wrapper.text()).not.toContain('Definition of Done')
    expect(wrapper.text()).not.toContain('Definition of Ready')
  })
})
