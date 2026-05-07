/**
 * Risk assessment engine for release health.
 *
 * Three execution-phase checks (suppressed pre-planning-deadline):
 *   1. MILESTONE_MISS -- feature behind expected phase progress
 *   2. VELOCITY_LAG -- completion % below threshold for current phase
 *   3. BLOCKED -- unresolved blocking dependencies
 */

const {
  RISK_CATEGORIES,
  CLOSED_STATUSES,
  EARLY_STATUSES,
  DEFAULT_PHASE_COMPLETION_EXPECTATIONS
} = require('../constants')

/**
 * Determine the current expected phase based on milestone dates.
 *
 * Walks through milestones in chronological order and returns the most
 * recent milestone that has passed. Returns null if no milestones have
 * passed (i.e., we are before EA1 freeze).
 *
 * @param {object} milestones - { ea1Freeze, ea1Target, ea2Freeze, ea2Target, gaFreeze, gaTarget }
 * @param {Date} today - Current date
 * @returns {string|null} The current milestone key (e.g., 'ea1_freeze', 'ea2_target') or null
 */
function determineExpectedPhase(milestones, today) {
  if (!milestones) return null

  var todayStr = today.toISOString().split('T')[0]

  // Walk milestones in reverse chronological order
  var orderedMilestones = [
    { key: 'ga_target', date: milestones.gaTarget },
    { key: 'ga_freeze', date: milestones.gaFreeze },
    { key: 'ea2_target', date: milestones.ea2Target },
    { key: 'ea2_freeze', date: milestones.ea2Freeze },
    { key: 'ea1_target', date: milestones.ea1Target },
    { key: 'ea1_freeze', date: milestones.ea1Freeze }
  ]

  for (var i = 0; i < orderedMilestones.length; i++) {
    var ms = orderedMilestones[i]
    if (ms.date && todayStr >= ms.date) {
      return ms.key
    }
  }

  return null
}

/**
 * Check if a feature is behind the expected phase progress.
 *
 * A feature is "behind" if it is still in an early workflow state (New,
 * Refinement) after the relevant code freeze has passed for its phase.
 *
 * @param {object} feature - Feature data (must have .status)
 * @param {string} currentMilestone - The current milestone key
 * @returns {boolean}
 */
function isFeatureBehindPhase(feature, currentMilestone) {
  if (!currentMilestone) return false

  var status = feature.status || ''

  // Features in early statuses after any freeze has passed are behind
  if (EARLY_STATUSES.indexOf(status) !== -1) {
    // Any freeze milestone has passed
    if (currentMilestone.indexOf('freeze') !== -1 || currentMilestone.indexOf('target') !== -1) {
      return true
    }
  }

  return false
}

/**
 * Get the expected completion percentage for a feature's phase at the
 * current milestone.
 *
 * @param {string} currentMilestone - The current milestone key (e.g., 'ea1_freeze')
 * @param {string} featurePhase - The feature's release phase (e.g., 'EA1', 'GA', 'TP', 'DP')
 * @param {object|null} customExpectations - Override expectations from config
 * @returns {number} Expected completion percentage (0-100)
 */
function expectedCompletionForPhase(currentMilestone, featurePhase, customExpectations) {
  if (!currentMilestone || !featurePhase) return 0

  var expectations = customExpectations || DEFAULT_PHASE_COMPLETION_EXPECTATIONS
  var milestoneExpectations = expectations[currentMilestone]
  if (!milestoneExpectations) return 0

  var phase = featurePhase.toUpperCase()
  if (milestoneExpectations[phase] !== undefined) {
    return milestoneExpectations[phase]
  }

  // Default: if phase not found, use GA expectations as a fallback
  return milestoneExpectations['GA'] || 0
}

/**
 * Compute risk assessment for a single feature.
 *
 * @param {object} feature - Feature data with status, completionPct, etc.
 * @param {object|null} milestones - Product Pages milestone dates
 * @param {object|null} enrichment - Jira enrichment data
 * @param {object} opts - Options: { riskThresholds, phaseCompletionExpectations, today, planningDeadline, planningStatus }
 * @returns {{ risk: string, flags: Array<object>, riskScore: number }}
 */
function computeFeatureRisk(feature, milestones, enrichment, opts) {
  var options = opts || {}
  var thresholds = options.riskThresholds || {}
  var today = options.today || new Date()
  var customExpectations = options.phaseCompletionExpectations || null
  var planningDeadline = options.planningDeadline || null
  var flags = []

  var suppressExecution = planningDeadline && planningDeadline.daysRemaining > 0

  var currentMilestone = determineExpectedPhase(milestones, today)

  // 1. Milestone Risk (suppressed pre-planning-deadline)
  if (!suppressExecution && isFeatureBehindPhase(feature, currentMilestone)) {
    var milestoneName = currentMilestone
      ? currentMilestone.replace(/_/g, ' ').toUpperCase()
      : 'unknown'
    flags.push({
      category: RISK_CATEGORIES.MILESTONE_MISS,
      severity: 'high',
      message: 'Feature still in "' + (feature.status || 'unknown') + '" but ' + milestoneName + ' has passed'
    })
  }

  // 2. Velocity Risk (suppressed pre-planning-deadline)
  var featurePhase = feature.phase || feature.releaseType || ''
  var completionPct = typeof feature.completionPct === 'number' ? feature.completionPct : 0
  if (!suppressExecution && currentMilestone && featurePhase) {
    var expected = expectedCompletionForPhase(currentMilestone, featurePhase, customExpectations)
    if (expected > 0 && completionPct < expected) {
      var severity = completionPct < (thresholds.velocityYellowMin || 50) ? 'high' : 'medium'
      flags.push({
        category: RISK_CATEGORIES.VELOCITY_LAG,
        severity: severity,
        message: completionPct + '% complete, expected ' + expected + '% by now'
      })
    }
  }

  // 3. Dependency Risk
  var safeEnrichment = enrichment || {}
  var dependencyLinks = safeEnrichment.dependencyLinks || []
  var blocking = dependencyLinks.filter(function(d) {
    return d.direction === 'inward' &&
      d.type === 'Blocks' &&
      CLOSED_STATUSES.indexOf(d.linkedStatus) === -1
  })
  if (blocking.length > 0) {
    var blockerKeys = blocking.map(function(b) { return b.linkedKey }).join(', ')
    flags.push({
      category: RISK_CATEGORIES.BLOCKED,
      severity: 'high',
      message: 'Blocked by ' + blocking.length + ' unresolved issue(s): ' + blockerKeys
    })
  }

  // Composite risk level: high → red, medium → yellow, low alone → green
  var risk = 'green'
  if (flags.some(function(f) { return f.severity === 'high' })) {
    risk = 'red'
  } else if (flags.some(function(f) { return f.severity === 'medium' })) {
    risk = 'yellow'
  }

  if (options.planningStatus === 'not-ready' && risk === 'green') {
    risk = 'yellow'
  }

  return { risk: risk, flags: flags, riskScore: flags.length }
}

module.exports = {
  computeFeatureRisk: computeFeatureRisk,
  determineExpectedPhase: determineExpectedPhase,
  isFeatureBehindPhase: isFeatureBehindPhase,
  expectedCompletionForPhase: expectedCompletionForPhase
}
