/**
 * Read-only Jira Plan routes for the Releases > Plan module.
 */

var path = require('path')
var fs = require('fs')
var { fetchRankedOutcomes, fetchOutcomeChildren } = require('./jira-plan')

var DEMO_MODE = process.env.DEMO_MODE === 'true'
var CACHE_TTL_MS = 5 * 60 * 1000

function loadFixture() {
  var fixturePath = path.join(__dirname, '..', '..', '..', '..', 'fixtures', 'releases', 'planning', 'jira-plan.json')
  try {
    return JSON.parse(fs.readFileSync(fixturePath, 'utf-8'))
  } catch {
    return null
  }
}

module.exports = function registerJiraPlanRoutes(router, context) {
  var { requireAuth, requireScope, jira } = context
  var baseCache = null
  var childrenCache = new Map()

  /**
   * @openapi
   * /api/modules/releases/planning/jira-plan:
   *   get:
   *     summary: Read-only ranked Outcomes from the RHAI Jira Plan
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     description: >
   *       Returns open RHAISTRAT Outcomes in Jira Rank order, stopping before
   *       RHAISTRAT-2921. This endpoint only reads Jira; no Plan or issue data
   *       is written back.
   *     parameters:
   *       - in: query
   *         name: refresh
   *         schema: { type: string }
   *         description: Set to "1" or "true" to bypass the five-minute response cache
   *     responses:
   *       200:
   *         description: Ranked Outcomes above the sentinel
   *       503:
   *         description: Jira is not configured
   */
  router.get('/jira-plan', requireAuth, requireScope('releases:read'), async function(req, res) {
    if (DEMO_MODE) {
      var fixture = loadFixture()
      if (!fixture) return res.status(404).json({ error: 'Demo Jira Plan data not available' })
      return res.json({
        plan: fixture.plan,
        sentinelKey: fixture.sentinelKey,
        generatedAt: fixture.generatedAt,
        outcomes: fixture.outcomes || [],
        demoMode: true
      })
    }

    var refresh = req.query && (req.query.refresh === '1' || req.query.refresh === 'true')
    if (!refresh && baseCache && (Date.now() - baseCache.cachedAt) < CACHE_TTL_MS) {
      return res.json(baseCache.data)
    }

    try {
      var data = await fetchRankedOutcomes(jira)
      baseCache = { cachedAt: Date.now(), data: data }
      res.json(data)
    } catch (err) {
      console.error('[releases/planning] Jira Plan fetch failed:', err.message)
      var status = /not configured/i.test(err.message) ? 503 : 502
      res.status(status).json({ error: err.message })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/planning/jira-plan/outcomes/{key}/children:
   *   get:
   *     summary: Read-only child work items for a ranked Jira Plan Outcome
   *     tags: [releases-planning]
   *     security: [{ bearerAuth: [] }]
   *     parameters:
   *       - in: path
   *         name: key
   *         required: true
   *         schema: { type: string }
   *     responses:
   *       200:
   *         description: Direct child work items for the Outcome
   *       400:
   *         description: Invalid Outcome key
   *       503:
   *         description: Jira is not configured
   */
  router.get('/jira-plan/outcomes/:key/children', requireAuth, requireScope('releases:read'), async function(req, res) {
    var key = req.params.key

    if (DEMO_MODE) {
      var fixture = loadFixture()
      if (!fixture) return res.status(404).json({ error: 'Demo Jira Plan data not available' })
      return res.json({
        outcomeKey: key,
        generatedAt: fixture.generatedAt,
        children: fixture.childrenByOutcome && fixture.childrenByOutcome[key] || [],
        demoMode: true
      })
    }

    var cached = childrenCache.get(key)
    if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) {
      return res.json(cached.data)
    }

    try {
      var data = await fetchOutcomeChildren(jira, key)
      childrenCache.set(key, { cachedAt: Date.now(), data: data })
      res.json(data)
    } catch (err) {
      console.error('[releases/planning] Jira Plan child fetch failed:', err.message)
      var status = /invalid outcome key/i.test(err.message) ? 400
        : /not configured/i.test(err.message) ? 503
          : 502
      res.status(status).json({ error: err.message })
    }
  })
}
