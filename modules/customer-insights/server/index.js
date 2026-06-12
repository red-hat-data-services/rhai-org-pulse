const interactionsRoutes = require('./routes/interactions')
const analyticsRoutes = require('./routes/analytics')
const insightsRoutes = require('./routes/insights')
const roadmapRoutes = require('./routes/roadmap')
const rfeRoutes = require('./routes/rfe')
const importRoutes = require('./routes/import')
const extractRoutes = require('./routes/extract')
const googleDriveAuthRoutes = require('./routes/googleDriveAuth')
const { registerJiraOAuthRoutes } = require('../../../shared/server').jiraOAuth

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoutes(router, context) {
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
