/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerAnalyticsRoutes(router, context) {
  const { storage } = context
  const { readFromStorage } = storage
  const isDemoMode = process.env.DEMO_MODE === 'true'

  /**
   * @openapi
   * /api/modules/customer-insights/analytics:
   *   get:
   *     summary: Get dashboard analytics
   *     tags: [Customer Insights]
   *     parameters:
   *       - name: component
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by component
   *     responses:
   *       200:
   *         description: Analytics data for dashboard charts
   */
  router.get('/analytics', async (req, res) => {
    try {
      if (isDemoMode) {
        // Return demo fixtures
        const analytics = readFromStorage('customer-insights/analytics.json')
        if (!analytics) {
          return res.status(404).json({ error: 'Analytics fixtures not found' })
        }
        return res.json(analytics)
      }

      // TODO: In Phase 6, this will read from Google Sheets "Analytics" tab
      // which is populated by GitLab CI pipeline
      res.status(501).json({
        error: 'Analytics computation not yet implemented. Will be available in Phase 6 (GitLab CI pipeline).'
      })
    } catch (error) {
      console.error('Error fetching analytics:', error)
      res.status(500).json({ error: error.message })
    }
  })
}
