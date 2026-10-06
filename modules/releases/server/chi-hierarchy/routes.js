'use strict'

const STORAGE_KEY = 'releases/chi-hierarchy/latest.json'
const LAST_UPLOAD_KEY = 'releases/chi-hierarchy/last-upload.json'

function validatePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'payload must be an object'
  }
  if (!body.environments || typeof body.environments !== 'object') {
    return 'missing environments object'
  }
  var envs = body.environments
  var hasEnv = false
  for (var key of ['prod', 'stage', 'latest']) {
    if (envs[key] == null) continue
    hasEnv = true
    var env = envs[key]
    if (typeof env !== 'object' || Array.isArray(env)) {
      return 'environments.' + key + ' must be an object'
    }
    if (env.versions != null && !Array.isArray(env.versions)) {
      return 'environments.' + key + '.versions must be an array'
    }
  }
  if (!hasEnv) return 'environments must include prod, stage, and/or latest'
  return null
}

/**
 * Register CHI hierarchy routes on a dedicated router.
 * Mounted at /api/modules/releases/chi-hierarchy/
 */
function registerChiHierarchyRoutes(router, context) {
  var storage = context.storage
  var requireAuth = context.requireAuth
  var requireScope = context.requireScope
  var readFromStorage = storage.readFromStorage
  var writeToStorage = storage.writeToStorage
  var DEMO_MODE = process.env.DEMO_MODE === 'true'

  /**
   * @openapi
   * /api/modules/releases/chi-hierarchy/status:
   *   get:
   *     summary: Get CHI hierarchy upload status
   *     tags: [Releases - CHI Hierarchy]
   *     responses:
   *       200:
   *         description: Status of stored CHI hierarchy data
   */
  router.get('/status', requireAuth, requireScope('releases:read'), async function (req, res) {
    var data = await readFromStorage(STORAGE_KEY)
    var lastUpload = await readFromStorage(LAST_UPLOAD_KEY)
    if (!data) {
      return res.json({ status: 'no_data', lastUpload: lastUpload || null })
    }
    var envs = data.environments || {}
    res.json({
      status: 'ok',
      fetchedAt: data.fetchedAt || null,
      activeStreams: data.activeStreams || [],
      environments: {
        prod: envs.prod
          ? {
              fetchedAt: envs.prod.fetchedAt || null,
              source: envs.prod.source || null,
              versionCount: Array.isArray(envs.prod.versions) ? envs.prod.versions.length : 0
            }
          : null,
        stage: envs.stage
          ? {
              fetchedAt: envs.stage.fetchedAt || null,
              source: envs.stage.source || null,
              versionCount: Array.isArray(envs.stage.versions) ? envs.stage.versions.length : 0
            }
          : null,
        latest: envs.latest
          ? {
              fetchedAt: envs.latest.fetchedAt || null,
              source: envs.latest.source || null,
              versionCount: Array.isArray(envs.latest.versions) ? envs.latest.versions.length : 0
            }
          : null
      },
      lastUpload: lastUpload || null
    })
  })

  /**
   * @openapi
   * /api/modules/releases/chi-hierarchy/data:
   *   get:
   *     summary: Get CHI hierarchy snapshot
   *     tags: [Releases - CHI Hierarchy]
   *     responses:
   *       200:
   *         description: Multi-env Product → Components → Images CHI snapshot
   *       404:
   *         description: No CHI hierarchy data available
   */
  router.get('/data', requireAuth, requireScope('releases:read'), async function (req, res) {
    var data = await readFromStorage(STORAGE_KEY)
    if (!data) {
      return res.status(404).json({
        error: 'No CHI hierarchy data available. Run the collection pipeline and POST /bulk.'
      })
    }
    res.json(data)
  })

  /**
   * @openapi
   * /api/modules/releases/chi-hierarchy/bulk:
   *   post:
   *     summary: Bulk ingest CHI hierarchy snapshot
   *     description: |
   *       Pipeline ingest for pre-computed Prod/Stage/Latest CHI hierarchy JSON.
   *       Requires `releases:write`. Skipped in DEMO_MODE.
   *     tags: [Releases - CHI Hierarchy]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Upload result
   *       400:
   *         description: Invalid payload
   */
  router.post('/bulk', requireAuth, requireScope('releases:write'), async function (req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'CHI hierarchy ingest disabled in demo mode' })
    }

    var body = req.body || {}
    var err = validatePayload(body)
    if (err) return res.status(400).json({ error: err })

    var fetchedAt = body.fetchedAt || new Date().toISOString()
    var payload = Object.assign({}, body, { fetchedAt: fetchedAt })

    try {
      await writeToStorage(STORAGE_KEY, payload)
      await writeToStorage(LAST_UPLOAD_KEY, {
        uploadedAt: new Date().toISOString(),
        uploadedBy: (req.user && req.user.email) || 'pipeline',
        fetchedAt: fetchedAt,
        activeStreams: payload.activeStreams || [],
        environments: Object.keys(payload.environments || {})
      })
      return res.json({
        status: 'ok',
        fetchedAt: fetchedAt,
        environments: Object.keys(payload.environments || {})
      })
    } catch (error) {
      console.error('[releases/chi-hierarchy] Error writing bulk data:', error.message)
      return res.status(500).json({ error: 'Failed to store CHI hierarchy data' })
    }
  })
}

module.exports = {
  registerChiHierarchyRoutes: registerChiHierarchyRoutes,
  validatePayload: validatePayload,
  STORAGE_KEY: STORAGE_KEY,
  LAST_UPLOAD_KEY: LAST_UPLOAD_KEY
}
