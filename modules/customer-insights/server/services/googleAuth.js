const { google } = require('googleapis')
const fs = require('fs').promises
const path = require('path')

const TOKEN_PATH = path.join(__dirname, '..', '..', '..', '..', 'data', 'customer-insights-google-token.json')

let clientInstance = null

/**
 * Get or create Google OAuth2 client
 * @param {object} secrets - Module secrets from context
 * @returns {Promise<import('googleapis').Auth.OAuth2Client>}
 */
async function getAuthClient(secrets) {
  if (clientInstance) return clientInstance

  const clientId = secrets.GOOGLE_CLIENT_ID
  const clientSecret = secrets.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in module secrets')
  }

  const oauth2 = new google.auth.OAuth2(
    clientId,
    clientSecret,
    'http://localhost:3456/callback'
  )

  // Try to load existing token
  let token
  try {
    const tokenData = await fs.readFile(TOKEN_PATH, 'utf-8')
    token = JSON.parse(tokenData)
  } catch (cause) {
    throw new Error(
      'Google Sheets not authenticated. Token not found at: ' + TOKEN_PATH +
      '\nRun authentication script to generate token (see docs/MODULES.md)',
      { cause }
    )
  }

  oauth2.setCredentials(token)

  // Auto-refresh token and save
  oauth2.on('tokens', async (newTokens) => {
    const merged = { ...token, ...newTokens }
    try {
      await fs.mkdir(path.dirname(TOKEN_PATH), { recursive: true })
      await fs.writeFile(TOKEN_PATH, JSON.stringify(merged, null, 2), 'utf-8')
      token = merged
    } catch (err) {
      console.error('Failed to save refreshed Google token:', err)
    }
  })

  clientInstance = oauth2
  return oauth2
}

module.exports = {
  getAuthClient,
}
