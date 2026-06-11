/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoadmapRoutes(router, context) {
  const { storage } = context
  const { readFromStorage } = storage
  const isDemoMode = process.env.DEMO_MODE === 'true'

  /**
   * @openapi
   * /api/modules/customer-insights/roadmap:
   *   get:
   *     summary: Get product roadmap
   *     tags: [Customer Insights]
   *     parameters:
   *       - name: component
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by component
   *     responses:
   *       200:
   *         description: Product roadmap with customer-driven initiatives
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 summary:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: integer
   *                     inProgress:
   *                       type: integer
   *                     completed:
   *                       type: integer
   *                     customersImpacted:
   *                       type: integer
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                 topRequests:
   *                   type: array
   */
  router.get('/roadmap', async (req, res) => {
    try {
      const { component } = req.query

      if (isDemoMode) {
        // Return demo fixtures
        let roadmap = readFromStorage('customer-insights/roadmap.json')
        if (!roadmap) {
          return res.status(404).json({ error: 'Roadmap fixtures not found' })
        }

        // Filter by component if specified
        if (component && component !== 'all') {
          roadmap = {
            ...roadmap,
            items: roadmap.items.filter(item =>
              item.components && item.components.includes(component)
            ),
          }

          // Recalculate summary
          roadmap.summary = calculateSummary(roadmap.items)
        }

        return res.json(roadmap)
      }

      // TODO: In production, this will read from Google Sheets "Roadmap" tab
      // which is maintained by PMs and synced with Jira
      res.status(501).json({
        error: 'Roadmap data not yet implemented. Will be available when connected to Google Sheets.'
      })
    } catch (error) {
      console.error('Error fetching roadmap:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * Calculate summary statistics for roadmap items
   */
  function calculateSummary(items) {
    const summary = {
      total: items.length,
      inProgress: 0,
      completed: 0,
      customersImpacted: 0,
    }

    const uniqueCustomers = new Set()

    items.forEach(item => {
      if (item.status === 'In Progress' || item.status === 'In Review') {
        summary.inProgress++
      }
      if (item.status === 'Completed') {
        summary.completed++
      }
      if (item.customerDemand?.keyAccounts) {
        item.customerDemand.keyAccounts.forEach(account => uniqueCustomers.add(account))
      }
    })

    summary.customersImpacted = uniqueCustomers.size

    return summary
  }
}
