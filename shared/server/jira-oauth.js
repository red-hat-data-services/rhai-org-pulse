const crypto = require('crypto')
const fetch = require('node-fetch')

/**
 * Register Jira OAuth 2.0 (3LO) routes for per-user authentication.
 *
 * Users authenticate with their own Atlassian accounts to create Jira issues.
 * Tokens are stored in HTTP-only session cookies.
 *
 * @param {import('express').Router} router - Express router
 * @param {object} options - Configuration options
 * @param {string} options.clientId - Jira OAuth client ID
 * @param {string} options.clientSecret - Jira OAuth client secret
 * @param {string} [options.callbackUrl] - OAuth callback URL (defaults to current host)
 * @param {string[]} [options.scopes] - OAuth scopes (defaults to ['write:jira-work', 'read:jira-user', 'offline_access'])
 */
function registerJiraOAuthRoutes(router, options) {
  const {
    clientId,
    clientSecret,
    callbackUrl,
    scopes = ['write:jira-work', 'read:jira-user', 'offline_access']
  } = options

  if (!clientId || !clientSecret) {
    throw new Error('Jira OAuth requires clientId and clientSecret')
  }

  const AUTHORIZATION_URL = 'https://auth.atlassian.com/authorize'
  const TOKEN_URL = 'https://auth.atlassian.com/oauth/token'
  const RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources'

  /**
   * @openapi
   * /auth/jira:
   *   get:
   *     summary: Initiate Jira OAuth flow
   *     tags: [Jira OAuth]
   *     responses:
   *       302:
   *         description: Redirects to Atlassian OAuth consent screen
   */
  router.get('/auth/jira', (req, res) => {
    try {
      // Generate CSRF protection state token
      const state = crypto.randomBytes(32).toString('hex')
      req.session.jiraOauthState = state

      // Build callback URL
      const callback = callbackUrl || `${req.protocol}://${req.get('host')}${req.baseUrl}/auth/jira/callback`

      // Build authorization URL
      const params = new URLSearchParams({
        audience: 'api.atlassian.com',
        client_id: clientId,
        scope: scopes.join(' '),
        redirect_uri: callback,
        state,
        response_type: 'code',
        prompt: 'consent'
      })

      const authUrl = `${AUTHORIZATION_URL}?${params}`
      res.redirect(authUrl)
    } catch (error) {
      console.error('Error initiating Jira OAuth:', error)
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
   * /auth/jira/callback:
   *   get:
   *     summary: Handle Jira OAuth callback
   *     tags: [Jira OAuth]
   *     parameters:
   *       - in: query
   *         name: code
   *         schema:
   *           type: string
   *         description: Authorization code from Atlassian
   *       - in: query
   *         name: state
   *         schema:
   *           type: string
   *         description: CSRF protection state token
   *     responses:
   *       200:
   *         description: OAuth successful, closes popup window
   */
  router.get('/auth/jira/callback', async (req, res) => {
    try {
      const { code, state } = req.query

      // Validate state token (CSRF protection)
      if (!state || state !== req.session.jiraOauthState) {
        throw new Error('Invalid state token. Possible CSRF attack.')
      }

      // Clear state token
      delete req.session.jiraOauthState

      if (!code) {
        throw new Error('No authorization code received')
      }

      // Build callback URL
      const callback = callbackUrl || `${req.protocol}://${req.get('host')}${req.baseUrl}/auth/jira/callback`

      // Exchange authorization code for tokens
      const tokenResponse = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: callback
        })
      })

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        throw new Error(`Token exchange failed: ${errorText}`)
      }

      const tokens = await tokenResponse.json()

      // Get accessible resources (cloud IDs)
      const resourcesResponse = await fetch(RESOURCES_URL, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Accept': 'application/json'
        }
      })

      if (!resourcesResponse.ok) {
        const errorText = await resourcesResponse.text()
        throw new Error(`Failed to fetch accessible resources: ${errorText}`)
      }

      const resources = await resourcesResponse.json()

      if (!resources || resources.length === 0) {
        throw new Error('No accessible Jira sites found for this user')
      }

      // Store tokens and cloud ID in session
      req.session.jiraTokens = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        expires_at: Date.now() + (tokens.expires_in * 1000),
        scope: tokens.scope
      }

      // Store the first accessible resource (cloud ID)
      // In multi-site scenarios, you might want to let user choose
      req.session.jiraCloudId = resources[0].id
      req.session.jiraSiteName = resources[0].name
      req.session.jiraSiteUrl = resources[0].url

      // Sanitize site name for HTML and JS contexts
      const siteName = resources[0].name
      const siteNameHtml = String(siteName)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
      const siteNameJs = JSON.stringify(siteName)

      // Close popup and notify parent window
      res.send(`
        <html>
          <head>
            <title>Jira Connected</title>
          </head>
          <body>
            <h1>✓ Jira Connected</h1>
            <p>Connected to ${siteNameHtml}</p>
            <p>You can close this window.</p>
            <script>
              // Notify parent window
              if (window.opener) {
                window.opener.postMessage({
                  type: 'jira-oauth-success',
                  siteName: ${siteNameJs}
                }, window.location.origin)
              }
              // Auto-close after 2 seconds
              setTimeout(() => window.close(), 2000)
            </script>
          </body>
        </html>
      `)
    } catch (error) {
      console.error('Error in Jira OAuth callback:', error)
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
                window.opener.postMessage({
                  type: 'jira-oauth-error',
                  error: '${jsEscapedMessage}'
                }, window.location.origin)
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
   * /auth/jira/status:
   *   get:
   *     summary: Check if user has connected Jira
   *     tags: [Jira OAuth]
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
   *                 siteName:
   *                   type: string
   *                 siteUrl:
   *                   type: string
   */
  router.get('/auth/jira/status', (req, res) => {
    const connected = !!(req.session.jiraTokens?.access_token)
    res.json({
      connected,
      siteName: req.session.jiraSiteName || null,
      siteUrl: req.session.jiraSiteUrl || null
    })
  })

  /**
   * @openapi
   * /auth/jira/disconnect:
   *   post:
   *     summary: Disconnect Jira (revoke tokens)
   *     tags: [Jira OAuth]
   *     responses:
   *       200:
   *         description: Successfully disconnected
   */
  router.post('/auth/jira/disconnect', (req, res) => {
    delete req.session.jiraTokens
    delete req.session.jiraCloudId
    delete req.session.jiraSiteName
    delete req.session.jiraSiteUrl
    res.json({ success: true })
  })

  /**
   * Helper function to get a valid Jira client for the current user
   * Handles token refresh if needed
   *
   * @param {object} req - Express request object
   * @returns {Promise<{ jiraRequest: Function, cloudId: string }>}
   */
  async function getJiraClient(req) {
    if (!req.session.jiraTokens) {
      throw new Error('Not authenticated with Jira. Please connect your Jira account first.')
    }

    let tokens = req.session.jiraTokens

    // Check if token needs refresh
    if (Date.now() >= tokens.expires_at - 60000) { // Refresh 1 min before expiry
      if (!tokens.refresh_token) {
        throw new Error('Access token expired and no refresh token available. Please re-authenticate.')
      }

      // Refresh the token
      const refreshResponse = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokens.refresh_token
        })
      })

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text()
        // Clear invalid tokens
        delete req.session.jiraTokens
        throw new Error(`Token refresh failed: ${errorText}. Please re-authenticate.`)
      }

      const newTokens = await refreshResponse.json()

      // Update session with new tokens (rotating refresh token!)
      tokens = {
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token, // New refresh token!
        expires_in: newTokens.expires_in,
        expires_at: Date.now() + (newTokens.expires_in * 1000),
        scope: newTokens.scope
      }
      req.session.jiraTokens = tokens
    }

    const cloudId = req.session.jiraCloudId
    if (!cloudId) {
      throw new Error('No Jira cloud ID found. Please re-authenticate.')
    }

    const accessToken = tokens.access_token

    // Return a jiraRequest function that uses OAuth token
    async function jiraRequest(endpoint, { method = 'GET', body } = {}) {
      // Jira API via Atlassian gateway requires cloud ID in path
      const baseUrl = `https://api.atlassian.com/ex/jira/${cloudId}`
      const url = endpoint.startsWith('/') ? `${baseUrl}${endpoint}` : `${baseUrl}/${endpoint}`

      const options = {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }

      if (body) {
        options.headers['Content-Type'] = 'application/json'
        options.body = JSON.stringify(body)
      }

      const response = await fetch(url, options)

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Jira API error (${response.status}): ${text}`)
      }

      return response.json()
    }

    return { jiraRequest, cloudId }
  }

  // Export helper for use in route handlers
  router.getJiraClient = getJiraClient

  return router
}

module.exports = { registerJiraOAuthRoutes }
