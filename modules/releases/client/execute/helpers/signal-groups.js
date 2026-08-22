/**
 * Categorize features into signal groups for the traffic overview.
 *
 * Uses both pipeline metrics (health, completionPct, blockerCount) and
 * Jira status (category + done status names) to avoid stale pipeline data
 * causing misclassification.
 */

const DONE_STATUS_NAMES = new Set([
  'closed',
  'done',
  'resolved',
  'cancelled',
  'release pending'
])

/**
 * Complete = pipeline 100% OR Jira done-delivery status.
 * Status-name fallback covers Closed / Release Pending when statusCategory is missing.
 *
 * @param {object} feature
 * @returns {boolean}
 */
export function isFeatureCompleteForSignals(feature) {
  if (!feature) return false
  if (feature.completionPct >= 100) return true
  if (feature.statusCategory === 'Done') return true
  const status = typeof feature.status === 'string'
    ? feature.status.trim().toLowerCase()
    : ''
  return DONE_STATUS_NAMES.has(status)
}

/**
 * @param {object[]} features - Array of feature index entries
 * @returns {object[]} Signal group objects with id, title, features, etc.
 */
export function categorizeFeatures(features) {
  const all = features || []
  // Jira done-delivery or pipeline 100% — stale pipeline health should not override.
  const complete = all.filter(isFeatureCompleteForSignals)
  const active = all.filter(f => !isFeatureCompleteForSignals(f))

  const blocked = active.filter(f => effectiveHealth(f) === 'RED' && f.blockerCount > 0)
  const redOther = active.filter(f => effectiveHealth(f) === 'RED' && f.blockerCount === 0)
  // "Not Started" requires both pipeline (completionPct 0) and Jira (not "In Progress") agreement.
  const notStarted = active.filter(f =>
    effectiveHealth(f) === 'YELLOW' && f.completionPct === 0 && f.statusCategory !== 'In Progress'
  )
  const atRisk = active.filter(f =>
    effectiveHealth(f) === 'YELLOW' && (f.completionPct > 0 || f.statusCategory === 'In Progress')
  )
  const onTrack = active.filter(f => effectiveHealth(f) === 'GREEN')

  return [
    {
      id: 'blocked',
      title: 'Blocked',
      subtitle: 'Active blockers preventing progress',
      features: blocked,
      borderClass: 'border-red-300 dark:border-red-500/40',
      bgClass: 'bg-red-50 dark:bg-red-500/5',
      headerBg: 'bg-red-100 dark:bg-red-500/10',
      textClass: 'text-red-700 dark:text-red-400',
      dotClass: 'bg-red-500'
    },
    {
      id: 'red-other',
      title: 'Needs Attention',
      subtitle: 'Red health — stale or at risk of stalling',
      features: redOther,
      borderClass: 'border-red-200 dark:border-red-500/30',
      bgClass: 'bg-red-50/50 dark:bg-red-500/5',
      headerBg: 'bg-red-50 dark:bg-red-500/10',
      textClass: 'text-red-600 dark:text-red-400',
      dotClass: 'bg-red-400'
    },
    {
      id: 'at-risk',
      title: 'At Risk',
      subtitle: 'In progress but behind schedule',
      features: atRisk,
      borderClass: 'border-yellow-300 dark:border-yellow-500/40',
      bgClass: 'bg-yellow-50 dark:bg-yellow-500/5',
      headerBg: 'bg-yellow-100 dark:bg-yellow-500/10',
      textClass: 'text-yellow-700 dark:text-yellow-400',
      dotClass: 'bg-yellow-500'
    },
    {
      id: 'not-started',
      title: 'Not Started',
      subtitle: 'No progress yet',
      features: notStarted,
      borderClass: 'border-yellow-200 dark:border-yellow-500/30',
      bgClass: 'bg-yellow-50/50 dark:bg-yellow-500/5',
      headerBg: 'bg-yellow-50 dark:bg-yellow-500/10',
      textClass: 'text-yellow-600 dark:text-yellow-400',
      dotClass: 'bg-yellow-400'
    },
    {
      id: 'on-track',
      title: 'On Track',
      subtitle: 'Healthy and making progress',
      features: onTrack,
      borderClass: 'border-green-300 dark:border-green-500/40',
      bgClass: 'bg-green-50 dark:bg-green-500/5',
      headerBg: 'bg-green-100 dark:bg-green-500/10',
      textClass: 'text-green-700 dark:text-green-400',
      dotClass: 'bg-green-500'
    },
    {
      id: 'complete',
      title: 'Complete',
      subtitle: 'Fully delivered',
      features: complete,
      borderClass: 'border-green-200 dark:border-green-500/30',
      bgClass: 'bg-green-50/50 dark:bg-green-500/5',
      headerBg: 'bg-green-50 dark:bg-green-500/10',
      textClass: 'text-green-600 dark:text-green-400',
      dotClass: 'bg-green-400'
    }
  ].filter(g => g.features.length > 0)
}

/**
 * When pipeline health is missing, infer from Jira statusCategory so
 * features without pipeline data still appear in the correct bucket.
 */
export function effectiveHealth(f) {
  if (f.health) return f.health
  if (f.statusCategory === 'In Progress') return 'GREEN'
  return 'YELLOW'
}
