const { google } = require('googleapis')
const crypto = require('crypto')
const { createUserTokenStore } = require('../services/userTokenStore')

// In-memory state tokens for OAuth (keyed by state token, value is user email)
const oauthStates = new Map()

/**
 * Google Drive OAuth routes for per-user authentication.
 * Users authenticate with their own Google accounts to access Drive files.
 *
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerGoogleDriveAuthRoutes(router, context) {
  const { storage, secrets, requireAuth } = context
  const tokenStore = createUserTokenStore(storage)

  // OAuth client configuration
  function getOAuthClient() {
    const clientId = secrets.GOOGLE_OAUTH_CLIENT_ID
    const clientSecret = secrets.GOOGLE_OAUTH_CLIENT_SECRET
    // eslint-disable-next-line org-pulse/no-module-process-env -- callback URL is deployment config, not a secret
    const callbackUrl = process.env.GOOGLE_OAUTH_CALLBACK_URL ||
    // eslint-disable-next-line org-pulse/no-module-process-env -- base URL is deployment config, not a secret
                       `${process.env.VITE_API_BASE_URL || 'http://localhost:3001'}/api/modules/customer-insights/auth/google/callback`

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.')
    }

    return new google.auth.OAuth2(clientId, clientSecret, callbackUrl)
  }

  /**
   * @openapi
   * /api/modules/customer-insights/auth/google:
   *   get:
   *     summary: Initiate Google OAuth flow for Drive access
   *     tags: [Customer Insights]
   *     responses:
   *       302:
   *         description: Redirects to Google OAuth consent screen
   */
  router.get('/auth/google', requireAuth, (req, res) => {
    try {
      const oauth2Client = getOAuthClient()
      const userEmail = req.userEmail

      if (!userEmail) {
        throw new Error('User email not found')
      }

      // Generate state token for CSRF protection
      const state = crypto.randomBytes(32).toString('hex')
      oauthStates.set(state, userEmail)

      // Clean up old state tokens (older than 10 minutes)
      setTimeout(() => oauthStates.delete(state), 10 * 60 * 1000)

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Get refresh token
        scope: [
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/spreadsheets' // Read and write Google Sheets
        ],
        state,
        prompt: 'consent' // Force consent screen to get refresh token
      })

      res.redirect(authUrl)
    } catch (error) {
      console.error('Error initiating Google OAuth:', error)
      const sanitizedMessage = String(error.message || 'Unknown error')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
      res.status(500).send(`
        <html>
          <body>
            <h1>Error</h1>
            <p>${sanitizedMessage}</p>
            <script>window.close()</script>
          </body>
        </html>
      `)
    }
  })

  /**
   * @openapi
   * /api/modules/customer-insights/auth/google/callback:
   *   get:
   *     summary: Handle Google OAuth callback
   *     tags: [Customer Insights]
   *     parameters:
   *       - in: query
   *         name: code
   *         schema:
   *           type: string
   *         description: Authorization code from Google
   *       - in: query
   *         name: state
   *         schema:
   *           type: string
   *         description: CSRF protection state token
   *     responses:
   *       200:
   *         description: OAuth successful, closes popup window
   */
  router.get('/auth/google/callback', async (req, res) => {
    try {
      const { code, state } = req.query

      // Validate state token (CSRF protection)
      const userEmail = oauthStates.get(state)
      if (!state || !userEmail) {
        throw new Error('Invalid state token. Possible CSRF attack.')
      }

      // Clear state token
      oauthStates.delete(state)

      const oauth2Client = getOAuthClient()

      // Exchange authorization code for tokens
      const { tokens } = await oauth2Client.getToken(code)

      // Store tokens for this user
      await tokenStore.saveTokens(userEmail, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date
      })

      // Close popup and notify parent window
      res.send(`
        <html>
          <head>
            <title>Google Drive Connected</title>
          </head>
          <body>
            <h1>✓ Google Drive Connected</h1>
            <p>You can close this window.</p>
            <script>
              // Notify parent window
              if (window.opener) {
                window.opener.postMessage({ type: 'google-oauth-success' }, window.location.origin)
              }
              // Auto-close after 2 seconds
              setTimeout(() => window.close(), 2000)
            </script>
          </body>
        </html>
      `)
    } catch (error) {
      console.error('Error in Google OAuth callback:', error)
      const sanitizedMessage = String(error.message || 'Unknown error')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
      const jsEscapedMessage = String(error.message || 'Unknown error')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
      res.send(`
        <html>
          <head>
            <title>Connection Failed</title>
          </head>
          <body>
            <h1>✗ Connection Failed</h1>
            <p>${sanitizedMessage}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'google-oauth-error', error: '${jsEscapedMessage}' }, window.location.origin)
              }
              setTimeout(() => window.close(), 3000)
            </script>
          </body>
        </html>
      `)
    }
  })

  /**
   * @openapi
   * /api/modules/customer-insights/auth/google/status:
   *   get:
   *     summary: Check if user has connected Google Drive
   *     tags: [Customer Insights]
   *     responses:
   *       200:
   *         description: Connection status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 connected:
   *                   type: boolean
   */
  router.get('/auth/google/status', requireAuth, async (req, res) => {
    const userEmail = req.userEmail
    if (!userEmail) {
      return res.json({ connected: false })
    }
    const tokens = await tokenStore.getTokens(userEmail)
    res.json({ connected: !!(tokens?.access_token) })
  })

  /**
   * @openapi
   * /api/modules/customer-insights/auth/google/disconnect:
   *   post:
   *     summary: Disconnect Google Drive (revoke tokens)
   *     tags: [Customer Insights]
   *     responses:
   *       200:
   *         description: Successfully disconnected
   */
  router.post('/auth/google/disconnect', requireAuth, async (req, res) => {
    const userEmail = req.userEmail
    if (userEmail) {
      await tokenStore.deleteTokens(userEmail)
    }
    res.json({ success: true })
  })

  /**
   * @openapi
   * /api/modules/customer-insights/auth/google/token:
   *   get:
   *     summary: Get Google access token for Picker API
   *     tags: [Customer Insights]
   *     responses:
   *       200:
   *         description: Access token
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 accessToken:
   *                   type: string
   */
  router.get('/auth/google/token', requireAuth, async (req, res) => {
    const userEmail = req.userEmail
    if (!userEmail) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    const tokens = await tokenStore.getTokens(userEmail)
    if (!tokens?.access_token) {
      return res.status(401).json({ error: 'Not authenticated with Google' })
    }
    res.json({ accessToken: tokens.access_token })
  })

  /**
   * @openapi
   * /api/modules/customer-insights/auth/google/picker-config:
   *   get:
   *     summary: Get Google Picker API configuration
   *     tags: [Customer Insights]
   *     responses:
   *       200:
   *         description: Picker API key
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 apiKey:
   *                   type: string
   */
  router.get('/auth/google/picker-config', requireAuth, (req, res) => {
    const apiKey = secrets.GOOGLE_PICKER_API_KEY
    if (!apiKey) {
      return res.status(503).json({ error: 'Google Picker API key not configured' })
    }
    res.json({ apiKey })
  })

  /**
   * @openapi
   * /api/modules/customer-insights/drive/files/{fileId}:
   *   get:
   *     summary: Download file content from Google Drive
   *     tags: [Customer Insights]
   *     parameters:
   *       - in: path
   *         name: fileId
   *         required: true
   *         schema:
   *           type: string
   *         description: Google Drive file ID
   *     responses:
   *       200:
   *         description: File content
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 name:
   *                   type: string
   *                 mimeType:
   *                   type: string
   *                 content:
   *                   type: string
   */
  router.get('/drive/files/:fileId', requireAuth, async (req, res) => {
    try {
      const { fileId } = req.params
      const userEmail = req.userEmail

      if (!userEmail) {
        return res.status(401).json({ error: 'User not authenticated' })
      }

      // Get tokens from token store (not session)
      const googleTokens = await tokenStore.getTokens(userEmail)
      if (!googleTokens) {
        return res.status(401).json({ error: 'Not authenticated with Google Drive' })
      }

      const oauth2Client = getOAuthClient()
      oauth2Client.setCredentials(googleTokens)

      const drive = google.drive({ version: 'v3', auth: oauth2Client })

      // Get file metadata
      const fileMetadata = await drive.files.get({
        fileId,
        fields: 'name, mimeType'
      })

      const { name, mimeType } = fileMetadata.data

      // Export Google Workspace files to appropriate format
      let content
      if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        // Export Google Sheets as CSV
        const response = await drive.files.export({
          fileId,
          mimeType: 'text/csv'
        }, { responseType: 'text' })
        content = response.data
      } else if (mimeType === 'application/vnd.google-apps.document') {
        // Export Google Docs as plain text
        const response = await drive.files.export({
          fileId,
          mimeType: 'text/plain'
        }, { responseType: 'text' })
        content = response.data
      } else {
        // Download binary files (CSV, XLSX, etc.)
        const response = await drive.files.get({
          fileId,
          alt: 'media'
        }, { responseType: 'text' })
        content = response.data
      }

      res.json({
        name,
        mimeType,
        content
      })
    } catch (error) {
      console.error('Error downloading file from Drive:', error)
      res.status(500).json({ error: error.message })
    }
  })

  /**
   * @openapi
   * /api/modules/customer-insights/spreadsheet/config:
   *   get:
   *     summary: Get configured Google Spreadsheet ID
   *     tags: [Customer Insights]
   *     responses:
   *       200:
   *         description: Current spreadsheet configuration
   */
  router.get('/spreadsheet/config', requireAuth, async (req, res) => {
    const userEmail = req.userEmail
    if (!userEmail) {
      return res.json({ spreadsheetId: null, spreadsheetName: null })
    }
    const config = await tokenStore.getSpreadsheetConfig(userEmail)
    res.json(config || { spreadsheetId: null, spreadsheetName: null })
  })

  /**
   * @openapi
   * /api/modules/customer-insights/spreadsheet/config:
   *   post:
   *     summary: Set Google Spreadsheet ID for interactions storage
   *     tags: [Customer Insights]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               spreadsheetId:
   *                 type: string
   *               spreadsheetName:
   *                 type: string
   *     responses:
   *       200:
   *         description: Configuration saved
   */
  router.post('/spreadsheet/config', requireAuth, async (req, res) => {
    const userEmail = req.userEmail
    if (!userEmail) {
      return res.status(401).json({ error: 'Not authenticated' })
    }
    const { spreadsheetId, spreadsheetName } = req.body
    await tokenStore.saveSpreadsheetConfig(userEmail, spreadsheetId, spreadsheetName)
    res.json({ success: true })
  })
}
