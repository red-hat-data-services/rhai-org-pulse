const { google } = require('googleapis')
const { createUserTokenStore } = require('../services/userTokenStore')
const { createModelsCorpClient } = require('../services/modelsCorpClient')
const { createJiraClient } = require('../services/jiraClient')

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoadmapRoutes(router, context) {
  const { storage, requireAuth, secrets } = context
  const { readFromStorage, writeToStorage } = storage
  const isDemoMode = process.env.DEMO_MODE === 'true'
  const tokenStore = createUserTokenStore(storage)

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

      // Step 1: Fetch customer interactions from Google Sheets
      const userEmail = req.userEmail
      if (!userEmail) {
        return res.status(401).json({ error: 'User not authenticated' })
      }

      let interactions = []

      if (!isDemoMode) {
        const googleTokens = await tokenStore.getTokens(userEmail)
        if (!googleTokens) {
          return res.status(400).json({ error: 'Google account not connected' })
        }

        const config = await tokenStore.getSpreadsheetConfig(userEmail)
        if (!config?.spreadsheetId) {
          return res.status(400).json({ error: 'No spreadsheet configured' })
        }

        const clientId = secrets.GOOGLE_OAUTH_CLIENT_ID
        const clientSecret = secrets.GOOGLE_OAUTH_CLIENT_SECRET
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
        oauth2Client.setCredentials(googleTokens)
        const sheets = google.sheets({ version: 'v4', auth: oauth2Client })

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: config.spreadsheetId,
          range: 'Interactions!A1:Z',
        })

        const rows = response.data.values || []
        if (rows.length > 1) {
          const headers = rows[0].map(h => String(h).trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, ''))
          interactions = rows.slice(1).map(row => {
            const obj = {}
            headers.forEach((header, idx) => {
              obj[header] = row[idx] || ''
            })
            return obj
          })
        }
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
          const jiraResults = await jiraClient.searchJql(jql, { maxResults: 50 })

          rfes = jiraResults.issues.map(issue => ({
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

CUSTOMER INTERACTIONS (${interactions.length} total):
${JSON.stringify(interactions.slice(0, 30).map(i => ({
  customer: i.customercompany,
  industry: i.industryvertical,
  useCase: i.mainaiusecase,
  painPoints: i.painpoints,
  feedback: i.featurefeedback,
  wishlist: i.futurewishlist,
  status: i.status
})), null, 2)}

JIRA RFEs (${rfes.length} total):
${JSON.stringify(rfes.slice(0, 20).map(r => ({
  key: r.key,
  summary: r.summary,
  status: r.status,
  priority: r.priority
})), null, 2)}

Generate a product roadmap with ONLY valid JSON (no markdown):
{
  "items": [
    {
      "id": "unique-id",
      "title": "Initiative title",
      "description": "What this initiative delivers",
      "timeframe": "Now|Next|Later",
      "status": "Planned|In Progress|Completed",
      "priority": "High|Medium|Low",
      "customerDemand": {
        "requestCount": number,
        "keyAccounts": ["List of customers requesting this"],
        "arrImpact": "Estimated ARR impact"
      },
      "deliverables": ["Key deliverables"],
      "relatedRFEs": ["RHAIRFE-123"],
      "components": ["Component tags"]
    }
  ],
  "topRequests": [
    {
      "title": "Most requested feature",
      "requestCount": number,
      "customers": ["Customer list"]
    }
  ],
  "aiRecommendations": {
    "quickActions": [
      {
        "id": "action-id",
        "type": "update-rfe",
        "title": "Action title",
        "description": "Why this action matters",
        "rfeKey": "RHAIRFE-123",
        "suggestedChanges": {
          "priority": "High|Medium|Low",
          "summary": "Updated summary if needed",
          "description": "Additional context to add",
          "labels": ["label1", "label2"]
        }
      }
    ],
    "suggestedRFEs": [
      {
        "id": "rfe-suggestion-id",
        "title": "Feature title (concise, under 80 chars)",
        "businessJustification": "Why this matters - 2-3 sentences on business value and customer impact",
        "technicalDetails": "What needs to be built - technical description of the feature",
        "useCases": "Specific use cases or user scenarios - bullet points or numbered list",
        "component": "navigator|autox|platform|d2ma|agentic|inferencing",
        "priority": "Critical|High|Medium|Low",
        "customerCompany": "Primary customer(s) requesting this",
        "industryVertical": "Industry vertical",
        "arrImpact": 0,
        "sourceCustomers": ["List of 2-5 customers who need this"],
        "estimatedEffort": "Small|Medium|Large",
        "relatedRFEs": ["Existing RFE keys if any"]
      }
    ]
  }
}

Rules for Roadmap Items:
- Create 8-12 roadmap items covering Now (3-4), Next (3-4), Later (2-4)
- Prioritize based on customer demand, ARR impact, and RFE count
- Group similar requests into initiatives
- Reference actual customer names and RFE keys
- Be specific and actionable

Rules for Quick Actions:
- Suggest 3-5 actions to improve existing RFEs (update priority, add context, tag with customers)
- Only suggest actions for RFEs that would benefit from updates
- Focus on actions that increase RFE visibility or priority

Rules for Suggested RFEs:
- Create 5-8 NEW RFE suggestions based on unmet customer needs
- Each should be ready to submit (complete fields)
- Consolidate similar requests from multiple customers
- Reference actual customers from the interaction data
- Use proper component tags
- Estimate ARR impact conservatively

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

        await jiraClient.updateIssue(action.rfeKey, { fields: updates })

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
