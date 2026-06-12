/**
 * PM Hub sub-router for the releases module.
 * Mounted at /api/modules/releases/pm-hub/ by the parent router.
 *
 * Provides endpoints for cross-project Jira metadata (components, versions)
 * and component-level release load data used by PM Hub reports.
 */

const { CUSTOM_FIELDS, transformIssue } = require('../hygiene/jira-fetch')
const { blockDuringImpersonation } = require('../../../../shared/server/auth')
const { JIRA_HOST } = require('../../../../shared/server/jira')

const JIRA_SEARCH = JIRA_HOST + '/issues/?jql='
const PM_HUB_PROJECTS = ['RHAIENG', 'RHOAIENG', 'INFERENG', 'AIPCC', 'RHAISTRAT', 'RHAIRFE']
const PILLAR_CONFIG_FILE = 'releases/pm-hub/pillar-config.json'

var DEFAULT_PILLAR_CONFIG = {
  pillars: [
    {
      name: 'Inference',
      components: [
        { name: 'llm-d', pmLead: 'Naina Singh', engLead: 'Anish Asthana' },
        { name: 'vllm', pmLead: 'Yuchen Fama', engLead: 'Ashraf Bhuiyan' },
        { name: 'Inference Midstream', pmLead: 'Erwan Gallen', engLead: 'Selbi Nuryyeva' },
        { name: 'llm-compressor', pmLead: 'Rob Greenberg', engLead: 'Dipika Sikka' },
        { name: 'Optimized Models', pmLead: 'Rob Greenberg', engLead: 'Alexandre Marques' },
        { name: 'Model Validation', pmLead: 'Rob Greenberg', engLead: 'Aviran Badli' },
        { name: 'Tool calling', pmLead: 'Rob Greenberg, Yuchen Fama', engLead: 'Cat Weeks, Aviran Badli, Ben Browning' },
        { name: 'AI security -model validation', pmLead: 'Rob Greenberg, William Caban, Adam Bellusci', engLead: 'Stuart Battersby, Dominik Dahlem, Aviran Badli' },
        { name: 'Model Serving Runtimes', pmLead: 'Adam Bellusci', engLead: 'Steven Grubb' },
        { name: 'Serving Orchestration', pmLead: 'Adam Bellusci', engLead: 'Yuan Tang' },
        { name: 'PSAP', pmLead: 'Yuchen Fama', engLead: 'Ashish Kamra' }
      ]
    },
    {
      name: 'Data',
      components: [
        { name: 'EvalHub / Model Eval', pmLead: 'William Caban', engLead: 'Rui Vieira, Marius Danciu' },
        { name: 'AutoRAG / RAG', pmLead: 'Suhas Kashyap', engLead: 'Lukasz Cmielowski' },
        { name: 'AutoML', pmLead: 'Aditi Saluja', engLead: 'Lukasz Cmielowski' },
        { name: 'Development platform', pmLead: 'Jehlum Pandit', engLead: 'Doug Hellmann' },
        { name: 'Data Processing', pmLead: 'Jehlum Pandit', engLead: 'Francisco Arceo, Chris Bynum' },
        { name: 'SDG', pmLead: 'Aditi Saluja', engLead: 'Abhishek Bhanwaldar' },
        { name: 'Training Hub', pmLead: 'Aditi Saluja', engLead: 'Mustafa Eyceoz' },
        { name: 'Fine Tuning / Kubeflow-Dev', pmLead: 'Aditi Saluja', engLead: 'Brian Gallagher' },
        { name: 'Kubeflow Training', pmLead: 'Christoph Görn', engLead: 'Umberto Manganiello' },
        { name: 'Ray Training', pmLead: 'Christoph Görn', engLead: 'Laura Fitzgerald' },
        { name: 'Inference Time Techniques', pmLead: 'Luke Inglis', engLead: 'Yi Zheng' }
      ]
    },
    {
      name: 'Agents',
      components: [
        { name: 'GenAI Studio', pmLead: 'Peter Double', engLead: 'Eder Ignatowicz' },
        { name: 'AgentOps', pmLead: 'Adel Zaalouk', engLead: 'Roland Huß, Dimitri Saridakis' },
        { name: 'AgentDev', pmLead: 'Adel Zaalouk', engLead: 'Bill Murdock, Justin Sun' },
        { name: 'OGX (formerly Llama Stack) core', pmLead: 'Adel Zaalouk', engLead: 'Sebastien Han, Francisco Arceo, Eric Duen' },
        { name: 'Agentic and AI Tooling Experience', pmLead: 'Jehlum Pandit', engLead: 'Ann Marie Fred, Nick Ommen' },
        { name: 'PSAP agentic', pmLead: '', engLead: 'Alex Calhoun / Tanya Osokin' },
        { name: 'Model Context Protocol', pmLead: 'Peter Double', engLead: '' }
      ]
    },
    {
      name: 'Platform',
      components: [
        { name: 'MaaS', pmLead: 'Jonathan Zarecki', engLead: 'Yuan Tang, Lindani Phiri' },
        { name: 'AI Gateway', pmLead: 'Jonathan Zarecki', engLead: 'Shane Utt' },
        { name: 'GPUaaS', pmLead: 'Christoph Goern', engLead: 'Luca Burgazzoli' },
        { name: 'AI Hub', pmLead: 'Adam Bellusci', engLead: 'Chris Hambridge' },
        { name: 'Observability', pmLead: 'Suhas Kashyap', engLead: 'Arik Hadas' },
        { name: 'AI Safety', pmLead: 'William Caban', engLead: 'Stuart Battersby/Rob Geada/Rui Vieira' },
        { name: 'AI Navigator', pmLead: 'Suhas Kashyap', engLead: 'Amit Oren' },
        { name: 'Feature Store', pmLead: 'Jonathan Zarecki, Kezia Cook', engLead: 'Umberto Manganiello' },
        { name: 'Notebook Server', pmLead: 'Kezia Cook', engLead: 'Andy Stoneberg' },
        { name: 'Notebook images and extensions', pmLead: 'Kezia Cook', engLead: 'Nick Ommen' },
        { name: 'AI Pipelines', pmLead: 'Myriam Fentanes Gutierrez', engLead: 'Edson Tirelli' },
        { name: 'AI Core Platform', pmLead: 'Myriam Fentanes Gutierrez', engLead: 'Lindani Phiri' },
        { name: 'MLflow', pmLead: 'Myriam Fentanes Gutierrez', engLead: 'Lindani Phiri' },
        { name: 'AI Core Dashboard', pmLead: 'Jenny Yi', engLead: 'Eder Ignatowicz' }
      ]
    },
    {
      name: 'Undefined',
      components: [
        { name: 'AAET DevOps', pmLead: '', engLead: '' },
        { name: 'AI Core Platform Security', pmLead: '', engLead: '' },
        { name: 'AI Eng Agilist', pmLead: '', engLead: '' },
        { name: 'AI Evaluations', pmLead: '', engLead: '' },
        { name: 'AI Field Enablement', pmLead: '', engLead: '' },
        { name: 'AI First', pmLead: '', engLead: '' },
        { name: 'AI Platform DevOps', pmLead: '', engLead: '' },
        { name: 'AI Research + Community', pmLead: '', engLead: '' },
        { name: 'AI Testing + Workflow Validation', pmLead: '', engLead: '' },
        { name: 'AIPCC Ecosystems', pmLead: '', engLead: '' },
        { name: 'AIPCC Productization', pmLead: '', engLead: '' },
        { name: 'Accelerator Enablement', pmLead: '', engLead: '' },
        { name: 'Accelerator Platform', pmLead: '', engLead: '' },
        { name: 'Agentic', pmLead: '', engLead: '' },
        { name: 'Agile Roadmap', pmLead: '', engLead: '' },
        { name: 'AutoRAG', pmLead: '', engLead: '' },
        { name: 'BSA', pmLead: '', engLead: '' },
        { name: 'Build and Release', pmLead: '', engLead: '' },
        { name: 'CI/CD', pmLead: '', engLead: '' },
        { name: 'Compressed-Tensors', pmLead: '', engLead: '' },
        { name: 'Customer Exploration & Test', pmLead: '', engLead: '' },
        { name: 'DevOps', pmLead: '', engLead: '' },
        { name: 'DevTestOps', pmLead: '', engLead: '' },
        { name: 'Distributed Workloads', pmLead: '', engLead: '' },
        { name: 'Documentation', pmLead: '', engLead: '' },
        { name: 'Experiment Tracking', pmLead: '', engLead: '' },
        { name: 'Explainability', pmLead: '', engLead: '' },
        { name: 'Fine Tuning', pmLead: '', engLead: '' },
        { name: 'Gen AI Studio', pmLead: '', engLead: '' },
        { name: 'IBM P', pmLead: '', engLead: '' },
        { name: 'IBM Z', pmLead: '', engLead: '' },
        { name: 'INFERENG Midstream', pmLead: '', engLead: '' },
        { name: 'Inference Extensions', pmLead: '', engLead: '' },
        { name: 'Inference Gateway', pmLead: '', engLead: '' },
        { name: 'Inference Research', pmLead: '', engLead: '' },
        { name: 'Inference-Time Techniques', pmLead: '', engLead: '' },
        { name: 'Infra Midstream', pmLead: '', engLead: '' },
        { name: 'InfraOps', pmLead: '', engLead: '' },
        { name: 'Integrations', pmLead: '', engLead: '' },
        { name: 'Internal Processes & Documentation', pmLead: '', engLead: '' },
        { name: 'KubeRay', pmLead: '', engLead: '' },
        { name: 'Kubeflow Spark Operator', pmLead: '', engLead: '' },
        { name: 'Kubeflow Unified SDK', pmLead: '', engLead: '' },
        { name: 'LLM Compressor', pmLead: '', engLead: '' },
        { name: 'Llama Stack Core', pmLead: '', engLead: '' },
        { name: 'LlamaStack', pmLead: '', engLead: '' },
        { name: 'MLR Speculative Decoding', pmLead: '', engLead: '' },
        { name: 'Model Customization', pmLead: '', engLead: '' },
        { name: 'Model Eval', pmLead: '', engLead: '' },
        { name: 'Model Explainability', pmLead: '', engLead: '' },
        { name: 'Model Runtimes', pmLead: '', engLead: '' },
        { name: 'Model Server', pmLead: '', engLead: '' },
        { name: 'Model Serving', pmLead: '', engLead: '' },
        { name: 'Model and Agent Observability', pmLead: '', engLead: '' },
        { name: 'Model as a Service', pmLead: '', engLead: '' },
        { name: 'Monitoring', pmLead: '', engLead: '' },
        { name: 'Notebooks', pmLead: '', engLead: '' },
        { name: 'Notebooks Extensions', pmLead: '', engLead: '' },
        { name: 'Notebooks Images', pmLead: '', engLead: '' },
        { name: 'Notebooks Server', pmLead: '', engLead: '' },
        { name: 'OGX Core', pmLead: '', engLead: '' },
        { name: 'OpenShift AI Productization', pmLead: '', engLead: '' },
        { name: 'PXE', pmLead: '', engLead: '' },
        { name: 'PerfScale', pmLead: '', engLead: '' },
        { name: 'Project Navigator', pmLead: '', engLead: '' },
        { name: 'PyTorch', pmLead: '', engLead: '' },
        { name: 'QE', pmLead: '', engLead: '' },
        { name: 'RAG', pmLead: '', engLead: '' },
        { name: 'RAG + Vector DB', pmLead: '', engLead: '' },
        { name: 'RAG_Agentic', pmLead: '', engLead: '' },
        { name: 'Security', pmLead: '', engLead: '' },
        { name: 'Speculators', pmLead: '', engLead: '' },
        { name: 'TestOps', pmLead: '', engLead: '' },
        { name: 'Tooling Experience', pmLead: '', engLead: '' },
        { name: 'Training', pmLead: '', engLead: '' },
        { name: 'Training Kubeflow', pmLead: '', engLead: '' },
        { name: 'TrustyAI', pmLead: '', engLead: '' },
        { name: 'UXD', pmLead: '', engLead: '' },
        { name: 'Update This Field With Components', pmLead: '', engLead: '' },
        { name: 'Wheel Package Index', pmLead: '', engLead: '' },
        { name: 'Wheel building', pmLead: '', engLead: '' },
        { name: 'Workbenches/IDE', pmLead: '', engLead: '' },
        { name: 'Workload Orchestration', pmLead: '', engLead: '' },
        { name: 'guide-llm', pmLead: '', engLead: '' },
        { name: 'internal process', pmLead: '', engLead: '' },
        { name: 'llama.cpp', pmLead: '', engLead: '' },
        { name: 'to-refine', pmLead: '', engLead: '' },
        { name: 'vLLM Runtime', pmLead: '', engLead: '' },
        { name: 'watsonx Orchestrate Collaboration', pmLead: '', engLead: '' }
      ]
    }
  ]
}

function validatePillarConfig(data) {
  if (!data || !Array.isArray(data.pillars)) return 'pillars must be an array'
  for (var i = 0; i < data.pillars.length; i++) {
    var p = data.pillars[i]
    if (!p.name || typeof p.name !== 'string') return 'pillar at index ' + i + ' must have a name string'
    if (!Array.isArray(p.components)) return 'pillar "' + p.name + '" must have a components array'
    for (var j = 0; j < p.components.length; j++) {
      var c = p.components[j]
      if (typeof c === 'string') continue
      if (typeof c === 'object' && c !== null && typeof c.name === 'string') continue
      return 'components in pillar "' + p.name + '" must be strings or objects with a name'
    }
  }
  return null
}

function _getComponentName(comp) {
  return typeof comp === 'string' ? comp : (comp && comp.name) || ''
}

function backfillLeads(config) {
  var defaultMap = {}
  for (var di = 0; di < DEFAULT_PILLAR_CONFIG.pillars.length; di++) {
    var dp = DEFAULT_PILLAR_CONFIG.pillars[di]
    for (var dci = 0; dci < dp.components.length; dci++) {
      var dc = dp.components[dci]
      if (typeof dc === 'object' && dc !== null && dc.name) {
        defaultMap[dc.name.toLowerCase()] = dc
      }
    }
  }

  var changed = false
  for (var pi = 0; pi < config.pillars.length; pi++) {
    var pillar = config.pillars[pi]
    for (var ci = 0; ci < pillar.components.length; ci++) {
      var comp = pillar.components[ci]
      var compName = _getComponentName(comp)
      if (!compName) continue
      var defaults = defaultMap[compName.toLowerCase()]

      if (typeof comp === 'string') {
        var obj = { name: comp }
        obj.pmLead = (defaults && defaults.pmLead) || ''
        obj.engLead = (defaults && defaults.engLead) || ''
        pillar.components[ci] = obj
        changed = true
      } else if (typeof comp === 'object' && comp !== null) {
        if (!comp.pmLead && !comp.engLead && defaults && (defaults.pmLead || defaults.engLead)) {
          comp.pmLead = defaults.pmLead || ''
          comp.engLead = defaults.engLead || ''
          changed = true
        }
      }
    }
  }
  return changed
}

var VELOCITY_LOOKBACK_WEEKS = 52

/**
 * Compute per-component velocity from resolved Jira issues, then return a
 * weighted average across components.
 *
 * For each component:
 *   velocity_i = resolved_i / distinct_releases_i
 *
 * Weighted average = Σ(velocity_i × resolved_i) / Σ(resolved_i)
 *   — components that ship more features carry more weight.
 *
 * @param {Array} rawIssues - Raw Jira issues (statusCategory = Done, fixVersion set)
 * @param {string} componentClause - JQL component clause for verification URLs
 * @returns {{ avgPerRelease: string, totalResolved: number, components: Array, jql: string }}
 */
function computeVelocity(rawIssues, componentClause, nowDate, selectedComponents) {
  var now = nowDate ? new Date(nowDate) : new Date()

  // Build a lookup set for selected components (when provided, only group by these)
  var selectedSet = null
  if (Array.isArray(selectedComponents) && selectedComponents.length > 0) {
    selectedSet = {}
    for (var si = 0; si < selectedComponents.length; si++) {
      selectedSet[selectedComponents[si]] = true
    }
  }

  // Group issues by component → { resolved keys, version set, earliest resolution }
  var compMap = {}
  for (var i = 0; i < rawIssues.length; i++) {
    var raw = rawIssues[i]
    var key = raw.key
    var fields = raw.fields || {}
    var comps = fields.components
    if (!Array.isArray(comps) || comps.length === 0) comps = [{ name: 'No Component' }]
    var fvs = fields.fixVersions
    if (!Array.isArray(fvs)) continue

    var resolvedDate = fields.resolutiondate ? new Date(fields.resolutiondate) : null

    for (var ci = 0; ci < comps.length; ci++) {
      var cName = comps[ci] && comps[ci].name
      if (!cName) continue
      if (selectedSet && !selectedSet[cName]) continue
      if (!compMap[cName]) compMap[cName] = { seen: {}, versions: {}, earliestResolved: null }
      var entry = compMap[cName]
      if (entry.seen[key]) continue
      entry.seen[key] = true

      if (resolvedDate && !isNaN(resolvedDate.getTime())) {
        if (!entry.earliestResolved || resolvedDate < entry.earliestResolved) {
          entry.earliestResolved = resolvedDate
        }
      }

      for (var vi = 0; vi < fvs.length; vi++) {
        var vName = fvs[vi] && fvs[vi].name
        if (vName) entry.versions[vName] = (entry.versions[vName] || 0) + 1
      }
    }
  }

  // Compute per-component velocity and age-weighted average
  var compNames = Object.keys(compMap)
  var totalResolved = 0
  var weightedSum = 0
  var weightedDenom = 0
  var hasPartialYear = false
  var perComponent = []

  for (var k = 0; k < compNames.length; k++) {
    var name = compNames[k]
    var data = compMap[name]
    var resolved = Object.keys(data.seen).length
    var releases = Object.keys(data.versions).length
    var vel = releases > 0 ? resolved / releases : 0

    // Determine team age from earliest resolution date
    var activeWeeks = VELOCITY_LOOKBACK_WEEKS
    var isPartialYear = false
    if (data.earliestResolved) {
      var diffMs = now.getTime() - data.earliestResolved.getTime()
      activeWeeks = Math.max(1, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)))
      if (activeWeeks < VELOCITY_LOOKBACK_WEEKS) {
        isPartialYear = true
        hasPartialYear = true
      }
    }

    var ageFactor = Math.min(activeWeeks / VELOCITY_LOOKBACK_WEEKS, 1)

    totalResolved += resolved
    weightedSum += vel * resolved * ageFactor
    weightedDenom += resolved * ageFactor

    perComponent.push({
      component: name,
      resolved: resolved,
      releases: releases,
      avgPerRelease: formatAvg(vel),
      activeWeeks: activeWeeks,
      isPartialYear: isPartialYear
    })
  }

  var avg = weightedDenom > 0 ? weightedSum / weightedDenom : 0

  var jqlParts = [
    'project IN (' + PM_HUB_PROJECTS.join(', ') + ')',
    'issuetype IN (Feature, Initiative)',
    'statusCategory = Done',
    'resolved >= -' + VELOCITY_LOOKBACK_WEEKS + 'w',
    'fixVersion is not EMPTY'
  ]
  if (componentClause) jqlParts.push(componentClause)
  var jql = jqlParts.join(' AND ')

  return {
    avgPerRelease: totalResolved > 0 ? formatAvg(avg) : '—',
    totalResolved: totalResolved,
    hasPartialYear: hasPartialYear,
    components: perComponent,
    jql: JIRA_SEARCH + encodeURIComponent(jql)
  }
}

function formatAvg(value) {
  return value % 1 === 0 ? String(value) : value.toFixed(1)
}

const DEFAULT_ISSUE_TYPES = ['Feature', 'Initiative']
const FIELDS_TO_FETCH = [
  'summary', 'status', 'issuetype', 'assignee', 'fixVersions', 'versions',
  'components', 'labels', 'issuelinks',
  CUSTOM_FIELDS.team,
  CUSTOM_FIELDS.releaseType,
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
  /**
   * @openapi
   * /api/modules/releases/pm-hub/pillar-config:
   *   get:
   *     tags: [Releases]
   *     summary: Get pillar-to-component mapping config
   *     description: Returns the pillar configuration used to group Jira components. Seeds defaults if none exists.
   *     responses:
   *       200:
   *         description: Pillar config object with pillars array
   */
  router.get('/pillar-config', context.requireAuth, context.requireScope('releases:read'), function(req, res) {
    var storage = context.storage
    var config = storage.readFromStorage(PILLAR_CONFIG_FILE)
    if (!config) {
      config = DEFAULT_PILLAR_CONFIG
      storage.writeToStorage(PILLAR_CONFIG_FILE, config)
    } else {
      var migrated = backfillLeads(config)
      if (migrated) {
        storage.writeToStorage(PILLAR_CONFIG_FILE, config)
      }
    }
    res.json(config)
  })

  /**
   * @openapi
   * /api/modules/releases/pm-hub/pillar-config:
   *   put:
   *     tags: [Releases]
   *     summary: Update pillar-to-component mapping config
   *     description: Saves an updated pillar configuration. Admin only.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               pillars:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     name: { type: string }
   *                     components:
   *                       type: array
   *                       items:
   *                         oneOf:
   *                           - type: string
   *                           - type: object
   *                             properties:
   *                               name: { type: string }
   *                               pmLead: { type: string }
   *                               engLead: { type: string }
   *     responses:
   *       200:
   *         description: Updated pillar config
   *       400:
   *         description: Invalid config shape
   */
  router.put('/pillar-config', context.requireAuth, blockDuringImpersonation, context.requireScope('releases:write'), function(req, res) {
    var err = validatePillarConfig(req.body)
    if (err) {
      return res.status(400).json({ error: err })
    }
    var config = { pillars: req.body.pillars }
    context.storage.writeToStorage(PILLAR_CONFIG_FILE, config)
    res.json(config)
  })

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
          statusCategory: f.statusCategory || null,
          colorStatus: f.colorStatus || null,
          statusSummary: f.statusSummary || null,
          releaseType: f.releaseType || null,
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

      // Query 3: Velocity — resolved features in the last year with a fixVersion
      var velocityIssues = []
      if (componentClause) {
        var velJqlParts = baseParts.slice()
        velJqlParts.push(componentClause)
        velJqlParts.push('statusCategory = Done')
        velJqlParts.push('resolved >= -' + VELOCITY_LOOKBACK_WEEKS + 'w')
        velJqlParts.push('fixVersion is not EMPTY')
        var velJql = velJqlParts.join(' AND ')
        velocityIssues = await jiraClient.fetchAllJqlResults(velJql, 'summary,status,fixVersions,components,resolutiondate', {})
      }

      var velocity = computeVelocity(velocityIssues, componentClause, null, componentNames)

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
        velocity: velocity,
        fetchedAt: new Date().toISOString(),
        filters: { components: componentNames, versions: versionNames }
      })
    } catch (err) {
      console.error('[releases/pm-hub] Component release load fetch failed:', err.message)
      res.status(500).json({ error: 'Failed to fetch component release load data' })
    }
  })
}

module.exports.DEFAULT_PILLAR_CONFIG = DEFAULT_PILLAR_CONFIG
module.exports.validatePillarConfig = validatePillarConfig
module.exports.PILLAR_CONFIG_FILE = PILLAR_CONFIG_FILE
module.exports.backfillLeads = backfillLeads
module.exports.computeVelocity = computeVelocity
