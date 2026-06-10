import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlanningGateStatus from '../../../client/plan/components/PlanningGateStatus.vue'

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
    warnings: [
      { id: 'DoR-W1', label: 'Owner Assigned', passed: true, detail: 'jdoe@redhat.com' },
      { id: 'DoR-W2', label: 'Version Set', passed: true, detail: '2.18' },
      { id: 'DoR-W3', label: 'Blockers Resolved', passed: true, detail: null }
    ]
  }, overrides)
}

describe('PlanningGateStatus', function() {
  // ─── Planning Status Badge ───

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

  // ─── DoD Checks ───

  it('renders DoD checks with pass icons', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: makeDor(), dod: makeDod(), planningStatus: 'ready-for-execution' }
    })
    expect(wrapper.text()).toContain('Definition of Done')
    expect(wrapper.text()).toContain('Owner Assigned')
    expect(wrapper.text()).toContain('Fix Version Set')
    expect(wrapper.text()).toContain('Blockers Resolved')
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
    expect(wrapper.text()).toContain('Status')
  })

  // ─── DoR Blockers ───

  it('hides blocker section when both blockers are disabled', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: makeDor(), dod: makeDod(), planningStatus: 'ready-for-execution' }
    })
    expect(wrapper.text()).not.toContain('Definition of Ready — Blockers')
  })

  it('shows blocker section when strat-creator is enabled', function() {
    var dor = makeDor({
      passed: true,
      blockers: [
        { id: 'DoR-B1', label: 'Strategy Human Sign-off', passed: true, detail: 'human-sign-off' },
        { id: 'DoR-B2', label: 'RICE Score Present', passed: true, detail: 'rice-disabled' }
      ]
    })
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: dor, dod: makeDod(), planningStatus: 'ready-for-execution' }
    })
    expect(wrapper.text()).toContain('Definition of Ready — Blockers')
    expect(wrapper.text()).toContain('Strategy Human Sign-off')
  })

  it('shows strat-creator badge with Signed Off label', function() {
    var dor = makeDor({
      blockers: [
        { id: 'DoR-B1', label: 'Strategy Human Sign-off', passed: true, detail: 'human-sign-off' },
        { id: 'DoR-B2', label: 'RICE Score Present', passed: true, detail: 'rice-disabled' }
      ]
    })
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: dor, dod: makeDod(), planningStatus: 'ready-for-execution' }
    })
    expect(wrapper.text()).toContain('Signed Off')
  })

  it('shows strat-creator badge with Needs Attention label', function() {
    var dor = makeDor({
      passed: false,
      blockers: [
        { id: 'DoR-B1', label: 'Strategy Human Sign-off', passed: false, detail: 'needs-attention' },
        { id: 'DoR-B2', label: 'RICE Score Present', passed: true, detail: 'rice-disabled' }
      ]
    })
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: dor, dod: makeDod(), planningStatus: 'not-ready' }
    })
    expect(wrapper.text()).toContain('Needs Attention')
  })

  it('shows RICE blocker when enabled', function() {
    var dor = makeDor({
      blockers: [
        { id: 'DoR-B1', label: 'Strategy Human Sign-off', passed: true, detail: 'strat-creator-disabled' },
        { id: 'DoR-B2', label: 'RICE Score Present', passed: true, detail: 'complete' }
      ]
    })
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: dor, dod: makeDod(), planningStatus: 'ready-for-execution' }
    })
    expect(wrapper.text()).toContain('RICE Score Present')
  })

  it('shows missing detail for failing RICE blocker', function() {
    var dor = makeDor({
      passed: false,
      blockers: [
        { id: 'DoR-B1', label: 'Strategy Human Sign-off', passed: true, detail: 'strat-creator-disabled' },
        { id: 'DoR-B2', label: 'RICE Score Present', passed: false, detail: 'missing' }
      ]
    })
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: dor, dod: makeDod(), planningStatus: 'not-ready' }
    })
    expect(wrapper.text()).toContain('missing')
  })

  // ─── DoR Warnings ───

  it('shows warning section with warnings', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: makeDor(), dod: makeDod(), planningStatus: 'ready-for-execution' }
    })
    expect(wrapper.text()).toContain('Definition of Ready — Warnings')
  })

  it('shows failed warning count', function() {
    var dor = makeDor({
      warnings: [
        { id: 'DoR-W1', label: 'Owner Assigned', passed: false, detail: null },
        { id: 'DoR-W2', label: 'Version Set', passed: false, detail: 'No fixVersion or targetVersion' },
        { id: 'DoR-W3', label: 'Blockers Resolved', passed: true, detail: null }
      ]
    })
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: dor, dod: makeDod(), planningStatus: 'ready-for-execution' }
    })
    expect(wrapper.text()).toContain('(2)')
  })

  it('shows warning detail for failing warnings', function() {
    var dor = makeDor({
      warnings: [
        { id: 'DoR-W1', label: 'Owner Assigned', passed: true, detail: 'jdoe@redhat.com' },
        { id: 'DoR-W2', label: 'Version Set', passed: false, detail: 'No fixVersion or targetVersion' },
        { id: 'DoR-W3', label: 'Blockers Resolved', passed: true, detail: null }
      ]
    })
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: dor, dod: makeDod(), planningStatus: 'ready-for-execution' }
    })
    expect(wrapper.text()).toContain('No fixVersion or targetVersion')
  })

  it('shows escalation indicator on W3', function() {
    var dor = makeDor({
      warnings: [
        { id: 'DoR-W1', label: 'Owner Assigned', passed: true, detail: 'jdoe@redhat.com' },
        { id: 'DoR-W2', label: 'Version Set', passed: true, detail: '2.18' },
        { id: 'DoR-W3', label: 'Blockers Resolved', passed: false, detail: 'RHAISTRAT-200', escalated: true }
      ]
    })
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: dor, dod: makeDod(), planningStatus: 'ready-for-execution' }
    })
    expect(wrapper.text()).toContain('escalated')
  })

  it('does not show escalation indicator when not escalated', function() {
    var dor = makeDor({
      warnings: [
        { id: 'DoR-W1', label: 'Owner Assigned', passed: true, detail: 'jdoe@redhat.com' },
        { id: 'DoR-W2', label: 'Version Set', passed: true, detail: '2.18' },
        { id: 'DoR-W3', label: 'Blockers Resolved', passed: false, detail: 'RHAISTRAT-200' }
      ]
    })
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: dor, dod: makeDod(), planningStatus: 'ready-for-execution' }
    })
    expect(wrapper.text()).not.toContain('escalated')
  })

  // ─── Edge cases ───

  it('renders with null dor gracefully', function() {
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: null, dod: makeDod(), planningStatus: 'in-planning' }
    })
    expect(wrapper.text()).toContain('Status')
    expect(wrapper.text()).not.toContain('Definition of Ready')
  })

  it('hides warning section when dor has no warnings', function() {
    var dor = makeDor({ warnings: [] })
    var wrapper = mount(PlanningGateStatus, {
      props: { dor: dor, dod: makeDod(), planningStatus: 'ready-for-execution' }
    })
    expect(wrapper.text()).not.toContain('Definition of Ready — Warnings')
  })
})
