const { createModelsCorpClient } = require('../services/modelsCorpClient')

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerInsightsRoutes(router, context) {
  const { storage, secrets } = context
  const { readFromStorage, writeToStorage } = storage
  const isDemoMode = process.env.DEMO_MODE === 'true'

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

      // TODO: In Phase 6, this will read from Google Sheets "Insights" tab
      // which is populated by GitLab CI pipeline
      res.status(501).json({
        error: 'AI insights generation not yet implemented. Will be available in Phase 6 (GitLab CI pipeline).'
      })
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

      // TODO: In Phase 6, this will read historical insights from Google Sheets
      res.status(501).json({
        error: 'Insights history not yet implemented. Will be available in Phase 6 (GitLab CI pipeline).'
      })
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
  router.post('/insights/generate', async (req, res) => {
    try {
      const { component } = req.body

      // Load all interactions
      const interactions = readFromStorage('customer-insights/interactions.json') || []

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
      const result = await client.extractFromTranscript(prompt)

      // Add metadata
      const insights = {
        ...result,
        generatedAt: new Date().toISOString(),
        component: component || 'all',
        analysisMetadata: {
          totalInteractions: filteredInteractions.length,
          uniqueCustomers: new Set(filteredInteractions.map(i => i.customerCompany)).size,
          industries: [...new Set(filteredInteractions.map(i => i.industryVertical))],
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
