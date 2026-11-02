import { computed } from 'vue'
import { BASE_JQL } from './useCveAggregation.js'

const UNKNOWN_ECOSYSTEM = 'Unknown'
const MULTIPLE_ECOSYSTEMS = 'Multiple ecosystems'
const ECOSYSTEM_LABEL_PREFIX = 'ecosystem:'
const DEFAULT_JIRA_SEARCH_BASE = 'https://redhat.atlassian.net/issues/?jql='
const TEXT_QUERY_SPECIAL_CHARACTERS = new Set([
  '+', '-', '&', '|', '!', '(', ')', '{', '}', '[', ']', '^', '"', '~', '*', '?', ':', '\\', '/'
])

function compareStrings(left, right) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

function ecosystemsFromLabels(labels) {
  if (!Array.isArray(labels)) return []

  const ecosystems = new Set()
  for (const label of labels) {
    if (typeof label !== 'string') continue
    const trimmedLabel = label.trim()
    if (!trimmedLabel.toLowerCase().startsWith(ECOSYSTEM_LABEL_PREFIX)) continue

    const ecosystem = trimmedLabel.slice(ECOSYSTEM_LABEL_PREFIX.length).trim()
    if (ecosystem && ecosystem.toLowerCase() !== UNKNOWN_ECOSYSTEM.toLowerCase()) {
      ecosystems.add(ecosystem)
    }
  }
  return [...ecosystems]
}

function normalizeComponent(value) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/^golang;\s*/i, '').trim().toLowerCase()
}

function escapeJqlString(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function escapeTextQuery(value) {
  return [...value]
    .map(character => TEXT_QUERY_SPECIAL_CHARACTERS.has(character) ? `\\${character}` : character)
    .join('')
}

function componentPhraseClause(component) {
  const phrase = `"${escapeTextQuery(component)}"`
  return `cf[10632] ~ "${escapeJqlString(phrase)}"`
}

function jiraUrl(searchBase, component) {
  const clauses = [BASE_JQL, componentPhraseClause(component)]
  return searchBase + encodeURIComponent(clauses.join(' AND '))
}

function buildAggregation(payload) {
  if (payload?.upstreamComponentDataVersion !== 1) {
    return {
      metadataReady: false,
      totalOpen: 0,
      ecosystems: [],
      ecosystemBreakdown: [],
      componentRows: [],
      multipleEcosystemCount: 0
    }
  }

  const searchBase = typeof payload.jiraSearchBase === 'string' && payload.jiraSearchBase
    ? payload.jiraSearchBase
    : DEFAULT_JIRA_SEARCH_BASE
  const ticketKeys = new Set()
  const ecosystemOptions = new Set()
  const donutCounts = new Map()
  const componentGroups = new Map()
  let totalOpen = 0
  let multipleEcosystemCount = 0

  for (const issue of Array.isArray(payload.openIssueRecords) ? payload.openIssueRecords : []) {
    if (!issue || typeof issue !== 'object') continue
    const status = typeof issue.status === 'string' ? issue.status.trim().toLowerCase() : ''
    if (status === 'closed' || status === 'resolved') continue

    const component = normalizeComponent(issue.upstreamComponent)
    if (!component) continue

    const key = typeof issue.key === 'string' ? issue.key.trim() : ''
    if (!key || ticketKeys.has(key)) continue
    ticketKeys.add(key)
    totalOpen++

    let group = componentGroups.get(component)
    if (!group) {
      group = { ticketKeys: new Set(), ecosystems: new Set() }
      componentGroups.set(component, group)
    }
    group.ticketKeys.add(key)
    for (const ecosystem of ecosystemsFromLabels(issue.labels)) group.ecosystems.add(ecosystem)
  }

  const componentRows = []
  for (const [component, group] of componentGroups) {
    const knownEcosystems = [...group.ecosystems].sort(compareStrings)
    const ecosystems = knownEcosystems.length ? knownEcosystems : [UNKNOWN_ECOSYSTEM]
    for (const ecosystem of ecosystems) ecosystemOptions.add(ecosystem)

    const donutEcosystem = knownEcosystems.length === 0
      ? UNKNOWN_ECOSYSTEM
      : knownEcosystems.length === 1
        ? knownEcosystems[0]
        : MULTIPLE_ECOSYSTEMS
    const count = group.ticketKeys.size
    donutCounts.set(donutEcosystem, (donutCounts.get(donutEcosystem) || 0) + count)
    if (donutEcosystem === MULTIPLE_ECOSYSTEMS) multipleEcosystemCount += count

    componentRows.push({
      component,
      ecosystems,
      count,
      jiraUrl: jiraUrl(searchBase, component)
    })
  }

  const ecosystemBreakdown = [...donutCounts]
    .map(([ecosystem, count]) => ({
      ecosystem,
      count,
      pct: parseFloat(((count / totalOpen) * 100).toFixed(2))
    }))
    .sort((left, right) => right.count - left.count || compareStrings(left.ecosystem, right.ecosystem))

  componentRows.sort((left, right) =>
    right.count - left.count || compareStrings(left.component, right.component)
  )

  return {
    metadataReady: true,
    totalOpen,
    ecosystems: [...ecosystemOptions].sort(compareStrings),
    ecosystemBreakdown,
    componentRows,
    multipleEcosystemCount
  }
}

/**
 * Lightweight ecosystem/component grouping over the cached sustaining snapshot.
 *
 * @param {import('vue').Ref<Object|null>} data - Sustaining payload
 * @param {import('vue').Ref<string>} selectedEcosystem - Table-only ecosystem selection; empty means all
 */
export function useCveUpstreamComponents(data, selectedEcosystem) {
  const aggregation = computed(() => buildAggregation(data.value))
  const metadataReady = computed(() => aggregation.value.metadataReady)
  const totalOpen = computed(() => aggregation.value.totalOpen)
  const ecosystems = computed(() => aggregation.value.ecosystems)
  const ecosystemBreakdown = computed(() => aggregation.value.ecosystemBreakdown)
  const componentRows = computed(() => aggregation.value.componentRows)
  const filteredRows = computed(() => {
    const selected = selectedEcosystem.value
    return selected
      ? componentRows.value.filter(row => row.ecosystems.includes(selected))
      : componentRows.value
  })
  const multipleEcosystemCount = computed(() => aggregation.value.multipleEcosystemCount)

  return {
    metadataReady,
    totalOpen,
    ecosystems,
    ecosystemBreakdown,
    componentRows,
    filteredRows,
    multipleEcosystemCount
  }
}
