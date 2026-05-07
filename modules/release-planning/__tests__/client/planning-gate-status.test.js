import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlanningGateStatus from '../../client/components/PlanningGateStatus.vue'

function makeDod(overrides) {
  return Object.assign({
    gate: 'dod',
    passed: true,
    checks: [
      { id: 'DoD-1', label: 'Owner Assigned', passed: true, detail: 'jdoe@redhat.com' },
      { id: 'DoD-2', label: 'Fix Version Set', passed: true, detail: '2.18' },
      { id: 'DoD-3', label: 'Blockers Resolved', passed: true, detail: null }
    ]
  }, overrides)
}

function makeDor(overrides) {
  return Object.assign({
    gate: 'dor',
    passed: true,
    blockers: [
      { id: 'DoR-B1', label: 'Strategy Human Sign-off', passed: true, detail: 'strat-creator-disabled' },
      { id: 'DoR-B2', label: 'RICE Score Present', passed: true, detail: 'rice-disabled' }
    ],
    warnings: []
  }, overrides)
}

describe('PlanningGateStatus', function() {
  it('renders DoD checks with pass icons', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: makeDor(), dod: makeDod(), planningStatus: 'ready-for-execution' }
    })
    expect(wrapper.text()).toContain('Owner Assigned')
    expect(wrapper.text()).toContain('Fix Version Set')
    expect(wrapper.text()).toContain('Blockers Resolved')
  })

  it('shows Ready badge for ready-for-execution status', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: makeDor(), dod: makeDod(), planningStatus: 'ready-for-execution' }
    })
    expect(wrapper.text()).toContain('Ready')
  })

  it('shows In Planning badge for in-planning status', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: makeDor(), dod: makeDod({ passed: false }), planningStatus: 'in-planning' }
    })
    expect(wrapper.text()).toContain('In Planning')
  })

  it('shows Not Ready badge for not-ready status', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: makeDor({ passed: false }), dod: makeDod({ passed: false }), planningStatus: 'not-ready' }
    })
    expect(wrapper.text()).toContain('Not Ready')
  })

  it('shows All checks passed for DoR stub', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: makeDor(), dod: makeDod(), planningStatus: 'ready-for-execution' }
    })
    expect(wrapper.text()).toContain('All checks passed')
  })

  it('shows Blockers not resolved when DoR fails', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: makeDor({ passed: false }), dod: makeDod(), planningStatus: 'not-ready' }
    })
    expect(wrapper.text()).toContain('Blockers not resolved')
  })

  it('shows detail text for failing DoD checks', function() {
    var dod = makeDod({
      passed: false,
      checks: [
        { id: 'DoD-1', label: 'Owner Assigned', passed: false, detail: null },
        { id: 'DoD-2', label: 'Fix Version Set', passed: false, detail: 'No fix version set' },
        { id: 'DoD-3', label: 'Blockers Resolved', passed: true, detail: null }
      ]
    })
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: makeDor(), dod: dod, planningStatus: 'in-planning' }
    })
    expect(wrapper.text()).toContain('No fix version set')
  })

  it('renders with null dod gracefully', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: makeDor(), dod: null, planningStatus: 'in-planning' }
    })
    expect(wrapper.text()).toContain('Planning Status')
  })
})
