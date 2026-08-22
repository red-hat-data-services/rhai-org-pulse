/**
 * Client-side column sorting for Features List (FeatureReadinessView).
 */

import { worstFailedSeverity, SEVERITY_RANK } from './fpdor-severity.js'

var PRIORITY_ORDER = {
  Blocker: 0,
  Critical: 1,
  Major: 2,
  Normal: 3,
  Minor: 4
}

var RECOMMENDATION_ORDER = {
  approve: 0,
  revise: 1,
  reject: 2
}

export var SORTABLE_COLUMNS = [
  'rank',
  'score',
  'readiness',
  'key',
  'title',
  'outcome',
  'targetVersion',
  'fixVersion',
  'alignment',
  'components',
  'team',
  'rubric',
  'recommendation',
  'status',
  'priority',
  'attention'
]

/**
 * @param {object} feature
 * @param {string} column
 * @returns {string|number}
 */
export function getSortValue(feature, column) {
  if (!feature) return ''
  if (column === 'rank') {
    return feature.rank != null ? feature.rank : Number.POSITIVE_INFINITY
  }
  if (column === 'score') {
    return feature.effectivePriorityScore != null
      ? feature.effectivePriorityScore
      : Number.NEGATIVE_INFINITY
  }
  if (column === 'readiness') {
    var sev = worstFailedSeverity(feature)
    if (!sev) return 0
    return SEVERITY_RANK[sev] || 99
  }
  if (column === 'key') return feature.key || ''
  if (column === 'title') return (feature.title || '').toLowerCase()
  if (column === 'outcome') return (feature.bigRock || '').toLowerCase()
  if (column === 'targetVersion') {
    var tvs = feature.targetVersions || []
    return tvs.length > 0 ? String(tvs[0]).toLowerCase() : ''
  }
  if (column === 'fixVersion') return (feature.fixVersion || '').toLowerCase()
  if (column === 'alignment') {
    // Keep in sync with ALIGNMENT_CATEGORY_PRIORITY (best → worst for asc).
    var order = {
      aligned_on_time: 0,
      aligned_late: 1,
      fv_only: 2,
      tv_only: 3,
      after_requested: 4,
      misaligned: 5
    }
    var ao = order[feature.alignmentCategory]
    return ao !== undefined ? ao : 99
  }
  if (column === 'components') {
    var comps = feature.components || []
    return comps.length > 0 ? String(comps[0]).toLowerCase() : ''
  }
  if (column === 'team') return (feature.team || '').toLowerCase()
  if (column === 'rubric') {
    return feature.rubricTotal != null ? feature.rubricTotal : Number.NEGATIVE_INFINITY
  }
  if (column === 'recommendation') {
    var rec = (feature.recommendation || '').toLowerCase()
    return RECOMMENDATION_ORDER[rec] !== undefined ? RECOMMENDATION_ORDER[rec] : 99
  }
  if (column === 'status') return (feature.status || '').toLowerCase()
  if (column === 'priority') {
    var po = PRIORITY_ORDER[feature.priority]
    return po !== undefined ? po : 99
  }
  if (column === 'attention') return feature.needsAttention ? 1 : 0
  return ''
}

/**
 * Default Features List order: score desc, then rubric desc.
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
export function compareByDefaultScore(a, b) {
  var sa = a.effectivePriorityScore != null ? a.effectivePriorityScore : Number.NEGATIVE_INFINITY
  var sb = b.effectivePriorityScore != null ? b.effectivePriorityScore : Number.NEGATIVE_INFINITY
  if (sb !== sa) return sb - sa
  var ra = a.rubricTotal != null ? a.rubricTotal : Number.NEGATIVE_INFINITY
  var rb = b.rubricTotal != null ? b.rubricTotal : Number.NEGATIVE_INFINITY
  return rb - ra
}

/**
 * @param {object[]} features
 * @param {{ column: string|null, direction: string }} sortState
 * @returns {object[]}
 */
export function sortFeatures(features, sortState) {
  var list = features.slice()
  if (!sortState || !sortState.column || SORTABLE_COLUMNS.indexOf(sortState.column) === -1) {
    return list.sort(compareByDefaultScore)
  }
  var col = sortState.column
  var dir = sortState.direction === 'asc' ? 1 : -1
  list.sort(function(a, b) {
    var va = getSortValue(a, col)
    var vb = getSortValue(b, col)
    if (va < vb) return -1 * dir
    if (va > vb) return 1 * dir
    return compareByDefaultScore(a, b)
  })
  return list
}

/**
 * Preferred first click direction per column.
 * Score/rubric/# default high-first; most others A→Z / ready-first.
 * @param {string} column
 * @returns {'asc'|'desc'}
 */
export function firstDirectionForColumn(column) {
  if (column === 'score' || column === 'rubric' || column === 'rank' || column === 'attention') {
    return 'desc'
  }
  return 'asc'
}

/**
 * Three-state toggle: unset → firstDir → opposite → unset (default score order).
 * @param {{ column: string|null, direction: string }} sortState
 * @param {string} column
 * @returns {{ column: string|null, direction: string }}
 */
export function nextSortState(sortState, column) {
  if (SORTABLE_COLUMNS.indexOf(column) === -1) {
    return { column: sortState.column, direction: sortState.direction }
  }
  if (sortState.column !== column) {
    return { column: column, direction: firstDirectionForColumn(column) }
  }
  var first = firstDirectionForColumn(column)
  var second = first === 'asc' ? 'desc' : 'asc'
  if (sortState.direction === first) {
    return { column: column, direction: second }
  }
  return { column: null, direction: 'asc' }
}
