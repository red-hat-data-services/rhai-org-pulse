const { cacheClear } = require('./cache')
const {
  fetchPipelineForPm,
  loadResources,
  loadPmRoster
} = require('./pipeline-service')

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoutes(router, context) {
  const { requireScope, requireAdmin } = context

  context.registerScopes([
    {
      key: 'pm-pipeline:read',
      label: 'PM Pipeline (Read)',
      description: 'View PM pipeline and planning prep data',
      category: 'PM Pipeline'
    }
  ])

  const { createJiraClient } = require('../../../shared/server/jira')
  const jira = createJiraClient({
    email: (context.secrets && context.secrets.JIRA_EMAIL) || '',
    token: (context.secrets && context.secrets.JIRA_TOKEN) || '',
    host: process.env.JIRA_HOST
  })

  const readScope = requireScope('pm-pipeline:read')

  /**
   * @openapi
   * /modules/pm-pipeline/pipeline:
   *   get:
   *     summary: Classified pipeline for a Product Manager
   *     tags: [pm-pipeline]
   *     parameters:
   *       - in: query
   *         name: pm
   *         required: true
   *         schema:
   *           type: string
   *         description: Jira display name of the PM
   *       - in: query
   *         name: release
   *         schema:
   *           type: string
   *           default: "3.5"
   *     responses:
   *       200:
   *         description: Pipeline items with stats and playbooks
   */
  router.get('/pipeline', readScope, async function(req, res) {
    const pm = req.query.pm
    if (!pm || !String(pm).trim()) {
      return res.status(400).json({ error: 'Query parameter "pm" (Jira display name) is required' })
    }
    try {
      const result = await fetchPipelineForPm(
        { pmDisplayName: String(pm).trim(), release: req.query.release },
        jira
      )
      res.json(result)
    } catch (err) {
      console.error('[pm-pipeline] Pipeline fetch failed:', err.message)
      res.status(500).json({ error: err.message })
    }
  })

  /**
   * @openapi
   * /modules/pm-pipeline/resources:
   *   get:
   *     summary: Contextual resource links for pipeline playbooks
   *     tags: [pm-pipeline]
   *     responses:
   *       200:
   *         description: Resource link registry for playbook context
   */
  router.get('/resources', readScope, function(req, res) {
    res.json({ resources: loadResources() })
  })

  /**
   * @openapi
   * /modules/pm-pipeline/pm-roster:
   *   get:
   *     summary: Known PM Jira display names for view-as picker
   *     tags: [pm-pipeline]
   *     responses:
   *       200:
   *         description: List of PM Jira display names
   */
  router.get('/pm-roster', readScope, function(req, res) {
    res.json({ roster: loadPmRoster() })
  })

  /**
   * @openapi
   * /modules/pm-pipeline/cache:
   *   delete:
   *     summary: Clear the PM pipeline cache
   *     tags: [pm-pipeline]
   *     responses:
   *       200:
   *         description: Cache cleared
   */
  router.delete('/cache', requireAdmin, readScope, function(req, res) {
    cacheClear()
    res.json({ status: 'cleared' })
  })

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      return {
        jiraHost: jira.JIRA_HOST,
        cacheEnabled: true
      }
    })
  }
}
