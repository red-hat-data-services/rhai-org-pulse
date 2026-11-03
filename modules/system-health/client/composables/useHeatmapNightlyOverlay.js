import { computed, unref } from 'vue'
import {
  resolveSelectedRun,
  findMatrixCell,
  resolveHeatmapComponentToRowId
} from './useNightlyHealthMatrix'

export {
  normalizeHeatmapComponentToNightlyId,
  resolveHeatmapComponentToRowId,
  buildComponentIdentityIndex,
  RHOAI_DEPLOYMENT_ROW_LABEL
} from './useNightlyHealthMatrix'

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
  const days = Array.isArray(nightlyHealth?.days) ? nightlyHealth.days : []
  const day = buildNightlyDayMap(nightlyHealth).get(date)
  if (!day) return null
  const { run } = resolveSelectedRun(day)
  if (!run) return null
  const nightlyId = resolveHeatmapComponentToRowId(componentName, days, { run })
  if (!nightlyId) return null
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
    const days = Array.from(dayMap.value.values())
    const day = dayMap.value.get(date)
    if (!day) return null
    const { run } = resolveSelectedRun(day)
    if (!run) return null
    const nightlyId = resolveHeatmapComponentToRowId(componentName, days, { run })
    if (!nightlyId) return null
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
