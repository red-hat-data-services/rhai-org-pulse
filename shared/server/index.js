const storage = require('./storage')
const demoStorage = require('./demo-storage')
const { createAuthMiddleware, proxySecretGuard } = require('./auth')
const googleSheets = require('./google-sheets')
const roster = require('./roster')
const rosterSync = require('./roster-sync')

module.exports = {
  storage,
  demoStorage,
  createAuthMiddleware,
  proxySecretGuard,
  googleSheets,
  roster,
  rosterSync
}
