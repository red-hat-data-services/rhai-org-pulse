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

var featureDeliveryCache = {}
var FEATURE_DELIVERY_CACHE_TTL = 10 * 60 * 1000

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoutes(router, context) {
  const { storage, requireScope, secrets } = context

  var googleKeyFile = context.resolveSecret('GOOGLE_SERVICE_ACCOUNT_KEY_FILE') || '/etc/secrets/google-sa-key.json'

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

      var overrides = storage.readFromStorage('okr-hub/on-time-overrides.json')
      var overrideMap = {}
      var removedIds = {}
      var customReleases = []
      if (overrides && Array.isArray(overrides.releases)) {
        for (var oi = 0; oi < overrides.releases.length; oi++) {
          var ov = overrides.releases[oi]
          if (ov.removed) { removedIds[ov.id] = true; continue }
          if (ov.custom) { customReleases.push(ov); continue }
          overrideMap[ov.id] = ov
        }
      }

      var registry = storage.readFromStorage('releases/registry.json')
      var registryReleases = (registry && Array.isArray(registry.releases)) ? registry.releases : []

      var candidates = []
      for (var i = 0; i < registryReleases.length; i++) {
        var rel = registryReleases[i]
        if (removedIds[rel.id]) continue
        var ga = rel.milestones && rel.milestones.ga
        if (!ga || ga < since) continue
        if (isEaRelease(rel.id)) continue
        if (overrideMap[rel.id]) {
          var ovr = overrideMap[rel.id]
          rel = Object.assign({}, rel, { milestones: Object.assign({}, rel.milestones, { ga: ovr.plannedGa || rel.milestones.ga }) })
          rel._overrideActualGa = ovr.actualGa || null
          rel._overrideDisplayName = ovr.displayName || null
        }
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
        var actualGa = release._overrideActualGa || null
        var released = !!actualGa

        if (!actualGa) {
          var fvList = release.fixVersions || []
          for (var fvi = 0; fvi < fvList.length; fvi++) {
            var match = jiraVersionMap[fvList[fvi].toLowerCase()]
            if (match && match.released && match.releaseDate) {
              actualGa = match.releaseDate
              released = true
              break
            }
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
          displayName: release._overrideDisplayName || release.displayName,
          plannedGa: plannedGa,
          actualGa: actualGa,
          released: released,
          onTime: onTime,
          daysLate: daysLate,
          custom: false
        })
      }

      for (var ci = 0; ci < customReleases.length; ci++) {
        var cr = customReleases[ci]
        if (removedIds[cr.id]) continue
        if (!cr.plannedGa || cr.plannedGa < since) continue
        var crReleased = !!cr.actualGa
        var crOnTime = null
        var crDaysLate = null
        if (crReleased && cr.actualGa) {
          var crPlanned = new Date(cr.plannedGa + 'T00:00:00Z')
          var crActual = new Date(cr.actualGa + 'T00:00:00Z')
          var crDiffMs = crActual.getTime() - crPlanned.getTime()
          crDaysLate = Math.ceil(crDiffMs / (1000 * 60 * 60 * 24))
          crOnTime = crDaysLate <= 0
        }
        results.push({
          id: cr.id,
          displayName: cr.displayName,
          plannedGa: cr.plannedGa,
          actualGa: cr.actualGa || null,
          released: crReleased,
          onTime: crOnTime,
          daysLate: crDaysLate,
          custom: true
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

  /**
   * @openapi
   * /api/modules/okr-hub/reports/on-time-releases/overrides:
   *   get:
   *     tags: [OKR Hub]
   *     summary: Get custom release overrides
   *     responses:
   *       200:
   *         description: Override entries
   */
  router.get('/reports/on-time-releases/overrides', requireScope('okr-hub:read'), function(req, res) {
    var saved = storage.readFromStorage('okr-hub/on-time-overrides.json')
    res.json(saved || { releases: [] })
  })

  /**
   * @openapi
   * /api/modules/okr-hub/reports/on-time-releases/overrides:
   *   put:
   *     tags: [OKR Hub]
   *     summary: Save custom release overrides
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { type: object }
   *     responses:
   *       200:
   *         description: Saved
   */
  router.put('/reports/on-time-releases/overrides', requireScope('okr-hub:write'), function(req, res) {
    try {
      var body = req.body
      if (!body || !Array.isArray(body.releases)) {
        return res.status(400).json({ error: 'Invalid payload: requires releases array' })
      }
      storage.writeToStorage('okr-hub/on-time-overrides.json', body)
      res.json({ ok: true })
    } catch (err) {
      console.error('[okr-hub] on-time-overrides save error:', err)
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

      var sheetsClient = createGoogleSheetsClient({ keyFile: googleKeyFile })
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

      var sheetsClient = createGoogleSheetsClient({ keyFile: googleKeyFile })
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

      var raw = await sheetsClient.fetchRawSheet(CONTENT_SHEET_ID, tabNames[0])
      if (!raw || !raw.headers || raw.headers.length === 0) {
        return res.json({ error: 'No data in spreadsheet', quarters: [], overall: { associates: 0, completed: 0, pct: 0 }, fetchedAt: new Date().toISOString() })
      }

      var teamCol = findColumnIndex(raw.headers, ['team name', 'team'])
      var assocCol = findColumnIndex(raw.headers, ['number of associates', 'associates', '# associates'])
      var completedCol = findColumnIndex(raw.headers, ['associates completed', 'completed content', 'completed'])
      var pctCol = findColumnIndex(raw.headers, ['percentage completed', '% completed', 'percentage', '%'])
      var statusCol = findColumnIndex(raw.headers, ['status'])
      var perfCol = findColumnIndex(raw.headers, ['performance vs', 'performance'])

      var endQCols = {}
      for (var hi = 0; hi < raw.headers.length; hi++) {
        var hdr = String(raw.headers[hi] || '').toLowerCase().trim()
        var eqMatch = hdr.match(/end of q(\d)/)
        if (eqMatch) endQCols['Q' + eqMatch[1]] = hi
      }

      if (teamCol === -1 || assocCol === -1) {
        return res.json({ error: 'Required columns not found', quarters: [], overall: { associates: 0, completed: 0, pct: 0 }, fetchedAt: new Date().toISOString() })
      }

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

        var qPcts = {}
        var qKeys = Object.keys(endQCols)
        for (var qki = 0; qki < qKeys.length; qki++) {
          var qk = qKeys[qki]
          var val = row[endQCols[qk]]
          qPcts[qk] = val != null ? parsePct(val) : null
        }

        var entry = { name: name, associates: associates, completed: completed, pct: pct, status: status, performance: perf, qPcts: qPcts }

        if (name.toLowerCase() === 'total') {
          totalRow = entry
        } else {
          teams.push(entry)
        }
      }

      if (teams.length === 0) {
        return res.json({ error: 'No team data found', quarters: [], overall: { associates: 0, completed: 0, pct: 0 }, fetchedAt: new Date().toISOString() })
      }

      if (!totalRow) {
        var tAssoc = 0; var tComp = 0
        for (var tmi = 0; tmi < teams.length; tmi++) { tAssoc += teams[tmi].associates; tComp += teams[tmi].completed }
        var tQPcts = {}
        var allQKeys = Object.keys(endQCols)
        for (var aqi = 0; aqi < allQKeys.length; aqi++) {
          var aqk = allQKeys[aqi]
          var sum = 0; var cnt = 0
          for (var si = 0; si < teams.length; si++) {
            if (teams[si].qPcts[aqk] != null) { sum += teams[si].qPcts[aqk] * teams[si].associates; cnt += teams[si].associates }
          }
          tQPcts[aqk] = cnt > 0 ? Math.round(sum / cnt) : null
        }
        totalRow = { name: 'TOTAL', associates: tAssoc, completed: tComp, pct: tAssoc > 0 ? Math.round((tComp / tAssoc) * 100) : 0, status: '', performance: '', qPcts: tQPcts }
      }

      var quarters = []
      var sortedQKeys = Object.keys(endQCols).sort()
      for (var sqi = 0; sqi < sortedQKeys.length; sqi++) {
        var sqk = sortedQKeys[sqi]
        var qTeams = []
        for (var ti = 0; ti < teams.length; ti++) {
          var t = teams[ti]
          var teamQPct = t.qPcts[sqk] != null ? t.qPcts[sqk] : 0
          var teamQCompleted = t.associates > 0 ? Math.round(t.associates * teamQPct / 100) : 0
          qTeams.push({ name: t.name, associates: t.associates, completed: teamQCompleted, pct: teamQPct, status: t.status, performance: t.performance, endQPct: teamQPct })
        }
        var totalQPct = totalRow.qPcts[sqk] != null ? totalRow.qPcts[sqk] : 0
        var totalQCompleted = totalRow.associates > 0 ? Math.round(totalRow.associates * totalQPct / 100) : 0
        var qNum = sqk.replace('Q', '')
        var endMonths = { '1': '03/31', '2': '06/30', '3': '09/30', '4': '12/31' }
        quarters.push({
          label: sqk + ' 2026',
          teams: qTeams,
          total: { associates: totalRow.associates, completed: totalQCompleted, pct: totalQPct, endQPct: totalQPct },
          targetDate: (endMonths[qNum] || '12/31') + '/2026'
        })
      }

      var result = {
        quarters: quarters,
        overall: { associates: totalRow.associates, completed: totalRow.completed, pct: totalRow.pct },
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

  /**
   * @openapi
   * /api/modules/okr-hub/reports/support-cases:
   *   get:
   *     tags: [OKR Hub]
   *     summary: Support case time to resolution data
   *     responses:
   *       200:
   *         description: Support case data by quarter and product
   */
  router.get('/reports/support-cases', requireScope('okr-hub:read'), function(req, res) {
    var saved = storage.readFromStorage('okr-hub/support-case-data.json')
    if (saved && saved.products && saved.quarters) {
      return res.json(saved)
    }
    res.json(getDefaultSupportCaseData())
  })

  /**
   * @openapi
   * /api/modules/okr-hub/reports/support-cases:
   *   put:
   *     tags: [OKR Hub]
   *     summary: Save support case data
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { type: object }
   *     responses:
   *       200:
   *         description: Saved
   */
  router.put('/reports/support-cases', requireScope('okr-hub:write'), function(req, res) {
    try {
      var body = req.body
      if (!body || !Array.isArray(body.products) || !body.quarters) {
        return res.status(400).json({ error: 'Invalid payload: requires products array and quarters object' })
      }
      storage.writeToStorage('okr-hub/support-case-data.json', body)
      res.json({ ok: true })
    } catch (err) {
      console.error('[okr-hub] support-cases save error:', err)
      res.status(500).json({ error: err.message })
    }
  })

  /**
   * @openapi
   * /api/modules/okr-hub/reports/90day-tracking-config:
   *   get:
   *     tags: [OKR Hub]
   *     summary: Get 90-day post-release tracking version configuration
   *     responses:
   *       200:
   *         description: Version configuration per release family
   */
  router.get('/reports/90day-tracking-config', requireScope('okr-hub:read'), function(req, res) {
    var saved = storage.readFromStorage('okr-hub/90day-tracking-config.json')
    if (saved && Array.isArray(saved.releases)) {
      return res.json(saved)
    }
    res.json({ releases: [] })
  })

  /**
   * @openapi
   * /api/modules/okr-hub/reports/90day-tracking-config:
   *   put:
   *     tags: [OKR Hub]
   *     summary: Save 90-day post-release tracking version configuration
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { type: object }
   *     responses:
   *       200:
   *         description: Saved
   */
  router.put('/reports/90day-tracking-config', requireScope('okr-hub:write'), function(req, res) {
    try {
      var body = req.body
      if (!body || !Array.isArray(body.releases)) {
        return res.status(400).json({ error: 'Invalid payload: requires releases array' })
      }
      storage.writeToStorage('okr-hub/90day-tracking-config.json', body)
      res.json({ ok: true })
    } catch (err) {
      console.error('[okr-hub] 90day-tracking-config save error:', err)
      res.status(500).json({ error: err.message })
    }
  })

  /**
   * @openapi
   * /api/modules/okr-hub/reports/feature-delivery-config:
   *   get:
   *     tags: [OKR Hub]
   *     summary: Get feature delivery accuracy configuration
   *     responses:
   *       200:
   *         description: Release configuration with product versions and dates
   */
  router.get('/reports/feature-delivery-config', requireScope('okr-hub:read'), function(req, res) {
    var saved = storage.readFromStorage('okr-hub/feature-delivery-config.json')
    if (saved && Array.isArray(saved.releases)) {
      return res.json(saved)
    }
    res.json({ releases: [] })
  })

  /**
   * @openapi
   * /api/modules/okr-hub/reports/feature-delivery-config:
   *   put:
   *     tags: [OKR Hub]
   *     summary: Save feature delivery accuracy configuration
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema: { type: object }
   *     responses:
   *       200:
   *         description: Saved
   */
  router.put('/reports/feature-delivery-config', requireScope('okr-hub:write'), function(req, res) {
    try {
      var body = req.body
      if (!body || !Array.isArray(body.releases)) {
        return res.status(400).json({ error: 'Invalid payload: requires releases array' })
      }
      storage.writeToStorage('okr-hub/feature-delivery-config.json', body)
      featureDeliveryCache = {}
      res.json({ ok: true })
    } catch (err) {
      console.error('[okr-hub] feature-delivery-config save error:', err)
      res.status(500).json({ error: err.message })
    }
  })

  /**
   * @openapi
   * /api/modules/okr-hub/reports/feature-delivery:
   *   get:
   *     tags: [OKR Hub]
   *     summary: Compute feature delivery accuracy from Jira
   *     responses:
   *       200:
   *         description: Per-release committed vs delivered feature counts
   */
  router.get('/reports/feature-delivery', requireScope('okr-hub:read'), async function(req, res) {
    try {
      var config = storage.readFromStorage('okr-hub/feature-delivery-config.json')
      if (!config || !Array.isArray(config.releases) || config.releases.length === 0) {
        return res.json({ releases: [], summary: { committed: 0, delivered: 0, accuracy: 0 } })
      }

      var now = Date.now()
      var totalCommitted = 0
      var totalDelivered = 0
      var releases = []

      for (var ri = 0; ri < config.releases.length; ri++) {
        var rel = config.releases[ri]
        var products = []
        var relCommitted = 0
        var relDelivered = 0

        for (var pi = 0; pi < (rel.products || []).length; pi++) {
          var p = rel.products[pi]
          if (!p.version) continue

          var cacheKey = p.version + '|' + (p.freezeDate || '') + '|' + (p.releaseDate || '')
          var cached = featureDeliveryCache[cacheKey]

          if (cached && (now - cached.at) < FEATURE_DELIVERY_CACHE_TTL) {
            products.push(cached.data)
            relCommitted += cached.data.committed
            relDelivered += cached.data.delivered
            continue
          }

          var committed = 0
          var delivered = 0

          try {
            if (p.freezeDate) {
              var committedJql = 'issuetype = Feature AND cf[10855] = "' + p.version + '" AND created <= "' + p.freezeDate + '"'
              var committedResults = await jira.fetchAllJqlResults(committedJql, 'summary')
              committed = committedResults.length
            } else {
              var tvJql = 'issuetype = Feature AND cf[10855] = "' + p.version + '"'
              var tvResults = await jira.fetchAllJqlResults(tvJql, 'summary')
              committed = tvResults.length
            }
          } catch (jiraErr) {
            console.warn('[okr-hub] feature-delivery committed query failed for ' + p.version + ':', jiraErr.message)
          }

          try {
            var deliveredJql = 'issuetype = Feature AND fixVersion = "' + p.version + '"'
            var deliveredResults = await jira.fetchAllJqlResults(deliveredJql, 'summary')
            delivered = deliveredResults.length
          } catch (jiraErr) {
            console.warn('[okr-hub] feature-delivery delivered query failed for ' + p.version + ':', jiraErr.message)
          }

          var accuracy = committed > 0 ? Math.round((delivered / committed) * 100) : 0
          var productData = {
            version: p.version,
            freezeDate: p.freezeDate || null,
            releaseDate: p.releaseDate || null,
            committed: committed,
            delivered: delivered,
            accuracy: accuracy
          }

          featureDeliveryCache[cacheKey] = { data: productData, at: now }
          products.push(productData)
          relCommitted += committed
          relDelivered += delivered
        }

        var relAccuracy = relCommitted > 0 ? Math.round((relDelivered / relCommitted) * 100) : 0
        releases.push({
          name: rel.name,
          products: products,
          committed: relCommitted,
          delivered: relDelivered,
          accuracy: relAccuracy
        })
      }

      totalCommitted = releases.reduce(function(s, r) { return s + r.committed }, 0)
      totalDelivered = releases.reduce(function(s, r) { return s + r.delivered }, 0)
      var overallAccuracy = totalCommitted > 0 ? Math.round((totalDelivered / totalCommitted) * 100) : 0

      res.json({
        releases: releases,
        summary: { committed: totalCommitted, delivered: totalDelivered, accuracy: overallAccuracy }
      })
    } catch (err) {
      console.error('[okr-hub] feature-delivery compute error:', err)
      res.status(500).json({ error: err.message })
    }
  })

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
  if (typeof val === 'number') {
    // Google Sheets UNFORMATTED_VALUE returns percentages as decimals (0-1)
    return Math.round(val <= 1 ? val * 100 : val)
  }
  var s = String(val).replace('%', '').trim()
  var n = parseFloat(s)
  if (isNaN(n)) return null
  // String values with '%' stripped: if already 0-100 range, use as-is; if 0-1, convert
  return Math.round(n <= 1 ? n * 100 : n)
}

function getSampleContentData() {
  var teamData = [
    { name: "Steven's Directs", associates: 14, completed: 1, pct: 7, status: 'Started', performance: 'Behind (43% to go)', q1: 7, q2: 7 },
    { name: 'Cat Agentics & AI Eng Tooling', associates: 58, completed: 19, pct: 33, status: 'Started', performance: 'Behind (17% to go)', q1: 6, q2: 31 },
    { name: 'Sherard AI Platform', associates: 192, completed: 34, pct: 18, status: 'Started', performance: 'Behind (32% to go)', q1: 6, q2: 18 },
    { name: 'Taneem Inf Engineering', associates: 59, completed: 21, pct: 36, status: 'Started', performance: 'Behind (14% to go)', q1: 7, q2: 36 },
    { name: 'Kai AI Innovation', associates: 13, completed: 2, pct: 15, status: 'Started', performance: 'Behind (35% to go)', q1: 0, q2: 15 },
    { name: 'Tom AIPCC', associates: 147, completed: 19, pct: 13, status: 'Started', performance: 'Behind (37% to go)', q1: 6, q2: 13 },
    { name: 'Monica watsonx', associates: 48, completed: 18, pct: 38, status: 'Started', performance: 'Behind (13% to go)', q1: 10, q2: 38 }
  ]

  function buildQuarter(qKey, qNum) {
    var teams = []
    for (var i = 0; i < teamData.length; i++) {
      var t = teamData[i]
      var qPct = t[qKey] != null ? t[qKey] : 0
      var qCompleted = Math.round(t.associates * qPct / 100)
      teams.push({ name: t.name, associates: t.associates, completed: qCompleted, pct: qPct, status: t.status, performance: t.performance, endQPct: qPct })
    }
    var tA = 0; var tC = 0
    for (var j = 0; j < teams.length; j++) { tA += teams[j].associates; tC += teams[j].completed }
    var tPct = tA > 0 ? Math.round((tC / tA) * 100) : 0
    var endMonths = { 1: '03/31', 2: '06/30', 3: '09/30', 4: '12/31' }
    return { label: 'Q' + qNum + ' 2026', teams: teams, total: { associates: tA, completed: tC, pct: tPct, endQPct: tPct }, targetDate: endMonths[qNum] + '/2026' }
  }

  var quarters = [buildQuarter('q1', 1), buildQuarter('q2', 2)]

  var tA = 0; var tC = 0
  for (var i = 0; i < teamData.length; i++) { tA += teamData[i].associates; tC += teamData[i].completed }

  return {
    quarters: quarters,
    overall: { associates: tA, completed: tC, pct: tA > 0 ? Math.round((tC / tA) * 100) : 0 },
    target: '1 piece of content per associate',
    fetchedAt: new Date().toISOString()
  }
}

function getSampleTechVisData() {
  var q1Weeks = [
    { weekOf: '2026-01-09', count: 4, met: false }, { weekOf: '2026-01-16', count: 2, met: false },
    { weekOf: '2026-01-23', count: 2, met: false }, { weekOf: '2026-01-30', count: 4, met: false },
    { weekOf: '2026-02-06', count: 5, met: true },  { weekOf: '2026-02-13', count: 4, met: false },
    { weekOf: '2026-02-20', count: 3, met: false }, { weekOf: '2026-02-27', count: 3, met: false },
    { weekOf: '2026-03-06', count: 2, met: false }, { weekOf: '2026-03-13', count: 6, met: true },
    { weekOf: '2026-03-20', count: 7, met: true },  { weekOf: '2026-03-27', count: 3, met: false }
  ]
  var q2Weeks = [
    { weekOf: '2026-04-03', count: 4, met: false }, { weekOf: '2026-04-10', count: 1, met: false },
    { weekOf: '2026-04-17', count: 4, met: false }, { weekOf: '2026-04-23', count: 11, met: true },
    { weekOf: '2026-04-30', count: 7, met: true },  { weekOf: '2026-05-07', count: 2, met: false },
    { weekOf: '2026-05-14', count: 2, met: false }, { weekOf: '2026-05-21', count: 1, met: false },
    { weekOf: '2026-05-28', count: 3, met: false }, { weekOf: '2026-06-04', count: 5, met: true },
    { weekOf: '2026-06-11', count: 2, met: false }, { weekOf: '2026-06-18', count: 5, met: true },
    { weekOf: '2026-06-25', count: 3, met: false }
  ]

  function buildQ(weeks, label) {
    var m = 0
    for (var i = 0; i < weeks.length; i++) { if (weeks[i].met) m++ }
    return { label: label, weeks: weeks, weeksMet: m, totalWeeks: weeks.length, pct: Math.round((m / weeks.length) * 100) }
  }

  var allQ = [buildQ(q1Weeks, 'Q1 2026'), buildQ(q2Weeks, 'Q2 2026')]
  var totalMet = 0; var totalWeeks = 0
  for (var i = 0; i < allQ.length; i++) { totalMet += allQ[i].weeksMet; totalWeeks += allQ[i].totalWeeks }

  return {
    quarters: allQ,
    overall: { weeksMet: totalMet, totalWeeks: totalWeeks, pct: totalWeeks > 0 ? Math.round((totalMet / totalWeeks) * 100) : 0 },
    target: TECH_VIS_TARGET,
    source: '(sample data)',
    fetchedAt: new Date().toISOString()
  }
}

function getDefaultSupportCaseData() {
  var emptyProduct = { totalCases: null, defects: null, casesClosed: null, bugsEng: null, rfe: null, supportEx: null, other: null, avgResolutionDays: null, medianResolutionDays: null }
  var products = ['RHOAI', 'RHEL-AI', 'RHAII']
  var quarters = {}
  var qNames = ['Q1', 'Q2', 'Q3', 'Q4']
  for (var qi = 0; qi < qNames.length; qi++) {
    quarters[qNames[qi]] = {}
    for (var pi = 0; pi < products.length; pi++) {
      quarters[qNames[qi]][products[pi]] = Object.assign({}, emptyProduct)
    }
  }
  quarters.Q1.RHOAI = { totalCases: 107, defects: 36, casesClosed: 25, bugsEng: 0, rfe: 0, supportEx: 0, other: 0, avgResolutionDays: 45.2, medianResolutionDays: 32.9 }
  quarters.Q2.RHOAI = { totalCases: 120, defects: 37, casesClosed: 14, bugsEng: 0, rfe: 0, supportEx: 0, other: 0, avgResolutionDays: 17.6, medianResolutionDays: 15.3 }
  return { year: 2026, products: products, quarters: quarters }
}
