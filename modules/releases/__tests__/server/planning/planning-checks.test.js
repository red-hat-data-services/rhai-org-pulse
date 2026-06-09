import { describe, it, expect } from 'vitest'

const { computePlanningChecks } = require('../../../server/planning/health/planning-gates')

function makeFeature(overrides) {
  return Object.assign({
    key: 'RHOAIENG-100',
    components: ['Model Serving'],
    pm: 'Jane Doe',
    phase: 'GA',
    releaseType: 'GA',
    epicCount: 3,
    rfe: 'RHAISTRAT-200',
    parentKey: 'RHAISTRAT-200'
  }, overrides)
}

describe('computePlanningChecks', function() {
  it('returns all checks passed when all fields are present', function() {
    var result = computePlanningChecks(makeFeature())
    expect(result.passedCount).toBe(5)
    expect(result.totalCount).toBe(5)
    expect(result.hasHardBlockers).toBe(false)
    expect(result.hardBlockersFailed).toHaveLength(0)
    expect(result.checks).toHaveLength(5)
    result.checks.forEach(function(c) {
      expect(c.passed).toBe(true)
      expect(c.severity).toBe('hard-blocker')
    })
  })

  it('fails DoR-P1 when components are empty', function() {
    var result = computePlanningChecks(makeFeature({ components: [] }))
    var p1 = result.checks.find(function(c) { return c.id === 'DoR-P1' })
    expect(p1.passed).toBe(false)
    expect(p1.detail).toBe('No components assigned')
    expect(result.hasHardBlockers).toBe(true)
    expect(result.hardBlockersFailed).toHaveLength(1)
    expect(result.hardBlockersFailed[0].id).toBe('DoR-P1')
  })

  it('fails DoR-P1 when components is undefined', function() {
    var result = computePlanningChecks(makeFeature({ components: undefined }))
    var p1 = result.checks.find(function(c) { return c.id === 'DoR-P1' })
    expect(p1.passed).toBe(false)
  })

  it('passes DoR-P1 when components is a non-empty string', function() {
    var result = computePlanningChecks(makeFeature({ components: 'Model Serving' }))
    var p1 = result.checks.find(function(c) { return c.id === 'DoR-P1' })
    expect(p1.passed).toBe(true)
  })

  it('fails DoR-P2 when PM is empty string', function() {
    var result = computePlanningChecks(makeFeature({ pm: '' }))
    var p2 = result.checks.find(function(c) { return c.id === 'DoR-P2' })
    expect(p2.passed).toBe(false)
    expect(p2.detail).toBe(null)
    expect(result.hasHardBlockers).toBe(true)
  })

  it('fails DoR-P2 when PM is missing', function() {
    var result = computePlanningChecks(makeFeature({ pm: undefined }))
    var p2 = result.checks.find(function(c) { return c.id === 'DoR-P2' })
    expect(p2.passed).toBe(false)
  })

  it('passes DoR-P2 when PM is an object with displayName', function() {
    var result = computePlanningChecks(makeFeature({ pm: { displayName: 'Jane Doe' } }))
    var p2 = result.checks.find(function(c) { return c.id === 'DoR-P2' })
    expect(p2.passed).toBe(true)
    expect(p2.detail).toBe('Jane Doe')
  })

  it('fails DoR-P3 when release type is empty', function() {
    var result = computePlanningChecks(makeFeature({ phase: '', releaseType: '' }))
    var p3 = result.checks.find(function(c) { return c.id === 'DoR-P3' })
    expect(p3.passed).toBe(false)
    expect(p3.detail).toBe('No release type (DP/TP/GA) specified')
    expect(result.hasHardBlockers).toBe(true)
  })

  it('passes DoR-P3 when phase is set but releaseType is not', function() {
    var result = computePlanningChecks(makeFeature({ phase: 'EA1', releaseType: '' }))
    var p3 = result.checks.find(function(c) { return c.id === 'DoR-P3' })
    expect(p3.passed).toBe(true)
  })

  it('fails DoR-P4 when epicCount is 0', function() {
    var result = computePlanningChecks(makeFeature({ epicCount: 0 }))
    var p4 = result.checks.find(function(c) { return c.id === 'DoR-P4' })
    expect(p4.passed).toBe(false)
    expect(p4.detail).toBe('No child epics linked')
    expect(result.hasHardBlockers).toBe(true)
  })

  it('fails DoR-P4 when epicCount is undefined', function() {
    var result = computePlanningChecks(makeFeature({ epicCount: undefined }))
    var p4 = result.checks.find(function(c) { return c.id === 'DoR-P4' })
    expect(p4.passed).toBe(false)
  })

  it('passes DoR-P4 when epicCount is positive', function() {
    var result = computePlanningChecks(makeFeature({ epicCount: 5 }))
    var p4 = result.checks.find(function(c) { return c.id === 'DoR-P4' })
    expect(p4.passed).toBe(true)
    expect(p4.detail).toBe('5 epic(s)')
  })

  it('fails DoR-P5 when no RFE linked', function() {
    var result = computePlanningChecks(makeFeature({ rfe: '', parentKey: '' }))
    var p5 = result.checks.find(function(c) { return c.id === 'DoR-P5' })
    expect(p5.passed).toBe(false)
    expect(p5.detail).toBe('No source RFE linked')
    expect(result.hasHardBlockers).toBe(true)
  })

  it('passes DoR-P5 when rfe is set', function() {
    var result = computePlanningChecks(makeFeature({ rfe: 'RHAISTRAT-300', parentKey: '' }))
    var p5 = result.checks.find(function(c) { return c.id === 'DoR-P5' })
    expect(p5.passed).toBe(true)
    expect(p5.detail).toBe('RHAISTRAT-300')
  })

  it('passes DoR-P5 when parentKey is set but rfe is not', function() {
    var result = computePlanningChecks(makeFeature({ rfe: '', parentKey: 'RHAISTRAT-400' }))
    var p5 = result.checks.find(function(c) { return c.id === 'DoR-P5' })
    expect(p5.passed).toBe(true)
  })

  it('reports multiple hard blockers correctly', function() {
    var result = computePlanningChecks(makeFeature({
      components: [],
      pm: '',
      epicCount: 0
    }))
    expect(result.hasHardBlockers).toBe(true)
    expect(result.hardBlockersFailed).toHaveLength(3)
    expect(result.passedCount).toBe(2)
    expect(result.totalCount).toBe(5)
  })

  it('all 5 checks are hard-blockers (per stakeholder decision)', function() {
    var result = computePlanningChecks(makeFeature())
    result.checks.forEach(function(c) {
      expect(c.severity).toBe('hard-blocker')
    })
  })
})
