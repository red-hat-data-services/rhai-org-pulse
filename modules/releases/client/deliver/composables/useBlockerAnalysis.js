import { computed, ref } from 'vue'

const DECISIONS = ['Yes', 'No', 'Unknown']

function normalizeDecision(value) {
  var normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'yes' || normalized === 'true') return 'Yes'
  if (normalized === 'no' || normalized === 'false') return 'No'
  return 'Unknown'
}

function decisionCounts() {
  return { yes: 0, no: 0, unknown: 0 }
}

function incrementDecision(counts, value) {
  var decision = normalizeDecision(value).toLowerCase()
  counts[decision]++
}

function uniqueValues(value) {
  var values = Array.isArray(value) ? value : []
  return Array.from(new Set(values.map(function (entry) { return String(entry || '').trim() }).filter(Boolean)))
}

function releaseLabels(issue) {
  var trendVersions = uniqueValues(issue.trendReleases)
  if (trendVersions.length) return trendVersions
  var versions = uniqueValues(issue.fixVersions)
  return versions.length ? versions : ['No Fix Version']
}

function componentLabels(issue) {
  var components = uniqueValues(issue.components)
  return components.length ? components : ['(No component)']
}

function compareReleaseNames(left, right) {
  var a = String(left || '').toLowerCase()
  var b = String(right || '').toLowerCase()
  var av = a.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/) || []
  var bv = b.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/) || []
  for (var i = 1; i <= 3; i++) {
    var an = av[i] ? Number(av[i]) : Number.MAX_SAFE_INTEGER
    var bn = bv[i] ? Number(bv[i]) : Number.MAX_SAFE_INTEGER
    if (an !== bn) return an - bn
  }
  return a.localeCompare(b)
}

function newGroup(label) {
  return {
    label: label,
    approved: 0,
    rejected: 0,
    total: 0,
    regression: decisionCounts(),
    earlierIdentification: decisionCounts(),
    prereleaseCveRemediation: 0,
    earlyDetectionCategories: {},
    preventionCategories: {}
  }
}

function addToGroup(group, issue) {
  group.total++
  if (issue.releaseBlocker === 'Approved') group.approved++
  if (issue.releaseBlocker === 'Rejected') group.rejected++
  incrementDecision(group.regression, issue.regression)
  incrementDecision(group.earlierIdentification, issue.couldIdentifyEarlier)
  if (issue.hasPrereleaseCveLabel) group.prereleaseCveRemediation++

  var detection = issue.earlyDetectionCategory || 'Unknown'
  var prevention = issue.preventionCategory || 'Unknown'
  group.earlyDetectionCategories[detection] = (group.earlyDetectionCategories[detection] || 0) + 1
  group.preventionCategories[prevention] = (group.preventionCategories[prevention] || 0) + 1
}

function normalizeIssue(source) {
  var issue = source && typeof source === 'object' ? source : {}
  var labels = uniqueValues(issue.labels)
  var regression = normalizeDecision(issue.isRegression || issue.regression)
  var couldIdentifyEarlier = normalizeDecision(issue.couldIdentifyEarlier)
  return {
    key: String(issue.key || '').trim(),
    link: issue.link || null,
    summary: String(issue.summary || ''),
    components: uniqueValues(issue.components),
    fixVersions: uniqueValues(issue.fixVersions),
    trendReleases: uniqueValues(issue.trendReleases),
    releaseBlocker: issue.releaseBlockerStatus || issue.releaseBlocker,
    labels: labels,
    hasPrereleaseCveLabel: labels.includes('prerelease-cve-remediation'),
    proposedDate: issue.latestProposedDate || issue.proposedDate || null,
    regression: regression,
    regressionEvidence: regression === 'Unknown' ? null : 'Derived from the existing Jira comment signal.',
    couldIdentifyEarlier: couldIdentifyEarlier,
    earlyDetectionResponse: issue.earlyDetectionResponse ? String(issue.earlyDetectionResponse) : null,
    earlyDetectionCategory: String(issue.earlyDetectionCategory || 'Unknown'),
    preventionCategory: String(issue.preventionCategory || 'Unknown'),
    prevention: issue.prevention ? String(issue.prevention) : null,
    earlyIdentificationEvidence: issue.earlyIdentificationEvidence ? String(issue.earlyIdentificationEvidence) : null,
    analysisConfidence: issue.analysisConfidence
      ? String(issue.analysisConfidence)
      : (couldIdentifyEarlier === 'Unknown' ? 'Unknown — no qualifying comment response was found' : 'Deterministic Jira comment classification')
  }
}

function countMap(values) {
  return Object.entries(values).sort(function (a, b) {
    return b[1] - a[1] || a[0].localeCompare(b[0])
  }).map(function (entry) {
    return { label: entry[0], count: entry[1] }
  })
}

function buildLocalAnalysis(rows, fetchedAt) {
  var seen = new Set()
  var issues = []
  var sourceRows = Array.isArray(rows) ? rows : []

  for (var i = 0; i < sourceRows.length; i++) {
    var source = sourceRows[i]
    var outcome = source && (source.releaseBlockerStatus || source.releaseBlocker)
    if (outcome !== 'Approved' && outcome !== 'Rejected') continue
    var issue = normalizeIssue(source)
    if (!issue.key || seen.has(issue.key)) continue
    seen.add(issue.key)
    issues.push(issue)
  }

  var overall = {
    totalAnalyzed: issues.length,
    regression: decisionCounts(),
    earlierIdentification: decisionCounts(),
    prereleaseCveRemediation: 0
  }
  var byRelease = new Map()
  var byComponent = new Map()
  var detectionCategories = {}
  var preventionCategories = {}

  issues.forEach(function (issue) {
    incrementDecision(overall.regression, issue.regression)
    incrementDecision(overall.earlierIdentification, issue.couldIdentifyEarlier)
    if (issue.hasPrereleaseCveLabel) overall.prereleaseCveRemediation++

    var detection = issue.earlyDetectionCategory || 'Unknown'
    var prevention = issue.preventionCategory || 'Unknown'
    detectionCategories[detection] = (detectionCategories[detection] || 0) + 1
    preventionCategories[prevention] = (preventionCategories[prevention] || 0) + 1

    releaseLabels(issue).forEach(function (label) {
      if (!byRelease.has(label)) byRelease.set(label, newGroup(label))
      addToGroup(byRelease.get(label), issue)
    })
    componentLabels(issue).forEach(function (label) {
      if (!byComponent.has(label)) byComponent.set(label, newGroup(label))
      addToGroup(byComponent.get(label), issue)
    })
  })

  var issueKeys = issues.map(function (issue) { return issue.key }).slice(0, 5)
  var insights = []
  if (issues.length) {
    insights.push({
      text: 'This view is analyzing the Approved and Rejected issues already loaded from Jira; no workflow or additional AI call is required.',
      evidenceCount: issues.length,
      issueKeys: issueKeys
    })
    if (overall.regression.unknown === issues.length) {
      insights.push({
        text: 'Regression status is Unknown for every issue because the loaded Jira comment signal did not identify a regression.',
        evidenceCount: issues.length,
        issueKeys: issueKeys
      })
    }
  }

  var releaseGroups = Array.from(byRelease.values()).sort(function (a, b) { return compareReleaseNames(a.label, b.label) })
  var componentGroups = Array.from(byComponent.values()).sort(function (a, b) { return a.label.localeCompare(b.label) })

  return {
    generatedAt: fetchedAt || new Date().toISOString(),
    fetchedAt: fetchedAt || null,
    model: 'Existing Jira issue data',
    promptVersion: null,
    source: { type: 'release-blockers-awareness', issueCount: issues.length },
    partial: false,
    errors: [],
    issues: issues,
    aggregates: {
      overall: overall,
      byRelease: releaseGroups,
      byComponent: componentGroups,
      topEarlyDetectionCategories: countMap(detectionCategories),
      topPreventionActions: countMap(preventionCategories)
    },
    insights: insights
  }
}

// Keep continuous-improvement analysis local to the historical issue set
// already fetched for the Release Blocker Trends chart. No snapshot workflow,
// AI endpoint, or second Jira request is needed for this section.
export function useBlockerAnalysis(trendData) {
  const loading = ref(false)
  const error = ref('')
  const data = computed(function () {
    var source = trendData && trendData.value ? trendData.value : {}
    return buildLocalAnalysis(source.issues, source.fetchedAt)
  })

  return {
    data,
    loading,
    error,
    refresh: function () { return Promise.resolve(data.value) }
  }
}

export { buildLocalAnalysis, DECISIONS }
