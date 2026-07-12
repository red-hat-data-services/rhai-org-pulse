const { createStorage } = require('../services/googleSheetsStorage')

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerInteractionsRoutes(router, context) {
  const { requireAuth, storage } = context
  const { readFromStorage } = storage

   
  const isDemoMode = process.env.DEMO_MODE === 'true'

  // Lazy initialization of service account storage
  let sheetsStorage = null
  function getStorage() {
    if (isDemoMode) return null
    if (!sheetsStorage) {
      sheetsStorage = createStorage(context)
    }
    return sheetsStorage
  }

  /**
   * @openapi
   * /api/modules/customer-insights/interactions:
   *   get:
   *     summary: List customer interactions
   *     tags: [Customer Insights]
   *     parameters:
   *       - name: component
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by Red Hat AI component (e.g., 'vLLM', 'Project Navigator', 'Model Serving')
   *       - name: status
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by status
   *       - name: geo
   *         in: query
   *         schema:
   *           type: string
   *       - name: industryVertical
   *         in: query
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Array of customer interactions
   */
  router.get('/interactions', requireAuth, async (req, res) => {
    try {
      if (isDemoMode) {
        // Return demo fixtures (readFromStorage already returns parsed JSON)
        let data = readFromStorage('customer-insights/interactions.json') || []

        // Apply filters
        const { component, status, geo, industryVertical } = req.query
        if (component && component !== 'all') {
          data = data.filter(item => item.component === component)
        }
        if (status) {
          data = data.filter(item => item.status === status)
        }
        if (geo) {
          data = data.filter(item => item.geo === geo)
        }
        if (industryVertical) {
          data = data.filter(item => item.industryVertical === industryVertical)
        }

        return res.json(data)
      }

      // Use service account storage
      const store = getStorage()
      const data = await store.getAll(req.query)
      res.json(data)
    } catch (error) {
      console.error('[customer-insights] Error fetching interactions:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/customer-insights/interactions:
   *   post:
   *     summary: Create a new customer interaction
   *     tags: [Customer Insights]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       201:
   *         description: Created interaction
   */
  router.post('/interactions', requireAuth, async (req, res) => {
    try {
      if (isDemoMode) {
        return res.status(400).json({ error: 'Cannot create interactions in demo mode' })
      }

      const store = getStorage()
      const newItem = await store.create(req.body)
      res.status(201).json(newItem)
    } catch (error) {
      console.error('[customer-insights] Error creating interaction:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/customer-insights/interactions/{id}:
   *   put:
   *     summary: Update a customer interaction
   *     tags: [Customer Insights]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Updated interaction
   */
  router.put('/interactions/:id', requireAuth, async (req, res) => {
    try {
      if (isDemoMode) {
        return res.status(400).json({ error: 'Cannot update interactions in demo mode' })
      }

      const store = getStorage()
      const updated = await store.update(req.params.id, req.body)

      if (!updated) {
        return res.status(404).json({ error: 'Interaction not found' })
      }

      res.json(updated)
    } catch (error) {
      console.error('[customer-insights] Error updating interaction:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/customer-insights/interactions/{id}:
   *   delete:
   *     summary: Delete a customer interaction
   *     tags: [Customer Insights]
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Success response
   */
  router.delete('/interactions/:id', requireAuth, async (req, res) => {
    try {
      if (isDemoMode) {
        return res.status(400).json({ error: 'Cannot delete interactions in demo mode' })
      }

      const store = getStorage()
      const deleted = await store.delete(req.params.id)

      if (!deleted) {
        return res.status(404).json({ error: 'Interaction not found' })
      }

      res.json({ success: true })
    } catch (error) {
      console.error('[customer-insights] Error deleting interaction:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/customer-insights/interactions/batch:
   *   post:
   *     summary: Batch import customer interactions
   *     tags: [Customer Insights]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               interactions:
   *                 type: array
   *               mode:
   *                 type: string
   *                 enum: [create, upsert]
   *                 default: create
   *     responses:
   *       200:
   *         description: Import result
   */
  router.post('/interactions/batch', requireAuth, async (req, res) => {
    try {
      if (isDemoMode) {
        return res.status(400).json({ error: 'Cannot import interactions in demo mode' })
      }

      const { interactions = [], mode = 'create' } = req.body

      if (!Array.isArray(interactions)) {
        return res.status(400).json({ error: 'interactions must be an array' })
      }

      const store = getStorage()

      if (mode === 'upsert') {
        const result = await store.upsertMany(interactions)
        return res.json(result)
      }

      // Create mode - batch insert
      const newItems = await store.createMany(interactions)
      res.json({
        created: newItems.length,
        updated: 0,
        items: newItems
      })
    } catch (error) {
      console.error('[customer-insights] Error batch importing interactions:', error)
      res.status(500).json({ error: error.message })
    }
  })
}
