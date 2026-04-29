const crypto = require('crypto')

const STORAGE_KEY = 'release-planning/audit-log.json'
const MAX_ENTRIES = 5000

function generateId() {
  return 'audit-' + Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex')
}

function logAudit(readFromStorage, writeToStorage, entry) {
  try {
    const log = readFromStorage(STORAGE_KEY) || { entries: [] }

    log.entries.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      version: entry.version || null,
      action: entry.action,
      user: entry.user,
      summary: entry.summary,
      details: entry.details || null
    })

    if (log.entries.length > MAX_ENTRIES) {
      log.entries = log.entries.slice(log.entries.length - MAX_ENTRIES)
    }

    writeToStorage(STORAGE_KEY, log)
  } catch (err) {
    console.error('[audit-log] Failed to write audit entry:', err.message)
  }
}

function getAuditLog(readFromStorage, options) {
  const log = readFromStorage(STORAGE_KEY) || { entries: [] }
  let entries = log.entries

  if (options && options.version) {
    entries = entries.filter(function(e) { return e.version === options.version })
  }

  if (options && options.action) {
    entries = entries.filter(function(e) { return e.action === options.action })
  }

  const total = entries.length

  // Newest first
  entries = entries.slice().reverse()

  const limit = (options && options.limit) || 100
  const offset = (options && options.offset) || 0
  entries = entries.slice(offset, offset + limit)

  return { entries: entries, total: total }
}

module.exports = { logAudit, getAuditLog }
