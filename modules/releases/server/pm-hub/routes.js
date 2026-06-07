/**
 * PM Hub sub-router for the releases module.
 * Mounted at /api/modules/releases/pm-hub/ by the parent router.
 *
 * Provides endpoints for cross-project Jira metadata (components, versions)
 * and component-level release load data used by PM Hub reports.
 */

const { CUSTOM_FIELDS, transformIssue } = require('../hygiene/jira-fetch')

const PM_HUB_PROJECTS = ['RHAIENG', 'RHOAIENG', 'INFERENG', 'AIPCC', 'RHAISTRAT', 'RHAIRFE']
const DEFAULT_ISSUE_TYPES = ['Feature', 'Initiative']
const FIELDS_TO_FETCH = [
  'summary', 'status', 'issuetype', 'assignee', 'fixVersions', 'versions',
  'components', 'labels', 'issuelinks',
  CUSTOM_FIELDS.team,
  CUSTOM_FIELDS.statusSummary,
  CUSTOM_FIELDS.colorStatus,
  CUSTOM_FIELDS.productManager
].join(',')

/**
 * @param {import('express').Router} router
 * @param {{ requireAuth: Function, requireScope: Function, jira: object, storage: object }} context
 */
module.exports = function registerPmHubRoutes(router, context) {
  var jiraClient = context.jira || null

  /**
   * @openapi
   * /api/modules/releases/pm-hub/jira/components:
   *   get:
   *     tags: [Releases]
   *     summary: List Jira components across PM Hub projects
   *     description: Returns components from RHAIENG, RHOAIENG, INFERENG, AIPCC, RHAISTRAT, RHAIRFE
   *     responses:
   *       200:
   *         description: Array of components with project keys
   *       503:
   *         description: Jira client not configured
   */
  router.get('/jira/components', context.requireAuth, context.requireScope('releases:read'), async function(req, res) {
    if (!jiraClient) {
      return res.status(503).json({ error: 'Jira client not configured' })
    }

    try {
      var results = await Promise.allSettled(
        PM_HUB_PROJECTS.map(function(project) {
          return jiraClient.jiraRequest(
            '/rest/api/3/project/' + encodeURIComponent(project) + '/components'
          ).then(function(data) { return { project: project, data: data } })
        })
      )

      var components = []
      for (var i = 0; i < results.length; i++) {
        if (results[i].status === 'rejected') {
          console.warn('[releases/pm-hub] Failed to fetch components for ' + PM_HUB_PROJECTS[i] + ': ' + results[i].reason.message)
          continue
        }
        var project = results[i].value.project
        var arr = Array.isArray(results[i].value.data) ? results[i].value.data : []
        for (var j = 0; j < arr.length; j++) {
          var name = String(arr[j].name || '').trim()
          if (!name) continue
          components.push({
            id: String(arr[j].id || ''),
            name: name,
            project: project
          })
        }
      }

      components.sort(function(a, b) { return a.name.localeCompare(b.name) })

      res.json({ components: components, projects: PM_HUB_PROJECTS })
    } catch (err) {
      console.error('[releases/pm-hub] Components fetch failed:', err.message)
      res.status(500).json({ error: 'Failed to fetch Jira components' })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/pm-hub/jira/versions:
   *   get:
   *     tags: [Releases]
   *     summary: List Jira versions across PM Hub projects
   *     description: Returns versions from RHAIENG, RHOAIENG, INFERENG, AIPCC, RHAISTRAT, RHAIRFE
   *     responses:
   *       200:
   *         description: Array of versions with project keys
   *       503:
   *         description: Jira client not configured
   */
  router.get('/jira/versions', context.requireAuth, context.requireScope('releases:read'), async function(req, res) {
    if (!jiraClient) {
      return res.status(503).json({ error: 'Jira client not configured' })
    }

    try {
      var versions = await jiraClient.fetchProjectVersions(PM_HUB_PROJECTS)

      versions.sort(function(a, b) { return a.name.localeCompare(b.name) })

      res.json({ versions: versions, projects: PM_HUB_PROJECTS })
    } catch (err) {
      console.error('[releases/pm-hub] Versions fetch failed:', err.message)
      res.status(500).json({ error: 'Failed to fetch Jira versions' })
    }
  })

  /**
   * @openapi
   * /api/modules/releases/pm-hub/component-release-load:
   *   get:
   *     tags: [Releases]
   *     summary: Get component release load tracking data
   *     description: >
   *       Queries Jira for Features/Initiatives grouped by version then component.
   *       F Requested = issues where Target Version (cf[10855]) matches a selected version.
   *       F Committed = issues where fixVersion matches a selected version.
   *     parameters:
   *       - in: query
   *         name: components
   *         schema: { type: string }
   *         description: Comma-separated Jira component names
   *       - in: query
   *         name: versions
   *         schema: { type: string }
   *         description: Comma-separated Jira version names
   *     responses:
   *       200:
   *         description: Grouped feature data with requested and committed counts
   *       400:
   *         description: Missing required filters
   *       503:
   *         description: Jira client not configured
   */
  router.get('/component-release-load', context.requireAuth, context.requireScope('releases:read'), async function(req, res) {
    if (!jiraClient) {
      return res.status(503).json({ error: 'Jira client not configured' })
    }

    var componentNames = req.query.components ? req.query.components.split(',').map(function(s) { return s.trim() }).filter(Boolean) : []
    var versionNames = req.query.versions ? req.query.versions.split(',').map(function(s) { return s.trim() }).filter(Boolean) : []

    if (componentNames.length === 0 && versionNames.length === 0) {
      return res.status(400).json({ error: 'At least one component or version filter is required' })
    }

    try {
      var baseParts = [
        'project IN (' + PM_HUB_PROJECTS.join(', ') + ')',
        'issuetype IN (' + DEFAULT_ISSUE_TYPES.join(', ') + ')'
      ]

      var componentClause = ''
      if (componentNames.length > 0) {
        var escapedComp = componentNames.map(function(c) {
          return '"' + c.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
        })
        componentClause = 'component IN (' + escapedComp.join(', ') + ')'
      }

      var escapedVer = versionNames.map(function(v) {
        return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
      })

      var fieldsWithTv = FIELDS_TO_FETCH + ',' + CUSTOM_FIELDS.targetVersion

      // Query 1: F Requested — Target Version (cf[10855]) matches selected versions
      var requestedIssues = []
      if (versionNames.length > 0) {
        var tvJqlParts = baseParts.slice()
        if (componentClause) tvJqlParts.push(componentClause)
        tvJqlParts.push('cf[10855] IN (' + escapedVer.join(', ') + ')')
        var tvJql = tvJqlParts.join(' AND ')
        requestedIssues = await jiraClient.fetchAllJqlResults(tvJql, fieldsWithTv, { expand: 'renderedFields' })
      }

      // Query 2: F Committed — fixVersion matches selected versions
      var committedIssues = []
      if (versionNames.length > 0) {
        var fvJqlParts = baseParts.slice()
        if (componentClause) fvJqlParts.push(componentClause)
        fvJqlParts.push('fixVersion IN (' + escapedVer.join(', ') + ')')
        var fvJql = fvJqlParts.join(' AND ')
        committedIssues = await jiraClient.fetchAllJqlResults(fvJql, fieldsWithTv, { expand: 'renderedFields' })
      } else if (componentNames.length > 0) {
        var compOnlyParts = baseParts.slice()
        compOnlyParts.push(componentClause)
        var compJql = compOnlyParts.join(' AND ')
        committedIssues = await jiraClient.fetchAllJqlResults(compJql, fieldsWithTv, { expand: 'renderedFields' })
      }

      function extractTargetVersions(rawIssue) {
        var tvField = rawIssue.fields && rawIssue.fields[CUSTOM_FIELDS.targetVersion]
        if (!tvField) return []
        var arr = Array.isArray(tvField) ? tvField : [tvField]
        var result = []
        for (var i = 0; i < arr.length; i++) {
          var name = arr[i] && (arr[i].name || arr[i].value)
          if (name) result.push(String(name).trim())
        }
        return result
      }

      var versionGroups = {}

      function ensureGroup(vName, cName) {
        if (!versionGroups[vName]) {
          versionGroups[vName] = { version: vName, components: {} }
        }
        if (!versionGroups[vName].components[cName]) {
          versionGroups[vName].components[cName] = {
            component: cName,
            requestedFeatures: [],
            committedFeatures: [],
            requestedCount: 0,
            committedCount: 0,
            blockedCount: 0
          }
        }
        return versionGroups[vName].components[cName]
      }

      function buildFeatureObj(f) {
        return {
          key: f.key,
          summary: f.summary || '',
          status: f.status || null,
          colorStatus: f.colorStatus || null,
          statusSummary: f.statusSummary || null,
          isBlocked: f.isBlocked || false,
          components: f.components || [],
          assignee: f.assignee || null,
          pmOwner: f.pmOwner || null
        }
      }

      // Process requested issues (Target Version matches)
      for (var ri = 0; ri < requestedIssues.length; ri++) {
        var raw = requestedIssues[ri]
        var f = transformIssue(raw, {})
        var tvNames = extractTargetVersions(raw)
        var compList = f.components && f.components.length > 0 ? f.components : ['No Component']

        for (var tvi = 0; tvi < tvNames.length; tvi++) {
          var tvName = tvNames[tvi]
          if (versionNames.indexOf(tvName) === -1) continue

          for (var ci = 0; ci < compList.length; ci++) {
            var cName = compList[ci]
            if (componentNames.length > 0 && componentNames.indexOf(cName) === -1) continue
            var group = ensureGroup(tvName, cName)
            if (!group.requestedFeatures.some(function(e) { return e.key === f.key })) {
              group.requestedFeatures.push(buildFeatureObj(f))
              group.requestedCount++
            }
          }
        }
      }

      // Process committed issues (Fix Version matches)
      for (var cii = 0; cii < committedIssues.length; cii++) {
        var rawC = committedIssues[cii]
        var fc = transformIssue(rawC, {})
        var fvList = fc.fixVersions && fc.fixVersions.length > 0 ? fc.fixVersions : ['Unversioned']
        var compListC = fc.components && fc.components.length > 0 ? fc.components : ['No Component']

        for (var fvi = 0; fvi < fvList.length; fvi++) {
          var fvName = fvList[fvi]
          if (versionNames.length > 0 && versionNames.indexOf(fvName) === -1) continue

          for (var cci = 0; cci < compListC.length; cci++) {
            var cNameC = compListC[cci]
            if (componentNames.length > 0 && componentNames.indexOf(cNameC) === -1) continue
            var groupC = ensureGroup(fvName, cNameC)
            if (!groupC.committedFeatures.some(function(e) { return e.key === fc.key })) {
              groupC.committedFeatures.push(buildFeatureObj(fc))
              groupC.committedCount++
              if (fc.isBlocked) groupC.blockedCount++
            }
          }
        }
      }

      var groups = Object.keys(versionGroups).sort().map(function(vKey) {
        var vg = versionGroups[vKey]
        var compGroups = Object.keys(vg.components).sort().map(function(cKey) {
          return vg.components[cKey]
        })
        var totalRequested = 0
        var totalCommitted = 0
        var totalBlocked = 0
        for (var cgi = 0; cgi < compGroups.length; cgi++) {
          totalRequested += compGroups[cgi].requestedCount
          totalCommitted += compGroups[cgi].committedCount
          totalBlocked += compGroups[cgi].blockedCount
        }
        return {
          version: vg.version,
          components: compGroups,
          requestedCount: totalRequested,
          committedCount: totalCommitted,
          blockedCount: totalBlocked
        }
      })

      res.json({
        groups: groups,
        fetchedAt: new Date().toISOString(),
        filters: { components: componentNames, versions: versionNames }
      })
    } catch (err) {
      console.error('[releases/pm-hub] Component release load fetch failed:', err.message)
      res.status(500).json({ error: 'Failed to fetch component release load data' })
    }
  })
}
