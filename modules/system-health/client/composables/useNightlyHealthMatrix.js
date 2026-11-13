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
    let inferredFromRuns = null
    for (const day of days) {
      const dayKey = dayStreamKey(day)
      if (dayKey !== stream_key) continue
      for (const run of day.runs || []) {
        const fromUrl = jenkinsJobPathFromUrl(run?.jenkins_url)
        if (fromUrl) {
          inferredFromRuns = fromUrl
          break
        }
      }
      if (inferredFromRuns) break
    }
    const metaJenkinsJob = typeof meta?.jenkins_job === 'string' ? meta.jenkins_job : null
    const metaLabel = typeof meta?.label === 'string' ? meta.label : null
    let label
    if (metaJenkinsJob) {
      label = metaJenkinsJob
    } else if (inferredFromRuns) {
      label = inferredFromRuns
    } else if (metaLabel && metaLabel !== stream_key && metaLabel.includes('/')) {
      label = metaLabel
    } else if (metaLabel) {
      label = metaLabel
    } else {
      label = stream_key
    }
    return {
      stream_key,
      label,
      jenkins_job: metaJenkinsJob || inferredFromRuns
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

/** E2E reporting stream ids reused as nightly `stream_key` — never prefer these in `?source=`. */
export const REPORTING_STREAM_KEYS = new Set(['rhoai-nightly', 'odh-nightly', 'release'])

/**
 * @param {{ stream_key?: string, label?: string, jenkins_job?: string|null }} option
 * @returns {string|null}
 */
function jenkinsJobPathForSource(option) {
  if (!option || typeof option !== 'object') return null
  if (typeof option.jenkins_job === 'string' && option.jenkins_job.trim()) {
    return option.jenkins_job.trim()
  }
  if (typeof option.label === 'string' && option.label.trim()) {
    return option.label.trim()
  }
  return null
}

/**
 * @param {{ stream_key?: string, label?: string, jenkins_job?: string|null }} option
 * @param {{ stream_key?: string, label?: string, jenkins_job?: string|null }[]} allOptions
 * @returns {string|null}
 */
function uniqueJenkinsSlugForSource(option, allOptions) {
  const jobPath = jenkinsJobPathForSource(option)
  if (!jobPath) return null
  const slug = jenkinsJobBasename(jobPath)
  if (!slug) return null
  const lower = slug.toLowerCase()
  const sameSlug = allOptions.filter((o) => {
    const path = jenkinsJobPathForSource(o)
    return path && jenkinsJobBasename(path).toLowerCase() === lower
  })
  if (sameSlug.length === 1) return slug
  return null
}

/**
 * Last path segment of a Jenkins job path (drops folder prefix).
 *
 * @param {string|null|undefined} jobPath
 * @returns {string}
 */
export function jenkinsJobBasename(jobPath) {
  if (!jobPath || typeof jobPath !== 'string') return ''
  const trimmed = jobPath.trim()
  const slash = trimmed.lastIndexOf('/')
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed
}

/**
 * @param {{ stream_key?: string, label?: string, jenkins_job?: string|null }} option
 * @returns {string}
 */
export function testResultsSourceBasename(option) {
  if (!option || typeof option !== 'object') return ''
  const path = option.jenkins_job || option.label || option.stream_key || ''
  return jenkinsJobBasename(path)
}

/**
 * @param {string|null|undefined} basename
 * @returns {string}
 */
export function humanizeJenkinsJobBasename(basename) {
  if (!basename || typeof basename !== 'string') return ''
  return basename
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

/**
 * Short name shown in the Test Results Source filter and in `?source=` (job basename, not stream_key).
 *
 * @param {{ stream_key?: string, label?: string, jenkins_job?: string|null }} option
 * @returns {string}
 */
export function testResultsSourceOptionLabel(option) {
  if (!option || typeof option !== 'object') return ''
  const jobPath = jenkinsJobPathForSource(option)
  if (jobPath && jobPath.includes('/')) {
    return jenkinsJobBasename(jobPath)
  }
  if (jobPath && jobPath !== option.stream_key) {
    return jenkinsJobBasename(jobPath)
  }
  const base = testResultsSourceBasename(option)
  return base || option.stream_key || ''
}

/**
 * Full Jenkins job path for UI when short basenames are not unique.
 *
 * @param {{ stream_key?: string, label?: string, jenkins_job?: string|null }} option
 * @returns {string}
 */
export function testResultsSourceFullPath(option) {
  if (!option || typeof option !== 'object') return ''
  const path = option.jenkins_job || option.label || ''
  if (typeof path === 'string' && path.trim()) return path.trim()
  return testResultsSourceOptionLabel(option)
}

/**
 * Label for the Test Results Source dropdown; uses full job path when basenames collide.
 *
 * @param {{ stream_key?: string, label?: string, jenkins_job?: string|null }} option
 * @param {{ stream_key?: string, label?: string, jenkins_job?: string|null }[]} allOptions
 * @returns {string}
 */
export function testResultsSourceDropdownLabel(option, allOptions) {
  const shortLabel = testResultsSourceOptionLabel(option)
  const list = Array.isArray(allOptions) ? allOptions : []
  if (list.length <= 1) return shortLabel
  const lower = shortLabel.toLowerCase()
  const sameBasename = list.filter(
    (o) => testResultsSourceOptionLabel(o).toLowerCase() === lower
  )
  if (sameBasename.length <= 1) return shortLabel
  const fullPath = testResultsSourceFullPath(option) || shortLabel
  const fullPathCollides = list.some(
    (o) => o !== option && testResultsSourceFullPath(o) === fullPath
  )
  if (!fullPathCollides) return fullPath
  const suffix = streamKeyDisambiguationLabel(option.stream_key)
  return suffix ? `${fullPath} (${suffix})` : fullPath
}

/**
 * Parenthetical disambiguator in the Test Results Source dropdown (never E2E reporting ids).
 *
 * @param {string|null|undefined} streamKey
 * @returns {string|null}
 */
export function streamKeyDisambiguationLabel(streamKey) {
  if (streamKey == null || typeof streamKey !== 'string') return null
  const trimmed = streamKey.trim()
  if (!trimmed || REPORTING_STREAM_KEYS.has(trimmed)) return null
  return trimmed
}

/**
 * @param {object|null|undefined} payload
 * @param {string|null|undefined} streamKey
 * @returns {string|null}
 */
export function testResultsSourceQueryValue(payload, streamKey) {
  const option = resolveNightlyJenkinsJobOption(payload, streamKey)
  if (!option) return null
  const options = listNightlyJenkinsJobOptions(payload)
  const fromJob = uniqueJenkinsSlugForSource(option, options)
  if (fromJob) return fromJob
  const candidate = testResultsSourceOptionLabel(option)
  if (!candidate) return option.stream_key
  const lower = candidate.toLowerCase()
  const sameLabel = options.filter(
    (o) => testResultsSourceOptionLabel(o).toLowerCase() === lower
  )
  if (sameLabel.length === 1) return candidate
  if (REPORTING_STREAM_KEYS.has(option.stream_key) && candidate && candidate !== option.stream_key) {
    return candidate
  }
  return option.stream_key
}

/**
 * Value for `?source=` — never an E2E reporting stream id when a Jenkins job label exists.
 *
 * @param {object|null|undefined} payload
 * @param {string|null|undefined} streamKey
 * @returns {string|null}
 */
export function testResultsSourceQueryValueForUrl(payload, streamKey) {
  const raw = testResultsSourceQueryValue(payload, streamKey)
  if (raw == null) return null
  if (!REPORTING_STREAM_KEYS.has(raw)) return raw
  const option = resolveNightlyJenkinsJobOption(payload, streamKey)
  if (!option) return raw
  const fromJob = testResultsSourceOptionLabel(option)
  if (fromJob && !REPORTING_STREAM_KEYS.has(fromJob)) return fromJob
  const full = testResultsSourceFullPath(option)
  if (full && full.includes('/') && !REPORTING_STREAM_KEYS.has(full)) {
    return jenkinsJobBasename(full) || full
  }
  return raw
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

  const byStreamKey = options.find((o) => o.stream_key === needle)
  if (byStreamKey) return byStreamKey.stream_key

  const byStreamKeyLower = options.find((o) => o.stream_key.toLowerCase() === lower)
  if (byStreamKeyLower) return byStreamKeyLower.stream_key

  const byFilterLabel = options.filter(
    (o) => testResultsSourceOptionLabel(o).toLowerCase() === lower
  )
  if (byFilterLabel.length === 1) return byFilterLabel[0].stream_key
  if (byFilterLabel.length > 1) return byFilterLabel[0].stream_key

  const byFullPath = options.find((o) => o.label === needle || o.jenkins_job === needle)
  if (byFullPath) return byFullPath.stream_key

  const byFullPathLower = options.find(
    (o) =>
      o.label.toLowerCase() === lower
      || (o.jenkins_job && o.jenkins_job.toLowerCase() === lower)
  )
  if (byFullPathLower) return byFullPathLower.stream_key

  return null
}

/**
 * Gates tab heading aligned with Test Results Source (basename + " Results").
 *
 * @param {object|null|undefined} payload
 * @param {string|null|undefined} streamKey
 * @returns {string}
 */
export function nightlyTestResultsPanelTitle(payload, streamKey) {
  const option = resolveNightlyJenkinsJobOption(payload, streamKey)
  if (!option) return 'Promotional Gate Test Status'
  const words = humanizeJenkinsJobBasename(testResultsSourceOptionLabel(option))
  if (!words) return 'Promotional Gate Test Status'
  return `${words} Results`
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
 * Identity strings a producer component answers to: its id, name, jira_component, plus the ids
 * and names of producer rows folded into it (`merged_from`, e.g. llamastackoperator / "Llama Stack"
 * folded into the OGX Core row), so heatmap labels of folded rows join the surviving row.
 *
 * @param {object} comp
 * @returns {string[]}
 */
function componentIdentityFields(comp) {
  const fields = [comp.id, comp.name, comp.jira_component]
  for (const folded of Array.isArray(comp.merged_from) ? comp.merged_from : []) {
    if (folded && typeof folded === 'object') fields.push(folded.id, folded.name)
  }
  return fields.filter((f) => typeof f === 'string' && f.length > 0)
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
        for (const field of componentIdentityFields(comp)) {
          addComponentIdentityKey(index, field, comp.id)
        }
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
      const fields = componentIdentityFields(comp)
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
 * Merge producer component fields across runs. Callers walk `days` oldest → newest, so `incoming`
 * is the newer run: its published name / Jira component win, older values only fill gaps.
 * Newest-wins keeps row identity in step with producer renames and remaps (e.g. sparkoperator
 * KubeRay → Kubeflow Spark Operator); oldest-wins froze rows on the first published mapping.
 *
 * @param {{ name?: string, jira_component?: string }} existing
 * @param {{ name?: string, jira_component?: string }} incoming
 * @returns {{ name?: string, jira_component?: string }}
 */
function mergeComponentMetaEntry(existing, incoming) {
  return {
    name: incoming.name || existing.name,
    jira_component: incoming.jira_component || existing.jira_component
  }
}

/**
 * A day's runs ordered oldest → newest by completion (then start) time, then build number.
 * Payload order is not guaranteed (producers store same-day retries newest-first).
 *
 * @param {object|null|undefined} day
 * @returns {object[]}
 */
function dayRunsOldestFirst(day) {
  const runs = Array.isArray(day?.runs) ? day.runs.filter((r) => r && typeof r === 'object') : []
  const ts = (r) => String(r.completed_at || r.started_at || '')
  const num = (r) => (Number.isFinite(Number(r.build_number)) ? Number(r.build_number) : -1)
  return runs
    .map((run, index) => ({ run, index }))
    .sort((a, b) => ts(a.run).localeCompare(ts(b.run)) || num(a.run) - num(b.run) || a.index - b.index)
    .map(({ run }) => run)
}

/**
 * Merged metadata per producer component id across all runs in `days`.
 *
 * @param {object[]} days
 * @returns {Map<string, { name?: string, jira_component?: string }>}
 */
function collectComponentMetaById(days) {
  const meta = new Map()
  for (const day of days || []) {
    // Same-day retries are stored newest-first; walk them oldest → newest so the newest wins.
    for (const run of dayRunsOldestFirst(day)) {
      for (const comp of run.components || []) {
        if (!comp?.id) continue
        const prev = meta.get(comp.id)
        if (!prev) {
          meta.set(comp.id, { name: comp.name, jira_component: comp.jira_component })
        } else {
          meta.set(comp.id, mergeComponentMetaEntry(prev, comp))
        }
      }
    }
  }
  return meta
}

/**
 * Stable identity for deduping matrix rows (prefer Jira filing name, then dashboard name).
 *
 * @param {string} rowId
 * @param {object[]} days
 * @param {Map<string, { name?: string, jira_component?: string }>|null} [metaById]
 * @returns {string}
 */
export function canonicalKeyForRowId(rowId, days, metaById = null) {
  if (!rowId) return ''
  const meta = metaById || collectComponentMetaById(days)
  const entry = meta.get(rowId)
  if (entry) {
    const key = normalizeComponentIdentityKey(entry.jira_component || entry.name)
    if (key) return key
  }
  return normalizeComponentIdentityKey(rowId)
}

/**
 * Dedupe key for matrix row ids: published name/jira only; raw ids stay distinct (no slug collapse).
 *
 * @param {string} rowId
 * @param {Map<string, { name?: string, jira_component?: string }>} metaById
 * @returns {string}
 */
function matrixRowDedupeKey(rowId, metaById) {
  if (!rowId) return ''
  if (rowId === 'cluster-health' || rowId === 'operator-health') return rowId
  const entry = metaById.get(rowId)
  if (entry) {
    const published = (entry.jira_component || entry.name || '').trim()
    if (published) return `pub:${published.toLowerCase()}`
  }
  return `id:${rowId}`
}

/**
 * Producer id to use for each published component (dedupe key), taken from the newest selected
 * run that emits one. When ids sharing a component change over time (llamastackoperator → ogx
 * under "OGX Core"), the row follows the id the producer emits today rather than whichever id an
 * older run or the heatmap label order happened to match first.
 *
 * @param {object[]} days sorted oldest → newest
 * @param {Map<string, { name?: string, jira_component?: string }>} metaById
 * @returns {Map<string, string>}
 */
function preferredRowIdByDedupeKey(days, metaById) {
  const preferred = new Map()
  for (let i = (days || []).length - 1; i >= 0; i -= 1) {
    const { run } = resolveSelectedRun(days[i])
    if (!run) continue
    for (const comp of run.components || []) {
      if (!comp?.id) continue
      const key = matrixRowDedupeKey(comp.id, metaById)
      if (!preferred.has(key)) preferred.set(key, comp.id)
    }
  }
  return preferred
}

/**
 * Newest producer cell for a row (labels and tooltips follow the latest published names).
 *
 * @param {string} rowId
 * @param {object[]} days sorted oldest → newest
 * @returns {object|null}
 */
function newestMatrixCellForRow(rowId, days) {
  const list = days || []
  for (let i = list.length - 1; i >= 0; i -= 1) {
    for (const run of dayRunsOldestFirst(list[i]).reverse()) {
      const cell = findMatrixCell(run, rowId, list)
      if (cell) return cell
    }
  }
  return null
}

/**
 * Row label from the newest run that has the row (e.g. "Inference Gateway" after a rename,
 * while older runs still say "AI Gateway").
 *
 * @param {string} rowId
 * @param {object[]} days sorted oldest → newest
 * @param {{ component?: string }[]|null} [heatmapComponents]
 * @returns {string}
 */
export function matrixRowLabel(rowId, days, heatmapComponents = null) {
  return rowLabel(rowId, newestMatrixCellForRow(rowId, days), heatmapComponents)
}

/**
 * @param {string} rowId
 * @param {object[]} days sorted oldest → newest
 * @returns {string}
 */
export function matrixRowLabelTooltip(rowId, days) {
  return rowLabelTooltip(rowId, newestMatrixCellForRow(rowId, days))
}

/**
 * One producer row id per heatmap inventory label (avoids duplicate matrix rows for alias ids).
 *
 * @param {string} componentName
 * @param {object[]} days
 * @returns {string|null}
 */
export function pickHeatmapInventoryRowId(componentName, days) {
  if (!componentName || typeof componentName !== 'string') return null
  const matched = producerRowIdsMatchingHeatmapLabel(componentName, days)
  if (matched.length === 1) return matched[0]
  if (matched.length > 1) {
    const labelKey = normalizeComponentIdentityKey(componentName.trim())
    const meta = collectComponentMetaById(days)
    const byJira = matched.filter(
      (id) => normalizeComponentIdentityKey(meta.get(id)?.jira_component) === labelKey
    )
    if (byJira.length === 1) return byJira[0]
    const byName = matched.filter(
      (id) => normalizeComponentIdentityKey(meta.get(id)?.name) === labelKey
    )
    if (byName.length === 1) return byName[0]

    const sortedDays = [...(days || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    for (let i = 0; i < sortedDays.length; i += 1) {
      const { run } = resolveSelectedRun(sortedDays[i])
      if (!run) continue
      const idsInRun = new Set((run.components || []).map((c) => c?.id).filter(Boolean))
      const active = matched.filter((id) => idsInRun.has(id))
      if (active.length === 1) return active[0]
      if (active.length > 1) return active.sort()[0]
    }
    return matched.sort()[0]
  }
  return resolveHeatmapComponentToRowId(componentName, days)
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
 * @param {object[]|null} [days] when set, resolve alias producer ids with the same canonical identity
 * @param {Map<string, { name?: string, jira_component?: string }>|null} [metaById]
 * @returns {object|null}
 */
export function findMatrixCell(run, rowId, days = null, metaById = null) {
  if (!run) return null
  const gates = Array.isArray(run.gates) ? run.gates : []
  const gate = gates.find((g) => g && g.id === rowId)
  if (gate) return gate
  const components = Array.isArray(run.components) ? run.components : []
  const direct = components.find((c) => c && c.id === rowId)
  if (direct) return direct
  if (!Array.isArray(days) || days.length === 0) return null

  const meta = metaById || collectComponentMetaById(days)
  const targetKey = canonicalKeyForRowId(rowId, days, meta)
  if (!targetKey) return null
  const matches = components.filter((c) => {
    if (!c?.id) return false
    return canonicalKeyForRowId(c.id, days, meta) === targetKey
  })
  return matches.length === 1 ? matches[0] : null
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
export function resolveDisplayMatrixCell(run, rowId, days = null) {
  const cell = findMatrixCell(run, rowId, days)
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
 * Caption under the cell status. Component cells name the DataScienceCluster component the
 * status was read from (producer `dsc_component`, e.g. "trustyai", "aigateway.batchGateway"),
 * so a user can map the row to the DSC. Older payloads without `dsc_component` keep "DSC: <status>".
 *
 * @param {string} rowId
 * @param {object|null} cell
 * @returns {{ text: string, status: string|null, title: string }|null}
 */
export function cellDscCaption(rowId, cell) {
  if (!cell) return null
  const status = cellSourceStatusSubtitle(cell)
  if (NIGHTLY_GATE_ROW_IDS.has(rowId)) {
    return status ? { text: `Gate: ${status}`, status, title: `Gate status: ${status}` } : null
  }
  const name = typeof cell.dsc_component === 'string' ? cell.dsc_component.trim() : ''
  if (status) {
    return {
      text: name ? `DSC ${name}: ${status}` : `DSC: ${status}`,
      status,
      title: name ? `DataScienceCluster component "${name}" is ${status}` : `DSC status: ${status}`
    }
  }
  if (name) {
    return { text: `DSC ${name}`, status: null, title: `DataScienceCluster component "${name}"` }
  }
  return null
}

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
  return text.replace(/\b\w+/g, (word) => {
    const lower = word.toLowerCase()
    if (lower === 'ai') return 'AI'
    if (lower === 'rhoai') return 'RHOAI'
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  })
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
 * Human-readable product line (RHOAI version, channel, optional product_label).
 *
 * @param {object|null|undefined} run
 * @returns {string}
 */
export function runProductUnderTestLabel(run) {
  const pg = run?.promotion_gate
  if (!pg || typeof pg !== 'object') return ''
  const parts = []
  if (pg.rhoai_version) parts.push(`RHOAI ${pg.rhoai_version}`)
  if (pg.update_channel) parts.push(String(pg.update_channel))
  if (pg.product_label) parts.push(String(pg.product_label))
  return parts.join(' · ')
}

/**
 * Cluster / OCP context from promotion_gate (excludes product version line).
 *
 * @param {object|null|undefined} run
 * @returns {string}
 */
export function runEnvironmentLine(run) {
  const pg = run?.promotion_gate
  if (!pg || typeof pg !== 'object') return ''
  const parts = []
  if (pg.cluster_name) parts.push(String(pg.cluster_name))
  if (pg.openshift_version) parts.push(`OCP ${pg.openshift_version}`)
  return parts.join(' · ')
}

/**
 * @param {object|null|undefined} run
 * @returns {string|null}
 */
export function runJenkinsBuildNumberDisplay(run) {
  if (run?.build_number == null) return null
  return `#${run.build_number}`
}

/**
 * @param {object|null|undefined} run
 * @returns {number|null}
 */
export function runDurationMs(run) {
  if (run?.duration_seconds != null && Number.isFinite(Number(run.duration_seconds))) {
    return Number(run.duration_seconds) * 1000
  }
  if (run?.duration_ms != null && Number.isFinite(Number(run.duration_ms))) {
    return Number(run.duration_ms)
  }
  const start = run?.started_at
  const end = run?.completed_at
  if (start && end) {
    const ms = Date.parse(end) - Date.parse(start)
    if (Number.isFinite(ms) && ms >= 0) return ms
  }
  return null
}

/**
 * @param {object|null|undefined} run
 * @returns {string|null}
 */
export function formatRunDuration(run) {
  const ms = runDurationMs(run)
  if (ms == null) return null
  const totalMin = Math.max(1, Math.round(ms / 60_000))
  if (totalMin < 60) return `${totalMin} min`
  const hours = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

/**
 * Subline under a matrix date header: selected Jenkins run + product under test.
 *
 * @param {object|null|undefined} run
 * @returns {string}
 */
export function nightlyColumnHeaderSubline(run) {
  if (!run) return ''
  const num =
    run.build_number != null ? `Run #${run.build_number}` : ''
  const product = runProductUnderTestLabel(run)
  return [num, product].filter(Boolean).join(' · ')
}

/**
 * Test Execution matrix source line for the day panel (promotion-gate job path).
 *
 * @param {{ stream_key?: string, label?: string, jenkins_job?: string|null }|null|undefined} option
 * @param {{ stream_key?: string, label?: string, jenkins_job?: string|null }[]} [allOptions]
 * @returns {string}
 */
export function nightlyTestSourceDescription(option, allOptions = []) {
  void allOptions
  if (!option) return 'Promotion gate'
  const path = testResultsSourceFullPath(option) || testResultsSourceBasename(option)
  return path ? `Promotion gate · ${path}` : 'Promotion gate'
}

/**
 * @param {unknown} ref
 * @returns {string|null}
 */
export function artifactRefHref(ref) {
  if (!ref) return null
  if (typeof ref === 'string') return safeHttpUrl(ref)
  if (typeof ref === 'object' && ref !== null) {
    const obj = /** @type {Record<string, unknown>} */ (ref)
    for (const key of ['url', 'href', 'browser_url']) {
      const candidate = obj[key]
      if (typeof candidate === 'string') {
        const href = safeHttpUrl(candidate)
        if (href) return href
      }
    }
  }
  return null
}

/**
 * Stable key for deduping http(s) links (hostname lowercased).
 *
 * @param {string} href
 * @returns {string}
 */
export function normalizeHttpUrlForCompare(href) {
  try {
    const parsed = new URL(href)
    parsed.hostname = parsed.hostname.toLowerCase()
    return parsed.href
  } catch {
    return href
  }
}

/**
 * @param {string} raw href or quay pullspec
 * @returns {string} normalized `sha256:<hex>` or empty
 */
export function quaySha256DigestKey(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return ''
  const match = raw.trim().match(/sha256:([a-f0-9]{64})/i)
  return match ? `sha256:${match[1].toLowerCase()}` : ''
}

/**
 * @param {object|null|undefined} run
 * @returns {Set<string>}
 */
export function runPromotionGateQuayDigestKeys(run) {
  /** @type {Set<string>} */
  const keys = new Set()
  const pg = run?.promotion_gate
  if (!pg || typeof pg !== 'object') return keys
  for (const field of ['ods_build_url', 'odsBuildUrl', 'operator_image_ref']) {
    const raw = pg[field]
    if (typeof raw !== 'string' || !raw.trim()) continue
    const key = quaySha256DigestKey(raw)
    if (key) keys.add(key)
    const browser = quayBrowserUrlFromImageRef(raw.trim())
    if (browser) {
      const fromBrowser = quaySha256DigestKey(browser)
      if (fromBrowser) keys.add(fromBrowser)
    }
  }
  return keys
}

/**
 * @param {string} segment
 * @returns {string}
 */
function safeDecodeUriSegment(segment) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * @param {string} path quay path after `quay.io/` (no registry prefix)
 * @returns {{ repo: string, tagPart: string|null }}
 */
function splitQuayRepoAndTag(path) {
  const slash = path.lastIndexOf('/')
  const colonSearchFrom = slash >= 0 ? slash + 1 : 0
  const colon = path.indexOf(':', colonSearchFrom)
  if (colon >= 0) {
    return { repo: path.slice(0, colon), tagPart: path.slice(colon + 1) }
  }
  return { repo: path, tagPart: null }
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
function looksLikeDigestToken(raw) {
  const s = String(raw || '').trim()
  return /^sha256:[a-f0-9]+$/i.test(s) || /^[a-f0-9]{7,64}$/i.test(s)
}

/**
 * @param {unknown} raw
 * @returns {string|null}
 */
export function quayBrowserUrlFromImageRef(raw) {
  const s = String(raw || '').trim()
  if (!s) return null
  const direct = safeHttpUrl(s)
  if (direct) return direct
  let ref = s
  if (ref.toLowerCase().startsWith('docker://')) {
    ref = ref.slice('docker://'.length)
  }
  if (!ref.toLowerCase().startsWith('quay.io/')) return null
  const path = ref.slice('quay.io/'.length)
  let repo
  let tagPart
  if (path.includes('@')) {
    const at = path.indexOf('@')
    repo = path.slice(0, at)
    tagPart = path.slice(at + 1)
  } else if (path.includes(':')) {
    const split = splitQuayRepoAndTag(path)
    repo = split.repo
    tagPart = split.tagPart
  } else {
    return `https://quay.io/repository/${path}`
  }
  repo = repo.trim()
  tagPart = tagPart.trim()
  if (!repo || !tagPart) return null
  const digestLike = /^sha256:[a-f0-9]+$/i.test(tagPart)
  if (digestLike) {
    let repoPath = repo
    if (repo.includes(':')) {
      repoPath = repo.slice(0, repo.lastIndexOf(':'))
    }
    repoPath = repoPath.trim()
    if (!repoPath) return null
    return `https://quay.io/repository/${repoPath}/manifest/${tagPart}`
  }
  const enc = encodeURIComponent(tagPart)
  return `https://quay.io/repository/${repo}/tag/${enc}`
}

/**
 * @param {object|null|undefined} run
 * @returns {{ id: string, label: string, href: string|null, unavailable: boolean }[]}
 */
export function runArtifactPanelEntries(run) {
  const artifacts = run?.artifacts
  if (artifacts && typeof artifacts === 'object' && artifacts.s3_artifacts) {
    const href = artifactRefHref(artifacts.s3_artifacts)
    if (href) {
      return [{
        id: 's3_artifacts',
        label: 'S3 Artifacts',
        href,
        unavailable: false
      }]
    }
  }
  const specs = [
    { id: 's3_artifacts', label: 'S3 Artifacts' },
    { id: 'pod_logs', label: 'Pod logs' },
    { id: 'bvt_results', label: 'BVT results' }
  ]
  return specs
    .map(({ id, label }) => {
      const href = artifacts && typeof artifacts === 'object' ? artifactRefHref(artifacts[id]) : null
      return { id, label, href, unavailable: !href }
    })
    .filter((entry) => !entry.unavailable)
}

/**
 * Jenkins-line S3 folder link: plain storage prefix, linked artifact type word(s).
 *
 * @param {object|null|undefined} run
 * @returns {{ plainPrefix: string, linkText: string, href: string }|null}
 */
export function runS3ArtifactsInlineLink(run) {
  for (const entry of runArtifactPanelEntries(run)) {
    if (entry.id === 's3_artifacts' && entry.href) {
      const words = String(entry.label || '').trim().split(/\s+/).filter(Boolean)
      const plainPrefix = words.length > 1 ? words[0] : ''
      const linkText = words.length > 1 ? words.slice(1).join(' ') : String(entry.label || 'Artifacts')
      return { plainPrefix, linkText, href: entry.href }
    }
  }
  return null
}

const JIRA_KEY_LABEL_RE = /^[A-Z][A-Z0-9]+-\d+$/

function isJiraKeyLabel(label) {
  return typeof label === 'string' && JIRA_KEY_LABEL_RE.test(label.trim())
}

/**
 * Jira tickets the promotion gate created or reused in this run.
 * Reads `run.jira.issues`; falls back to legacy Jira-key entries in `org_pulse_links`.
 * When there are none, `emptyText` explains why (e.g. dry-run) next to "No Jira tied in this run".
 *
 * @param {object|null|undefined} run
 * @returns {{ issues: { key: string, href: string, action: string }[], emptyText: string }}
 */
export function runJiraSummary(run) {
  /** @type {{ key: string, href: string, action: string }[]} */
  const issues = []
  const seen = new Set()
  const add = (key, rawHref, action) => {
    const k = typeof key === 'string' ? key.trim().toUpperCase() : ''
    const href = safeHttpUrl(rawHref)
    if (!k || !href || seen.has(k)) return
    seen.add(k)
    issues.push({ key: k, href, action: action === 'created' || action === 'reused' ? action : '' })
  }
  const jira = run?.jira
  if (Array.isArray(jira?.issues)) {
    jira.issues.forEach((item) => add(item?.key, item?.href, item?.action))
  }
  if (!issues.length && Array.isArray(run?.org_pulse_links)) {
    run.org_pulse_links.forEach((item) => {
      if (isJiraKeyLabel(item?.label)) add(item.label, item.href, '')
    })
  }
  let emptyText = 'No Jira tied in this run'
  const status = typeof jira?.status === 'string' ? jira.status : ''
  if (status === 'dry_run') emptyText += ' (Jira reporting ran in dry-run mode)'
  else if (status === 'disabled') emptyText += ' (Jira reporting disabled)'
  else if (status === 'failed') emptyText += ' (Jira reporter failed)'
  return { issues, emptyText }
}

/**
 * Producer `org_pulse_links` minus any href already shown from `artifacts`.
 *
 * @param {object|null|undefined} run
 * @returns {{ id: string, label: string, href: string }[]}
 */
export function runOrgPulsePanelLinks(run) {
  const artifactHrefs = new Set(
    runArtifactPanelEntries(run)
      .map((entry) => entry.href)
      .filter((href) => typeof href === 'string' && href)
      .map((href) => normalizeHttpUrlForCompare(href))
  )
  const odsHref = runOdsBuildUrl(run)
  const odsKey = odsHref ? normalizeHttpUrlForCompare(odsHref) : ''
  const digestKeys = runPromotionGateQuayDigestKeys(run)
  const showQuayOnProductLine = Boolean(odsHref)
  const raw = run?.org_pulse_links
  if (!Array.isArray(raw)) return []
  /** @type {{ id: string, label: string, href: string }[]} */
  const links = []
  const seen = new Set()
  raw.forEach((item, idx) => {
    // Legacy producers put Jira tickets here; they are shown on the Jira line instead.
    if (isJiraKeyLabel(item?.label)) return
    const rawHref = item?.href
    const href = safeHttpUrl(rawHref) || quayBrowserUrlFromImageRef(rawHref)
    const dedupeKey = href ? normalizeHttpUrlForCompare(href) : ''
    const label = typeof item?.label === 'string' && item.label.trim() ? item.label.trim() : 'Link'
    const linkDigest = quaySha256DigestKey(String(rawHref || '')) || quaySha256DigestKey(href || '')
    if (!href || artifactHrefs.has(dedupeKey) || seen.has(dedupeKey)) return
    if (odsKey && dedupeKey === odsKey) return
    if (showQuayOnProductLine && /^image$/i.test(label)) return
    if (showQuayOnProductLine && digestKeys.size && linkDigest && digestKeys.has(linkDigest)) return
    seen.add(dedupeKey)
    links.push({ id: `org-pulse-link-${idx}`, label, href })
  })
  return links
}

/**
 * @param {object|null|undefined} run
 * @returns {string|null}
 */
export function runOdsBuildUrl(run) {
  const pg = run?.promotion_gate
  if (!pg || typeof pg !== 'object') return null
  const raw = pg.ods_build_url || pg.odsBuildUrl
  let trimmed = typeof raw === 'string' ? raw.trim() : ''
  if (!trimmed) {
    const imageRef = pg.operator_image_ref
    trimmed = typeof imageRef === 'string' ? imageRef.trim() : ''
  }
  if (!trimmed) return null
  return safeHttpUrl(trimmed) || quayBrowserUrlFromImageRef(trimmed)
}

const ODS_LINK_HASH_DISPLAY_LEN = 12

/**
 * @param {string} raw
 * @returns {string}
 */
export function shortenDigestForDisplay(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  const sha = s.match(/sha256:([a-f0-9]+)/i)
  if (sha) return sha[1].slice(0, ODS_LINK_HASH_DISPLAY_LEN)
  if (/^[a-f0-9]{7,64}$/i.test(s)) return s.slice(0, ODS_LINK_HASH_DISPLAY_LEN)
  if (s.length > ODS_LINK_HASH_DISPLAY_LEN) return s.slice(0, ODS_LINK_HASH_DISPLAY_LEN)
  return s
}

/**
 * Hyperlink text for promotion_gate ODS / quay payload URL (short digest or hash).
 *
 * @param {object|null|undefined} run
 * @returns {string}
 */
export function runOdsBuildLinkLabel(run) {
  const href = runOdsBuildUrl(run)
  if (!href) return ''
  try {
    const u = new URL(href)
    const fragment = u.hash.replace(/^#/, '')
    if (fragment) {
      const short = shortenDigestForDisplay(fragment)
      if (short) return short
    }
    for (const key of ['hash', 'digest', 'sha256', 'manifest']) {
      const value = u.searchParams.get(key)
      if (value) {
        const short = shortenDigestForDisplay(value)
        if (short) return short
      }
    }
    const segments = u.pathname.split('/').filter(Boolean)
    const tagIdx = segments.lastIndexOf('tag')
    if (tagIdx >= 0 && tagIdx < segments.length - 1) {
      const afterTag = segments.slice(tagIdx + 1).map((s) => safeDecodeUriSegment(s))
      for (let j = afterTag.length - 1; j >= 0; j -= 1) {
        const part = afterTag[j]
        if (looksLikeDigestToken(part)) {
          return shortenDigestForDisplay(part)
        }
      }
      if (segments.includes('repository') && afterTag.length === 1) {
        const part = afterTag[0]
        if (looksLikeDigestToken(part)) {
          return shortenDigestForDisplay(part)
        }
        return part || 'build'
      }
    }
    for (let i = segments.length - 1; i >= 0; i -= 1) {
      const seg = safeDecodeUriSegment(segments[i])
      if (looksLikeDigestToken(seg)) {
        return shortenDigestForDisplay(seg)
      }
    }
  } catch {
    // not a parseable URL — fall through
  }
  const pg = run?.promotion_gate
  const imageRef = pg && typeof pg === 'object' ? pg.operator_image_ref : null
  if (typeof imageRef === 'string' && imageRef.includes('@')) {
    const suffix = imageRef.split('@').pop()
    if (looksLikeDigestToken(suffix)) {
      const short = shortenDigestForDisplay(suffix)
      if (short) return short
    }
  }
  return 'build'
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
 * Components that must not appear as rows in the promotion-gate matrix.
 * Keys are normalizeComponentIdentityKey() of the producer id, published name, Jira component or
 * heatmap label. They are hidden here (not only at the producer) because rows also come from
 * historic nightly runs already stored in Org Pulse and from the full heatmap inventory, neither of
 * which is rewritten when the producer stops emitting a component.
 */
export const HIDDEN_MATRIX_COMPONENT_KEYS = new Set([
  'workloadorchestration',
  'distributedworkloads',
  'kueue',
  'demos',
  'other',
  'others',
  'aitestingworkflowvalidation',
  'testops'
])

/**
 * @param {...(string|null|undefined)} candidates id / name / jira_component / heatmap label
 * @returns {boolean}
 */
export function isHiddenMatrixComponent(...candidates) {
  return candidates.some((c) => {
    const key = normalizeComponentIdentityKey(typeof c === 'string' ? c : '')
    return key !== '' && HIDDEN_MATRIX_COMPONENT_KEYS.has(key)
  })
}

/**
 * @param {object[]} days
 * @param {{ component?: string }[]|null} [heatmapComponents] full heatmap inventory (not date-filtered)
 * @returns {string[]}
 */
export function collectMatrixRowIds(days, heatmapComponents = null) {
  const ids = new Set()
  const metaById = collectComponentMetaById(days)
  const isHiddenRowId = (id) => {
    const entry = metaById.get(id)
    return isHiddenMatrixComponent(id, entry?.name, entry?.jira_component)
  }
  const preferredIdByCanon = preferredRowIdByDedupeKey(days, metaById)
  /** Several producer ids can share one published component (OGX Core: ogx + llamastackoperator). */
  const preferRowId = (id) => {
    if (id === 'cluster-health' || id === 'operator-health') return id
    return preferredIdByCanon.get(matrixRowDedupeKey(id, metaById)) || id
  }

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
  const canonicalKeysInOrder = new Set()
  if (Array.isArray(heatmapComponents)) {
    for (const entry of heatmapComponents) {
      if (isHiddenMatrixComponent(entry?.component)) continue
      const pickedId = pickHeatmapInventoryRowId(entry?.component, days)
      if (!pickedId) continue
      const rowId = preferRowId(pickedId)
      if (isHiddenRowId(rowId)) continue
      ids.add(rowId)
      if (rowId === 'cluster-health' || rowId === 'operator-health') continue
      const canon = matrixRowDedupeKey(rowId, metaById)
      if (canonicalKeysInOrder.has(canon)) continue
      canonicalKeysInOrder.add(canon)
      if (!heatmapOrder.includes(rowId)) heatmapOrder.push(rowId)
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
  const nightlyOnly = [...new Set(Array.from(ids).map(preferRowId))]
    .filter((id) => !heatmapSet.has(id))
    .filter((id) => !isHiddenRowId(id))
    .filter((id) => {
      if (id === 'cluster-health' || id === 'operator-health') return true
      const canon = matrixRowDedupeKey(id, metaById)
      if (canonicalKeysInOrder.has(canon)) return false
      canonicalKeysInOrder.add(canon)
      return true
    })
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
export function nightlyRowHeatmapLinkTarget(_rowId, _heatmapComponents, _days = null) {
  // Promotion-gate nightly matrix: component names are plain text (RHAI-18946 §5).
  // Heatmap drill-down stays on the heatmap view, not matrix row links.
  return null
}

/**
 * @param {object} rowCell
 * @returns {string}
 */
export function rowLabel(rowId, rowCell, heatmapComponents = null) {
  if (rowId === 'operator-health') return 'RHOAI Deployment'
  if (rowId === 'cluster-health') return 'Cluster Health'
  if (rowCell?.jira_component) return rowCell.jira_component
  if (rowCell?.name) return String(rowCell.name).trim()
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
