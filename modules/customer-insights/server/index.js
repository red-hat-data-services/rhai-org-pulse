const interactionsRoutes = require('./routes/interactions')
const analyticsRoutes = require('./routes/analytics')
const insightsRoutes = require('./routes/insights')
const roadmapRoutes = require('./routes/roadmap')
const rfeRoutes = require('./routes/rfe')
const importRoutes = require('./routes/import')
const extractRoutes = require('./routes/extract')
const googleDriveAuthRoutes = require('./routes/googleDriveAuth')
const { registerJiraOAuthRoutes } = require('../../../shared/server').jiraOAuth
const { getConfig: getSheetConfig, saveConfig: saveSheetConfig } = require('./sheet-config')

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoutes(router, context) {
  const { requireAdmin, storage } = context
  const { readFromStorage, writeToStorage } = storage

  /**
   * @openapi
   * /api/modules/customer-insights/sheet-config:
   *   get:
   *     tags: [Customer Insights]
   *     summary: Get spreadsheet configuration (admin)
   *     responses:
   *       200:
   *         description: Current spreadsheet configuration
   */
  router.get('/sheet-config', requireAdmin, function(req, res) {
    res.json(getSheetConfig(readFromStorage))
  })

  /**
   * @openapi
   * /api/modules/customer-insights/sheet-config:
   *   post:
   *     tags: [Customer Insights]
   *     summary: Update spreadsheet configuration (admin)
   *     responses:
   *       200:
   *         description: Configuration saved
   *       400:
   *         description: Validation error
   */
  router.post('/sheet-config', requireAdmin, function(req, res) {
    try {
      saveSheetConfig(writeToStorage, req.body)
      res.json({ status: 'saved' })
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
  })

  interactionsRoutes(router, context)
  analyticsRoutes(router, context)
  insightsRoutes(router, context)
  roadmapRoutes(router, context)
  rfeRoutes(router, context)
  importRoutes(router, context)
  extractRoutes(router, context)
  googleDriveAuthRoutes(router, context)

  // Register Jira OAuth routes if credentials configured
  const jiraOAuthClientId = context.secrets.JIRA_OAUTH_CLIENT_ID
  const jiraOAuthClientSecret = context.secrets.JIRA_OAUTH_CLIENT_SECRET

  if (jiraOAuthClientId && jiraOAuthClientSecret) {
    registerJiraOAuthRoutes(router, {
      clientId: jiraOAuthClientId,
      clientSecret: jiraOAuthClientSecret,
      scopes: ['write:jira-work', 'read:jira-user', 'offline_access']
    })
  }
}
