const { createPoHubService } = require('./data')

const DEMO_MODE = process.env.DEMO_MODE === 'true'
const demoBacklog = require('../../../../fixtures/releases/po-hub/backlog.json')

module.exports = function registerPoHubRoutes(router, context) {
  const { requireAuth, requireScope, jira } = context
  const service = createPoHubService(jira)
  const canRead = requireScope('releases:read')

  async function serve(req, res, force) {
    if (DEMO_MODE) return res.json(demoBacklog)
    try {
      const data = await service.fetchBacklogData({ force })
      res.json(data)
    } catch (error) {
      console.error('[releases/po-hub] backlog fetch failed:', error.message)
      res.status(502).json({ error: 'PO Hub could not load Jira data. Please retry.' })
    }
  }

  /**
   * @openapi
   * /api/modules/releases/po-hub/backlog:
   *   get:
   *     summary: Get the AIPCC Ecosystems release backlog
   *     tags: [Releases - PO Hub]
   *     responses:
   *       200:
   *         description: Release lanes, strategy and epic queries, and ready-to-close packages
   */
  router.get('/backlog', requireAuth, canRead, (req, res) => serve(req, res, false))

  /**
   * @openapi
   * /api/modules/releases/po-hub/backlog/refresh:
   *   post:
   *     summary: Refresh the AIPCC Ecosystems release backlog from Jira
   *     tags: [Releases - PO Hub]
   *     responses:
   *       200:
   *         description: Refreshed release backlog
   */
  router.post('/backlog/refresh', requireAuth, canRead, (req, res) => serve(req, res, true))
}
