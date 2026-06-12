const { google } = require('googleapis')
const { createUserTokenStore } = require('../services/userTokenStore')

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerAnalyticsRoutes(router, context) {
  const { storage, requireAuth, secrets } = context
  const { readFromStorage } = storage
  const isDemoMode = process.env.DEMO_MODE === 'true'
  const tokenStore = createUserTokenStore(storage)

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

      // Get interactions directly (same logic as interactions.js GET endpoint)
      const userEmail = req.userEmail
      if (!userEmail) {
        return res.json({ byGeo: {}, byIndustry: {}, byEnvironment: {}, byStatus: {}, byCustomerType: {}, topTools: {}, topWishlist: {}, topUseCases: {} })
      }

      // Check if user has Google tokens
      const googleTokens = await tokenStore.getTokens(userEmail)
      if (!googleTokens) {
        return res.json({ byGeo: {}, byIndustry: {}, byEnvironment: {}, byStatus: {}, byCustomerType: {}, topTools: {}, topWishlist: {}, topUseCases: {} })
      }

      // Check if user has configured a spreadsheet
      const config = await tokenStore.getSpreadsheetConfig(userEmail)
      if (!config?.spreadsheetId) {
        return res.json({ byGeo: {}, byIndustry: {}, byEnvironment: {}, byStatus: {}, byCustomerType: {}, topTools: {}, topWishlist: {}, topUseCases: {} })
      }

      // Set up Google Sheets client
      const clientId = secrets.GOOGLE_OAUTH_CLIENT_ID
      const clientSecret = secrets.GOOGLE_OAUTH_CLIENT_SECRET
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
      oauth2Client.setCredentials(googleTokens)
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client })
      const spreadsheetId = config.spreadsheetId

      // Read interactions from Google Sheets
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Interactions!A1:Z',
      })

      const rows = response.data.values || []
      if (rows.length === 0) {
        return res.json({ byGeo: {}, byIndustry: {}, byEnvironment: {}, byStatus: {}, byCustomerType: {}, topTools: {}, topWishlist: {}, topUseCases: {} })
      }

      // Parse headers
      const headers = rows[0].map(h => {
        const normalized = String(h).trim()
          .replace(/\s+/g, '')
          .replace(/[^a-zA-Z0-9]/g, '')
          .toLowerCase()
        return { original: h, normalized }
      })

      const getColIndex = (fieldNames) => {
        for (const name of fieldNames) {
          const idx = headers.findIndex(h => h.normalized === name.toLowerCase())
          if (idx !== -1) return idx
        }
        return -1
      }

      const colMap = {
        component: getColIndex(['component', 'Component']),
        geo: getColIndex(['geo', 'Geo', 'Geography']),
        industryVertical: getColIndex(['industryvertical', 'industryVertical', 'Industry Vertical']),
        environment: getColIndex(['environment', 'Environment']),
        customerType: getColIndex(['customertype', 'customerType', 'Customer Type']),
        status: getColIndex(['status', 'Status']),
        toolsOfChoice: getColIndex(['toolsofchoice', 'toolsOfChoice', 'Tools of Choice']),
        futureWishlist: getColIndex(['futurewishlist', 'futureWishlist', 'Future Wishlist']),
        mainAIUseCase: getColIndex(['mainaiusecase', 'mainAIUseCase', 'Main AI Use Case']),
      }

      // Parse interactions
      const interactions = rows.slice(1).map(row => ({
        component: (colMap.component !== -1 ? row[colMap.component] : null) || '',
        geo: (colMap.geo !== -1 ? row[colMap.geo] : null) || '',
        industryVertical: (colMap.industryVertical !== -1 ? row[colMap.industryVertical] : null) || '',
        environment: (colMap.environment !== -1 ? row[colMap.environment] : null) || '',
        customerType: (colMap.customerType !== -1 ? row[colMap.customerType] : null) || '',
        status: (colMap.status !== -1 ? row[colMap.status] : null) || '',
        toolsOfChoice: (colMap.toolsOfChoice !== -1 && row[colMap.toolsOfChoice]) ? row[colMap.toolsOfChoice].split(',').map(t => t.trim()).filter(t => t && t !== '[]') : [],
        futureWishlist: (colMap.futureWishlist !== -1 && row[colMap.futureWishlist]) ? row[colMap.futureWishlist].split(',').map(t => t.trim()).filter(t => t && t !== '[]') : [],
        mainAIUseCase: (colMap.mainAIUseCase !== -1 ? row[colMap.mainAIUseCase] : null) || '',
      }))

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
