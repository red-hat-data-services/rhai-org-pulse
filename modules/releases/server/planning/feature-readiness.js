var { getConfiguredReleases } = require('./config')

var RICE_MAX = 16900 // 13 × 13 × 100 ÷ 1 (theoretical max: max Reach × max Impact × max Confidence ÷ min Effort)

var TIER_SCORES     = { T1: 1.0, T2: 0.6, T3: 0.2 }
var PRIORITY_SCORES = { Blocker: 1.0, Critical: 0.8, Major: 0.6, Normal: 0.4, Minor: 0.2 }

var EARLY_STATUSES = ['New', 'Refinement']

var BLOCKING_HYGIENE_RULES = ['missing-assignee', 'missing-fix-version', 'missing-target-version', 'open-children-on-closed']

function computeTierScore(feature) {
  if (feature.tier === 'T1' && feature.rockPriority != null && feature.rockPriority > 0) {
    return Math.max(0.3, 1.0 - (feature.rockPriority - 1) * 0.1)
  }
  return TIER_SCORES[feature.tier] || 0
}

function computeTargetVersionScore(feature, configuredVersions) {
  if (!configuredVersions || configuredVersions.length === 0) return null
  var tvs = feature.targetVersions || []
  if (tvs.length === 0) return 0.0
  var bestIndex = configuredVersions.length
  for (var i = 0; i < tvs.length; i++) {
    var idx = configuredVersions.indexOf(tvs[i])
    if (idx === -1) {
      for (var j = 0; j < configuredVersions.length; j++) {
        if (tvs[i].indexOf(configuredVersions[j]) !== -1 || configuredVersions[j].indexOf(tvs[i]) !== -1) {
          idx = j
          break
        }
      }
    }
    if (idx !== -1 && idx < bestIndex) bestIndex = idx
  }
  if (bestIndex >= configuredVersions.length) return 0.1
  if (configuredVersions.length === 1) return 1.0
  return 1.0 - (bestIndex / (configuredVersions.length - 1)) * 0.7
}

function computeBestAvailableScore(feature, configuredVersions) {
  var signals = []
  var hasValueSignal = feature.riceScore != null || (feature.rubricTotal || 0) > 0

  if (feature.riceScore != null) {
    signals.push({ value: feature.riceScore / RICE_MAX, weight: 30 })
  } else if ((feature.rubricTotal || 0) > 0) {
    signals.push({ value: feature.rubricTotal / 8, weight: 30 })
  }

  if (feature.tier != null) {
    signals.push({ value: computeTierScore(feature), weight: hasValueSignal ? 25 : 40 })
  }

  signals.push({ value: PRIORITY_SCORES[feature.priority] || 0.4, weight: hasValueSignal ? 25 : 35 })

  var tvScore = computeTargetVersionScore(feature, configuredVersions)
  if (tvScore != null) {
    signals.push({ value: tvScore, weight: hasValueSignal ? 20 : 25 })
  }

  var totalWeight = 0
  var weightedSum = 0
  for (var i = 0; i < signals.length; i++) {
    totalWeight += signals[i].weight
    weightedSum += signals[i].value * signals[i].weight
  }

  return Math.round((weightedSum / totalWeight) * 100)
}

function computeBlockers(feature, productPath) {
  var blockingDimensions = []
  var reviewers = feature.reviewers || {}
  var dims = Object.keys(reviewers)
  for (var i = 0; i < dims.length; i++) {
    var dim = dims[i]
    var verdict = reviewers[dim]
    if (verdict === 'revise' || verdict === 'reject') {
      var score = feature.scores && feature.scores[dim] != null ? feature.scores[dim] : null
      blockingDimensions.push({ dimension: dim, verdict: verdict, score: score })
    }
  }

  var actionRequired = null
  var status = feature.humanReviewStatus
  if (status === 'needs-review') {
    actionRequired = productPath === 'health-pipeline'
      ? 'Open the Jira issue, resolve the flagged dimensions, and update the feature status'
      : 'Open the Jira issue, add Staff Engineer feedback in the description, then remove the strat-creator-needs-attention label to unblock re-refinement'
  } else if (status === 'awaiting-review') {
    actionRequired = productPath === 'health-pipeline'
      ? 'Open the Jira issue and verify all Definition of Readiness checks pass'
      : 'Open the Jira issue and add the strat-creator-human-sign-off label when ready'
  }

  return { blockingDimensions: blockingDimensions, actionRequired: actionRequired }
}

function isHealthFeatureReady(hd, cd) {
  var hasOwner = !!(hd.deliveryOwner || hd.assignee)
  var notBlocked = !(hd.blockerCount > 0)
  var pastRefinement = !!hd.status && EARLY_STATUSES.indexOf(hd.status) === -1
  var hasTargetVersion = !!(
    (hd.targetRelease && hd.targetRelease.length > 0) ||
    (cd && cd.targetRelease)
  )
  return hasOwner && notBlocked && pastRefinement && hasTargetVersion
}

function hasBlockingViolations(violations) {
  if (!violations || !Array.isArray(violations) || violations.length === 0) return false
  for (var i = 0; i < violations.length; i++) {
    if (BLOCKING_HYGIENE_RULES.indexOf(violations[i].id) !== -1) return true
  }
  return false
}

function computeConfidence(isReady, fixVersion) {
  if (!isReady) return 'not-ready'
  if (fixVersion) return 'committed'
  return 'ready'
}

function collectFilterMeta(feature, allComponents, allPriorities, allBigRocks, allTargetVersions, allFixVersions, allTeams) {
  if (Array.isArray(feature.components)) {
    for (var i = 0; i < feature.components.length; i++) {
      allComponents.push(feature.components[i])
    }
  }
  if (feature.priority) allPriorities.add(feature.priority)
  if (feature.bigRock) {
    var rockParts = feature.bigRock.split(', ')
    for (var rpi = 0; rpi < rockParts.length; rpi++) {
      allBigRocks.add(rockParts[rpi])
    }
  }
  for (var tvi = 0; tvi < feature.targetVersions.length; tvi++) {
    allTargetVersions.add(feature.targetVersions[tvi])
  }
  if (feature.fixVersion) allFixVersions.add(feature.fixVersion)
  if (feature.team) allTeams.add(feature.team)
}

function buildFeatureReadiness(readFromStorage) {
  var raw = readFromStorage('ai-impact/features.json')
  if (!raw || !raw.features) {
    raw = { features: {} }
  }

  var candidateIndex = new Map()
  var healthIndex = new Map()
  var teamIndex = new Map()
  var hygieneIndex = new Map()

  var registry = readFromStorage('releases/registry.json')
  var registryReleases = (registry && registry.releases) || []

  var versionAliasMap = {}
  var releasedVersions = new Set()
  for (var ri = 0; ri < registryReleases.length; ri++) {
    var rel = registryReleases[ri]
    var aliases = [rel.displayName, rel.id].concat(rel.fixVersions || []).filter(Boolean)
    for (var ai = 0; ai < aliases.length; ai++) {
      versionAliasMap[aliases[ai]] = aliases
    }
    var isArchived = rel.state === 'archived'
    var gaDate = rel.milestones && (rel.milestones.gaDate || rel.milestones.ga)
    var isReleased = false
    if (gaDate) {
      var gaTime = new Date(gaDate + 'T00:00:00Z').getTime()
      if (!isNaN(gaTime) && Date.now() > gaTime) isReleased = true
    }
    if (isArchived || isReleased) {
      for (var rvi = 0; rvi < aliases.length; rvi++) {
        releasedVersions.add(aliases[rvi])
      }
    }
  }

  var configuredVersions = getConfiguredReleases(readFromStorage).map(function(r) { return r.version })

  for (var cvi = 0; cvi < configuredVersions.length; cvi++) {
    var cv = configuredVersions[cvi]
    if (!versionAliasMap[cv]) {
      for (var ri2 = 0; ri2 < registryReleases.length; ri2++) {
        var rel2 = registryReleases[ri2]
        var a2 = [rel2.displayName, rel2.id].concat(rel2.fixVersions || []).filter(Boolean)
        for (var ai2 = 0; ai2 < a2.length; ai2++) {
          if (a2[ai2].indexOf(cv) !== -1 || cv.indexOf(a2[ai2]) !== -1) {
            versionAliasMap[cv] = a2
            break
          }
        }
        if (versionAliasMap[cv]) break
      }
    }
  }

  for (var vi = 0; vi < configuredVersions.length; vi++) {
    var ver = configuredVersions[vi]
    var candidateCache = readFromStorage('releases/planning/candidates-cache-' + ver + '.json')
    if (candidateCache && candidateCache.data && Array.isArray(candidateCache.data.features)) {
      var candidates = candidateCache.data.features
      for (var ci = 0; ci < candidates.length; ci++) {
        var c = candidates[ci]
        if (c.issueKey && !candidateIndex.has(c.issueKey)) candidateIndex.set(c.issueKey, c)
      }
    }

    var healthCache = readFromStorage('releases/planning/health-cache-' + ver + '-all.json')
    if (healthCache && Array.isArray(healthCache.features)) {
      var hf = healthCache.features
      for (var hi = 0; hi < hf.length; hi++) {
        var h = hf[hi]
        if (h.key && !healthIndex.has(h.key)) healthIndex.set(h.key, h)
      }
    }

    var hygieneData = readFromStorage('releases/hygiene/features-' + ver + '.json')
    if (!hygieneData && versionAliasMap[ver]) {
      var hygieneAliases = versionAliasMap[ver]
      for (var ali = 0; ali < hygieneAliases.length && !hygieneData; ali++) {
        if (hygieneAliases[ali] !== ver) {
          hygieneData = readFromStorage('releases/hygiene/features-' + hygieneAliases[ali] + '.json')
        }
      }
    }
    if (hygieneData && hygieneData.features) {
      var hkeys = Object.keys(hygieneData.features)
      for (var ti = 0; ti < hkeys.length; ti++) {
        var feat = hygieneData.features[hkeys[ti]]
        if (feat) {
          if (!teamIndex.has(hkeys[ti]) && feat.team) teamIndex.set(hkeys[ti], feat.team)
          if (!hygieneIndex.has(hkeys[ti]) && feat.violations) hygieneIndex.set(hkeys[ti], feat.violations)
        }
      }
    }
  }

  var hasCaches = candidateIndex.size > 0 || healthIndex.size > 0

  var pendingReview = []
  var ready = []
  var allComponents = []
  var allPriorities = new Set()
  var allBigRocks = new Set()
  var allTargetVersions = new Set()
  var allFixVersions = new Set()
  var allTeams = new Set()

  // First pass: strat-creator features (from ai-impact/features.json)
  var keys = Object.keys(raw.features)
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i]
    var entry = raw.features[key]
    if (!entry || !entry.latest) continue
    var latest = entry.latest

    var scores = latest.scores || {}
    var rubricTotal = (scores.feasibility || 0) + (scores.testability || 0) + (scores.scope || 0) + (scores.architecture || 0)

    var candidateData = candidateIndex.get(key) || null
    var healthData = healthIndex.get(key) || null

    if (hasCaches && !candidateData && !healthData) continue

    var tier = candidateData && candidateData.tier != null
      ? 'T' + candidateData.tier
      : (healthData ? healthData.tier || null : null)
    var bigRock = candidateData
      ? candidateData.bigRock || null
      : (healthData ? healthData.bigRock || null : null)
    var rockPriority = candidateData ? candidateData.rockPriority || null : null
    var targetVersions = candidateData && candidateData.targetRelease
      ? [candidateData.targetRelease]
      : (healthData && healthData.targetRelease ? [healthData.targetRelease] : [])
    var fixVersion = candidateData
      ? candidateData.fixVersion || null
      : (healthData ? healthData.fixVersions || null : null)
    var deliveryOwner = healthData ? healthData.deliveryOwner || null : null
    var team = teamIndex.get(key) || null

    var priorityScore = healthData ? (healthData.priorityScore != null ? healthData.priorityScore : null) : null
    var priorityScoreBreakdown = healthData ? (healthData.priorityBreakdown || healthData.priorityScoreBreakdown || null) : null

    var priorityScoreFallback = priorityScore === null
    var effectivePriorityScore = priorityScore !== null
      ? priorityScore
      : computeBestAvailableScore(Object.assign({}, latest, { rubricTotal: rubricTotal, tier: tier, rockPriority: rockPriority, targetVersions: targetVersions }), configuredVersions)

    var blockerResult = computeBlockers(Object.assign({}, latest, { rubricTotal: rubricTotal }))

    var healthComponents = healthData && healthData.components
      ? healthData.components.split(', ').filter(Boolean)
      : []
    var componentsList = (latest.components && latest.components.length > 0)
      ? latest.components
      : healthComponents

    var violations = hygieneIndex.get(key) || null
    var isApproved = latest.humanReviewStatus === 'approved'
    var blockedByHygiene = hasBlockingViolations(violations)
    var isReady = isApproved && !blockedByHygiene
    var confidence = computeConfidence(isReady, fixVersion)

    var readinessGates = {
      ownerAssigned: !!(deliveryOwner || (healthData && healthData.assignee) || latest.approvedBy),
      notBlocked: blockerResult.blockingDimensions.length === 0,
      pastRefinement: !!latest.status && EARLY_STATUSES.indexOf(latest.status) === -1,
      hasTargetVersion: targetVersions.length > 0,
      noBlockingViolations: !blockedByHygiene
    }

    var feature = {
      key: key,
      title: latest.title,
      sourceRfe: latest.sourceRfe,
      priority: latest.priority,
      status: latest.status,
      size: latest.size,
      recommendation: latest.recommendation,
      needsAttention: latest.needsAttention,
      humanReviewStatus: latest.humanReviewStatus,
      riceScore: latest.riceScore != null ? latest.riceScore : null,
      rubricTotal: rubricTotal,
      scores: scores,
      reviewers: latest.reviewers || {},
      components: componentsList,
      deliveryOwner: deliveryOwner,
      team: team,
      reviewedAt: latest.reviewedAt,
      approvedBy: latest.approvedBy || null,
      approvedAt: latest.approvedAt || null,
      tier: tier,
      bigRock: bigRock,
      rockPriority: rockPriority,
      targetVersions: targetVersions,
      fixVersion: fixVersion,
      priorityScore: priorityScore,
      priorityScoreBreakdown: priorityScoreBreakdown,
      priorityScoreFallback: priorityScoreFallback,
      effectivePriorityScore: effectivePriorityScore,
      blockingDimensions: blockerResult.blockingDimensions,
      actionRequired: blockerResult.actionRequired,
      dataSource: 'strat-creator',
      confidence: confidence,
      readinessGates: readinessGates,
      violations: violations
    }

    if (isReady) {
      ready.push(feature)
    } else {
      pendingReview.push(feature)
    }

    collectFilterMeta(feature, allComponents, allPriorities, allBigRocks, allTargetVersions, allFixVersions, allTeams)
  }

  // Second pass: features in health/candidates caches but not in ai-impact (health-pipeline-only)
  var cacheKeys = Array.from(healthIndex.keys())
  for (var ci3 = 0; ci3 < cacheKeys.length; ci3++) {
    var ckey = cacheKeys[ci3]
    if (raw.features[ckey]) continue

    var hd = healthIndex.get(ckey)
    var cd = candidateIndex.get(ckey) || null

    var hpTier = cd && cd.tier != null ? 'T' + cd.tier : (hd.tier || null)
    var hpRockPriority = cd ? cd.rockPriority || null : null
    var hpBigRock = cd ? cd.bigRock || null : (hd.bigRock || null)
    var hpTargetVersions = cd && cd.targetRelease
      ? [cd.targetRelease]
      : (hd.targetRelease ? [hd.targetRelease] : [])
    var hpFixVersion = cd ? cd.fixVersion || null : (hd.fixVersions || null)
    var hpComponents = hd.components
      ? hd.components.split(', ').filter(Boolean)
      : []
    var hpTeam = teamIndex.get(ckey) || null

    var hpPriorityScore = hd.priorityScore != null ? hd.priorityScore : null
    var hpPriorityBreakdown = hd.priorityBreakdown || null
    var hpFallback = hpPriorityScore === null
    var hpEffective = hpPriorityScore !== null
      ? hpPriorityScore
      : computeBestAvailableScore({
          tier: hpTier,
          priority: hd.priority,
          riceScore: hd.rice && hd.rice.score != null ? hd.rice.score : null,
          rubricTotal: 0,
          rockPriority: hpRockPriority,
          targetVersions: hpTargetVersions
        }, configuredVersions)

    var hpViolations = hygieneIndex.get(ckey) || null
    var hpGatesReady = isHealthFeatureReady(hd, cd)
    var hpBlockedByHygiene = hasBlockingViolations(hpViolations)
    var hpReady = hpGatesReady && !hpBlockedByHygiene
    var hpConfidence = computeConfidence(hpReady, hpFixVersion)

    var hpFeature = {
      key: ckey,
      title: hd.summary || ckey,
      sourceRfe: null,
      priority: hd.priority || null,
      status: hd.status || null,
      size: hd.tshirtSize || null,
      recommendation: null,
      needsAttention: false,
      humanReviewStatus: null,
      riceScore: hd.rice && hd.rice.score != null ? hd.rice.score : null,
      rubricTotal: 0,
      scores: {},
      reviewers: {},
      components: hpComponents,
      deliveryOwner: hd.deliveryOwner || null,
      team: hpTeam,
      reviewedAt: null,
      approvedBy: null,
      approvedAt: null,
      tier: hpTier,
      bigRock: hpBigRock,
      rockPriority: hpRockPriority,
      targetVersions: hpTargetVersions,
      fixVersion: hpFixVersion,
      priorityScore: hpPriorityScore,
      priorityScoreBreakdown: hpPriorityBreakdown,
      priorityScoreFallback: hpFallback,
      effectivePriorityScore: hpEffective,
      blockingDimensions: [],
      actionRequired: null,
      dataSource: 'health-pipeline',
      confidence: hpConfidence,
      readinessGates: {
        ownerAssigned: !!(hd.deliveryOwner || hd.assignee),
        notBlocked: !(hd.blockerCount > 0),
        pastRefinement: !!hd.status && EARLY_STATUSES.indexOf(hd.status) === -1,
        hasTargetVersion: !!(
          (hd.targetRelease && hd.targetRelease.length > 0) ||
          (cd && cd.targetRelease)
        ),
        noBlockingViolations: !hpBlockedByHygiene
      },
      violations: hpViolations
    }

    if (hpReady) {
      ready.push(hpFeature)
    } else {
      pendingReview.push(hpFeature)
    }

    collectFilterMeta(hpFeature, allComponents, allPriorities, allBigRocks, allTargetVersions, allFixVersions, allTeams)
  }

  function sortFeatures(a, b) {
    if (b.effectivePriorityScore !== a.effectivePriorityScore) {
      return b.effectivePriorityScore - a.effectivePriorityScore
    }
    return b.rubricTotal - a.rubricTotal
  }

  function isReleasedFeature(feature) {
    var tvs = feature.targetVersions || []
    if (tvs.length === 0) return false
    for (var tvi2 = 0; tvi2 < tvs.length; tvi2++) {
      if (!releasedVersions.has(tvs[tvi2])) return false
    }
    return true
  }

  pendingReview = pendingReview.filter(function(f) { return !isReleasedFeature(f) })
  ready = ready.filter(function(f) { return !isReleasedFeature(f) })

  pendingReview.sort(sortFeatures)
  ready.sort(sortFeatures)

  var uniqueComponents = Array.from(new Set(allComponents)).sort()

  var filterMeta = {
    components: uniqueComponents,
    priorities: Array.from(allPriorities).sort(),
    bigRocks: Array.from(allBigRocks).sort(),
    targetVersions: Array.from(allTargetVersions).sort(),
    fixVersions: Array.from(allFixVersions).sort(),
    teams: Array.from(allTeams).sort()
  }

  var meta = {
    total: pendingReview.length + ready.length,
    pendingReviewCount: pendingReview.length,
    readyCount: ready.length,
    versions: configuredVersions,
    lastSyncedAt: raw.lastSyncedAt || null
  }

  return { pendingReview: pendingReview, ready: ready, filterMeta: filterMeta, meta: meta }
}

module.exports = { buildFeatureReadiness: buildFeatureReadiness, computeBlockers: computeBlockers, computeBestAvailableScore: computeBestAvailableScore, isHealthFeatureReady: isHealthFeatureReady, computeTierScore: computeTierScore, computeTargetVersionScore: computeTargetVersionScore, hasBlockingViolations: hasBlockingViolations, computeConfidence: computeConfidence, collectFilterMeta: collectFilterMeta, BLOCKING_HYGIENE_RULES: BLOCKING_HYGIENE_RULES }
