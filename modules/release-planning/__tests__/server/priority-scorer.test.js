import { describe, it, expect } from 'vitest'

const {
  computePriorityScores,
  WEIGHTS,
  TIER_SCORES,
  PRIORITY_SCORES,
  TSHIRT_SCORES
} = require('../../server/health/priority-scorer')

describe('exported constants', function() {
  it('weights sum to 1.0', function() {
    var sum = WEIGHTS.rice + WEIGHTS.bigRock + WEIGHTS.priority + WEIGHTS.complexity
    expect(sum).toBeCloseTo(1.0)
  })

  it('exposes correct weight values', function() {
    expect(WEIGHTS.rice).toBe(0.30)
    expect(WEIGHTS.bigRock).toBe(0.30)
    expect(WEIGHTS.priority).toBe(0.25)
    expect(WEIGHTS.complexity).toBe(0.15)
  })

  it('exposes tier scores', function() {
    expect(TIER_SCORES[1]).toBe(1.0)
    expect(TIER_SCORES[2]).toBe(0.6)
    expect(TIER_SCORES[3]).toBe(0.2)
  })

  it('exposes priority scores', function() {
    expect(PRIORITY_SCORES['Blocker']).toBe(1.0)
    expect(PRIORITY_SCORES['Critical']).toBe(0.8)
    expect(PRIORITY_SCORES['Major']).toBe(0.6)
    expect(PRIORITY_SCORES['Normal']).toBe(0.4)
    expect(PRIORITY_SCORES['Minor']).toBe(0.2)
  })

  it('exposes t-shirt scores', function() {
    expect(TSHIRT_SCORES['XS']).toBe(1.0)
    expect(TSHIRT_SCORES['S']).toBe(0.8)
    expect(TSHIRT_SCORES['M']).toBe(0.6)
    expect(TSHIRT_SCORES['L']).toBe(0.4)
    expect(TSHIRT_SCORES['XL']).toBe(0.2)
  })
})

describe('computePriorityScores', function() {
  it('returns a Map with entries for each feature', function() {
    var features = [
      { key: 'T-1', rice: { score: 100 }, tier: 1, priority: 'Major', tshirtSize: 'M' },
      { key: 'T-2', rice: { score: 50 }, tier: 2, priority: 'Minor', tshirtSize: 'XL' }
    ]
    var results = computePriorityScores(features)
    expect(results).toBeInstanceOf(Map)
    expect(results.size).toBe(2)
    expect(results.has('T-1')).toBe(true)
    expect(results.has('T-2')).toBe(true)
  })

  it('returns score and breakdown for each feature', function() {
    var features = [
      { key: 'T-1', rice: { score: 100 }, tier: 1, priority: 'Blocker', tshirtSize: 'XS' }
    ]
    var results = computePriorityScores(features)
    var r = results.get('T-1')
    expect(r).toBeDefined()
    expect(typeof r.score).toBe('number')
    expect(r.breakdown).toBeDefined()
    expect(typeof r.breakdown.rice).toBe('number')
    expect(typeof r.breakdown.bigRock).toBe('number')
    expect(typeof r.breakdown.priority).toBe('number')
    expect(typeof r.breakdown.complexity).toBe('number')
  })

  it('scores range from 0-100', function() {
    var features = [
      { key: 'T-1', rice: { score: 100 }, tier: 1, priority: 'Blocker', tshirtSize: 'XS' },
      { key: 'T-2', rice: { score: 10 }, tier: 3, priority: 'Minor', tshirtSize: 'XL' }
    ]
    var results = computePriorityScores(features)
    expect(results.get('T-1').score).toBeGreaterThanOrEqual(0)
    expect(results.get('T-1').score).toBeLessThanOrEqual(100)
    expect(results.get('T-2').score).toBeGreaterThanOrEqual(0)
    expect(results.get('T-2').score).toBeLessThanOrEqual(100)
  })

  describe('RICE normalization', function() {
    it('min-max normalizes RICE scores across features', function() {
      var features = [
        { key: 'HIGH', rice: { score: 200 }, tier: 1, priority: 'Normal', tshirtSize: null },
        { key: 'LOW', rice: { score: 50 }, tier: 1, priority: 'Normal', tshirtSize: null }
      ]
      var results = computePriorityScores(features)
      // HIGH should have riceNorm=1.0, LOW should have riceNorm=0.0
      expect(results.get('HIGH').breakdown.rice).toBe(100)
      expect(results.get('LOW').breakdown.rice).toBe(0)
    })

    it('normalizes to 0.5 when all RICE scores are the same', function() {
      var features = [
        { key: 'T-1', rice: { score: 100 }, tier: 1, priority: 'Normal', tshirtSize: null },
        { key: 'T-2', rice: { score: 100 }, tier: 1, priority: 'Normal', tshirtSize: null }
      ]
      var results = computePriorityScores(features)
      // riceRange is 0, so fallback to 0.5
      expect(results.get('T-1').breakdown.rice).toBe(50)
      expect(results.get('T-2').breakdown.rice).toBe(50)
    })
  })

  describe('median fallback for missing RICE', function() {
    it('uses median when feature has no RICE score', function() {
      var features = [
        { key: 'WITH-RICE-1', rice: { score: 100 }, tier: 1, priority: 'Normal', tshirtSize: null },
        { key: 'WITH-RICE-2', rice: { score: 200 }, tier: 1, priority: 'Normal', tshirtSize: null },
        { key: 'NO-RICE', rice: null, tier: 1, priority: 'Normal', tshirtSize: null }
      ]
      var results = computePriorityScores(features)
      // Median of [100, 200] = 150; normalized = (150-100)/(200-100) = 0.5
      expect(results.get('NO-RICE').breakdown.rice).toBe(50)
    })

    it('uses 0.5 fallback when no features have RICE', function() {
      var features = [
        { key: 'T-1', rice: null, tier: 1, priority: 'Normal', tshirtSize: null },
        { key: 'T-2', rice: null, tier: 2, priority: 'Major', tshirtSize: 'M' }
      ]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.rice).toBe(50)
      expect(results.get('T-2').breakdown.rice).toBe(50)
    })

    it('handles rice object with null score', function() {
      var features = [
        { key: 'T-1', rice: { score: null }, tier: 1, priority: 'Normal', tshirtSize: null }
      ]
      var results = computePriorityScores(features)
      // No valid RICE values, median is 0.5
      expect(results.get('T-1').breakdown.rice).toBe(50)
    })

    it('computes correct median for odd number of RICE values', function() {
      var features = [
        { key: 'T-1', rice: { score: 10 }, tier: 1, priority: 'Normal', tshirtSize: null },
        { key: 'T-2', rice: { score: 50 }, tier: 1, priority: 'Normal', tshirtSize: null },
        { key: 'T-3', rice: { score: 90 }, tier: 1, priority: 'Normal', tshirtSize: null },
        { key: 'T-NONE', rice: null, tier: 1, priority: 'Normal', tshirtSize: null }
      ]
      var results = computePriorityScores(features)
      // Median of [10, 50, 90] = 50; normalized = (50-10)/(90-10) = 0.5
      expect(results.get('T-NONE').breakdown.rice).toBe(50)
    })
  })

  describe('tier mapping', function() {
    it('maps tier 1 to 1.0', function() {
      var features = [{ key: 'T-1', rice: null, tier: 1, priority: 'Normal', tshirtSize: null }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.bigRock).toBe(100)
    })

    it('maps tier 2 to 0.6', function() {
      var features = [{ key: 'T-1', rice: null, tier: 2, priority: 'Normal', tshirtSize: null }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.bigRock).toBe(60)
    })

    it('maps tier 3 to 0.2', function() {
      var features = [{ key: 'T-1', rice: null, tier: 3, priority: 'Normal', tshirtSize: null }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.bigRock).toBe(20)
    })

    it('defaults to tier 3 for unknown tier', function() {
      var features = [{ key: 'T-1', rice: null, tier: null, priority: 'Normal', tshirtSize: null }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.bigRock).toBe(20)
    })

    it('defaults to tier 3 for missing tier', function() {
      var features = [{ key: 'T-1', rice: null, priority: 'Normal', tshirtSize: null }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.bigRock).toBe(20)
    })
  })

  describe('priority mapping', function() {
    it('maps Blocker to 1.0', function() {
      var features = [{ key: 'T-1', rice: null, tier: 1, priority: 'Blocker', tshirtSize: null }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.priority).toBe(100)
    })

    it('maps Critical to 0.8', function() {
      var features = [{ key: 'T-1', rice: null, tier: 1, priority: 'Critical', tshirtSize: null }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.priority).toBe(80)
    })

    it('maps Major to 0.6', function() {
      var features = [{ key: 'T-1', rice: null, tier: 1, priority: 'Major', tshirtSize: null }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.priority).toBe(60)
    })

    it('maps Normal to 0.4', function() {
      var features = [{ key: 'T-1', rice: null, tier: 1, priority: 'Normal', tshirtSize: null }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.priority).toBe(40)
    })

    it('maps Minor to 0.2', function() {
      var features = [{ key: 'T-1', rice: null, tier: 1, priority: 'Minor', tshirtSize: null }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.priority).toBe(20)
    })

    it('defaults to Normal for unknown priority', function() {
      var features = [{ key: 'T-1', rice: null, tier: 1, priority: 'Undefined', tshirtSize: null }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.priority).toBe(40)
    })

    it('defaults to Normal for missing priority', function() {
      var features = [{ key: 'T-1', rice: null, tier: 1, tshirtSize: null }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.priority).toBe(40)
    })
  })

  describe('t-shirt size mapping', function() {
    it('maps XS to 1.0', function() {
      var features = [{ key: 'T-1', rice: null, tier: 1, priority: 'Normal', tshirtSize: 'XS' }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.complexity).toBe(100)
    })

    it('maps S to 0.8', function() {
      var features = [{ key: 'T-1', rice: null, tier: 1, priority: 'Normal', tshirtSize: 'S' }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.complexity).toBe(80)
    })

    it('maps M to 0.6', function() {
      var features = [{ key: 'T-1', rice: null, tier: 1, priority: 'Normal', tshirtSize: 'M' }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.complexity).toBe(60)
    })

    it('maps L to 0.4', function() {
      var features = [{ key: 'T-1', rice: null, tier: 1, priority: 'Normal', tshirtSize: 'L' }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.complexity).toBe(40)
    })

    it('maps XL to 0.2', function() {
      var features = [{ key: 'T-1', rice: null, tier: 1, priority: 'Normal', tshirtSize: 'XL' }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.complexity).toBe(20)
    })

    it('defaults to 0.5 for null tshirtSize', function() {
      var features = [{ key: 'T-1', rice: null, tier: 1, priority: 'Normal', tshirtSize: null }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.complexity).toBe(50)
    })

    it('defaults to 0.5 for undefined tshirtSize', function() {
      var features = [{ key: 'T-1', rice: null, tier: 1, priority: 'Normal' }]
      var results = computePriorityScores(features)
      expect(results.get('T-1').breakdown.complexity).toBe(50)
    })
  })

  describe('edge cases', function() {
    it('handles empty features array', function() {
      var results = computePriorityScores([])
      expect(results).toBeInstanceOf(Map)
      expect(results.size).toBe(0)
    })

    it('handles single feature with all null signals', function() {
      var features = [{ key: 'T-1', rice: null, tier: null, priority: null, tshirtSize: null }]
      var results = computePriorityScores(features)
      var r = results.get('T-1')
      expect(r).toBeDefined()
      expect(typeof r.score).toBe('number')
      // rice=0.5, bigRock=tier3=0.2, priority=Normal=0.4, complexity=0.5
      // 0.5*0.30 + 0.2*0.30 + 0.4*0.25 + 0.5*0.15 = 0.15 + 0.06 + 0.10 + 0.075 = 0.385
      expect(r.score).toBe(39) // Math.round(0.385 * 100)
    })

    it('computes correct score for a max-priority feature', function() {
      // Only one feature, so RICE normalizes to 0.5
      var features = [{ key: 'T-1', rice: { score: 100 }, tier: 1, priority: 'Blocker', tshirtSize: 'XS' }]
      var results = computePriorityScores(features)
      var r = results.get('T-1')
      // rice=0.5 (single feature), bigRock=1.0, priority=1.0, complexity=1.0
      // 0.5*0.30 + 1.0*0.30 + 1.0*0.25 + 1.0*0.15 = 0.15 + 0.30 + 0.25 + 0.15 = 0.85
      expect(r.score).toBe(85)
    })

    it('computes correct score for a min-priority feature', function() {
      var features = [{ key: 'T-1', rice: { score: 10 }, tier: 3, priority: 'Minor', tshirtSize: 'XL' }]
      var results = computePriorityScores(features)
      var r = results.get('T-1')
      // rice=0.5 (single feature), bigRock=0.2, priority=0.2, complexity=0.2
      // 0.5*0.30 + 0.2*0.30 + 0.2*0.25 + 0.2*0.15 = 0.15 + 0.06 + 0.05 + 0.03 = 0.29
      expect(r.score).toBe(29)
    })

    it('higher-priority features score higher than lower-priority features', function() {
      var features = [
        { key: 'HIGH', rice: { score: 200 }, tier: 1, priority: 'Blocker', tshirtSize: 'XS' },
        { key: 'LOW', rice: { score: 10 }, tier: 3, priority: 'Minor', tshirtSize: 'XL' }
      ]
      var results = computePriorityScores(features)
      expect(results.get('HIGH').score).toBeGreaterThan(results.get('LOW').score)
    })
  })
})
