import { SCOPE_LABELS } from './constants.js'

const RFE_STATES = {
  NOT_ASSESSED: { id: 'not-assessed', label: 'Not Yet Assessed', color: 'gray', order: 4 },
  NEEDS_REVISION: { id: 'needs-revision', label: 'Needs Revision', color: 'red', order: 0 },
  PASSED_WITH_CAVEATS: { id: 'passed-with-caveats', label: 'Passed with Caveats', color: 'amber', order: 1 },
  READY_TO_ADVANCE: { id: 'ready-to-advance', label: 'Ready for Feature Creation', color: 'amber', order: 2 },
  QUEUED_FOR_PIPELINE: { id: 'queued-for-pipeline', label: 'Queued for Feature Creation', color: 'blue', order: 3 },
  FEASIBILITY_FAIL: { id: 'feasibility-fail', label: 'Feasibility Failed', color: 'red', order: 0 }
}

/**
 * Classify an RFE by Jira labels (ported from org-pulse useForYou.js).
 * @param {object} rfe - { labels, linkedFeature, release }
 * @param {string} [release='3.5']
 */
export function classifyRfe(rfe, release = '3.5') {
  const labels = new Set(rfe.labels || [])
  const scopeLabel = SCOPE_LABELS[release] || SCOPE_LABELS['3.5']
  const hasLinkedFeature = !!rfe.linkedFeature
  const hasRubricPass = labels.has('rfe-creator-autofix-rubric-pass')
  const hasNeedsAttention = labels.has('rfe-creator-needs-attention')
  const hasTechReviewed = labels.has('tech-reviewed')
  const hasScopeLabel = labels.has(scopeLabel) ||
    labels.has('strat-creator-3.5') ||
    labels.has('strat-creator-3.6')
  const hasFeasibilityFail = labels.has('rfe-creator-feasibility-fail') ||
    labels.has('rfe-creator-feasibility-unknown')

  if (hasLinkedFeature) return null
  if (hasFeasibilityFail) return RFE_STATES.FEASIBILITY_FAIL
  if (hasNeedsAttention && !hasRubricPass) return RFE_STATES.NEEDS_REVISION
  if (hasRubricPass && hasNeedsAttention) return RFE_STATES.PASSED_WITH_CAVEATS
  if ((hasRubricPass || hasTechReviewed) && !hasScopeLabel) return RFE_STATES.READY_TO_ADVANCE
  if ((hasRubricPass || hasTechReviewed) && hasScopeLabel) return RFE_STATES.QUEUED_FOR_PIPELINE
  return RFE_STATES.NOT_ASSESSED
}

export { RFE_STATES }
