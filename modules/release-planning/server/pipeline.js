const { TERMINAL_STATUSES, PRIORITY_ORDER } = require('./constants')
const { OUTCOME_KEY_PATTERN } = require('./validation')
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
  const pa = PRIORITY_ORDER[a.priority] !== undefined ? PRIORITY_ORDER[a.priority] : 99
  const pb = PRIORITY_ORDER[b.priority] !== undefined ? PRIORITY_ORDER[b.priority] : 99
  if (pa !== pb) return pa - pb
  return a.issueKey.localeCompare(b.issueKey)
}

function runPipeline(config, bigRocks, release, readFromStorage, opts) {
  const rockFilter = opts && opts.rockFilter

  const rocksToProcess = rockFilter
    ? bigRocks.filter(function(r) { return r.name === rockFilter })
    : bigRocks

  if (rockFilter && rocksToProcess.length === 0) {
    throw new Error('No matching rock found for filter: ' + rockFilter + '. Available: ' + bigRocks.map(function(r) { return r.name }).join(', '))
  }

  const rocksWithOutcomes = rocksToProcess.filter(function(r) { return r.outcomeKeys && r.outcomeKeys.length > 0 })
  const rocksWithout = rocksToProcess.filter(function(r) { return !r.outcomeKeys || r.outcomeKeys.length === 0 })
  const warnings = []

  for (let w = 0; w < rocksWithout.length; w++) {
    console.log('[release-planning] Big Rock "' + rocksWithout[w].name + '" has no outcome keys — skipped (tracked in rocksWithoutOutcomes)')
  }

  // Defense-in-depth: filter outcome keys that don't match the expected pattern
  for (let vi = 0; vi < rocksWithOutcomes.length; vi++) {
    const rock = rocksWithOutcomes[vi]
    const filtered = rock.outcomeKeys.filter(function(key) {
      if (typeof key === 'string' && OUTCOME_KEY_PATTERN.test(key)) return true
      console.warn('[release-planning] Skipping invalid outcome key in rock ' + rock.name + ': ' + key)
      return false
    })
    if (filtered.length !== rock.outcomeKeys.length) {
      warnings.push('Filtered ' + (rock.outcomeKeys.length - filtered.length) + ' invalid outcome key(s) from "' + rock.name + '"')
      rocksWithOutcomes[vi] = Object.assign({}, rock, { outcomeKeys: filtered })
    }
  }

  // Load the feature-traffic index once
  const index = loadIndex(readFromStorage)

  if (!index.features || index.features.length === 0) {
    warnings.push('Feature-traffic index is empty — pipeline data may be incomplete. Run a feature-traffic refresh first.')
  }

  // Collect all outcome keys
  const allOutcomeKeys = []
  for (let r = 0; r < rocksWithOutcomes.length; r++) {
    allOutcomeKeys.push.apply(allOutcomeKeys, rocksWithOutcomes[r].outcomeKeys)
  }

  // Fetch outcome summaries from cache
  const outcomeSummaries = findOutcomeSummaries(index, allOutcomeKeys)

  // Track outcome keys not found in the feature-traffic index (info-level, not a warning)
  const missingOutcomes = allOutcomeKeys.filter(function(key) { return !outcomeSummaries[key] })
  if (missingOutcomes.length > 0) {
    console.log('[release-planning] ' + missingOutcomes.length + ' outcome key(s) not in feature-traffic index: ' + missingOutcomes.join(', '))
  }

  // Phase A: Discover children for each rock's outcomes
  // Maps: issueKey -> { candidate, rockSet: Set<"priority:name"> }
  const featureMap = new Map()
  const rfeMap = new Map()
  let skippedCount = 0
  let terminalFilteredCount = 0

  for (let ri = 0; ri < rocksWithOutcomes.length; ri++) {
    const rock = rocksWithOutcomes[ri]
    let rockChildCount = 0

    // Find Tier 1 features for this rock's outcomes (with stats tracking)
    var rockStats = { totalMatches: 0, closedFiltered: 0, noTargetVersion: 0 }
    const rawFeatures = findTier1Features(readFromStorage, index, rock.outcomeKeys, rockStats)
    var rockTerminalFiltered = 0
    var rockReleaseMismatch = 0
    for (let fi = 0; fi < rawFeatures.length; fi++) {
      const feat = rawFeatures[fi]
      const candidate = mapToCandidate(feat, rock.name, 'outcome')

      // Filter by release match
      if (!candidate.targetRelease.includes(release)) {
        skippedCount++
        rockReleaseMismatch++
        continue
      }

      // Filter terminal statuses
      if (TERMINAL_STATUSES.indexOf(candidate.status) !== -1) {
        terminalFilteredCount++
        rockTerminalFiltered++
        continue
      }

      // Enrich with RFE link from issueLinks
      const issueLinks = feat.issueLinks || feat._indexEntry && feat._indexEntry.issueLinks || []
      const rfeLink = findRfeFromLinks(issueLinks)
      if (rfeLink.key) {
        candidate.rfe = rfeLink.key
        candidate.rfeStatus = rfeLink.status
      }

      const key = candidate.issueKey
      if (featureMap.has(key)) {
        featureMap.get(key).rockSet.add(rock.priority + ':' + rock.name)
      } else {
        featureMap.set(key, { candidate: candidate, rockSet: new Set([rock.priority + ':' + rock.name]) })
      }
      rockChildCount++
    }

    // Find Tier 1 RFEs for this rock's outcomes
    const rawRfes = findTier1Rfes(readFromStorage, index, rock.outcomeKeys, release)
    for (let rfi = 0; rfi < rawRfes.length; rfi++) {
      const rfe = rawRfes[rfi]
      const rfeCandidate = mapToCandidate(rfe, rock.name, 'outcome')

      const rfeKey = rfeCandidate.issueKey
      if (rfeMap.has(rfeKey)) {
        rfeMap.get(rfeKey).rockSet.add(rock.priority + ':' + rock.name)
      } else {
        rfeMap.set(rfeKey, { candidate: rfeCandidate, rockSet: new Set([rock.priority + ':' + rock.name]) })
      }
      rockChildCount++
    }

    if (rockChildCount === 0 && rock.outcomeKeys.length > 0) {
      var msg
      if (rockStats.totalMatches === 0) {
        msg = 'Big Rock "' + rock.name + '" has outcomes (' + rock.outcomeKeys.join(', ') + ') but no features with matching parentKey found in the index. Check parent-child links in Jira.'
      } else {
        var parts = []
        parts.push(rockStats.totalMatches + ' candidate(s) with matching parentKey')
        if (rockStats.closedFiltered > 0) parts.push(rockStats.closedFiltered + ' excluded (closed status)')
        if (rockStats.noTargetVersion > 0) parts.push(rockStats.noTargetVersion + ' excluded (no target version)')
        if (rockReleaseMismatch > 0) parts.push(rockReleaseMismatch + ' excluded (wrong release)')
        if (rockTerminalFiltered > 0) parts.push(rockTerminalFiltered + ' excluded (terminal status)')
        msg = 'Big Rock "' + rock.name + '" has outcomes (' + rock.outcomeKeys.join(', ') + ') but no qualifying features: ' + parts.join(', ')
      }
      warnings.push(msg)
      console.warn('[release-planning] ' + msg)
    }
  }

  // Phase B: Merge Big Rock names and build Tier 1 lists
  const rockPriority = {}
  for (let bp = 0; bp < bigRocks.length; bp++) {
    rockPriority[bigRocks[bp].name] = bigRocks[bp].priority
  }

  function mergeRockNames(rockSet) {
    const pairs = []
    rockSet.forEach(function(s) {
      const idx = s.indexOf(':')
      pairs.push([parseInt(s.slice(0, idx), 10), s.slice(idx + 1)])
    })
    pairs.sort(function(a, b) { return a[0] - b[0] })
    return pairs.map(function(p) { return p[1] }).join(', ')
  }

  const tier1Features = []
  featureMap.forEach(function(entry) {
    const merged = mergeRockNames(entry.rockSet)
    tier1Features.push(Object.assign({}, entry.candidate, { bigRock: merged, tier: 1 }))
  })

  const tier1Rfes = []
  rfeMap.forEach(function(entry) {
    const merged = mergeRockNames(entry.rockSet)
    tier1Rfes.push(Object.assign({}, entry.candidate, { bigRock: merged, tier: 1 }))
  })

  // Sort Tier 1
  tier1Features.sort(function(a, b) {
    const ra = rockPriority[a.bigRock.split(', ')[0]] || 999
    const rb = rockPriority[b.bigRock.split(', ')[0]] || 999
    if (ra !== rb) return ra - rb
    return sortByPriority(a, b)
  })
  tier1Rfes.sort(function(a, b) {
    const ra = rockPriority[a.bigRock.split(', ')[0]] || 999
    const rb = rockPriority[b.bigRock.split(', ')[0]] || 999
    if (ra !== rb) return ra - rb
    return sortByPriority(a, b)
  })

  // Phase C: Tier 2 discovery
  const tier1FeatureKeys = new Set(tier1Features.map(function(c) { return c.issueKey }))
  const tier1RfeKeys = new Set(tier1Rfes.map(function(c) { return c.issueKey }))

  const rawTier2Features = findTier2Features(readFromStorage, index, release, tier1FeatureKeys)
  const rawTier2Rfes = findTier2Rfes(readFromStorage, index, release, tier1RfeKeys)

  // Post-filter terminal statuses on Tier 2 features
  const tier2Features = []
  for (let t2i = 0; t2i < rawTier2Features.length; t2i++) {
    const t2f = rawTier2Features[t2i]
    const t2candidate = mapToCandidate(t2f, '', 'tier2')

    if (TERMINAL_STATUSES.indexOf(t2candidate.status) !== -1) {
      terminalFilteredCount++
      continue
    }

    // Enrich with RFE link
    const t2links = t2f.issueLinks || []
    const t2rfeLink = findRfeFromLinks(t2links)
    if (t2rfeLink.key) {
      t2candidate.rfe = t2rfeLink.key
      t2candidate.rfeStatus = t2rfeLink.status
    }

    tier2Features.push(Object.assign({}, t2candidate, { tier: 2 }))
  }
  tier2Features.sort(sortByPriority)

  const tier2RfesTagged = rawTier2Rfes.map(function(rfe) {
    return Object.assign({}, mapToCandidate(rfe, '', 'tier2'), { tier: 2 })
  })
  tier2RfesTagged.sort(sortByPriority)

  // Phase D: Tier 3 discovery
  const tier2FeatureKeys = new Set(tier2Features.map(function(c) { return c.issueKey }))
  const tier3Exclude = new Set()
  tier1FeatureKeys.forEach(function(k) { tier3Exclude.add(k) })
  tier2FeatureKeys.forEach(function(k) { tier3Exclude.add(k) })

  const rawTier3Features = findTier3Features(readFromStorage, index, tier3Exclude)

  const tier3Features = []
  for (let t3i = 0; t3i < rawTier3Features.length; t3i++) {
    const t3f = rawTier3Features[t3i]
    const t3candidate = mapToCandidate(t3f, '', 'tier3')

    if (TERMINAL_STATUSES.indexOf(t3candidate.status) !== -1) {
      terminalFilteredCount++
      continue
    }

    if (t3candidate.targetRelease || t3candidate.fixVersion) continue

    // Enrich with RFE link
    const t3links = t3f.issueLinks || []
    const t3rfeLink = findRfeFromLinks(t3links)
    if (t3rfeLink.key) {
      t3candidate.rfe = t3rfeLink.key
      t3candidate.rfeStatus = t3rfeLink.status
    }

    tier3Features.push(Object.assign({}, t3candidate, { tier: 3 }))
  }
  tier3Features.sort(sortByPriority)

  const allFeatures = tier1Features.concat(tier2Features, tier3Features)
  const allRfes = tier1Rfes.concat(tier2RfesTagged)

  // Per-rock stats
  const perRockStats = {}
  for (let si = 0; si < rocksWithOutcomes.length; si++) {
    const statRock = rocksWithOutcomes[si]
    const rockFeatures = tier1Features.filter(function(c) { return c.bigRock.split(', ')[0] === statRock.name }).length
    const rockRfes = tier1Rfes.filter(function(c) { return c.bigRock.split(', ')[0] === statRock.name }).length
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
    rocksWithoutOutcomes: rocksWithout.map(function(r) { return r.name }),
    missingOutcomes: missingOutcomes,
    warnings: warnings
  }
}

function buildCandidateResponse(pipelineResult, version, bigRocks, demoMode) {
  const features = pipelineResult.features
  const rfes = pipelineResult.rfes
  const outcomeSummaries = pipelineResult.outcomeSummaries
  const perRockStats = pipelineResult.perRockStats

  const allStatuses = new Set()
  const allTeams = new Set()
  const allPriorities = new Set()
  const allPillars = new Set()

  for (let fi = 0; fi < features.length; fi++) {
    if (features[fi].status) allStatuses.add(features[fi].status)
    if (features[fi].components) {
      const parts = features[fi].components.split(', ')
      for (let pi = 0; pi < parts.length; pi++) {
        const trimmed = parts[pi].trim()
        if (trimmed) allTeams.add(trimmed)
      }
    }
    if (features[fi].priority) allPriorities.add(features[fi].priority)
  }
  for (let ri = 0; ri < rfes.length; ri++) {
    if (rfes[ri].status) allStatuses.add(rfes[ri].status)
    if (rfes[ri].priority) allPriorities.add(rfes[ri].priority)
  }
  for (let bi = 0; bi < bigRocks.length; bi++) {
    if (bigRocks[bi].pillar) allPillars.add(bigRocks[bi].pillar)
  }

  const rockSummaries = bigRocks.map(function(rock) {
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
  for (let si = 0; si < rockSummaries.length; si++) {
    const rockSum = rockSummaries[si]
    for (let ki = 0; ki < rockSum.outcomeKeys.length; ki++) {
      const oKey = rockSum.outcomeKeys[ki]
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
    },
    pipelineWarnings: pipelineResult.warnings && pipelineResult.warnings.length > 0 ? pipelineResult.warnings : undefined
  }
}

module.exports = { runPipeline: runPipeline, buildCandidateResponse: buildCandidateResponse }
