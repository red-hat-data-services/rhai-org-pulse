const DEFAULT_CONFIG = {
  releases: {},
  fieldMapping: {
    team: 'customfield_10001',
    architect: 'customfield_10467',
    deliveryOwner: 'assignee',
    pm: 'customfield_10469',
    targetRelease: 'customfield_10855',
    rfeLinkType: 'is required by'
  },
  customFieldIds: {
    targetVersion: 'customfield_10855',
    productManager: 'customfield_10469',
    releaseType: 'customfield_10851',
    riceReach: '',
    riceImpact: '',
    riceConfidence: '',
    riceEffort: ''
  },
  healthConfig: {
    enableRice: false,
    enableJiraEnrichment: true,
    enrichmentBatchSize: 40,
    enrichmentThrottleMs: 1000,
    healthRefreshTimeoutMs: 480000,
    riskThresholds: {
      velocityGreenMin: 80,
      velocityYellowMin: 50,
      dorGreenMin: 80,
      dorYellowMin: 50
    },
    phaseCompletionExpectations: null
  }
}

function releaseFilePath(version) {
  return 'release-planning/releases/' + version + '.json'
}

function getConfig(readFromStorage) {
  const stored = readFromStorage('release-planning/config.json')
  if (stored && typeof stored === 'object') {
    const storedHealth = stored.healthConfig || {}
    return {
      ...DEFAULT_CONFIG,
      ...stored,
      fieldMapping: { ...DEFAULT_CONFIG.fieldMapping, ...(stored.fieldMapping || {}) },
      customFieldIds: { ...DEFAULT_CONFIG.customFieldIds, ...(stored.customFieldIds || {}) },
      healthConfig: {
        ...DEFAULT_CONFIG.healthConfig,
        ...storedHealth,
        riskThresholds: {
          ...DEFAULT_CONFIG.healthConfig.riskThresholds,
          ...(storedHealth.riskThresholds || {})
        }
      }
    }
  }
  return { ...DEFAULT_CONFIG }
}

function loadReleaseData(readFromStorage, version) {
  return readFromStorage(releaseFilePath(version)) || { release: version, bigRocks: [] }
}

function loadBigRocks(readFromStorage, version) {
  const data = loadReleaseData(readFromStorage, version)
  return data.bigRocks || []
}

function loadFieldMapping(readFromStorage) {
  const config = getConfig(readFromStorage)
  return config.fieldMapping || DEFAULT_CONFIG.fieldMapping
}

function getConfiguredReleases(readFromStorage) {
  const config = getConfig(readFromStorage)
  return Object.keys(config.releases || {}).map(function(version) {
    const releaseData = loadReleaseData(readFromStorage, version)
    return {
      version: version,
      bigRockCount: (releaseData.bigRocks || []).length
    }
  })
}

/**
 * Save a Big Rock (create or update) within a release.
 * Reads/writes only the per-release file, not the global config.
 */
function saveBigRock(readFromStorage, writeToStorage, version, originalName, data) {
  const releaseData = loadReleaseData(readFromStorage, version)
  const bigRocks = releaseData.bigRocks || []

  if (originalName) {
    const idx = bigRocks.findIndex(function(r) { return r.name === originalName })
    if (idx === -1) {
      throw new Error(`Big Rock '${originalName}' not found for release ${version}`)
    }
    bigRocks[idx] = {
      ...bigRocks[idx],
      name: (data.name || '').trim(),
      fullName: data.fullName || '',
      pillar: data.pillar || '',
      state: data.state || '',
      owner: data.owner || '',
      architect: data.architect || '',
      outcomeKeys: data.outcomeKeys || [],
      notes: data.notes || '',
      description: data.description || ''
    }
  } else {
    const newRock = {
      priority: bigRocks.length + 1,
      name: (data.name || '').trim(),
      fullName: data.fullName || '',
      pillar: data.pillar || '',
      state: data.state || '',
      owner: data.owner || '',
      architect: data.architect || '',
      outcomeKeys: data.outcomeKeys || [],
      notes: data.notes || '',
      description: data.description || ''
    }
    if (data.priority && Number.isInteger(data.priority) && data.priority >= 1) {
      newRock.priority = data.priority
    }
    bigRocks.push(newRock)
  }

  renumberPriorities(bigRocks)

  releaseData.bigRocks = bigRocks
  writeToStorage(releaseFilePath(version), releaseData)

  const savedRock = bigRocks.find(function(r) { return r.name === (data.name || '').trim() })
  return { bigRock: savedRock, bigRocks: bigRocks }
}

/**
 * Delete a Big Rock by name from a release.
 * Reads/writes only the per-release file.
 */
function deleteBigRock(readFromStorage, writeToStorage, version, name) {
  const releaseData = loadReleaseData(readFromStorage, version)
  const bigRocks = releaseData.bigRocks || []
  const idx = bigRocks.findIndex(function(r) { return r.name === name })

  if (idx === -1) {
    throw new Error(`Big Rock '${name}' not found for release ${version}`)
  }

  bigRocks.splice(idx, 1)
  renumberPriorities(bigRocks)

  releaseData.bigRocks = bigRocks
  writeToStorage(releaseFilePath(version), releaseData)

  return { deleted: name, bigRocks: bigRocks }
}

/**
 * Reorder Big Rocks within a release.
 * Reads/writes only the per-release file.
 */
function reorderBigRocks(readFromStorage, writeToStorage, version, orderedNames) {
  const config = getConfig(readFromStorage)
  if (!config.releases[version]) {
    throw Object.assign(
      new Error('Release ' + version + ' not found'),
      { statusCode: 404 }
    )
  }

  const releaseData = loadReleaseData(readFromStorage, version)
  const bigRocks = releaseData.bigRocks || []
  const currentNames = bigRocks.map(function(r) { return r.name })

  if (!Array.isArray(orderedNames)) {
    throw new Error('orderedNames must be an array')
  }

  if (orderedNames.length !== currentNames.length) {
    throw Object.assign(
      new Error('Order list does not match current Big Rocks. Expected names: ' + JSON.stringify(currentNames)),
      { statusCode: 409 }
    )
  }

  const currentSet = Object.create(null)
  for (let i = 0; i < currentNames.length; i++) {
    currentSet[currentNames[i]] = true
  }
  const submittedSet = Object.create(null)
  for (let j = 0; j < orderedNames.length; j++) {
    if (submittedSet[orderedNames[j]]) {
      throw Object.assign(
        new Error('Order list contains duplicate name: ' + orderedNames[j] + '. Expected names: ' + JSON.stringify(currentNames)),
        { statusCode: 409 }
      )
    }
    submittedSet[orderedNames[j]] = true
    if (!currentSet[orderedNames[j]]) {
      throw Object.assign(
        new Error('Order list does not match current Big Rocks. Expected names: ' + JSON.stringify(currentNames)),
        { statusCode: 409 }
      )
    }
  }

  const rockByName = Object.create(null)
  for (let k = 0; k < bigRocks.length; k++) {
    rockByName[bigRocks[k].name] = bigRocks[k]
  }

  const reordered = orderedNames.map(function(name) { return rockByName[name] })
  renumberPriorities(reordered)

  releaseData.bigRocks = reordered
  writeToStorage(releaseFilePath(version), releaseData)

  return { bigRocks: reordered }
}

/**
 * Create a new blank release.
 * Registers in config.json and creates per-release file.
 */
function createRelease(readFromStorage, writeToStorage, version) {
  if (!version || typeof version !== 'string' || version.trim().length === 0) {
    throw new Error('Version is required')
  }

  const config = getConfig(readFromStorage)

  if (config.releases[version]) {
    throw Object.assign(
      new Error('Release ' + version + ' already exists'),
      { statusCode: 409 }
    )
  }

  config.releases[version] = { release: version }
  writeToStorage('release-planning/config.json', config)
  writeToStorage(releaseFilePath(version), { release: version, bigRocks: [] })

  return { version: version, bigRockCount: 0 }
}

/**
 * Create a new release by cloning Big Rocks from an existing release.
 * Registers in config.json and creates per-release file with cloned data.
 */
function cloneRelease(readFromStorage, writeToStorage, version, cloneFrom) {
  if (!version || typeof version !== 'string' || version.trim().length === 0) {
    throw new Error('Version is required')
  }

  const config = getConfig(readFromStorage)

  if (config.releases[version]) {
    throw Object.assign(
      new Error('Release ' + version + ' already exists'),
      { statusCode: 409 }
    )
  }

  if (!config.releases[cloneFrom]) {
    throw Object.assign(
      new Error('Source release ' + cloneFrom + ' not found'),
      { statusCode: 404 }
    )
  }

  const sourceData = loadReleaseData(readFromStorage, cloneFrom)
  const clonedBigRocks = JSON.parse(JSON.stringify(sourceData.bigRocks || []))

  config.releases[version] = { release: version }
  writeToStorage('release-planning/config.json', config)
  writeToStorage(releaseFilePath(version), { release: version, bigRocks: clonedBigRocks })

  return { version: version, bigRockCount: clonedBigRocks.length }
}

/**
 * Delete a release from the registry.
 * The caller is responsible for deleting the per-release file and cache.
 */
function deleteRelease(readFromStorage, writeToStorage, version) {
  const config = getConfig(readFromStorage)

  if (!config.releases[version]) {
    throw Object.assign(
      new Error('Release ' + version + ' not found'),
      { statusCode: 404 }
    )
  }

  delete config.releases[version]
  writeToStorage('release-planning/config.json', config)

  return { deleted: version }
}

/**
 * Migrate legacy config: move bigRocks from config.json release entries
 * into per-release files. Idempotent — skips releases already migrated.
 */
function migrateConfig(readFromStorage, writeToStorage) {
  const config = getConfig(readFromStorage)
  const versions = Object.keys(config.releases || {})
  let migrated = 0

  for (let i = 0; i < versions.length; i++) {
    const version = versions[i]
    const entry = config.releases[version]
    if (!entry || !Array.isArray(entry.bigRocks)) continue

    const existing = readFromStorage(releaseFilePath(version))
    if (existing) continue

    writeToStorage(releaseFilePath(version), {
      release: version,
      bigRocks: entry.bigRocks
    })

    delete entry.bigRocks
    migrated++
  }

  if (migrated > 0) {
    writeToStorage('release-planning/config.json', config)
    console.log('[release-planning] Migrated ' + migrated + ' release(s) to per-release files')
  }
}

/**
 * Renumber priorities sequentially starting from 1.
 * Modifies the array in place.
 */
function renumberPriorities(bigRocks) {
  for (let i = 0; i < bigRocks.length; i++) {
    bigRocks[i].priority = i + 1
  }
}

module.exports = {
  DEFAULT_CONFIG,
  getConfig,
  loadReleaseData,
  loadBigRocks,
  loadFieldMapping,
  getConfiguredReleases,
  saveBigRock,
  deleteBigRock,
  reorderBigRocks,
  createRelease,
  cloneRelease,
  deleteRelease,
  migrateConfig,
  releaseFilePath
}
