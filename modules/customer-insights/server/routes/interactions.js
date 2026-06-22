const { google } = require('googleapis')
const { createUserTokenStore } = require('../services/userTokenStore')

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerInteractionsRoutes(router, context) {
  const { requireAuth, secrets, storage } = context
  const { readFromStorage } = storage

  const isDemoMode = process.env.DEMO_MODE === 'true'
  const tokenStore = createUserTokenStore(storage)

  /**
   * Get authenticated Google Sheets API client for the current user
   */
  async function getUserSheetsClient(req) {
    const userEmail = req.userEmail
    if (!userEmail) {
      throw new Error('User not authenticated')
    }

    const googleTokens = await tokenStore.getTokens(userEmail)
    if (!googleTokens) {
      throw new Error('Not authenticated with Google. Please connect your Google account first.')
    }

    const clientId = secrets.GOOGLE_OAUTH_CLIENT_ID
    const clientSecret = secrets.GOOGLE_OAUTH_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth not configured')
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret)
    oauth2Client.setCredentials(googleTokens)

    // Auto-refresh and save new tokens
    oauth2Client.on('tokens', async (newTokens) => {
      await tokenStore.saveTokens(userEmail, { ...googleTokens, ...newTokens })
    })

    return google.sheets({ version: 'v4', auth: oauth2Client })
  }

  /**
   * Get user's configured spreadsheet ID
   */
  async function getUserSpreadsheetId(req) {
    const userEmail = req.userEmail
    if (!userEmail) {
      throw new Error('User not authenticated')
    }

    const config = await tokenStore.getSpreadsheetConfig(userEmail)
    if (!config?.spreadsheetId) {
      throw new Error('No spreadsheet configured. Please select a spreadsheet in Settings.')
    }
    return config.spreadsheetId
  }

  /**
   * Build a row array that matches the spreadsheet's header columns
   * @param {object} interaction - The interaction data object
   * @param {Array} headers - The header row from the spreadsheet
   * @returns {Array} Row array in the correct column order
   */
  function buildRowFromHeaders(interaction, headers) {
    // Normalize headers for matching
    const normalizedHeaders = headers.map(h => {
      const normalized = String(h).trim()
        .replace(/\s+/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase()
      return { original: h, normalized }
    })

    // Field name variations for each property
    const fieldMapping = {
      id: ['id', 'ID'],
      date: ['date', 'Date'],
      customerCompany: ['customercompany', 'customerCompany', 'Customer Company'],
      contactName: ['contactname', 'contactName', 'Contact Name'],
      fieldContactName: ['fieldcontactname', 'fieldContactName', 'Field Contact Name'],
      component: ['component', 'Component'],
      geo: ['geo', 'Geo', 'Geography'],
      industryVertical: ['industryvertical', 'industryVertical', 'Industry Vertical'],
      environment: ['environment', 'Environment'],
      customerType: ['customertype', 'customerType', 'Customer Type'],
      status: ['status', 'Status'],
      mainAIUseCase: ['mainaiusecase', 'mainAIUseCase', 'Main AI Use Case'],
      toolsOfChoice: ['toolsofchoice', 'toolsOfChoice', 'Tools of Choice'],
      painPoints: ['painpoints', 'painPoints', 'Pain Points'],
      featureFeedback: ['featurefeedback', 'featureFeedback', 'Feature Feedback'],
      futureWishlist: ['futurewishlist', 'futureWishlist', 'Future Wishlist'],
      pmComments: ['pmcomments', 'pmComments', 'PM Comments'],
    }

    // Build a map of normalized header -> column index
    const headerIndexMap = new Map()
    normalizedHeaders.forEach((h, idx) => {
      headerIndexMap.set(h.normalized, idx)
    })

    // Build the row array
    const row = new Array(headers.length).fill('')

    // For each field in our data model, find the matching column
    Object.entries(fieldMapping).forEach(([field, variations]) => {
      for (const variant of variations) {
        const idx = normalizedHeaders.findIndex(h => h.normalized === variant.toLowerCase())
        if (idx !== -1) {
          // Found the column for this field
          let value = interaction[field]

          // Convert arrays to comma-separated strings
          if (Array.isArray(value)) {
            value = value.join(', ')
          }

          row[idx] = value || ''
          break
        }
      }
    })

    return row
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

      // Check if user has configured Google authentication and spreadsheet
      const userEmail = req.userEmail
      if (!userEmail) {
        return res.json([]) // No user, return empty
      }

      // Check if user has Google tokens
      const googleTokens = await tokenStore.getTokens(userEmail)
      if (!googleTokens) {
        return res.json([]) // Not authenticated with Google, return empty
      }

      // Check if user has configured a spreadsheet
      const config = await tokenStore.getSpreadsheetConfig(userEmail)
      if (!config?.spreadsheetId) {
        return res.json([]) // No spreadsheet configured, return empty array
      }

      // Use per-user Google Sheets
      const sheets = await getUserSheetsClient(req)
      const spreadsheetId = config.spreadsheetId

      // Read from Interactions sheet (including header row)
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Interactions!A1:Z',
      })

      const rows = response.data.values || []
      if (rows.length === 0) {
        return res.json([])
      }

      // Parse headers (normalize to camelCase for flexible matching)
      const headers = rows[0].map(h => {
        const normalized = String(h).trim()
          .replace(/\s+/g, '')
          .replace(/[^a-zA-Z0-9]/g, '')
          .toLowerCase()
        return { original: h, normalized }
      })

      // Find column indices
      const getColIndex = (fieldNames) => {
        for (const name of fieldNames) {
          const idx = headers.findIndex(h => h.normalized === name.toLowerCase())
          if (idx !== -1) return idx
        }
        return -1
      }

      const colMap = {
        id: getColIndex(['id', 'ID']),
        date: getColIndex(['date', 'Date']),
        customerCompany: getColIndex(['customercompany', 'customerCompany', 'Customer Company']),
        contactName: getColIndex(['contactname', 'contactName', 'Contact Name']),
        fieldContactName: getColIndex(['fieldcontactname', 'fieldContactName', 'Field Contact Name']),
        component: getColIndex(['component', 'Component']),
        geo: getColIndex(['geo', 'Geo', 'Geography']),
        industryVertical: getColIndex(['industryvertical', 'industryVertical', 'Industry Vertical']),
        environment: getColIndex(['environment', 'Environment']),
        customerType: getColIndex(['customertype', 'customerType', 'Customer Type']),
        status: getColIndex(['status', 'Status']),
        mainAIUseCase: getColIndex(['mainaiusecase', 'mainAIUseCase', 'Main AI Use Case']),
        toolsOfChoice: getColIndex(['toolsofchoice', 'toolsOfChoice', 'Tools of Choice']),
        painPoints: getColIndex(['painpoints', 'painPoints', 'Pain Points']),
        featureFeedback: getColIndex(['featurefeedback', 'featureFeedback', 'Feature Feedback']),
        futureWishlist: getColIndex(['futurewishlist', 'futureWishlist', 'Future Wishlist']),
        pmComments: getColIndex(['pmcomments', 'pmComments', 'PM Comments']),
      }

      // Map rows to interaction objects (skip header row)
      let data = rows.slice(1).map((row, idx) => ({
        id: (colMap.id !== -1 ? row[colMap.id] : null) || `int-${idx + 1}`,
        date: (colMap.date !== -1 ? row[colMap.date] : null) || '',
        customerCompany: (colMap.customerCompany !== -1 ? row[colMap.customerCompany] : null) || '',
        contactName: (colMap.contactName !== -1 ? row[colMap.contactName] : null) || '',
        fieldContactName: (colMap.fieldContactName !== -1 ? row[colMap.fieldContactName] : null) || '',
        component: (colMap.component !== -1 ? row[colMap.component] : null) || '',
        geo: (colMap.geo !== -1 ? row[colMap.geo] : null) || '',
        industryVertical: (colMap.industryVertical !== -1 ? row[colMap.industryVertical] : null) || '',
        environment: (colMap.environment !== -1 ? row[colMap.environment] : null) || '',
        customerType: (colMap.customerType !== -1 ? row[colMap.customerType] : null) || '',
        status: (colMap.status !== -1 ? row[colMap.status] : null) || '',
        mainAIUseCase: (colMap.mainAIUseCase !== -1 ? row[colMap.mainAIUseCase] : null) || '',
        toolsOfChoice: (colMap.toolsOfChoice !== -1 && row[colMap.toolsOfChoice]) ? row[colMap.toolsOfChoice].split(',').map(t => t.trim()) : [],
        painPoints: (colMap.painPoints !== -1 ? row[colMap.painPoints] : null) || '',
        featureFeedback: (colMap.featureFeedback !== -1 ? row[colMap.featureFeedback] : null) || '',
        futureWishlist: (colMap.futureWishlist !== -1 && row[colMap.futureWishlist]) ? row[colMap.futureWishlist].split(',').map(t => t.trim()) : [],
        pmComments: (colMap.pmComments !== -1 ? row[colMap.pmComments] : null) || '',
      }))

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

      // Use per-user Google Sheets
      const sheets = await getUserSheetsClient(req)
      const spreadsheetId = await getUserSpreadsheetId(req)

      // Read headers to build row correctly
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Interactions!A1:Z1',
      })
      const headers = headerResponse.data.values?.[0] || []

      if (headers.length === 0) {
        return res.status(400).json({ error: 'Spreadsheet has no headers. Please add headers first.' })
      }

      // Read existing data to generate ID
      const dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Interactions!A2:Z',
      })
      const existingRows = dataResponse.data.values || []

      // Find ID column to generate next ID
      const idColIndex = headers.findIndex(h =>
        String(h).toLowerCase().replace(/[^a-z0-9]/g, '') === 'id'
      )

      let maxId = 0
      if (idColIndex !== -1) {
        existingRows.forEach(row => {
          const id = row[idColIndex] || ''
          const num = parseInt(id.replace(/\D/g, ''))
          if (!isNaN(num) && num > maxId) {
            maxId = num
          }
        })
      }

      const newId = `int-${String(maxId + 1).padStart(3, '0')}`

      // Create interaction with ID
      const item = { ...req.body, id: newId }

      // Build row that matches the spreadsheet headers
      const row = buildRowFromHeaders(item, headers)

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Interactions!A:A',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
      })

      res.status(201).json(item)
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

      // Use per-user Google Sheets
      const sheets = await getUserSheetsClient(req)
      const spreadsheetId = await getUserSpreadsheetId(req)

      // Read headers to build row correctly
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Interactions!A1:Z1',
      })
      const headers = headerResponse.data.values?.[0] || []

      if (headers.length === 0) {
        return res.status(400).json({ error: 'Spreadsheet has no headers. Please add headers first.' })
      }

      // Find ID column
      const idColIndex = headers.findIndex(h =>
        String(h).toLowerCase().replace(/[^a-z0-9]/g, '') === 'id'
      )

      if (idColIndex === -1) {
        return res.status(400).json({ error: 'Spreadsheet has no ID column.' })
      }

      // Find the row index by reading the ID column
      const idColumnLetter = String.fromCharCode(65 + idColIndex) // A=65
      const idResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `Interactions!${idColumnLetter}2:${idColumnLetter}`,
      })
      const ids = (idResponse.data.values || []).map(row => row[0])
      const rowIndex = ids.indexOf(req.params.id)

      if (rowIndex === -1) {
        return res.status(404).json({ error: 'Interaction not found' })
      }

      // Build row that matches the spreadsheet headers
      const item = { ...req.body, id: req.params.id }
      const row = buildRowFromHeaders(item, headers)

      // Calculate the range (row 2 = first data row, so add 2)
      const rowNumber = rowIndex + 2
      const lastColumnLetter = String.fromCharCode(65 + headers.length - 1)

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Interactions!A${rowNumber}:${lastColumnLetter}${rowNumber}`,
        valueInputOption: 'RAW',
        requestBody: { values: [row] },
      })

      res.json(item)
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

      // Use per-user Google Sheets
      const sheets = await getUserSheetsClient(req)
      const spreadsheetId = await getUserSpreadsheetId(req)

      // Find the row index
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Interactions!A2:A',
      })
      const ids = (response.data.values || []).map(row => row[0])
      const rowIndex = ids.indexOf(req.params.id)

      if (rowIndex === -1) {
        return res.status(404).json({ error: 'Interaction not found' })
      }

      // Delete the row using batchUpdate (row 2 = first data row, so add 2)
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: 0, // Assumes first sheet
                dimension: 'ROWS',
                startIndex: rowIndex + 1, // 0-indexed, +1 for header
                endIndex: rowIndex + 2,
              }
            }
          }]
        }
      })

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

      const { interactions = [], mode = 'create' } = req.body

      if (!Array.isArray(interactions)) {
        return res.status(400).json({ error: 'interactions must be an array' })
      }

      // Use per-user Google Sheets
      const sheets = await getUserSheetsClient(req)
      const spreadsheetId = await getUserSpreadsheetId(req)

      // Read headers to build rows correctly
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Interactions!A1:Z1',
      })
      const headers = headerResponse.data.values?.[0] || []

      if (headers.length === 0) {
        return res.status(400).json({ error: 'Spreadsheet has no headers. Please add headers first.' })
      }

      // Read existing data to generate IDs
      const dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Interactions!A2:Z',
      })

      const existingRows = dataResponse.data.values || []

      // Find ID column to generate next ID
      const idColIndex = headers.findIndex(h =>
        String(h).toLowerCase().replace(/[^a-z0-9]/g, '') === 'id'
      )

      let maxId = 0
      if (idColIndex !== -1) {
        existingRows.forEach(row => {
          const id = row[idColIndex] || ''
          const num = parseInt(id.replace(/\D/g, ''))
          if (!isNaN(num) && num > maxId) {
            maxId = num
          }
        })
      }

      // Convert interactions to rows that match the spreadsheet headers
      const newRows = interactions.map((item, idx) => {
        const id = item.id || `int-${String(maxId + idx + 1).padStart(3, '0')}`
        const itemWithId = { ...item, id }
        return buildRowFromHeaders(itemWithId, headers)
      })

      // Append or upsert
      if (mode === 'upsert') {
        // TODO: Implement upsert logic (find matching IDs and update)
        // For now, just append
      }

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Interactions!A:A',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: newRows,
        },
      })

      res.json({
        created: newRows.length,
        updated: 0,
        items: interactions.map((item, idx) => ({
          ...item,
          id: newRows[idx][0]
        }))
      })
    } catch (error) {
      console.error('Error batch importing interactions:', error)
      res.status(500).json({ error: error.message })
    }
  })
}
