const { google } = require('googleapis')
const crypto = require('crypto')

/**
 * Google Drive OAuth routes for per-user authentication.
 * Users authenticate with their own Google accounts to access Drive files.
 *
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerGoogleDriveAuthRoutes(router, context) {
  const { secrets } = context

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
  router.get('/auth/google', (req, res) => {
    try {
      const oauth2Client = getOAuthClient()

      // Generate state token for CSRF protection
      const state = crypto.randomBytes(32).toString('hex')
      req.session.oauthState = state

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Get refresh token
        scope: ['https://www.googleapis.com/auth/drive.readonly'],
        state,
        prompt: 'consent' // Force consent screen to get refresh token
      })

      res.redirect(authUrl)
    } catch (error) {
      console.error('Error initiating Google OAuth:', error)
      res.status(500).send(`
        <html>
          <body>
            <h1>Error</h1>
            <p>${error.message}</p>
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
      if (!state || state !== req.session.oauthState) {
        throw new Error('Invalid state token. Possible CSRF attack.')
      }

      // Clear state token
      delete req.session.oauthState

      const oauth2Client = getOAuthClient()

      // Exchange authorization code for tokens
      const { tokens } = await oauth2Client.getToken(code)

      // Store tokens in session (HTTP-only cookie)
      req.session.googleTokens = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date
      }

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
                window.opener.postMessage({ type: 'google-oauth-success' }, '*')
              }
              // Auto-close after 2 seconds
              setTimeout(() => window.close(), 2000)
            </script>
          </body>
        </html>
      `)
    } catch (error) {
      console.error('Error in Google OAuth callback:', error)
      res.send(`
        <html>
          <head>
            <title>Connection Failed</title>
          </head>
          <body>
            <h1>✗ Connection Failed</h1>
            <p>${error.message}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'google-oauth-error', error: '${error.message}' }, '*')
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
  router.get('/auth/google/status', (req, res) => {
    const connected = !!(req.session.googleTokens?.access_token)
    res.json({ connected })
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
  router.post('/auth/google/disconnect', (req, res) => {
    delete req.session.googleTokens
    res.json({ success: true })
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
  router.get('/drive/files/:fileId', async (req, res) => {
    try {
      const { fileId } = req.params

      if (!req.session.googleTokens) {
        return res.status(401).json({ error: 'Not authenticated with Google Drive' })
      }

      const oauth2Client = getOAuthClient()
      oauth2Client.setCredentials(req.session.googleTokens)

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
}
