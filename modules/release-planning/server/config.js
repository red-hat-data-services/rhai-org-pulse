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
    releaseType: 'customfield_10851'
  }
}

function getConfig(readFromStorage) {
  const stored = readFromStorage('release-planning/config.json')
  if (stored && typeof stored === 'object') {
    return {
      ...DEFAULT_CONFIG,
      ...stored,
      fieldMapping: { ...DEFAULT_CONFIG.fieldMapping, ...(stored.fieldMapping || {}) },
      customFieldIds: { ...DEFAULT_CONFIG.customFieldIds, ...(stored.customFieldIds || {}) }
    }
  }
  return { ...DEFAULT_CONFIG }
}

function loadBigRocks(readFromStorage, version) {
  const config = getConfig(readFromStorage)
  const releaseConfig = config.releases[version]
  if (!releaseConfig || !releaseConfig.bigRocks) {
    return []
  }
  return releaseConfig.bigRocks
}

function loadFieldMapping(readFromStorage) {
  const config = getConfig(readFromStorage)
  return config.fieldMapping || DEFAULT_CONFIG.fieldMapping
}

function getConfiguredReleases(readFromStorage) {
  const config = getConfig(readFromStorage)
  return Object.keys(config.releases || {}).map(version => ({
    version,
    bigRockCount: (config.releases[version].bigRocks || []).length
  }))
}

/**
 * Save a Big Rock (create or update) within a release.
 * The server renumbers priorities sequentially after every write.
 *
 * @param {Function} readFromStorage
 * @param {Function} writeToStorage
 * @param {string} version - Release version
 * @param {string|null} originalName - The existing name to update, or null for new
 * @param {object} data - Big Rock fields
 * @returns {object} { bigRock, bigRocks } - The saved rock and the full updated list
 */
function saveBigRock(readFromStorage, writeToStorage, version, originalName, data) {
  const config = getConfig(readFromStorage)

  if (!config.releases[version]) {
    throw new Error(`Release ${version} not found`)
  }

  const bigRocks = config.releases[version].bigRocks || []

  if (originalName) {
    // Update existing
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
    // Add new
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

  // Renumber priorities sequentially
  renumberPriorities(bigRocks)

  config.releases[version].bigRocks = bigRocks
  writeToStorage('release-planning/config.json', config)

  const savedRock = bigRocks.find(function(r) { return r.name === (data.name || '').trim() })
  return { bigRock: savedRock, bigRocks: bigRocks }
}

/**
 * Delete a Big Rock by name from a release.
 *
 * @param {Function} readFromStorage
 * @param {Function} writeToStorage
 * @param {string} version - Release version
 * @param {string} name - Big Rock name to delete
 * @returns {object} { deleted, bigRocks } - The deleted name and remaining list
 */
function deleteBigRock(readFromStorage, writeToStorage, version, name) {
  const config = getConfig(readFromStorage)

  if (!config.releases[version]) {
    throw new Error(`Release ${version} not found`)
  }

  const bigRocks = config.releases[version].bigRocks || []
  const idx = bigRocks.findIndex(function(r) { return r.name === name })

  if (idx === -1) {
    throw new Error(`Big Rock '${name}' not found for release ${version}`)
  }

  bigRocks.splice(idx, 1)

  // Renumber priorities sequentially
  renumberPriorities(bigRocks)

  config.releases[version].bigRocks = bigRocks
  writeToStorage('release-planning/config.json', config)

  return { deleted: name, bigRocks: bigRocks }
}

/**
 * Reorder Big Rocks within a release.
 * The orderedNames array must exactly match the set of current Big Rock names.
 *
 * @param {Function} readFromStorage
 * @param {Function} writeToStorage
 * @param {string} version - Release version
 * @param {string[]} orderedNames - Big Rock names in desired order
 * @returns {object} { bigRocks } - The reordered list with new priorities
 */
function reorderBigRocks(readFromStorage, writeToStorage, version, orderedNames) {
  var config = getConfig(readFromStorage)

  if (!config.releases[version]) {
    throw new Error('Release ' + version + ' not found')
  }

  var bigRocks = config.releases[version].bigRocks || []
  var currentNames = bigRocks.map(function(r) { return r.name })

  // Validate: orderedNames must be an array
  if (!Array.isArray(orderedNames)) {
    throw new Error('orderedNames must be an array')
  }

  // Validate: same count
  if (orderedNames.length !== currentNames.length) {
    throw Object.assign(
      new Error('Order list does not match current Big Rocks. Expected names: ' + JSON.stringify(currentNames)),
      { statusCode: 409 }
    )
  }

  // Validate: same set of names (no duplicates, no extras, no missing)
  var currentSet = Object.create(null)
  for (var i = 0; i < currentNames.length; i++) {
    currentSet[currentNames[i]] = true
  }
  var submittedSet = Object.create(null)
  for (var j = 0; j < orderedNames.length; j++) {
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

  // Build a lookup map for fast access
  var rockByName = Object.create(null)
  for (var k = 0; k < bigRocks.length; k++) {
    rockByName[bigRocks[k].name] = bigRocks[k]
  }

  // Reorder
  var reordered = orderedNames.map(function(name) { return rockByName[name] })

  // Renumber priorities
  renumberPriorities(reordered)

  config.releases[version].bigRocks = reordered
  writeToStorage('release-planning/config.json', config)

  return { bigRocks: reordered }
}

/**
 * Create a new blank release.
 *
 * @param {Function} readFromStorage
 * @param {Function} writeToStorage
 * @param {string} version - Release version string
 * @returns {object} { version, bigRockCount }
 */
function createRelease(readFromStorage, writeToStorage, version) {
  if (!version || typeof version !== 'string' || version.trim().length === 0) {
    throw new Error('Version is required')
  }

  var config = getConfig(readFromStorage)

  if (config.releases[version]) {
    throw Object.assign(
      new Error('Release ' + version + ' already exists'),
      { statusCode: 409 }
    )
  }

  config.releases[version] = { release: version, bigRocks: [] }
  writeToStorage('release-planning/config.json', config)

  return { version: version, bigRockCount: 0 }
}

/**
 * Create a new release by cloning Big Rocks from an existing release.
 *
 * @param {Function} readFromStorage
 * @param {Function} writeToStorage
 * @param {string} version - New release version string
 * @param {string} cloneFrom - Source release version to clone from
 * @returns {object} { version, bigRockCount }
 */
function cloneRelease(readFromStorage, writeToStorage, version, cloneFrom) {
  if (!version || typeof version !== 'string' || version.trim().length === 0) {
    throw new Error('Version is required')
  }

  var config = getConfig(readFromStorage)

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

  // Deep-copy the bigRocks array so edits to the clone don't affect the source
  var sourceBigRocks = config.releases[cloneFrom].bigRocks || []
  var clonedBigRocks = JSON.parse(JSON.stringify(sourceBigRocks))

  config.releases[version] = { release: version, bigRocks: clonedBigRocks }
  writeToStorage('release-planning/config.json', config)

  return { version: version, bigRockCount: clonedBigRocks.length }
}

/**
 * Delete a release and its configuration.
 *
 * @param {Function} readFromStorage
 * @param {Function} writeToStorage
 * @param {string} version - Release version to delete
 * @returns {object} { deleted }
 */
function deleteRelease(readFromStorage, writeToStorage, version) {
  var config = getConfig(readFromStorage)

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
 * Renumber priorities sequentially starting from 1.
 * Modifies the array in place.
 */
function renumberPriorities(bigRocks) {
  for (var i = 0; i < bigRocks.length; i++) {
    bigRocks[i].priority = i + 1
  }
}

module.exports = {
  DEFAULT_CONFIG,
  getConfig,
  loadBigRocks,
  loadFieldMapping,
  getConfiguredReleases,
  saveBigRock,
  deleteBigRock,
  reorderBigRocks,
  createRelease,
  cloneRelease,
  deleteRelease
}
