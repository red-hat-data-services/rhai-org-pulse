const { createStorage } = require('../services/googleSheetsStorage')
const { createModelsCorpClient } = require('../services/modelsCorpClient')
const { createJiraClient } = require('../../../../shared/server/jira')

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoadmapRoutes(router, context) {
  const { storage, requireAuth, secrets } = context
  const { readFromStorage, writeToStorage } = storage
   
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

      // Check if roadmap has been generated
      const roadmap = readFromStorage('customer-insights/roadmap.json')
      if (!roadmap) {
        // Return empty structure
        return res.json({
          summary: {
            total: 0,
            inProgress: 0,
            completed: 0,
            customersImpacted: 0,
          },
          items: [],
          topRequests: []
        })
      }

      // Filter by component if specified
      if (component && component !== 'all') {
        const filtered = {
          ...roadmap,
          items: roadmap.items.filter(item =>
            item.components && item.components.includes(component)
          ),
        }
        filtered.summary = calculateSummary(filtered.items)
        return res.json(filtered)
      }

      res.json(roadmap)
    } catch (error) {
      console.error('Error fetching roadmap:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/customer-insights/roadmap/generate:
   *   post:
   *     summary: Generate AI-powered roadmap recommendations
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
   *     responses:
   *       200:
   *         description: Generated roadmap
   */
  router.post('/roadmap/generate', requireAuth, async (req, res) => {
    try {
      const { component } = req.body

      // Step 1: Fetch customer interactions from service account storage
      let interactions = []

      if (!isDemoMode) {
        const store = getStorage()
        interactions = await store.getAll(component ? { component } : {})
      }

      // Step 2: Fetch RFEs from Jira
      let rfes = []
      const jiraEmail = secrets.JIRA_EMAIL
      const jiraToken = secrets.JIRA_TOKEN

      if (jiraEmail && jiraToken) {
        try {
          const jiraClient = createJiraClient({
            host: process.env.JIRA_HOST || 'https://redhat.atlassian.net',
            email: jiraEmail,
            token: jiraToken
          })

          const jql = `project = RHAIRFE AND issuetype = "Feature Request" ORDER BY created DESC`
          const issues = await jiraClient.fetchAllJqlResults(jql, 'summary,status,priority,created,description', { maxResults: 50 })

          rfes = issues.map(issue => ({
            key: issue.key,
            summary: issue.fields.summary,
            status: issue.fields.status.name,
            priority: issue.fields.priority?.name || 'Medium',
            created: issue.fields.created,
            description: issue.fields.description
          }))
        } catch (jiraError) {
          console.warn('Failed to fetch Jira RFEs:', jiraError.message)
        }
      }

      // Step 3: Use AI to generate roadmap recommendations
      const apiKey = secrets.MODELS_CORP_API_KEY
      const baseUrl = secrets.MODELS_CORP_BASE_URL || 'https://gemini--apicast-production.apps.int.stc.ai.prod.us-east-1.aws.paas.redhat.com:443'

      if (!apiKey) {
        return res.status(503).json({ error: 'AI generation not configured' })
      }

      const prompt = `You are a product manager creating a strategic product roadmap. Based on the following data, generate roadmap recommendations AND specific RFE suggestions.

CUSTOMER INTERACTIONS (${interactions.length} total, showing top 10):
${JSON.stringify(interactions.slice(0, 10).map(i => ({
  customer: i.customerCompany,
  industry: i.industryVertical,
  painPoints: i.painPoints?.substring(0, 100) || '',
  feedback: i.featureFeedback?.substring(0, 100) || ''
})))}

JIRA RFEs (${rfes.length} total, showing top 8):
${JSON.stringify(rfes.slice(0, 8).map(r => ({key: r.key, summary: r.summary?.substring(0, 80)})))}

Return ONLY valid JSON (no markdown). CRITICAL: Total response must be under 10000 tokens. Keep ALL descriptions to 1 sentence max.

{
  "items": [{"id":"","title":"","description":"1 sentence","timeframe":"Now|Next|Later","status":"Planned","priority":"High|Medium|Low","customerDemand":{"requestCount":0,"keyAccounts":[""],"arrImpact":""},"deliverables":[""],"relatedRFEs":[""],"components":[""]}],
  "topRequests": [{"title":"","requestCount":0,"customers":[""]}],
  "aiRecommendations": {
    "quickActions": [{"id":"","type":"update-rfe","title":"","description":"1 sentence","rfeKey":"","suggestedChanges":{"priority":"","summary":"","description":"","labels":[]}}],
    "suggestedRFEs": [{"id":"","title":"max 60 chars","businessJustification":"1 sentence","technicalDetails":"1 sentence","useCases":"1 sentence","component":"vLLM|Model Serving|RAG + Vector DB|AutoRAG|Training|LlamaStack|Agentic|Project Navigator|Notebooks","priority":"High|Medium|Low","customerCompany":"","industryVertical":"","arrImpact":0,"sourceCustomers":["2 max"],"estimatedEffort":"Small|Medium|Large","relatedRFEs":[""]}]
  }
}

Create EXACTLY:
- 4 roadmap items (Now:1, Next:2, Later:1)
- 3 top requests
- 2 quick actions
- 3 RFE suggestions

JSON:`

      const client = createModelsCorpClient({ apiKey, baseUrl })
      const result = await client.generateInsights(prompt)

      // Add metadata and save
      const roadmap = {
        ...result,
        summary: calculateSummary(result.items || []),
        generatedAt: new Date().toISOString(),
        component: component || 'all'
      }

      writeToStorage('customer-insights/roadmap.json', roadmap)

      res.json(roadmap)
    } catch (error) {
      console.error('Error generating roadmap:', error)

      // Provide helpful error message for JSON parse errors
      if (error.message && error.message.includes('invalid JSON')) {
        return res.status(500).json({
          error: 'AI generated invalid JSON response. Try filtering by a specific component to reduce the data size, or try again.'
        })
      }

      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/customer-insights/roadmap/execute-action:
   *   post:
   *     summary: Execute a quick action recommendation
   *     tags: [Customer Insights]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               actionId:
   *                 type: string
   *     responses:
   *       200:
   *         description: Action executed
   */
  router.post('/roadmap/execute-action', requireAuth, async (req, res) => {
    try {
      const { actionId } = req.body

      // Load current roadmap
      const roadmap = readFromStorage('customer-insights/roadmap.json')
      if (!roadmap?.aiRecommendations?.quickActions) {
        return res.status(404).json({ error: 'No recommendations found' })
      }

      const action = roadmap.aiRecommendations.quickActions.find(a => a.id === actionId)
      if (!action) {
        return res.status(404).json({ error: 'Action not found' })
      }

      // Execute the action based on type
      if (action.type === 'update-rfe') {
        const jiraEmail = secrets.JIRA_EMAIL
        const jiraToken = secrets.JIRA_TOKEN

        if (!jiraEmail || !jiraToken) {
          return res.status(503).json({ error: 'Jira not configured' })
        }

        const jiraClient = createJiraClient({
          host: process.env.JIRA_HOST || 'https://redhat.atlassian.net',
          email: jiraEmail,
          token: jiraToken
        })

        // Update the RFE
        const updates = {}
        if (action.suggestedChanges.priority) {
          updates.priority = { name: action.suggestedChanges.priority }
        }
        if (action.suggestedChanges.summary) {
          updates.summary = action.suggestedChanges.summary
        }
        if (action.suggestedChanges.labels) {
          updates.labels = action.suggestedChanges.labels
        }

        await jiraClient.jiraRequest(`/rest/api/3/issue/${action.rfeKey}`, {
          method: 'PUT',
          body: { fields: updates }
        })

        // Remove this action from recommendations
        roadmap.aiRecommendations.quickActions = roadmap.aiRecommendations.quickActions.filter(a => a.id !== actionId)
        writeToStorage('customer-insights/roadmap.json', roadmap)

        res.json({ success: true, message: `Updated ${action.rfeKey}` })
      } else {
        res.status(400).json({ error: 'Unknown action type' })
      }
    } catch (error) {
      console.error('Error executing action:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/customer-insights/roadmap/create-suggested-rfe:
   *   post:
   *     summary: Create an RFE from AI suggestion
   *     tags: [Customer Insights]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               suggestionId:
   *                 type: string
   *     responses:
   *       201:
   *         description: RFE created
   */
  router.post('/roadmap/create-suggested-rfe', requireAuth, async (req, res) => {
    try {
      const { suggestionId } = req.body

      // Load current roadmap
      const roadmap = readFromStorage('customer-insights/roadmap.json')
      if (!roadmap?.aiRecommendations?.suggestedRFEs) {
        return res.status(404).json({ error: 'No suggestions found' })
      }

      const suggestion = roadmap.aiRecommendations.suggestedRFEs.find(s => s.id === suggestionId)
      if (!suggestion) {
        return res.status(404).json({ error: 'Suggestion not found' })
      }

      // Return the suggestion data for the RFE creator form
      res.json({
        prefill: suggestion
      })
    } catch (error) {
      console.error('Error loading suggestion:', error)
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
