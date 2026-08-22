const fs = require('fs')
const path = require('path')
const { cacheGet, cacheSet } = require('./cache')
const { CACHE_TTL_MS, getReleaseConfig } = require('./config')
const {
  transformRfeIssue,
  transformFeatureIssue,
  RFE_FIELDS,
  FEATURE_FIELDS
} = require('./jira-transform')

const DATA_DIR = path.join(__dirname, 'content')

let classifierPromise = null

function getClassifier() {
  if (!classifierPromise) {
    classifierPromise = import('./pipeline-classifier/index.js')
  }
  return classifierPromise
}

function loadJson(name) {
  const filePath = path.join(DATA_DIR, name)
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function loadResources() {
  return loadJson('resources.json')
}

function loadPlaybooks() {
  return loadJson('playbooks.json')
}

function loadPmRoster() {
  return loadJson('pm-roster.json')
}

function quoteJql(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function buildFixVersionClause(fixVersions) {
  return fixVersions.map(v => quoteJql(v)).join(', ')
}

async function fetchEpicCounts(fetchAllJqlResults, stratKeys) {
  if (!stratKeys.length) return {}
  const counts = {}
  const batchSize = 30
  for (let i = 0; i < stratKeys.length; i += batchSize) {
    const batch = stratKeys.slice(i, i + batchSize)
    const jql = `parent in (${batch.join(', ')}) AND project = RHAI`
    try {
      const issues = await fetchAllJqlResults(jql, 'parent', { maxResults: 100 })
      for (const issue of issues) {
        const parentKey = issue.fields?.parent?.key
        if (parentKey) {
          counts[parentKey] = (counts[parentKey] || 0) + 1
        }
      }
    } catch (err) {
      console.warn('[pm-pipeline] Epic count fetch failed:', err.message)
    }
  }
  return counts
}

/**
 * Fetch and classify pipeline for a PM.
 * @param {{ pmDisplayName: string, release?: string }} opts
 * @param {{ fetchAllJqlResults: Function, JIRA_HOST: string }} jira
 */
async function fetchPipelineForPm(opts, jira) {
  const { pmDisplayName, release } = opts
  const { fetchAllJqlResults, JIRA_HOST } = jira
  const { buildPipeline, buildStats } = await getClassifier()

  const releaseConfig = getReleaseConfig(release)
  const cacheKey = `pipeline:${pmDisplayName}:${releaseConfig.release}`
  const cached = cacheGet(cacheKey)
  if (cached) return cached

  const pm = quoteJql(pmDisplayName)
  const fixClause = buildFixVersionClause(releaseConfig.fixVersions)

  const rfeJql = `project = RHAIRFE AND reporter = ${pm} AND status != Closed ORDER BY updated DESC`
  const featureJql = [
    'project in (RHAISTRAT, AIPCC)',
    'AND issuetype in (Feature, Initiative)',
    `AND "Product Manager" = ${pm}`,
    'AND status != Closed',
    `AND fixVersion in (${fixClause})`,
    'ORDER BY updated DESC'
  ].join(' ')

  const [rfeRaw, featureRaw] = await Promise.all([
    fetchAllJqlResults(rfeJql, RFE_FIELDS),
    fetchAllJqlResults(featureJql, FEATURE_FIELDS)
  ])

  const stratKeys = featureRaw.map(i => i.key)
  const epicCounts = await fetchEpicCounts(fetchAllJqlResults, stratKeys)

  const rfes = rfeRaw.map(transformRfeIssue)
  const features = featureRaw.map(raw => transformFeatureIssue(raw, epicCounts))

  const linkedRfeKeys = new Set(
    features.map(f => f.linkedRfeKey).filter(Boolean)
  )
  const orphanRfes = rfes.filter(r => !r.linkedFeature && !linkedRfeKeys.has(r.key))
  const linkedRfes = rfes.filter(r => r.linkedFeature || linkedRfeKeys.has(r.key))

  const normalized = [...orphanRfes, ...features]

  const resources = loadResources()
  const playbooks = loadPlaybooks()

  const items = buildPipeline(normalized, {
    resources,
    playbooks,
    release: releaseConfig.release,
    jiraHost: JIRA_HOST
  })

  const result = {
    pmDisplayName,
    release: releaseConfig.release,
    fetchedAt: new Date().toISOString(),
    stats: buildStats(items),
    items,
    meta: {
      rfeCount: rfes.length,
      featureCount: features.length,
      orphanRfeCount: orphanRfes.length,
      linkedRfeCount: linkedRfes.length
    }
  }

  cacheSet(cacheKey, result, CACHE_TTL_MS)
  return result
}

module.exports = {
  fetchPipelineForPm,
  loadResources,
  loadPlaybooks,
  loadPmRoster
}
