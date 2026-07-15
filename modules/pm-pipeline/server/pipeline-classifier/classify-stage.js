import { STAGE_IDS } from './constants.js'
import { classifyRfe } from './classify-rfe.js'
import { computeReadiness, deriveHumanReviewStatus } from './compute-readiness.js'

/**
 * Full pipeline stage classification (guide decision tree).
 * @param {object} item - normalized RFE or feature
 * @param {string} [release='3.5']
 */
export function classifyPipelineStage(item, release = '3.5') {
  if (item.type === 'rfe') {
    return classifyRfeStage(item, release)
  }
  return classifyFeatureStage(item)
}

function classifyRfeStage(rfe, release) {
  const rfeState = classifyRfe(rfe, release)
  if (!rfeState) {
    return stageResult(STAGE_IDS.COMPLETE, 'RFE linked to feature', 1, false, null)
  }

  switch (rfeState.id) {
    case 'needs-revision':
      return stageResult(STAGE_IDS.RFE_NEEDS_REVISION, rfeState.label, 1, true, 1)
    case 'feasibility-fail':
      return stageResult(STAGE_IDS.RFE_FEASIBILITY, rfeState.label, 1, false, 2)
    case 'passed-with-caveats':
      return stageResult(STAGE_IDS.RFE_NEEDS_REVISION, rfeState.label, 1, true, 1)
    case 'ready-to-advance':
      return stageResult(STAGE_IDS.RFE_READY_NO_SCOPE, rfeState.label, 1, true, 3)
    case 'queued-for-pipeline':
      return stageResult(STAGE_IDS.RFE_WAITING_STRAT, rfeState.label, 1, false, 4)
    default:
      return stageResult(STAGE_IDS.RFE_NEEDS_REVISION, rfeState.label, 1, true, 1)
  }
}

function classifyFeatureStage(feature) {
  const labels = new Set(feature.labels || [])
  const reviewStatus = deriveHumanReviewStatus(feature)
  const readiness = computeReadiness({ ...feature, humanReviewStatus: reviewStatus })

  if (labels.has('epic-creator-auto-decomposed')) {
    return stageResult(STAGE_IDS.EPICS_COMPLETE, 'Epics decomposed', 4, false, 12)
  }

  if (labels.has('rp-qg1-pass')) {
    if (feature.epicChildCount > 0) {
      return stageResult(STAGE_IDS.EPICS_COMPLETE, 'Epics created', 4, false, 11)
    }
    return stageResult(STAGE_IDS.EPICS_PENDING, 'Awaiting epic decomposition', 4, false, 11)
  }

  if (labels.has('rp-qg1-fail')) {
    return stageResult(STAGE_IDS.RELEASE_GATE_FAILED, 'Failed release quality gate', 3, true, 9)
  }

  if (readiness.isReady) {
    return stageResult(STAGE_IDS.RELEASE_GATE_PENDING, 'Planning-ready — awaiting release gate', 3, true, 8)
  }

  if (reviewStatus === 'approved' || labels.has('strat-creator-human-sign-off')) {
    return stageResult(
      STAGE_IDS.PLANNING_READY_BLOCKED,
      'Fix metadata before planning',
      2,
      true,
      7,
      readiness.failedGates
    )
  }

  if (labels.has('strat-creator-needs-attention') || reviewStatus === 'revise') {
    return stageResult(STAGE_IDS.STRAT_NEEDS_ATTENTION, 'Strategy needs fixes', 2, false, 5)
  }

  if (labels.has('strat-creator-rubric-pass') || reviewStatus === 'awaiting-signoff') {
    return stageResult(STAGE_IDS.STRAT_AWAITING_SIGNOFF, 'Awaiting strategy sign-off', 2, true, 6)
  }

  return stageResult(STAGE_IDS.STRAT_NEEDS_ATTENTION, 'Strategy in progress', 2, false, 5)
}

function stageResult(id, label, phase, pmActionable, playbookSection, failedGates = []) {
  return {
    id,
    label,
    phase,
    pmActionable,
    playbookSection,
    failedGates
  }
}

/**
 * Build horizontal timeline for UI.
 */
export function buildTimeline(item, stage, _release = '3.5') {
  const phases = [
    { id: 'rfe', label: 'RFE Quality', phase: 1 },
    { id: 'strat', label: 'Strategy', phase: 2 },
    { id: 'ready', label: 'Planning Ready', phase: 2 },
    { id: 'release', label: 'Release Gate', phase: 3 },
    { id: 'epics', label: 'Epics', phase: 4 }
  ]

  const stageOrder = [
    STAGE_IDS.RFE_NEEDS_REVISION,
    STAGE_IDS.RFE_FEASIBILITY,
    STAGE_IDS.RFE_READY_NO_SCOPE,
    STAGE_IDS.RFE_WAITING_STRAT,
    STAGE_IDS.STRAT_NEEDS_ATTENTION,
    STAGE_IDS.STRAT_AWAITING_SIGNOFF,
    STAGE_IDS.PLANNING_READY_BLOCKED,
    STAGE_IDS.PLANNING_READY,
    STAGE_IDS.RELEASE_GATE_PENDING,
    STAGE_IDS.RELEASE_GATE_FAILED,
    STAGE_IDS.RELEASE_GATE_PASSED,
    STAGE_IDS.EPICS_PENDING,
    STAGE_IDS.EPICS_DECOMP_FAILED,
    STAGE_IDS.EPICS_COMPLETE,
    STAGE_IDS.COMPLETE
  ]

  const currentIdx = stageOrder.indexOf(stage.id)
  const isRfeOnly = item.type === 'rfe'

  return phases.map((p, idx) => {
    if (isRfeOnly && idx > 0 && !item.linkedFeature) {
      return { ...p, status: 'pending', detail: 'No STRAT yet' }
    }
    const phaseStart = idx === 0 ? 0 : idx === 1 ? 4 : idx === 2 ? 6 : idx === 3 ? 8 : 11
    const phaseEnd = idx === 0 ? 3 : idx === 1 ? 5 : idx === 2 ? 7 : idx === 3 ? 10 : 14

    if (currentIdx >= phaseEnd) {
      return { ...p, status: 'complete', detail: 'Done' }
    }
    if (currentIdx >= phaseStart && currentIdx <= phaseEnd) {
      return { ...p, status: 'current', detail: stage.label }
    }
    return { ...p, status: 'pending', detail: 'Not started' }
  })
}
