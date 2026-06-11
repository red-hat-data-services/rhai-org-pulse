const { createStorage } = require('../services/googleSheetsStorage')

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerInteractionsRoutes(router, context) {
  const { requireAuth, secrets, storage } = context
  const { readFromStorage } = storage

  // Check if we're in demo mode or have Google Sheets configured
  const isDemoMode = process.env.DEMO_MODE === 'true'
  const hasGoogleCreds = secrets.GOOGLE_CLIENT_ID && secrets.GOOGLE_CLIENT_SECRET && secrets.GOOGLE_SPREADSHEET_ID

  let sheetsStorage = null
  if (!isDemoMode && hasGoogleCreds) {
    sheetsStorage = createStorage(secrets)
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
   *         description: Filter by component (navigator, autox, platform, etc.)
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
  router.get('/interactions', async (req, res) => {
    try {
      if (isDemoMode) {
        // Return demo fixtures
        const fixtures = readFromStorage('customer-insights/interactions.json') || []
        let data = fixtures

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

      if (!sheetsStorage) {
        return res.status(503).json({
          error: 'Google Sheets not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_SPREADSHEET_ID in module secrets.'
        })
      }

      const filters = {
        component: req.query.component,
        status: req.query.status,
        geo: req.query.geo,
        industryVertical: req.query.industryVertical,
      }

      const data = await sheetsStorage.getAll(filters)
      res.json(data)
    } catch (error) {
      console.error('Error fetching interactions:', error)
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

      if (!sheetsStorage) {
        return res.status(503).json({ error: 'Google Sheets not configured' })
      }

      const created = await sheetsStorage.create(req.body)
      res.status(201).json(created)
    } catch (error) {
      console.error('Error creating interaction:', error)
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

      if (!sheetsStorage) {
        return res.status(503).json({ error: 'Google Sheets not configured' })
      }

      const updated = await sheetsStorage.update(req.params.id, req.body)

      if (!updated) {
        return res.status(404).json({ error: 'Interaction not found' })
      }

      res.json(updated)
    } catch (error) {
      console.error('Error updating interaction:', error)
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

      if (!sheetsStorage) {
        return res.status(503).json({ error: 'Google Sheets not configured' })
      }

      const deleted = await sheetsStorage.delete(req.params.id)

      if (!deleted) {
        return res.status(404).json({ error: 'Interaction not found' })
      }

      res.json({ success: true })
    } catch (error) {
      console.error('Error deleting interaction:', error)
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

      if (!sheetsStorage) {
        return res.status(503).json({ error: 'Google Sheets not configured' })
      }

      const { interactions = [], mode = 'create' } = req.body

      if (!Array.isArray(interactions)) {
        return res.status(400).json({ error: 'interactions must be an array' })
      }

      let result
      if (mode === 'upsert') {
        result = await sheetsStorage.upsertMany(interactions)
      } else {
        const created = await sheetsStorage.createMany(interactions)
        result = { created: created.length, updated: 0, items: created }
      }

      res.json(result)
    } catch (error) {
      console.error('Error batch importing interactions:', error)
      res.status(500).json({ error: error.message })
    }
  })
}
