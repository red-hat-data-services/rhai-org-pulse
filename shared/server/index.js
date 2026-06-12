const storage = require('./storage')
const demoStorage = require('./demo-storage')
const { createAuthMiddleware, proxySecretGuard } = require('./auth')
const googleSheets = require('./google-sheets')
const roster = require('./roster')
const rosterSync = require('./roster-sync')
const jira = require('./jira')
const jiraOAuth = require('./jira-oauth')
const permissions = require('./permissions')
const { createRoleStore, normalizeEmail } = require('./role-store')

module.exports = {
  storage,
  demoStorage,
  createAuthMiddleware,
  proxySecretGuard,
  createRoleStore,
  normalizeEmail,
  googleSheets,
  roster,
  rosterSync,
  jira,
  jiraOAuth,
  permissions
}
