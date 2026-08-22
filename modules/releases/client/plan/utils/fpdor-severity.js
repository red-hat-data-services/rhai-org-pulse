/**
 * Fail-severity overlay for Confluence FPDoR items (display/triage only).
 * Ready remains: all applicable items pass. Severity does not redefine Ready.
 *
 * Mapped from Erle's ranked list (2026-08-07), remapped to Confluence item names.
 */

var SEVERITY_RANK = {
  soft: 1,
  medium: 2,
  high: 3,
  critical: 4
}

var FPDOR_SEVERITY_BY_NAME = {
  // Critical
  Components: 'critical',
  'Child epics': 'critical',
  'Target Version': 'critical',
  'Delivery Owner': 'critical',
  // High
  'Release Type': 'high',
  Priority: 'high',
  'RICE': 'high',
  'Docs impact': 'high',
  // Medium
  'Cross-team deps': 'medium',
  PM: 'medium',
  'Feature human sign-off': 'medium',
  'Requirements clarity': 'medium',
  'Acceptance criteria': 'medium',
  'Risks & assumptions': 'medium',
  'Architectural alignment': 'medium',
  // Soft
  UXD: 'soft',
  'Source RFE / AI SDLC': 'soft'
}

function fpdorItemSeverity(name) {
  return FPDOR_SEVERITY_BY_NAME[name] || 'medium'
}

function worstFailedSeverity(fpdorOrFeature) {
  var fpdor = fpdorOrFeature && fpdorOrFeature.fpdor ? fpdorOrFeature.fpdor : fpdorOrFeature
  var items = fpdor && fpdor.items ? fpdor.items : []
  var worst = null
  var worstRank = 0
  for (var i = 0; i < items.length; i++) {
    if (items[i].pass !== false) continue
    var sev = fpdorItemSeverity(items[i].name)
    var rank = SEVERITY_RANK[sev] || 0
    if (rank > worstRank) {
      worstRank = rank
      worst = sev
    }
  }
  return worst
}

function severityBadgeClass(severity) {
  switch (severity) {
    case 'critical':
      return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
    case 'high':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200'
    case 'medium':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
    case 'soft':
      return 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
    case null:
    case undefined:
      return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  }
}

function severityChipClass(severity) {
  switch (severity) {
    case 'critical':
      return 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
    case 'high':
      return 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
    case 'medium':
      return 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
    case 'soft':
      return 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800'
    default:
      return 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
  }
}

function severityLabel(severity) {
  switch (severity) {
    case 'critical': return 'Critical'
    case 'high': return 'High'
    case 'medium': return 'Medium'
    case 'soft': return 'Soft'
    case null:
    case undefined:
      return 'Ready'
    default:
      return '—'
  }
}

/** Org Pulse path: AI First = any strat-creator-* label (not rp-qg1-pass / epic-creator). */
function isAiFirstFeature(feature) {
  if (!feature) return false
  if (feature.isAiFirst === true) return true
  if (feature.isAiFirst === false) return false
  var labels = feature.labels || []
  for (var i = 0; i < labels.length; i++) {
    if (String(labels[i]).indexOf('strat-creator-') === 0) return true
  }
  return false
}

function pathLabel(feature) {
  return isAiFirstFeature(feature) ? 'AI First' : 'Legacy'
}

function pathChipClass(feature) {
  if (isAiFirstFeature(feature)) {
    return 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800'
  }
  return 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
}

function pathChipTitle(feature) {
  if (isAiFirstFeature(feature)) {
    return 'AI First — has strat-creator-* label'
  }
  return 'Legacy — no strat-creator-* label'
}

export {
  SEVERITY_RANK,
  FPDOR_SEVERITY_BY_NAME,
  fpdorItemSeverity,
  worstFailedSeverity,
  severityBadgeClass,
  severityChipClass,
  severityLabel,
  isAiFirstFeature,
  pathLabel,
  pathChipClass,
  pathChipTitle
}
