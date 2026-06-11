const interactionsRoutes = require('./routes/interactions')
const analyticsRoutes = require('./routes/analytics')
const insightsRoutes = require('./routes/insights')
const roadmapRoutes = require('./routes/roadmap')
const rfeRoutes = require('./routes/rfe')
const importRoutes = require('./routes/import')
const extractRoutes = require('./routes/extract')
const googleDriveAuthRoutes = require('./routes/googleDriveAuth')

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
}
