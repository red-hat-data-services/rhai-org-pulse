/**
 * Health API route handlers.
 *
 * Registers all health-related endpoints under /releases/:version/health/*.
 * Read endpoints use requireAuth; write endpoints use requirePM.
 *
 * Shares the refreshStates Map and MAX_CONCURRENT_REFRESHES limit with the
 * candidates pipeline to prevent concurrent Jira-heavy operations from
 * exceeding rate limits.
 */

const { getConfig } = require('../config')
const { CACHE_MAX_AGE_MS, MANUAL_DOR_IDS, DOR_ITEM_IDS, VALID_PHASES } = require('../constants')
const { runHealthPipeline } = require('./health-pipeline')
const { DOR_ITEMS } = require('./dor-checker')
const { logAudit } = require('../audit-log')
const { jiraRequest, fetchAllJqlResults } = require('../../../../shared/server/jira')

var DATA_PREFIX = 'release-planning'
var VERSION_RE = /^[a-zA-Z0-9._-]{1,50}$/
var FEATURE_KEY_RE = /^[A-Z]+-\d+$/
var VALID_RISK_LEVELS = ['green', 'yellow', 'red']
var MAX_NOTES_LENGTH = 2000
var MAX_REASON_LENGTH = 500

var DEMO_MODE = process.env.DEMO_MODE === 'true'
var PHASE_LABELS = ['EA1', 'EA2', 'GA']

function getStrictPhaseKeys(features, version, phase) {
  if (!features || !version || !phase) return []
  var vUpper = version.toUpperCase()
  var pUpper = phase.toUpperCase()
  var keys = []
  for (var i = 0; i < features.length; i++) {
    var fvStr = features[i].fixVersions || ''
    var parts = fvStr.split(',')
    for (var j = 0; j < parts.length; j++) {
      var fv = parts[j].trim().toUpperCase()
      if (fv.indexOf(vUpper) !== -1 && fv.indexOf(pUpper) !== -1) {
        keys.push(features[i].key)
        break
      }
    }
  }
  return keys
}

function getCommittedPhases(planningFreezes) {
  if (!planningFreezes) return []
  var today = new Date().toISOString().split('T')[0]
  var committed = []
  for (var i = 0; i < PHASE_LABELS.length; i++) {
    var freezeDate = planningFreezes[PHASE_LABELS[i].toLowerCase()]
    if (freezeDate && today >= freezeDate) {
      committed.push(PHASE_LABELS[i])
    }
  }
  return committed
}

/**
 * Register health routes on the module router.
 *
 * @param {object} router - Express router (already mounted at /api/modules/release-planning/)
 * @param {object} context - Module context with storage, auth, refreshStates, etc.
 */
function healthRoutes(router, context) {
  var storage = context.storage
  var readFromStorage = storage.readFromStorage
  var writeToStorage = storage.writeToStorage
  var requireAuth = context.requireAuth
  var requirePM = context.requirePM
  var refreshStates = context.refreshStates
  var MAX_CONCURRENT_REFRESHES = context.MAX_CONCURRENT_REFRESHES
  var sendJsonWithETag = context.sendJsonWithETag

  function isValidVersion(version) {
    return VERSION_RE.test(version) && ['__proto__', 'constructor', 'prototype'].indexOf(version) === -1
  }

  function parsePhase(req) {
    var phase = req.query && req.query.phase
    return phase || null
  }

  function isValidPhase(phase) {
    return !phase || VALID_PHASES.indexOf(phase) !== -1
  }

  function phaseKey(phase) {
    return phase || 'all'
  }

  function getHealthRefreshState(version, phase) {
    return refreshStates.get('health:' + version + ':' + phaseKey(phase)) || { running: false, lastResult: null }
  }

  function loadFixture(name) {
    var fs = require('fs')
    var fixturePath = require('path').join(__dirname, '..', '..', '..', '..', 'fixtures', DATA_PREFIX, name)
    try {
      return JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))
    } catch {
      return null
    }
  }

  // ─── GET /releases/:version/health ───

  router.get('/releases/:version/health', requireAuth, function(req, res) {
    var version = req.params.version
    var phase = parsePhase(req)
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    if (!isValidPhase(phase)) {
      return res.status(400).json({ error: 'Invalid phase. Must be one of: ' + VALID_PHASES.join(', ') })
    }

    if (DEMO_MODE) {
      var demoData = loadFixture('health-cache-demo.json')
      if (demoData) {
        return res.json(Object.assign({}, demoData, { demoMode: true }))
      }
      return res.status(404).json({ error: 'Demo health data not available' })
    }

    var pk = phaseKey(phase)
    var cached = readFromStorage(DATA_PREFIX + '/health-cache-' + version + '-' + pk + '.json')
    var hasCachedData = cached && cached.cachedAt

    if (hasCachedData) {
      var age = Date.now() - new Date(cached.cachedAt).getTime()
      var isStale = age >= CACHE_MAX_AGE_MS

      if (isStale) {
        triggerHealthRefresh(version, phase)
      }

      return sendJsonWithETag(req, res, Object.assign({}, cached, {
        _cacheStale: isStale,
        _refreshing: getHealthRefreshState(version, phase).running
      }))
    }

    // No cache exists -- trigger refresh and return 202
    triggerHealthRefresh(version, phase)
    sendJsonWithETag(req, res, {
      version: version,
      phase: pk,
      _cacheStale: true,
      _refreshing: getHealthRefreshState(version, phase).running,
      _noCache: true,
      milestones: null,
      summary: null,
      features: [],
      enrichmentStatus: null,
      warning: 'Health pipeline is running for the first time. This may take several minutes.'
    }, 202)
  })

  // ─── GET /releases/:version/health/summary ───

  router.get('/releases/:version/health/summary', requireAuth, function(req, res) {
    var version = req.params.version
    var phase = parsePhase(req)
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    if (!isValidPhase(phase)) {
      return res.status(400).json({ error: 'Invalid phase. Must be one of: ' + VALID_PHASES.join(', ') })
    }

    if (DEMO_MODE) {
      var demoData = loadFixture('health-cache-demo.json')
      if (demoData) {
        return res.json({
          version: demoData.version,
          generatedAt: demoData.cachedAt,
          milestones: demoData.milestones,
          summary: demoData.summary,
          _cacheStale: false,
          demoMode: true
        })
      }
      return res.status(404).json({ error: 'Demo health data not available' })
    }

    var pk = phaseKey(phase)
    var cached = readFromStorage(DATA_PREFIX + '/health-cache-' + version + '-' + pk + '.json')
    if (!cached || !cached.cachedAt) {
      return res.status(404).json({ error: 'No health data available for version ' + version + '. Trigger a health refresh first.' })
    }

    var age = Date.now() - new Date(cached.cachedAt).getTime()
    var isStale = age >= CACHE_MAX_AGE_MS

    sendJsonWithETag(req, res, {
      version: cached.version,
      generatedAt: cached.cachedAt,
      milestones: cached.milestones,
      summary: cached.summary,
      _cacheStale: isStale,
      _refreshing: getHealthRefreshState(version, phase).running
    })
  })

  // ─── GET /releases/:version/health/feature/:key ───

  router.get('/releases/:version/health/feature/:key', requireAuth, function(req, res) {
    var version = req.params.version
    var key = req.params.key
    var phase = parsePhase(req)
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    if (!FEATURE_KEY_RE.test(key)) {
      return res.status(400).json({ error: 'Invalid feature key format' })
    }
    if (!isValidPhase(phase)) {
      return res.status(400).json({ error: 'Invalid phase. Must be one of: ' + VALID_PHASES.join(', ') })
    }

    if (DEMO_MODE) {
      var demoData = loadFixture('health-cache-demo.json')
      if (demoData && demoData.features) {
        var demoFeature = null
        for (var di = 0; di < demoData.features.length; di++) {
          if (demoData.features[di].key === key) {
            demoFeature = demoData.features[di]
            break
          }
        }
        if (demoFeature) {
          return res.json(Object.assign({}, demoFeature, { demoMode: true }))
        }
        return res.status(404).json({ error: 'Feature ' + key + ' not found in demo data' })
      }
      return res.status(404).json({ error: 'Demo health data not available' })
    }

    var pk = phaseKey(phase)
    var cached = readFromStorage(DATA_PREFIX + '/health-cache-' + version + '-' + pk + '.json')
    if (!cached || !cached.features) {
      return res.status(404).json({ error: 'No health data available for version ' + version })
    }

    var feature = null
    for (var i = 0; i < cached.features.length; i++) {
      if (cached.features[i].key === key) {
        feature = cached.features[i]
        break
      }
    }

    if (!feature) {
      return res.status(404).json({ error: 'Feature ' + key + ' not found in health data for version ' + version })
    }

    sendJsonWithETag(req, res, feature)
  })

  // ─── PUT /releases/:version/health/dor/:featureKey ───

  router.put('/releases/:version/health/dor/:featureKey', requirePM, function(req, res) {
    var version = req.params.version
    var featureKey = req.params.featureKey
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    if (!FEATURE_KEY_RE.test(featureKey)) {
      return res.status(400).json({ error: 'Invalid feature key format. Expected pattern like PROJ-123.' })
    }

    var items = req.body && req.body.items
    var notes = req.body && req.body.notes

    // Validate items
    if (!items || typeof items !== 'object' || Array.isArray(items)) {
      return res.status(400).json({ error: 'items must be an object mapping DoR item IDs to booleans' })
    }

    var itemKeys = Object.keys(items)
    for (var i = 0; i < itemKeys.length; i++) {
      var itemId = itemKeys[i]

      // Validate item ID exists
      if (DOR_ITEM_IDS.indexOf(itemId) === -1) {
        return res.status(400).json({ error: 'Unknown DoR item ID: ' + itemId })
      }

      // Only manual items can be toggled
      if (MANUAL_DOR_IDS.indexOf(itemId) === -1) {
        return res.status(400).json({ error: 'DoR item ' + itemId + ' is automated and cannot be toggled manually' })
      }

      // Values must be booleans
      if (typeof items[itemId] !== 'boolean') {
        return res.status(400).json({ error: 'DoR item values must be booleans. Got ' + typeof items[itemId] + ' for ' + itemId })
      }
    }

    // Validate notes
    if (notes !== undefined && notes !== null) {
      if (typeof notes !== 'string') {
        return res.status(400).json({ error: 'notes must be a string' })
      }
      if (notes.length > MAX_NOTES_LENGTH) {
        return res.status(400).json({ error: 'notes must be at most ' + MAX_NOTES_LENGTH + ' characters' })
      }
    }

    // Read existing DoR state
    var dorState = readFromStorage(DATA_PREFIX + '/dor-state-' + version + '.json') || {
      version: version,
      updatedAt: null,
      features: {}
    }

    if (!dorState.features) dorState.features = {}
    if (!dorState.features[featureKey]) {
      dorState.features[featureKey] = { manualChecks: {}, notes: '' }
    }
    if (!dorState.features[featureKey].manualChecks) {
      dorState.features[featureKey].manualChecks = {}
    }

    var now = new Date().toISOString()
    var userEmail = req.userEmail || 'unknown'

    // Apply updates
    for (var j = 0; j < itemKeys.length; j++) {
      var id = itemKeys[j]
      dorState.features[featureKey].manualChecks[id] = {
        checked: items[id],
        updatedBy: userEmail,
        updatedAt: now
      }
    }

    if (notes !== undefined && notes !== null) {
      dorState.features[featureKey].notes = notes
    }

    dorState.updatedAt = now

    // Write updated state
    writeToStorage(DATA_PREFIX + '/dor-state-' + version + '.json', dorState)

    // Count manual checks for response
    var manualChecks = dorState.features[featureKey].manualChecks
    var checkedCount = 0
    var totalCount = DOR_ITEMS.length
    // Count automated checks from cache (if available)
    var cached = readFromStorage(DATA_PREFIX + '/health-cache-' + version + '.json')
    var cachedFeature = null
    if (cached && cached.features) {
      for (var ci = 0; ci < cached.features.length; ci++) {
        if (cached.features[ci].key === featureKey) {
          cachedFeature = cached.features[ci]
          break
        }
      }
    }

    if (cachedFeature && cachedFeature.dor && cachedFeature.dor.items) {
      // Use cached automated check results and updated manual checks
      for (var k = 0; k < cachedFeature.dor.items.length; k++) {
        var dorItem = cachedFeature.dor.items[k]
        if (dorItem.type === 'automated') {
          if (dorItem.checked) checkedCount++
        } else {
          // Manual -- use the updated state
          var entry = manualChecks[dorItem.id]
          if (entry && entry.checked) checkedCount++
        }
      }
    } else {
      // No cached data -- just count manual checks
      var allManualIds = MANUAL_DOR_IDS
      for (var m = 0; m < allManualIds.length; m++) {
        var mc = manualChecks[allManualIds[m]]
        if (mc && mc.checked) checkedCount++
      }
    }

    var completionPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0

    // Audit log
    logAudit(readFromStorage, writeToStorage, {
      version: version,
      action: 'update_dor',
      user: userEmail,
      summary: 'Updated DoR checklist for ' + featureKey,
      details: { featureKey: featureKey, items: items }
    })

    res.json({
      featureKey: featureKey,
      dor: { checkedCount: checkedCount, totalCount: totalCount, completionPct: completionPct },
      updatedAt: now,
      updatedBy: userEmail
    })
  })

  // ─── PUT /releases/:version/health/override/:featureKey ───

  router.put('/releases/:version/health/override/:featureKey', requirePM, function(req, res) {
    var version = req.params.version
    var featureKey = req.params.featureKey
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    if (!FEATURE_KEY_RE.test(featureKey)) {
      return res.status(400).json({ error: 'Invalid feature key format. Expected pattern like PROJ-123.' })
    }

    var riskOverride = req.body && req.body.riskOverride
    var reason = req.body && req.body.reason

    // Validate riskOverride
    if (!riskOverride || VALID_RISK_LEVELS.indexOf(riskOverride) === -1) {
      return res.status(400).json({ error: 'riskOverride must be one of: ' + VALID_RISK_LEVELS.join(', ') })
    }

    // Validate reason
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'reason is required' })
    }
    if (reason.length > MAX_REASON_LENGTH) {
      return res.status(400).json({ error: 'reason must be at most ' + MAX_REASON_LENGTH + ' characters' })
    }

    var now = new Date().toISOString()
    var userEmail = req.userEmail || 'unknown'

    // Read existing overrides
    var overrides = readFromStorage(DATA_PREFIX + '/health-overrides-' + version + '.json') || {
      version: version,
      overrides: {}
    }

    if (!overrides.overrides) overrides.overrides = {}

    overrides.overrides[featureKey] = {
      riskOverride: riskOverride,
      reason: reason.trim(),
      updatedBy: userEmail,
      updatedAt: now
    }

    writeToStorage(DATA_PREFIX + '/health-overrides-' + version + '.json', overrides)

    // Audit log
    logAudit(readFromStorage, writeToStorage, {
      version: version,
      action: 'set_risk_override',
      user: userEmail,
      summary: 'Set risk override to ' + riskOverride + ' for ' + featureKey,
      details: { featureKey: featureKey, riskOverride: riskOverride, reason: reason.trim() }
    })

    res.json({
      featureKey: featureKey,
      riskOverride: riskOverride,
      reason: reason.trim(),
      updatedAt: now,
      updatedBy: userEmail
    })
  })

  // ─── DELETE /releases/:version/health/override/:featureKey ───

  router.delete('/releases/:version/health/override/:featureKey', requirePM, function(req, res) {
    var version = req.params.version
    var featureKey = req.params.featureKey
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    if (!FEATURE_KEY_RE.test(featureKey)) {
      return res.status(400).json({ error: 'Invalid feature key format. Expected pattern like PROJ-123.' })
    }

    var userEmail = req.userEmail || 'unknown'

    var overrides = readFromStorage(DATA_PREFIX + '/health-overrides-' + version + '.json') || {
      version: version,
      overrides: {}
    }

    if (!overrides.overrides || !overrides.overrides[featureKey]) {
      return res.status(404).json({ error: 'No risk override found for ' + featureKey })
    }

    delete overrides.overrides[featureKey]
    writeToStorage(DATA_PREFIX + '/health-overrides-' + version + '.json', overrides)

    logAudit(readFromStorage, writeToStorage, {
      version: version,
      action: 'remove_risk_override',
      user: userEmail,
      summary: 'Removed risk override for ' + featureKey,
      details: { featureKey: featureKey }
    })

    res.json({ featureKey: featureKey, removed: true })
  })

  // ─── POST /releases/:version/health/refresh ───

  router.post('/releases/:version/health/refresh', requirePM, function(req, res) {
    var version = req.params.version
    var phase = parsePhase(req)
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    if (!isValidPhase(phase)) {
      return res.status(400).json({ error: 'Invalid phase. Must be one of: ' + VALID_PHASES.join(', ') })
    }
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Health refresh disabled in demo mode' })
    }

    var state = getHealthRefreshState(version, phase)
    if (state.running) {
      return res.json({ status: 'already_running', startedAt: state.startedAt })
    }

    var runningCount = 0
    refreshStates.forEach(function(s) { if (s.running) runningCount++ })
    if (runningCount >= MAX_CONCURRENT_REFRESHES) {
      return res.status(429).json({ error: 'Maximum concurrent refreshes reached. Please try again shortly.' })
    }

    triggerHealthRefresh(version, phase)
    res.json({ status: 'started' })
  })

  // ─── GET /releases/:version/health/refresh/status ───

  router.get('/releases/:version/health/refresh/status', requireAuth, function(req, res) {
    var version = req.params.version
    var phase = parsePhase(req)
    if (!isValidVersion(version)) {
      return res.status(400).json({ error: 'Invalid version format' })
    }
    if (!isValidPhase(phase)) {
      return res.status(400).json({ error: 'Invalid phase. Must be one of: ' + VALID_PHASES.join(', ') })
    }

    res.json(getHealthRefreshState(version, phase))
  })

  // ─── Health refresh helper ───

  function triggerHealthRefresh(version, phase) {
    var pk = phaseKey(phase)
    var stateKey = 'health:' + version + ':' + pk
    var state = getHealthRefreshState(version, phase)
    if (state.running) return

    var runningCount = 0
    refreshStates.forEach(function(s) { if (s.running) runningCount++ })
    if (runningCount >= MAX_CONCURRENT_REFRESHES) return

    var config = getConfig(readFromStorage)
    var healthConfig = config.healthConfig || {}
    var timeoutMs = healthConfig.healthRefreshTimeoutMs || 480000

    // Snapshot old cache for committed-list audit
    var cacheFile = DATA_PREFIX + '/health-cache-' + version + '-' + pk + '.json'
    var oldCache = readFromStorage(cacheFile)

    refreshStates.set(stateKey, {
      running: true,
      version: version,
      phase: pk,
      startedAt: new Date().toISOString(),
      lastResult: state.lastResult
    })

    var pipeline = new Promise(function(resolve) {
      resolve(runHealthPipeline(version, readFromStorage, writeToStorage, jiraRequest, fetchAllJqlResults, phase))
    })
    var timeout = new Promise(function(_, reject) {
      setTimeout(function() { reject(new Error('Health refresh timed out after ' + Math.round(timeoutMs / 1000) + ' seconds')) }, timeoutMs)
    })

    Promise.race([pipeline, timeout])
      .then(function(result) {
        refreshStates.set(stateKey, {
          running: false,
          lastResult: {
            status: 'success',
            version: version,
            phase: pk,
            message: 'Health pipeline completed: ' + (result.features ? result.features.length : 0) + ' features assessed',
            completedAt: new Date().toISOString()
          }
        })

        // Audit committed list changes
        try {
          var newFreezes = result && result.planningFreezes
          var committed = getCommittedPhases(newFreezes)
          var oldFeatures = oldCache && oldCache.features ? oldCache.features : []
          var newFeatures = result && result.features ? result.features : []

          for (var i = 0; i < committed.length; i++) {
            var cp = committed[i]
            var oldKeys = getStrictPhaseKeys(oldFeatures, version, cp)
            var newKeys = getStrictPhaseKeys(newFeatures, version, cp)

            var oldSet = {}
            for (var a = 0; a < oldKeys.length; a++) oldSet[oldKeys[a]] = true
            var newSet = {}
            for (var b = 0; b < newKeys.length; b++) newSet[newKeys[b]] = true

            var added = newKeys.filter(function(k) { return !oldSet[k] })
            var removed = oldKeys.filter(function(k) { return !newSet[k] })

            if (added.length > 0 || removed.length > 0) {
              logAudit(readFromStorage, writeToStorage, {
                version: version,
                action: 'committed_list_change',
                user: 'system',
                summary: 'Committed list changed for ' + cp + ': +' + added.length + ' added, -' + removed.length + ' removed',
                details: { phase: cp, added: added, removed: removed }
              })
            }
          }
        } catch (auditErr) {
          console.error('[health] Failed to audit committed list changes:', auditErr)
        }
      })
      .catch(function(err) {
        console.error('[health] Background health refresh failed for ' + version + ' phase ' + pk + ':', err)
        refreshStates.set(stateKey, {
          running: false,
          lastResult: {
            status: 'error',
            version: version,
            phase: pk,
            message: 'Health pipeline refresh failed. Check server logs for details.',
            completedAt: new Date().toISOString()
          }
        })
      })
  }
}

module.exports = healthRoutes
