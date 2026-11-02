import { computed, unref } from 'vue'
import { resolveSelectedRun, findMatrixCell } from './useNightlyHealthMatrix'

/** Synthetic heatmap row label for BVT / operator-health gate (RHAI-16425). */
export const RHOAI_DEPLOYMENT_ROW_LABEL = 'RHOAI Deployment'

/**
 * Match heatmap row names to nightly_health components[].id (producer contract).
 * Display names are normalized; explicit label maps to operator-health gate.
 *
 * @param {string} componentName
 * @returns {string|null}
 */
export function normalizeHeatmapComponentToNightlyId(componentName) {
  if (!componentName || typeof componentName !== 'string') return null
  const trimmed = componentName.trim()
  if (trimmed === RHOAI_DEPLOYMENT_ROW_LABEL) return 'operator-health'
  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '')
  return normalized.length > 0 ? normalized : null
}

/**
 * @param {object|null} nightlyHealth
 * @returns {Map<string, object>}
 */
export function buildNightlyDayMap(nightlyHealth) {
  const map = new Map()
  const days = Array.isArray(nightlyHealth?.days) ? nightlyHealth.days : []
  for (const day of days) {
    if (day?.date) map.set(day.date, day)
  }
  return map
}

/**
 * Producer-selected run + component/gate cell for a heatmap row and date.
 *
 * @returns {{ day: object, run: object, cell: object }|null}
 */
export function lookupNightlyCell(nightlyHealth, date, componentName) {
  if (!date || !componentName) return null
  const nightlyId = normalizeHeatmapComponentToNightlyId(componentName)
  if (!nightlyId) return null
  const day = buildNightlyDayMap(nightlyHealth).get(date)
  if (!day) return null
  const { run } = resolveSelectedRun(day)
  if (!run) return null
  const cell = findMatrixCell(run, nightlyId)
  if (!cell) return null
  return { day, run, cell }
}

/**
 * @param {object|null} cell
 * @returns {boolean}
 */
export function isBlockedReadiness(cell) {
  if (!cell || typeof cell.state !== 'string') return false
  return cell.state.toLowerCase() === 'blocked'
}

/**
 * @param {object|null} payloadRef vue ref or raw nightly_health object
 */
export function useHeatmapNightlyOverlay(payloadRef) {
  const dayMap = computed(() => buildNightlyDayMap(unref(payloadRef)))

  function overlayFor(componentName, date) {
    if (!date || !componentName) return null
    const nightlyId = normalizeHeatmapComponentToNightlyId(componentName)
    if (!nightlyId) return null
    const day = dayMap.value.get(date)
    if (!day) return null
    const { run } = resolveSelectedRun(day)
    if (!run) return null
    const cell = findMatrixCell(run, nightlyId)
    if (!cell) return null
    return { day, run, cell }
  }

  function hasNightlyForDate(date) {
    return dayMap.value.has(date)
  }

  return {
    dayMap,
    overlayFor,
    hasNightlyForDate,
    lookupNightlyCell: (date, componentName) =>
      lookupNightlyCell(unref(payloadRef), date, componentName)
  }
}
