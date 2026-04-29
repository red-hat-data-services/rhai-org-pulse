/**
 * Risk assessment engine for release health.
 *
 * Hybrid model combining execution and planning risk checks:
 *
 * Execution-phase (suppressed pre-planning-deadline):
 *   1. MILESTONE_MISS -- feature behind expected phase progress
 *   2. VELOCITY_LAG -- completion % below threshold for current phase
 *
 * Always active:
 *   3. DOR_INCOMPLETE -- DoR criteria below threshold
 *   4. BLOCKED -- unresolved blocking dependencies
 *   5. UNESTIMATED -- no story point estimate
 *
 * Planning-phase:
 *   6. MISSING_OWNER -- no delivery owner assigned
 *   7. NO_BIG_ROCK -- not associated with any Big Rock (tier 3)
 *   8. LATE_COMMITMENT -- past planning deadline with no committed fix version
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
 * @param {object} dorStatus - DoR evaluation result from evaluateDor()
 * @param {object|null} enrichment - Jira enrichment data
 * @param {object} opts - Options: { riskThresholds, phaseCompletionExpectations, today, planningDeadline, phase, version }
 * @returns {{ risk: string, flags: Array<object>, riskScore: number }}
 */
function computeFeatureRisk(feature, milestones, dorStatus, enrichment, opts) {
  var options = opts || {}
  var thresholds = options.riskThresholds || {}
  var today = options.today || new Date()
  var customExpectations = options.phaseCompletionExpectations || null
  var planningDeadline = options.planningDeadline || null
  var version = options.version || ''
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

  // 3. DoR Readiness
  if (dorStatus && dorStatus.totalCount > 0) {
    var dorPct = dorStatus.completionPct
    var dorGreenMin = thresholds.dorGreenMin || 80
    var dorYellowMin = thresholds.dorYellowMin || 50

    if (dorPct < dorYellowMin) {
      flags.push({
        category: RISK_CATEGORIES.DOR_INCOMPLETE,
        severity: 'high',
        message: 'Only ' + dorPct + '% of DoR criteria met'
      })
    } else if (dorPct < dorGreenMin) {
      flags.push({
        category: RISK_CATEGORIES.DOR_INCOMPLETE,
        severity: 'medium',
        message: dorPct + '% of DoR criteria met (target: ' + dorGreenMin + '%)'
      })
    }
  }

  // 4. Dependency Risk
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

  // 5. Scope Risk
  if (!safeEnrichment.storyPoints) {
    flags.push({
      category: RISK_CATEGORIES.UNESTIMATED,
      severity: 'medium',
      message: 'No story point estimate'
    })
  }

  // 6. Missing Owner (planning)
  if (!feature.deliveryOwner && !feature.assignee) {
    flags.push({
      category: RISK_CATEGORIES.MISSING_OWNER,
      severity: 'medium',
      message: 'No delivery owner assigned'
    })
  }

  // 7. No Big Rock (planning)
  if (feature.tier === 3) {
    flags.push({
      category: RISK_CATEGORIES.NO_BIG_ROCK,
      severity: 'low',
      message: 'Not associated with any Big Rock'
    })
  }

  // 8. Late Commitment (planning, post-deadline only)
  if (planningDeadline && planningDeadline.daysRemaining < 0 && version) {
    var fixVersions = feature.fixVersions || []
    var hasCommittedVersion = false
    for (var fvi = 0; fvi < fixVersions.length; fvi++) {
      if (fixVersions[fvi].indexOf(version) !== -1) {
        hasCommittedVersion = true
        break
      }
    }
    if (!hasCommittedVersion) {
      flags.push({
        category: RISK_CATEGORIES.LATE_COMMITMENT,
        severity: 'high',
        message: 'No committed fix version ' + Math.abs(planningDeadline.daysRemaining) + ' days after planning deadline'
      })
    }
  }

  // Composite risk level: high → red, medium → yellow, low alone → green
  var risk = 'green'
  if (flags.some(function(f) { return f.severity === 'high' })) {
    risk = 'red'
  } else if (flags.some(function(f) { return f.severity === 'medium' })) {
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
