const { CLOSED_STATUSES, JIRA_THROTTLE_MS, JIRA_BROWSE_URL } = require('./constants')

function adfToPlainText(node) {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (node.type === 'text') return node.text || ''
  if (Array.isArray(node.content)) {
    return node.content.map(adfToPlainText).join('')
  }
  return ''
}

function extractTargetVersions(issue, targetVersionFieldId) {
  if (!targetVersionFieldId) return []
  const raw = (issue.fields || {})[targetVersionFieldId]
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw
      .map(v => {
        if (typeof v === 'string') return v.trim()
        if (v && typeof v === 'object' && v.name) return String(v.name).trim()
        return null
      })
      .filter(Boolean)
  }
  if (typeof raw === 'object' && raw.name) return [String(raw.name).trim()]
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()]
  return []
}

function extractFixVersions(issue) {
  const fv = (issue.fields || {}).fixVersions
  if (!Array.isArray(fv)) return []
  return fv.map(v => (v && v.name ? String(v.name).trim() : '')).filter(Boolean)
}

function extractLabels(issue) {
  const labels = (issue.fields || {}).labels
  if (!Array.isArray(labels)) return []
  return labels.map(l => String(l).trim()).filter(Boolean)
}

function extractComponents(issue) {
  const comps = (issue.fields || {}).components
  if (!Array.isArray(comps)) return []
  return comps.map(c => (c && c.name ? String(c.name).trim() : '')).filter(Boolean)
}

function extractDisplayName(field) {
  if (!field) return ''
  if (typeof field === 'string') return field
  if (field.displayName) return field.displayName
  if (field.name) return field.name
  return String(field)
}

function extractFieldValue(field) {
  if (!field) return ''
  if (typeof field === 'string') return field
  if (field.value) return field.value
  if (field.name) return field.name
  return String(field)
}

function mapToCandidate(rawIssue, bigRockName, sourcePass, fieldMapping, customFieldIds) {
  const fields = rawIssue.fields || {}

  const status = fields.status ? fields.status.name || '' : ''
  const priority = fields.priority ? fields.priority.name || '' : ''
  const summary = fields.summary || ''
  const components = extractComponents(rawIssue).join(', ')
  const labels = extractLabels(rawIssue)
  const labelsStr = labels.join(', ')

  const targetVersions = extractTargetVersions(rawIssue, customFieldIds.targetVersion)
  const targetRelease = targetVersions.length > 0 ? targetVersions[0] : ''

  const fixVersions = extractFixVersions(rawIssue)
  const fixVersion = fixVersions.join(', ')

  const pm = extractDisplayName(fields[customFieldIds.productManager])
  const architect = extractDisplayName(fields[fieldMapping.architect])
  const team = extractFieldValue(fields[fieldMapping.team])
  const deliveryOwner = fields.assignee ? extractDisplayName(fields.assignee) : ''
  const phase = extractFieldValue(fields[customFieldIds.releaseType])

  const source = rawIssue.key.startsWith('RHAIRFE-') ? 'rfe' : 'jira'

  return {
    bigRock: bigRockName,
    issueKey: rawIssue.key,
    status,
    priority,
    phase,
    summary,
    components,
    labels: labelsStr,
    targetRelease,
    fixVersion,
    team,
    pm,
    architect,
    deliveryOwner,
    rfe: '',
    rfeStatus: '',
    source,
    sourcePass,
    jiraUrl: `${JIRA_BROWSE_URL}/${rawIssue.key}`
  }
}

function getRfeLink(issue, fieldMapping) {
  const rfeLinkType = (fieldMapping.rfeLinkType || 'is required by').toLowerCase()
  const issuelinks = (issue.fields || {}).issuelinks
  if (!Array.isArray(issuelinks)) return { key: '', status: '' }

  for (const link of issuelinks) {
    if (!link.type) continue
    let linkTypeName = ''
    let linkedIssue = null

    if (link.inwardIssue) {
      linkTypeName = (link.type.inward || '').toLowerCase()
      linkedIssue = link.inwardIssue
    } else if (link.outwardIssue) {
      linkTypeName = (link.type.outward || '').toLowerCase()
      linkedIssue = link.outwardIssue
    }

    if (linkedIssue && linkTypeName.includes(rfeLinkType)) {
      const linkedStatus = linkedIssue.fields && linkedIssue.fields.status
        ? linkedIssue.fields.status.name || ''
        : ''
      return { key: linkedIssue.key, status: linkedStatus }
    }
  }

  return { key: '', status: '' }
}

function getParentRfeKey(issue) {
  const issuelinks = (issue.fields || {}).issuelinks
  if (Array.isArray(issuelinks)) {
    for (const link of issuelinks) {
      if (!link.type) continue
      const linkTypeName = link.type.name || ''
      if (!linkTypeName.includes('Clon')) continue

      const linkedIssue = link.inwardIssue || link.outwardIssue
      if (linkedIssue && linkedIssue.key && linkedIssue.key.startsWith('RHAIRFE-')) {
        return linkedIssue.key
      }
    }
  }

  // ADF fallback for Cloud descriptions
  const description = (issue.fields || {}).description
  if (description) {
    const text = typeof description === 'string' ? description : adfToPlainText(description)
    const match = text.match(/Parent RFE.*?(RHAIRFE-\d+)/i)
    if (match) return match[1]
  }

  return ''
}

function getRequestedFields(fieldMapping, customFieldIds) {
  const fields = [
    'summary', 'status', 'priority', 'components', 'labels',
    'fixVersions', 'issuelinks', 'assignee', 'description'
  ]
  if (customFieldIds.targetVersion) fields.push(customFieldIds.targetVersion)
  if (customFieldIds.productManager) fields.push(customFieldIds.productManager)
  if (customFieldIds.releaseType) fields.push(customFieldIds.releaseType)
  if (fieldMapping.team) fields.push(fieldMapping.team)
  if (fieldMapping.architect) fields.push(fieldMapping.architect)
  return [...new Set(fields)].join(',')
}

async function throttledSequential(items, fn, delayMs) {
  if (delayMs === undefined) delayMs = JIRA_THROTTLE_MS
  const results = []
  for (let i = 0; i < items.length; i++) {
    results.push(await fn(items[i]))
    if (i < items.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  return results
}

async function fetchOutcomeFeatures(fetchAllJqlResults, jiraRequest, outcomeKey, bigRockName, fieldMapping, customFieldIds) {
  const closedList = CLOSED_STATUSES.map(s => `"${s}"`).join(', ')

  let targetVersionJql
  const cfMatch = /^customfield_(\d+)$/i.exec(customFieldIds.targetVersion)
  if (cfMatch) {
    targetVersionJql = `cf[${cfMatch[1]}] is not EMPTY`
  } else {
    targetVersionJql = `"Target Version" is not EMPTY`
  }

  const jql = `parent = "${outcomeKey}" AND type = Feature AND ${targetVersionJql} AND status NOT IN (${closedList}) ORDER BY priority ASC`
  const fields = getRequestedFields(fieldMapping, customFieldIds)

  try {
    const rawIssues = await fetchAllJqlResults(jiraRequest, jql, fields, { maxResults: 100 })
    return rawIssues.map(issue => {
      const candidate = mapToCandidate(issue, bigRockName, 'outcome', fieldMapping, customFieldIds)
      const rfeLink = getRfeLink(issue, fieldMapping)
      if (rfeLink.key) {
        candidate.rfe = rfeLink.key
        candidate.rfeStatus = rfeLink.status
      }
      if (!candidate.rfe) {
        candidate.rfe = getParentRfeKey(issue)
      }
      return candidate
    })
  } catch (err) {
    console.error(`[release-planning] Failed to fetch feature children of ${outcomeKey}:`, err.message)
    return []
  }
}

async function fetchOutcomeRfes(fetchAllJqlResults, jiraRequest, outcomeKey, release, bigRockName, fieldMapping, customFieldIds) {
  const closedList = CLOSED_STATUSES.map(s => `"${s}"`).join(', ')
  const safeRelease = release.replace(/[^a-zA-Z0-9._-]/g, '')
  const jql = `parent = "${outcomeKey}" AND labels = "${safeRelease}-candidate" AND status NOT IN (${closedList}) AND status != "Approved" ORDER BY priority ASC`
  const fields = getRequestedFields(fieldMapping, customFieldIds)

  try {
    const rawIssues = await fetchAllJqlResults(jiraRequest, jql, fields, { maxResults: 100 })
    return rawIssues.map(issue => {
      const candidate = mapToCandidate(issue, bigRockName, 'outcome', fieldMapping, customFieldIds)
      return candidate
    })
  } catch (err) {
    console.error(`[release-planning] Failed to fetch RFE children of ${outcomeKey}:`, err.message)
    return []
  }
}

async function fetchOutcomeSummaries(fetchAllJqlResults, jiraRequest, outcomeKeys) {
  if (!outcomeKeys.length) return {}
  const keysStr = outcomeKeys.join(', ')
  const jql = `key in (${keysStr}) ORDER BY key ASC`

  try {
    const rawIssues = await fetchAllJqlResults(jiraRequest, jql, 'summary', { maxResults: 100 })
    const summaries = {}
    for (const issue of rawIssues) {
      summaries[issue.key] = (issue.fields || {}).summary || ''
    }
    return summaries
  } catch (err) {
    console.error('[release-planning] Failed to fetch outcome summaries:', err.message)
    return {}
  }
}

async function fetchTier2Features(fetchAllJqlResults, jiraRequest, release, excludeKeys, fieldMapping, customFieldIds) {
  const closedList = CLOSED_STATUSES.map(s => `"${s}"`).join(', ')

  // Use cf[NNNNN] is not EMPTY then filter in JS for Cloud compatibility
  let targetVersionJql
  const cfMatch = /^customfield_(\d+)$/i.exec(customFieldIds.targetVersion)
  if (cfMatch) {
    targetVersionJql = `cf[${cfMatch[1]}] is not EMPTY`
  } else {
    targetVersionJql = `"Target Version" is not EMPTY`
  }

  const jql = `project = RHAISTRAT AND type = Feature AND ${targetVersionJql} AND status NOT IN (${closedList}) ORDER BY priority ASC`
  const fields = getRequestedFields(fieldMapping, customFieldIds)

  try {
    const rawIssues = await fetchAllJqlResults(jiraRequest, jql, fields, { maxResults: 100 })
    const candidates = []

    for (const issue of rawIssues) {
      if (excludeKeys.has(issue.key)) continue

      // Filter by release in JS
      const versions = extractTargetVersions(issue, customFieldIds.targetVersion)
      const matchesRelease = versions.some(v => v.includes(release))
      if (!matchesRelease) continue

      const candidate = mapToCandidate(issue, '', 'tier2', fieldMapping, customFieldIds)
      const rfeLink = getRfeLink(issue, fieldMapping)
      if (rfeLink.key) {
        candidate.rfe = rfeLink.key
        candidate.rfeStatus = rfeLink.status
      }
      if (!candidate.rfe) {
        candidate.rfe = getParentRfeKey(issue)
      }
      candidates.push(candidate)
    }

    return candidates
  } catch (err) {
    console.error('[release-planning] Failed to fetch Tier 2 features:', err.message)
    return []
  }
}

async function fetchTier2Rfes(fetchAllJqlResults, jiraRequest, release, excludeKeys, fieldMapping, customFieldIds) {
  const closedList = CLOSED_STATUSES.map(s => `"${s}"`).join(', ')
  const safeRelease = release.replace(/[^a-zA-Z0-9._-]/g, '')
  const jql = `project = RHAIRFE AND labels = "${safeRelease}-candidate" AND status NOT IN (${closedList}) AND status != "Approved" ORDER BY priority ASC`
  const fields = getRequestedFields(fieldMapping, customFieldIds)

  try {
    const rawIssues = await fetchAllJqlResults(jiraRequest, jql, fields, { maxResults: 100 })
    const candidates = []

    for (const issue of rawIssues) {
      if (excludeKeys.has(issue.key)) continue
      const candidate = mapToCandidate(issue, '', 'tier2', fieldMapping, customFieldIds)
      candidates.push(candidate)
    }

    return candidates
  } catch (err) {
    console.error('[release-planning] Failed to fetch Tier 2 RFEs:', err.message)
    return []
  }
}

async function fetchTier3Features(fetchAllJqlResults, jiraRequest, excludeKeys, fieldMapping, customFieldIds) {
  let targetVersionJql
  const cfMatch = /^customfield_(\d+)$/i.exec(customFieldIds.targetVersion)
  if (cfMatch) {
    targetVersionJql = `cf[${cfMatch[1]}] is EMPTY`
  } else {
    targetVersionJql = `"Target Version" is EMPTY`
  }

  const jql = `project = RHAISTRAT AND type = Feature AND status = "In Progress" AND ${targetVersionJql} AND fixVersion is EMPTY ORDER BY priority ASC`
  const fields = getRequestedFields(fieldMapping, customFieldIds)

  try {
    const rawIssues = await fetchAllJqlResults(jiraRequest, jql, fields, { maxResults: 100 })
    const candidates = []

    for (const issue of rawIssues) {
      if (excludeKeys.has(issue.key)) continue
      const candidate = mapToCandidate(issue, '', 'tier3', fieldMapping, customFieldIds)
      const rfeLink = getRfeLink(issue, fieldMapping)
      if (rfeLink.key) {
        candidate.rfe = rfeLink.key
        candidate.rfeStatus = rfeLink.status
      }
      if (!candidate.rfe) {
        candidate.rfe = getParentRfeKey(issue)
      }
      candidates.push(candidate)
    }

    return candidates
  } catch (err) {
    console.error('[release-planning] Failed to fetch Tier 3 features:', err.message)
    return []
  }
}

async function batchFetchLinkedIssues(fetchAllJqlResults, jiraRequest, issueKeys, fields) {
  if (!issueKeys.length) return {}
  const BATCH_SIZE = 50
  const cache = {}

  for (let i = 0; i < issueKeys.length; i += BATCH_SIZE) {
    const batch = issueKeys.slice(i, i + BATCH_SIZE)
    const keysStr = batch.join(', ')
    const jql = `key in (${keysStr}) ORDER BY key ASC`

    try {
      const issues = await fetchAllJqlResults(jiraRequest, jql, fields, { maxResults: 100 })
      for (const issue of issues) {
        cache[issue.key] = issue
      }
    } catch (err) {
      console.error('[release-planning] Batch fetch failed for keys:', batch.slice(0, 3).join(', '), err.message)
    }

    if (i + BATCH_SIZE < issueKeys.length) {
      await new Promise(resolve => setTimeout(resolve, JIRA_THROTTLE_MS))
    }
  }

  return cache
}

async function discoverCustomFields(jiraRequest, issueKey) {
  const allFields = await jiraRequest('/rest/api/3/field')
  if (!Array.isArray(allFields)) return {}

  const fieldIdToName = {}
  for (const f of allFields) {
    if (f.id && f.id.startsWith('customfield_')) {
      fieldIdToName[f.id] = f.name || f.id
    }
  }

  const issue = await jiraRequest(`/rest/api/3/issue/${encodeURIComponent(issueKey)}`)
  const result = {}
  const fields = issue.fields || {}

  for (const [id, name] of Object.entries(fieldIdToName)) {
    const value = fields[id]
    if (value != null) {
      let displayValue
      if (typeof value === 'string') displayValue = value
      else if (value.name) displayValue = value.name
      else if (value.displayName) displayValue = value.displayName
      else if (Array.isArray(value)) displayValue = value.map(v => v.name || String(v)).join(', ')
      else displayValue = JSON.stringify(value).slice(0, 100)
      result[id] = `${name}: ${displayValue}`
    }
  }

  return result
}

module.exports = {
  adfToPlainText,
  extractTargetVersions,
  extractFixVersions,
  extractLabels,
  extractComponents,
  mapToCandidate,
  getRfeLink,
  getParentRfeKey,
  getRequestedFields,
  throttledSequential,
  fetchOutcomeFeatures,
  fetchOutcomeRfes,
  fetchOutcomeSummaries,
  fetchTier2Features,
  fetchTier2Rfes,
  fetchTier3Features,
  batchFetchLinkedIssues,
  discoverCustomFields
}
