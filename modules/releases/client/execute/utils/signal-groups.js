/**
 * Signal-group bucketing for Execute Overview (Feature List).
 *
 * Complete features are those fully delivered by pipeline metrics OR by Jira
 * done-delivery status — so Closed / Release Pending items with empty topology
 * do not land in Not Started.
 */

const DONE_STATUS_NAMES = new Set([
  'closed',
  'done',
  'resolved',
  'cancelled',
  'release pending'
])

/**
 * @param {object} feature
 * @returns {boolean}
 */
export function isFeatureCompleteForSignals(feature) {
  if (!feature) return false
  if (feature.completionPct >= 100) return true
  // Prefer statusCategory when present
  if (feature.statusCategory === 'Done') return true
  // Fallback: status name list (covers Release Pending if category is missing)
  const status = typeof feature.status === 'string'
    ? feature.status.trim().toLowerCase()
    : ''
  return DONE_STATUS_NAMES.has(status)
}

/**
 * Partition features into Overview signal buckets.
 * Complete is exclusive; remaining active features use health / blockers / pct.
 *
 * @param {object[]} features
 * @returns {{ complete: object[], blocked: object[], redOther: object[], atRisk: object[], notStarted: object[], onTrack: object[] }}
 */
export function partitionSignalFeatures(features) {
  const all = features || []
  const complete = all.filter(isFeatureCompleteForSignals)
  const active = all.filter(f => !isFeatureCompleteForSignals(f))

  return {
    complete,
    blocked: active.filter(f => f.health === 'RED' && f.blockerCount > 0),
    redOther: active.filter(f => f.health === 'RED' && f.blockerCount === 0),
    atRisk: active.filter(f => f.health === 'YELLOW' && f.completionPct > 0),
    notStarted: active.filter(f => f.health === 'YELLOW' && f.completionPct === 0),
    onTrack: active.filter(f => f.health === 'GREEN')
  }
}
