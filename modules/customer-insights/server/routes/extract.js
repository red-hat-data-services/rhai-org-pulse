const { createModelsCorpClient } = require('../services/modelsCorpClient')

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerExtractRoutes(router, context) {
  const { requireAuth, secrets } = context
  const isDemoMode = process.env.DEMO_MODE === 'true'

  /**
   * @openapi
   * /api/modules/customer-insights/extract/health:
   *   get:
   *     summary: Check if AI extraction is configured
   *     tags: [Customer Insights]
   *     responses:
   *       200:
   *         description: AI extraction is configured
   *       503:
   *         description: AI extraction is not configured
   */
  router.get('/extract/health', requireAuth, (req, res) => {
    const apiKey = secrets.MODELS_CORP_API_KEY
    if (!apiKey) {
      return res.status(503).json({ configured: false })
    }
    res.json({ configured: true })
  })

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
   *         description: Extracted customer interaction data with multi-component detection
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 shared:
   *                   type: object
   *                   description: Shared customer information across all components
   *                 components:
   *                   type: array
   *                   description: Per-component pain points and feedback
   *                   items:
   *                     type: object
   */
  router.post('/extract/transcript', requireAuth, async (req, res) => {
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
          shared: {
            customerCompany: 'Example Corp',
            contactName: 'John Doe',
            industryVertical: 'Technology',
            geo: 'NA',
            customerType: 'Customer',
            environment: 'Cloud',
            toolsOfChoice: ['PyTorch', 'TensorFlow'],
            status: 'Discovery',
          },
          components: [
            {
              component: 'Model Serving',
              mainAIUseCase: 'Real-time model inference for recommendation engine',
              painPoints: 'Latency issues with large models under high concurrency',
              featureFeedback: 'Need better autoscaling and GPU scheduling support',
              futureWishlist: ['GPU memory optimization'],
            },
            {
              component: 'Model Observability',
              mainAIUseCase: 'Monitoring model drift in production',
              painPoints: 'No alerting on data drift, limited custom metrics',
              featureFeedback: 'Dashboard is useful but needs custom metric support',
              futureWishlist: ['Custom metric support', 'Slack integration'],
            },
          ],
          _demoMode: true,
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
