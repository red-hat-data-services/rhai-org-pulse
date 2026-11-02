import { ref, computed } from 'vue'

export const NIGHTLY_PAGE_SIZE = 5

const GATE_ROW_ORDER = ['cluster-health', 'operator-health']

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
    return cell.source_status
  }
  if (typeof cell.state === 'string' && cell.state.length > 0) {
    return stateToPromotionGateLabel(cell.state)
  }
  return '—'
}

/**
 * BVT / YAML status when readiness is blocked (shown separately from Blocked).
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
    ready: 'passed',
    failed: 'failed',
    blocked: 'Blocked',
    unknown: 'Unknown',
    not_run: 'Not Run',
    not_applicable: 'NotInstalled'
  }
  const key = String(state).toLowerCase()
  if (map[key]) return map[key]
  return String(state).replace(/_/g, ' ')
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

/** Heatmap-style tile tone for nightly matrix cells (maps blocked → amber). */
export function nightlyCellTone(cell) {
  if (!cell) return 'neutral'
  if (cell.state === 'blocked') return 'amber'
  return statusColorClass(cellDisplayStatus(cell)) === 'blocked'
    ? 'amber'
    : statusColorClass(cellDisplayStatus(cell))
}

/**
 * @param {object[]} days
 * @returns {string[]}
 */
export function collectMatrixRowIds(days) {
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
  const ordered = []
  for (const gateId of GATE_ROW_ORDER) {
    if (ids.has(gateId)) {
      ordered.push(gateId)
      ids.delete(gateId)
    }
  }
  const rest = Array.from(ids).sort((a, b) => a.localeCompare(b))
  return ordered.concat(rest)
}

/**
 * @param {object} rowCell
 * @returns {string}
 */
export function rowLabel(rowId, rowCell) {
  if (rowId === 'operator-health') return 'RHOAI deployment'
  if (rowCell?.name) return rowCell.name
  if (rowId === 'cluster-health') return 'Cluster health'
  return rowId
}

/**
 * @param {object|null} payload
 */
export function useNightlyHealthMatrix(payloadRef) {
  const pageOffset = ref(0)
  const selectedDate = ref(null)

  const sortedDays = computed(() => {
    const payload = payloadRef.value
    const days = Array.isArray(payload?.days) ? [...payload.days] : []
    return days.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  })

  const totalDays = computed(() => sortedDays.value.length)

  const maxPageOffset = computed(() =>
    Math.max(0, Math.ceil(totalDays.value / NIGHTLY_PAGE_SIZE) - 1)
  )

  const visibleDays = computed(() => {
    const start = pageOffset.value * NIGHTLY_PAGE_SIZE
    return sortedDays.value.slice(start, start + NIGHTLY_PAGE_SIZE)
  })

  const rowIds = computed(() => collectMatrixRowIds(sortedDays.value))

  const canPageNewer = computed(() => pageOffset.value > 0)
  const canPageOlder = computed(() => pageOffset.value < maxPageOffset.value)

  function pageNewer() {
    if (canPageNewer.value) pageOffset.value -= 1
  }

  function pageOlder() {
    if (canPageOlder.value) pageOffset.value += 1
  }

  function selectDay(date) {
    selectedDate.value = selectedDate.value === date ? null : date
  }

  const selectedDayEntry = computed(() => {
    if (!selectedDate.value) return null
    return sortedDays.value.find((d) => d.date === selectedDate.value) || null
  })

  const selectedDayRuns = computed(() => {
    const day = selectedDayEntry.value
    if (!day || !Array.isArray(day.runs)) return []
    return [...day.runs].sort((a, b) =>
      String(a.started_at || '').localeCompare(String(b.started_at || ''))
    )
  })

  return {
    pageOffset,
    selectedDate,
    sortedDays,
    visibleDays,
    rowIds,
    canPageNewer,
    canPageOlder,
    pageNewer,
    pageOlder,
    selectDay,
    selectedDayEntry,
    selectedDayRuns,
    maxPageOffset,
    totalDays
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
