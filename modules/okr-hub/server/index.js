const { createJiraClient } = require('../../../shared/server/jira')

var versionsCache = null
var versionsCacheAt = 0
var VERSIONS_CACHE_TTL = 10 * 60 * 1000

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

  context.registerDiagnostics(async function() {
    return { status: 'ok' }
  })
}

function isEaRelease(id) {
  var lower = (id || '').toLowerCase()
  return lower.includes('.ea') || lower.includes('-ea')
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
