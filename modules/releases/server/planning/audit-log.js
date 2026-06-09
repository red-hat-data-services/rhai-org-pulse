const crypto = require('crypto')

const STORAGE_KEY = 'releases/audit-log.json'
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
      domain: entry.domain || 'planning',
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

  if (options && options.domain) {
    entries = entries.filter(function(e) { return e.domain === options.domain })
  }

  const total = entries.length

  // Newest first
  entries = entries.slice().reverse()

  const limit = (options && options.limit) || 100
  const offset = (options && options.offset) || 0
  entries = entries.slice(offset, offset + limit)

  return { entries: entries, total: total }
}

function computeFieldDiff(before, after) {
  if (!before || !after) return null
  var diff = {}
  var allKeys = Object.keys(before)
  var afterKeys = Object.keys(after)
  for (var i = 0; i < afterKeys.length; i++) {
    if (allKeys.indexOf(afterKeys[i]) === -1) allKeys.push(afterKeys[i])
  }
  for (var j = 0; j < allKeys.length; j++) {
    var key = allKeys[j]
    var oldVal = before[key]
    var newVal = after[key]
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diff[key] = { from: oldVal, to: newVal }
    }
  }
  return Object.keys(diff).length > 0 ? diff : null
}

module.exports = { logAudit, getAuditLog, computeFieldDiff }
