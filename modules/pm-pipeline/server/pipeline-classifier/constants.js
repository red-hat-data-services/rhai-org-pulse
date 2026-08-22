/** Jira custom field IDs (redhat.atlassian.net) */
export const CUSTOM_FIELDS = {
  team: 'customfield_10001',
  targetVersion: 'customfield_10855',
  productManager: 'customfield_10469',
  reach: 'customfield_10862',
  impact: 'customfield_10836',
  confidence: 'customfield_10838',
  effort: 'customfield_10637',
  riceScore: 'customfield_10864'
}

export const EARLY_STATUSES = ['New', 'Refinement']

export const BLOCKING_HYGIENE_RULES = [
  'missing-assignee',
  'missing-fix-version',
  'missing-target-version'
]

export const RELEASE_FIX_VERSIONS = {
  '3.5': [
    '3.5 GA RHOAI RELEASE',
    '3.5 GA RHAII RELEASE',
    '3.5 GA RHELAI RELEASE'
  ],
  '3.6': [
    '3.6 GA RHOAI RELEASE',
    '3.6 GA RHAII RELEASE',
    '3.6 GA RHELAI RELEASE'
  ]
}

export const SCOPE_LABELS = {
  '3.5': 'strat-creator-3.5',
  '3.6': 'strat-creator-3.6'
}

export const STAGE_IDS = {
  RFE_NEEDS_REVISION: 'rfe-needs-revision',
  RFE_FEASIBILITY: 'rfe-feasibility',
  RFE_READY_NO_SCOPE: 'rfe-ready-no-scope',
  RFE_WAITING_STRAT: 'rfe-waiting-strat',
  STRAT_NEEDS_ATTENTION: 'strat-needs-attention',
  STRAT_AWAITING_SIGNOFF: 'strat-awaiting-signoff',
  PLANNING_READY_BLOCKED: 'planning-ready-blocked',
  PLANNING_READY: 'planning-ready',
  RELEASE_GATE_FAILED: 'release-gate-failed',
  RELEASE_GATE_PENDING: 'release-gate-pending',
  RELEASE_GATE_PASSED: 'release-gate-passed',
  EPICS_PENDING: 'epics-pending',
  EPICS_DECOMP_FAILED: 'epics-decomp-failed',
  EPICS_COMPLETE: 'epics-complete',
  COMPLETE: 'complete'
}

export const PRIORITY_ORDER = {
  Blocker: 0,
  Critical: 1,
  High: 2,
  Major: 3,
  Medium: 4,
  Normal: 5,
  Minor: 6,
  Low: 7,
  None: 8,
  Undefined: 9
}
