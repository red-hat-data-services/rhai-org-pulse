'use strict'

const { google } = require('googleapis')

const USER_TOKEN_KEY = 'customer-insights/user-tokens.json'

function createGoogleUserTokenStore(storage) {
  async function readAll() {
    return await storage.readFromStorage(USER_TOKEN_KEY) || {}
  }

  return {
    async getTokens(userEmail) {
      if (!userEmail) return null
      const tokens = await readAll()
      return tokens[userEmail.toLowerCase()] || null
    },
    async saveTokens(userEmail, tokens) {
      const email = userEmail.toLowerCase()
      const allTokens = await readAll()
      allTokens[email] = { ...tokens, updatedAt: new Date().toISOString() }
      await storage.writeToStorage(USER_TOKEN_KEY, allTokens)
    },
    async deleteTokens(userEmail) {
      const allTokens = await readAll()
      delete allTokens[userEmail.toLowerCase()]
      await storage.writeToStorage(USER_TOKEN_KEY, allTokens)
    }
  }
}

function createGoogleOAuthClient({ secrets, callbackUrl }) {
  const clientId = secrets.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = secrets.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Google OAuth credentials are not configured')
  return new google.auth.OAuth2(clientId, clientSecret, callbackUrl)
}

function createGoogleUserOAuthClient({ secrets, storage, userEmail, callbackUrl }) {
  const tokenStore = createGoogleUserTokenStore(storage)
  const oauth2Client = createGoogleOAuthClient({ secrets, callbackUrl })

  async function authenticate() {
    const tokens = await tokenStore.getTokens(userEmail)
    if (!tokens?.access_token && !tokens?.refresh_token) {
      throw new Error(`Google is not connected for ${userEmail}`)
    }
    oauth2Client.setCredentials(tokens)
    oauth2Client.on('tokens', async refreshedTokens => {
      await tokenStore.saveTokens(userEmail, { ...tokens, ...refreshedTokens })
    })
    return oauth2Client
  }

  return { oauth2Client, authenticate, tokenStore }
}

async function createGoogleUserSheetsClient(options) {
  const { authenticate } = createGoogleUserOAuthClient(options)
  const auth = await authenticate()
  const sheets = google.sheets({ version: 'v4', auth })
  return {
    async fetchRawSheet(sheetId, sheetName) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${sheetName}'`,
        valueRenderOption: 'UNFORMATTED_VALUE'
      })
      const values = response.data.values || []
      if (!values.length) return { headers: [], rows: [] }
      const headers = values[0].map(value => typeof value === 'string' ? value.trim() : String(value || ''))
      return { headers, rows: values.slice(1) }
    }
  }
}

module.exports = {
  USER_TOKEN_KEY,
  createGoogleUserTokenStore,
  createGoogleOAuthClient,
  createGoogleUserOAuthClient,
  createGoogleUserSheetsClient
}
