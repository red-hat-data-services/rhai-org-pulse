const { createModelsCorpClient } = require('../services/modelsCorpClient')
const { google } = require('googleapis')
const { createUserTokenStore } = require('../services/userTokenStore')

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerInsightsRoutes(router, context) {
  const { storage, secrets, requireAuth } = context
  const { readFromStorage, writeToStorage } = storage
  const isDemoMode = process.env.DEMO_MODE === 'true'
  const tokenStore = createUserTokenStore(storage)

  /**
   * @openapi
   * /api/modules/customer-insights/insights:
   *   get:
   *     summary: Get latest AI insights
   *     tags: [Customer Insights]
   *     parameters:
   *       - name: component
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by component
   *     responses:
   *       200:
   *         description: Latest AI-generated insights
   */
  router.get('/insights', async (req, res) => {
    try {
      if (isDemoMode) {
        // Return demo fixtures
        const insights = readFromStorage('customer-insights/insights.json')
        if (!insights) {
          return res.status(404).json({ error: 'Insights fixtures not found' })
        }
        return res.json(insights)
      }

      // Check if insights have been generated
      const insights = readFromStorage('customer-insights/insights.json')
      if (!insights) {
        return res.json({
          message: 'No insights generated yet. Click "Generate Insights" to analyze customer interactions.',
          generated: false
        })
      }

      res.json(insights)
    } catch (error) {
      console.error('Error fetching insights:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/customer-insights/insights/history:
   *   get:
   *     summary: Get insights history
   *     tags: [Customer Insights]
   *     parameters:
   *       - name: component
   *         in: query
   *         schema:
   *           type: string
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           default: 10
   *     responses:
   *       200:
   *         description: Historical insights
   */
  router.get('/insights/history', async (req, res) => {
    try {
      if (isDemoMode) {
        // In demo mode, return a simple history array
        const latest = readFromStorage('customer-insights/insights.json')
        if (!latest) {
          return res.json([])
        }

        // Return an array with just the latest entry for demo
        return res.json([{
          id: 'insight-001',
          generatedAt: latest.generatedAt,
          summary: 'AI-generated insights from 10 customer interactions'
        }])
      }

      // For now, just return the latest insights as a single history item
      const latest = readFromStorage('customer-insights/insights.json')
      if (!latest) {
        return res.json([])
      }

      // Return an array with just the latest entry
      res.json([{
        id: 'insight-' + Date.now(),
        generatedAt: latest.generatedAt,
        component: latest.component,
        summary: `AI-generated insights from ${latest.analysisMetadata?.totalInteractions || 0} customer interactions`
      }])
    } catch (error) {
      console.error('Error fetching insights history:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/customer-insights/insights/generate:
   *   post:
   *     summary: Generate AI insights from customer interactions
   *     tags: [Customer Insights]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               component:
   *                 type: string
   *                 description: Filter by component (optional)
   *     responses:
   *       200:
   *         description: Generated insights
   */
  router.post('/insights/generate', requireAuth, async (req, res) => {
    try {
      const { component } = req.body

      // Get interactions from Google Sheets
      let interactions = []

      if (isDemoMode) {
        // Load from fixtures in demo mode
        interactions = readFromStorage('customer-insights/interactions.json') || []
      } else {
        // Fetch from Google Sheets
        const userEmail = req.userEmail
        if (!userEmail) {
          return res.status(401).json({ error: 'User not authenticated' })
        }

        const googleTokens = await tokenStore.getTokens(userEmail)
        if (!googleTokens) {
          return res.status(400).json({ error: 'Google account not connected. Please connect in Settings.' })
        }

        const config = await tokenStore.getSpreadsheetConfig(userEmail)
        if (!config?.spreadsheetId) {
          return res.status(400).json({ error: 'No spreadsheet configured. Please select a spreadsheet in Settings.' })
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
          return res.status(400).json({ error: 'No interactions found in spreadsheet' })
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
          customerCompany: getColIndex(['customercompany', 'customerCompany', 'Customer Company']),
          component: getColIndex(['component', 'Component']),
          industryVertical: getColIndex(['industryvertical', 'industryVertical', 'Industry Vertical']),
          mainAIUseCase: getColIndex(['mainaiusecase', 'mainAIUseCase', 'Main AI Use Case']),
          painPoints: getColIndex(['painpoints', 'painPoints', 'Pain Points']),
          featureFeedback: getColIndex(['featurefeedback', 'featureFeedback', 'Feature Feedback']),
          futureWishlist: getColIndex(['futurewishlist', 'futureWishlist', 'Future Wishlist']),
          status: getColIndex(['status', 'Status']),
        }

        // Parse interactions
        interactions = rows.slice(1).map(row => ({
          customerCompany: (colMap.customerCompany !== -1 ? row[colMap.customerCompany] : null) || '',
          component: (colMap.component !== -1 ? row[colMap.component] : null) || '',
          industryVertical: (colMap.industryVertical !== -1 ? row[colMap.industryVertical] : null) || '',
          mainAIUseCase: (colMap.mainAIUseCase !== -1 ? row[colMap.mainAIUseCase] : null) || '',
          painPoints: (colMap.painPoints !== -1 ? row[colMap.painPoints] : null) || '',
          featureFeedback: (colMap.featureFeedback !== -1 ? row[colMap.featureFeedback] : null) || '',
          futureWishlist: (colMap.futureWishlist !== -1 && row[colMap.futureWishlist]) ? row[colMap.futureWishlist].split(',').map(t => t.trim()).filter(t => t && t !== '[]') : [],
          status: (colMap.status !== -1 ? row[colMap.status] : null) || '',
        }))
      }

      // Filter by component if specified
      const filteredInteractions = component && component !== 'all'
        ? interactions.filter(i => i.component === component)
        : interactions

      if (filteredInteractions.length === 0) {
        return res.status(400).json({ error: 'No customer interactions found to analyze' })
      }

      // Check if AI is configured
      const apiKey = secrets.MODELS_CORP_API_KEY
      const baseUrl = secrets.MODELS_CORP_BASE_URL || 'https://gemini--apicast-production.apps.int.stc.ai.prod.us-east-1.aws.paas.redhat.com:443'

      if (!apiKey) {
        return res.status(503).json({
          error: 'AI insights generation not configured. Set MODELS_CORP_API_KEY in module secrets.'
        })
      }

      // Create summary of interactions for AI
      const interactionsSummary = filteredInteractions.map(i => ({
        customer: i.customerCompany,
        industry: i.industryVertical,
        useCase: i.mainAIUseCase,
        painPoints: i.painPoints,
        feedback: i.featureFeedback,
        wishlist: i.futureWishlist,
        status: i.status
      }))

      const prompt = `You are a product manager analyzing customer feedback data. Based on the following ${filteredInteractions.length} customer interactions, generate strategic insights.

CUSTOMER INTERACTIONS DATA:
${JSON.stringify(interactionsSummary, null, 2)}

Please analyze this data and return ONLY valid JSON (no markdown, no explanation) with the following structure:
{
  "painPoints": ["Top 5 most common pain points mentioned by customers"],
  "requestedFeatures": ["Top 5 most requested features across all interactions"],
  "sentiment": "A 2-3 sentence summary of overall customer sentiment and satisfaction",
  "recommendations": ["5 strategic recommendations for product team based on this data"],
  "competitiveSignals": ["Any competitive intelligence or market signals from the data"],
  "dataGaps": ["Areas where we need more customer information"]
}

Be specific and actionable. Reference actual customer pain points and use cases from the data.

JSON:`

      const client = createModelsCorpClient({ apiKey, baseUrl })
      const result = await client.generateInsights(prompt)

      // Add metadata
      const insights = {
        ...result,
        generatedAt: new Date().toISOString(),
        component: component || 'all',
        analysisMetadata: {
          totalInteractions: filteredInteractions.length,
          uniqueCustomers: new Set(filteredInteractions.map(i => i.customerCompany).filter(c => c)).size,
          industries: [...new Set(filteredInteractions.map(i => i.industryVertical).filter(i => i))],
        }
      }

      // Save insights
      writeToStorage('customer-insights/insights.json', insights)

      res.json(insights)
    } catch (error) {
      console.error('Error generating insights:', error)
      res.status(500).json({ error: error.message || 'Failed to generate insights' })
    }
  })
}
