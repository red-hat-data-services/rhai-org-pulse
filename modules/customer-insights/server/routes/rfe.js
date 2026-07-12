const { createModelsCorpClient } = require('../services/modelsCorpClient')
const { createJiraClient } = require('../../../../shared/server/jira')

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was',
  'not', 'but', 'has', 'have', 'will', 'can', 'does', 'should', 'would',
  'could', 'into', 'also', 'than', 'then', 'been', 'its', 'our', 'their',
])

function extractKeywords(text, maxCount) {
  if (!text) return []
  return text
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()))
    .slice(0, maxCount)
}

function buildSearchJql(title, component, painPoints) {
  let keywords = extractKeywords(title, 8)

  if (keywords.length < 3 && painPoints) {
    keywords = [...keywords, ...extractKeywords(painPoints, 5 - keywords.length)]
  }

  if (component) {
    keywords.unshift(component)
  }

  keywords = [...new Set(keywords.map(k => k.toLowerCase()))].slice(0, 10)
  if (keywords.length === 0) return null

  const textClauses = keywords
    .map(k => `text ~ "${k.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
    .join(' AND ')
  return `project = RHAIRFE AND issuetype = "Feature Request" AND ${textClauses} ORDER BY updated DESC`
}

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRfeRoutes(router, context) {
  const { requireAuth, secrets } = context

  /**
   * @openapi
   * /api/modules/customer-insights/rfe/generate-summary:
   *   post:
   *     summary: Generate RFE summary from customer feedback
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
   *               title:
   *                 type: string
   *               customers:
   *                 type: string
   *               painPoints:
   *                 type: string
   *               businessJustification:
   *                 type: string
   *               successCriteria:
   *                 type: string
   *     responses:
   *       200:
   *         description: Generated RFE summary
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 summary:
   *                   type: string
   */
  router.post('/rfe/generate-summary', requireAuth, async (req, res) => {
    try {
      const { component, title, customers, painPoints, businessJustification, successCriteria } = req.body

      // Validate required fields
      if (!component || !title || !customers || !painPoints || !businessJustification) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      // Check if AI is configured
      const apiKey = secrets.MODELS_CORP_API_KEY
      const baseUrl = secrets.MODELS_CORP_BASE_URL || 'https://gemini--apicast-production.apps.int.stc.ai.prod.us-east-1.aws.paas.redhat.com:443'

      if (!apiKey) {
        return res.status(503).json({
          error: 'AI generation not configured. Set MODELS_CORP_API_KEY in module secrets.'
        })
      }

      // Build prompt following Red Hat PM best practices
      const prompt = buildRfePrompt({
        component,
        title,
        customers,
        painPoints,
        businessJustification,
        successCriteria
      })

      // Generate RFE summary using AI
      const aiClient = createModelsCorpClient({ apiKey, baseUrl })
      const summary = await aiClient.generateText(prompt)

      res.json({ summary })
    } catch (error) {
      console.error('[customer-insights] Error generating RFE summary:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/customer-insights/rfe/search-similar:
   *   post:
   *     summary: Search Jira for similar existing RFEs
   *     tags: [Customer Insights]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [title]
   *             properties:
   *               title:
   *                 type: string
   *               component:
   *                 type: string
   *               painPoints:
   *                 type: string
   *     responses:
   *       200:
   *         description: Similar RFEs found (or empty with optional warning)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 similar:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       key:
   *                         type: string
   *                       summary:
   *                         type: string
   *                       status:
   *                         type: string
   *                       priority:
   *                         type: string
   *                       url:
   *                         type: string
   *                 warning:
   *                   type: string
   *       503:
   *         description: Jira credentials not configured
   */
  router.post('/rfe/search-similar', requireAuth, async (req, res) => {
    try {
      const { title, component, painPoints } = req.body

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required' })
      }

      const jiraEmail = secrets.JIRA_EMAIL
      const jiraToken = secrets.JIRA_TOKEN

      if (!jiraEmail || !jiraToken) {
        return res.status(503).json({
          error: 'Jira credentials not configured. Add JIRA_EMAIL and JIRA_TOKEN to environment variables.'
        })
      }

      const jql = buildSearchJql(title, component, painPoints)
      if (!jql) {
        return res.json({ similar: [] })
      }

      const jira = createJiraClient({
        email: jiraEmail,
        token: jiraToken,
        host: process.env.JIRA_HOST,
      })

      let issues
      try {
        issues = await jira.fetchAllJqlResults(jql, 'summary,status,priority,created', { maxResults: 10 })
      } catch (jiraError) {
        const msg = jiraError.message || ''
        const cause = jiraError.cause?.code || ''
        if (cause === 'ENOTFOUND' || cause === 'ECONNREFUSED' || cause === 'ETIMEDOUT' || msg.includes('fetch failed')) {
          return res.json({
            similar: [],
            warning: 'Could not reach Jira. You may need to connect to VPN.',
          })
        }
        return res.json({
          similar: [],
          warning: `Jira search failed: ${msg}`,
        })
      }

      const similar = issues.map(issue => ({
        key: issue.key,
        summary: issue.fields.summary,
        status: issue.fields.status?.name || 'Unknown',
        priority: issue.fields.priority?.name || 'Medium',
        url: `${jira.JIRA_HOST}/browse/${issue.key}`,
      }))

      res.json({ similar })
    } catch (error) {
      console.error('[customer-insights] Error searching similar RFEs:', error)
      res.status(500).json({ error: error.message })
    }
  })
}

/**
 * Build RFE generation prompt following Red Hat PM best practices
 * Based on pm-toolkit and rhai-customer-tracker patterns
 */
function buildRfePrompt(rfeData) {
  const { component, title, customers, painPoints, businessJustification, successCriteria } = rfeData

  return `You are a Red Hat Product Manager creating a Request for Enhancement (RFE) following official Red Hat PM guidelines.

Generate a well-structured RFE summary that describes the WHAT and WHY (business need), never the HOW (implementation).

**Critical Rules:**
- Describe the business need and user problem, NOT technical implementation
- Use actual customer names (no generic "users" or "customers")
- Write acceptance criteria from the user's perspective ("User can do X" not "System implements Y")
- Focus on outcomes and value, not features or architecture
- Use evidence-based business justification (contracts, revenue, commitments)

**Input Data:**

**Component:** ${component}

**Title:** ${title}

**Affected Customers:**
${customers}

**Pain Points / User Problem:**
${painPoints}

**Business Justification:**
${businessJustification}

${successCriteria ? `**Success Criteria:**\n${successCriteria}\n` : ''}

---

Generate a properly formatted RFE with these sections:

## Summary
[1-2 sentence high-level summary of the business need]

## Problem Statement
[Describe what users cannot do today and why it's painful. Use actual customer names. Focus on the business problem, not technical gaps.]

## Affected Customers
[List specific customer names and segments. Include context about their use cases and impact.]

## Business Justification
[Evidence-based justification: revenue impact, customer commitments, strategic alignment, competitive positioning. Use numbers and facts.]

## Acceptance Criteria
[3-5 user-perspective acceptance criteria written as checkboxes. Each starts with "User can..." or "Customer can...". No implementation details.]

- [ ] User can...
- [ ] User can...
- [ ] User can...

## Success Criteria
[How will we know this solved the customer's problem? Think measurable outcomes.]

---

Return ONLY the formatted RFE markdown (no preamble, no explanation).`
}
