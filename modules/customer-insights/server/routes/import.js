/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerImportRoutes(router, context) {
  const { requireAuth } = context

  /**
   * @openapi
   * /api/modules/customer-insights/import/extract-transcript:
   *   post:
   *     summary: AI extraction from transcript text
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
   *               component:
   *                 type: string
   *     responses:
   *       200:
   *         description: Extraction job queued
   */
  router.post('/import/extract-transcript', requireAuth, async (req, res) => {
    // TODO: Implement in Phase 6 (GitLab CI integration)
    res.json({
      jobId: 'temp-job-id',
      status: 'queued',
      message: 'Transcript extraction not yet implemented'
    })
  })

  /**
   * @openapi
   * /api/modules/customer-insights/import/job-status/{jobId}:
   *   get:
   *     summary: Check extraction job status
   *     tags: [Customer Insights]
   *     parameters:
   *       - name: jobId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Job status
   */
  router.get('/import/job-status/:jobId', async (req, res) => {
    // TODO: Implement in Phase 6 (GitLab CI integration)
    res.json({
      jobId: req.params.jobId,
      status: 'pending',
      message: 'Job status tracking not yet implemented'
    })
  })
}
