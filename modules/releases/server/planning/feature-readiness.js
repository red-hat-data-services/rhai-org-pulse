var { getConfiguredReleases, loadBigRocks } = require('./config')
var { loadIndex } = require('./cache-reader')
var { CLOSED_STATUSES, EARLY_STATUSES } = require('./constants')
var { deriveHumanReviewStatus: sharedDeriveStatus } = require('../execution/ai-review-fields')
var { computeFPDoRReadiness, extractRubricData } = require('./fpdor')
var { computePriorityScores } = require('./health/priority-scorer')

var BLOCKING_HYGIENE_RULES = ['missing-assignee', 'open-children-on-closed']

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

function computeReadiness(feature) {
  var rubricData = extractRubricData(feature)
  var fpdor = computeFPDoRReadiness(feature, rubricData)

  var pastRefinement = !!feature.status && EARLY_STATUSES.indexOf(feature.status) === -1
  var noBlockingViolations = !hasBlockingViolations(feature.violations)

  var isReady = fpdor.passedCount === fpdor.evaluatedCount
    && fpdor.evaluatedCount >= 7
    && pastRefinement
    && noBlockingViolations

  var gates = {
    fpDorPassed: fpdor.passedCount,
    fpDorTotal: fpdor.totalCount,
    fpDorEvaluated: fpdor.evaluatedCount,
    pastRefinement: pastRefinement,
    noBlockingViolations: noBlockingViolations
  }

  return { isReady: isReady, gates: gates, fpdor: fpdor }
}

function hasBlockingViolations(violations) {
  if (!violations || !Array.isArray(violations) || violations.length === 0) return false
  for (var i = 0; i < violations.length; i++) {
    if (BLOCKING_HYGIENE_RULES.indexOf(violations[i].id) !== -1) return true
  }
  return false
}

function computeHygieneStatus(violations) {
  if (!violations || !Array.isArray(violations)) return 'unknown'
  if (violations.length === 0) return 'clean'
  for (var i = 0; i < violations.length; i++) {
    if (BLOCKING_HYGIENE_RULES.indexOf(violations[i].id) !== -1) return 'blocking'
  }
  return 'warning'
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


function loadExecutionData(readFromStorage) {
  var execIndexData = loadIndex(readFromStorage)
  var aiReviewMap = {}
  var execFeatures = execIndexData.features || []
  for (var ari = 0; ari < execFeatures.length; ari++) {
    var arEntry = execFeatures[ari]
    if (arEntry.key && arEntry.aiReview) {
      var fullFeature = readFromStorage('releases/execution/features/' + arEntry.key + '.json')
      if (fullFeature && fullFeature.aiReview) {
        aiReviewMap[arEntry.key] = {
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
  return {
    aiReviewMap: aiReviewMap,
    execFeatures: execFeatures,
    lastSyncedAt: execIndexData.fetchedAt || null
  }
}

function loadCacheIndexes(readFromStorage, listStorageFiles) {
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

  return {
    candidateIndex: candidateIndex,
    healthIndex: healthIndex,
    teamIndex: teamIndex,
    hygieneIndex: hygieneIndex,
    configuredVersions: configuredVersions
  }
}

function buildCanonicalKeySet(jiraFeatures, aiReviewMap, execFeatures, healthIndex) {
  var keys = new Set()
  if (jiraFeatures) jiraFeatures.forEach(function(v, k) { keys.add(k) })
  var aiKeys = Object.keys(aiReviewMap)
  for (var i = 0; i < aiKeys.length; i++) keys.add(aiKeys[i])
  for (var j = 0; j < execFeatures.length; j++) {
    if (execFeatures[j].key) keys.add(execFeatures[j].key)
  }
  healthIndex.forEach(function(v, k) { keys.add(k) })
  return keys
}

function mergeFeatureData(key, jiraFeatures, aiReviewMap, candidateIndex, healthIndex, hygieneIndex, teamIndex, execMap) {
  var jira = jiraFeatures && jiraFeatures.has(key) ? jiraFeatures.get(key) : null
  var aiReview = aiReviewMap[key] ? aiReviewMap[key].latest : null
  var candidate = candidateIndex.get(key) || null
  var health = healthIndex.get(key) || null
  var exec = execMap.get(key) || null
  var violations = hygieneIndex.get(key) || null

  var title = (jira && jira.summary) || (aiReview && aiReview.title) || (health && health.summary) || (exec && exec.summary) || key

  var status = (jira && jira.status) || (aiReview && aiReview.status) || (health && health.status) || (exec && exec.status) || null

  var priority = (jira && jira.priority) || (aiReview && aiReview.priority) || (health && health.priority) || (exec && exec.priority) || null

  var labels
  if (jira && Array.isArray(jira.labels) && jira.labels.length > 0) {
    labels = jira.labels
  } else if (aiReview && Array.isArray(aiReview.labels) && aiReview.labels.length > 0) {
    labels = aiReview.labels
  } else if (exec && Array.isArray(exec.labels)) {
    labels = exec.labels
  } else {
    labels = []
  }

  var targetVersions
  if (jira && Array.isArray(jira.targetVersions) && jira.targetVersions.length > 0) {
    targetVersions = jira.targetVersions
  } else if (candidate && candidate.targetRelease) {
    targetVersions = [candidate.targetRelease]
  } else if (health && health.targetRelease) {
    targetVersions = [health.targetRelease]
  } else if (exec && Array.isArray(exec.targetVersions) && exec.targetVersions.length > 0) {
    targetVersions = exec.targetVersions
  } else {
    targetVersions = []
  }

  var fixVersion
  if (jira && Array.isArray(jira.fixVersions) && jira.fixVersions.length > 0) {
    fixVersion = jira.fixVersions[0]
  } else if (candidate && candidate.fixVersion) {
    fixVersion = candidate.fixVersion
  } else if (health && health.fixVersions) {
    fixVersion = health.fixVersions
  } else if (exec && Array.isArray(exec.fixVersions) && exec.fixVersions.length > 0) {
    fixVersion = exec.fixVersions[0]
  } else {
    fixVersion = null
  }

  var components
  if (aiReview && Array.isArray(aiReview.components) && aiReview.components.length > 0) {
    components = aiReview.components
  } else if (health && health.components) {
    components = Array.isArray(health.components) ? health.components : health.components.split(', ').filter(Boolean)
  } else if (jira && Array.isArray(jira.components)) {
    components = jira.components
  } else if (exec) {
    if (typeof exec.components === 'string' && exec.components) {
      components = exec.components.split(', ').filter(Boolean)
    } else if (Array.isArray(exec.components)) {
      components = exec.components
    } else {
      components = []
    }
  } else {
    components = []
  }

  var deliveryOwner
  if (health && (health.deliveryOwner || health.assignee)) {
    deliveryOwner = health.deliveryOwner || health.assignee
  } else if (jira && jira.assignee) {
    deliveryOwner = typeof jira.assignee === 'string' ? jira.assignee : (jira.assignee.displayName || null)
  } else if (exec && exec.assignee) {
    deliveryOwner = typeof exec.assignee === 'string' ? exec.assignee : (exec.assignee.displayName || null)
  } else {
    deliveryOwner = null
  }

  var pmOwner = (health && health.pmOwner) || (jira && jira.pmOwner) || null

  var team = teamIndex.get(key) || (jira && jira.team) || (exec && exec.team) || null

  var tier
  if (candidate && candidate.tier != null) {
    tier = parseInt(candidate.tier, 10) || null
  } else if (health && health.tier != null) {
    tier = typeof health.tier === 'string' && health.tier.charAt(0) === 'T'
      ? parseInt(health.tier.slice(1), 10) || null
      : parseInt(health.tier, 10) || null
  } else {
    tier = null
  }

  var bigRock = (candidate && candidate.bigRock) || (health && health.bigRock) || null
  var rockPriority = (candidate && candidate.rockPriority) || null

  var riceScore
  if (jira && jira.riceScore != null) {
    riceScore = jira.riceScore
  } else if (exec && exec.riceScore != null) {
    riceScore = exec.riceScore
  } else if (health && health.rice && health.rice.score != null) {
    riceScore = health.rice.score
  } else if (aiReview && aiReview.riceScore != null) {
    riceScore = aiReview.riceScore
  } else {
    riceScore = null
  }

  var scores = aiReview ? (aiReview.scores || {}) : (health && health.scores ? health.scores : {})
  var rubricTotal = (scores.feasibility || 0) + (scores.testability || 0) + (scores.scope || 0) + (scores.architecture || 0)

  var humanReviewStatus
  if (aiReview && aiReview.humanReviewStatus) {
    humanReviewStatus = aiReview.humanReviewStatus
  } else {
    humanReviewStatus = deriveHumanReviewStatusFromLabels(labels)
  }

  var recommendation = aiReview ? aiReview.recommendation || null : null
  var reviewers = aiReview ? (aiReview.reviewers || {}) : {}
  var priorityScore = health && health.priorityScore != null ? health.priorityScore : null
  var size = (aiReview && aiReview.size) || (health && health.tshirtSize) || null
  var sourceRfe = aiReview ? (aiReview.sourceRfe || null) : null
  var needsAttention = aiReview ? (aiReview.needsAttention || false) : false
  var reviewedAt = aiReview ? (aiReview.reviewedAt || null) : null
  var approvedBy = aiReview ? (aiReview.approvedBy || null) : null
  var approvedAt = aiReview ? (aiReview.approvedAt || null) : null

  var dataSource
  if (aiReview) {
    dataSource = 'strat-creator'
  } else if (health) {
    dataSource = 'health-pipeline'
  } else if (jira) {
    dataSource = 'jira'
  } else {
    dataSource = 'execution'
  }

  var hygieneStatus = computeHygieneStatus(violations)

  var storyPoints = (health && health.storyPoints) || (candidate && candidate.storyPoints) || (jira && jira.storyPoints) || null
  var epicCount = (health && health.epicCount) || (candidate && candidate.epicCount) || 0
  var releaseType = (health && health.releaseType) || (candidate && candidate.phase) || (jira && jira.releaseType) || null
  var assignee = deliveryOwner
  var pm = pmOwner || (health && health.pm) || (candidate && candidate.pm) || null
  var docsRequired = (jira && jira.docsRequired) || null
  var effort = (jira && jira.effort) || null
  var tshirtSize = (health && health.tshirtSize) || (aiReview && aiReview.size) || null
  var descriptionSignals = (jira && jira.descriptionSignals) || (health && health.descriptionSignals) || null

  return {
    key: key,
    title: title,
    sourceRfe: sourceRfe,
    priority: priority,
    status: status,
    size: size,
    recommendation: recommendation,
    needsAttention: needsAttention,
    humanReviewStatus: humanReviewStatus,
    riceScore: riceScore,
    rubricTotal: rubricTotal,
    scores: scores,
    reviewers: reviewers,
    components: components,
    deliveryOwner: deliveryOwner,
    pmOwner: pmOwner,
    team: team,
    reviewedAt: reviewedAt,
    approvedBy: approvedBy,
    approvedAt: approvedAt,
    tier: tier,
    bigRock: bigRock,
    rockPriority: rockPriority,
    targetVersions: targetVersions,
    fixVersion: fixVersion,
    labels: labels,
    violations: violations,
    hygieneStatus: hygieneStatus,
    priorityScore: priorityScore,
    dataSource: dataSource,
    storyPoints: storyPoints,
    epicCount: epicCount,
    releaseType: releaseType,
    assignee: assignee,
    pm: pm,
    docsRequired: docsRequired,
    effort: effort,
    tshirtSize: tshirtSize,
    descriptionSignals: descriptionSignals,
    phase: releaseType
  }
}

function buildFeatureReadiness(readFromStorage, jiraFeatures, listStorageFiles) {
  var execData = loadExecutionData(readFromStorage)
  var cacheData = loadCacheIndexes(readFromStorage, listStorageFiles)

  var execMap = new Map()
  for (var emi = 0; emi < execData.execFeatures.length; emi++) {
    if (execData.execFeatures[emi].key) execMap.set(execData.execFeatures[emi].key, execData.execFeatures[emi])
  }

  var canonicalKeys = buildCanonicalKeySet(jiraFeatures, execData.aiReviewMap, execData.execFeatures, cacheData.healthIndex)

  var pendingReview = []
  var ready = []
  var allComponents = []
  var allPriorities = new Set()
  var allBigRocks = new Set()
  var allTargetVersions = new Set()
  var allFixVersions = new Set()
  var allTeams = new Set()

  var bigRockPriorityMap = new Map()
  for (var bvi = 0; bvi < cacheData.configuredVersions.length; bvi++) {
    var bigRocks = loadBigRocks(readFromStorage, cacheData.configuredVersions[bvi])
    for (var bri = 0; bri < bigRocks.length; bri++) {
      var rockName = bigRocks[bri].name
      if (!rockName) continue
      var rockPri = bigRocks[bri].priority || (bri + 1)
      var existing = bigRockPriorityMap.get(rockName)
      if (existing == null || rockPri < existing) {
        bigRockPriorityMap.set(rockName, rockPri)
      }
    }
  }

  var allMerged = []
  canonicalKeys.forEach(function(key) {
    var merged = mergeFeatureData(key, jiraFeatures, execData.aiReviewMap, cacheData.candidateIndex, cacheData.healthIndex, cacheData.hygieneIndex, cacheData.teamIndex, execMap)
    if (merged.status && CLOSED_STATUSES.indexOf(merged.status) !== -1) return
    allMerged.push(merged)
  })

  var batchScores = computePriorityScores(allMerged, {
    bigRockPriorityMap: bigRockPriorityMap,
    configuredVersions: cacheData.configuredVersions
  })

  for (var mi = 0; mi < allMerged.length; mi++) {
    var merged = allMerged[mi]
    var scored = batchScores.get(merged.key)
    var effectivePriorityScore = scored ? scored.score : 0
    var priorityBreakdown = scored ? scored.breakdown : null

    var blockerResult = computeBlockers(merged, merged.dataSource)

    var readinessResult = computeReadiness(merged)
    var isReady = readinessResult.isReady
    var confidence = computeConfidence(isReady, merged.fixVersion)

    var feature = {
      key: merged.key,
      title: merged.title,
      sourceRfe: merged.sourceRfe,
      priority: merged.priority,
      status: merged.status,
      size: merged.size,
      recommendation: merged.recommendation,
      needsAttention: merged.needsAttention,
      humanReviewStatus: merged.humanReviewStatus,
      riceScore: merged.riceScore,
      rubricTotal: merged.rubricTotal,
      scores: merged.scores,
      reviewers: merged.reviewers,
      components: merged.components,
      deliveryOwner: merged.deliveryOwner,
      pmOwner: merged.pmOwner,
      team: merged.team,
      reviewedAt: merged.reviewedAt,
      approvedBy: merged.approvedBy,
      approvedAt: merged.approvedAt,
      tier: merged.tier,
      bigRock: merged.bigRock,
      rockPriority: merged.rockPriority,
      targetVersions: merged.targetVersions,
      fixVersion: merged.fixVersion,
      priorityScore: effectivePriorityScore,
      priorityScoreBreakdown: priorityBreakdown,
      effectivePriorityScore: effectivePriorityScore,
      blockingDimensions: blockerResult.blockingDimensions,
      actionRequired: blockerResult.actionRequired,
      dataSource: merged.dataSource,
      confidence: confidence,
      readinessGates: readinessResult.gates,
      fpdor: readinessResult.fpdor,
      violations: merged.violations,
      hygieneStatus: merged.hygieneStatus
    }

    if (isReady) {
      ready.push(feature)
    } else {
      pendingReview.push(feature)
    }

    collectFilterMeta(feature, allComponents, allPriorities, allBigRocks, allTargetVersions, allFixVersions, allTeams)
  }

  function sortFeatures(a, b) {
    if (b.effectivePriorityScore !== a.effectivePriorityScore) {
      return b.effectivePriorityScore - a.effectivePriorityScore
    }
    return b.rubricTotal - a.rubricTotal
  }

  pendingReview.sort(sortFeatures)
  ready.sort(sortFeatures)

  var allSorted = pendingReview.concat(ready).slice().sort(sortFeatures)
  for (var ri = 0; ri < allSorted.length; ri++) {
    allSorted[ri].rank = ri + 1
  }

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
    versions: cacheData.configuredVersions,
    lastSyncedAt: execData.lastSyncedAt || null,
    jiraAvailable: jiraFeatures != null
  }

  return { pendingReview: pendingReview, ready: ready, filterMeta: filterMeta, meta: meta }
}

module.exports = { buildFeatureReadiness: buildFeatureReadiness, computeBlockers: computeBlockers, computeReadiness: computeReadiness, hasBlockingViolations: hasBlockingViolations, computeHygieneStatus: computeHygieneStatus, computeConfidence: computeConfidence, collectFilterMeta: collectFilterMeta, deriveHumanReviewStatusFromLabels: deriveHumanReviewStatusFromLabels, buildCanonicalKeySet: buildCanonicalKeySet, mergeFeatureData: mergeFeatureData, BLOCKING_HYGIENE_RULES: BLOCKING_HYGIENE_RULES }

