'use strict'

const { registerRhoaiComponentArchitecturesFetcher, STORAGE_KEY, REGISTRY_KEY, branchesFromRegistry } = require('./fetcher')

/**
 * @param {import('express').Router} router
 * @param {object} context
 */
function registerRhoaiComponentArchitecturesRoutes(router, context) {
  const { storage, requireAuth, requireScope } = context
  const { readFromStorage } = storage

  registerRhoaiComponentArchitecturesFetcher(router, context)

  /**
   * @openapi
   * /api/modules/releases/rhoai-component-architectures:
   *   get:
   *     summary: Get cached component architecture data
   *     tags: [Releases - RHOAI Component Architectures]
   *     parameters:
   *       - in: query
   *         name: branch
   *         schema: { type: string }
   *         description: Filter to a single release branch
   *     responses:
   *       200:
   *         description: Component architecture matrix data
   *       404:
   *         description: No cached data available
   */
  router.get('/', requireAuth, requireScope('releases:read'), async function (req, res) {
    try {
      const data = await readFromStorage(STORAGE_KEY)

      const registry = await readFromStorage(REGISTRY_KEY)
      const registryBranches = branchesFromRegistry(registry)

      if (!data) {
        const shell = {
          fetchedAt: null,
          source: { owner: 'red-hat-data-services', repo: 'konflux-central' },
          branches: {}
        }
        for (const branch of registryBranches) {
          shell.branches[branch] = { reportAvailable: false, components: [], summary: null }
        }
        return res.json(shell)
      }

      const cachedBranches = data.branches || {}
      const branches = {}
      for (const branch of registryBranches) {
        branches[branch] = cachedBranches[branch] || { reportAvailable: false, components: [], summary: null }
      }
      data.branches = branches

      if (req.query.branch) {
        const branch = data.branches[req.query.branch]
        if (!branch) {
          return res.status(404).json({ error: `Branch ${req.query.branch} not found` })
        }
        return res.json({ ...data, branches: { [req.query.branch]: branch } })
      }

      res.json(data)
    } catch (err) {
      console.error('[rhoai-component-architectures] GET error:', err.message)
      res.status(500).json({ error: err.message })
    }
  })
}

module.exports = registerRhoaiComponentArchitecturesRoutes
