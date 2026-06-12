const { google } = require('googleapis')
const { readFromStorage, writeToStorage } = require('../../../../shared/server')

const TOKEN_FILE = 'customer-insights/google-token.json'

let clientInstance = null

/**
 * Get or create Google OAuth2 client
 * @param {object} secrets - Module secrets from context
 * @param {object} storage - Storage functions (readFromStorage, writeToStorage)
 * @returns {Promise<import('googleapis').Auth.OAuth2Client>}
 */
async function getAuthClient(secrets, storage = { readFromStorage, writeToStorage }) {
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
    const tokenData = await storage.readFromStorage(TOKEN_FILE)
    token = JSON.parse(tokenData)
  } catch (cause) {
    throw new Error(
      'Google Sheets not authenticated. Token not found at: ' + TOKEN_FILE +
      '\nRun authentication script to generate token (see docs/MODULES.md)',
      { cause }
    )
  }

  oauth2.setCredentials(token)

  // Auto-refresh token and save
  oauth2.on('tokens', async (newTokens) => {
    const merged = { ...token, ...newTokens }
    try {
      await storage.writeToStorage(TOKEN_FILE, JSON.stringify(merged, null, 2))
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
