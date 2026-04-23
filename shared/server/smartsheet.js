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
  var sheet = await fetchSheet()

  var colMap = {}
  for (var c = 0; c < sheet.columns.length; c++) {
    colMap[sheet.columns[c].title] = sheet.columns[c].id
  }
  var taskCol = colMap['Task Name']
  var startCol = colMap['Start']

  var milestones = {} // version -> { ea1_freeze, ea1_target, ea2_freeze, ea2_target, ga_freeze, ga_target }

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

    // EA1/EA2 Code Freeze -- e.g. "3.4.EA1 RHOAI Code Freeze"
    m = task.match(/^(\d+\.\d+)\.(EA[12])\s+(?:RHOAI\s+)?Code\s+Freeze/i)
    if (m) {
      var ver = m[1]
      var phase = m[2].toLowerCase()
      if (!milestones[ver]) milestones[ver] = {}
      milestones[ver][phase + '_freeze'] = dateStr
      continue
    }

    // EA1/EA2 Release -- e.g. "3.5.EA1 RHOAI RELEASE"
    m = task.match(/^(\d+\.\d+)\.(EA[12])\s+(?:RHOAI\s+)?RELEASE/i)
    if (m) {
      var ver2 = m[1]
      var phase2 = m[2].toLowerCase()
      if (!milestones[ver2]) milestones[ver2] = {}
      milestones[ver2][phase2 + '_target'] = dateStr
      continue
    }

    // GA Code Freeze -- e.g. "3.4 RHOAI Code Freeze" (not EA, not Feature Freeze)
    m = task.match(/^(\d+\.\d+)\s+(?:RHOAI\s+)?Code\s+Freeze$/i)
    if (m) {
      if (!milestones[m[1]]) milestones[m[1]] = {}
      milestones[m[1]].ga_freeze = dateStr
      continue
    }

    // GA Release -- e.g. "3.5 RHOAI GA"
    m = task.match(/^(\d+\.\d+)\s+(?:RHOAI\s+)?GA$/i)
    if (m) {
      if (!milestones[m[1]]) milestones[m[1]] = {}
      milestones[m[1]].ga_target = dateStr
      continue
    }
  }

  // Only include versions that have all 6 required milestones
  // (matches the Python client's completeness check)
  var REQUIRED_MILESTONES = ['ea1_freeze', 'ea1_target', 'ea2_freeze', 'ea2_target', 'ga_freeze', 'ga_target']

  var releases = Object.keys(milestones)
    .filter(function(version) {
      var ms = milestones[version]
      return REQUIRED_MILESTONES.every(function(key) { return !!ms[key] })
    })
    .sort(function(a, b) {
      var ap = a.split('.').map(Number)
      var bp = b.split('.').map(Number)
      return ap[0] - bp[0] || ap[1] - bp[1]
    })
    .map(function(version) {
      var ms = milestones[version]
      return {
        version: version,
        ea1Target: ms.ea1_target || null,
        ea2Target: ms.ea2_target || null,
        gaTarget: ms.ga_target || null
      }
    })

  return releases
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

module.exports = { discoverReleases: discoverReleases, isConfigured: isConfigured, SMARTSHEET_SHEET_ID: SMARTSHEET_SHEET_ID }
