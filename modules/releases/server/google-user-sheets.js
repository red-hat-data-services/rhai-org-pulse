'use strict'

const { google } = require('googleapis')

const USER_TOKEN_KEY = 'customer-insights/user-tokens.json'

function findUserTokens(allTokens, userEmail) {
  if (!userEmail) return null
  const normalizedEmail = userEmail.toLowerCase()
  return allTokens[userEmail] || allTokens[normalizedEmail] || Object.entries(allTokens)
    .find(([email]) => email.toLowerCase() === normalizedEmail)?.[1] || null
}

async function listConnectedGoogleUsers(storage) {
  const allTokens = await storage.readFromStorage(USER_TOKEN_KEY) || {}
  return Object.entries(allTokens)
    .filter(([, tokens]) => tokens?.access_token || tokens?.refresh_token)
    .map(([email]) => email)
}

async function createGoogleUserSheetsClient({ secrets, storage, userEmail }) {
  const clientId = secrets.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = secrets.GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Google OAuth credentials are not configured')

  const allTokens = await storage.readFromStorage(USER_TOKEN_KEY) || {}
  const tokens = findUserTokens(allTokens, userEmail)
  if (!tokens?.access_token && !tokens?.refresh_token) {
    throw new Error(`Google is not connected for ${userEmail}`)
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials(tokens)
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

module.exports = { createGoogleUserSheetsClient, findUserTokens, listConnectedGoogleUsers }
