import { describe, it, expect } from 'vitest'

const {
  computeFeatureRisk,
  determineExpectedPhase,
  isFeatureBehindPhase,
  expectedCompletionForPhase
} = require('../../server/health/risk-engine')

const MILESTONES = {
  ea1Freeze: '2026-05-01',
  ea1Target: '2026-05-15',
  ea2Freeze: '2026-06-15',
  ea2Target: '2026-07-01',
  gaFreeze: '2026-08-01',
  gaTarget: '2026-08-15'
}

function dateOf(str) {
  return new Date(str + 'T12:00:00Z')
}

describe('determineExpectedPhase', function() {
  it('returns null when milestones is null', function() {
    expect(determineExpectedPhase(null, new Date())).toBeNull()
  })

  it('returns null when today is before all milestones', function() {
    expect(determineExpectedPhase(MILESTONES, dateOf('2026-04-01'))).toBeNull()
  })

  it('returns ea1_freeze when today is on ea1Freeze', function() {
    expect(determineExpectedPhase(MILESTONES, dateOf('2026-05-01'))).toBe('ea1_freeze')
  })

  it('returns ea1_target when today is between ea1Target and ea2Freeze', function() {
    expect(determineExpectedPhase(MILESTONES, dateOf('2026-05-20'))).toBe('ea1_target')
  })

  it('returns ea2_freeze when today is on ea2Freeze', function() {
    expect(determineExpectedPhase(MILESTONES, dateOf('2026-06-15'))).toBe('ea2_freeze')
  })

  it('returns ga_target when today is past gaTarget', function() {
    expect(determineExpectedPhase(MILESTONES, dateOf('2026-09-01'))).toBe('ga_target')
  })

  it('walks reverse chronologically to find the most recent', function() {
    expect(determineExpectedPhase(MILESTONES, dateOf('2026-08-10'))).toBe('ga_freeze')
  })

  it('skips milestones with null dates', function() {
    var partial = { ea1Freeze: null, ea1Target: '2026-05-15', ea2Freeze: '2026-06-15' }
    expect(determineExpectedPhase(partial, dateOf('2026-05-01'))).toBeNull()
    expect(determineExpectedPhase(partial, dateOf('2026-05-20'))).toBe('ea1_target')
  })
})

describe('isFeatureBehindPhase', function() {
  it('returns false when currentMilestone is null', function() {
    expect(isFeatureBehindPhase({ status: 'New' }, null)).toBe(false)
  })

  it('returns true when feature in New status after freeze', function() {
    expect(isFeatureBehindPhase({ status: 'New' }, 'ea1_freeze')).toBe(true)
  })

  it('returns true when feature in Refinement status after target', function() {
    expect(isFeatureBehindPhase({ status: 'Refinement' }, 'ea1_target')).toBe(true)
  })

  it('returns false when feature is In Progress', function() {
    expect(isFeatureBehindPhase({ status: 'In Progress' }, 'ea1_freeze')).toBe(false)
  })

  it('returns false for empty status', function() {
    expect(isFeatureBehindPhase({ status: '' }, 'ea1_freeze')).toBe(false)
  })
})

describe('expectedCompletionForPhase', function() {
  it('returns 0 when currentMilestone is null', function() {
    expect(expectedCompletionForPhase(null, 'EA1')).toBe(0)
  })

  it('returns 0 when featurePhase is null', function() {
    expect(expectedCompletionForPhase('ea1_freeze', null)).toBe(0)
  })

  it('returns correct expectation for known phase and milestone', function() {
    var result = expectedCompletionForPhase('ea1_freeze', 'EA1')
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThan(0)
  })

  it('falls back to GA expectations for unknown phase', function() {
    var gaResult = expectedCompletionForPhase('ea1_freeze', 'GA')
    var unknownResult = expectedCompletionForPhase('ea1_freeze', 'UNKNOWN_PHASE')
    expect(unknownResult).toBe(gaResult)
  })

  it('uses custom expectations when provided', function() {
    var custom = { ea1_freeze: { EA1: 99, GA: 10 } }
    expect(expectedCompletionForPhase('ea1_freeze', 'EA1', custom)).toBe(99)
  })

  it('returns 0 when milestone not in expectations', function() {
    expect(expectedCompletionForPhase('unknown_milestone', 'EA1')).toBe(0)
  })
})

describe('computeFeatureRisk', function() {
  var healthyFeature = { status: 'In Progress', completionPct: 80, phase: 'GA', deliveryOwner: 'Jane', assignee: 'Jane', tier: 1 }
  var healthyDor = { completionPct: 100, totalCount: 13 }
  var healthyEnrichment = { storyPoints: 8, dependencyLinks: [] }

  it('returns green with no flags for a healthy feature', function() {
    var result = computeFeatureRisk(healthyFeature, null, healthyDor, healthyEnrichment, {
      today: dateOf('2026-04-01')
    })
    expect(result.risk).toBe('green')
    expect(result.flags).toHaveLength(0)
    expect(result.riskScore).toBe(0)
  })

  it('flags MILESTONE_MISS when feature in New status after freeze', function() {
    var feature = { status: 'New', completionPct: 0, phase: 'EA1' }
    var result = computeFeatureRisk(feature, MILESTONES, healthyDor, healthyEnrichment, {
      today: dateOf('2026-05-10')
    })
    var milestoneFlag = result.flags.find(function(f) { return f.category === 'MILESTONE_MISS' })
    expect(milestoneFlag).toBeDefined()
    expect(milestoneFlag.severity).toBe('high')
    expect(result.risk).toBe('red')
  })

  it('flags VELOCITY_LAG medium when behind but above velocityYellowMin', function() {
    var feature = { status: 'In Progress', completionPct: 60, phase: 'GA' }
    var result = computeFeatureRisk(feature, MILESTONES, healthyDor, healthyEnrichment, {
      today: dateOf('2026-08-01'),
      riskThresholds: { velocityYellowMin: 50 }
    })
    var velocityFlag = result.flags.find(function(f) { return f.category === 'VELOCITY_LAG' })
    if (velocityFlag) {
      expect(velocityFlag.severity).toBe('medium')
    }
  })

  it('flags VELOCITY_LAG high when below velocityYellowMin', function() {
    var feature = { status: 'In Progress', completionPct: 10, phase: 'GA' }
    var result = computeFeatureRisk(feature, MILESTONES, healthyDor, healthyEnrichment, {
      today: dateOf('2026-08-01'),
      riskThresholds: { velocityYellowMin: 50 }
    })
    var velocityFlag = result.flags.find(function(f) { return f.category === 'VELOCITY_LAG' })
    if (velocityFlag) {
      expect(velocityFlag.severity).toBe('high')
    }
  })

  it('flags DOR_INCOMPLETE high when below 50%', function() {
    var dor = { completionPct: 30, totalCount: 13 }
    var result = computeFeatureRisk(healthyFeature, null, dor, healthyEnrichment, {
      today: dateOf('2026-04-01')
    })
    var dorFlag = result.flags.find(function(f) { return f.category === 'DOR_INCOMPLETE' })
    expect(dorFlag).toBeDefined()
    expect(dorFlag.severity).toBe('high')
  })

  it('flags DOR_INCOMPLETE medium when between 50-80%', function() {
    var dor = { completionPct: 65, totalCount: 13 }
    var result = computeFeatureRisk(healthyFeature, null, dor, healthyEnrichment, {
      today: dateOf('2026-04-01')
    })
    var dorFlag = result.flags.find(function(f) { return f.category === 'DOR_INCOMPLETE' })
    expect(dorFlag).toBeDefined()
    expect(dorFlag.severity).toBe('medium')
  })

  it('does not flag DOR_INCOMPLETE when above 80%', function() {
    var dor = { completionPct: 85, totalCount: 13 }
    var result = computeFeatureRisk(healthyFeature, null, dor, healthyEnrichment, {
      today: dateOf('2026-04-01')
    })
    var dorFlag = result.flags.find(function(f) { return f.category === 'DOR_INCOMPLETE' })
    expect(dorFlag).toBeUndefined()
  })

  it('flags BLOCKED when unresolved inward Blocks link exists', function() {
    var enrichment = {
      storyPoints: 8,
      dependencyLinks: [
        { type: 'Blocks', direction: 'inward', linkedKey: 'TEST-999', linkedStatus: 'In Progress' }
      ]
    }
    var result = computeFeatureRisk(healthyFeature, null, healthyDor, enrichment, {
      today: dateOf('2026-04-01')
    })
    var blockedFlag = result.flags.find(function(f) { return f.category === 'BLOCKED' })
    expect(blockedFlag).toBeDefined()
    expect(blockedFlag.severity).toBe('high')
    expect(blockedFlag.message).toContain('TEST-999')
  })

  it('does not flag BLOCKED when linked status is Closed', function() {
    var enrichment = {
      storyPoints: 8,
      dependencyLinks: [
        { type: 'Blocks', direction: 'inward', linkedKey: 'TEST-999', linkedStatus: 'Closed' }
      ]
    }
    var result = computeFeatureRisk(healthyFeature, null, healthyDor, enrichment, {
      today: dateOf('2026-04-01')
    })
    var blockedFlag = result.flags.find(function(f) { return f.category === 'BLOCKED' })
    expect(blockedFlag).toBeUndefined()
  })

  it('flags UNESTIMATED when no story points', function() {
    var enrichment = { storyPoints: null, dependencyLinks: [] }
    var result = computeFeatureRisk(healthyFeature, null, healthyDor, enrichment, {
      today: dateOf('2026-04-01')
    })
    var unestFlag = result.flags.find(function(f) { return f.category === 'UNESTIMATED' })
    expect(unestFlag).toBeDefined()
    expect(unestFlag.severity).toBe('medium')
  })

  it('sets risk to red when any flag has high severity', function() {
    var dor = { completionPct: 30, totalCount: 13 }
    var result = computeFeatureRisk(healthyFeature, null, dor, healthyEnrichment, {
      today: dateOf('2026-04-01')
    })
    expect(result.risk).toBe('red')
  })

  it('sets risk to yellow when worst severity is medium', function() {
    var enrichment = { storyPoints: null, dependencyLinks: [] }
    var dor = { completionPct: 85, totalCount: 13 }
    var result = computeFeatureRisk(healthyFeature, null, dor, enrichment, {
      today: dateOf('2026-04-01')
    })
    expect(result.risk).toBe('yellow')
  })

  it('riskScore equals the number of flags', function() {
    var dor = { completionPct: 30, totalCount: 13 }
    var enrichment = { storyPoints: null, dependencyLinks: [] }
    var result = computeFeatureRisk(healthyFeature, null, dor, enrichment, {
      today: dateOf('2026-04-01')
    })
    expect(result.riskScore).toBe(result.flags.length)
  })

  // ─── Planning risk categories ───

  it('flags MISSING_OWNER when no deliveryOwner or assignee', function() {
    var feature = { status: 'In Progress', completionPct: 80, phase: 'GA', tier: 1 }
    var result = computeFeatureRisk(feature, null, healthyDor, healthyEnrichment, {
      today: dateOf('2026-04-01')
    })
    var flag = result.flags.find(function(f) { return f.category === 'MISSING_OWNER' })
    expect(flag).toBeDefined()
    expect(flag.severity).toBe('medium')
  })

  it('does not flag MISSING_OWNER when deliveryOwner is set', function() {
    var result = computeFeatureRisk(healthyFeature, null, healthyDor, healthyEnrichment, {
      today: dateOf('2026-04-01')
    })
    var flag = result.flags.find(function(f) { return f.category === 'MISSING_OWNER' })
    expect(flag).toBeUndefined()
  })

  it('flags NO_BIG_ROCK when tier is 3', function() {
    var feature = { status: 'In Progress', completionPct: 80, phase: 'GA', deliveryOwner: 'Jane', assignee: 'Jane', tier: 3 }
    var result = computeFeatureRisk(feature, null, healthyDor, healthyEnrichment, {
      today: dateOf('2026-04-01')
    })
    var flag = result.flags.find(function(f) { return f.category === 'NO_BIG_ROCK' })
    expect(flag).toBeDefined()
    expect(flag.severity).toBe('low')
  })

  it('NO_BIG_ROCK low severity does not escalate to yellow by itself', function() {
    var feature = { status: 'In Progress', completionPct: 80, phase: 'GA', deliveryOwner: 'Jane', assignee: 'Jane', tier: 3 }
    var result = computeFeatureRisk(feature, null, healthyDor, healthyEnrichment, {
      today: dateOf('2026-04-01')
    })
    expect(result.risk).toBe('green')
    expect(result.flags.length).toBe(1)
  })

  it('does not flag NO_BIG_ROCK for tier 1 or 2', function() {
    var result = computeFeatureRisk(healthyFeature, null, healthyDor, healthyEnrichment, {
      today: dateOf('2026-04-01')
    })
    var flag = result.flags.find(function(f) { return f.category === 'NO_BIG_ROCK' })
    expect(flag).toBeUndefined()
  })

  it('flags LATE_COMMITMENT when past planning deadline and no fixVersion', function() {
    var feature = { status: 'In Progress', completionPct: 80, phase: 'GA', deliveryOwner: 'Jane', assignee: 'Jane', tier: 1, fixVersions: [] }
    var result = computeFeatureRisk(feature, null, healthyDor, healthyEnrichment, {
      today: dateOf('2026-04-01'),
      planningDeadline: { date: '2026-03-25', daysRemaining: -7 },
      version: '3.5'
    })
    var flag = result.flags.find(function(f) { return f.category === 'LATE_COMMITMENT' })
    expect(flag).toBeDefined()
    expect(flag.severity).toBe('high')
    expect(flag.message).toContain('7 days')
  })

  it('does not flag LATE_COMMITMENT when feature has a matching fixVersion', function() {
    var feature = { status: 'In Progress', completionPct: 80, phase: 'GA', deliveryOwner: 'Jane', assignee: 'Jane', tier: 1, fixVersions: ['rhoai-3.5'] }
    var result = computeFeatureRisk(feature, null, healthyDor, healthyEnrichment, {
      today: dateOf('2026-04-01'),
      planningDeadline: { date: '2026-03-25', daysRemaining: -7 },
      version: '3.5'
    })
    var flag = result.flags.find(function(f) { return f.category === 'LATE_COMMITMENT' })
    expect(flag).toBeUndefined()
  })

  it('does not flag LATE_COMMITMENT when before planning deadline', function() {
    var feature = { status: 'In Progress', completionPct: 80, phase: 'GA', deliveryOwner: 'Jane', assignee: 'Jane', tier: 1, fixVersions: [] }
    var result = computeFeatureRisk(feature, null, healthyDor, healthyEnrichment, {
      today: dateOf('2026-04-01'),
      planningDeadline: { date: '2026-04-15', daysRemaining: 14 },
      version: '3.5'
    })
    var flag = result.flags.find(function(f) { return f.category === 'LATE_COMMITMENT' })
    expect(flag).toBeUndefined()
  })

  // ─── Execution category suppression ───

  it('suppresses MILESTONE_MISS when before planning deadline', function() {
    var feature = { status: 'New', completionPct: 0, phase: 'EA1', deliveryOwner: 'Jane', assignee: 'Jane', tier: 1 }
    var result = computeFeatureRisk(feature, MILESTONES, healthyDor, healthyEnrichment, {
      today: dateOf('2026-05-10'),
      planningDeadline: { date: '2026-06-01', daysRemaining: 22 }
    })
    var flag = result.flags.find(function(f) { return f.category === 'MILESTONE_MISS' })
    expect(flag).toBeUndefined()
  })

  it('suppresses VELOCITY_LAG when before planning deadline', function() {
    var feature = { status: 'In Progress', completionPct: 10, phase: 'GA', deliveryOwner: 'Jane', assignee: 'Jane', tier: 1 }
    var result = computeFeatureRisk(feature, MILESTONES, healthyDor, healthyEnrichment, {
      today: dateOf('2026-08-01'),
      planningDeadline: { date: '2026-09-01', daysRemaining: 31 }
    })
    var flag = result.flags.find(function(f) { return f.category === 'VELOCITY_LAG' })
    expect(flag).toBeUndefined()
  })

  it('does not suppress execution categories when past planning deadline', function() {
    var feature = { status: 'New', completionPct: 0, phase: 'EA1', deliveryOwner: 'Jane', assignee: 'Jane', tier: 1 }
    var result = computeFeatureRisk(feature, MILESTONES, healthyDor, healthyEnrichment, {
      today: dateOf('2026-05-10'),
      planningDeadline: { date: '2026-04-01', daysRemaining: -39 }
    })
    var flag = result.flags.find(function(f) { return f.category === 'MILESTONE_MISS' })
    expect(flag).toBeDefined()
  })
})
