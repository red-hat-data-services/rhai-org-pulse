const { createStorage } = require('../services/googleSheetsStorage')

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerAnalyticsRoutes(router, context) {
  const { storage, requireAuth } = context
  const { readFromStorage } = storage
   
  const isDemoMode = process.env.DEMO_MODE === 'true'

  // Lazy initialization of service account storage
  let sheetsStorage = null
  function getStorage() {
    if (isDemoMode) return null
    if (!sheetsStorage) {
      sheetsStorage = createStorage(context)
    }
    return sheetsStorage
  }

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
  router.get('/analytics', requireAuth, async (req, res) => {
    try {
      if (isDemoMode) {
        // Return demo fixtures
        const analytics = readFromStorage('customer-insights/analytics.json')
        if (!analytics) {
          return res.status(404).json({ error: 'Analytics fixtures not found' })
        }
        return res.json(analytics)
      }

      // Get interactions using service account storage
      const store = getStorage()
      const interactions = await store.getAll()

      // Filter by component if specified
      const filteredInteractions = req.query.component && req.query.component !== 'all'
        ? interactions.filter(i => i.component === req.query.component)
        : interactions

      // Compute analytics
      const analytics = {
        byGeo: {},
        byIndustry: {},
        byEnvironment: {},
        byStatus: {},
        byCustomerType: {},
        topTools: {},
        topWishlist: {},
        topUseCases: {}
      }

      filteredInteractions.forEach(item => {
        if (item.geo && item.geo.trim()) {
          analytics.byGeo[item.geo] = (analytics.byGeo[item.geo] || 0) + 1
        }
        if (item.industryVertical && item.industryVertical.trim()) {
          analytics.byIndustry[item.industryVertical] = (analytics.byIndustry[item.industryVertical] || 0) + 1
        }
        if (item.environment && item.environment.trim()) {
          analytics.byEnvironment[item.environment] = (analytics.byEnvironment[item.environment] || 0) + 1
        }
        if (item.status && item.status.trim()) {
          analytics.byStatus[item.status] = (analytics.byStatus[item.status] || 0) + 1
        }
        if (item.customerType && item.customerType.trim()) {
          analytics.byCustomerType[item.customerType] = (analytics.byCustomerType[item.customerType] || 0) + 1
        }
        if (Array.isArray(item.toolsOfChoice)) {
          item.toolsOfChoice.forEach(tool => {
            if (tool && tool.trim()) {
              analytics.topTools[tool] = (analytics.topTools[tool] || 0) + 1
            }
          })
        }
        if (Array.isArray(item.futureWishlist)) {
          item.futureWishlist.forEach(wish => {
            if (wish && wish.trim()) {
              analytics.topWishlist[wish] = (analytics.topWishlist[wish] || 0) + 1
            }
          })
        }
        if (item.mainAIUseCase && item.mainAIUseCase.trim()) {
          analytics.topUseCases[item.mainAIUseCase] = (analytics.topUseCases[item.mainAIUseCase] || 0) + 1
        }
      })

      res.json(analytics)
    } catch (error) {
      console.error('Error fetching analytics:', error)
      res.status(500).json({ error: error.message })
    }
  })
}
