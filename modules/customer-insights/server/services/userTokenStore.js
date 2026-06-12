/**
 * User token storage for Google OAuth tokens
 * Uses storage abstractions to respect demo mode and PVC mounts
 */

// Storage will be injected via createUserTokenStore factory
let storage = null

/**
 * Create a user token store with the given storage backend
 * @param {object} storageBackend - { readFromStorage, writeToStorage }
 * @returns {object} Token store methods
 */
function createUserTokenStore(storageBackend) {
  storage = storageBackend
  const { readFromStorage, writeToStorage } = storage

  const TOKEN_KEY = 'customer-insights/user-tokens.json'

  /**
   * Get tokens for a user
   * @param {string} userEmail
   * @returns {Promise<object|null>}
   */
  async function getTokens(userEmail) {
    const allTokens = readFromStorage(TOKEN_KEY) || {}
    return allTokens[userEmail] || null
  }

  /**
   * Save tokens for a user
   * @param {string} userEmail
   * @param {object} tokens
   */
  async function saveTokens(userEmail, tokens) {
    const allTokens = readFromStorage(TOKEN_KEY) || {}

    allTokens[userEmail] = {
      ...tokens,
      updatedAt: new Date().toISOString()
    }

    writeToStorage(TOKEN_KEY, allTokens)
  }

  /**
   * Delete tokens for a user
   * @param {string} userEmail
   */
  async function deleteTokens(userEmail) {
    const allTokens = readFromStorage(TOKEN_KEY) || {}
    delete allTokens[userEmail]
    writeToStorage(TOKEN_KEY, allTokens)
  }

  /**
   * Get spreadsheet config for a user
   * @param {string} userEmail
   * @returns {Promise<object|null>}
   */
  async function getSpreadsheetConfig(userEmail) {
    const tokens = await getTokens(userEmail)
    return tokens ? {
      spreadsheetId: tokens.spreadsheetId || null,
      spreadsheetName: tokens.spreadsheetName || null
    } : null
  }

  /**
   * Save spreadsheet config for a user
   * @param {string} userEmail
   * @param {string} spreadsheetId
   * @param {string} spreadsheetName
   */
  async function saveSpreadsheetConfig(userEmail, spreadsheetId, spreadsheetName) {
    const tokens = await getTokens(userEmail) || {}
    tokens.spreadsheetId = spreadsheetId
    tokens.spreadsheetName = spreadsheetName
    await saveTokens(userEmail, tokens)
  }

  return {
    getTokens,
    saveTokens,
    deleteTokens,
    getSpreadsheetConfig,
    saveSpreadsheetConfig
  }
}

module.exports = { createUserTokenStore }
