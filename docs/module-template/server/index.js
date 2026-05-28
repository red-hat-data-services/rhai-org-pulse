/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoutes(router, context) {
  const { storage: _storage, requireScope } = context

  /**
   * @openapi
   * /api/modules/my-module/hello:
   *   get:
   *     tags: [My Module]
   *     summary: Hello endpoint
   *     responses:
   *       200:
   *         description: Success
   */
  router.get('/hello', requireScope('my-module:read'), function(req, res) {
    res.json({ message: 'Hello from my module!' })
  })

  // Optional: register diagnostics (shown in admin health check)
  context.registerDiagnostics(async function() {
    return { status: 'ok' }
  })
}
