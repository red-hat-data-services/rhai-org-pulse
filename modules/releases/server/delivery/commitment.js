'use strict'

/**
 * Commitment Tracking — changelog-based approach.
 *
 * Replaces the snapshot-based commitment tracking with Jira fixVersion
 * changelog analysis. Uses a config-driven fixVersion mapping per
 * release/phase and registry planning freeze dates to dynamically
 * compute committed/delivered/added/removed features.
 */

const sharedJira = require('../../../../shared/server/jira')
const { readRegistry } = require('../registry')
const { getConfig } = require('./config')
const DEFAULT_COMMITMENT_CONFIG = require('../../../../fixtures/releases/delivery/commitment-config.json')

const COMMITMENT_CONFIG_FILE = 'releases/delivery/commitment-config.json'
const COMMITMENT_CACHE_PREFIX = 'releases/delivery/commitment-cache-'
const VALID_PHASES = ['EA1', 'EA2', 'GA']
const DELIVERED_STATUSES = ['Release Pending', 'Closed', 'Done']

// ─── Config helpers ────────────────────────────────────────────────────────────

async function loadCommitmentConfig(readFromStorage) {
  var data = await readFromStorage(COMMITMENT_CONFIG_FILE)
  if (data && Array.isArray(data.releases)) return data
  // Keep the release selector usable on installations whose PVC predates this
  // config file. A persisted config still takes precedence over the bundled
  // defaults, so administrators can continue to customize the mappings.
  return DEFAULT_COMMITMENT_CONFIG
}

function findPhaseConfig(commitmentConfig, version, phase) {
  for (var i = 0; i < commitmentConfig.releases.length; i++) {
    var rel = commitmentConfig.releases[i]
    if (rel.version === version && rel.phases && rel.phases[phase]) {
      return rel.phases[phase]
    }
  }
  return null
}

function getConfiguredVersions(commitmentConfig) {
  var versions = []
  for (var i = 0; i < commitmentConfig.releases.length; i++) {
    var rel = commitmentConfig.releases[i]
    if (rel.version && rel.phases) {
      var phases = Object.keys(rel.phases).filter(function(p) {
        return VALID_PHASES.indexOf(p) !== -1
      })
      if (phases.length > 0) {
        versions.push({ version: rel.version, phases: phases })
      }
    }
  }
  return versions.sort(function(a, b) {
    var ap = a.version.split('.').map(Number)
    var bp = b.version.split('.').map(Number)
    return ap[0] !== bp[0] ? ap[0] - bp[0] : (ap[1] || 0) - (bp[1] || 0)
  })
}

function validateCommitmentConfig(config) {
  if (!config || typeof config !== 'object') return 'Config must be an object'
  if (!Array.isArray(config.releases)) return 'releases must be an array'
  for (var i = 0; i < config.releases.length; i++) {
    var rel = config.releases[i]
    if (!rel.version || typeof rel.version !== 'string') {
      return 'Release at index ' + i + ' must have a version string'
    }
    if (!/^\d+\.\d+$/.test(rel.version)) {
      return 'Release "' + rel.version + '" must be in X.Y format'
    }
    if (!rel.phases || typeof rel.phases !== 'object') {
      return 'Release "' + rel.version + '" must have a phases object'
    }
    var phaseKeys = Object.keys(rel.phases)
    for (var j = 0; j < phaseKeys.length; j++) {
      var pk = phaseKeys[j]
      if (VALID_PHASES.indexOf(pk) === -1) {
        return 'Release "' + rel.version + '" has invalid phase "' + pk + '". Must be one of: ' + VALID_PHASES.join(', ')
      }
      var phaseConf = rel.phases[pk]
      if (!phaseConf || !Array.isArray(phaseConf.fixVersions) || phaseConf.fixVersions.length === 0) {
        return 'Phase ' + pk + ' of release "' + rel.version + '" must have a non-empty fixVersions array'
      }
      for (var k = 0; k < phaseConf.fixVersions.length; k++) {
        if (typeof phaseConf.fixVersions[k] !== 'string' || !phaseConf.fixVersions[k].trim()) {
          return 'fixVersions entries must be non-empty strings (release "' + rel.version + '", phase ' + pk + ')'
        }
      }
      if (phaseConf.planningFreezeOverride && !/^\d{4}-\d{2}-\d{2}$/.test(phaseConf.planningFreezeOverride)) {
        return 'planningFreezeOverride must be YYYY-MM-DD format (release "' + rel.version + '", phase ' + pk + ')'
      }
    }
  }
  return null
}

// ─── Registry planning freeze lookup ───────────────────────────────────────────

function resolvePlanningFreezeDate(registry, version, phase, phaseConfig) {
  if (phaseConfig && phaseConfig.planningFreezeOverride) {
    return phaseConfig.planningFreezeOverride
  }

  var releases = registry.releases || []
  var vLower = version.toLowerCase()
  var pLower = phase.toLowerCase()

  var candidates = []
  for (var i = 0; i < releases.length; i++) {
    var r = releases[i]
    var id = (r.id || '').toLowerCase()
    var hasVersion = id.indexOf(vLower) !== -1

    var isPhaseMatch = pLower === 'ga'
      ? id.indexOf('ea') === -1
      : id.indexOf(pLower) !== -1

    if (hasVersion && isPhaseMatch && r.milestones && r.milestones.planningFreeze) {
      candidates.push(r.milestones.planningFreeze)
    }
  }

  if (candidates.length === 0) return null
  candidates.sort()
  return candidates[0]
}

// ─── Changelog analysis ────────────────────────────────────────────────────────

/**
 * Determine if a feature had one of the target fixVersions at the planning
 * freeze date by walking its changelog.
 *
 * Returns an object: { hadAtFreeze: boolean, addedAfterFreeze: boolean, removedAfterFreeze: boolean }
 */
function analyzeFixVersionHistory(issue, targetFixVersions, freezeDateMs) {
  var targetSet = {}
  for (var t = 0; t < targetFixVersions.length; t++) {
    targetSet[targetFixVersions[t].toLowerCase()] = true
  }

  var currentFixVersions = (issue.fields && issue.fields.fixVersions) || []
  var hasNow = false
  for (var c = 0; c < currentFixVersions.length; c++) {
    var name = (currentFixVersions[c].name || '').toLowerCase()
    if (targetSet[name]) {
      hasNow = true
      break
    }
  }

  var createdMs = new Date(issue.fields && issue.fields.created).getTime()
  var histories = (issue.changelog && issue.changelog.histories) || []

  var versionEvents = []
  for (var h = 0; h < histories.length; h++) {
    var entry = histories[h]
    var entryDate = new Date(entry.created).getTime()
    var items = entry.items || []
    for (var it = 0; it < items.length; it++) {
      var item = items[it]
      if (item.field !== 'Fix Version' && item.field !== 'Fix Version/s') continue

      var toString = (item.toString || '').toLowerCase()
      var fromString = (item.fromString || '').toLowerCase()

      if (targetSet[toString]) {
        versionEvents.push({ type: 'add', date: entryDate })
      }
      if (targetSet[fromString]) {
        versionEvents.push({ type: 'remove', date: entryDate })
      }
    }
  }

  versionEvents.sort(function(a, b) { return a.date - b.date })

  if (versionEvents.length === 0) {
    if (hasNow) {
      return {
        hadAtFreeze: createdMs <= freezeDateMs,
        addedAfterFreeze: createdMs > freezeDateMs,
        removedAfterFreeze: false
      }
    }
    return { hadAtFreeze: false, addedAfterFreeze: false, removedAfterFreeze: false }
  }

  var presentAtFreeze = false
  if (createdMs <= freezeDateMs) {
    var hadInitially = versionEvents.length > 0 && versionEvents[0].type === 'remove'

    var present = hadInitially
    for (var e = 0; e < versionEvents.length; e++) {
      if (versionEvents[e].date > freezeDateMs) break
      if (versionEvents[e].type === 'add') present = true
      else if (versionEvents[e].type === 'remove') present = false
    }
    presentAtFreeze = present
  }

  var addedAfter = false
  var removedAfter = false
  for (var a = 0; a < versionEvents.length; a++) {
    if (versionEvents[a].date <= freezeDateMs) continue
    if (versionEvents[a].type === 'add') addedAfter = true
    if (versionEvents[a].type === 'remove') removedAfter = true
  }

  if (!presentAtFreeze && hasNow && !addedAfter) {
    addedAfter = true
  }

  return {
    hadAtFreeze: presentAtFreeze,
    addedAfterFreeze: addedAfter,
    removedAfterFreeze: removedAfter && !hasNow
  }
}

/**
 * Build a feature object from a Jira issue for the response.
 */
function buildFeatureFromIssue(issue) {
  var fields = issue.fields || {}
  var components = (fields.components || []).map(function(c) { return c.name }).filter(Boolean)
  var deliveryOwner = (fields.customfield_18834 && fields.customfield_18834.displayName) || null
  var fixVersions = (fields.fixVersions || []).map(function(v) { return v.name }).filter(Boolean)

  return {
    key: issue.key,
    summary: fields.summary || '',
    status: (fields.status && fields.status.name) || 'Unknown',
    components: components,
    deliveryOwner: deliveryOwner,
    fixVersions: fixVersions
  }
}

/**
 * Run the full commitment analysis for a version/phase.
 */
async function computeCommitment(jiraRequestFn, fetchAllFn, fixVersions, freezeDate, projectKeys, jiraAllProjects) {
  var freezeDateMs = new Date(freezeDate + 'T23:59:59.999Z').getTime()

  var quotedVersions = fixVersions.map(function(v) { return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"' })
  var inClause = quotedVersions.join(', ')

  var projectsFilter = ''
  if (!jiraAllProjects && projectKeys && projectKeys.length > 0) {
    projectsFilter = 'project in (' + projectKeys.map(function(k) { return '"' + k + '"' }).join(', ') + ') AND '
  }

  var currentJql = projectsFilter + 'issuetype = Feature AND fixVersion in (' + inClause + ') ORDER BY key ASC'

  var wasConditions = fixVersions.map(function(v) {
    return 'fixVersion was "' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
  })
  var removedJql = projectsFilter + 'issuetype = Feature AND (' + wasConditions.join(' OR ') + ') AND fixVersion not in (' + inClause + ') ORDER BY key ASC'

  var fields = 'summary,status,components,fixVersions,created,customfield_18834'

  var currentIssues = []
  try {
    currentIssues = await fetchAllFn(jiraRequestFn, currentJql, fields, { expand: 'changelog' })
  } catch (err) {
    console.error('[commitment] Failed to fetch current features:', err.message)
  }

  var removedIssues = []
  try {
    removedIssues = await fetchAllFn(jiraRequestFn, removedJql, fields, { expand: 'changelog' })
  } catch (err) {
    console.warn('[commitment] Failed to fetch removed features (fixVersion WAS query may not be supported):', err.message)
  }

  var committed = []
  var delivered = []
  var added = []
  var removed = []
  var seenKeys = {}

  for (var i = 0; i < currentIssues.length; i++) {
    var issue = currentIssues[i]
    if (seenKeys[issue.key]) continue
    seenKeys[issue.key] = true

    var analysis = analyzeFixVersionHistory(issue, fixVersions, freezeDateMs)
    var feature = buildFeatureFromIssue(issue)

    if (analysis.hadAtFreeze) {
      committed.push(feature)
      if (DELIVERED_STATUSES.indexOf(feature.status) !== -1) {
        delivered.push(feature)
      }
    } else {
      added.push(feature)
      if (DELIVERED_STATUSES.indexOf(feature.status) !== -1) {
        delivered.push(feature)
      }
    }
  }

  for (var r = 0; r < removedIssues.length; r++) {
    var rIssue = removedIssues[r]
    if (seenKeys[rIssue.key]) continue
    seenKeys[rIssue.key] = true

    var rAnalysis = analyzeFixVersionHistory(rIssue, fixVersions, freezeDateMs)
    if (rAnalysis.hadAtFreeze) {
      var rFeature = buildFeatureFromIssue(rIssue)
      rFeature.status = 'Removed'
      rFeature.fixVersions = []
      removed.push(rFeature)
      committed.push(rFeature)
    }
  }

  var committedCount = committed.length
  var deliveredCount = delivered.length
  var percentDelivered = committedCount > 0 ? Math.round((deliveredCount / committedCount) * 100) : 0

  var notDelivered = committed.filter(function(f) {
    return DELIVERED_STATUSES.indexOf(f.status) === -1 && f.status !== 'Removed'
  })

  return {
    metrics: {
      committed: committedCount,
      delivered: deliveredCount,
      percentDelivered: percentDelivered,
      added: added.length,
      removed: removed.length,
      notDelivered: notDelivered.length
    },
    features: {
      committed: committed,
      delivered: delivered,
      added: added,
      removed: removed,
      notDelivered: notDelivered
    }
  }
}

// ─── Route registration ────────────────────────────────────────────────────────

module.exports = async function registerCommitmentRoutes(router, context) {
  console.log('[commitment] Registering changelog-based commitment tracking routes')

  var storage = context.storage
  var requireAuth = context.requireAuth
  var requireAdmin = context.requireAdmin
  var requireScope = context.requireScope
  var readFromStorage = storage.readFromStorage
  var writeToStorage = storage.writeToStorage

  var jiraRequestFn = sharedJira.jiraRequest
  var fetchAllFn = sharedJira.fetchAllJqlResults
  if (context.jira) {
    jiraRequestFn = context.jira.jiraRequest
    fetchAllFn = function(req, jql, fields, opts) {
      return context.jira.fetchAllJqlResults(jql, fields, opts)
    }
  }

  // ─── GET /commitment/config ─────────────────────────────────────────────────

  /**
   * @openapi
   * /api/modules/releases/delivery/commitment/config:
   *   get:
   *     summary: Get commitment tracking configuration
   *     tags: [Releases - Commitment]
   *     responses:
   *       200:
   *         description: Commitment tracking config with fix version mappings
   */
  router.get('/commitment/config', requireAuth, requireScope('releases:read'), async function(req, res) {
    try {
      var config = await loadCommitmentConfig(readFromStorage)
      res.json(config)
    } catch (error) {
      console.error('[commitment] Config read error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // ─── POST /commitment/config ────────────────────────────────────────────────

  /**
   * @openapi
   * /api/modules/releases/delivery/commitment/config:
   *   post:
   *     summary: Save commitment tracking configuration
   *     tags: [Releases - Commitment]
   *     responses:
   *       200:
   *         description: Config saved
   *       400:
   *         description: Validation error
   */
  router.post('/commitment/config', requireAdmin, requireScope('releases:write'), async function(req, res) {
    try {
      var validationError = validateCommitmentConfig(req.body)
      if (validationError) {
        return res.status(400).json({ error: validationError })
      }
      await writeToStorage(COMMITMENT_CONFIG_FILE, req.body)
      res.json({ status: 'saved' })
    } catch (error) {
      console.error('[commitment] Config save error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // ─── GET /commitment/versions ───────────────────────────────────────────────

  /**
   * @openapi
   * /api/modules/releases/delivery/commitment/versions:
   *   get:
   *     summary: Get available versions for commitment tracking
   *     description: Returns versions from commitment tracking config
   *     tags: [Releases - Commitment]
   *     responses:
   *       200:
   *         description: List of configured versions
   */
  router.get('/commitment/versions', requireAuth, requireScope('releases:read'), async function(req, res) {
    try {
      var config = await loadCommitmentConfig(readFromStorage)
      var versions = getConfiguredVersions(config)
      res.json({ versions: versions })
    } catch (error) {
      console.error('[commitment] Versions read error:', error)
      res.status(500).json({ error: error.message })
    }
  })

  // ─── GET /commitment/:version/:phase ────────────────────────────────────────

  /**
   * @openapi
   * /api/modules/releases/delivery/commitment/{version}/{phase}:
   *   get:
   *     tags: [Releases - Commitment]
   *     summary: Get commitment tracking data for a release phase
   *     description: Uses Jira fixVersion changelog to compute committed vs delivered features at planning freeze
   *     parameters:
   *       - in: path
   *         name: version
   *         required: true
   *         schema: { type: string }
   *         description: Release version (e.g., "3.4")
   *       - in: path
   *         name: phase
   *         required: true
   *         schema: { type: string, enum: [EA1, EA2, GA] }
   *         description: Release phase
   *     responses:
   *       200:
   *         description: Commitment tracking metrics and feature lists
   *       400:
   *         description: Invalid phase or version
   *       404:
   *         description: No config or planning freeze date found
   */
  router.get('/commitment/:version/:phase', requireAuth, requireScope('releases:read'), async function(req, res) {
    try {
      var version = req.params.version
      var phase = req.params.phase
      var forceRefresh = req.query.refresh === 'true'

      if (VALID_PHASES.indexOf(phase) === -1) {
        return res.status(400).json({ error: 'Invalid phase. Must be one of: ' + VALID_PHASES.join(', ') })
      }
      if (!/^\d+\.\d+$/.test(version)) {
        return res.status(400).json({ error: 'Invalid version format. Expected X.Y (e.g., "3.4")' })
      }

      var commitmentConfig = await loadCommitmentConfig(readFromStorage)
      var phaseConfig = findPhaseConfig(commitmentConfig, version, phase)

      if (!phaseConfig) {
        return res.status(404).json({
          error: 'No commitment tracking config found for ' + version + ' ' + phase + '. Configure fix version mappings in Commitment Config.'
        })
      }

      var registry = await readRegistry(readFromStorage)
      var freezeDate = resolvePlanningFreezeDate(registry, version, phase, phaseConfig)

      if (!freezeDate) {
        return res.status(404).json({
          error: 'No planning freeze date found for ' + version + ' ' + phase + '. Add planningFreeze to the release registry or set planningFreezeOverride in commitment config.'
        })
      }

      var cacheKey = COMMITMENT_CACHE_PREFIX + version + '-' + phase + '.json'
      var freezePassed = new Date(freezeDate + 'T23:59:59.999Z').getTime() < Date.now()

      if (freezePassed && !forceRefresh) {
        var cached = await readFromStorage(cacheKey)
        if (cached && cached.metrics) {
          console.log('[commitment] Serving cached data for ' + version + ' ' + phase)
          return res.json(cached)
        }
      }

      var deliveryConfig = await getConfig(readFromStorage)

      var result = await computeCommitment(
        jiraRequestFn,
        fetchAllFn,
        phaseConfig.fixVersions,
        freezeDate,
        deliveryConfig.projectKeys,
        deliveryConfig.jiraAllProjects
      )

      var response = {
        version: version,
        phase: phase,
        planningFreezeDate: freezeDate,
        fixVersions: phaseConfig.fixVersions,
        cachedAt: new Date().toISOString(),
        metrics: result.metrics,
        features: result.features
      }

      if (freezePassed) {
        await writeToStorage(cacheKey, response)
        console.log('[commitment] Cached results for ' + version + ' ' + phase)
      }

      res.json(response)
    } catch (error) {
      console.error('[commitment] Tracking error:', error)
      res.status(500).json({ error: error.message })
    }
  })
}

// Exported for testing
module.exports.analyzeFixVersionHistory = analyzeFixVersionHistory
module.exports.validateCommitmentConfig = validateCommitmentConfig
module.exports.resolvePlanningFreezeDate = resolvePlanningFreezeDate
module.exports.getConfiguredVersions = getConfiguredVersions
module.exports.findPhaseConfig = findPhaseConfig
module.exports.buildFeatureFromIssue = buildFeatureFromIssue
module.exports.loadCommitmentConfig = loadCommitmentConfig
