import { describe, it, expect } from 'vitest'

var {
  computePriorityScores,
  computeBigRockScore,
  computeTargetVersionScore,
  getRiceValue,
  WEIGHTS,
  PRIORITY_SCORES,
  TARGET_VERSION_POSITION_SCORES
} = require('../../../server/planning/health/priority-scorer')

describe('exported constants', function() {
  it('weights sum to 1.0', function() {
    var sum = WEIGHTS.rice + WEIGHTS.bigRock + WEIGHTS.targetVersion + WEIGHTS.priority
    expect(sum).toBeCloseTo(1.0)
  })

  it('exposes correct weight values', function() {
    expect(WEIGHTS.rice).toBe(0.30)
    expect(WEIGHTS.bigRock).toBe(0.30)
    expect(WEIGHTS.targetVersion).toBe(0.25)
    expect(WEIGHTS.priority).toBe(0.15)
  })

  it('exposes priority scores', function() {
    expect(PRIORITY_SCORES['Blocker']).toBe(1.0)
    expect(PRIORITY_SCORES['Critical']).toBe(0.8)
    expect(PRIORITY_SCORES['Major']).toBe(0.6)
    expect(PRIORITY_SCORES['Normal']).toBe(0.4)
    expect(PRIORITY_SCORES['Minor']).toBe(0.2)
  })

  it('exposes target version position scores', function() {
    expect(TARGET_VERSION_POSITION_SCORES[0]).toBe(1.0)
    expect(TARGET_VERSION_POSITION_SCORES[1]).toBe(0.6)
    expect(TARGET_VERSION_POSITION_SCORES[2]).toBe(0.2)
  })
})

describe('getRiceValue', function() {
  it('extracts from rice.score object shape', function() {
    expect(getRiceValue({ rice: { score: 500 } })).toBe(500)
  })

  it('extracts from flat riceScore', function() {
    expect(getRiceValue({ riceScore: 300 })).toBe(300)
  })

  it('prefers rice.score over riceScore', function() {
    expect(getRiceValue({ rice: { score: 500 }, riceScore: 300 })).toBe(500)
  })

  it('falls back to riceScore when rice.score is null', function() {
    expect(getRiceValue({ rice: { score: null }, riceScore: 300 })).toBe(300)
  })

  it('returns null when neither exists', function() {
    expect(getRiceValue({})).toBeNull()
  })

  it('returns null when both are null', function() {
    expect(getRiceValue({ rice: null, riceScore: null })).toBeNull()
  })

  it('returns 0 for riceScore of 0', function() {
    expect(getRiceValue({ riceScore: 0 })).toBe(0)
  })
})

describe('computeBigRockScore', function() {
  it('returns 1.0 for position 1 (highest priority rock)', function() {
    var map = new Map([['Rock A', 1]])
    var feature = { bigRock: 'Rock A' }
    expect(computeBigRockScore(feature, map)).toBe(1.0)
  })

  it('decays by 0.1 per position', function() {
    var map = new Map([['Rock A', 1], ['Rock B', 2], ['Rock C', 3]])
    expect(computeBigRockScore({ bigRock: 'Rock A' }, map)).toBe(1.0)
    expect(computeBigRockScore({ bigRock: 'Rock B' }, map)).toBe(0.9)
    expect(computeBigRockScore({ bigRock: 'Rock C' }, map)).toBe(0.8)
  })

  it('floors at 0.3 for very low positions', function() {
    var map = new Map([['Deep Rock', 10]])
    // 1.0 - (10-1)*0.1 = 1.0 - 0.9 = 0.1 -> clamped to 0.3
    expect(computeBigRockScore({ bigRock: 'Deep Rock' }, map)).toBe(0.3)
  })

  it('floors at 0.3 for positions beyond 8', function() {
    var map = new Map([['Rock 8', 8], ['Rock 9', 9]])
    // position 8: 1.0 - 0.7 = 0.3
    expect(computeBigRockScore({ bigRock: 'Rock 8' }, map)).toBe(0.3)
    // position 9: 1.0 - 0.8 = 0.2 -> clamped to 0.3
    expect(computeBigRockScore({ bigRock: 'Rock 9' }, map)).toBe(0.3)
  })

  it('returns best score when feature belongs to multiple rocks', function() {
    var map = new Map([['Rock A', 5], ['Rock B', 2]])
    var feature = { bigRock: 'Rock A, Rock B' }
    // Rock A: 1.0 - 0.4 = 0.6; Rock B: 1.0 - 0.1 = 0.9; best = 0.9
    expect(computeBigRockScore(feature, map)).toBe(0.9)
  })

  it('returns 0 when bigRockPriorityMap is null', function() {
    var feature = { bigRock: 'Rock A' }
    expect(computeBigRockScore(feature, null)).toBe(0)
  })

  it('returns 0 when feature has no bigRock name', function() {
    var map = new Map([['Rock A', 1]])
    expect(computeBigRockScore({ bigRock: null }, map)).toBe(0)
    expect(computeBigRockScore({ bigRock: '' }, map)).toBe(0)
    expect(computeBigRockScore({}, map)).toBe(0)
  })

  it('returns 0 when rock name is not in the map', function() {
    var map = new Map([['Rock A', 1]])
    var feature = { bigRock: 'Unknown Rock' }
    expect(computeBigRockScore(feature, map)).toBe(0)
  })
})

describe('computeTargetVersionScore (GA-to-GA)', function() {
  it('returns 1.0 for first configured GA version', function() {
    var versions = ['3.5', '3.6', '3.7']
    var feature = { targetVersions: ['3.5 EA1 RHOAI RELEASE'] }
    expect(computeTargetVersionScore(feature, versions)).toBe(1.0)
  })

  it('returns 0.6 for second configured GA version', function() {
    var versions = ['3.5', '3.6', '3.7']
    var feature = { targetVersions: ['3.6 GA RHOAI RELEASE'] }
    expect(computeTargetVersionScore(feature, versions)).toBe(0.6)
  })

  it('returns 0.2 for third configured GA version', function() {
    var versions = ['3.5', '3.6', '3.7']
    var feature = { targetVersions: ['3.7'] }
    expect(computeTargetVersionScore(feature, versions)).toBe(0.2)
  })

  it('returns 0.1 for positions beyond 2', function() {
    var versions = ['3.5', '3.6', '3.7', '3.8']
    var feature = { targetVersions: ['3.8'] }
    expect(computeTargetVersionScore(feature, versions)).toBe(0.1)
  })

  it('all event types within same X.Y get same score', function() {
    var versions = ['3.5', '3.6']
    var ea1 = { targetVersions: ['3.5 EA1 RHOAI RELEASE'] }
    var ea2 = { targetVersions: ['3.5 EA2 RHOAI RELEASE'] }
    var ga = { targetVersions: ['3.5 GA RHOAI RELEASE'] }
    expect(computeTargetVersionScore(ea1, versions)).toBe(1.0)
    expect(computeTargetVersionScore(ea2, versions)).toBe(1.0)
    expect(computeTargetVersionScore(ga, versions)).toBe(1.0)
  })

  it('deduplicates configured versions to GA-level', function() {
    var versions = ['3.5', '3.5', '3.6']
    var feature = { targetVersions: ['3.6'] }
    expect(computeTargetVersionScore(feature, versions)).toBe(0.6)
  })

  it('returns best position when feature has multiple target versions', function() {
    var versions = ['3.5', '3.6', '3.7']
    var feature = { targetVersions: ['3.7', '3.5'] }
    expect(computeTargetVersionScore(feature, versions)).toBe(1.0)
  })

  it('returns 0.1 when no target versions match configured versions', function() {
    var versions = ['3.5', '3.6']
    var feature = { targetVersions: ['9.9'] }
    expect(computeTargetVersionScore(feature, versions)).toBe(0.1)
  })

  it('returns 0 when feature has no target versions', function() {
    var versions = ['3.5', '3.6']
    var feature = { targetVersions: [] }
    expect(computeTargetVersionScore(feature, versions)).toBe(0)
  })

  it('returns 0 when feature has undefined target versions', function() {
    var versions = ['3.5', '3.6']
    var feature = {}
    expect(computeTargetVersionScore(feature, versions)).toBe(0)
  })

  it('returns 0.1 when configuredVersions is empty', function() {
    var feature = { targetVersions: ['3.5'] }
    expect(computeTargetVersionScore(feature, [])).toBe(0.1)
  })

  it('returns 0.1 when configuredVersions is null', function() {
    var feature = { targetVersions: ['3.5'] }
    expect(computeTargetVersionScore(feature, null)).toBe(0.1)
  })

  it('handles simple numeric version strings', function() {
    var versions = ['v1.0', 'v2.0']
    var feature = { targetVersions: ['v1.0'] }
    expect(computeTargetVersionScore(feature, versions)).toBe(1.0)
  })
})

describe('computePriorityScores', function() {
  it('returns a Map with entries for each feature', function() {
    var features = [
      { key: 'T-1', rice: { score: 100 }, bigRock: 'Rock A', targetVersions: ['v1.0'], priority: 'Major' },
      { key: 'T-2', rice: { score: 50 }, bigRock: null, targetVersions: [], priority: 'Minor' }
    ]
    var opts = {
      bigRockPriorityMap: new Map([['Rock A', 1]]),
      configuredVersions: ['v1.0']
    }
    var results = computePriorityScores(features, opts)
    expect(results).toBeInstanceOf(Map)
    expect(results.size).toBe(2)
    expect(results.has('T-1')).toBe(true)
    expect(results.has('T-2')).toBe(true)
  })

  it('returns score and breakdown for each feature', function() {
    var features = [
      { key: 'T-1', rice: { score: 100 }, bigRock: 'Rock A', targetVersions: ['v1.0'], priority: 'Blocker' }
    ]
    var opts = {
      bigRockPriorityMap: new Map([['Rock A', 1]]),
      configuredVersions: ['v1.0']
    }
    var results = computePriorityScores(features, opts)
    var r = results.get('T-1')
    expect(r).toBeDefined()
    expect(typeof r.score).toBe('number')
    expect(r.breakdown).toBeDefined()
    expect(typeof r.breakdown.rice).toBe('number')
    expect(typeof r.breakdown.bigRock).toBe('number')
    expect(typeof r.breakdown.targetVersion).toBe('number')
    expect(typeof r.breakdown.priority).toBe('number')
  })

  it('scores range from 0-100', function() {
    var features = [
      { key: 'T-1', rice: { score: 100 }, bigRock: 'Rock A', targetVersions: ['v1.0'], priority: 'Blocker' },
      { key: 'T-2', rice: { score: 10 }, bigRock: null, targetVersions: [], priority: 'Minor' }
    ]
    var opts = {
      bigRockPriorityMap: new Map([['Rock A', 1]]),
      configuredVersions: ['v1.0']
    }
    var results = computePriorityScores(features, opts)
    expect(results.get('T-1').score).toBeGreaterThanOrEqual(0)
    expect(results.get('T-1').score).toBeLessThanOrEqual(100)
    expect(results.get('T-2').score).toBeGreaterThanOrEqual(0)
    expect(results.get('T-2').score).toBeLessThanOrEqual(100)
  })

  describe('RICE normalization', function() {
    it('min-max normalizes RICE scores across features', function() {
      var features = [
        { key: 'HIGH', rice: { score: 200 }, priority: 'Normal' },
        { key: 'LOW', rice: { score: 50 }, priority: 'Normal' }
      ]
      var results = computePriorityScores(features)
      expect(results.get('HIGH').breakdown.rice).toBe(100)
      expect(results.get('LOW').breakdown.rice).toBe(0)
    })

    it('normalizes to 0.5 when all RICE scores are the same', function() {
      var features = [
        { key: 'T-1', rice: { score: 100 }, priority: 'Normal' },
        { key: 'T-2', rice: { score: 100 }, priority: 'Normal' }
      ]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.rice).toBe(50)
      expect(results.get('T-2').breakdown.rice).toBe(50)
    })

    it('accepts flat riceScore (features list path)', function() {
      var features = [
        { key: 'HIGH', riceScore: 200, priority: 'Normal' },
        { key: 'LOW', riceScore: 50, priority: 'Normal' }
      ]
      var results = computePriorityScores(features)
      expect(results.get('HIGH').breakdown.rice).toBe(100)
      expect(results.get('LOW').breakdown.rice).toBe(0)
    })

    it('mixes rice.score and riceScore across features', function() {
      var features = [
        { key: 'OBJ', rice: { score: 200 }, priority: 'Normal' },
        { key: 'FLAT', riceScore: 50, priority: 'Normal' }
      ]
      var results = computePriorityScores(features)
      expect(results.get('OBJ').breakdown.rice).toBe(100)
      expect(results.get('FLAT').breakdown.rice).toBe(0)
    })
  })

  describe('median fallback for missing RICE', function() {
    it('uses median when feature has no RICE score', function() {
      var features = [
        { key: 'WITH-RICE-1', rice: { score: 100 }, priority: 'Normal' },
        { key: 'WITH-RICE-2', rice: { score: 200 }, priority: 'Normal' },
        { key: 'NO-RICE', rice: null, priority: 'Normal' }
      ]
      var results = computePriorityScores(features)
      // Median of [100, 200] = 150; normalized = (150-100)/(200-100) = 0.5
      expect(results.get('NO-RICE').breakdown.rice).toBe(50)
    })

    it('uses 0.5 fallback when no features have RICE', function() {
      var features = [
        { key: 'T-1', rice: null, priority: 'Normal' },
        { key: 'T-2', rice: null, priority: 'Major' }
      ]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.rice).toBe(50)
      expect(results.get('T-2').breakdown.rice).toBe(50)
    })

    it('handles rice object with null score', function() {
      var features = [
        { key: 'T-1', rice: { score: null }, priority: 'Normal' }
      ]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.rice).toBe(50)
    })

    it('computes correct median for odd number of RICE values', function() {
      var features = [
        { key: 'T-1', rice: { score: 10 }, priority: 'Normal' },
        { key: 'T-2', rice: { score: 50 }, priority: 'Normal' },
        { key: 'T-3', rice: { score: 90 }, priority: 'Normal' },
        { key: 'T-NONE', rice: null, priority: 'Normal' }
      ]
      var results = computePriorityScores(features)
      // Median of [10, 50, 90] = 50; normalized = (50-10)/(90-10) = 0.5
      expect(results.get('T-NONE').breakdown.rice).toBe(50)
    })
  })

  describe('big rock scoring via map', function() {
    it('scores feature in highest-priority rock', function() {
      var features = [{ key: 'T-1', rice: null, bigRock: 'Rock A', priority: 'Normal' }]
      var opts = { bigRockPriorityMap: new Map([['Rock A', 1]]) }
      var results = computePriorityScores(features, opts)
      expect(results.get('T-1').breakdown.bigRock).toBe(100)
    })

    it('scores 0 when feature has no big rock', function() {
      var features = [{ key: 'T-1', rice: null, bigRock: null, priority: 'Normal' }]
      var opts = { bigRockPriorityMap: new Map([['Rock A', 1]]) }
      var results = computePriorityScores(features, opts)
      expect(results.get('T-1').breakdown.bigRock).toBe(0)
    })

    it('scores 0 when no bigRockPriorityMap provided', function() {
      var features = [{ key: 'T-1', rice: null, bigRock: 'Rock A', priority: 'Normal' }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.bigRock).toBe(0)
    })
  })

  describe('target version scoring', function() {
    it('scores feature targeting first configured version', function() {
      var features = [{ key: 'T-1', rice: null, targetVersions: ['3.5 EA1 RHOAI'], priority: 'Normal' }]
      var opts = { configuredVersions: ['3.5', '3.6'] }
      var results = computePriorityScores(features, opts)
      expect(results.get('T-1').breakdown.targetVersion).toBe(100)
    })

    it('scores 0 when feature has no target versions', function() {
      var features = [{ key: 'T-1', rice: null, targetVersions: [], priority: 'Normal' }]
      var opts = { configuredVersions: ['3.5'] }
      var results = computePriorityScores(features, opts)
      expect(results.get('T-1').breakdown.targetVersion).toBe(0)
    })

    it('scores 10 when no configuredVersions provided', function() {
      var features = [{ key: 'T-1', rice: null, targetVersions: ['3.5'], priority: 'Normal' }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.targetVersion).toBe(10)
    })
  })

  describe('priority mapping', function() {
    it('maps Blocker to 1.0', function() {
      var features = [{ key: 'T-1', rice: null, priority: 'Blocker' }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.priority).toBe(100)
    })

    it('maps Critical to 0.8', function() {
      var features = [{ key: 'T-1', rice: null, priority: 'Critical' }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.priority).toBe(80)
    })

    it('maps Major to 0.6', function() {
      var features = [{ key: 'T-1', rice: null, priority: 'Major' }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.priority).toBe(60)
    })

    it('maps Normal to 0.4', function() {
      var features = [{ key: 'T-1', rice: null, priority: 'Normal' }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.priority).toBe(40)
    })

    it('maps Minor to 0.2', function() {
      var features = [{ key: 'T-1', rice: null, priority: 'Minor' }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.priority).toBe(20)
    })

    it('defaults to Normal for unknown priority', function() {
      var features = [{ key: 'T-1', rice: null, priority: 'Undefined' }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.priority).toBe(40)
    })

    it('defaults to Normal for missing priority', function() {
      var features = [{ key: 'T-1', rice: null }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.priority).toBe(40)
    })
  })

  describe('edge cases', function() {
    it('handles empty features array', function() {
      var results = computePriorityScores([])
      expect(results).toBeInstanceOf(Map)
      expect(results.size).toBe(0)
    })

    it('handles single feature with all null signals', function() {
      var features = [{ key: 'T-1', rice: null, bigRock: null, targetVersions: [], priority: null }]
      var results = computePriorityScores(features)
      var r = results.get('T-1')
      expect(r).toBeDefined()
      expect(typeof r.score).toBe('number')
      // rice=0.5, bigRock=0 (no map), targetVersion=0.1 (no configured versions fallback), priority=Normal=0.4
      // 0.5*0.30 + 0*0.30 + 0.1*0.25 + 0.4*0.15 = 0.15 + 0 + 0.025 + 0.06 = 0.235
      expect(r.score).toBe(24)
    })

    it('computes correct score for a max-priority feature', function() {
      var features = [
        { key: 'T-1', rice: { score: 100 }, bigRock: 'Rock A', targetVersions: ['v1.0'], priority: 'Blocker' }
      ]
      var opts = {
        bigRockPriorityMap: new Map([['Rock A', 1]]),
        configuredVersions: ['v1.0']
      }
      var results = computePriorityScores(features, opts)
      var r = results.get('T-1')
      // rice=0.5 (single feature), bigRock=1.0, targetVersion=1.0, priority=1.0
      // 0.5*0.30 + 1.0*0.30 + 1.0*0.25 + 1.0*0.15 = 0.15 + 0.30 + 0.25 + 0.15 = 0.85
      expect(r.score).toBe(85)
    })

    it('computes correct score for a min-priority feature', function() {
      var features = [
        { key: 'T-1', rice: { score: 10 }, bigRock: null, targetVersions: [], priority: 'Minor' }
      ]
      var results = computePriorityScores(features)
      var r = results.get('T-1')
      // rice=0.5 (single feature), bigRock=0 (no map), targetVersion=0.1 (no configured versions), priority=0.2
      // 0.5*0.30 + 0*0.30 + 0.1*0.25 + 0.2*0.15 = 0.15 + 0 + 0.025 + 0.03 = 0.205
      expect(r.score).toBe(21)
    })

    it('higher-priority features score higher than lower-priority features', function() {
      var features = [
        { key: 'HIGH', rice: { score: 200 }, bigRock: 'Rock A', targetVersions: ['v1.0'], priority: 'Blocker' },
        { key: 'LOW', rice: { score: 10 }, bigRock: null, targetVersions: [], priority: 'Minor' }
      ]
      var opts = {
        bigRockPriorityMap: new Map([['Rock A', 1]]),
        configuredVersions: ['v1.0']
      }
      var results = computePriorityScores(features, opts)
      expect(results.get('HIGH').score).toBeGreaterThan(results.get('LOW').score)
    })

    it('works without opts argument', function() {
      var features = [
        { key: 'T-1', rice: { score: 100 }, priority: 'Normal' }
      ]
      var results = computePriorityScores(features)
      var r = results.get('T-1')
      expect(r).toBeDefined()
      expect(typeof r.score).toBe('number')
    })
  })
})
