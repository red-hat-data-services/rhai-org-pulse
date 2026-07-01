const { createJiraClient } = require('../../../shared/server/jira')
const { createGoogleSheetsClient } = require('../../../shared/server/google-sheets')

var versionsCache = null
var versionsCacheAt = 0
var VERSIONS_CACHE_TTL = 10 * 60 * 1000

var techVisCache = null
var techVisCacheAt = 0
var TECH_VIS_CACHE_TTL = 15 * 60 * 1000
var TECH_VIS_SHEET_ID = '1gUAxe2LtmTjzcN8Wt3LfaXswSfK9emM40OtwmSsxMaU'
var TECH_VIS_TARGET = 5

var contentCache = null
var contentCacheAt = 0
var CONTENT_CACHE_TTL = 15 * 60 * 1000
var CONTENT_SHEET_ID = '1LePie38Eg1gUEIO6qu5zifgnCe9ASj8QHE8n_sgsrVk'

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoutes(router, context) {
  const { storage, requireScope, secrets } = context

  var jira = createJiraClient({
    email: (secrets && secrets.JIRA_EMAIL) || '',
    token: (secrets && secrets.JIRA_TOKEN) || '',
    host: process.env.JIRA_HOST
  })

  var JIRA_PROJECTS = ['RHAISTRAT', 'RHOAIENG']

  /**
   * @openapi
   * /api/modules/okr-hub/status:
   *   get:
   *     tags: [OKR Hub]
   *     summary: OKR Hub status
   *     responses:
   *       200:
   *         description: Success
   */
  router.get('/status', requireScope('okr-hub:read'), function(req, res) {
    res.json({ status: 'ok', message: 'OKR Hub is running' })
  })

  /**
   * @openapi
   * /api/modules/okr-hub/reports/on-time-releases:
   *   get:
   *     tags: [OKR Hub]
   *     summary: On Time Releases report comparing planned vs actual GA dates
   *     parameters:
   *       - name: since
   *         in: query
   *         schema: { type: string }
   *         description: ISO date cutoff for planned GA (default 2026-04-01)
   *     responses:
   *       200:
   *         description: Array of releases with on-time analysis
   */
  router.get('/reports/on-time-releases', requireScope('okr-hub:read'), async function(req, res) {
    try {
      var since = req.query.since || '2026-04-01'

      var registry = storage.readFromStorage('releases/registry.json')
      if (!registry || !Array.isArray(registry.releases)) {
        return res.json({ releases: [], summary: { total: 0, onTime: 0, late: 0, upcoming: 0, pct: 0 }, fetchedAt: new Date().toISOString() })
      }

      var candidates = []
      for (var i = 0; i < registry.releases.length; i++) {
        var rel = registry.releases[i]
        var ga = rel.milestones && rel.milestones.ga
        if (!ga || ga < since) continue
        if (isEaRelease(rel.id)) continue
        candidates.push(rel)
      }

      var jiraVersions = await fetchJiraVersions(jira)

      var jiraVersionMap = {}
      for (var vi = 0; vi < jiraVersions.length; vi++) {
        var v = jiraVersions[vi]
        jiraVersionMap[v.name.toLowerCase()] = v
      }

      var results = []
      for (var ri = 0; ri < candidates.length; ri++) {
        var release = candidates[ri]
        var plannedGa = release.milestones.ga
        var actualGa = null
        var released = false

        var fvList = release.fixVersions || []
        for (var fvi = 0; fvi < fvList.length; fvi++) {
          var match = jiraVersionMap[fvList[fvi].toLowerCase()]
          if (match && match.released && match.releaseDate) {
            actualGa = match.releaseDate
            released = true
            break
          }
        }

        var onTime = null
        var daysLate = null
        if (released && actualGa) {
          var planned = new Date(plannedGa + 'T00:00:00Z')
          var actual = new Date(actualGa + 'T00:00:00Z')
          var diffMs = actual.getTime() - planned.getTime()
          daysLate = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
          onTime = daysLate <= 0
        }

        results.push({
          id: release.id,
          displayName: release.displayName,
          plannedGa: plannedGa,
          actualGa: actualGa,
          released: released,
          onTime: onTime,
          daysLate: daysLate
        })
      }

      results.sort(function(a, b) {
        return b.plannedGa.localeCompare(a.plannedGa)
      })

      var totalReleased = 0
      var onTimeCount = 0
      var lateCount = 0
      var upcomingCount = 0
      for (var si = 0; si < results.length; si++) {
        if (!results[si].released) { upcomingCount++; continue }
        totalReleased++
        if (results[si].onTime) onTimeCount++
        else lateCount++
      }

      var pct = totalReleased > 0 ? Math.round((onTimeCount / totalReleased) * 100) : 0

      res.json({
        releases: results,
        summary: {
          total: results.length,
          totalReleased: totalReleased,
          onTime: onTimeCount,
          late: lateCount,
          upcoming: upcomingCount,
          pct: pct
        },
        since: since,
        fetchedAt: new Date().toISOString()
      })
    } catch (err) {
      console.error('[okr-hub] on-time-releases error:', err)
      res.status(500).json({ error: err.message })
    }
  })

  async function fetchJiraVersions(jiraClient) {
    var now = Date.now()
    if (versionsCache && (now - versionsCacheAt) < VERSIONS_CACHE_TTL) {
      return versionsCache
    }

    var allVersions = []
    for (var pi = 0; pi < JIRA_PROJECTS.length; pi++) {
      var project = JIRA_PROJECTS[pi]
      try {
        var data = await jiraClient.jiraRequest('/rest/api/3/project/' + project + '/versions')
        for (var dvi = 0; dvi < data.length; dvi++) {
          allVersions.push({
            name: data[dvi].name,
            releaseDate: data[dvi].releaseDate || null,
            released: data[dvi].released || false,
            project: project
          })
        }
      } catch (err) {
        console.warn('[okr-hub] Failed to fetch versions for ' + project + ':', err.message)
      }
    }

    versionsCache = allVersions
    versionsCacheAt = now
    return allVersions
  }

  /**
   * @openapi
   * /api/modules/okr-hub/reports/cve-sla:
   *   get:
   *     tags: [OKR Hub]
   *     summary: CVE SLA Compliance data (products x months with met/missed counts)
   *     responses:
   *       200:
   *         description: CVE SLA dataset
   */
  router.get('/reports/cve-sla', requireScope('okr-hub:read'), function(req, res) {
    var saved = storage.readFromStorage('okr-hub/cve-sla-data.json')
    if (saved && saved.products && saved.months) {
      return res.json(saved)
    }
    res.json(getDefaultCveSlaData())
  })

  /**
   * @openapi
   * /api/modules/okr-hub/reports/cve-sla:
   *   put:
   *     tags: [OKR Hub]
   *     summary: Save CVE SLA Compliance data
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { type: object }
   *     responses:
   *       200:
   *         description: Saved successfully
   */
  router.put('/reports/cve-sla', requireScope('okr-hub:write'), function(req, res) {
    try {
      var body = req.body
      if (!body || !Array.isArray(body.products) || !body.months) {
        return res.status(400).json({ error: 'Invalid payload: requires products array and months object' })
      }
      storage.writeToStorage('okr-hub/cve-sla-data.json', body)
      res.json({ ok: true })
    } catch (err) {
      console.error('[okr-hub] cve-sla save error:', err)
      res.status(500).json({ error: err.message })
    }
  })

  /**
   * @openapi
   * /api/modules/okr-hub/reports/tech-visibility:
   *   get:
   *     tags: [OKR Hub]
   *     summary: Technical visibility report - weekly article counts from Google Sheets
   *     responses:
   *       200:
   *         description: Quarterly breakdown of weekly article counts
   */
  router.get('/reports/tech-visibility', requireScope('okr-hub:read'), async function(req, res) {
    try {
      var now = Date.now()
      if (techVisCache && (now - techVisCacheAt) < TECH_VIS_CACHE_TTL) {
        return res.json(techVisCache)
      }

      var sheetsClient = createGoogleSheetsClient()
      var tabNames
      try {
        tabNames = await sheetsClient.discoverSheetNames(TECH_VIS_SHEET_ID)
      } catch (authErr) {
        console.warn('[okr-hub] Google Sheets unavailable, using sample data:', authErr.message)
        var sample = getSampleTechVisData()
        techVisCache = sample
        techVisCacheAt = now
        return res.json(sample)
      }
      if (!tabNames || tabNames.length === 0) {
        return res.json({ error: 'No tabs found in spreadsheet', quarters: [], overall: { weeksMet: 0, totalWeeks: 0, pct: 0 }, target: TECH_VIS_TARGET, fetchedAt: new Date().toISOString() })
      }

      var sheetData = null
      for (var ti = 0; ti < tabNames.length; ti++) {
        var raw = await sheetsClient.fetchRawSheet(TECH_VIS_SHEET_ID, tabNames[ti])
        if (raw && raw.headers && raw.headers.length > 0) {
          var hasWeekCol = findColumnIndex(raw.headers, ['week', 'date', 'week of', 'week starting'])
          var hasCountCol = findColumnIndex(raw.headers, ['count', 'articles', 'posts', 'total', '# of articles', 'number'])
          if (hasWeekCol !== -1 && hasCountCol !== -1) {
            sheetData = { headers: raw.headers, rows: raw.rows, weekCol: hasWeekCol, countCol: hasCountCol, tabName: tabNames[ti] }
            break
          }
        }
      }

      if (!sheetData) {
        return res.json({ error: 'Could not find columns for week dates and article counts. Available tabs: ' + tabNames.join(', '), quarters: [], overall: { weeksMet: 0, totalWeeks: 0, pct: 0 }, target: TECH_VIS_TARGET, fetchedAt: new Date().toISOString() })
      }

      var weeks = []
      for (var ri = 0; ri < sheetData.rows.length; ri++) {
        var row = sheetData.rows[ri]
        var weekVal = row[sheetData.weekCol]
        var countVal = row[sheetData.countCol]
        if (weekVal == null || weekVal === '') continue

        var weekDate = parseSheetDate(weekVal)
        if (!weekDate) continue

        var count = typeof countVal === 'number' ? countVal : parseInt(String(countVal || '0'), 10)
        if (isNaN(count)) count = 0

        weeks.push({
          weekOf: weekDate,
          count: count,
          met: count >= TECH_VIS_TARGET
        })
      }

      weeks.sort(function(a, b) { return a.weekOf.localeCompare(b.weekOf) })

      var quarterMap = {}
      for (var wi = 0; wi < weeks.length; wi++) {
        var w = weeks[wi]
        var d = new Date(w.weekOf + 'T00:00:00Z')
        var year = d.getUTCFullYear()
        var month = d.getUTCMonth()
        var qNum = Math.floor(month / 3) + 1
        var qLabel = 'Q' + qNum + ' ' + year
        if (!quarterMap[qLabel]) {
          quarterMap[qLabel] = { label: qLabel, weeks: [], weeksMet: 0, totalWeeks: 0, pct: 0, sortKey: year * 10 + qNum }
        }
        quarterMap[qLabel].weeks.push(w)
        quarterMap[qLabel].totalWeeks++
        if (w.met) quarterMap[qLabel].weeksMet++
      }

      var quarters = Object.keys(quarterMap).map(function(k) { return quarterMap[k] })
      quarters.sort(function(a, b) { return a.sortKey - b.sortKey })
      for (var qi = 0; qi < quarters.length; qi++) {
        quarters[qi].pct = quarters[qi].totalWeeks > 0 ? Math.round((quarters[qi].weeksMet / quarters[qi].totalWeeks) * 100) : 0
        delete quarters[qi].sortKey
      }

      var overallMet = 0
      var overallTotal = 0
      for (var oi = 0; oi < quarters.length; oi++) {
        overallMet += quarters[oi].weeksMet
        overallTotal += quarters[oi].totalWeeks
      }

      var result = {
        quarters: quarters,
        overall: {
          weeksMet: overallMet,
          totalWeeks: overallTotal,
          pct: overallTotal > 0 ? Math.round((overallMet / overallTotal) * 100) : 0
        },
        target: TECH_VIS_TARGET,
        source: sheetData.tabName,
        fetchedAt: new Date().toISOString()
      }

      techVisCache = result
      techVisCacheAt = now
      res.json(result)
    } catch (err) {
      console.error('[okr-hub] tech-visibility error:', err)
      res.status(500).json({ error: err.message })
    }
  })

  /**
   * @openapi
   * /api/modules/okr-hub/reports/content-contributions:
   *   get:
   *     tags: [OKR Hub]
   *     summary: Associate content contributions - per-team completion tracking from Google Sheets
   *     responses:
   *       200:
   *         description: Per-quarter breakdown of team content contributions
   */
  router.get('/reports/content-contributions', requireScope('okr-hub:read'), async function(req, res) {
    try {
      var now = Date.now()
      if (contentCache && (now - contentCacheAt) < CONTENT_CACHE_TTL) {
        return res.json(contentCache)
      }

      var sheetsClient = createGoogleSheetsClient()
      var tabNames
      try {
        tabNames = await sheetsClient.discoverSheetNames(CONTENT_SHEET_ID)
      } catch (authErr) {
        console.warn('[okr-hub] Google Sheets unavailable for content contributions, using sample data:', authErr.message)
        var sample = getSampleContentData()
        contentCache = sample
        contentCacheAt = now
        return res.json(sample)
      }

      if (!tabNames || tabNames.length === 0) {
        return res.json({ error: 'No tabs found in spreadsheet', quarters: [], overall: { associates: 0, completed: 0, pct: 0 }, fetchedAt: new Date().toISOString() })
      }

      var quarters = []
      for (var ti = 0; ti < tabNames.length; ti++) {
        var tabName = tabNames[ti]
        var qMatch = tabName.match(/Q(\d)\s*(\d{4})?/i)
        if (!qMatch) continue

        var raw = await sheetsClient.fetchRawSheet(CONTENT_SHEET_ID, tabName)
        if (!raw || !raw.headers || raw.headers.length === 0) continue

        var teamCol = findColumnIndex(raw.headers, ['team name', 'team'])
        var assocCol = findColumnIndex(raw.headers, ['number of associates', 'associates', '# associates'])
        var completedCol = findColumnIndex(raw.headers, ['associates completed', 'completed content', 'completed'])
        var pctCol = findColumnIndex(raw.headers, ['percentage completed', '% completed', 'percentage', '%'])
        var statusCol = findColumnIndex(raw.headers, ['status'])
        var perfCol = findColumnIndex(raw.headers, ['performance vs', 'performance'])
        var endQCol = findColumnIndex(raw.headers, ['end of q', 'end of quarter', 'q1 status', 'q2 status', 'q3 status', 'q4 status'])

        if (teamCol === -1 || assocCol === -1) continue

        var teams = []
        var totalRow = null
        for (var ri = 0; ri < raw.rows.length; ri++) {
          var row = raw.rows[ri]
          var name = String(row[teamCol] || '').trim()
          if (!name) continue

          var associates = parseNum(row[assocCol])
          var completed = completedCol !== -1 ? parseNum(row[completedCol]) : 0
          var pct = pctCol !== -1 ? parsePct(row[pctCol]) : (associates > 0 ? Math.round((completed / associates) * 100) : 0)
          var status = statusCol !== -1 ? String(row[statusCol] || '').trim() : ''
          var perf = perfCol !== -1 ? String(row[perfCol] || '').trim() : ''
          var endQ = endQCol !== -1 ? parsePct(row[endQCol]) : null

          var entry = { name: name, associates: associates, completed: completed, pct: pct, status: status, performance: perf, endQPct: endQ }

          if (name.toLowerCase() === 'total') {
            totalRow = entry
          } else {
            teams.push(entry)
          }
        }

        if (teams.length === 0) continue

        if (!totalRow) {
          var tAssoc = 0
          var tComp = 0
          for (var tmi = 0; tmi < teams.length; tmi++) { tAssoc += teams[tmi].associates; tComp += teams[tmi].completed }
          totalRow = { name: 'TOTAL', associates: tAssoc, completed: tComp, pct: tAssoc > 0 ? Math.round((tComp / tAssoc) * 100) : 0, status: '', performance: '', endQPct: null }
        }

        var qLabel = tabName.trim()
        quarters.push({
          label: qLabel,
          teams: teams,
          total: { associates: totalRow.associates, completed: totalRow.completed, pct: totalRow.pct, endQPct: totalRow.endQPct },
          targetDate: '12/31/2026'
        })
      }

      if (quarters.length === 0) {
        var raw0 = await sheetsClient.fetchRawSheet(CONTENT_SHEET_ID, tabNames[0])
        if (raw0 && raw0.headers) {
          var parsed = parseContentTab(raw0, tabNames[0])
          if (parsed) quarters.push(parsed)
        }
      }

      var latestQ = quarters.length > 0 ? quarters[quarters.length - 1] : null
      var result = {
        quarters: quarters,
        overall: latestQ ? { associates: latestQ.total.associates, completed: latestQ.total.completed, pct: latestQ.total.pct } : { associates: 0, completed: 0, pct: 0 },
        target: '1 piece of content per associate',
        fetchedAt: new Date().toISOString()
      }

      contentCache = result
      contentCacheAt = now
      res.json(result)
    } catch (err) {
      console.error('[okr-hub] content-contributions error:', err)
      res.status(500).json({ error: err.message })
    }
  })

  function parseContentTab(raw, tabName) {
    if (!raw || !raw.headers || raw.headers.length === 0) return null

    var teamCol = findColumnIndex(raw.headers, ['team name', 'team'])
    var assocCol = findColumnIndex(raw.headers, ['number of associates', 'associates', '# associates'])
    var completedCol = findColumnIndex(raw.headers, ['associates completed', 'completed content', 'completed'])
    var pctCol = findColumnIndex(raw.headers, ['percentage completed', '% completed', 'percentage', '%'])
    var statusCol = findColumnIndex(raw.headers, ['status'])

    if (teamCol === -1 || assocCol === -1) return null

    var teams = []
    var totalRow = null
    for (var ri = 0; ri < raw.rows.length; ri++) {
      var row = raw.rows[ri]
      var name = String(row[teamCol] || '').trim()
      if (!name) continue
      var associates = parseNum(row[assocCol])
      var completed = completedCol !== -1 ? parseNum(row[completedCol]) : 0
      var pct = pctCol !== -1 ? parsePct(row[pctCol]) : (associates > 0 ? Math.round((completed / associates) * 100) : 0)
      var status = statusCol !== -1 ? String(row[statusCol] || '').trim() : ''
      var entry = { name: name, associates: associates, completed: completed, pct: pct, status: status, performance: '', endQPct: null }
      if (name.toLowerCase() === 'total') { totalRow = entry } else { teams.push(entry) }
    }
    if (teams.length === 0) return null
    if (!totalRow) {
      var tA = 0; var tC = 0
      for (var i = 0; i < teams.length; i++) { tA += teams[i].associates; tC += teams[i].completed }
      totalRow = { name: 'TOTAL', associates: tA, completed: tC, pct: tA > 0 ? Math.round((tC / tA) * 100) : 0 }
    }
      return { label: tabName.trim(), teams: teams, total: { associates: totalRow.associates, completed: totalRow.completed, pct: totalRow.pct, endQPct: totalRow.endQPct }, targetDate: '12/31/2026' }
  }

  context.registerDiagnostics(async function() {
    return { status: 'ok' }
  })
}

function isEaRelease(id) {
  var lower = (id || '').toLowerCase()
  return lower.includes('.ea') || lower.includes('-ea')
}

function findColumnIndex(headers, candidates) {
  for (var hi = 0; hi < headers.length; hi++) {
    var h = (headers[hi] || '').toLowerCase().trim()
    for (var ci = 0; ci < candidates.length; ci++) {
      if (h === candidates[ci] || h.includes(candidates[ci])) return hi
    }
  }
  return -1
}

function parseSheetDate(val) {
  if (typeof val === 'number') {
    var epoch = new Date(Date.UTC(1899, 11, 30))
    var d = new Date(epoch.getTime() + val * 86400000)
    return d.toISOString().slice(0, 10)
  }
  var s = String(val).trim()
  var parsed = new Date(s)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return null
}

function getDefaultCveSlaData() {
  return {
    year: 2026,
    products: [
      'RHOAI',
      'RHOAI 2.16',
      'RHOAI 2.25',
      'RHOAI 3.2',
      'RHEL AI',
      'RH AI Inference Server',
      'RH Inference Server 3.2'
    ],
    months: {
      jan: {
        'RHOAI': { met: 27, missed: 1 },
        'RHOAI 2.16': { met: 0, missed: 0 },
        'RHOAI 2.25': { met: 23, missed: 0 },
        'RHOAI 3.2': { met: 0, missed: 0 },
        'RHEL AI': { met: 0, missed: 0 },
        'RH AI Inference Server': { met: 1, missed: 0 },
        'RH Inference Server 3.2': { met: 14, missed: 0 }
      },
      feb: {
        'RHOAI': { met: 108, missed: 117 },
        'RHOAI 2.16': { met: 0, missed: 0 },
        'RHOAI 2.25': { met: 74, missed: 113 },
        'RHOAI 3.2': { met: 3, missed: 0 },
        'RHEL AI': { met: 0, missed: 0 },
        'RH AI Inference Server': { met: 0, missed: 87 },
        'RH Inference Server 3.2': { met: 4, missed: 10 }
      },
      mar: {
        'RHOAI': { met: 221, missed: 2 },
        'RHOAI 2.16': { met: 0, missed: 0 },
        'RHOAI 2.25': { met: 94, missed: 0 },
        'RHOAI 3.2': { met: 0, missed: 0 },
        'RHEL AI': { met: 0, missed: 0 },
        'RH AI Inference Server': { met: 5, missed: 0 },
        'RH Inference Server 3.2': { met: 29, missed: 0 }
      },
      apr: {
        'RHOAI': { met: 66, missed: 89 },
        'RHOAI 2.16': { met: 3, missed: 0 },
        'RHOAI 2.25': { met: 38, missed: 10 },
        'RHOAI 3.2': { met: 0, missed: 0 },
        'RHEL AI': { met: 0, missed: 0 },
        'RH AI Inference Server': { met: 12, missed: 0 },
        'RH Inference Server 3.2': { met: 15, missed: 6 }
      },
      may: {},
      jun: {},
      jul: {},
      aug: {},
      sep: {},
      oct: {},
      nov: {},
      dec: {}
    }
  }
}

function parseNum(val) {
  if (val == null || val === '') return 0
  if (typeof val === 'number') return val
  var n = parseInt(String(val).replace(/,/g, ''), 10)
  return isNaN(n) ? 0 : n
}

function parsePct(val) {
  if (val == null || val === '') return null
  if (typeof val === 'number') return Math.round(val * (val < 1 ? 100 : 1))
  var s = String(val).replace('%', '').trim()
  var n = parseFloat(s)
  if (isNaN(n)) return null
  return Math.round(n < 1 && n > 0 ? n * 100 : n)
}

function getSampleContentData() {
  var teams = [
    { name: "Steven's Directs", associates: 14, completed: 1, pct: 7, status: 'Started', performance: 'Behind (43% to go)', endQPct: 7 },
    { name: 'Cat Agentics & AI Eng Tooling', associates: 58, completed: 18, pct: 31, status: 'Started', performance: 'Behind (19% to go)', endQPct: 6 },
    { name: 'Sherard AI Platform', associates: 192, completed: 34, pct: 18, status: 'Started', performance: 'Behind (32% to go)', endQPct: 6 },
    { name: 'Taneem Inf Engineering', associates: 59, completed: 21, pct: 36, status: 'Started', performance: 'Behind (14% to go)', endQPct: 7 },
    { name: 'Kai AI Innovation', associates: 13, completed: 2, pct: 15, status: 'Started', performance: 'Behind (35% to go)', endQPct: 0 },
    { name: 'Tom AIPCC', associates: 147, completed: 19, pct: 13, status: 'Started', performance: 'Behind (37% to go)', endQPct: 6 },
    { name: 'Monica watsonx', associates: 48, completed: 18, pct: 38, status: 'Started', performance: 'Behind (13% to go)', endQPct: 10 }
  ]
  return {
    quarters: [
      {
        label: 'Q1 2026',
        teams: teams,
        total: { associates: 531, completed: 113, pct: 21, endQPct: 7 },
        targetDate: '12/31/2026'
      }
    ],
    overall: { associates: 531, completed: 113, pct: 21 },
    target: '1 piece of content per associate',
    fetchedAt: new Date().toISOString()
  }
}

function getSampleTechVisData() {
  var q2Weeks = [
    { weekOf: '2026-04-06', count: 7, met: true },
    { weekOf: '2026-04-13', count: 5, met: true },
    { weekOf: '2026-04-20', count: 3, met: false },
    { weekOf: '2026-04-27', count: 6, met: true },
    { weekOf: '2026-05-04', count: 8, met: true },
    { weekOf: '2026-05-11', count: 4, met: false },
    { weekOf: '2026-05-18', count: 5, met: true },
    { weekOf: '2026-05-25', count: 9, met: true },
    { weekOf: '2026-06-01', count: 6, met: true },
    { weekOf: '2026-06-08', count: 2, met: false },
    { weekOf: '2026-06-15', count: 7, met: true },
    { weekOf: '2026-06-22', count: 5, met: true },
    { weekOf: '2026-06-29', count: 4, met: false }
  ]
  var met = 0
  for (var i = 0; i < q2Weeks.length; i++) { if (q2Weeks[i].met) met++ }
  return {
    quarters: [{
      label: 'Q2 2026',
      weeks: q2Weeks,
      weeksMet: met,
      totalWeeks: q2Weeks.length,
      pct: Math.round((met / q2Weeks.length) * 100)
    }],
    overall: { weeksMet: met, totalWeeks: q2Weeks.length, pct: Math.round((met / q2Weeks.length) * 100) },
    target: TECH_VIS_TARGET,
    source: '(sample data)',
    fetchedAt: new Date().toISOString()
  }
}
