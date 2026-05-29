/**
 * Feature hygiene Jira fetcher.
 *
 * Two-pass strategy:
 *   Pass 1 (lightweight, all features): core fields + RICE + rendered statusSummary
 *   Pass 2 (targeted, active features): changelog for status/statusSummary timestamps
 *
 * Also resolves linked RHAIRFE RFE issues to determine approval status.
 *
 * Uses shared/server/jira.js for API calls, with batching and throttling
 * to respect Jira Cloud rate limits.
 */

// ─── Custom Field IDs ───

const CUSTOM_FIELDS = {
  team: 'customfield_10001',
  releaseType: 'customfield_10851',
  targetVersion: 'customfield_10855',
  statusSummary: 'customfield_10814',
  colorStatus: 'customfield_10712',
  docsRequired: 'customfield_10665',
  targetEnd: 'customfield_10023',
  reach: 'customfield_10862',
  impact: 'customfield_10836',
  confidence: 'customfield_10838',
  effort: 'customfield_10637',
  riceScore: 'customfield_10864'
}

// Fields fetched in Pass 1 for all features
const PASS1_FIELDS = [
  'summary', 'status', 'issuetype', 'assignee', 'fixVersions', 'versions',
  'components', 'labels', 'issuelinks',
  CUSTOM_FIELDS.team,
  CUSTOM_FIELDS.releaseType,
  CUSTOM_FIELDS.statusSummary,
  CUSTOM_FIELDS.colorStatus,
  CUSTOM_FIELDS.docsRequired,
  CUSTOM_FIELDS.targetEnd,
  CUSTOM_FIELDS.reach,
  CUSTOM_FIELDS.impact,
  CUSTOM_FIELDS.confidence,
  CUSTOM_FIELDS.effort,
  CUSTOM_FIELDS.riceScore
].join(',')

// Minimal fields for Pass 2 (changelog comes via expand param)
const PASS2_FIELDS = 'summary'

// Statuses considered "active" — only these get Pass 2 changelog enrichment
const ACTIVE_STATUSES = ['Refinement', 'In Progress']

// Statuses considered "terminal" — these get Pass 3 open-children check
const TERMINAL_STATUSES = ['Release Pending', 'Closed', 'Resolved']

// RFE statuses considered "approved"
const APPROVED_RFE_STATUSES = ['Approved', 'In Progress', 'Review', 'Resolved', 'Closed']

const BATCH_SIZE = 40
const THROTTLE_MS = 1000

// ─── Helpers ───

/**
 * Serialize a Jira custom field value to a simple string.
 * Handles the various shapes Jira returns: objects with .name or .value,
 * arrays, plain strings, or null.
 * @param {*} field - Raw field value from Jira API
 * @returns {string|null}
 */
function serializeField(field) {
  if (field === null || field === undefined) return null
  if (typeof field === 'string') return field
  if (Array.isArray(field)) {
    if (field.length === 0) return null
    const first = field[0]
    if (first && first.name) return first.name
    if (first && first.value) return first.value
    return String(first)
  }
  if (field.name) return field.name
  if (field.value) return field.value
  return String(field)
}

/**
 * Compute RICE completion status from the four RICE component fields.
 * @param {object} fields - Raw Jira fields object
 * @returns {'complete'|'partial'|'none'}
 */
function computeRiceStatus(fields) {
  const values = [
    fields[CUSTOM_FIELDS.reach],
    fields[CUSTOM_FIELDS.impact],
    fields[CUSTOM_FIELDS.confidence],
    fields[CUSTOM_FIELDS.effort]
  ]
  let count = 0
  for (let i = 0; i < values.length; i++) {
    if (values[i] != null) count++
  }
  if (count === 4) return 'complete'
  if (count > 0) return 'partial'
  return 'none'
}

/**
 * Extract outward "clones" link keys from Jira issuelinks.
 * Looks for links where the link type outward label is "clones" or the
 * type name is "Cloners".
 * @param {Array} issueLinks - Raw issuelinks array from Jira API
 * @returns {Array<string>} Outward issue keys
 */
function extractClonesLinks(issueLinks) {
  if (!Array.isArray(issueLinks)) return []

  const keys = []
  for (let i = 0; i < issueLinks.length; i++) {
    const link = issueLinks[i]
    if (!link.outwardIssue) continue

    const type = link.type || {}
    if (type.outward === 'clones' || type.name === 'Cloners') {
      keys.push(link.outwardIssue.key)
    }
  }
  return keys
}

/**
 * Parse changelog histories to find the most recent change to a given field.
 * @param {object} changelog - The changelog object from Jira (with .histories array)
 * @param {string} fieldName - The field name or field ID to search for
 * @returns {string|null} ISO timestamp of the most recent change, or null
 */
function parseChangelog(changelog, fieldName) {
  if (!changelog || !Array.isArray(changelog.histories)) return null

  let mostRecent = null

  for (let i = 0; i < changelog.histories.length; i++) {
    const history = changelog.histories[i]
    const items = history.items || []

    for (let j = 0; j < items.length; j++) {
      const item = items[j]
      if (item.field === fieldName || item.fieldId === fieldName) {
        const timestamp = history.created
        if (!mostRecent || timestamp > mostRecent) {
          mostRecent = timestamp
        }
      }
    }
  }

  return mostRecent
}

/**
 * Split an array into batches of a given size.
 * @param {Array} arr
 * @param {number} size
 * @returns {Array<Array>}
 */
function batch(arr, size) {
  const batches = []
  for (let i = 0; i < arr.length; i += size) {
    batches.push(arr.slice(i, i + size))
  }
  return batches
}

/**
 * Sleep for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms) })
}

// ─── Transform ───

/**
 * Transform a raw Jira issue into a hygiene-ready feature object.
 * @param {object} rawIssue - Raw issue from Jira API (with fields and optionally renderedFields)
 * @param {object} rfeMap - Map of RHAIRFE key → { status, isApproved }
 * @returns {object} Transformed feature object
 */
function transformIssue(rawIssue, rfeMap) {
  const fields = rawIssue.fields || {}
  const renderedFields = rawIssue.renderedFields || {}

  // Status Summary: prefer rendered HTML, fall back to serialized field
  const statusSummary = renderedFields[CUSTOM_FIELDS.statusSummary] ||
    serializeField(fields[CUSTOM_FIELDS.statusSummary])

  // Components as array of names
  const components = []
  if (fields.components && Array.isArray(fields.components)) {
    for (let ci = 0; ci < fields.components.length; ci++) {
      if (fields.components[ci].name) components.push(fields.components[ci].name)
    }
  }

  // Fix versions as array of names
  const fixVersions = []
  if (fields.fixVersions && Array.isArray(fields.fixVersions)) {
    for (let fi = 0; fi < fields.fixVersions.length; fi++) {
      if (fields.fixVersions[fi].name) fixVersions.push(fields.fixVersions[fi].name)
    }
  }

  // Labels
  const labels = Array.isArray(fields.labels) ? fields.labels : []

  // Affected versions
  const affectedVersions = []
  if (fields.versions && Array.isArray(fields.versions)) {
    for (let avi = 0; avi < fields.versions.length; avi++) {
      if (fields.versions[avi].name) affectedVersions.push(fields.versions[avi].name)
    }
  }

  // Linked RFE: find first RHAIRFE-* key from clones links
  const clonesKeys = extractClonesLinks(fields.issuelinks)
  let linkedRfeKey = null
  let linkedRfeApproved = false

  for (let ri = 0; ri < clonesKeys.length; ri++) {
    if (clonesKeys[ri].startsWith('RHAIRFE-')) {
      linkedRfeKey = clonesKeys[ri]
      if (rfeMap && rfeMap[linkedRfeKey]) {
        linkedRfeApproved = rfeMap[linkedRfeKey].isApproved === true
      }
      break
    }
  }

  return {
    key: rawIssue.key,
    summary: fields.summary || '',
    issueType: fields.issuetype ? fields.issuetype.name : null,
    status: fields.status ? fields.status.name : null,
    statusCategory: fields.status && fields.status.statusCategory
      ? fields.status.statusCategory.name
      : null,
    assignee: fields.assignee ? fields.assignee.displayName : null,
    team: serializeField(fields[CUSTOM_FIELDS.team]),
    fixVersions,
    affectedVersions,
    components,
    labels,
    releaseType: serializeField(fields[CUSTOM_FIELDS.releaseType]),
    missingTargetVersion: false,
    statusSummary,
    colorStatus: serializeField(fields[CUSTOM_FIELDS.colorStatus]),
    docsRequired: serializeField(fields[CUSTOM_FIELDS.docsRequired]),
    targetEnd: fields[CUSTOM_FIELDS.targetEnd] || null,
    riceStatus: computeRiceStatus(fields),
    riceScore: fields[CUSTOM_FIELDS.riceScore] || null,
    linkedRfeKey,
    linkedRfeApproved,
    // Populated in Pass 2
    statusEnteredAt: null,
    statusSummaryUpdated: null,
    // Populated in Pass 3
    openChildCount: 0,
    // Populated by version-released enrichment
    versionReleased: false,
    versionGaDate: null,
    // Populated later by rules engine
    violations: []
  }
}

// ─── RFE Resolution ───

/**
 * Fetch RHAIRFE issues and build an approval map.
 * @param {Function} jiraRequestFn - The shared jiraRequest function
 * @param {Function} fetchAllJqlResultsFn - The shared fetchAllJqlResults function
 * @param {Array<string>} rfeKeys - RHAIRFE-* issue keys to look up
 * @returns {Promise<object>} Map of key → { status, isApproved }
 */
async function fetchRfeMap(jiraRequestFn, fetchAllJqlResultsFn, rfeKeys) {
  const rfeMap = {}
  if (!rfeKeys.length) return rfeMap

  const jql = 'project = RHAIRFE AND key IN (' + rfeKeys.join(', ') + ')'
  const fields = 'summary,status'

  try {
    const issues = await fetchAllJqlResultsFn(jiraRequestFn, jql, fields)

    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i]
      const statusName = issue.fields && issue.fields.status
        ? issue.fields.status.name
        : ''
      rfeMap[issue.key] = {
        status: statusName,
        isApproved: APPROVED_RFE_STATUSES.indexOf(statusName) !== -1
      }
    }
  } catch (err) {
    console.warn('[hygiene] RFE fetch failed:', err.message)
  }

  return rfeMap
}

// ─── Main Fetch Pipeline ───

/**
 * Fetch all feature hygiene data from Jira for a given release version.
 *
 * Two-pass strategy:
 *   Pass 1: All features with core fields + RICE + renderedFields for statusSummary
 *   Pass 2: Active features only, with changelog expansion for timestamps
 *
 * @param {Function} jiraRequestFn - The shared jiraRequest function
 * @param {Function} fetchAllJqlResultsFn - The shared fetchAllJqlResults function
 * @param {string} version - Display version string used for storage key and result metadata
 * @param {object} config - { projects: string[], issueTypes: string[] }
 * @param {Function} [onProgress] - Optional callback: (stage, detail) => void
 * @param {object} [options] - Optional settings
 * @param {string[]} [options.jqlVersions] - Jira version strings to use in JQL queries.
 *   When provided, uses these instead of `version` for Target Version and fixVersion filters.
 *   Supports multiple values via IN (...) syntax.
 * @returns {Promise<{ features: object, fetchedAt: string, version: string }>}
 */
async function fetchHygieneFeatures(jiraRequestFn, fetchAllJqlResultsFn, version, config, onProgress, options) {
  const projects = config.projects || ['RHAISTRAT', 'RHOAIENG']
  const issueTypes = config.issueTypes || ['Feature', 'Initiative']
  const notify = typeof onProgress === 'function' ? onProgress : function () {}

  // Determine JQL version strings — use options.jqlVersions if provided, else fall back to version
  const jqlVersions = (options && Array.isArray(options.jqlVersions) && options.jqlVersions.length > 0)
    ? options.jqlVersions
    : [version]

  // Sanitize: escape backslashes then double quotes to prevent JQL injection
  const sanitized = []
  for (var si = 0; si < jqlVersions.length; si++) {
    sanitized.push(jqlVersions[si].replace(/\\/g, '\\\\').replace(/"/g, '\\"'))
  }

  // ── Pass 1: Fetch all features (lightweight) ──
  notify('pass1', { message: 'Fetching features for ' + version })

  const projectFilter = 'project IN (' + projects.join(', ') + ')'
  const issueTypeFilter = 'issuetype IN (' + issueTypes.join(', ') + ')'
  const versionFilter = sanitized.length === 1
    ? '"Target Version" = "' + sanitized[0] + '"'
    : '"Target Version" IN (' + sanitized.map(function (v) { return '"' + v + '"' }).join(', ') + ')'

  const jql = projectFilter + ' AND ' + issueTypeFilter + ' AND ' + versionFilter

  const rawIssues = await fetchAllJqlResultsFn(jiraRequestFn, jql, PASS1_FIELDS, {
    expand: 'renderedFields'
  })

  notify('pass1', { message: 'Fetched ' + rawIssues.length + ' features' })

  // ── Supplementary: Issues with fixVersion but no Target Version ──
  notify('supplementary', { message: 'Checking for issues with fixVersion but no Target Version' })

  const fixVersionFilter = sanitized.length === 1
    ? 'fixVersion = "' + sanitized[0] + '"'
    : 'fixVersion IN (' + sanitized.map(function (v) { return '"' + v + '"' }).join(', ') + ')'

  const missingTvJql = projectFilter + ' AND ' + issueTypeFilter +
    ' AND ' + fixVersionFilter + ' AND "Target Version" IS EMPTY'

  try {
    const missingTvIssues = await fetchAllJqlResultsFn(jiraRequestFn, missingTvJql, PASS1_FIELDS, {
      expand: 'renderedFields'
    })
    for (let mti = 0; mti < missingTvIssues.length; mti++) {
      if (!rawIssues.some(function (ri) { return ri.key === missingTvIssues[mti].key })) {
        rawIssues.push(missingTvIssues[mti])
        missingTvIssues[mti]._missingTargetVersion = true
      }
    }
    if (missingTvIssues.length > 0) {
      notify('supplementary', { message: 'Found ' + missingTvIssues.length + ' issues missing Target Version' })
    }
  } catch (err) {
    console.warn('[hygiene] Missing Target Version fetch failed:', err.message)
  }

  // ── Supplementary: Post-release bugs missing Affected Version ──
  notify('supplementary', { message: 'Checking for post-release bugs' })

  const bugJql = projectFilter + ' AND issuetype = Bug AND ' + fixVersionFilter

  try {
    const bugIssues = await fetchAllJqlResultsFn(jiraRequestFn, bugJql, PASS1_FIELDS, {
      expand: 'renderedFields'
    })
    for (let bgi = 0; bgi < bugIssues.length; bgi++) {
      if (!rawIssues.some(function (ri) { return ri.key === bugIssues[bgi].key })) {
        rawIssues.push(bugIssues[bgi])
      }
    }
    if (bugIssues.length > 0) {
      notify('supplementary', { message: 'Found ' + bugIssues.length + ' bugs in ' + version })
    }
  } catch (err) {
    console.warn('[hygiene] Bug fetch failed:', err.message)
  }

  // ── RFE Resolution ──
  notify('rfe-resolution', { message: 'Resolving linked RFEs' })

  const allRfeKeys = []
  const rfeKeySet = {}
  for (let i = 0; i < rawIssues.length; i++) {
    const clonesKeys = extractClonesLinks((rawIssues[i].fields || {}).issuelinks)
    for (let j = 0; j < clonesKeys.length; j++) {
      const ck = clonesKeys[j]
      if (ck.startsWith('RHAIRFE-') && !rfeKeySet[ck]) {
        rfeKeySet[ck] = true
        allRfeKeys.push(ck)
      }
    }
  }

  const rfeMap = await fetchRfeMap(jiraRequestFn, fetchAllJqlResultsFn, allRfeKeys)

  notify('rfe-resolution', { message: 'Resolved ' + Object.keys(rfeMap).length + ' RFEs' })

  // ── Transform Pass 1 results ──
  const features = {}
  for (let ti = 0; ti < rawIssues.length; ti++) {
    const transformed = transformIssue(rawIssues[ti], rfeMap)
    if (rawIssues[ti]._missingTargetVersion) {
      transformed.missingTargetVersion = true
    }
    features[transformed.key] = transformed
  }

  // ── Pass 2: Changelog for active features ──
  const activeKeys = []
  for (const ak in features) {
    if (ACTIVE_STATUSES.indexOf(features[ak].status) !== -1) {
      activeKeys.push(ak)
    }
  }

  notify('pass2', { message: 'Fetching changelog for ' + activeKeys.length + ' active features' })

  if (activeKeys.length > 0) {
    const batches = batch(activeKeys, BATCH_SIZE)

    for (let bi = 0; bi < batches.length; bi++) {
      if (bi > 0) await sleep(THROTTLE_MS)

      const batchKeys = batches[bi]
      const batchJql = 'key in (' + batchKeys.join(', ') + ')'

      try {
        const changelogIssues = await fetchAllJqlResultsFn(
          jiraRequestFn, batchJql, PASS2_FIELDS, { expand: 'changelog' }
        )

        for (let ci = 0; ci < changelogIssues.length; ci++) {
          const clIssue = changelogIssues[ci]
          const feature = features[clIssue.key]
          if (!feature) continue

          feature.statusEnteredAt = parseChangelog(clIssue.changelog, 'status')
          feature.statusSummaryUpdated = parseChangelog(
            clIssue.changelog,
            'Status Summary'
          ) || parseChangelog(clIssue.changelog, CUSTOM_FIELDS.statusSummary)
        }
      } catch (err) {
        console.warn(
          '[hygiene] Pass 2 batch ' + (bi + 1) + '/' + batches.length + ' failed:',
          err.message
        )
      }
    }
  }

  // ── Pass 3: Open children for terminal-status features ──
  const terminalKeys = []
  for (const tk in features) {
    if (TERMINAL_STATUSES.indexOf(features[tk].status) !== -1) {
      terminalKeys.push(tk)
    }
  }

  notify('pass3', { message: 'Checking open children for ' + terminalKeys.length + ' terminal features' })

  if (terminalKeys.length > 0) {
    const terminalBatches = batch(terminalKeys, BATCH_SIZE)

    for (let tbi = 0; tbi < terminalBatches.length; tbi++) {
      if (tbi > 0) await sleep(THROTTLE_MS)

      const batchParentKeys = terminalBatches[tbi]
      const keyList = batchParentKeys.join(', ')

      // Query both parent field and Epic Link to catch all child relationship types
      const parentJql = '(parent IN (' + keyList + ') OR "Epic Link" IN (' + keyList + ')) AND status NOT IN (Closed, Resolved)'

      try {
        const openChildren = await fetchAllJqlResultsFn(
          jiraRequestFn, parentJql, 'summary,parent,customfield_10014'
        )

        for (let oci = 0; oci < openChildren.length; oci++) {
          const child = openChildren[oci]
          const fields = child.fields || {}
          // Resolve parent via parent field or Epic Link
          const parentKey = (fields.parent ? fields.parent.key : null) ||
            fields.customfield_10014 || null
          if (parentKey && features[parentKey]) {
            features[parentKey].openChildCount = (features[parentKey].openChildCount || 0) + 1
          }
        }
      } catch (err) {
        console.warn(
          '[hygiene] Pass 3 batch ' + (tbi + 1) + '/' + terminalBatches.length + ' failed:',
          err.message
        )
      }
    }
  }

  notify('complete', {
    message: 'Done',
    totalFeatures: Object.keys(features).length,
    activeEnriched: activeKeys.length,
    terminalChecked: terminalKeys.length,
    rfesResolved: Object.keys(rfeMap).length
  })

  return {
    features,
    fetchedAt: new Date().toISOString(),
    version
  }
}

module.exports = {
  fetchHygieneFeatures,
  transformIssue,
  serializeField,
  computeRiceStatus,
  extractClonesLinks,
  parseChangelog,
  CUSTOM_FIELDS,
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  APPROVED_RFE_STATUSES
}
