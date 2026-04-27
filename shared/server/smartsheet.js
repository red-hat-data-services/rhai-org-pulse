/**
 * SmartSheet REST API client for release version discovery.
 *
 * Ports the release milestone extraction logic from the release-pulse
 * Python client (smartsheet_client.py). Uses Node.js built-in https
 * module -- no npm dependency needed.
 *
 * Matches the same four row patterns and 6-milestone completeness check
 * as the Python client:
 *   - EA1/EA2 Code Freeze
 *   - EA1/EA2 RELEASE
 *   - GA Code Freeze
 *   - GA Release
 *
 * Only surfaces versions with all 6 required milestones (ea1_freeze,
 * ea1_target, ea2_freeze, ea2_target, ga_freeze, ga_target).
 *
 * Cache TTL: 1 hour (same as Python client).
 */

var https = require('https')

var CACHE_TTL = 3600 * 1000 // 1 hour in milliseconds
var cache = { data: null, fetchedAt: 0 }

var SMARTSHEET_SHEET_ID = process.env.SMARTSHEET_SHEET_ID || '3025228340193156'
var SMARTSHEET_API_TOKEN = process.env.SMARTSHEET_API_TOKEN || ''

function isConfigured() {
  return !!SMARTSHEET_API_TOKEN
}

async function fetchSheet() {
  if (!SMARTSHEET_API_TOKEN) {
    throw Object.assign(
      new Error('SmartSheet integration is not available. SMARTSHEET_API_TOKEN is not configured.'),
      { statusCode: 503 }
    )
  }

  var now = Date.now()
  if (cache.data && (now - cache.fetchedAt) < CACHE_TTL) {
    return cache.data
  }

  var url = 'https://api.smartsheet.com/2.0/sheets/' + SMARTSHEET_SHEET_ID
  var data = await httpGet(url, {
    'Authorization': 'Bearer ' + SMARTSHEET_API_TOKEN
  })

  cache = { data: data, fetchedAt: now }
  return data
}

var REQUIRED_MILESTONES = ['ea1_freeze', 'ea1_target', 'ea2_freeze', 'ea2_target', 'ga_freeze', 'ga_target']

/**
 * Private helper -- shared sheet-fetch-and-parse logic used by all
 * discoverReleases* functions.  Parses the Smartsheet rows for milestone
 * dates, filters versions via the supplied predicate, and returns the
 * full milestone object per version.
 *
 * @param {Function} filterFn - Predicate receiving a milestones object; return true to include
 * @returns {Promise<Array<{ version: string, ea1Freeze: string|null, ea1Target: string|null, ea2Freeze: string|null, ea2Target: string|null, gaFreeze: string|null, gaTarget: string|null }>>}
 */
async function parseSmartsheetReleases(filterFn) {
  var sheet = await fetchSheet()

  var colMap = {}
  for (var c = 0; c < sheet.columns.length; c++) {
    colMap[sheet.columns[c].title] = sheet.columns[c].id
  }
  var taskCol = colMap['Task Name']
  var startCol = colMap['Start']

  var milestones = {}

  for (var r = 0; r < sheet.rows.length; r++) {
    var row = sheet.rows[r]
    var cells = {}
    for (var ci = 0; ci < row.cells.length; ci++) {
      cells[row.cells[ci].columnId] = row.cells[ci].value
    }
    var task = cells[taskCol]
    var startVal = cells[startCol]
    if (!task || !startVal) continue

    var dateStr = String(startVal).split('T')[0]
    var m

    m = task.match(/^(\d+\.\d+)\.(EA[12])\s+(?:RHOAI\s+)?Code\s+Freeze/i)
    if (m) {
      if (!milestones[m[1]]) milestones[m[1]] = {}
      milestones[m[1]][m[2].toLowerCase() + '_freeze'] = dateStr
      continue
    }
    m = task.match(/^(\d+\.\d+)\.(EA[12])\s+(?:RHOAI\s+)?RELEASE/i)
    if (m) {
      if (!milestones[m[1]]) milestones[m[1]] = {}
      milestones[m[1]][m[2].toLowerCase() + '_target'] = dateStr
      continue
    }
    m = task.match(/^(\d+\.\d+)\s+(?:RHOAI\s+)?Code\s+Freeze$/i)
    if (m) {
      if (!milestones[m[1]]) milestones[m[1]] = {}
      milestones[m[1]].ga_freeze = dateStr
      continue
    }
    m = task.match(/^(\d+\.\d+)\s+(?:RHOAI\s+)?GA$/i)
    if (m) {
      if (!milestones[m[1]]) milestones[m[1]] = {}
      milestones[m[1]].ga_target = dateStr
      continue
    }
  }

  return Object.keys(milestones)
    .filter(function(version) { return filterFn(milestones[version]) })
    .sort(function(a, b) {
      var ap = a.split('.').map(Number)
      var bp = b.split('.').map(Number)
      return ap[0] - bp[0] || ap[1] - bp[1]
    })
    .map(function(version) {
      var ms = milestones[version]
      return {
        version: version,
        ea1Freeze: ms.ea1_freeze || null,
        ea1Target: ms.ea1_target || null,
        ea2Freeze: ms.ea2_freeze || null,
        ea2Target: ms.ea2_target || null,
        gaFreeze: ms.ga_freeze || null,
        gaTarget: ms.ga_target || null
      }
    })
}

/**
 * Extract release versions and their key milestone dates from the SmartSheet.
 *
 * Ports the regex logic from release-pulse's smartsheet_client.py.
 * Matches the same four row patterns: EA1/EA2 Code Freeze, EA1/EA2
 * RELEASE, GA Code Freeze, GA. Only surfaces versions that have all 6
 * required milestones (ea1_freeze, ea1_target, ea2_freeze, ea2_target,
 * ga_freeze, ga_target), matching the Python client's completeness check.
 *
 * @returns {Array<{ version: string, ea1Target: string|null, ea2Target: string|null, gaTarget: string|null }>}
 */
async function discoverReleases() {
  var releases = await parseSmartsheetReleases(function(ms) {
    return REQUIRED_MILESTONES.every(function(key) { return !!ms[key] })
  })

  // Map to the original shape -- target dates only, no freeze dates
  return releases.map(function(r) {
    return {
      version: r.version,
      ea1Target: r.ea1Target,
      ea2Target: r.ea2Target,
      gaTarget: r.gaTarget
    }
  })
}

function httpGet(url, headers) {
  return new Promise(function(resolve, reject) {
    var req = https.get(url, { headers: headers, timeout: 30000 }, function(res) {
      var body = ''
      res.on('data', function(chunk) { body += chunk })
      res.on('end', function() {
        if (res.statusCode >= 400) {
          reject(new Error('SmartSheet API returned ' + res.statusCode + ': ' + body.substring(0, 200)))
          return
        }
        try {
          resolve(JSON.parse(body))
        } catch {
          reject(new Error('Invalid JSON from SmartSheet API'))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', function() { req.destroy(); reject(new Error('SmartSheet API request timed out')) })
  })
}

/**
 * Extended version of discoverReleases that includes freeze dates.
 *
 * Returns all 6 milestones per release (ea1Freeze, ea1Target, ea2Freeze,
 * ea2Target, gaFreeze, gaTarget) for use by the health pipeline's risk
 * engine, which needs freeze dates for phase-completion checks.
 *
 * The existing discoverReleases() is left unchanged for backward compatibility.
 *
 * @returns {Array<{ version: string, ea1Freeze: string|null, ea1Target: string|null, ea2Freeze: string|null, ea2Target: string|null, gaFreeze: string|null, gaTarget: string|null }>}
 */
async function discoverReleasesWithFreezes() {
  return parseSmartsheetReleases(function(ms) {
    return REQUIRED_MILESTONES.every(function(key) { return !!ms[key] })
  })
}

/**
 * Relaxed version of discoverReleasesWithFreezes that includes versions
 * with at least one milestone date.  Used by the health pipeline's
 * backfill flow, where upcoming releases may not yet have all 6 dates
 * in Smartsheet (e.g., GA dates not set while EA1 is being planned).
 *
 * @returns {Array<{ version: string, ea1Freeze: string|null, ea1Target: string|null, ea2Freeze: string|null, ea2Target: string|null, gaFreeze: string|null, gaTarget: string|null }>}
 */
async function discoverReleasesPartial() {
  return parseSmartsheetReleases(function(ms) {
    return Object.keys(ms).length > 0
  })
}

module.exports = {
  discoverReleases: discoverReleases,
  discoverReleasesWithFreezes: discoverReleasesWithFreezes,
  discoverReleasesPartial: discoverReleasesPartial,
  isConfigured: isConfigured,
  SMARTSHEET_SHEET_ID: SMARTSHEET_SHEET_ID
}
