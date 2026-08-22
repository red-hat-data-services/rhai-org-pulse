import { EARLY_STATUSES, BLOCKING_HYGIENE_RULES } from './constants.js'

/**
 * Compute planning-ready gates (ported from org-pulse feature-readiness.js).
 * @param {object} feature
 */
export function computeReadiness(feature) {
  const labels = new Set(feature.labels || [])
  const isApproved = feature.humanReviewStatus === 'approved' ||
    labels.has('strat-creator-human-sign-off')
  const hasRubric = (feature.rubricTotal || 0) > 0 ||
    labels.has('strat-creator-rubric-pass')
  const hasPM = !!feature.pmOwner
  const hasDeliveryOwner = !!feature.deliveryOwner
  const pastRefinement = !!feature.status && !EARLY_STATUSES.includes(feature.status)
  const hasTargetVersion = (feature.targetVersions || []).length > 0
  const noBlockingViolations = !hasBlockingViolations(feature.violations)

  const gates = {
    isApproved: { pass: isApproved, label: 'Strategy human sign-off' },
    hasRubric: { pass: hasRubric, label: 'Strategy rubric scored' },
    pmAssigned: { pass: hasPM, label: 'Product Manager assigned' },
    deliveryOwnerAssigned: { pass: hasDeliveryOwner, label: 'Delivery owner assigned' },
    pastRefinement: { pass: pastRefinement, label: 'Past refinement status' },
    hasTargetVersion: { pass: hasTargetVersion, label: 'Target version set' },
    noBlockingViolations: { pass: noBlockingViolations, label: 'No blocking hygiene issues' }
  }

  const isReady = Object.values(gates).every(g => g.pass)
  const failedGates = Object.entries(gates)
    .filter(([, g]) => !g.pass)
    .map(([key, g]) => ({ id: key, label: g.label }))

  return { isReady, gates, failedGates }
}

function hasBlockingViolations(violations) {
  if (!violations || !Array.isArray(violations) || violations.length === 0) return false
  return violations.some(v => BLOCKING_HYGIENE_RULES.includes(v.id))
}

/**
 * Derive simple hygiene violations from Jira fields when org-pulse cache is unavailable.
 */
export function deriveViolations(feature) {
  const violations = []
  if (!feature.assignee) {
    violations.push({ id: 'missing-assignee', label: 'Missing assignee' })
  }
  if (!feature.fixVersions || feature.fixVersions.length === 0) {
    violations.push({ id: 'missing-fix-version', label: 'Missing fix version' })
  }
  if (!feature.targetVersions || feature.targetVersions.length === 0) {
    violations.push({ id: 'missing-target-version', label: 'Missing target version' })
  }
  return violations
}

/**
 * Map Jira labels to human review status for strat-creator.
 */
export function deriveHumanReviewStatus(feature) {
  const labels = new Set(feature.labels || [])
  if (labels.has('strat-creator-human-sign-off')) return 'approved'
  if (labels.has('strat-creator-needs-attention')) return 'revise'
  if (labels.has('strat-creator-rubric-pass')) return 'awaiting-signoff'
  return feature.humanReviewStatus || null
}
