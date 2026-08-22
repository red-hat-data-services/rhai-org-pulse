/**
 * PM Hub sub-router for the releases module.
 * Mounted at /api/modules/releases/pm-hub/ by the parent router.
 *
 * Provides endpoints for cross-project Jira metadata (components, versions)
 * and component-level release load data used by PM Hub reports.
 */

const { CUSTOM_FIELDS } = require('../hygiene/jira-fetch')
const { blockDuringImpersonation } = require('../../../../shared/server/auth')
const { JIRA_HOST } = require('../../../../shared/server/jira')
const { filterCommittedFixVersions, parseReleaseName, compareReleasesTemporally } = require('./committed-definition')
const { parseDescriptionSignals } = require('../planning/health/description-scanner')
const { computeFPDoRReadiness, isAiFirstFeature } = require('../planning/fpdor')
const { loadIndex } = require('../planning/cache-reader')
const { FEATURES_LIST_PROJECTS } = require('../planning/constants')
const { loadReleaseDatesMap } = require('../tv-fv-delta/alignment')
const { buildCanonicalFeatures } = require('../planning/feature-readiness')
const { fetchFeaturesWithTimeout } = require('../planning/feature-query')
const {
  buildComponentReleaseLoadGroups,
  attachAlignment: attachAlignmentFromCanonical
} = require('./canonical-load')
const { fetchDeliveredInVersion } = require('./delivered-in-version')

const JIRA_SEARCH = JIRA_HOST + '/issues/?jql='
/** Same Feature/Initiative population as Features List live fetch (RHAISTRAT + AIPCC). */
const PM_HUB_PROJECTS = FEATURES_LIST_PROJECTS
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

/**
 * PM/DO Aligned (legacy binary): Yes when some Fix Version strictly matches some Target Version.
 * Prefer alignmentCategory from attachAlignment() (TV/FV Delta 5-category rules) in PM Hub rows.
 * Missing TV or FV → not aligned. Early delivery (FV before TV) is NOT aligned under this binary helper.
 */
function versionsStrictMatch(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  var pa = parseReleaseName(a)
  var pb = parseReleaseName(b)
  if (!pa || !pb) return false
  if (pa.product !== pb.product || pa.major !== pb.major || pa.minor !== pb.minor) return false
  var cmp = compareReleasesTemporally(a, b)
  return cmp === 0
}

function computePmDoAligned(fixVersions, targetVersions) {
  var fvs = Array.isArray(fixVersions) ? fixVersions : []
  var tvs = Array.isArray(targetVersions) ? targetVersions : []
  if (fvs.length === 0 || tvs.length === 0) return false
  for (var i = 0; i < fvs.length; i++) {
    for (var j = 0; j < tvs.length; j++) {
      if (versionsStrictMatch(fvs[i], tvs[j])) return true
    }
  }
  return false
}

/**
 * Attach Delta 5-category alignment for a specific release bucket.
 * Mutates and returns featureObj.
 */
function attachAlignment(featureObj, release, releaseDates) {
  return attachAlignmentFromCanonical(featureObj, release, releaseDates)
}

function computeConfidence(isReady, fixVersion) {
  if (!isReady) return 'not-ready'
  if (fixVersion) return 'committed'
  return 'ready'
}

/**
 * Child-epics FPDoR count for PM Hub.
 * Prefer execution-index epicCount (same source as Features List / jira-sync).
 * Do not use hygiene openChildCount — that is only filled for terminal features
 * and counts any open child, not Epic children.
 *
 * @param {object} f - Transformed hygiene feature (or partial)
 * @param {object} [epicCountByKey] - Map of issue key → epicCount from execution index
 * @returns {number}
 */
function resolveEpicCount(f, epicCountByKey) {
  var key = f && f.key
  if (key && epicCountByKey && epicCountByKey[key] != null) {
    return epicCountByKey[key] || 0
  }
  if (f && f.epicCount != null) return f.epicCount || 0
  return 0
}

/**
 * Build a key → epicCount map from the execution index (one storage read).
 * @param {Function} readFromStorage
 * @returns {Promise<object>}
 */
async function loadEpicCountByKey(readFromStorage) {
  var byKey = {}
  try {
    var execIndex = await loadIndex(readFromStorage)
    var features = (execIndex && execIndex.features) || []
    for (var i = 0; i < features.length; i++) {
      var ef = features[i]
      if (ef && ef.key) byKey[ef.key] = ef.epicCount || 0
    }
  } catch (err) {
    console.warn('[releases/pm-hub] Failed to load execution epic counts:', err.message)
  }
  return byKey
}

function buildFeatureObj(f, targetVersions, rawIssue, epicCountByKey) {
  var tv = targetVersions || []
  var labels = Array.isArray(f.labels) ? f.labels : []
  var fixVersions = f.fixVersions || []
  var descriptionSignals = { hasContent: false, signalCount: 0 }
  if (rawIssue && rawIssue.fields) {
    var fields = rawIssue.fields
    var rendered = rawIssue.renderedFields || {}
    var desc = rendered.description != null ? rendered.description : fields.description
    descriptionSignals = parseDescriptionSignals(desc)
  }

  var fpdorInput = {
    labels: labels,
    targetVersions: tv,
    fixVersion: fixVersions.length > 0 ? fixVersions[0] : null,
    releaseType: f.releaseType || null,
    components: f.components || [],
    assignee: f.assignee || null,
    deliveryOwner: f.assignee || null,
    pmOwner: f.pmOwner || null,
    pm: f.pmOwner || null,
    priority: f.priority || null,
    riceScore: f.riceScore != null ? f.riceScore : null,
    docsRequired: f.docsRequired || null,
    linkedRfeKey: f.linkedRfeKey || null,
    sourceRfe: f.linkedRfeKey || null,
    descriptionSignals: descriptionSignals,
    epicCount: resolveEpicCount(f, epicCountByKey)
  }

  var fpdor = computeFPDoRReadiness(fpdorInput)
  var isAiFirst = isAiFirstFeature(fpdorInput)
  var confidence = computeConfidence(!!fpdor.allApplicablePassed, fpdorInput.fixVersion)

  return {
    key: f.key,
    summary: f.summary || '',
    title: f.summary || '',
    status: f.status || null,
    statusCategory: f.statusCategory || null,
    colorStatus: f.colorStatus || null,
    statusSummary: f.statusSummary || null,
    releaseType: f.releaseType || null,
    priority: f.priority || null,
    isBlocked: f.isBlocked || false,
    blockedBy: f.blockedBy || [],
    components: f.components || [],
    fixVersions: fixVersions,
    targetVersions: tv,
    alignmentCategory: null,
    pmDoAligned: computePmDoAligned(fixVersions, tv),
    assignee: f.assignee || null,
    pmOwner: f.pmOwner || null,
    docsRequired: f.docsRequired || null,
    labels: labels,
    riceScore: f.riceScore != null ? f.riceScore : null,
    linkedRfeKey: f.linkedRfeKey || null,
    fpdor: fpdor,
    isAiFirst: isAiFirst,
    confidence: confidence
  }
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

/**
 * @param {import('express').Router} router
 * @param {{ requireAuth: Function, requireScope: Function, jira: object, storage: object }} context
 */
module.exports = async function registerPmHubRoutes(router, context) {
  var jiraClient = context.jira || null

  /**
   * @openapi
   * /api/modules/releases/pm-hub/jira/components:
   *   get:
   *     tags: [Releases]
   *     summary: List Jira components across PM Hub projects
   *     description: Returns components from RHAISTRAT and AIPCC (same population as Features List)
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
   *     description: Returns versions from RHAISTRAT and AIPCC (same population as Features List)
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
   *       Builds Component Release Load from the shared Features pipeline
   *       (buildCanonicalFeatures over RHAISTRAT + AIPCC, open only — same as
   *       Features List). Groups by version then component.
   *       F Requested = Target Version matches a selected version.
   *       F Committed = Fix Version matches a selected version (FV only;
   *       Target Version does not gate Committed — see TV/FV Align for TV/FV relationship).
   *       TV/FV Align uses the Delta 5-category classifier.
   *       delivered is a fail-soft Closed/Done/Resolved list for selected Fix
   *       Versions (not merged into planning load). Empty when no versions are
   *       selected; timedOut true if that extra Jira search exceeds its own
   *       short timeout.
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
  router.get('/pillar-config', context.requireAuth, context.requireScope('releases:read'), async function(req, res) {
    var storage = context.storage
    var config = await storage.readFromStorage(PILLAR_CONFIG_FILE)
    if (!config) {
      config = DEFAULT_PILLAR_CONFIG
      await storage.writeToStorage(PILLAR_CONFIG_FILE, config)
    } else {
      var migrated = backfillLeads(config)
      if (migrated) {
        await storage.writeToStorage(PILLAR_CONFIG_FILE, config)
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
  router.put('/pillar-config', context.requireAuth, blockDuringImpersonation, context.requireScope('releases:write'), async function(req, res) {
    var err = validatePillarConfig(req.body)
    if (err) {
      return res.status(400).json({ error: err })
    }
    var config = { pillars: req.body.pillars }
    await context.storage.writeToStorage(PILLAR_CONFIG_FILE, config)
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
      var storage = context.storage
      var releaseDates = await loadReleaseDatesMap(storage)

      // Closed-in-version is a separate, version-required query. Do not fold it
      // into the open Features pipeline (gateway timeout). Fail soft.
      var deliveredPromise = fetchDeliveredInVersion(jiraClient, {
        versions: versionNames,
        components: componentNames
      })

      // Same live population as Features List (RHAISTRAT + AIPCC, open only).
      var jiraFeatures = null
      try {
        jiraFeatures = await fetchFeaturesWithTimeout(jiraClient)
      } catch (jiraErr) {
        console.warn('[releases/pm-hub] Jira feature query failed, falling back to caches:', jiraErr.message)
      }

      var canonical = await buildCanonicalFeatures({
        readFromStorage: storage.readFromStorage,
        jiraFeatures: jiraFeatures,
        listStorageFiles: storage.listStorageFiles || null,
        includeClosed: false
      })

      var built = buildComponentReleaseLoadGroups(canonical.features || [], {
        components: componentNames,
        versions: versionNames,
        releaseDates: releaseDates
      })

      var delivered = await deliveredPromise

      // Velocity KPI hidden for now — keep computeVelocity() for a future report.
      res.json({
        groups: built.groups,
        velocity: null,
        delivered: delivered,
        fetchedAt: new Date().toISOString(),
        filters: { components: componentNames, versions: versionNames },
        source: jiraFeatures ? 'canonical-live' : 'canonical-cache'
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
module.exports.buildFeatureObj = buildFeatureObj
module.exports.resolveEpicCount = resolveEpicCount
module.exports.loadEpicCountByKey = loadEpicCountByKey
module.exports.extractTargetVersions = extractTargetVersions
module.exports.filterCommittedFixVersions = filterCommittedFixVersions
module.exports.computePmDoAligned = computePmDoAligned
module.exports.versionsStrictMatch = versionsStrictMatch
module.exports.attachAlignment = attachAlignment
