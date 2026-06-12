const { createJiraClient, markdownToAdf } = require('../services/jiraClient')
const { buildJiraIssueFields } = require('../services/rfeBuilder')

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRfeRoutes(router, context) {
  const { storage, secrets } = context
  const { readFromStorage, writeToStorage } = storage
  const isDemoMode = process.env.DEMO_MODE === 'true'

  /**
   * @openapi
   * /api/modules/customer-insights/rfe/search-similar:
   *   post:
   *     summary: Search for similar RFEs using AI-powered semantic similarity
   *     tags: [Customer Insights]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *               businessJustification:
   *                 type: string
   *               technicalDetails:
   *                 type: string
   *               component:
   *                 type: string
   *     responses:
   *       200:
   *         description: List of similar RFEs with similarity scores
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 similar:
   *                   type: array
   *                   items:
   *                     type: object
   */
  router.post('/rfe/search-similar', async (req, res) => {
    try {
      const { title, businessJustification, technicalDetails, component } = req.body

      if (!title || !businessJustification) {
        return res.status(400).json({ error: 'Title and business justification are required' })
      }

      if (isDemoMode) {
        // In demo mode, return fixture data with similarity scores
        const rfes = readFromStorage('customer-insights/rfes.json') || []

        // Simple keyword-based similarity for demo (in production, use AI embeddings)
        const similar = rfes
          .map(rfe => ({
            ...rfe,
            similarity: calculateSimilarity(
              { title, businessJustification, technicalDetails, component },
              rfe
            )
          }))
          .filter(rfe => rfe.similarity > 0.3) // 30% threshold for demo
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 5) // Top 5 results

        return res.json({ similar })
      }

      // Production: Search Jira for similar RFEs
      try {
        const jiraEmail = secrets.JIRA_EMAIL
        const jiraToken = secrets.JIRA_TOKEN

        if (!jiraEmail || !jiraToken) {
          // Fallback to demo mode behavior if credentials not available
          console.warn('Jira credentials not configured, using local search')
          const rfes = readFromStorage('customer-insights/rfes.json') || []
          const similar = rfes
            .map(rfe => ({
              ...rfe,
              similarity: calculateSimilarity(
                { title, businessJustification, technicalDetails, component },
                rfe
              )
            }))
            .filter(rfe => rfe.similarity > 0.3)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 5)

          return res.json({ similar })
        }

        // Create Jira client
        const jiraClient = createJiraClient({
          email: jiraEmail,
          token: jiraToken,
          baseUrl: 'https://redhat.atlassian.net'
        })

        // Search for similar RFEs in Jira
        // Use text search in summary and description
        // JQL escaping: double quotes in values must be escaped as \"
        const escapeJQL = (str) => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        const searchTerms = title.split(/\s+/).filter(w => w.length > 3).slice(0, 5).join(' ')
        let jql = `project = RHAIRFE AND issuetype = "Feature Request" AND text ~ "${escapeJQL(searchTerms)}"`

        if (component) {
          const labelValue = component.toLowerCase().replace(/\s+/g, '-')
          jql += ` AND labels = "${escapeJQL(labelValue)}"`
        }

        const issues = await jiraClient.search(jql, ['summary', 'description', 'status', 'labels', 'priority'], 10)

        // Calculate similarity scores for Jira results
        const similar = issues.map(issue => {
          const rfe = {
            id: issue.key,
            title: issue.fields.summary,
            businessJustification: issue.fields.description?.content?.[0]?.content?.[0]?.text || '',
            technicalDetails: '',
            component: component,
            status: issue.fields.status?.name || 'Unknown',
            priority: issue.fields.priority?.name || 'Medium',
            jiraIssue: {
              key: issue.key,
              summary: issue.fields.summary,
              url: `https://redhat.atlassian.net/browse/${issue.key}`
            }
          }

          return {
            ...rfe,
            similarity: calculateSimilarity(
              { title, businessJustification, technicalDetails, component },
              rfe
            )
          }
        })
        .filter(rfe => rfe.similarity > 0.3)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5)

        return res.json({ similar })

      } catch (jiraError) {
        console.error('Jira search failed:', jiraError)
        // Fallback to local search on error
        const rfes = readFromStorage('customer-insights/rfes.json') || []
        const similar = rfes
          .map(rfe => ({
            ...rfe,
            similarity: calculateSimilarity(
              { title, businessJustification, technicalDetails, component },
              rfe
            )
          }))
          .filter(rfe => rfe.similarity > 0.3)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 5)

        return res.json({ similar })
      }
    } catch (error) {
      console.error('Error searching similar RFEs:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/customer-insights/rfe/create:
   *   post:
   *     summary: Create a new RFE
   *     tags: [Customer Insights]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - component
   *               - title
   *               - businessJustification
   *               - technicalDetails
   *             properties:
   *               sourceInteractionId:
   *                 type: string
   *               component:
   *                 type: string
   *               title:
   *                 type: string
   *               businessJustification:
   *                 type: string
   *               technicalDetails:
   *                 type: string
   *               useCases:
   *                 type: string
   *               customerCompany:
   *                 type: string
   *               industryVertical:
   *                 type: string
   *               priority:
   *                 type: string
   *               arrImpact:
   *                 type: number
   *     responses:
   *       201:
   *         description: RFE created successfully
   */
  router.post('/rfe/create', async (req, res) => {
    try {
      const {
        sourceInteractionId,
        component,
        title,
        businessJustification,
        technicalDetails,
        useCases,
        acceptanceCriteria,
        successMetrics,
        complexity,
        estimatedEffort,
        dependencies,
        targetRelease,
        requestedBy,
        customerCompany,
        industryVertical,
        priority,
        arrImpact,
      } = req.body

      // Validation
      if (!component || !title || !businessJustification || !technicalDetails) {
        return res.status(400).json({
          error: 'Component, title, business justification, and technical details are required'
        })
      }

      if (isDemoMode) {
        // In demo mode, create a mock RFE
        const rfes = readFromStorage('customer-insights/rfes.json') || []

        const newRfe = {
          id: `rfe-${Date.now()}`,
          sourceInteractionId,
          component,
          title,
          businessJustification,
          technicalDetails,
          useCases,
          acceptanceCriteria,
          successMetrics,
          complexity: complexity || 'Medium',
          estimatedEffort,
          dependencies,
          targetRelease,
          requestedBy,
          customerCompany,
          industryVertical,
          priority: priority || 'Medium',
          arrImpact,
          status: 'Draft',
          createdAt: new Date().toISOString(),
          createdBy: 'demo-user',
          jiraIssue: {
            key: `RHAIRFE-${Math.floor(Math.random() * 10000)}`,
            summary: title,
            url: `https://redhat.atlassian.net/browse/RHAIRFE-${Math.floor(Math.random() * 10000)}`
          }
        }

        rfes.push(newRfe)
        writeToStorage('customer-insights/rfes.json', rfes)

        return res.status(201).json(newRfe)
      }

      // Production: Create actual Jira issue
      try {
        let jiraClient

        // Try per-user OAuth first (if available on router)
        if (router.getJiraClient) {
          try {
            const { jiraRequest } = await router.getJiraClient(req)
            // Wrap OAuth jiraRequest to match createJiraClient interface
            jiraClient = {
              jiraRequest,
              createIssue: async (fields) => {
                // Convert description to ADF if it's a string (same as createJiraClient)
                if (fields.description && typeof fields.description === 'string') {
                  fields = { ...fields, description: markdownToAdf(fields.description) }
                }
                return jiraRequest('/rest/api/3/issue', {
                  method: 'POST',
                  body: { fields }
                })
              },
              search: async (jql, fields, maxResults) => {
                const params = new URLSearchParams({
                  jql,
                  fields: Array.isArray(fields) ? fields.join(',') : fields,
                  maxResults: String(maxResults || 50)
                })
                const result = await jiraRequest(`/rest/api/3/search?${params}`)
                return result.issues || []
              }
            }
          } catch (oauthError) {
            // OAuth not connected, fall back to shared credentials
            console.log('Per-user Jira OAuth not connected, trying shared credentials:', oauthError.message)
          }
        }

        // Fall back to shared credentials if OAuth not available
        if (!jiraClient) {
          const jiraEmail = secrets.JIRA_EMAIL
          const jiraToken = secrets.JIRA_TOKEN

          if (!jiraEmail || !jiraToken) {
            throw new Error('Jira credentials not configured. Either connect your Jira account (OAuth) or set JIRA_EMAIL and JIRA_TOKEN in module secrets.')
          }

          // Create Jira client with shared credentials
          jiraClient = createJiraClient({
            email: jiraEmail,
            token: jiraToken,
            baseUrl: 'https://redhat.atlassian.net'
          })
        }

        // Build Jira issue fields
        const fields = buildJiraIssueFields({
          component,
          title,
          businessJustification,
          technicalDetails,
          useCases,
          customerCompany,
          industryVertical,
          priority,
          arrImpact,
          sourceInteractionId
        }, 'RHAIRFE')

        // Create the Jira issue
        const result = await jiraClient.createIssue(fields)

        // Store RFE metadata locally
        const rfes = readFromStorage('customer-insights/rfes.json') || []
        const newRfe = {
          id: `rfe-${Date.now()}`,
          sourceInteractionId,
          component,
          title,
          businessJustification,
          technicalDetails,
          useCases,
          acceptanceCriteria,
          successMetrics,
          complexity: complexity || 'Medium',
          estimatedEffort,
          dependencies,
          targetRelease,
          requestedBy,
          customerCompany,
          industryVertical,
          priority: priority || 'Medium',
          arrImpact,
          status: 'Submitted',
          createdAt: new Date().toISOString(),
          createdBy: req.userEmail || 'unknown',
          jiraIssue: {
            key: result.key,
            summary: title,
            url: `https://redhat.atlassian.net/browse/${result.key}`
          }
        }

        rfes.push(newRfe)
        writeToStorage('customer-insights/rfes.json', rfes)

        console.log(`✓ Created Jira RFE: ${result.key}`)

        return res.status(201).json(newRfe)

      } catch (jiraError) {
        console.error('Jira creation failed:', jiraError)
        // Return detailed error for debugging
        return res.status(500).json({
          error: 'Failed to create Jira issue',
          details: jiraError.message
        })
      }
    } catch (error) {
      console.error('Error creating RFE:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/customer-insights/rfe/list:
   *   get:
   *     summary: List all RFEs
   *     tags: [Customer Insights]
   *     parameters:
   *       - name: component
   *         in: query
   *         schema:
   *           type: string
   *       - name: status
   *         in: query
   *         schema:
   *           type: string
   *       - name: priority
   *         in: query
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of RFEs
   */
  router.get('/rfe/list', async (req, res) => {
    try {
      const { component, status, priority } = req.query

      if (isDemoMode) {
        let rfes = readFromStorage('customer-insights/rfes.json') || []

        // Apply filters
        if (component) {
          rfes = rfes.filter(rfe => rfe.component === component)
        }
        if (status) {
          rfes = rfes.filter(rfe => rfe.status === status)
        }
        if (priority) {
          rfes = rfes.filter(rfe => rfe.priority === priority)
        }

        return res.json(rfes)
      }

      // TODO: In production, fetch from database or Google Sheets
      res.status(501).json({
        error: 'RFE listing not yet implemented.'
      })
    } catch (error) {
      console.error('Error listing RFEs:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * Calculate simple keyword-based similarity (demo mode)
   * In production, use AI embeddings with cosine similarity
   */
  function calculateSimilarity(rfe1, rfe2) {
    let score = 0

    // Component match bonus
    if (rfe1.component === rfe2.component) {
      score += 0.2
    }

    // Text similarity
    const text1 = `${rfe1.title || ''} ${rfe1.businessJustification || ''} ${rfe1.technicalDetails || ''}`.toLowerCase()
    const text2 = `${rfe2.title || ''} ${rfe2.businessJustification || ''} ${rfe2.technicalDetails || ''}`.toLowerCase()

    const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3))
    const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3))

    const intersection = new Set([...words1].filter(w => words2.has(w)))
    const union = new Set([...words1, ...words2])

    // Jaccard similarity (0-0.8 range)
    const textSimilarity = union.size > 0 ? (intersection.size / union.size) * 0.8 : 0
    score += textSimilarity

    return Math.min(score, 1.0)
  }
}
