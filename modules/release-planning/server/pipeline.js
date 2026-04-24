const { TERMINAL_STATUSES, PRIORITY_ORDER, JIRA_BROWSE_URL, JIRA_THROTTLE_MS } = require('./constants')
const {
  fetchOutcomeFeatures,
  fetchOutcomeRfes,
  fetchOutcomeSummaries,
  fetchTier2Features,
  fetchTier2Rfes,
  fetchTier3Features,
  throttledSequential
} = require('./jira-client')

function sortByPriority(a, b) {
  const pa = PRIORITY_ORDER[a.priority] !== undefined ? PRIORITY_ORDER[a.priority] : 99
  const pb = PRIORITY_ORDER[b.priority] !== undefined ? PRIORITY_ORDER[b.priority] : 99
  if (pa !== pb) return pa - pb
  return a.issueKey.localeCompare(b.issueKey)
}

async function runPipeline(config, bigRocks, release, fetchAllJqlResults, jiraRequest, opts) {
  const rockFilter = opts && opts.rockFilter

  const rocksToProcess = rockFilter
    ? bigRocks.filter(r => r.name === rockFilter)
    : bigRocks

  if (rockFilter && rocksToProcess.length === 0) {
    throw new Error(`No matching rock found for filter: ${rockFilter}. Available: ${bigRocks.map(r => r.name).join(', ')}`)
  }

  const rocksWithOutcomes = rocksToProcess.filter(r => r.outcomeKeys && r.outcomeKeys.length > 0)
  const rocksWithout = rocksToProcess.filter(r => !r.outcomeKeys || r.outcomeKeys.length === 0)

  for (const r of rocksWithout) {
    console.warn(`[release-planning] Skipping ${r.name}: no outcomeKeys defined`)
  }

  const fieldMapping = config.fieldMapping || {}
  const customFieldIds = config.customFieldIds || {}

  // Fetch outcome summaries
  const allOutcomeKeys = []
  for (const rock of rocksWithOutcomes) {
    allOutcomeKeys.push(...rock.outcomeKeys)
  }
  const outcomeSummaries = await fetchOutcomeSummaries(fetchAllJqlResults, jiraRequest, allOutcomeKeys)

  // Phase A: Discover children for each rock's outcomes
  // Maps: issueKey -> { candidate, rockSet: Set<[priority, name]> }
  const featureMap = new Map()
  const rfeMap = new Map()
  let skippedCount = 0
  let terminalFilteredCount = 0

  await throttledSequential(rocksWithOutcomes, async function(rock) {
    let rockChildCount = 0

    for (const outcomeKey of rock.outcomeKeys) {
      const [features, rfes] = await Promise.all([
        fetchOutcomeFeatures(
          fetchAllJqlResults, jiraRequest, outcomeKey, rock.name,
          fieldMapping, customFieldIds
        ),
        fetchOutcomeRfes(
          fetchAllJqlResults, jiraRequest, outcomeKey, release, rock.name,
          fieldMapping, customFieldIds
        )
      ])

      for (const child of features) {
        if (!child.targetRelease.includes(release)) {
          skippedCount++
          continue
        }
        if (TERMINAL_STATUSES.includes(child.status)) {
          terminalFilteredCount++
          continue
        }
        const key = child.issueKey
        if (featureMap.has(key)) {
          featureMap.get(key).rockSet.add(`${rock.priority}:${rock.name}`)
        } else {
          featureMap.set(key, { candidate: child, rockSet: new Set([`${rock.priority}:${rock.name}`]) })
        }
        rockChildCount++
      }

      for (const child of rfes) {
        const key = child.issueKey
        if (rfeMap.has(key)) {
          rfeMap.get(key).rockSet.add(`${rock.priority}:${rock.name}`)
        } else {
          rfeMap.set(key, { candidate: child, rockSet: new Set([`${rock.priority}:${rock.name}`]) })
        }
        rockChildCount++
      }

      // Throttle between outcome queries within a rock
      if (rock.outcomeKeys.indexOf(outcomeKey) < rock.outcomeKeys.length - 1) {
        await new Promise(resolve => setTimeout(resolve, JIRA_THROTTLE_MS))
      }
    }

    if (rockChildCount === 0 && rock.outcomeKeys.length > 0) {
      console.warn(`[release-planning] Rock '${rock.name}' has outcomes ${rock.outcomeKeys.join(', ')} but zero qualifying children`)
    }

    return rockChildCount
  })

  // Phase B: Merge Big Rock names and build Tier 1 lists
  const rockPriority = {}
  for (const rock of bigRocks) {
    rockPriority[rock.name] = rock.priority
  }

  function mergeRockNames(rockSet) {
    const pairs = [...rockSet].map(s => {
      const idx = s.indexOf(':')
      return [parseInt(s.slice(0, idx), 10), s.slice(idx + 1)]
    })
    pairs.sort((a, b) => a[0] - b[0])
    return pairs.map(p => p[1]).join(', ')
  }

  const tier1Features = []
  for (const [, entry] of featureMap) {
    const merged = mergeRockNames(entry.rockSet)
    tier1Features.push({ ...entry.candidate, bigRock: merged, tier: 1 })
  }

  const tier1Rfes = []
  for (const [, entry] of rfeMap) {
    const merged = mergeRockNames(entry.rockSet)
    tier1Rfes.push({ ...entry.candidate, bigRock: merged, tier: 1 })
  }

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
  const tier1FeatureKeys = new Set(tier1Features.map(c => c.issueKey))
  const tier1RfeKeys = new Set(tier1Rfes.map(c => c.issueKey))

  const [rawTier2Features, tier2Rfes] = await Promise.all([
    fetchTier2Features(fetchAllJqlResults, jiraRequest, release, tier1FeatureKeys, fieldMapping, customFieldIds),
    fetchTier2Rfes(fetchAllJqlResults, jiraRequest, release, tier1RfeKeys, fieldMapping, customFieldIds)
  ])

  // Post-filter terminal statuses on Tier 2 features
  const tier2Features = []
  for (const c of rawTier2Features) {
    if (TERMINAL_STATUSES.includes(c.status)) {
      terminalFilteredCount++
      continue
    }
    tier2Features.push({ ...c, tier: 2 })
  }
  tier2Features.sort(sortByPriority)

  const tier2RfesTagged = tier2Rfes.map(c => ({ ...c, tier: 2 }))
  tier2RfesTagged.sort(sortByPriority)

  // Phase D: Tier 3 discovery
  const tier2FeatureKeys = new Set(tier2Features.map(c => c.issueKey))
  const tier3Exclude = new Set([...tier1FeatureKeys, ...tier2FeatureKeys])

  const rawTier3Features = await fetchTier3Features(
    fetchAllJqlResults, jiraRequest, tier3Exclude, fieldMapping, customFieldIds
  )

  const tier3Features = []
  for (const c of rawTier3Features) {
    if (TERMINAL_STATUSES.includes(c.status)) {
      terminalFilteredCount++
      continue
    }
    if (c.targetRelease || c.fixVersion) continue
    tier3Features.push({ ...c, tier: 3 })
  }
  tier3Features.sort(sortByPriority)

  const allFeatures = [...tier1Features, ...tier2Features, ...tier3Features]
  const allRfes = [...tier1Rfes, ...tier2RfesTagged]

  // Per-rock stats
  const perRockStats = {}
  for (const rock of rocksWithOutcomes) {
    const features = tier1Features.filter(c => c.bigRock.split(', ')[0] === rock.name).length
    const rfes = tier1Rfes.filter(c => c.bigRock.split(', ')[0] === rock.name).length
    perRockStats[rock.name] = { features, rfes }
  }

  return {
    features: allFeatures,
    rfes: allRfes,
    tier1Features: tier1Features.length,
    tier1Rfes: tier1Rfes.length,
    tier2Features: tier2Features.length,
    tier2Rfes: tier2RfesTagged.length,
    tier3Features: tier3Features.length,
    perRockStats,
    outcomeSummaries,
    release,
    skippedCount,
    terminalFilteredCount,
    rocksWithoutOutcomes: rocksWithout.map(r => r.name)
  }
}

function buildCandidateResponse(pipelineResult, version, bigRocks, demoMode) {
  const { features, rfes, outcomeSummaries, perRockStats } = pipelineResult

  const allStatuses = new Set()
  const allTeams = new Set()
  const allPriorities = new Set()
  const allPillars = new Set()

  for (const f of features) {
    if (f.status) allStatuses.add(f.status)
    if (f.components) allTeams.add(f.components)
    if (f.priority) allPriorities.add(f.priority)
  }
  for (const r of rfes) {
    if (r.status) allStatuses.add(r.status)
    if (r.priority) allPriorities.add(r.priority)
  }
  for (const rock of bigRocks) {
    if (rock.pillar) allPillars.add(rock.pillar)
  }

  const rockSummaries = bigRocks.map(rock => ({
    priority: rock.priority,
    name: rock.name,
    fullName: rock.fullName,
    pillar: rock.pillar,
    state: rock.state,
    owner: rock.owner,
    architect: rock.architect,
    outcomeKeys: rock.outcomeKeys,
    outcomeDescriptions: {},
    featureCount: (perRockStats[rock.name] || {}).features || 0,
    rfeCount: (perRockStats[rock.name] || {}).rfes || 0,
    notes: rock.notes || ''
  }))

  // Fill in outcome descriptions
  for (const rock of rockSummaries) {
    for (const key of rock.outcomeKeys) {
      if (outcomeSummaries[key]) {
        rock.outcomeDescriptions[key] = outcomeSummaries[key]
      }
    }
  }

  return {
    version,
    jiraBaseUrl: JIRA_BROWSE_URL,
    lastRefreshed: new Date().toISOString(),
    demoMode: !!demoMode,
    summary: {
      totalFeatures: features.length,
      totalRfes: rfes.length,
      totalBigRocks: bigRocks.length,
      rocksWithData: Object.values(perRockStats).filter(s => s.features > 0 || s.rfes > 0).length,
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
    features: features.map(f => ({
      ...f,
      tier: f.tier || 1
    })),
    rfes: rfes.map(r => ({
      ...r,
      tier: r.tier || 1
    })),
    filterOptions: {
      pillars: [...allPillars].sort(),
      rocks: bigRocks.map(r => r.name),
      statuses: [...allStatuses].sort(),
      teams: [...allTeams].sort(),
      priorities: [...allPriorities].sort()
    }
  }
}

module.exports = { runPipeline, buildCandidateResponse }
