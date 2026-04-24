const { TERMINAL_STATUSES, PRIORITY_ORDER } = require('./constants')
const {
  loadIndex,
  mapToCandidate,
  findRfeFromLinks,
  findTier1Features,
  findTier1Rfes,
  findOutcomeSummaries,
  findTier2Features,
  findTier2Rfes,
  findTier3Features
} = require('./cache-reader')

function sortByPriority(a, b) {
  var pa = PRIORITY_ORDER[a.priority] !== undefined ? PRIORITY_ORDER[a.priority] : 99
  var pb = PRIORITY_ORDER[b.priority] !== undefined ? PRIORITY_ORDER[b.priority] : 99
  if (pa !== pb) return pa - pb
  return a.issueKey.localeCompare(b.issueKey)
}

function runPipeline(config, bigRocks, release, readFromStorage, opts) {
  var rockFilter = opts && opts.rockFilter

  var rocksToProcess = rockFilter
    ? bigRocks.filter(function(r) { return r.name === rockFilter })
    : bigRocks

  if (rockFilter && rocksToProcess.length === 0) {
    throw new Error('No matching rock found for filter: ' + rockFilter + '. Available: ' + bigRocks.map(function(r) { return r.name }).join(', '))
  }

  var rocksWithOutcomes = rocksToProcess.filter(function(r) { return r.outcomeKeys && r.outcomeKeys.length > 0 })
  var rocksWithout = rocksToProcess.filter(function(r) { return !r.outcomeKeys || r.outcomeKeys.length === 0 })

  for (var w = 0; w < rocksWithout.length; w++) {
    console.warn('[release-planning] Skipping ' + rocksWithout[w].name + ': no outcomeKeys defined')
  }

  // Load the feature-traffic index once
  var index = loadIndex(readFromStorage)

  // Collect all outcome keys
  var allOutcomeKeys = []
  for (var r = 0; r < rocksWithOutcomes.length; r++) {
    allOutcomeKeys.push.apply(allOutcomeKeys, rocksWithOutcomes[r].outcomeKeys)
  }

  // Fetch outcome summaries from cache
  var outcomeSummaries = findOutcomeSummaries(index, allOutcomeKeys)

  // Phase A: Discover children for each rock's outcomes
  // Maps: issueKey -> { candidate, rockSet: Set<"priority:name"> }
  var featureMap = new Map()
  var rfeMap = new Map()
  var skippedCount = 0
  var terminalFilteredCount = 0

  for (var ri = 0; ri < rocksWithOutcomes.length; ri++) {
    var rock = rocksWithOutcomes[ri]
    var rockChildCount = 0

    // Find Tier 1 features for this rock's outcomes
    var rawFeatures = findTier1Features(readFromStorage, index, rock.outcomeKeys)
    for (var fi = 0; fi < rawFeatures.length; fi++) {
      var feat = rawFeatures[fi]
      var candidate = mapToCandidate(feat, rock.name, 'outcome')

      // Filter by release match
      if (!candidate.targetRelease.includes(release)) {
        skippedCount++
        continue
      }

      // Filter terminal statuses
      if (TERMINAL_STATUSES.indexOf(candidate.status) !== -1) {
        terminalFilteredCount++
        continue
      }

      // Enrich with RFE link from issueLinks
      var issueLinks = feat.issueLinks || feat._indexEntry && feat._indexEntry.issueLinks || []
      var rfeLink = findRfeFromLinks(issueLinks)
      if (rfeLink.key) {
        candidate.rfe = rfeLink.key
        candidate.rfeStatus = rfeLink.status
      }

      var key = candidate.issueKey
      if (featureMap.has(key)) {
        featureMap.get(key).rockSet.add(rock.priority + ':' + rock.name)
      } else {
        featureMap.set(key, { candidate: candidate, rockSet: new Set([rock.priority + ':' + rock.name]) })
      }
      rockChildCount++
    }

    // Find Tier 1 RFEs for this rock's outcomes
    var rawRfes = findTier1Rfes(readFromStorage, index, rock.outcomeKeys, release)
    for (var rfi = 0; rfi < rawRfes.length; rfi++) {
      var rfe = rawRfes[rfi]
      var rfeCandidate = mapToCandidate(rfe, rock.name, 'outcome')

      var rfeKey = rfeCandidate.issueKey
      if (rfeMap.has(rfeKey)) {
        rfeMap.get(rfeKey).rockSet.add(rock.priority + ':' + rock.name)
      } else {
        rfeMap.set(rfeKey, { candidate: rfeCandidate, rockSet: new Set([rock.priority + ':' + rock.name]) })
      }
      rockChildCount++
    }

    if (rockChildCount === 0 && rock.outcomeKeys.length > 0) {
      console.warn('[release-planning] Rock \'' + rock.name + '\' has outcomes ' + rock.outcomeKeys.join(', ') + ' but zero qualifying children')
    }
  }

  // Phase B: Merge Big Rock names and build Tier 1 lists
  var rockPriority = {}
  for (var bp = 0; bp < bigRocks.length; bp++) {
    rockPriority[bigRocks[bp].name] = bigRocks[bp].priority
  }

  function mergeRockNames(rockSet) {
    var pairs = []
    rockSet.forEach(function(s) {
      var idx = s.indexOf(':')
      pairs.push([parseInt(s.slice(0, idx), 10), s.slice(idx + 1)])
    })
    pairs.sort(function(a, b) { return a[0] - b[0] })
    return pairs.map(function(p) { return p[1] }).join(', ')
  }

  var tier1Features = []
  featureMap.forEach(function(entry) {
    var merged = mergeRockNames(entry.rockSet)
    tier1Features.push(Object.assign({}, entry.candidate, { bigRock: merged, tier: 1 }))
  })

  var tier1Rfes = []
  rfeMap.forEach(function(entry) {
    var merged = mergeRockNames(entry.rockSet)
    tier1Rfes.push(Object.assign({}, entry.candidate, { bigRock: merged, tier: 1 }))
  })

  // Sort Tier 1
  tier1Features.sort(function(a, b) {
    var ra = rockPriority[a.bigRock.split(', ')[0]] || 999
    var rb = rockPriority[b.bigRock.split(', ')[0]] || 999
    if (ra !== rb) return ra - rb
    return sortByPriority(a, b)
  })
  tier1Rfes.sort(function(a, b) {
    var ra = rockPriority[a.bigRock.split(', ')[0]] || 999
    var rb = rockPriority[b.bigRock.split(', ')[0]] || 999
    if (ra !== rb) return ra - rb
    return sortByPriority(a, b)
  })

  // Phase C: Tier 2 discovery
  var tier1FeatureKeys = new Set(tier1Features.map(function(c) { return c.issueKey }))
  var tier1RfeKeys = new Set(tier1Rfes.map(function(c) { return c.issueKey }))

  var rawTier2Features = findTier2Features(readFromStorage, index, release, tier1FeatureKeys)
  var rawTier2Rfes = findTier2Rfes(readFromStorage, index, release, tier1RfeKeys)

  // Post-filter terminal statuses on Tier 2 features
  var tier2Features = []
  for (var t2i = 0; t2i < rawTier2Features.length; t2i++) {
    var t2f = rawTier2Features[t2i]
    var t2candidate = mapToCandidate(t2f, '', 'tier2')

    if (TERMINAL_STATUSES.indexOf(t2candidate.status) !== -1) {
      terminalFilteredCount++
      continue
    }

    // Enrich with RFE link
    var t2links = t2f.issueLinks || []
    var t2rfeLink = findRfeFromLinks(t2links)
    if (t2rfeLink.key) {
      t2candidate.rfe = t2rfeLink.key
      t2candidate.rfeStatus = t2rfeLink.status
    }

    tier2Features.push(Object.assign({}, t2candidate, { tier: 2 }))
  }
  tier2Features.sort(sortByPriority)

  var tier2RfesTagged = rawTier2Rfes.map(function(rfe) {
    return Object.assign({}, mapToCandidate(rfe, '', 'tier2'), { tier: 2 })
  })
  tier2RfesTagged.sort(sortByPriority)

  // Phase D: Tier 3 discovery
  var tier2FeatureKeys = new Set(tier2Features.map(function(c) { return c.issueKey }))
  var tier3Exclude = new Set()
  tier1FeatureKeys.forEach(function(k) { tier3Exclude.add(k) })
  tier2FeatureKeys.forEach(function(k) { tier3Exclude.add(k) })

  var rawTier3Features = findTier3Features(readFromStorage, index, tier3Exclude)

  var tier3Features = []
  for (var t3i = 0; t3i < rawTier3Features.length; t3i++) {
    var t3f = rawTier3Features[t3i]
    var t3candidate = mapToCandidate(t3f, '', 'tier3')

    if (TERMINAL_STATUSES.indexOf(t3candidate.status) !== -1) {
      terminalFilteredCount++
      continue
    }

    if (t3candidate.targetRelease || t3candidate.fixVersion) continue

    // Enrich with RFE link
    var t3links = t3f.issueLinks || []
    var t3rfeLink = findRfeFromLinks(t3links)
    if (t3rfeLink.key) {
      t3candidate.rfe = t3rfeLink.key
      t3candidate.rfeStatus = t3rfeLink.status
    }

    tier3Features.push(Object.assign({}, t3candidate, { tier: 3 }))
  }
  tier3Features.sort(sortByPriority)

  var allFeatures = tier1Features.concat(tier2Features, tier3Features)
  var allRfes = tier1Rfes.concat(tier2RfesTagged)

  // Per-rock stats
  var perRockStats = {}
  for (var si = 0; si < rocksWithOutcomes.length; si++) {
    var statRock = rocksWithOutcomes[si]
    var rockFeatures = tier1Features.filter(function(c) { return c.bigRock.split(', ')[0] === statRock.name }).length
    var rockRfes = tier1Rfes.filter(function(c) { return c.bigRock.split(', ')[0] === statRock.name }).length
    perRockStats[statRock.name] = { features: rockFeatures, rfes: rockRfes }
  }

  return {
    features: allFeatures,
    rfes: allRfes,
    tier1Features: tier1Features.length,
    tier1Rfes: tier1Rfes.length,
    tier2Features: tier2Features.length,
    tier2Rfes: tier2RfesTagged.length,
    tier3Features: tier3Features.length,
    perRockStats: perRockStats,
    outcomeSummaries: outcomeSummaries,
    release: release,
    skippedCount: skippedCount,
    terminalFilteredCount: terminalFilteredCount,
    rocksWithoutOutcomes: rocksWithout.map(function(r) { return r.name })
  }
}

function buildCandidateResponse(pipelineResult, version, bigRocks, demoMode) {
  var features = pipelineResult.features
  var rfes = pipelineResult.rfes
  var outcomeSummaries = pipelineResult.outcomeSummaries
  var perRockStats = pipelineResult.perRockStats

  var allStatuses = new Set()
  var allTeams = new Set()
  var allPriorities = new Set()
  var allPillars = new Set()

  for (var fi = 0; fi < features.length; fi++) {
    if (features[fi].status) allStatuses.add(features[fi].status)
    if (features[fi].components) allTeams.add(features[fi].components)
    if (features[fi].priority) allPriorities.add(features[fi].priority)
  }
  for (var ri = 0; ri < rfes.length; ri++) {
    if (rfes[ri].status) allStatuses.add(rfes[ri].status)
    if (rfes[ri].priority) allPriorities.add(rfes[ri].priority)
  }
  for (var bi = 0; bi < bigRocks.length; bi++) {
    if (bigRocks[bi].pillar) allPillars.add(bigRocks[bi].pillar)
  }

  var rockSummaries = bigRocks.map(function(rock) {
    return {
      priority: rock.priority,
      name: rock.name,
      fullName: rock.fullName,
      pillar: rock.pillar,
      state: rock.state,
      owner: rock.owner,
      outcomeKeys: rock.outcomeKeys,
      outcomeDescriptions: {},
      featureCount: (perRockStats[rock.name] || {}).features || 0,
      rfeCount: (perRockStats[rock.name] || {}).rfes || 0,
      notes: rock.notes || ''
    }
  })

  // Fill in outcome descriptions
  for (var si = 0; si < rockSummaries.length; si++) {
    var rockSum = rockSummaries[si]
    for (var ki = 0; ki < rockSum.outcomeKeys.length; ki++) {
      var oKey = rockSum.outcomeKeys[ki]
      if (outcomeSummaries[oKey]) {
        rockSum.outcomeDescriptions[oKey] = outcomeSummaries[oKey]
      }
    }
  }

  return {
    version: version,
    jiraBaseUrl: require('./constants').JIRA_BROWSE_URL,
    lastRefreshed: new Date().toISOString(),
    demoMode: !!demoMode,
    summary: {
      totalFeatures: features.length,
      totalRfes: rfes.length,
      totalBigRocks: bigRocks.length,
      rocksWithData: Object.values(perRockStats).filter(function(s) { return s.features > 0 || s.rfes > 0 }).length,
      tier1: {
        features: pipelineResult.tier1Features,
        rfes: pipelineResult.tier1Rfes,
        description: 'Big Rock-associated features and RFEs that PM has identified as essential for this release.'
      },
      tier2: {
        features: pipelineResult.tier2Features,
        rfes: pipelineResult.tier2Rfes,
        description: 'Features and RFEs not tied to Big Rocks, but PM believes are important for customers or represent significant usability improvements.'
      },
      tier3: {
        features: pipelineResult.tier3Features,
        rfes: 0,
        description: 'Not Big Rock or customer demanded, but potentially could be worked on by other teams.'
      },
      perRock: perRockStats
    },
    bigRocks: rockSummaries,
    features: features.map(function(f) {
      return Object.assign({}, f, { tier: f.tier || 1 })
    }),
    rfes: rfes.map(function(r) {
      return Object.assign({}, r, { tier: r.tier || 1 })
    }),
    filterOptions: {
      pillars: Array.from(allPillars).sort(),
      rocks: bigRocks.map(function(r) { return r.name }),
      statuses: Array.from(allStatuses).sort(),
      teams: Array.from(allTeams).sort(),
      priorities: Array.from(allPriorities).sort()
    }
  }
}

module.exports = { runPipeline: runPipeline, buildCandidateResponse: buildCandidateResponse }
