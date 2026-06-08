/**
 * Planning sub-router for the unified releases module.
 *
 * Migrated from modules/release-planning/server/index.js.
 * Mounted at /api/modules/releases/planning/ by the parent router.
 *
 * Changes from original:
 * - requirePM replaced with requireReleaseManager (from context)
 * - PM user management routes removed (replaced by central role system)
 * - permissions endpoint uses req.isAdmin || req.isReleaseManager
 * - loadFixture path adjusted for new directory depth
 * - require() paths reference local files (same directory)
 * - Storage paths migrated to releases/planning/ (Phase 5)
 */

const crypto = require('crypto')
const { getConfig, loadBigRocks, getConfiguredReleases, saveBigRock, deleteBigRock, reorderBigRocks, createRelease, cloneRelease, deleteRelease, migrateConfig, releaseFilePath } = require('./config')
const { runPipeline, buildCandidateResponse } = require('./pipeline')
const { loadIndex, validateKeysFromCache } = require('./cache-reader')
const { CACHE_MAX_AGE_MS } = require('./constants')
const { withConfigLock } = require('./config-lock')
const { backupConfig } = require('./config-backup')
const { validateBigRock } = require('./validation')
const { getOutcomeSummaries } = require('./outcome-fetch')
const { previewDocImport, executeDocImport } = require('./doc-import')
const { logAudit, getAuditLog } = require('./audit-log')
const healthRoutes = require('./health/health-routes')
var { buildFeatureReadiness } = require('./feature-readiness')

const DEMO_MODE = process.env.DEMO_MODE === 'true'
const DATA_PREFIX = 'releases/planning'
const VERSION_RE = /^[a-zA-Z0-9._-]{1,50}$/
const RESERVED_VERSIONS = ['__proto__', 'constructor', 'prototype']

function isValidVersion(version) {
  return VERSION_RE.test(version) && !RESERVED_VERSIONS.includes(version)
}

/**
 * Register planning routes on the provided Express router.
 *
 * @param {object} router - Express router mounted at /api/modules/releases/planning/
 * @param {object} context - { storage, requireAuth, requireAdmin, requireReleaseManager, requireScope, roleStore, registerDiagnostics }
 */
module.exports = function registerPlanningRoutes(router, context) {
  var smartsheetClient = context.smartsheet || require('../../../../shared/server/smartsheet')
  var jiraClient = context.jira || null

  const { storage, requireAuth, requireAdmin, requireReleaseManager, requireScope } = context
  const { readFromStorage, writeToStorage } = storage
  const listStorageFiles = storage.listStorageFiles || null
  const deleteFromStorage = storage.deleteFromStorage || null

  migrateConfig(readFromStorage, writeToStorage)

  // ─── PM User Auto-Migration ───
  // Migrate pm-users.json entries to the central release-manager role.
  // This runs once on module startup; after migration the file is deleted.
  if (context.roleStore) {
    try {
      var pmData = readFromStorage('releases/planning/pm-users.json')
      if (pmData && pmData.emails && pmData.emails.length > 0) {
        var migrated = 0
        for (var mi = 0; mi < pmData.emails.length; mi++) {
          var email = pmData.emails[mi]
          if (!context.roleStore.hasRole(email, 'release-manager')) {
            context.roleStore.assignRole(email, 'release-manager')
            migrated++
          }
        }
        console.log('[releases/planning] Migrated ' + migrated + ' PM user(s) to release-manager role')
        if (deleteFromStorage) {
          deleteFromStorage('releases/planning/pm-users.json')
          console.log('[releases/planning] Deleted pm-users.json after migration')
        }
      }
    } catch (err) {
      console.error('[releases/planning] PM user migration failed:', err.message)
    }
  }

  const refreshStates = new Map()
  const MAX_CONCURRENT_REFRESHES = 2
  const REFRESH_TIMEOUT_MS = 5 * 60 * 1000

  function getRefreshState(version) {
    return refreshStates.get(version) || { running: false, lastResult: null }
  }

  function sendJsonWithETag(req, res, data, statusCode) {
    const body = JSON.stringify(data)
    const etag = '"' + crypto.createHash('md5').update(body).digest('hex') + '"'
    res.set('ETag', etag)
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end()
    }
    res.status(statusCode || 200).set('Content-Type', 'application/json').send(body)
  }

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
    const fixturePath = require('path').join(__dirname, '..', '..', '..', '..', 'fixtures', DATA_PREFIX, name)
    try {
      return JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))
    } catch {
      return null
    }
  }

  function triggerBackgroundRefresh(version) {
    const state = getRefreshState(version)
    if (state.running) return

    let runningCount = 0
    refreshStates.forEach(function(s) { if (s.running) runningCount++ })
    if (runningCount >= MAX_CONCURRENT_REFRESHES) return

    refreshStates.set(version, {
      running: true,
      version: version,
      startedAt: new Date().toISOString(),
      lastResult: state.lastResult
    })

    const config = getConfig(readFromStorage)
    const bigRocks = loadBigRocks(readFromStorage, version)

    if (!bigRocks.length) {
      refreshStates.set(version, {
        running: false,
        lastResult: {
          status: 'error',
          version: version,
          message: 'No Big Rocks configured for release ' + version,
          completedAt: new Date().toISOString()
        }
      })
      return
    }

    console.log('[releases/planning] Background refresh started for ' + version)
    var refreshStartTime = Date.now()

    function doRefresh(attempt) {
      const pipeline = new Promise(function(resolve) { resolve(runPipeline(config, bigRocks, version, readFromStorage)) })
      const timeout = new Promise(function(_, reject) {
        setTimeout(function() { reject(new Error('Refresh timed out after 5 minutes')) }, REFRESH_TIMEOUT_MS)
      })

      Promise.race([pipeline, timeout])
        .then(function(result) {
          // Jira fallback: fetch missing outcome summaries asynchronously
          var fallback
          if (result.missingOutcomes && result.missingOutcomes.length > 0) {
            fallback = getOutcomeSummaries(jiraClient ? jiraClient.jiraRequest : null, result.missingOutcomes, version, readFromStorage, writeToStorage)
              .then(function(fetched) {
                // Merge fetched summaries into the pipeline result
                for (var key in fetched) {
                  result.outcomeSummaries[key] = fetched[key]
                }
              })
              .catch(function(err) {
                console.warn('[releases/planning] Jira outcome summary fallback failed: ' + err.message)
              })
          } else {
            fallback = Promise.resolve()
          }

          return fallback.then(function() {
            const response = buildCandidateResponse(result, version, bigRocks, false)
            writeToStorage(DATA_PREFIX + '/candidates-cache-' + version + '.json', {
              cachedAt: new Date().toISOString(),
              data: response
            })
            var elapsed = ((Date.now() - refreshStartTime) / 1000).toFixed(1)
            console.log('[releases/planning] Background refresh completed for ' + version + ': ' + result.features.length + ' features, ' + result.rfes.length + ' RFEs in ' + elapsed + 's')
            refreshStates.set(version, {
              running: false,
              lastResult: {
                status: 'success',
                version: version,
                message: 'Pipeline completed: ' + result.features.length + ' features, ' + result.rfes.length + ' RFEs',
                completedAt: new Date().toISOString()
              }
            })
          })
        })
        .catch(function(err) {
          if (attempt < 3) {
            console.warn('[releases/planning] Refresh attempt ' + attempt + ' failed for ' + version + ', retrying: ' + err.message)
            setTimeout(function() { doRefresh(attempt + 1) }, attempt * 5000)
            return
          }
          console.error('[releases/planning] Background refresh failed for ' + version + ':', err)

          // Remove _invalidatedAt marker so cache reverts to normal
          // stale-while-revalidate behavior (15-min cycle)
          var staleCache = readFromStorage(DATA_PREFIX + '/candidates-cache-' + version + '.json')
          if (staleCache && staleCache._invalidatedAt) {
            delete staleCache._invalidatedAt
            writeToStorage(DATA_PREFIX + '/candidates-cache-' + version + '.json', staleCache)
          }

          refreshStates.set(version, {
            running: false,
            lastResult: {
              status: 'error',
              version: version,
              message: 'Pipeline refresh failed. Check server logs for details.',
              completedAt: new Date().toISOString()
            }
          })
        })
    }

    doRefresh(1)
  }

  // Mount health routes -- pass requireReleaseManager as requirePM
  healthRoutes(router, {
    storage: storage,
    requireAuth: requireAuth,
    requirePM: requireReleaseManager,
    requireScope: requireScope,
    refreshStates: refreshStates,
    MAX_CONCURRENT_REFRESHES: MAX_CONCURRENT_REFRESHES,
    sendJsonWithETag: sendJsonWithETag,
    smartsheet: smartsheetClient,
    jira: jiraClient
  })

  /**
   * @openapi
   * /api/modules/releases/planning/releases:
   *   get:
   *     summary: List configured planning releases
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Array of releases with version and bigRockCount
   */
  router.get('/releases', requireAuth, requireScope('releases:read'), function(req, res) {
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

  /**
   * @openapi
   * /api/modules/releases/planning/releases/{version}/candidates:
   *   get:
   *     summary: Get pipeline candidates for a release version
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: version
   *         in: path
   *         required: true
   *         schema: { type: string }
   *       - name: rockFilter
   *         in: query
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Candidate features, RFEs, and Big Rocks
   */
  router.get('/releases/:version/candidates', requireAuth, requireScope('releases:read'), function(req, res) {
    const version = req.params.version
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    const rockFilter = req.query.rockFilter || null

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
      const isInvalidated = !!cached._invalidatedAt

      if (isStale || isInvalidated) {
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

      return sendJsonWithETag(req, res, {
        ...data,
        _cacheStale: isStale || isInvalidated,
        _refreshing: getRefreshState(version).running
      })
    }

    triggerBackgroundRefresh(version)
    sendJsonWithETag(req, res, {
      _cacheStale: true,
      _refreshing: getRefreshState(version).running,
      _noCache: true,
      features: [],
      rfes: [],
      bigRocks: [],
      summary: null,
      warning: 'Pipeline is running for the first time. This may take a few minutes.'
    }, 202)
  })

  /**
   * @openapi
   * /api/modules/releases/planning/releases/{version}/refresh:
   *   post:
   *     summary: Trigger background refresh for a release version
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: version
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Refresh started or already running
   */
  router.post('/releases/:version/refresh', requireReleaseManager, requireScope('releases:write'), function(req, res) {
    const version = req.params.version
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Refresh disabled in demo mode' })
    }
    const state = getRefreshState(version)
    if (state.running) {
      return res.json({ status: 'already_running' })
    }
    let runningCount = 0
    refreshStates.forEach(function(s) { if (s.running) runningCount++ })
    if (runningCount >= MAX_CONCURRENT_REFRESHES) {
      return res.status(429).json({ error: 'Maximum concurrent refreshes reached. Please try again shortly.' })
    }
    triggerBackgroundRefresh(version)
    res.json({ status: 'started' })
  })

  /**
   * @openapi
   * /api/modules/releases/planning/refresh/status:
   *   get:
   *     summary: Get refresh status
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: version
   *         in: query
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Refresh state
   */
  router.get('/refresh/status', requireAuth, requireScope('releases:read'), function(req, res) {
    const version = req.query && req.query.version
    if (version) {
      return res.json(getRefreshState(version))
    }
    let running = false
    let lastResult = null
    let activeVersion = null
    refreshStates.forEach(function(state, ver) {
      if (state.running) {
        running = true
        activeVersion = ver
      }
      if (state.lastResult && (!lastResult || state.lastResult.completedAt > lastResult.completedAt)) {
        lastResult = state.lastResult
      }
    })
    res.json({ running: running, version: activeVersion, lastResult: lastResult })
  })

  /**
   * @openapi
   * /api/modules/releases/planning/config:
   *   get:
   *     summary: Get planning configuration (admin)
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Planning config
   */
  router.get('/config', requireAdmin, requireScope('releases:write'), function(req, res) {
    const config = getConfig(readFromStorage)
    res.json(config)
  })

  /**
   * @openapi
   * /api/modules/releases/planning/feature-readiness:
   *   get:
   *     summary: Prioritized feature readiness lists split by human review status
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     description: Loads data from all configured releases and merges into a single prioritized list.
   *     responses:
   *       200:
   *         description: Feature readiness data with pendingReview and approved arrays
   *       500:
   *         description: Internal error building readiness data
   */
  router.get('/feature-readiness', requireAuth, requireScope('releases:read'), function(req, res) {
    try {
      var result = buildFeatureReadiness(readFromStorage)
      res.json(result)
    } catch (err) {
      console.error('[releases/planning] Feature readiness build failed:', err.message)
      res.status(500).json({ error: 'Failed to build feature readiness data' })
    }
  })

  // ─── Cache Invalidation Helper ───

  function invalidateCache(version) {
    if (deleteFromStorage) {
      var healthPhases = ['all', 'EA1', 'EA2', 'GA']
      for (var hp = 0; hp < healthPhases.length; hp++) {
        deleteFromStorage(`${DATA_PREFIX}/health-cache-${version}-${healthPhases[hp]}.json`)
      }
      deleteFromStorage(`${DATA_PREFIX}/outcome-summaries-cache-${version}.json`)
    }

    var cached = readFromStorage(`${DATA_PREFIX}/candidates-cache-${version}.json`)
    if (cached) {
      cached._invalidatedAt = new Date().toISOString()
      writeToStorage(`${DATA_PREFIX}/candidates-cache-${version}.json`, cached)
    }

    triggerBackgroundRefresh(version)
  }

  /**
   * @openapi
   * /api/modules/releases/planning/permissions:
   *   get:
   *     summary: Get current user's planning permissions
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Permission flags
   */
  router.get('/permissions', requireAuth, requireScope('releases:read'), function(req, res) {
    res.json({
      canEdit: !!req.isAdmin || !!req.isReleaseManager
    })
  })

  /**
   * @openapi
   * /api/modules/releases/planning/releases/{version}/big-rocks/reorder:
   *   put:
   *     summary: Reorder Big Rocks for a release
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: version
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               order:
   *                 type: array
   *                 items: { type: string }
   *     responses:
   *       200:
   *         description: Reordered Big Rocks
   */
  router.put('/releases/:version/big-rocks/reorder', requireReleaseManager, requireScope('releases:write'), async function(req, res) {
    const version = req.params.version
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    const order = req.body && req.body.order
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'order must be an array of Big Rock names' })
    }

    try {
      const result = await withConfigLock(function() {
        return reorderBigRocks(readFromStorage, writeToStorage, version, order)
      })
      logAudit(readFromStorage, writeToStorage, {
        version: version,
        action: 'reorder_rocks',
        user: req.userEmail,
        summary: 'Reordered Big Rocks'
      })
      invalidateCache(version)
      res.json(result)
    } catch (err) {
      const status = err.statusCode || 500
      res.status(status).json({ error: err.message })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/planning/releases/{version}/big-rocks/{name}:
   *   put:
   *     summary: Update a Big Rock
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: version
   *         in: path
   *         required: true
   *         schema: { type: string }
   *       - name: name
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Updated Big Rock
   */
  router.put('/releases/:version/big-rocks/:name', requireReleaseManager, requireScope('releases:write'), async function(req, res) {
    const version = req.params.version
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    let name
    try {
      name = decodeURIComponent(req.params.name)
    } catch {
      return res.status(400).json({ error: 'Invalid parameter encoding' })
    }

    try {
      const result = await withConfigLock(function() {
        const currentConfig = getConfig(readFromStorage)
        if (!currentConfig.releases[version]) {
          throw Object.assign(new Error('Release ' + version + ' not found'), { statusCode: 404 })
        }
        const existingRocks = loadBigRocks(readFromStorage, version)
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

      logAudit(readFromStorage, writeToStorage, {
        version: version,
        action: 'update_rock',
        user: req.userEmail,
        summary: 'Updated Big Rock "' + name + '"',
        details: { rockName: name }
      })
      invalidateCache(version)
      res.json(result)
    } catch (err) {
      const status = err.statusCode || 500
      const response = { error: err.message }
      if (err.fields) response.fields = err.fields
      res.status(status).json(response)
    }
  })

  /**
   * @openapi
   * /api/modules/releases/planning/releases/{version}/big-rocks:
   *   post:
   *     summary: Create a new Big Rock
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: version
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       201:
   *         description: Created Big Rock
   */
  router.post('/releases/:version/big-rocks', requireReleaseManager, requireScope('releases:write'), async function(req, res) {
    const version = req.params.version
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }

    try {
      const result = await withConfigLock(function() {
        const currentConfig = getConfig(readFromStorage)
        if (!currentConfig.releases[version]) {
          throw Object.assign(new Error('Release ' + version + ' not found'), { statusCode: 404 })
        }
        const existingRocks = loadBigRocks(readFromStorage, version)
        const existingNames = existingRocks.map(function(r) { return r.name })

        const validation = validateBigRock(req.body, {
          existingNames: existingNames
        })
        if (!validation.valid) {
          throw Object.assign(new Error('Validation failed'), { statusCode: 400, fields: validation.errors })
        }

        return saveBigRock(readFromStorage, writeToStorage, version, null, req.body)
      })

      const newName = req.body && req.body.name
      logAudit(readFromStorage, writeToStorage, {
        version: version,
        action: 'create_rock',
        user: req.userEmail,
        summary: 'Created Big Rock "' + newName + '"',
        details: { rockName: newName }
      })
      invalidateCache(version)
      res.status(201).json(result)
    } catch (err) {
      const status = err.statusCode || 500
      const response = { error: err.message }
      if (err.fields) response.fields = err.fields
      res.status(status).json(response)
    }
  })

  /**
   * @openapi
   * /api/modules/releases/planning/releases/{version}/big-rocks/{name}:
   *   delete:
   *     summary: Delete a Big Rock
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: version
   *         in: path
   *         required: true
   *         schema: { type: string }
   *       - name: name
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Deleted Big Rock
   */
  router.delete('/releases/:version/big-rocks/:name', requireReleaseManager, requireScope('releases:write'), async function(req, res) {
    const version = req.params.version
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    let name
    try {
      name = decodeURIComponent(req.params.name)
    } catch {
      return res.status(400).json({ error: 'Invalid parameter encoding' })
    }

    try {
      const result = await withConfigLock(function() {
        const currentConfig = getConfig(readFromStorage)
        if (!currentConfig.releases[version]) {
          throw Object.assign(new Error('Release ' + version + ' not found'), { statusCode: 404 })
        }
        const existingRocks = loadBigRocks(readFromStorage, version)
        const found = existingRocks.find(function(r) { return r.name === name })
        if (!found) {
          throw Object.assign(new Error("Big Rock '" + name + "' not found for release " + version), { statusCode: 404 })
        }

        backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)

        return deleteBigRock(readFromStorage, writeToStorage, version, name)
      })

      logAudit(readFromStorage, writeToStorage, {
        version: version,
        action: 'delete_rock',
        user: req.userEmail,
        summary: 'Deleted Big Rock "' + name + '"',
        details: { rockName: name }
      })
      invalidateCache(version)
      res.json(result)
    } catch (err) {
      const status = err.statusCode || 500
      res.status(status).json({ error: err.message })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/planning/releases:
   *   post:
   *     summary: Create a new release (optionally clone from existing)
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               version: { type: string }
   *               cloneFrom: { type: string }
   *     responses:
   *       201:
   *         description: Created release
   */
  router.post('/releases', requireReleaseManager, requireScope('releases:write'), async function(req, res) {
    const version = req.body && req.body.version
    const cloneFrom = req.body && req.body.cloneFrom

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
      const result = await withConfigLock(function() {
        if (cloneFrom) {
          backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)
          return cloneRelease(readFromStorage, writeToStorage, version, cloneFrom)
        }
        return createRelease(readFromStorage, writeToStorage, version)
      })
      logAudit(readFromStorage, writeToStorage, {
        version: version,
        action: cloneFrom ? 'clone_release' : 'create_release',
        user: req.userEmail,
        summary: cloneFrom
          ? 'Cloned release ' + version + ' from ' + cloneFrom
          : 'Created release ' + version
      })
      res.status(201).json(result)
    } catch (err) {
      const status = err.statusCode || 500
      res.status(status).json({ error: err.message })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/planning/releases/{version}:
   *   delete:
   *     summary: Delete a release (admin only)
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: version
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Deleted release
   */
  router.delete('/releases/:version', requireAdmin, requireScope('releases:write'), async function(req, res) {
    const version = req.params.version
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }

    try {
      const result = await withConfigLock(function() {
        backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)
        return deleteRelease(readFromStorage, writeToStorage, version)
      })

      logAudit(readFromStorage, writeToStorage, {
        version: version,
        action: 'delete_release',
        user: req.userEmail,
        summary: 'Deleted release ' + version
      })

      if (deleteFromStorage) {
        deleteFromStorage(releaseFilePath(version))
        deleteFromStorage(DATA_PREFIX + '/candidates-cache-' + version + '.json')
        var delPhases = ['all', 'EA1', 'EA2', 'GA']
        for (var dp = 0; dp < delPhases.length; dp++) {
          deleteFromStorage(DATA_PREFIX + '/health-cache-' + version + '-' + delPhases[dp] + '.json')
        }
        deleteFromStorage(DATA_PREFIX + '/dor-state-' + version + '.json')
        deleteFromStorage(DATA_PREFIX + '/health-overrides-' + version + '.json')
      }

      res.json(result)
    } catch (err) {
      const status = err.statusCode || 500
      res.status(status).json({ error: err.message })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/planning/jira/validate-keys:
   *   post:
   *     summary: Validate Jira issue keys against cache
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               keys:
   *                 type: array
   *                 items: { type: string }
   *     responses:
   *       200:
   *         description: Validation results
   */
  router.post('/jira/validate-keys', requireReleaseManager, requireScope('releases:write'), function(req, res) {
    const keys = req.body && req.body.keys
    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ error: 'keys must be a non-empty array' })
    }
    if (keys.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 keys per request' })
    }

    const results = {}
    const keysToValidate = []

    for (let i = 0; i < keys.length; i++) {
      if (typeof keys[i] !== 'string' || !/^[A-Z]+-\d+$/.test(keys[i])) {
        results[keys[i]] = { valid: false, error: 'Invalid key format' }
      } else {
        keysToValidate.push(keys[i])
      }
    }

    if (keysToValidate.length > 0) {
      const index = loadIndex(readFromStorage)
      const cacheResults = validateKeysFromCache(index, keysToValidate)
      Object.assign(results, cacheResults)
    }

    res.json({ results: results })
  })

  /**
   * @openapi
   * /api/modules/releases/planning/releases/{version}/import/doc/preview:
   *   post:
   *     summary: Preview Google Doc import
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: version
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Preview result
   */
  router.post('/releases/:version/import/doc/preview', requireReleaseManager, requireScope('releases:write'), async function(req, res) {
    const version = req.params.version
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    const docId = req.body && req.body.docId
    if (!docId) {
      return res.status(400).json({ error: 'docId is required' })
    }

    try {
      const result = await previewDocImport(docId)

      const existingRocks = loadBigRocks(readFromStorage, version)
      const existingNames = new Set(existingRocks.map(function(r) { return r.name }))

      for (let i = 0; i < result.bigRocks.length; i++) {
        const rock = result.bigRocks[i]
        if (existingNames.has(rock.name)) {
          rock.status = 'duplicate'
        } else {
          const validation = validateBigRock(rock, {
            existingNames: Array.from(existingNames)
          })
          rock.status = validation.valid ? 'new' : 'validation_error'
          if (!validation.valid) rock.validationErrors = validation.errors
        }
      }

      res.json(result)
    } catch (err) {
      const status = err.statusCode || 500
      res.status(status).json({ error: err.message, shareWith: err.shareWith })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/planning/releases/{version}/import/doc:
   *   post:
   *     summary: Execute Google Doc import
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: version
   *         in: path
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Import result
   */
  router.post('/releases/:version/import/doc', requireReleaseManager, requireScope('releases:write'), async function(req, res) {
    const version = req.params.version
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    const docId = req.body && req.body.docId
    const mode = req.body && req.body.mode
    if (!docId) {
      return res.status(400).json({ error: 'docId is required' })
    }
    if (mode !== 'replace' && mode !== 'append') {
      return res.status(400).json({ error: 'mode must be "replace" or "append"' })
    }

    try {
      const parsedDoc = await previewDocImport(docId)

      const result = await withConfigLock(function() {
        if (mode === 'replace') {
          backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)
        }
        return executeDocImport(readFromStorage, writeToStorage, version, docId, mode, parsedDoc)
      })

      logAudit(readFromStorage, writeToStorage, {
        version: version,
        action: 'import_doc',
        user: req.userEmail,
        summary: 'Imported Big Rocks from Google Doc (' + mode + ' mode)',
        details: { docId: docId, mode: mode }
      })
      invalidateCache(version)
      res.json(result)
    } catch (err) {
      const status = err.statusCode || 500
      res.status(status).json({ error: err.message })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/planning/smartsheet/releases:
   *   get:
   *     summary: Discover releases from SmartSheet
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Available and configured releases
   */
  router.get('/smartsheet/releases', requireAuth, requireScope('releases:read'), async function(req, res) {
    try {
      if (!smartsheetClient.isConfigured()) {
        return res.status(503).json({
          error: 'SmartSheet integration is not available. SMARTSHEET_API_TOKEN is not configured.'
        })
      }

      const releases = await smartsheetClient.discoverReleases()
      const configuredVersions = getConfiguredReleases(readFromStorage).map(function(r) { return r.version })
      const configuredSet = new Set(configuredVersions)

      const available = releases.map(function(rel) {
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
      const status = err.statusCode || 500
      res.status(status).json({ error: err.message })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/planning/admin/seed:
   *   post:
   *     summary: Seed release data (admin)
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Seed result
   */
  router.post('/admin/seed', requireAdmin, requireScope('releases:write'), async function(req, res) {
    const config = req.body
    if (!config || typeof config !== 'object' || !config.releases) {
      return res.status(400).json({ error: 'Request body must include a "releases" object' })
    }

    const versions = Object.keys(config.releases)
    for (let i = 0; i < versions.length; i++) {
      if (!VERSION_RE.test(versions[i]) || RESERVED_VERSIONS.includes(versions[i])) {
        return res.status(400).json({ error: 'Invalid version: ' + versions[i] })
      }
    }

    for (let vi = 0; vi < versions.length; vi++) {
      const ver = versions[vi]
      const rocks = config.releases[ver].bigRocks
      if (!rocks) continue
      if (!Array.isArray(rocks)) {
        return res.status(400).json({ error: 'bigRocks must be an array for release ' + ver })
      }
      const namesInRelease = []
      for (let ri = 0; ri < rocks.length; ri++) {
        const validation = validateBigRock(rocks[ri], { existingNames: namesInRelease })
        if (!validation.valid) {
          return res.status(400).json({
            error: 'Invalid Big Rock at index ' + ri + ' in release ' + ver,
            fields: validation.errors
          })
        }
        namesInRelease.push(rocks[ri].name)
      }
    }

    try {
      const result = await withConfigLock(function() {
        backupConfig(readFromStorage, writeToStorage, listStorageFiles, deleteFromStorage)

        const existing = getConfig(readFromStorage)

        const mergedReleases = { ...existing.releases }
        for (let vi = 0; vi < versions.length; vi++) {
          const ver = versions[vi]
          const rocks = config.releases[ver].bigRocks || []
          mergedReleases[ver] = { release: ver }
          writeToStorage(releaseFilePath(ver), { release: ver, bigRocks: rocks })
        }

        const merged = {
          ...existing,
          releases: mergedReleases,
          fieldMapping: { ...existing.fieldMapping, ...(config.fieldMapping || {}) },
          customFieldIds: { ...existing.customFieldIds, ...(config.customFieldIds || {}) }
        }

        writeToStorage('releases/planning/config.json', merged)

        const seededVersions = versions.map(function(v) {
          return { version: v, bigRockCount: (config.releases[v].bigRocks || []).length }
        })

        return { seeded: seededVersions, totalReleases: Object.keys(merged.releases).length }
      })

      logAudit(readFromStorage, writeToStorage, {
        action: 'seed',
        user: req.userEmail,
        summary: 'Seeded release data for ' + versions.join(', ')
      })
      res.json(result)
    } catch (err) {
      const status = err.statusCode || 500
      res.status(status).json({ error: err.message })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/planning/admin/seed/fixture:
   *   get:
   *     summary: Get fixture data for seeding (admin)
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     responses:
   *       200:
   *         description: Fixture config
   */
  router.get('/admin/seed/fixture', requireAdmin, requireScope('releases:write'), function(req, res) {
    const fixture = loadFixture('config.json')
    if (!fixture) {
      return res.status(404).json({ error: 'No fixture data found' })
    }
    res.json(fixture)
  })

  /**
   * @openapi
   * /api/modules/releases/planning/audit-log:
   *   get:
   *     summary: Get planning audit log
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - name: version
   *         in: query
   *         schema: { type: string }
   *       - name: action
   *         in: query
   *         schema: { type: string }
   *       - name: limit
   *         in: query
   *         schema: { type: integer }
   *       - name: offset
   *         in: query
   *         schema: { type: integer }
   *     responses:
   *       200:
   *         description: Audit log entries
   */
  router.get('/audit-log', requireAuth, requireScope('releases:read'), function(req, res) {
    const version = req.query.version || null
    const action = req.query.action || null
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 500)
    const offset = Math.max(parseInt(req.query.offset) || 0, 0)

    const result = getAuditLog(readFromStorage, {
      version: version,
      action: action,
      limit: limit,
      offset: offset
    })

    res.json(result)
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
      const refreshSummary = {}
      refreshStates.forEach(function(state, ver) {
        refreshSummary[ver] = { running: state.running, lastResult: state.lastResult }
      })
      return {
        refreshStates: refreshSummary,
        configuredReleases: releases.length,
        totalBigRocks: releases.reduce(function(sum, r) { return sum + r.bigRockCount }, 0),
        cacheFiles,
        demoMode: DEMO_MODE
      }
    })
  }
}
