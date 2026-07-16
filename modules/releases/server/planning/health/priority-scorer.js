var { parseVersionComponents } = require('../../version-utils')

var WEIGHTS = {
  rice: 0.30,
  bigRock: 0.30,
  targetVersion: 0.25,
  priority: 0.15
}

var PRIORITY_SCORES = {
  'Blocker': 1.0,
  'Critical': 0.8,
  'Major': 0.6,
  'Normal': 0.4,
  'Minor': 0.2
}

var TARGET_VERSION_POSITION_SCORES = {
  0: 1.0,
  1: 0.6,
  2: 0.2
}

function getRiceValue(feature) {
  if (feature.rice && feature.rice.score != null) return feature.rice.score
  if (feature.riceScore != null) return feature.riceScore
  return null
}

function computeBigRockScore(feature, bigRockPriorityMap) {
  if (!bigRockPriorityMap) return 0
  var rockName = feature.bigRock
  if (!rockName) return 0

  var rocks = rockName.split(', ')
  var bestScore = 0
  for (var i = 0; i < rocks.length; i++) {
    var name = rocks[i].trim()
    if (!name) continue
    var position = bigRockPriorityMap.get(name)
    if (position == null) continue
    var score = Math.max(0.3, 1.0 - (position - 1) * 0.1)
    if (score > bestScore) bestScore = score
  }

  return bestScore
}

function extractMajorMinor(versionStr) {
  var parsed = parseVersionComponents(versionStr)
  if (parsed) return parsed.version
  var m = versionStr.match(/(\d+\.\d+)/)
  return m ? m[1] : null
}

function computeTargetVersionScore(feature, configuredVersions) {
  if (!configuredVersions || configuredVersions.length === 0) return 0.1
  var tvs = feature.targetVersions || []
  if (tvs.length === 0) return 0

  var gaVersions = []
  var seen = {}
  for (var ci = 0; ci < configuredVersions.length; ci++) {
    var mm = extractMajorMinor(configuredVersions[ci])
    if (mm && !seen[mm]) {
      seen[mm] = true
      gaVersions.push(mm)
    }
  }

  if (gaVersions.length === 0) return 0.1

  var bestIndex = -1
  for (var i = 0; i < tvs.length; i++) {
    var featureMM = extractMajorMinor(tvs[i])
    if (!featureMM) continue
    var idx = gaVersions.indexOf(featureMM)
    if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) bestIndex = idx
  }

  if (bestIndex === -1) return 0.1

  var posScore = TARGET_VERSION_POSITION_SCORES[bestIndex]
  if (posScore != null) return posScore
  return 0.1
}

function computePriorityScores(features, opts) {
  var options = opts || {}
  var bigRockPriorityMap = options.bigRockPriorityMap || null
  var configuredVersions = options.configuredVersions || []

  var riceValues = []
  for (var i = 0; i < features.length; i++) {
    var rv = getRiceValue(features[i])
    if (rv != null) riceValues.push(rv)
  }

  var riceMin = riceValues.length > 0 ? Math.min.apply(null, riceValues) : 0
  var riceMax = riceValues.length > 0 ? Math.max.apply(null, riceValues) : 0
  var riceRange = riceMax - riceMin

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

    var riceRaw = getRiceValue(f)
    var riceNorm = riceMedian
    if (riceRaw != null) {
      riceNorm = riceRange > 0 ? (riceRaw - riceMin) / riceRange : 0.5
    }

    var bigRockNorm = computeBigRockScore(f, bigRockPriorityMap)

    var tvNorm = computeTargetVersionScore(f, configuredVersions)

    var priorityNorm = PRIORITY_SCORES[f.priority] || PRIORITY_SCORES['Normal']

    var score = (riceNorm * WEIGHTS.rice) +
                (bigRockNorm * WEIGHTS.bigRock) +
                (tvNorm * WEIGHTS.targetVersion) +
                (priorityNorm * WEIGHTS.priority)

    results.set(f.key, {
      score: Math.round(score * 100),
      breakdown: {
        rice: Math.round(riceNorm * 100),
        bigRock: Math.round(bigRockNorm * 100),
        targetVersion: Math.round(tvNorm * 100),
        priority: Math.round(priorityNorm * 100)
      }
    })
  }

  return results
}

module.exports = {
  computePriorityScores: computePriorityScores,
  computeBigRockScore: computeBigRockScore,
  computeTargetVersionScore: computeTargetVersionScore,
  getRiceValue: getRiceValue,
  WEIGHTS: WEIGHTS,
  PRIORITY_SCORES: PRIORITY_SCORES,
  TARGET_VERSION_POSITION_SCORES: TARGET_VERSION_POSITION_SCORES
}
