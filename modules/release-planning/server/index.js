const { jiraRequest, fetchAllJqlResults } = require('../../../shared/server/jira')
const { getConfig, loadBigRocks, getConfiguredReleases, saveBigRock, deleteBigRock, reorderBigRocks, createRelease, cloneRelease, deleteRelease } = require('./config')
const { runPipeline, buildCandidateResponse } = require('./pipeline')
const { CACHE_MAX_AGE_MS } = require('./constants')
const { withConfigLock } = require('./config-lock')
const { backupConfig } = require('./config-backup')
const { validateBigRock } = require('./validation')
const { createRequirePM, getPMUsers, addPMUser, removePMUser } = require('./pm-auth')
const { previewDocImport, executeDocImport } = require('./doc-import')
const smartsheetClient = require('../../../shared/server/smartsheet')

const DEMO_MODE = process.env.DEMO_MODE === 'true'
const DATA_PREFIX = 'release-planning'
const VERSION_RE = /^[a-zA-Z0-9._-]{1,50}$/
const RESERVED_VERSIONS = ['__proto__', 'constructor', 'prototype']

function isValidVersion(version) {
  return VERSION_RE.test(version) && !RESERVED_VERSIONS.includes(version)
}

module.exports = function registerRoutes(router, context) {
  const { storage, requireAuth, requireAdmin } = context
  const { readFromStorage, writeToStorage } = storage
  const listStorageFiles = storage.listStorageFiles || null
  const deleteFromStorage = storage.deleteFromStorage || null

  // PM role middleware: admins and listed PM users can edit
  const requirePM = createRequirePM(readFromStorage)

  let refreshState = { running: false, lastResult: null }

  // Demo mode guard: block all non-GET requests when DEMO_MODE is true
  if (DEMO_MODE) {
    router.use(function(req, res, next) {
      if (req.method !== 'GET') {
        return res.status(403).json({
          status: 'skipped',
          message: req.method + ' operations disabled in demo mode'
        })
      }
      next()
    })
  }

  function loadFixture(name) {
    const fs = require('fs')
    const fixturePath = require('path').join(__dirname, '..', '..', '..', 'fixtures', DATA_PREFIX, name)
    try {
      return JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))
    } catch {
      return null
    }
  }

  function triggerBackgroundRefresh(version) {
    if (refreshState.running) return
    refreshState = {
      running: true,
      version,
      startedAt: new Date().toISOString(),
      lastResult: refreshState.lastResult
    }

    const config = getConfig(readFromStorage)
    const bigRocks = loadBigRocks(readFromStorage, version)

    if (!bigRocks.length) {
      refreshState.running = false
      refreshState.lastResult = {
        status: 'error',
        message: `No Big Rocks configured for release ${version}`,
        completedAt: new Date().toISOString()
      }
      return
    }

    runPipeline(config, bigRocks, version, fetchAllJqlResults, jiraRequest)
      .then(function(result) {
        const response = buildCandidateResponse(result, version, bigRocks, false)
        writeToStorage(`${DATA_PREFIX}/candidates-cache-${version}.json`, {
          cachedAt: new Date().toISOString(),
          data: response
        })
        refreshState.lastResult = {
          status: 'success',
          message: `Pipeline completed: ${result.features.length} features, ${result.rfes.length} RFEs`,
          completedAt: new Date().toISOString()
        }
      })
      .catch(function(err) {
        console.error('[release-planning] Background refresh failed:', err)
        refreshState.lastResult = {
          status: 'error',
          message: 'Pipeline refresh failed. Check server logs for details.',
          completedAt: new Date().toISOString()
        }
      })
      .finally(function() {
        refreshState.running = false
      })
  }

  // GET /releases
  router.get('/releases', requireAuth, function(req, res) {
    if (DEMO_MODE) {
      const demoConfig = loadFixture('config.json')
      if (demoConfig && demoConfig.releases) {
        const releases = Object.keys(demoConfig.releases).map(function(v) {
          return {
            version: v,
            bigRockCount: (demoConfig.releases[v].bigRocks || []).length
          }
        })
        return res.json(releases)
      }
      return res.json([])
    }

    const releases = getConfiguredReleases(readFromStorage)
    res.json(releases)
  })

  // GET /releases/:version/candidates
  router.get('/releases/:version/candidates', requireAuth, function(req, res) {
    const version = req.params.version
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    const rockFilter = req.query.rockFilter || null
    const forceRefresh = req.query.refresh === 'true'

    if (DEMO_MODE) {
      const demoData = loadFixture('candidates-cache-demo.json')
      if (demoData) {
        let data = demoData
        if (rockFilter && data.features) {
          data = {
            ...data,
            features: data.features.filter(function(f) {
              return f.bigRock && f.bigRock.split(', ').includes(rockFilter)
            }),
            rfes: data.rfes.filter(function(r) {
              return r.bigRock && r.bigRock.split(', ').includes(rockFilter)
            })
          }
        }
        return res.json({ ...data, demoMode: true })
      }
      return res.status(404).json({ error: 'Demo data not available' })
    }

    const cached = readFromStorage(`${DATA_PREFIX}/candidates-cache-${version}.json`)
    const hasCachedData = cached && cached.data && cached.cachedAt

    if (hasCachedData) {
      const age = Date.now() - new Date(cached.cachedAt).getTime()
      const isStale = age >= CACHE_MAX_AGE_MS

      if (isStale || forceRefresh) {
        triggerBackgroundRefresh(version)
      }

      let data = cached.data
      if (rockFilter && data.features) {
        data = {
          ...data,
          features: data.features.filter(function(f) {
            return f.bigRock && f.bigRock.split(', ').includes(rockFilter)
          }),
          rfes: data.rfes.filter(function(r) {
            return r.bigRock && r.bigRock.split(', ').includes(rockFilter)
          })
        }
      }

      return res.json({
        ...data,
        _cacheStale: isStale || forceRefresh,
        _refreshing: refreshState.running
      })
    }

    triggerBackgroundRefresh(version)
    res.status(202).json({
      _cacheStale: true,
      _refreshing: true,
      _noCache: true,
      features: [],
      rfes: [],
      bigRocks: [],
      summary: null,
      warning: 'Pipeline is running for the first time. This may take a few minutes.'
    })
  })

  // POST /releases/:version/refresh
  router.post('/releases/:version/refresh', requireAdmin, function(req, res) {
    const version = req.params.version
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Refresh disabled in demo mode' })
    }
    if (refreshState.running) {
      return res.json({ status: 'already_running' })
    }
    triggerBackgroundRefresh(version)
    res.json({ status: 'started' })
  })

  // GET /refresh/status
  router.get('/refresh/status', requireAuth, function(req, res) {
    res.json(refreshState)
  })

  // GET /config
  router.get('/config', requireAdmin, function(req, res) {
    const config = getConfig(readFromStorage)
    res.json(config)
  })

  // ─── Cache Invalidation Helper ───

  function invalidateCache(version) {
    // Delete the candidates cache file so next GET re-fetches
    if (deleteFromStorage) {
      deleteFromStorage(`${DATA_PREFIX}/candidates-cache-${version}.json`)
    }
    // Trigger background refresh to rebuild the cache
    triggerBackgroundRefresh(version)
  }

  // ─── GET /permissions ───

  router.get('/permissions', requireAuth, function(req, res) {
    var pmList = getPMUsers(readFromStorage)
    var isPM = pmList.includes(req.userEmail)
    res.json({
      canEdit: !!req.isAdmin || isPM
    })
  })

  // ─── PUT /releases/:version/big-rocks/reorder ───
  // Must be registered BEFORE the :name route so Express doesn't match "reorder" as a name param.

  router.put('/releases/:version/big-rocks/reorder', requirePM, async function(req, res) {
    var version = req.params.version
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    var order = req.body && req.body.order
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'order must be an array of Big Rock names' })
    }

    try {
      var result = await withConfigLock(function() {
        return reorderBigRocks(readFromStorage, writeToStorage, version, order)
      })
      invalidateCache(version)
      res.json(result)
    } catch (err) {
      var status = err.statusCode || 500
      res.status(status).json({ error: err.message })
    }
  })

  // ─── PUT /releases/:version/big-rocks/:name ───

  router.put('/releases/:version/big-rocks/:name', requirePM, async function(req, res) {
    const version = req.params.version
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    const name = decodeURIComponent(req.params.name)

    try {
      const result = await withConfigLock(function() {
        // Validate
        const currentConfig = getConfig(readFromStorage)
        const releaseConfig = currentConfig.releases[version]
        if (!releaseConfig) {
          throw Object.assign(new Error('Release ' + version + ' not found'), { statusCode: 404 })
        }
        const existingRocks = releaseConfig.bigRocks || []
        const existingNames = existingRocks.map(function(r) { return r.name })

        const validation = validateBigRock(req.body, {
          existingNames: existingNames,
          originalName: name
        })
        if (!validation.valid) {
          throw Object.assign(new Error('Validation failed'), { statusCode: 400, fields: validation.errors })
        }

        return saveBigRock(readFromStorage, writeToStorage, version, name, req.body)
      })

      invalidateCache(version)
      res.json(result)
    } catch (err) {
      var status = err.statusCode || 500
      var response = { error: err.message }
      if (err.fields) response.fields = err.fields
      res.status(status).json(response)
    }
  })

  // ─── POST /releases/:version/big-rocks ───

  router.post('/releases/:version/big-rocks', requirePM, async function(req, res) {
    const version = req.params.version
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }

    try {
      const result = await withConfigLock(function() {
        // Validate
        const currentConfig = getConfig(readFromStorage)
        const releaseConfig = currentConfig.releases[version]
        if (!releaseConfig) {
          throw Object.assign(new Error('Release ' + version + ' not found'), { statusCode: 404 })
        }
        const existingRocks = releaseConfig.bigRocks || []
        const existingNames = existingRocks.map(function(r) { return r.name })

        const validation = validateBigRock(req.body, {
          existingNames: existingNames
        })
        if (!validation.valid) {
          throw Object.assign(new Error('Validation failed'), { statusCode: 400, fields: validation.errors })
        }

        return saveBigRock(readFromStorage, writeToStorage, version, null, req.body)
      })

      invalidateCache(version)
      res.status(201).json(result)
    } catch (err) {
      var status = err.statusCode || 500
      var response = { error: err.message }
      if (err.fields) response.fields = err.fields
      res.status(status).json(response)
    }
  })

  // ─── DELETE /releases/:version/big-rocks/:name ───

  router.delete('/releases/:version/big-rocks/:name', requirePM, async function(req, res) {
    const version = req.params.version
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    const name = decodeURIComponent(req.params.name)

    try {
      const result = await withConfigLock(function() {
        // Check existence first
        const currentConfig = getConfig(readFromStorage)
        const releaseConfig = currentConfig.releases[version]
        if (!releaseConfig) {
          throw Object.assign(new Error('Release ' + version + ' not found'), { statusCode: 404 })
        }
        const existingRocks = releaseConfig.bigRocks || []
        const found = existingRocks.find(function(r) { return r.name === name })
        if (!found) {
          throw Object.assign(new Error("Big Rock '" + name + "' not found for release " + version), { statusCode: 404 })
        }

        // Backup before destructive write
        backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)

        return deleteBigRock(readFromStorage, writeToStorage, version, name)
      })

      invalidateCache(version)
      res.json(result)
    } catch (err) {
      var status = err.statusCode || 500
      res.status(status).json({ error: err.message })
    }
  })

  // ─── POST /releases ───

  router.post('/releases', requirePM, async function(req, res) {
    var version = req.body && req.body.version
    var cloneFrom = req.body && req.body.cloneFrom

    if (!version || typeof version !== 'string') {
      return res.status(400).json({ error: 'version is required' })
    }
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    if (cloneFrom && !isValidVersion(cloneFrom)) {
      return res.status(400).json({ error: 'Invalid cloneFrom version format' })
    }

    try {
      var result = await withConfigLock(function() {
        if (cloneFrom) {
          backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)
          return cloneRelease(readFromStorage, writeToStorage, version, cloneFrom)
        }
        return createRelease(readFromStorage, writeToStorage, version)
      })
      res.status(201).json(result)
    } catch (err) {
      var status = err.statusCode || 500
      res.status(status).json({ error: err.message })
    }
  })

  // ─── DELETE /releases/:version ───

  router.delete('/releases/:version', requireAdmin, async function(req, res) {
    var version = req.params.version
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }

    try {
      var result = await withConfigLock(function() {
        backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)
        return deleteRelease(readFromStorage, writeToStorage, version)
      })

      // Also delete the candidates cache file for this version
      if (deleteFromStorage) {
        deleteFromStorage(DATA_PREFIX + '/candidates-cache-' + version + '.json')
      }

      res.json(result)
    } catch (err) {
      var status = err.statusCode || 500
      res.status(status).json({ error: err.message })
    }
  })

  // ─── POST /jira/validate-keys ───

  router.post('/jira/validate-keys', requirePM, async function(req, res) {
    const keys = req.body && req.body.keys
    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ error: 'keys must be a non-empty array' })
    }
    if (keys.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 keys per request' })
    }

    const results = {}
    const keysToFetch = keys.filter(function(k) {
      return typeof k === 'string' && /^[A-Z]+-\d+$/.test(k)
    })

    // Mark invalid-format keys immediately
    for (var i = 0; i < keys.length; i++) {
      if (typeof keys[i] !== 'string' || !/^[A-Z]+-\d+$/.test(keys[i])) {
        results[keys[i]] = { valid: false, error: 'Invalid key format' }
      }
    }

    if (keysToFetch.length > 0) {
      try {
        const keysStr = keysToFetch.join(', ')
        const jql = 'key in (' + keysStr + ')'
        const rawIssues = await fetchAllJqlResults(jiraRequest, jql, 'summary', { maxResults: 100 })

        const foundKeys = {}
        for (var j = 0; j < rawIssues.length; j++) {
          foundKeys[rawIssues[j].key] = (rawIssues[j].fields || {}).summary || ''
        }

        for (var k = 0; k < keysToFetch.length; k++) {
          var key = keysToFetch[k]
          if (foundKeys[key] !== undefined) {
            results[key] = { valid: true, summary: foundKeys[key] }
          } else {
            results[key] = { valid: false, error: 'Issue not found' }
          }
        }
      } catch (err) {
        console.error('[release-planning] Jira key validation failed:', err.message)
        for (var m = 0; m < keysToFetch.length; m++) {
          if (!results[keysToFetch[m]]) {
            results[keysToFetch[m]] = { valid: false, error: 'Jira unavailable' }
          }
        }
      }
    }

    res.json({ results: results })
  })

  // ─── PM User Management ───

  router.get('/pm-users', requireAdmin, function(req, res) {
    var emails = getPMUsers(readFromStorage)
    res.json({ emails: emails })
  })

  router.post('/pm-users', requireAdmin, function(req, res) {
    var email = req.body && req.body.email
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'email is required' })
    }
    var emails = addPMUser(readFromStorage, writeToStorage, email.trim())
    res.json({ emails: emails })
  })

  router.delete('/pm-users/:email', requireAdmin, function(req, res) {
    var email = decodeURIComponent(req.params.email)
    var emails = removePMUser(readFromStorage, writeToStorage, email)
    res.json({ emails: emails })
  })

  // ─── Google Doc Import ───

  router.post('/releases/:version/import/doc/preview', requirePM, async function(req, res) {
    var version = req.params.version
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    var docId = req.body && req.body.docId
    if (!docId) {
      return res.status(400).json({ error: 'docId is required' })
    }

    try {
      var result = await previewDocImport(docId)

      // Annotate each rock with duplicate/validation status for the target release
      var config = getConfig(readFromStorage)
      var existingRocks = (config.releases[version] && config.releases[version].bigRocks) || []
      var existingNames = new Set(existingRocks.map(function(r) { return r.name }))

      for (var i = 0; i < result.bigRocks.length; i++) {
        var rock = result.bigRocks[i]
        if (existingNames.has(rock.name)) {
          rock.status = 'duplicate'
        } else {
          var validation = validateBigRock(rock, {
            existingNames: Array.from(existingNames)
          })
          rock.status = validation.valid ? 'new' : 'validation_error'
          if (!validation.valid) rock.validationErrors = validation.errors
        }
      }

      res.json(result)
    } catch (err) {
      var status = err.statusCode || 500
      res.status(status).json({ error: err.message, shareWith: err.shareWith })
    }
  })

  router.post('/releases/:version/import/doc', requirePM, async function(req, res) {
    var version = req.params.version
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    var docId = req.body && req.body.docId
    var mode = req.body && req.body.mode
    if (!docId) {
      return res.status(400).json({ error: 'docId is required' })
    }
    if (mode !== 'replace' && mode !== 'append') {
      return res.status(400).json({ error: 'mode must be "replace" or "append"' })
    }

    try {
      // Fetch and parse the Google Doc OUTSIDE the config lock.
      // The network call can take up to 30s; holding the lock during that
      // time would starve all CRUD operations (lock starvation).
      var parsedDoc = await previewDocImport(docId)

      // Only hold the lock for the fast, synchronous config read-modify-write.
      var result = await withConfigLock(function() {
        if (mode === 'replace') {
          backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)
        }
        // executeDocImport is synchronous -- it receives the pre-parsed
        // doc data and writes through saveBigRock (no network calls).
        return executeDocImport(readFromStorage, writeToStorage, version, docId, mode, parsedDoc)
      })

      invalidateCache(version)
      res.json(result)
    } catch (err) {
      var status = err.statusCode || 500
      res.status(status).json({ error: err.message })
    }
  })

  // ─── SmartSheet Release Discovery ───

  router.get('/smartsheet/releases', requireAuth, async function(req, res) {
    try {
      if (!smartsheetClient.isConfigured()) {
        return res.status(503).json({
          error: 'SmartSheet integration is not available. SMARTSHEET_API_TOKEN is not configured.'
        })
      }

      var releases = await smartsheetClient.discoverReleases()
      var configuredVersions = getConfiguredReleases(readFromStorage).map(function(r) { return r.version })
      var configuredSet = new Set(configuredVersions)

      var available = releases.map(function(rel) {
        return {
          version: rel.version,
          ea1Target: rel.ea1Target,
          ea2Target: rel.ea2Target,
          gaTarget: rel.gaTarget,
          alreadyConfigured: configuredSet.has(rel.version)
        }
      })

      res.json({
        available: available,
        configured: configuredVersions,
        cachedAt: new Date().toISOString()
      })
    } catch (err) {
      var status = err.statusCode || 500
      res.status(status).json({ error: err.message })
    }
  })

  // ─── Admin Seed / Bootstrap ───

  router.post('/admin/seed', requireAdmin, async function(req, res) {
    var config = req.body
    if (!config || typeof config !== 'object' || !config.releases) {
      return res.status(400).json({ error: 'Request body must include a "releases" object' })
    }

    var versions = Object.keys(config.releases)
    for (var i = 0; i < versions.length; i++) {
      if (!VERSION_RE.test(versions[i]) || RESERVED_VERSIONS.includes(versions[i])) {
        return res.status(400).json({ error: 'Invalid version: ' + versions[i] })
      }
    }

    try {
      var result = await withConfigLock(function() {
        backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)

        var existing = getConfig(readFromStorage)
        var merged = {
          ...existing,
          ...config,
          releases: { ...existing.releases, ...config.releases },
          fieldMapping: { ...existing.fieldMapping, ...(config.fieldMapping || {}) },
          customFieldIds: { ...existing.customFieldIds, ...(config.customFieldIds || {}) }
        }

        writeToStorage('release-planning/config.json', merged)

        var seededVersions = versions.map(function(v) {
          return { version: v, bigRockCount: (merged.releases[v].bigRocks || []).length }
        })

        return { seeded: seededVersions, totalReleases: Object.keys(merged.releases).length }
      })

      res.json(result)
    } catch (err) {
      var status = err.statusCode || 500
      res.status(status).json({ error: err.message })
    }
  })

  router.get('/admin/seed/fixture', requireAdmin, function(req, res) {
    var fixture = loadFixture('config.json')
    if (!fixture) {
      return res.status(404).json({ error: 'No fixture data found' })
    }
    res.json(fixture)
  })

  // Diagnostics
  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const releases = getConfiguredReleases(readFromStorage)
      const cacheFiles = []
      for (const rel of releases) {
        const cached = readFromStorage(`${DATA_PREFIX}/candidates-cache-${rel.version}.json`)
        cacheFiles.push({
          version: rel.version,
          hasCachedData: !!(cached && cached.data),
          cachedAt: cached ? cached.cachedAt : null
        })
      }
      return {
        refreshState,
        configuredReleases: releases.length,
        totalBigRocks: releases.reduce(function(sum, r) { return sum + r.bigRockCount }, 0),
        cacheFiles,
        demoMode: DEMO_MODE
      }
    })
  }
}
