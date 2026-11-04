import { ref, computed, unref, watch } from 'vue'

/** Max day columns per matrix page when the snapshot has many days. */
export const NIGHTLY_PAGE_SIZE = 5

/**
 * Columns per pager step for a given snapshot day count.
 *
 * @param {number} totalDays
 * @returns {number}
 */
export function nightlyColumnsPerPage(totalDays) {
  if (!totalDays || totalDays <= 0) return NIGHTLY_PAGE_SIZE
  if (totalDays > NIGHTLY_PAGE_SIZE) return NIGHTLY_PAGE_SIZE
  return totalDays
}

/**
 * Extract Jenkins folder/job path from a build URL (segments between /job/ and build number).
 *
 * @param {string|null|undefined} url
 * @returns {string|null}
 */
export function jenkinsJobPathFromUrl(url) {
  if (!url || typeof url !== 'string') return null
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    const names = []
    for (let i = 0; i < parts.length; i += 1) {
      if (parts[i] !== 'job' || i + 1 >= parts.length) continue
      const segment = parts[i + 1]
      try {
        names.push(decodeURIComponent(segment))
      } catch {
        names.push(segment)
      }
    }
    return names.length > 0 ? names.join('/') : null
  } catch {
    return null
  }
}

/**
 * @param {object|null|undefined} payload
 * @returns {{ stream_key: string, label: string, jenkins_job: string|null }[]}
 */
export function listNightlyJenkinsJobOptions(payload) {
  if (!payload || typeof payload !== 'object') return []
  const days = Array.isArray(payload.days) ? payload.days : []
  if (days.length === 0) return []
  const metaByKey = new Map()
  const metaJobs = Array.isArray(payload.jenkins_jobs) ? payload.jenkins_jobs : []
  for (const job of metaJobs) {
    if (job && typeof job.stream_key === 'string' && job.stream_key.length > 0) {
      metaByKey.set(job.stream_key, job)
    }
  }
  const dayStreamKey = (day) =>
    (typeof day.stream_key === 'string' && day.stream_key.length > 0 ? day.stream_key : 'default')
  const keys = new Set(days.map((day) => dayStreamKey(day)))
  const orderedKeys = []
  for (const job of metaJobs) {
    const sk = job?.stream_key
    if (typeof sk === 'string' && sk.length > 0 && keys.has(sk) && !orderedKeys.includes(sk)) {
      orderedKeys.push(sk)
    }
  }
  for (const sk of [...keys].sort()) {
    if (!orderedKeys.includes(sk)) orderedKeys.push(sk)
  }
  return orderedKeys.map((stream_key) => {
    const meta = metaByKey.get(stream_key)
    let label = meta?.label || meta?.jenkins_job || null
    if (!label) {
      for (const day of days) {
        const dayKey = dayStreamKey(day)
        if (dayKey !== stream_key) continue
        for (const run of day.runs || []) {
          const fromUrl = jenkinsJobPathFromUrl(run?.jenkins_url)
          if (fromUrl) {
            label = fromUrl
            break
          }
        }
        if (label) break
      }
    }
    return {
      stream_key,
      label: label || stream_key,
      jenkins_job: typeof meta?.jenkins_job === 'string' ? meta.jenkins_job : null
    }
  })
}

/**
 * @param {object|null|undefined} payload
 * @param {string|null|undefined} streamKey
 * @returns {{ stream_key: string, label: string, jenkins_job: string|null }|null}
 */
export function resolveNightlyJenkinsJobOption(payload, streamKey) {
  const options = listNightlyJenkinsJobOptions(payload)
  if (options.length === 0) return null
  const key = streamKey ?? options[0]?.stream_key
  return options.find((o) => o.stream_key === key) || options[0]
}

/** Hash query key for nightly test-results source deep links (`#/system-health/test-execution?source=…`). */
export const TEST_RESULTS_SOURCE_QUERY_PARAM = 'source'

/**
 * @param {object|null|undefined} payload
 * @param {string|null|undefined} streamKey
 * @returns {string|null}
 */
function nightlyOptionFieldMatchesLower(option, valueLower) {
  return [option.stream_key, option.label, option.jenkins_job].some(
    (value) => (value || '').toLowerCase() === valueLower
  )
}

export function testResultsSourceQueryValue(payload, streamKey) {
  const option = resolveNightlyJenkinsJobOption(payload, streamKey)
  if (!option) return null
  const options = listNightlyJenkinsJobOptions(payload)
  const labelKey = (option.label || '').toLowerCase()
  const labelIsUnique =
    labelKey.length > 0
    && options.filter((o) => nightlyOptionFieldMatchesLower(o, labelKey)).length === 1
  if (labelIsUnique && option.label) return option.label
  return option.stream_key
}

/**
 * Resolve `source` query value to a nightly `stream_key`.
 *
 * @param {object|null|undefined} payload
 * @param {string|null|undefined} queryValue
 * @returns {string|null}
 */
export function streamKeyFromTestResultsSourceQuery(payload, queryValue) {
  if (queryValue == null || typeof queryValue !== 'string') return null
  const needle = decodeURIComponent(queryValue.trim())
  if (!needle) return null
  const options = listNightlyJenkinsJobOptions(payload)
  if (options.length === 0) return null
  const lower = needle.toLowerCase()
  const match =
    options.find((o) => o.stream_key === needle)
    || options.find((o) => o.label === needle || o.jenkins_job === needle)
    || options.find(
      (o) =>
        o.stream_key.toLowerCase() === lower
        || o.label.toLowerCase() === lower
        || (o.jenkins_job && o.jenkins_job.toLowerCase() === lower)
    )
  return match?.stream_key ?? null
}

const GATE_ROW_ORDER = ['cluster-health', 'operator-health']

/** Synthetic heatmap row → operator-health gate (RHAI-16425). */
export const RHOAI_DEPLOYMENT_ROW_LABEL = 'RHOAI Deployment'

/** @param {string} value */
export function normalizeComponentIdentityKey(value) {
  if (!value || typeof value !== 'string') return ''
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/**
 * @param {object} index
 * @param {string} key
 * @param {string} rowId
 */
function addComponentIdentityKey(index, key, rowId) {
  const normalized = normalizeComponentIdentityKey(key)
  if (!normalized || !rowId) return
  if (!index.has(normalized)) {
    index.set(normalized, rowId)
    return
  }
  const existing = index.get(normalized)
  if (existing !== rowId) index.set(normalized, null)
}

/**
 * Map canonical identity strings (id, name, jira_component) → producer row id, or `null` when ambiguous.
 *
 * @param {object[]} days
 * @returns {Map<string, string|null>}
 */
export function buildComponentIdentityIndex(days) {
  const index = new Map()
  for (const day of days || []) {
    for (const run of day.runs || []) {
      for (const comp of run.components || []) {
        if (!comp?.id) continue
        addComponentIdentityKey(index, comp.id, comp.id)
        if (comp.name) addComponentIdentityKey(index, comp.name, comp.id)
        if (comp.jira_component) addComponentIdentityKey(index, comp.jira_component, comp.id)
      }
    }
  }
  return index
}

/**
 * Producer component ids whose id, name, or jira_component matches a heatmap label.
 *
 * @param {string} componentName
 * @param {object[]} days
 * @param {{ run?: object|null }} [scope]
 * @returns {string[]}
 */
export function producerRowIdsMatchingHeatmapLabel(componentName, days, scope = {}) {
  if (!componentName || typeof componentName !== 'string') return []
  const key = normalizeComponentIdentityKey(componentName.trim())
  if (!key) return []
  const runs = scope.run
    ? [scope.run]
    : (days || []).flatMap((day) => day.runs || [])
  const ids = new Set()
  for (const run of runs) {
    if (!run || typeof run !== 'object') continue
    for (const comp of run.components || []) {
      if (!comp?.id) continue
      const fields = [comp.id, comp.name, comp.jira_component]
      if (fields.some((field) => normalizeComponentIdentityKey(field) === key)) {
        ids.add(comp.id)
      }
    }
  }
  return [...ids]
}

/** @param {string} componentName */
function legacySlugFromHeatmapLabel(componentName) {
  if (!componentName || typeof componentName !== 'string') return null
  const trimmed = componentName.trim()
  if (trimmed.toLowerCase() === RHOAI_DEPLOYMENT_ROW_LABEL.toLowerCase()) return 'operator-health'
  if (normalizeComponentIdentityKey(trimmed) === 'clusterhealth') return 'cluster-health'
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '')
  return slug.length > 0 ? slug : null
}

/**
 * Resolve a heatmap inventory label to a nightly matrix row id (producer components[].id).
 *
 * Prefer matching published canonical `name` or `jira_component`, not a slug of the label.
 *
 * @param {string} componentName
 * @param {object[]|Map<string, string|null>} daysOrIndex nightly `days[]` or prebuilt identity index
 * @param {{ run?: object|null }} [options] when set, match only the producer-selected run (disambiguates shared canonical names)
 * @returns {string|null}
 */
export function resolveHeatmapComponentToRowId(componentName, daysOrIndex, options = {}) {
  if (!componentName || typeof componentName !== 'string') return null
  const days = Array.isArray(daysOrIndex) ? daysOrIndex : []
  const { run } = options

  const matched = producerRowIdsMatchingHeatmapLabel(componentName, days, run ? { run } : {})
  if (matched.length === 1) return matched[0]
  if (matched.length > 1) return null

  if (daysOrIndex instanceof Map) {
    const trimmed = componentName.trim()
    const identityKey = normalizeComponentIdentityKey(trimmed)
    if (identityKey && daysOrIndex.has(identityKey)) {
      const fromIndex = daysOrIndex.get(identityKey)
      if (fromIndex) return fromIndex
    }
  }

  const trimmed = componentName.trim()
  const slug = legacySlugFromHeatmapLabel(trimmed)
  if (!slug) return null

  return slug
}

/**
 * @deprecated Prefer resolveHeatmapComponentToRowId with nightly `days` for joins.
 * Without nightly context, returns a legacy slug (heatmap-only placeholders).
 *
 * @param {string} componentName
 * @param {object[]|Map<string, string>|null} [daysOrIndex]
 * @returns {string|null}
 */
export function normalizeHeatmapComponentToNightlyId(componentName, daysOrIndex = null) {
  if (daysOrIndex != null) {
    const resolved = resolveHeatmapComponentToRowId(componentName, daysOrIndex)
    if (resolved) return resolved
  }
  return legacySlugFromHeatmapLabel(componentName)
}

/**
 * @param {object|null} day
 * @returns {{ run: object|null, error: string|null }}
 */
export function resolveSelectedRun(day) {
  if (!day || !Array.isArray(day.runs) || day.runs.length === 0) {
    return { run: null, error: null }
  }
  const selectedId = day.latest_run_id
  if (typeof selectedId !== 'string' || selectedId.length === 0) {
    return {
      run: null,
      error: 'Latest run unavailable: missing latest_run_id for this day.'
    }
  }
  const match = day.runs.find((r) => r && r.run_id === selectedId)
  if (!match) {
    return {
      run: null,
      error: `Latest run unavailable: selected run "${selectedId}" is not in this day's run list.`
    }
  }
  return { run: match, error: null }
}

/**
 * @param {object} run
 * @param {string} rowId
 * @returns {object|null}
 */
export function findMatrixCell(run, rowId) {
  if (!run) return null
  const gates = Array.isArray(run.gates) ? run.gates : []
  const gate = gates.find((g) => g && g.id === rowId)
  if (gate) return gate
  const components = Array.isArray(run.components) ? run.components : []
  return components.find((c) => c && c.id === rowId) || null
}

/** Match test-reports-dashboard nightly_health._gate_indicates_failure */
export function gateIndicatesFailure(gate) {
  if (!gate) return false
  const state = typeof gate.state === 'string' ? gate.state.toLowerCase() : ''
  if (state === 'failed' || state === 'blocked') return true
  const src = typeof gate.source_status === 'string' ? gate.source_status.trim().toLowerCase() : ''
  return src === 'failed' || src === 'failure' || src === 'fail' || src === 'notready' || src === 'not ready'
}

/**
 * Path A / legacy JSON may omit producer-side blocking; mirror GitLab apply_prerequisite_blocking for display.
 *
 * @param {object|null} cell
 * @param {object|null} run
 * @returns {object|null}
 */
export function applyPrerequisiteBlockingForDisplay(cell, run) {
  if (!cell || !run) return cell
  const cellState = typeof cell.state === 'string' ? cell.state.toLowerCase() : ''
  if (cellState === 'not_applicable' || cellState === 'blocked') return cell

  const gates = Array.isArray(run.gates) ? run.gates : []
  const cluster = gates.find((g) => g && g.id === 'cluster-health')
  const operator = gates.find((g) => g && g.id === 'operator-health')
  const deployment = run.deployment && typeof run.deployment === 'object' ? run.deployment : null
  const depFailed = deployment && String(deployment.state || '').toLowerCase() === 'failed'
  const shouldBlock = depFailed || gateIndicatesFailure(cluster) || gateIndicatesFailure(operator)
  if (!shouldBlock) return cell

  const reason =
    (typeof cell.reason_code === 'string' && cell.reason_code) ||
    (deployment && typeof deployment.reason_code === 'string' && deployment.reason_code) ||
    'prerequisite_failed'

  return { ...cell, state: 'blocked', reason_code: reason }
}

/**
 * @param {object|null} run
 * @param {string} rowId
 * @returns {object|null}
 */
export function resolveDisplayMatrixCell(run, rowId) {
  const cell = findMatrixCell(run, rowId)
  if (!cell || !run) return cell
  if (rowId === 'cluster-health' || rowId === 'operator-health') return cell
  return applyPrerequisiteBlockingForDisplay(cell, run)
}

/**
 * Primary label: readiness state wins for blocked; otherwise YAML source_status or state label.
 *
 * @param {object|null} cell
 * @returns {string}
 */
export function cellDisplayStatus(cell) {
  if (!cell) return ''
  const state = typeof cell.state === 'string' ? cell.state.toLowerCase() : ''
  if (state === 'blocked') return 'Blocked'
  if (typeof cell.source_status === 'string' && cell.source_status.length > 0) {
    return formatNightlyStatusLabel(cell.source_status)
  }
  if (typeof cell.state === 'string' && cell.state.length > 0) {
    return stateToPromotionGateLabel(cell.state)
  }
  return '—'
}

/**
 * BVT / DSC readiness when state is blocked (shown separately from Blocked).
 *
 * @param {object|null} cell
 * @returns {string|null}
 */
export function cellSourceStatusSubtitle(cell) {
  if (!cell || typeof cell.source_status !== 'string' || cell.source_status.length === 0) {
    return null
  }
  const state = typeof cell.state === 'string' ? cell.state.toLowerCase() : ''
  if (state !== 'blocked') return null
  return cell.source_status
}

/**
 * CSS class for DSC readiness text on blocked cells (source_status from YAML).
 *
 * @param {string|null|undefined} sourceStatus
 * @returns {string}
 */
export function dscSourceStatusClass(sourceStatus) {
  if (!sourceStatus) return ''
  const s = String(sourceStatus).trim().toLowerCase().replace(/\s+/g, '')
  if (s === 'ready' || s === 'passed' || s === 'pass') return 'dsc-status-ready'
  if (s === 'notready' || s === 'failed' || s === 'failure' || s === 'fail') return 'dsc-status-not-ready'
  return ''
}

const NIGHTLY_GATE_ROW_IDS = new Set(['cluster-health', 'operator-health'])

/**
 * Prefix for blocked-cell source_status subtitle (gate rows vs component DSC readiness).
 *
 * @param {string} rowId
 * @returns {'Gate'|'DSC'}
 */
export function cellSourceStatusSubtitlePrefix(rowId) {
  return NIGHTLY_GATE_ROW_IDS.has(rowId) ? 'Gate' : 'DSC'
}

/**
 * @param {object|null} cell
 * @returns {string|null}
 */
export function cellReasonSubtitle(cell) {
  if (!cell?.reason_code || typeof cell.reason_code !== 'string') return null
  return cell.reason_code.replace(/_/g, ' ')
}

/** Map readiness enum to promotion-gate YAML-style labels when source_status is absent. */
export function stateToPromotionGateLabel(state) {
  const map = {
    ready: 'Passed',
    failed: 'Failed',
    blocked: 'Blocked',
    unknown: 'Unknown',
    not_run: 'Not Run',
    not_applicable: 'Not Installed'
  }
  const key = String(state).toLowerCase()
  if (map[key]) return map[key]
  return formatNightlyStatusLabel(String(state).replace(/_/g, ' '))
}

/**
 * Title-case promotion-gate status strings for matrix labels (Passed, Not Ready, …).
 *
 * @param {string|null|undefined} raw
 * @returns {string}
 */
export function formatNightlyStatusLabel(raw) {
  if (raw == null || raw === '') return '—'
  const trimmed = String(raw).trim()
  const compact = trimmed.toLowerCase().replace(/\s+/g, '')
  const canonical = {
    passed: 'Passed',
    pass: 'Passed',
    ready: 'Ready',
    failed: 'Failed',
    failure: 'Failed',
    fail: 'Failed',
    blocked: 'Blocked',
    notinstalled: 'Not Installed',
    notready: 'Not Ready',
    unknown: 'Unknown',
    notrun: 'Not Run'
  }
  if (canonical[compact]) return canonical[compact]
  return trimmed.replace(/\b\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
}

function normalizeStatusToken(value) {
  if (value == null || typeof value !== 'string') return ''
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

/**
 * Matrix cell background tone from readiness semantics (not raw YAML casing).
 *
 * @param {object|null} cell
 * @returns {'green'|'red'|'amber'|'muted'|'neutral'}
 */
export function readinessCellTone(cell) {
  if (!cell) return 'neutral'
  const state = typeof cell.state === 'string' ? cell.state.toLowerCase() : ''
  if (state === 'blocked') return 'amber'
  if (state === 'failed') return 'red'
  if (state === 'ready') return 'green'
  if (state === 'not_applicable') return 'muted'
  if (state === 'unknown') return 'amber'
  if (state === 'not_run') return 'muted'

  const src = normalizeStatusToken(cell.source_status)
  if (src === 'passed' || src === 'pass' || src === 'ready') return 'green'
  if (src === 'failed' || src === 'failure' || src === 'fail') return 'red'
  if (src === 'notready') return 'red'
  if (src === 'notinstalled') return 'muted'
  if (src === 'unknown') return 'amber'
  return 'neutral'
}

/** Title-case row labels (Cluster Health, AI Gateway, …). */
export function titleCaseLabel(text) {
  if (!text || typeof text !== 'string') return text || ''
  return text.replace(/\b\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
}

/**
 * Same-day runs for the day panel: selected column run first, then chronological.
 *
 * @param {{ latest_run_id?: string, runs?: object[] }|null} day
 * @returns {object[]}
 */
export function orderDayRunsForPanel(day) {
  if (!day || !Array.isArray(day.runs)) return []
  const sorted = [...day.runs].sort((a, b) =>
    String(a.started_at || '').localeCompare(String(b.started_at || ''))
  )
  const latestId = day.latest_run_id
  if (typeof latestId !== 'string' || latestId.length === 0) {
    return sorted
  }
  const idx = sorted.findIndex((r) => r && r.run_id === latestId)
  if (idx <= 0) {
    return sorted
  }
  const selected = sorted[idx]
  return [selected, ...sorted.slice(0, idx), ...sorted.slice(idx + 1)]
}

/**
 * @param {string} status
 * @returns {'green'|'red'|'amber'|'muted'|'neutral'}
 */
export function statusColorClass(status) {
  if (!status) return 'neutral'
  const s = String(status).toLowerCase()
  if (s === 'passed' || s === 'ready') return 'green'
  if (s === 'blocked') return 'blocked'
  if (s === 'failed' || s === 'failure') return 'red'
  if (s === 'notready' || s === 'not ready') return 'red'
  if (s === 'notinstalled' || s === 'not installed' || s === 'not run' || s === 'not_run') return 'muted'
  if (s === 'unknown') return 'amber'
  return 'neutral'
}

/** Heatmap-style tile tone: align tile color with cellDisplayStatus label. */
export function nightlyCellTone(cell) {
  if (!cell) return 'neutral'
  const state = typeof cell.state === 'string' ? cell.state.toLowerCase() : ''
  if (state === 'blocked') return 'amber'
  const fromDisplay = statusColorClass(cellDisplayStatus(cell))
  if (fromDisplay === 'blocked') return 'amber'
  if (fromDisplay !== 'neutral') return fromDisplay
  return readinessCellTone(cell)
}

/**
 * @param {object[]} days
 * @param {{ component?: string }[]|null} [heatmapComponents] full heatmap inventory (not date-filtered)
 * @returns {string[]}
 */
export function collectMatrixRowIds(days, heatmapComponents = null) {
  const ids = new Set()

  for (const day of days) {
    for (const run of day.runs || []) {
      if (!run || typeof run !== 'object') continue
      const gateList = Array.isArray(run.gates) ? run.gates : []
      for (const gate of gateList) {
        if (gate?.id) ids.add(gate.id)
      }
      for (const comp of run.components || []) {
        if (comp?.id) ids.add(comp.id)
      }
    }
  }

  const heatmapOrder = []
  if (Array.isArray(heatmapComponents)) {
    for (const entry of heatmapComponents) {
      const matched = producerRowIdsMatchingHeatmapLabel(entry?.component, days)
      const rowIdsForEntry =
        matched.length > 0
          ? matched
          : [resolveHeatmapComponentToRowId(entry?.component, days)].filter(Boolean)
      for (const rowId of rowIdsForEntry) {
        ids.add(rowId)
        if (rowId === 'cluster-health' || rowId === 'operator-health') continue
        if (!heatmapOrder.includes(rowId)) heatmapOrder.push(rowId)
      }
    }
  }

  if (days.length > 0) {
    ids.add('cluster-health')
    ids.add('operator-health')
  }

  const ordered = []
  for (const gateId of GATE_ROW_ORDER) {
    if (ids.has(gateId)) {
      ordered.push(gateId)
      ids.delete(gateId)
    }
  }

  const heatmapSet = new Set(heatmapOrder)
  const nightlyOnly = Array.from(ids)
    .filter((id) => !heatmapSet.has(id))
    .sort((a, b) => a.localeCompare(b))

  return ordered.concat(heatmapOrder, nightlyOnly)
}

/**
 * @param {string} rowId
 * @param {{ component?: string }[]|null} heatmapComponents
 * @returns {string|null}
 */
export function rowLabelFromHeatmap(rowId, heatmapComponents, days = null) {
  if (!Array.isArray(heatmapComponents)) return null
  const dayList = Array.isArray(days) ? days : []
  for (const entry of heatmapComponents) {
    const matched = producerRowIdsMatchingHeatmapLabel(entry?.component, dayList)
    if (matched.includes(rowId)) return entry.component || null
    if (
      matched.length === 0 &&
      resolveHeatmapComponentToRowId(entry?.component, dayList) === rowId
    ) {
      return entry.component || null
    }
  }
  return null
}

/**
 * Heatmap `component` name for test-execution-detail links (gate rows excluded).
 *
 * @param {string} rowId
 * @param {{ component?: string }[]|null} heatmapComponents
 * @param {object[]|null} [days]
 * @returns {string|null}
 */
export function nightlyRowHeatmapLinkTarget(rowId, heatmapComponents, days = null) {
  if (NIGHTLY_GATE_ROW_IDS.has(rowId)) return null
  return rowLabelFromHeatmap(rowId, heatmapComponents, days)
}

/**
 * @param {object} rowCell
 * @returns {string}
 */
export function rowLabel(rowId, rowCell, heatmapComponents = null) {
  if (rowId === 'operator-health') return 'RHOAI Deployment'
  if (rowId === 'cluster-health') return 'Cluster Health'
  if (rowCell?.jira_component) return rowCell.jira_component
  if (rowCell?.name) return titleCaseLabel(rowCell.name)
  const fromHeatmap = rowLabelFromHeatmap(rowId, heatmapComponents)
  if (fromHeatmap) return titleCaseLabel(fromHeatmap)
  return titleCaseLabel(rowId)
}

/**
 * Tooltip for matrix row: preserve source id and dashboard canonical when label is Jira text.
 * @param {string} rowId
 * @param {object|null|undefined} rowCell
 * @returns {string}
 */
export function rowLabelTooltip(rowId, rowCell) {
  if (rowId === 'operator-health' || rowId === 'cluster-health') {
    return rowId
  }
  if (!rowCell || typeof rowCell !== 'object') {
    return `id: ${rowId}`
  }
  const parts = [`id: ${rowId}`]
  if (rowCell.name) {
    parts.push(`dashboard: ${rowCell.name}`)
  }
  if (rowCell.jira_component && rowCell.jira_component !== rowCell.name) {
    parts.push(`jira: ${rowCell.jira_component}`)
  }
  return parts.join(' · ')
}

export function visibleDayWindow(daysAsc, pageOffset, columnsPerPage) {
  const per = columnsPerPage
  const total = daysAsc.length
  if (total === 0) return []
  const end = Math.max(0, total - pageOffset * per)
  const start = Math.max(0, end - per)
  return daysAsc.slice(start, end)
}

/**
 * @param {import('vue').Ref<object|null>} payloadRef
 * @param {import('vue').Ref<{ component?: string }[]>|null} [heatmapComponentsRef]
 * @param {import('vue').Ref<string|null>|null} [selectedStreamKeyRef] optional v-model from parent
 */
export function useNightlyHealthMatrix(payloadRef, heatmapComponentsRef = null, selectedStreamKeyRef = null) {
  const pageOffset = ref(0)
  const selectedDate = ref(null)
  const internalStreamKey = ref(null)
  const selectedStreamKey = selectedStreamKeyRef || internalStreamKey

  const jenkinsJobOptions = computed(() => listNightlyJenkinsJobOptions(payloadRef.value))

  const allSortedDays = computed(() => {
    const payload = payloadRef.value
    const days = Array.isArray(payload?.days) ? [...payload.days] : []
    return days.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  })

  const sortedDays = computed(() => {
    const days = allSortedDays.value
    const options = jenkinsJobOptions.value
    if (options.length <= 1) return days
    const key = selectedStreamKey.value
    if (!key) return days
    return days.filter((day) => {
      const dayKey =
        typeof day.stream_key === 'string' && day.stream_key.length > 0
          ? day.stream_key
          : 'default'
      return dayKey === key
    })
  })

  const totalDays = computed(() => sortedDays.value.length)

  const columnsPerPage = computed(() => nightlyColumnsPerPage(totalDays.value))

  const maxPageOffset = computed(() => {
    const total = totalDays.value
    const per = columnsPerPage.value
    if (total <= per) return 0
    return Math.ceil((total - per) / per)
  })

  /** Newest window first; columns left → right = newer → older. */
  const visibleDays = computed(() => {
    const days = sortedDays.value
    const per = columnsPerPage.value
    const total = days.length
    if (total === 0) return []
    const end = Math.max(0, total - pageOffset.value * per)
    const start = Math.max(0, end - per)
    return days.slice(start, end).reverse()
  })

  const rowIds = computed(() =>
    collectMatrixRowIds(sortedDays.value, unref(heatmapComponentsRef) || null)
  )

  const canPageNewer = computed(() => pageOffset.value > 0)
  const canPageOlder = computed(() => pageOffset.value < maxPageOffset.value)

  function pageNewer() {
    if (canPageNewer.value) pageOffset.value -= 1
  }

  function pageOlder() {
    if (canPageOlder.value) pageOffset.value += 1
  }

  function openDay(date) {
    selectedDate.value = date
  }

  function closeDay() {
    selectedDate.value = null
  }

  const selectedDayEntry = computed(() => {
    if (!selectedDate.value) return null
    return sortedDays.value.find((d) => d.date === selectedDate.value) || null
  })

  const selectedDayRuns = computed(() => orderDayRunsForPanel(selectedDayEntry.value))

  const payloadDaysKey = computed(() => {
    const payload = payloadRef.value
    const days = Array.isArray(payload?.days) ? payload.days : []
    const dates = days.map((d) => `${d?.stream_key || ''}:${d?.date || ''}`).sort()
    const gen = payload?.generated_at || ''
    const jobs = JSON.stringify(payload?.jenkins_jobs || [])
    return `${gen}|${dates.join(',')}|${jobs}`
  })

  watch(payloadDaysKey, () => {
    const options = jenkinsJobOptions.value
    const current = selectedStreamKey.value
    const stillValid =
      typeof current === 'string'
      && current.length > 0
      && options.some((o) => o.stream_key === current)
    selectedStreamKey.value = stillValid ? current : (options[0]?.stream_key ?? null)
    pageOffset.value = 0
    selectedDate.value = null
  }, { immediate: true })

  watch(selectedStreamKey, () => {
    pageOffset.value = 0
    selectedDate.value = null
  })

  function jumpToNewestDays() {
    pageOffset.value = 0
  }

  const viewingOlderDays = computed(() => pageOffset.value > 0)

  const newestDayDate = computed(() => {
    const days = sortedDays.value
    return days.length ? days[days.length - 1].date : ''
  })

  return {
    pageOffset,
    selectedDate,
    selectedStreamKey,
    jenkinsJobOptions,
    sortedDays,
    visibleDays,
    rowIds,
    canPageNewer,
    canPageOlder,
    pageNewer,
    pageOlder,
    openDay,
    closeDay,
    selectedDayEntry,
    selectedDayRuns,
    maxPageOffset,
    totalDays,
    columnsPerPage,
    jumpToNewestDays,
    viewingOlderDays,
    newestDayDate
  }
}

export function friendlyDate(iso) {
  if (!iso) return ''
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

export function formatTimestamp(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function safeHttpUrl(url) {
  if (!url || typeof url !== 'string') return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return url
  } catch {
    /* ignore */
  }
  return null
}
