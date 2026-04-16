/**
 * Must-gather diagnostic data collector.
 *
 * Assembles a single JSON bundle containing everything needed to debug
 * a reported problem — connectivity, configuration, data health, and
 * module-specific diagnostics.
 */

const fs = require('fs')
const path = require('path')
const buildInfo = require('./build-info')
const errorBuffer = require('./error-buffer')
const requestTracker = require('./request-tracker')
const { buildMapping } = require('../shared/server/anonymize')

/**
 * Collect the full diagnostic bundle.
 *
 * @param {object} options
 * @param {object} options.storageModule - shared storage module
 * @param {object[]} options.builtInModules - discovered built-in modules
 * @param {Set} options.enabledSlugs - set of enabled module slugs
 * @param {Function} options.collectModuleDiagnostics - from module-loader
 * @param {object} options.diagnosticsRegistry - slug -> async fn
 * @param {object} options.gitSync - git-sync module for static module status
 * @param {string} options.redact - 'minimal' or 'aggressive'
 */
async function collect(options) {
  const {
    storageModule,
    builtInModules,
    enabledSlugs,
    collectModuleDiagnostics,
    diagnosticsRegistry,
    gitSync,
    redact = 'minimal'
  } = options

  const bundle = {}

  // 1. Build info
  bundle.buildInfo = { ...buildInfo }

  // 2. Timestamp
  bundle.collectedAt = new Date().toISOString()
  bundle.redactionLevel = redact

  // 3. System info
  bundle.system = collectSystemInfo(storageModule)

  // 4. Built-in modules
  bundle.builtInModules = collectBuiltInModuleInfo(builtInModules, enabledSlugs)

  // 5. Storage info
  bundle.storage = collectStorageInfo(storageModule)

  // 6. Allowlist
  bundle.allowlist = collectAllowlistInfo(storageModule)

  // 7. Git-static modules
  bundle.gitStaticModules = collectGitStaticInfo(storageModule, gitSync)

  // 8. Module diagnostics
  if (collectModuleDiagnostics) {
    bundle.modules = await collectModuleDiagnostics(builtInModules, diagnosticsRegistry, enabledSlugs)
  }

  // 9. Request stats
  const snapshot = requestTracker.getSnapshot()
  bundle.requestStats = {
    bufferSize: snapshot.bufferSize,
    totalTracked: snapshot.totalTracked,
    uptimeSecs: snapshot.uptimeSecs,
    summary: requestTracker.getSummary(snapshot.entries),
    recentErrors: requestTracker.getRecentErrors(snapshot.entries)
  }

  // 10. Recent errors
  bundle.recentErrors = errorBuffer.getEntries()

  // 11. Redact
  return redactBundle(bundle, redact, storageModule)
}

function collectSystemInfo() {
  const mem = process.memoryUsage()
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(process.uptime()),
    memoryUsage: {
      rss: formatBytes(mem.rss),
      heapUsed: formatBytes(mem.heapUsed),
      heapTotal: formatBytes(mem.heapTotal)
    },
    env: {
      DEMO_MODE: process.env.DEMO_MODE || 'false',
      JIRA_HOST: process.env.JIRA_HOST || 'https://redhat.atlassian.net',
      JIRA_EMAIL_SET: !!process.env.JIRA_EMAIL,
      JIRA_TOKEN_SET: !!process.env.JIRA_TOKEN,
      GITHUB_TOKEN_SET: !!process.env.GITHUB_TOKEN,
      GITLAB_TOKEN_SET: !!process.env.GITLAB_TOKEN,
      GITLAB_BASE_URL: process.env.GITLAB_BASE_URL || 'https://gitlab.com',
      GOOGLE_SERVICE_ACCOUNT_KEY_FILE: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || '/etc/secrets/google-sa-key.json',
      GOOGLE_SA_KEY_EXISTS: checkFileExists(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || '/etc/secrets/google-sa-key.json'),
      NODE_ENV: process.env.NODE_ENV || 'development',
      API_PORT: process.env.API_PORT || '3001'
    }
  }
}

function collectBuiltInModuleInfo(builtInModules, enabledSlugs) {
  const enabledState = {}
  const moduleManifests = {}

  for (const mod of builtInModules) {
    enabledState[mod.slug] = enabledSlugs.has(mod.slug)
    moduleManifests[mod.slug] = {
      name: mod.name,
      slug: mod.slug,
      description: mod.description,
      icon: mod.icon,
      order: mod.order,
      requires: mod.requires,
      defaultEnabled: mod.defaultEnabled,
      hasClient: !!mod.client?.entry,
      hasServer: !!mod.server?.entry
    }
  }

  return {
    discovered: builtInModules.map(function(m) { return m.slug }),
    enabledState,
    moduleManifests
  }
}

function collectStorageInfo(storageModule) {
  const dataDir = storageModule.DATA_DIR
  const result = {
    dataDir,
    exists: false,
    writable: false,
    topLevelFiles: [],
    directories: [],
    totalFileCount: 0,
    diskUsageBytes: 0
  }

  try {
    if (!fs.existsSync(dataDir)) return result
    result.exists = true

    // Check writable
    try {
      fs.accessSync(dataDir, fs.constants.W_OK)
      result.writable = true
    } catch { /* not writable */ }

    // List top-level entries
    const entries = fs.readdirSync(dataDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        result.directories.push(entry.name)
      } else {
        result.topLevelFiles.push(entry.name)
      }
    }

    // Count files and compute rough disk usage
    const stats = countFilesRecursive(dataDir)
    result.totalFileCount = stats.count
    result.diskUsageBytes = stats.bytes
  } catch { /* ignore */ }

  return result
}

function collectAllowlistInfo(storageModule) {
  const data = storageModule.readFromStorage('allowlist.json')
  return {
    emailCount: data?.emails?.length || 0
  }
}

function collectGitStaticInfo(storageModule, gitSync) {
  const result = { count: 0, slugs: [], syncStatus: null }

  try {
    const modulesConfig = require('./modules/config')
    const config = modulesConfig.loadModulesConfig(storageModule) || { modules: [] }
    result.count = config.modules.length
    result.slugs = config.modules.map(function(m) { return m.slug })
    if (gitSync) {
      result.syncStatus = gitSync.getSyncStatus(storageModule)
    }
  } catch { /* ignore */ }

  return result
}

// ─── Redaction ───

function redactBundle(bundle, mode, storageModule) {
  if (mode === 'minimal') {
    return stripSecrets(bundle)
  }

  // Aggressive: build mapping from roster, then walk the tree
  const roster = storageModule.readFromStorage('org-roster-full.json')
  const mapping = roster ? buildMapping(roster) : null
  const stripped = stripSecrets(bundle)
  if (!mapping) return stripped
  return anonymizeTree(stripped, mapping)
}

function stripSecrets(bundle) {
  // Deep clone to avoid mutating original
  const result = JSON.parse(JSON.stringify(bundle))

  // Google Sheet ID — truncate to first 4 chars
  truncateNestedField(result, 'googleSheetId', 4)

  return result
}

function truncateNestedField(obj, fieldName, keepChars) {
  if (!obj || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (const item of obj) truncateNestedField(item, fieldName, keepChars)
    return
  }
  for (const [key, value] of Object.entries(obj)) {
    if (key === fieldName && typeof value === 'string' && value.length > keepChars) {
      obj[key] = value.substring(0, keepChars) + '...(redacted)'
    } else if (typeof value === 'object' && value !== null) {
      truncateNestedField(value, fieldName, keepChars)
    }
  }
}

function anonymizeTree(obj, mapping) {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string') return anonymizeString(obj, mapping)
  if (Array.isArray(obj)) {
    return obj.map(function(item) { return anonymizeTree(item, mapping) })
  }
  if (typeof obj !== 'object') return obj

  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    // Special handling for known fields
    if (key === 'googleSheetId' && typeof value === 'string') {
      result[key] = 'placeholder-sheet-id'
    } else if (key === 'orgRootUids' && Array.isArray(value)) {
      result[key] = value.map(function(uid) { return mapping.getOrCreateUidMapping(uid) })
    } else {
      // Anonymize the key itself if it's a known PII value (e.g., object keyed by person name)
      const anonKey = anonymizeString(key, mapping)
      result[anonKey] = anonymizeTree(value, mapping)
    }
  }
  return result
}

function anonymizeString(value, mapping) {
  if (!value || typeof value !== 'string') return value

  // Try direct lookup first
  const direct = mapping.anonymizeValue(value)
  if (direct !== value) return direct

  // Check accountId mapping
  if (mapping.accountIdToFake[value]) return mapping.accountIdToFake[value]

  // Try to anonymize composite keys (e.g., "OrgDisplayName::TeamName")
  // Only the org part (before ::) may contain a person name; team names are kept
  if (value.includes('::')) {
    const sepIdx = value.indexOf('::')
    const orgPart = value.substring(0, sepIdx)
    const teamPart = value.substring(sepIdx + 2)
    const anonOrg = mapping.anonymizeValue(orgPart)
    const resolvedOrg = anonOrg !== orgPart ? anonOrg : mapping.getOrCreateNameMapping(orgPart)
    return resolvedOrg + '::' + teamPart
  }

  // Try to anonymize request paths
  const pathResult = anonymizePath(value, mapping)
  if (pathResult !== value) return pathResult

  // Best-effort scrub: iterate over mapping tables for substring replacements
  let scrubbed = value
  const tables = [
    mapping.nameToFake,
    mapping.emailToFake,
    mapping.uidToFake,
    mapping.githubToFake,
    mapping.gitlabToFake,
    mapping.accountIdToFake
  ]
  for (const table of tables) {
    for (const [real, fake] of Object.entries(table)) {
      if (real && scrubbed.includes(real)) {
        scrubbed = scrubbed.split(real).join(fake)
      }
    }
  }
  return scrubbed
}

function anonymizePath(value, mapping) {
  // Match API paths with PII segments
  const patterns = [
    { re: /^\/api\/person\/([^/]+)(.*)$/, fn: function(m) { return '/api/person/' + mapping.getOrCreateNameMapping(decodeURIComponent(m[1])) + m[2] } },
    { re: /^\/api\/modules\/team-tracker\/person\/([^/]+)(.*)$/, fn: function(m) { return '/api/modules/team-tracker/person/' + mapping.getOrCreateNameMapping(decodeURIComponent(m[1])) + m[2] } },
    { re: /^\/api\/github\/contributions\/([^/]+)(.*)$/, fn: function(m) { return '/api/github/contributions/' + mapping.getOrCreateGithubMapping(decodeURIComponent(m[1])) + m[2] } },
    { re: /^\/api\/gitlab\/contributions\/([^/]+)(.*)$/, fn: function(m) { return '/api/gitlab/contributions/' + mapping.getOrCreateGitlabMapping(decodeURIComponent(m[1])) + m[2] } },
    { re: /^\/api\/modules\/team-tracker\/org-teams\/([^/]+)(.*)$/, fn: function(m) { return '/api/modules/team-tracker/org-teams/' + anonymizeTeamKey(decodeURIComponent(m[1]), mapping) + m[2] } },
    { re: /^\/api\/team\/([^/]+)(.*)$/, fn: function(m) { return '/api/team/' + anonymizeTeamKey(decodeURIComponent(m[1]), mapping) + m[2] } }
  ]

  for (const pattern of patterns) {
    const match = value.match(pattern.re)
    if (match) return pattern.fn(match)
  }
  return value
}

function anonymizeTeamKey(teamKey, mapping) {
  // Team keys are "orgDisplay::teamName" — anonymize orgDisplay, keep team name
  const sepIdx = teamKey.indexOf('::')
  if (sepIdx === -1) return teamKey
  const orgPart = teamKey.substring(0, sepIdx)
  const teamPart = teamKey.substring(sepIdx + 2)
  const anonOrg = mapping.anonymizeValue(orgPart) || orgPart
  return anonOrg + '::' + teamPart
}

// ─── Helpers ───

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function checkFileExists(filePath) {
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

function countFilesRecursive(dirPath) {
  let count = 0
  let bytes = 0
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        const sub = countFilesRecursive(full)
        count += sub.count
        bytes += sub.bytes
      } else {
        count++
        try {
          bytes += fs.statSync(full).size
        } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
  return { count, bytes }
}

module.exports = { collect }
