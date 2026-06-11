const { createModelsCorpClient } = require('../services/modelsCorpClient')

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerExtractRoutes(router, context) {
  const { secrets } = context
  const isDemoMode = process.env.DEMO_MODE === 'true'

  /**
   * @openapi
   * /api/modules/customer-insights/extract/transcript:
   *   post:
   *     summary: Extract customer interaction data from transcript using AI
   *     tags: [Customer Insights]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               transcript:
   *                 type: string
   *                 description: Meeting notes or call transcript text
   *             required:
   *               - transcript
   *     responses:
   *       200:
   *         description: Extracted customer interaction data
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   */
  router.post('/extract/transcript', async (req, res) => {
    try {
      const { transcript } = req.body

      if (!transcript || transcript.trim().length < 50) {
        return res.status(400).json({
          error: 'Transcript must be at least 50 characters'
        })
      }

      // Check if models.corp is configured
      const apiKey = secrets.MODELS_CORP_API_KEY
      const baseUrl = secrets.MODELS_CORP_BASE_URL || 'https://developer.models.corp.redhat.com'

      // If in demo mode AND no API key configured, return mock data
      if (isDemoMode && !apiKey) {
        return res.json({
          customerCompany: 'Example Corp',
          contactName: 'John Doe',
          industryVertical: 'Technology',
          geo: 'NA',
          customerType: 'Customer',
          environment: 'Cloud',
          mainAIUseCase: 'Extract the use case from your transcript manually',
          toolsOfChoice: ['PyTorch', 'TensorFlow'],
          painPoints: 'Extract pain points from your transcript manually',
          featureFeedback: 'Extract feature requests from your transcript manually',
          futureWishlist: [],
          status: 'Discovery',
          component: 'platform',
          _demoMode: true
        })
      }

      // If no API key (whether demo or not), error
      if (!apiKey) {
        return res.status(503).json({
          error: 'AI extraction not configured. Set MODELS_CORP_API_KEY in module secrets.'
        })
      }

      // Create client and extract
      const client = createModelsCorpClient({ apiKey, baseUrl })
      const extracted = await client.extractFromTranscript(transcript)

      res.json(extracted)
    } catch (error) {
      console.error('Error in transcript extraction:', error)
      res.status(500).json({
        error: error.message || 'Failed to extract data from transcript'
      })
    }
  })
}
