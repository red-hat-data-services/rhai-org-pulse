var { getConfiguredReleases } = require('./config')
var { loadIndex } = require('./cache-reader')
var { CLOSED_STATUSES } = require('./constants')
var { evaluateHygiene } = require('../hygiene/hygiene-rules')
var { loadConfig: loadHygieneConfig } = require('../hygiene/config')
var { deriveHumanReviewStatus: sharedDeriveStatus } = require('../execution/ai-review-fields')

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

var COMPLETENESS_MULTIPLIERS = [0, 0.5, 0.7, 0.85, 1.0]
var MAX_SIGNALS = 4

function computeBestAvailableScore(feature, configuredVersions) {
  var signals = []
  var missing = []
  var hasValueSignal = feature.riceScore != null || (feature.rubricTotal || 0) > 0

  if (feature.riceScore != null) {
    signals.push({ name: "RICE Score", value: feature.riceScore / RICE_MAX, weight: 30, raw: feature.riceScore })
  } else if ((feature.rubricTotal || 0) > 0) {
    signals.push({ name: "Rubric", value: feature.rubricTotal / 8, weight: 30, raw: feature.rubricTotal })
  } else {
    missing.push("RICE Score")
  }

  if (feature.tier != null) {
    signals.push({ name: "Tier", value: computeTierScore(feature), weight: hasValueSignal ? 25 : 40, raw: feature.tier })
  } else {
    missing.push("Tier")
  }

  signals.push({ name: "Priority", value: PRIORITY_SCORES[feature.priority] || 0.4, weight: hasValueSignal ? 25 : 35, raw: feature.priority || "Normal" })

  var tvScore = computeTargetVersionScore(feature, configuredVersions)
  if (tvScore != null) {
    signals.push({ name: "Target Version", value: tvScore, weight: hasValueSignal ? 20 : 25, raw: (feature.targetVersions || []).join(", ") || "none" })
  } else {
    missing.push("Target Version")
  }

  var totalWeight = 0
  var weightedSum = 0
  for (var i = 0; i < signals.length; i++) {
    totalWeight += signals[i].weight
    weightedSum += signals[i].value * signals[i].weight
  }

  var rawScore = Math.round((weightedSum / totalWeight) * 100)
  var signalCount = signals.length
  var completenessMultiplier = COMPLETENESS_MULTIPLIERS[Math.min(signalCount, MAX_SIGNALS)]
  var score = Math.round(rawScore * completenessMultiplier)

  return {
    score: score,
    rawScore: rawScore,
    signals: signals,
    signalCount: signalCount,
    maxSignals: MAX_SIGNALS,
    completenessMultiplier: completenessMultiplier,
    missing: missing
  }
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
    var rocks = feature.bigRock.split(', ')
    for (var bri = 0; bri < rocks.length; bri++) {
      if (rocks[bri]) allBigRocks.add(rocks[bri])
    }
  }
  for (var tvi = 0; tvi < feature.targetVersions.length; tvi++) {
    allTargetVersions.add(feature.targetVersions[tvi])
  }
  if (feature.fixVersion) allFixVersions.add(feature.fixVersion)
  if (feature.team) allTeams.add(feature.team)
}

function deriveHumanReviewStatusFromLabels(labels) {
  return sharedDeriveStatus(labels)
}

function buildFeatureReadiness(readFromStorage, jiraFeatures, listStorageFiles) {
  // Read AI review data from the unified releases execution store
  var execIndexData = loadIndex(readFromStorage)
  var aiReviewFeatures = {}
  var execFeatures = execIndexData.features || []
  for (var ari = 0; ari < execFeatures.length; ari++) {
    var arEntry = execFeatures[ari]
    if (arEntry.key && arEntry.aiReview) {
      // Read full feature file for complete aiReview data
      var fullFeature = readFromStorage('releases/execution/features/' + arEntry.key + '.json')
      if (fullFeature && fullFeature.aiReview) {
        aiReviewFeatures[arEntry.key] = {
          latest: {
            key: arEntry.key,
            title: fullFeature.aiReview.title || fullFeature.summary || arEntry.key,
            sourceRfe: fullFeature.aiReview.sourceRfe || fullFeature.linkedRfeKey || null,
            priority: fullFeature.priority || arEntry.priority || 'Undefined',
            status: fullFeature.status || arEntry.status || null,
            size: fullFeature.aiReview.size || null,
            recommendation: fullFeature.aiReview.recommendation || null,
            needsAttention: fullFeature.aiReview.needsAttention || false,
            humanReviewStatus: fullFeature.aiReview.humanReviewStatus || null,
            scores: fullFeature.aiReview.scores || {},
            reviewers: fullFeature.aiReview.reviewers || {},
            reviewedAt: fullFeature.aiReview.reviewedAt || null,
            components: fullFeature.components || (fullFeature.aiReview.components || []),
            approvedBy: fullFeature.aiReview.approvedBy || null,
            approvedAt: fullFeature.aiReview.approvedAt || null,
            riceScore: fullFeature.riceScore || null,
            labels: fullFeature.labels || []
          },
          history: fullFeature.aiReview.history || []
        }
      }
    }
  }
  var raw = {
    features: aiReviewFeatures,
    lastSyncedAt: execIndexData.fetchedAt || null
  }

  var processedKeys = new Set()

  var candidateIndex = new Map()
  var healthIndex = new Map()
  var teamIndex = new Map()
  var hygieneIndex = new Map()

  var registry = readFromStorage('releases/registry.json')
  var registryReleases = (registry && registry.releases) || []

  var versionAliasMap = {}
  for (var ri = 0; ri < registryReleases.length; ri++) {
    var rel = registryReleases[ri]
    var aliases = [rel.displayName, rel.id].concat(rel.fixVersions || []).filter(Boolean)
    for (var ai = 0; ai < aliases.length; ai++) {
      versionAliasMap[aliases[ai]] = aliases
    }
  }

  var configuredVersions = getConfiguredReleases(readFromStorage).map(function(r) { return r.version })

  var hygieneRulesConfig = {}
  try {
    var hConfig = loadHygieneConfig({ readFromStorage: readFromStorage })
    hygieneRulesConfig = hConfig.rules || {}
  } catch {
    // hygiene config not available
  }

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

  if (listStorageFiles) {
    var hygieneFiles = []
    try { hygieneFiles = listStorageFiles('releases/hygiene') } catch { /* directory may not exist */ }
    for (var hfi = 0; hfi < hygieneFiles.length; hfi++) {
      var hfMatch = hygieneFiles[hfi].match(/^features-(.+)\.json$/)
      if (!hfMatch) continue
      try {
        var hfData = readFromStorage('releases/hygiene/' + hygieneFiles[hfi])
        if (!hfData || !hfData.features) continue
        var hfKeys = Object.keys(hfData.features)
        for (var hfki = 0; hfki < hfKeys.length; hfki++) {
          var hfFeat = hfData.features[hfKeys[hfki]]
          if (!hfFeat) continue
          if (!teamIndex.has(hfKeys[hfki]) && hfFeat.team) teamIndex.set(hfKeys[hfki], hfFeat.team)
          if (!hygieneIndex.has(hfKeys[hfki]) && hfFeat.violations) hygieneIndex.set(hfKeys[hfki], hfFeat.violations)
        }
      } catch {
        console.warn('[releases/planning] Failed to load hygiene file:', hygieneFiles[hfi])
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

  // First pass: strat-creator features (from unified releases execution store)
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

    processedKeys.add(key)

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
    var deliveryOwner = (healthData ? healthData.deliveryOwner || null : null) || (jiraFeatures && jiraFeatures.has(key) ? jiraFeatures.get(key).assignee : null) || null
    var team = teamIndex.get(key) || (jiraFeatures && jiraFeatures.has(key) ? jiraFeatures.get(key).team : null) || null

    var priorityScore = healthData ? (healthData.priorityScore != null ? healthData.priorityScore : null) : null
    var priorityScoreFallback = priorityScore === null
    var fallbackResult = priorityScoreFallback
      ? computeBestAvailableScore(Object.assign({}, latest, { rubricTotal: rubricTotal, tier: tier, rockPriority: rockPriority, targetVersions: targetVersions }), configuredVersions)
      : null
    var effectivePriorityScore = priorityScoreFallback ? fallbackResult.score : priorityScore
    var priorityScoreBreakdown = priorityScoreFallback
      ? fallbackResult
      : (healthData ? (healthData.priorityBreakdown || healthData.priorityScoreBreakdown || null) : null)

    var blockerResult = computeBlockers(Object.assign({}, latest, { rubricTotal: rubricTotal }))

    var healthComponents = healthData && healthData.components
      ? healthData.components.split(', ').filter(Boolean)
      : []
    var jiraComponents = jiraFeatures && jiraFeatures.has(key) ? jiraFeatures.get(key).components || [] : []
    var componentsList = (latest.components && latest.components.length > 0)
      ? latest.components
      : (healthComponents.length > 0 ? healthComponents : jiraComponents)

    var violations = hygieneIndex.get(key) || null
    if (!violations && jiraFeatures && jiraFeatures.has(key)) {
      try {
        var jf = jiraFeatures.get(key)
        violations = evaluateHygiene({
          key: key, summary: jf.summary || latest.title, status: jf.status || latest.status,
          issueType: jf.issueType, assignee: jf.assignee, team: team,
          components: componentsList, fixVersions: jf.fixVersions || [],
          labels: jf.labels || [], statusSummary: jf.statusSummary || null,
          colorStatus: jf.colorStatus || null, releaseType: jf.releaseType || null,
          docsRequired: jf.docsRequired || null, targetEnd: jf.targetEnd || null,
          riceScore: jf.riceScore || null
        }, hygieneRulesConfig)
        if (violations && violations.length === 0) violations = null
      } catch {
        // dynamic evaluation failed, leave violations as null
      }
    }
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

  // Second pass: features in health/candidates caches but not in strat-creator data (health-pipeline-only)
  var cacheKeys = Array.from(healthIndex.keys())
  for (var ci3 = 0; ci3 < cacheKeys.length; ci3++) {
    var ckey = cacheKeys[ci3]
    if (processedKeys.has(ckey)) continue

    processedKeys.add(ckey)

    var hd = healthIndex.get(ckey)
    var cd = candidateIndex.get(ckey) || null

    var hpTier = cd && cd.tier != null ? 'T' + cd.tier : (hd.tier || null)
    var hpRockPriority = cd ? cd.rockPriority || null : null
    var hpBigRock = cd ? cd.bigRock || null : (hd.bigRock || null)
    var hpTargetVersions = cd && cd.targetRelease
      ? [cd.targetRelease]
      : (hd.targetRelease ? [hd.targetRelease] : [])
    var hpFixVersion = cd ? cd.fixVersion || null : (hd.fixVersions || null)
    var hpJiraComponents = jiraFeatures && jiraFeatures.has(ckey) ? jiraFeatures.get(ckey).components || [] : []
    var hpComponents = hd.components
      ? hd.components.split(', ').filter(Boolean)
      : hpJiraComponents
    var hpTeam = teamIndex.get(ckey) || (jiraFeatures && jiraFeatures.has(ckey) ? jiraFeatures.get(ckey).team : null) || null

    var hpPriorityScore = hd.priorityScore != null ? hd.priorityScore : null
    var hpFallback = hpPriorityScore === null
    var hpFallbackResult = hpFallback
      ? computeBestAvailableScore({
          tier: hpTier,
          priority: hd.priority,
          riceScore: hd.rice && hd.rice.score != null ? hd.rice.score : null,
          rubricTotal: 0,
          rockPriority: hpRockPriority,
          targetVersions: hpTargetVersions
        }, configuredVersions)
      : null
    var hpEffective = hpFallback ? hpFallbackResult.score : hpPriorityScore
    var hpPriorityBreakdown = hpFallback ? hpFallbackResult : (hd.priorityBreakdown || null)

    var hpViolations = hygieneIndex.get(ckey) || null
    if (!hpViolations && jiraFeatures && jiraFeatures.has(ckey)) {
      try {
        var hpJf = jiraFeatures.get(ckey)
        hpViolations = evaluateHygiene({
          key: ckey, summary: hpJf.summary || hd.summary, status: hpJf.status || hd.status,
          issueType: hpJf.issueType, assignee: hpJf.assignee || hd.assignee,
          team: hpTeam, components: hpComponents, fixVersions: hpJf.fixVersions || [],
          labels: hpJf.labels || [], statusSummary: hpJf.statusSummary || null,
          colorStatus: hpJf.colorStatus || null, releaseType: hpJf.releaseType || null,
          docsRequired: hpJf.docsRequired || null, targetEnd: hpJf.targetEnd || null,
          riceScore: hpJf.riceScore || null
        }, hygieneRulesConfig)
        if (hpViolations && hpViolations.length === 0) hpViolations = null
      } catch {
        // dynamic evaluation failed, leave violations as null
      }
    }
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

  // Third pass: Jira features as primary source, execution index as fallback
  // Reuse execIndexData loaded at the top (for AI review data)
  var execMap = new Map()
  for (var emi = 0; emi < execFeatures.length; emi++) {
    if (execFeatures[emi].key) execMap.set(execFeatures[emi].key, execFeatures[emi])
  }

  var pass3Source = jiraFeatures && jiraFeatures.size > 0
    ? Array.from(jiraFeatures.values())
    : execFeatures
  var pass3DataSource = jiraFeatures && jiraFeatures.size > 0 ? 'jira' : 'execution'

  for (var ei = 0; ei < pass3Source.length; ei++) {
    var ef = pass3Source[ei]
    if (!ef.key || processedKeys.has(ef.key)) continue
    if (ef.status && CLOSED_STATUSES.indexOf(ef.status) !== -1) continue

    processedKeys.add(ef.key)

    var execData = execMap.get(ef.key) || null

    var efLabels = Array.isArray(ef.labels) ? ef.labels : []
    var efHumanReviewStatus = deriveHumanReviewStatusFromLabels(efLabels)
    var efTargetVersions = Array.isArray(ef.targetVersions) ? ef.targetVersions : []
    var efFixVersions = Array.isArray(ef.fixVersions) ? ef.fixVersions : []
    var efFixVersion = efFixVersions.length > 0 ? efFixVersions[0] : null
    var efComponents = []
    if (typeof ef.components === 'string' && ef.components) {
      efComponents = ef.components.split(', ').filter(Boolean)
    } else if (Array.isArray(ef.components)) {
      efComponents = ef.components
    }
    var efAssignee = typeof ef.assignee === 'string' ? ef.assignee : (ef.assignee && ef.assignee.displayName ? ef.assignee.displayName : null)
    var efTeam = teamIndex.get(ef.key) || ef.team || null
    var efViolations = hygieneIndex.get(ef.key) || null
    if (!efViolations && pass3DataSource === 'jira') {
      try {
        efViolations = evaluateHygiene({
          key: ef.key,
          summary: ef.summary,
          status: ef.status,
          issueType: ef.issueType,
          assignee: efAssignee,
          team: efTeam,
          components: efComponents,
          fixVersions: efFixVersions,
          labels: efLabels,
          statusSummary: ef.statusSummary || null,
          colorStatus: ef.colorStatus || null,
          releaseType: ef.releaseType || null,
          docsRequired: ef.docsRequired || null,
          targetEnd: ef.targetEnd || null,
          riceScore: ef.riceScore || null
        }, hygieneRulesConfig)
        if (efViolations && efViolations.length === 0) efViolations = null
      } catch {
        // dynamic evaluation failed, leave as null
      }
    }

    var efCandidateData = candidateIndex.get(ef.key) || null
    var efTier = efCandidateData && efCandidateData.tier != null ? 'T' + efCandidateData.tier : null
    var efBigRock = efCandidateData ? efCandidateData.bigRock || null : null
    var efRockPriority = efCandidateData ? efCandidateData.rockPriority || null : null

    var efRiceScore = ef.riceScore != null ? ef.riceScore : (execData && execData.riceScore != null ? execData.riceScore : null)

    var efFallbackResult = computeBestAvailableScore({
      tier: efTier,
      priority: ef.priority || null,
      riceScore: efRiceScore,
      rubricTotal: 0,
      rockPriority: efRockPriority,
      targetVersions: efTargetVersions
    }, configuredVersions)
    var efEffective = efFallbackResult.score

    var efBlockedByHygiene = hasBlockingViolations(efViolations)
    var efIsApproved = efHumanReviewStatus === 'approved'
    var efHasOwner = !!efAssignee
    var efPastRefinement = !!ef.status && EARLY_STATUSES.indexOf(ef.status) === -1
    var efHasTargetVersion = efTargetVersions.length > 0
    var efBlockerCount = execData ? (execData.blockerCount || 0) : (ef.blockerCount || 0)
    var efIsReady = efIsApproved && !efBlockedByHygiene && efHasOwner && efPastRefinement && efHasTargetVersion
    var efConfidence = computeConfidence(efIsReady, efFixVersion)

    var efFeature = {
      key: ef.key,
      title: ef.summary || ef.key,
      sourceRfe: null,
      priority: ef.priority || null,
      status: ef.status || null,
      size: null,
      recommendation: null,
      needsAttention: false,
      humanReviewStatus: efHumanReviewStatus,
      riceScore: efRiceScore,
      rubricTotal: 0,
      scores: {},
      reviewers: {},
      components: efComponents,
      deliveryOwner: efAssignee,
      team: efTeam,
      reviewedAt: null,
      approvedBy: null,
      approvedAt: null,
      tier: efTier,
      bigRock: efBigRock,
      rockPriority: efRockPriority,
      targetVersions: efTargetVersions,
      fixVersion: efFixVersion,
      priorityScore: null,
      priorityScoreBreakdown: efFallbackResult,
      priorityScoreFallback: true,
      effectivePriorityScore: efEffective,
      blockingDimensions: [],
      actionRequired: efHumanReviewStatus !== 'approved'
        ? 'Open the Jira issue and add the strat-creator-human-sign-off label when ready'
        : null,
      dataSource: pass3DataSource,
      confidence: efConfidence,
      readinessGates: {
        ownerAssigned: efHasOwner,
        notBlocked: !(efBlockerCount > 0),
        pastRefinement: efPastRefinement,
        hasTargetVersion: efHasTargetVersion,
        noBlockingViolations: !efBlockedByHygiene
      },
      violations: efViolations
    }

    if (efIsReady) {
      ready.push(efFeature)
    } else {
      pendingReview.push(efFeature)
    }

    collectFilterMeta(efFeature, allComponents, allPriorities, allBigRocks, allTargetVersions, allFixVersions, allTeams)
  }

  function sortFeatures(a, b) {
    if (b.effectivePriorityScore !== a.effectivePriorityScore) {
      return b.effectivePriorityScore - a.effectivePriorityScore
    }
    return b.rubricTotal - a.rubricTotal
  }

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

module.exports = { buildFeatureReadiness: buildFeatureReadiness, computeBlockers: computeBlockers, computeBestAvailableScore: computeBestAvailableScore, isHealthFeatureReady: isHealthFeatureReady, computeTierScore: computeTierScore, computeTargetVersionScore: computeTargetVersionScore, hasBlockingViolations: hasBlockingViolations, computeConfidence: computeConfidence, collectFilterMeta: collectFilterMeta, deriveHumanReviewStatusFromLabels: deriveHumanReviewStatusFromLabels, BLOCKING_HYGIENE_RULES: BLOCKING_HYGIENE_RULES, COMPLETENESS_MULTIPLIERS: COMPLETENESS_MULTIPLIERS, MAX_SIGNALS: MAX_SIGNALS }
