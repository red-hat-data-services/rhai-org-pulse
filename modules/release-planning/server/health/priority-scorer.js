/**
 * Composite priority scoring.
 *
 * Combines four signals into a single 0-100 priority score:
 *   - RICE Score (30%): min-max normalized across all features
 *   - Big Rock Membership (30%): Tier 1=1.0, Tier 2=0.6, Tier 3=0.2
 *   - Feature Priority (25%): Blocker=1.0 ... Minor=0.2
 *   - Inverse Complexity (15%): XS=1.0 ... XL=0.2, Unknown=0.5
 */

var TIER_SCORES = { 1: 1.0, 2: 0.6, 3: 0.2 }

var PRIORITY_SCORES = {
  'Blocker': 1.0,
  'Critical': 0.8,
  'Major': 0.6,
  'Normal': 0.4,
  'Minor': 0.2
}

var TSHIRT_SCORES = {
  'XS': 1.0,
  'S': 0.8,
  'M': 0.6,
  'L': 0.4,
  'XL': 0.2
}

// Weights are hardcoded per user request. A future iteration could make
// these configurable via admin settings (stored in data/release-planning/
// health-config.json), but for now they are fixed constants.
var WEIGHTS = {
  rice: 0.30,
  bigRock: 0.30,
  priority: 0.25,
  complexity: 0.15
}

/**
 * Compute composite priority scores for a set of features.
 *
 * @param {Array<object>} features - Health pipeline features
 * @returns {Map<string, { score: number, breakdown: object }>}
 */
function computePriorityScores(features) {
  // Collect RICE scores for min-max normalization
  var riceValues = []
  for (var i = 0; i < features.length; i++) {
    if (features[i].rice && features[i].rice.score != null) {
      riceValues.push(features[i].rice.score)
    }
  }

  var riceMin = riceValues.length > 0 ? Math.min.apply(null, riceValues) : 0
  var riceMax = riceValues.length > 0 ? Math.max.apply(null, riceValues) : 0
  var riceRange = riceMax - riceMin

  // Compute median for fallback
  var riceMedian = 0.5
  if (riceValues.length > 0) {
    var sorted = riceValues.slice().sort(function(a, b) { return a - b })
    var mid = Math.floor(sorted.length / 2)
    var medianRaw = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
    riceMedian = riceRange > 0 ? (medianRaw - riceMin) / riceRange : 0.5
  }

  var results = new Map()

  for (var j = 0; j < features.length; j++) {
    var f = features[j]

    // RICE normalization
    var riceNorm = riceMedian // fallback
    if (f.rice && f.rice.score != null) {
      riceNorm = riceRange > 0 ? (f.rice.score - riceMin) / riceRange : 0.5
    }

    // Big Rock tier
    var tierNorm = TIER_SCORES[f.tier] || TIER_SCORES[3]

    // Feature priority
    var priorityNorm = PRIORITY_SCORES[f.priority] || PRIORITY_SCORES['Normal']

    // Inverse complexity (t-shirt size)
    var complexityNorm = TSHIRT_SCORES[f.tshirtSize] || 0.5

    var score = (riceNorm * WEIGHTS.rice) +
                (tierNorm * WEIGHTS.bigRock) +
                (priorityNorm * WEIGHTS.priority) +
                (complexityNorm * WEIGHTS.complexity)

    results.set(f.key, {
      score: Math.round(score * 100),
      breakdown: {
        rice: Math.round(riceNorm * 100),
        bigRock: Math.round(tierNorm * 100),
        priority: Math.round(priorityNorm * 100),
        complexity: Math.round(complexityNorm * 100)
      }
    })
  }

  return results
}

module.exports = {
  computePriorityScores: computePriorityScores,
  WEIGHTS: WEIGHTS,
  TIER_SCORES: TIER_SCORES,
  PRIORITY_SCORES: PRIORITY_SCORES,
  TSHIRT_SCORES: TSHIRT_SCORES
}
