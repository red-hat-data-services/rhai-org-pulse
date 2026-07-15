const CUSTOM_FIELDS = {
  productManager: 'customfield_10469',
  targetVersion: 'customfield_10855',
  riceScore: 'customfield_10864'
}

function serializeField(field) {
  if (field === null || field === undefined) return null
  if (typeof field === 'string') return field
  if (Array.isArray(field)) {
    if (field.length === 0) return null
    const first = field[0]
    if (first?.name) return first.name
    if (first?.value) return first.value
    return String(first)
  }
  if (field.name) return field.name
  if (field.value) return field.value
  return String(field)
}

function serializeMultiField(field) {
  if (!field || !Array.isArray(field)) return []
  return field.map(f => f.name || f.value).filter(Boolean)
}

function extractClonesLinks(issueLinks) {
  const keys = []
  if (!Array.isArray(issueLinks)) return keys
  for (const link of issueLinks) {
    const outward = link.outwardIssue
    const inward = link.inwardIssue
    const type = link.type || {}
    if (type.name === 'Cloners' || type.outward === 'clones') {
      if (outward?.key) keys.push(outward.key)
      if (inward?.key) keys.push(inward.key)
    }
  }
  return keys
}

function transformRfeIssue(raw) {
  const fields = raw.fields || {}
  const labels = Array.isArray(fields.labels) ? fields.labels : []
  const cloneKeys = extractClonesLinks(fields.issuelinks)
  const linkedFeature = cloneKeys.find(k => k.startsWith('RHAISTRAT-') || k.startsWith('AIPCC-')) || null

  return {
    type: 'rfe',
    key: raw.key,
    summary: fields.summary || '',
    status: fields.status?.name || null,
    priority: fields.priority?.name || 'Normal',
    labels,
    components: serializeMultiField(fields.components),
    reporter: fields.reporter?.displayName || null,
    assignee: fields.assignee?.displayName || null,
    linkedFeature,
    created: fields.created || null,
    updated: fields.updated || null
  }
}

function transformFeatureIssue(raw, epicCounts = {}) {
  const fields = raw.fields || {}
  const labels = Array.isArray(fields.labels) ? fields.labels : []
  const cloneKeys = extractClonesLinks(fields.issuelinks)
  const linkedRfeKey = cloneKeys.find(k => k.startsWith('RHAIRFE-')) || null
  const pmField = fields[CUSTOM_FIELDS.productManager]

  const targetVersionRaw = fields[CUSTOM_FIELDS.targetVersion]
  const targetVersions = []
  if (Array.isArray(targetVersionRaw)) {
    for (const tv of targetVersionRaw) {
      if (tv?.name) targetVersions.push(tv.name)
    }
  } else {
    const single = serializeField(targetVersionRaw)
    if (single) targetVersions.push(single)
  }

  return {
    type: 'feature',
    key: raw.key,
    summary: fields.summary || '',
    issueType: fields.issuetype?.name || null,
    status: fields.status?.name || null,
    priority: fields.priority?.name || 'Normal',
    labels,
    components: serializeMultiField(fields.components),
    fixVersions: serializeMultiField(fields.fixVersions),
    targetVersions,
    assignee: fields.assignee?.displayName || null,
    deliveryOwner: fields.assignee?.displayName || null,
    pmOwner: pmField?.displayName || null,
    linkedRfeKey,
    sourceRfe: linkedRfeKey,
    riceScore: fields[CUSTOM_FIELDS.riceScore] || null,
    epicChildCount: epicCounts[raw.key] || 0,
    rubricTotal: labels.includes('strat-creator-rubric-pass') ? 1 : 0,
    created: fields.created || null,
    updated: fields.updated || null
  }
}

const RFE_FIELDS = [
  'summary', 'status', 'priority', 'labels', 'components',
  'issuelinks', 'reporter', 'assignee', 'created', 'updated'
].join(',')

const FEATURE_FIELDS = [
  'summary', 'status', 'priority', 'labels', 'components', 'issuelinks',
  'issuetype', 'assignee', 'fixVersions', 'created', 'updated',
  CUSTOM_FIELDS.productManager,
  CUSTOM_FIELDS.targetVersion,
  CUSTOM_FIELDS.riceScore
].join(',')

module.exports = {
  transformRfeIssue,
  transformFeatureIssue,
  RFE_FIELDS,
  FEATURE_FIELDS
}
