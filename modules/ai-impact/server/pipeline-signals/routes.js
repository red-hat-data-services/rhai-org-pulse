const { resolvePipelineSignals } = require('./resolve');

/**
 * Register pipeline-signals routes on the module router.
 *
 * @param {import('express').Router} router
 * @param {object} context - Module context with storage and auth middleware
 */
module.exports = function registerPipelineSignalRoutes(router, context) {
  const { storage, requireScope } = context;
  const { readFromStorage } = storage;

  const JIRA_HOST = process.env.JIRA_HOST || 'https://redhat.atlassian.net';

  /**
   * @openapi
   * /api/modules/ai-impact/pipeline-signals/{featureKey}:
   *   get:
   *     summary: Resolve pipeline lineage signals for a feature key
   *     description: >
   *       Joins across all AI Impact data stores (RFE, feature review,
   *       decomposer, test plans, documentation, component onboarding)
   *       to return the full pipeline status for a given feature.
   *     tags: [AI Impact - Pipeline]
   *     parameters:
   *       - in: path
   *         name: featureKey
   *         required: true
   *         schema:
   *           type: string
   *         description: Feature Jira key (e.g. RHAISTRAT-1234 or RHOAIENG-567)
   *     responses:
   *       200:
   *         description: Pipeline signals for all phases
   *       400:
   *         description: Missing or invalid feature key
   */
  router.get('/pipeline-signals/:featureKey', requireScope('ai-impact:read'), async function(req, res) {
    const featureKey = req.params.featureKey;
    if (!featureKey || !/^[A-Z][A-Z0-9]+-\d+$/.test(featureKey)) {
      return res.status(400).json({ error: 'Invalid feature key format' });
    }

    try {
      const result = await resolvePipelineSignals(featureKey, readFromStorage, {
        jiraHost: JIRA_HOST
      });
      res.json(result);
    } catch (err) {
      console.error('[ai-impact] Pipeline signals resolve error:', err);
      res.status(500).json({ error: 'Failed to resolve pipeline signals' });
    }
  });
};
