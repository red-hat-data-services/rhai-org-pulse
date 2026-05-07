import { describe, it, expect } from 'vitest'

const {
  computeDoD,
  computeDoR,
  derivePlanningStatus,
  PLANNING_STATUS_ORDER
} = require('../../server/health/planning-gates')

function makeFeature(overrides) {
  return Object.assign({
    key: 'RHAISTRAT-100',
    deliveryOwner: 'jdoe@redhat.com',
    assignee: null,
    fixVersions: ['2.18'],
    targetVersions: ['2.18'],
    status: 'In Progress'
  }, overrides)
}

function makeEnrichment(overrides) {
  return Object.assign({
    dependencyLinks: []
  }, overrides)
}

function blockerLink(key, status) {
  return { direction: 'inward', type: 'Blocks', linkedKey: key, linkedStatus: status || 'In Progress' }
}

// ─── computeDoD ───

describe('computeDoD', function() {
  it('returns gate: dod', function() {
    var result = computeDoD(makeFeature(), makeEnrichment())
    expect(result.gate).toBe('dod')
  })

  it('passes when all checks pass', function() {
    var result = computeDoD(makeFeature(), makeEnrichment())
    expect(result.passed).toBe(true)
    expect(result.checks).toHaveLength(3)
    expect(result.checks.every(function(c) { return c.passed })).toBe(true)
  })

  it('fails DoD-1 when no owner', function() {
    var result = computeDoD(makeFeature({ deliveryOwner: null, assignee: null }), makeEnrichment())
    expect(result.passed).toBe(false)
    var check = result.checks.find(function(c) { return c.id === 'DoD-1' })
    expect(check.passed).toBe(false)
    expect(check.detail).toBeNull()
  })

  it('passes DoD-1 with deliveryOwner', function() {
    var result = computeDoD(makeFeature({ deliveryOwner: 'owner@redhat.com', assignee: null }), makeEnrichment())
    var check = result.checks.find(function(c) { return c.id === 'DoD-1' })
    expect(check.passed).toBe(true)
    expect(check.detail).toBe('owner@redhat.com')
  })

  it('passes DoD-1 with assignee when no deliveryOwner', function() {
    var result = computeDoD(makeFeature({ deliveryOwner: null, assignee: 'assignee@redhat.com' }), makeEnrichment())
    var check = result.checks.find(function(c) { return c.id === 'DoD-1' })
    expect(check.passed).toBe(true)
    expect(check.detail).toBe('assignee@redhat.com')
  })

  it('fails DoD-2 when no fixVersions', function() {
    var result = computeDoD(makeFeature({ fixVersions: [] }), makeEnrichment())
    expect(result.passed).toBe(false)
    var check = result.checks.find(function(c) { return c.id === 'DoD-2' })
    expect(check.passed).toBe(false)
    expect(check.detail).toBe('No fix version set')
  })

  it('fails DoD-2 when fixVersions is missing', function() {
    var f = makeFeature()
    delete f.fixVersions
    var result = computeDoD(f, makeEnrichment())
    var check = result.checks.find(function(c) { return c.id === 'DoD-2' })
    expect(check.passed).toBe(false)
  })

  it('passes DoD-2 with fixVersions', function() {
    var result = computeDoD(makeFeature({ fixVersions: ['2.18', '2.19'] }), makeEnrichment())
    var check = result.checks.find(function(c) { return c.id === 'DoD-2' })
    expect(check.passed).toBe(true)
    expect(check.detail).toBe('2.18, 2.19')
  })

  it('fails DoD-3 when unresolved blockers exist', function() {
    var enrichment = makeEnrichment({
      dependencyLinks: [
        blockerLink('RHAISTRAT-200'),
        blockerLink('RHAISTRAT-201')
      ]
    })
    var result = computeDoD(makeFeature(), enrichment)
    expect(result.passed).toBe(false)
    var check = result.checks.find(function(c) { return c.id === 'DoD-3' })
    expect(check.passed).toBe(false)
    expect(check.detail).toBe('RHAISTRAT-200, RHAISTRAT-201')
  })

  it('passes DoD-3 when blockers are closed', function() {
    var enrichment = makeEnrichment({
      dependencyLinks: [blockerLink('RHAISTRAT-200', 'Closed')]
    })
    var result = computeDoD(makeFeature(), enrichment)
    var check = result.checks.find(function(c) { return c.id === 'DoD-3' })
    expect(check.passed).toBe(true)
    expect(check.detail).toBeNull()
  })

  it('ignores outward links', function() {
    var enrichment = makeEnrichment({
      dependencyLinks: [{ direction: 'outward', type: 'Blocks', linkedKey: 'X-1', linkedStatus: 'In Progress' }]
    })
    var result = computeDoD(makeFeature(), enrichment)
    var check = result.checks.find(function(c) { return c.id === 'DoD-3' })
    expect(check.passed).toBe(true)
  })

  it('handles null enrichment', function() {
    var result = computeDoD(makeFeature(), null)
    expect(result.passed).toBe(true)
    var check = result.checks.find(function(c) { return c.id === 'DoD-3' })
    expect(check.passed).toBe(true)
  })

  it('all checks have correct ids and labels', function() {
    var result = computeDoD(makeFeature(), makeEnrichment())
    expect(result.checks[0].id).toBe('DoD-1')
    expect(result.checks[0].label).toBe('Owner Assigned')
    expect(result.checks[1].id).toBe('DoD-2')
    expect(result.checks[1].label).toBe('Fix Version Set')
    expect(result.checks[2].id).toBe('DoD-3')
    expect(result.checks[2].label).toBe('Blockers Resolved')
  })
})

// ─── computeDoR (stub) ───

describe('computeDoR', function() {
  it('returns gate: dor', function() {
    var result = computeDoR(makeFeature(), makeEnrichment())
    expect(result.gate).toBe('dor')
  })

  it('always passes (stub)', function() {
    var result = computeDoR(makeFeature({ deliveryOwner: null, assignee: null, fixVersions: [], targetVersions: [] }), null)
    expect(result.passed).toBe(true)
  })

  it('has two blockers that always pass', function() {
    var result = computeDoR(makeFeature(), makeEnrichment())
    expect(result.blockers).toHaveLength(2)
    expect(result.blockers[0]).toEqual({ id: 'DoR-B1', label: 'Strategy Human Sign-off', passed: true, detail: 'strat-creator-disabled' })
    expect(result.blockers[1]).toEqual({ id: 'DoR-B2', label: 'RICE Score Present', passed: true, detail: 'rice-disabled' })
  })

  it('has three warnings that evaluate conditions', function() {
    var result = computeDoR(makeFeature(), makeEnrichment())
    expect(result.warnings).toHaveLength(3)
    expect(result.warnings[0].id).toBe('DoR-W1')
    expect(result.warnings[1].id).toBe('DoR-W2')
    expect(result.warnings[2].id).toBe('DoR-W3')
  })

  it('warning W1 fails when no owner', function() {
    var result = computeDoR(makeFeature({ deliveryOwner: null, assignee: null }), makeEnrichment())
    var w1 = result.warnings.find(function(w) { return w.id === 'DoR-W1' })
    expect(w1.passed).toBe(false)
    expect(w1.detail).toBeNull()
  })

  it('warning W1 passes with owner', function() {
    var result = computeDoR(makeFeature({ deliveryOwner: 'jdoe@redhat.com' }), makeEnrichment())
    var w1 = result.warnings.find(function(w) { return w.id === 'DoR-W1' })
    expect(w1.passed).toBe(true)
    expect(w1.detail).toBe('jdoe@redhat.com')
  })

  it('warning W2 passes with fixVersion only', function() {
    var result = computeDoR(makeFeature({ fixVersions: ['2.18'], targetVersions: [] }), makeEnrichment())
    var w2 = result.warnings.find(function(w) { return w.id === 'DoR-W2' })
    expect(w2.passed).toBe(true)
  })

  it('warning W2 passes with targetVersion only', function() {
    var result = computeDoR(makeFeature({ fixVersions: [], targetVersions: ['2.18'] }), makeEnrichment())
    var w2 = result.warnings.find(function(w) { return w.id === 'DoR-W2' })
    expect(w2.passed).toBe(true)
  })

  it('warning W2 fails when no versions', function() {
    var result = computeDoR(makeFeature({ fixVersions: [], targetVersions: [] }), makeEnrichment())
    var w2 = result.warnings.find(function(w) { return w.id === 'DoR-W2' })
    expect(w2.passed).toBe(false)
    expect(w2.detail).toBe('No fixVersion or targetVersion')
  })

  it('warning W3 fails with unresolved blockers', function() {
    var enrichment = makeEnrichment({ dependencyLinks: [blockerLink('RHAISTRAT-300')] })
    var result = computeDoR(makeFeature(), enrichment)
    var w3 = result.warnings.find(function(w) { return w.id === 'DoR-W3' })
    expect(w3.passed).toBe(false)
    expect(w3.detail).toBe('RHAISTRAT-300')
  })

  it('warning W3 passes with no blockers', function() {
    var result = computeDoR(makeFeature(), makeEnrichment())
    var w3 = result.warnings.find(function(w) { return w.id === 'DoR-W3' })
    expect(w3.passed).toBe(true)
    expect(w3.detail).toBeNull()
  })
})

// ─── derivePlanningStatus ───

describe('derivePlanningStatus', function() {
  it('returns not-ready when DoR fails', function() {
    expect(derivePlanningStatus({ passed: false }, { passed: true })).toBe('not-ready')
  })

  it('returns in-planning when DoR passes but DoD fails', function() {
    expect(derivePlanningStatus({ passed: true }, { passed: false })).toBe('in-planning')
  })

  it('returns ready-for-execution when both pass', function() {
    expect(derivePlanningStatus({ passed: true }, { passed: true })).toBe('ready-for-execution')
  })

  it('returns not-ready when both fail', function() {
    expect(derivePlanningStatus({ passed: false }, { passed: false })).toBe('not-ready')
  })
})

// ─── PLANNING_STATUS_ORDER ───

describe('PLANNING_STATUS_ORDER', function() {
  it('orders not-ready < in-planning < ready-for-execution', function() {
    expect(PLANNING_STATUS_ORDER['not-ready']).toBeLessThan(PLANNING_STATUS_ORDER['in-planning'])
    expect(PLANNING_STATUS_ORDER['in-planning']).toBeLessThan(PLANNING_STATUS_ORDER['ready-for-execution'])
  })
})
