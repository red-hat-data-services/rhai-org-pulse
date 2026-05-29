/**
 * Hygiene Rules Engine
 *
 * Evaluates features/issues against project management hygiene policies.
 * Pure detection and reporting — no enforcement, no side effects.
 *
 * Ported from jira-tracker hygieneRules.js with configurable thresholds
 * and grandfathered release lists instead of hardcoded version parsing.
 */

// ---------------------------------------------------------------------------
// Status helpers (local, not exported)
// ---------------------------------------------------------------------------

const REFINEMENT_STATUSES = ['Refinement']
const IN_PROGRESS_STATUSES = ['In Progress', 'Review', 'Testing']
const TERMINAL_STATUSES = ['Release Pending', 'Closed', 'Resolved']

function isInRefinement(issue) {
  return REFINEMENT_STATUSES.includes(issue.status)
}

function isInProgress(issue) {
  return IN_PROGRESS_STATUSES.includes(issue.status)
}

function getDaysSince(dateString) {
  if (!dateString) return 0
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

function getDaysInStatus(issue) {
  return getDaysSince(issue.statusEnteredAt)
}

function getDaysSinceStatusSummaryUpdate(issue) {
  if (!issue.statusSummaryUpdated) return null
  return getDaysSince(issue.statusSummaryUpdated)
}

// ---------------------------------------------------------------------------
// Rule categories
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} */
const RULE_CATEGORIES = {
  ownership: 'Ownership',
  timeliness: 'Timeliness',
  metadata: 'Metadata',
  lifecycle: 'Lifecycle'
}

// ---------------------------------------------------------------------------
// Rule definitions
// ---------------------------------------------------------------------------

/** @type {Array<{id: string, name: string, description: string, remediation: string, category: string, defaultEnabled: boolean, defaultThreshold?: number, check: function, message: function}>} */
const hygieneRules = [
  {
    id: 'missing-assignee',
    name: 'Missing Assignee',
    description: 'Every issue in active work (Refinement or In Progress) needs an owner. Assign someone to ensure accountability and clear communication.',
    remediation: 'Open the issue in Jira and set the Assignee field to the person responsible for this work.',
    category: 'ownership',
    defaultEnabled: true,
    check: (issue) => {
      return (isInRefinement(issue) || isInProgress(issue)) && !issue.assignee
    },
    message: (issue) => {
      return `This issue is in ${issue.status} but has no assignee. Assign someone to take ownership.`
    }
  },
  {
    id: 'missing-team',
    name: 'Missing Team',
    description: 'Issues in active work must have a team assigned for tracking ownership and workload distribution across the organization.',
    remediation: 'Open the issue in Jira and set the Team field to your team name.',
    category: 'ownership',
    defaultEnabled: true,
    check: (issue) => {
      return (isInRefinement(issue) || isInProgress(issue)) && !issue.team
    },
    message: (issue) => {
      return `This issue is in ${issue.status} but has no team assigned. Set the team field to track ownership.`
    }
  },
  {
    id: 'stale-status-summary',
    name: 'Stale or Missing Status Summary',
    description: 'Status summaries keep stakeholders informed. Update the summary at least weekly.',
    remediation: 'Open the issue in Jira and update the Status Summary field with current progress information.',
    category: 'timeliness',
    defaultEnabled: true,
    defaultThreshold: 7,
    check: (issue, ruleConfig) => {
      const threshold = ruleConfig.threshold || 7
      if (!isInRefinement(issue) && !isInProgress(issue)) {
        return false
      }
      if (issue.statusSummary) {
        const daysSinceUpdate = getDaysSinceStatusSummaryUpdate(issue)
        return daysSinceUpdate !== null && daysSinceUpdate > threshold
      } else {
        return getDaysInStatus(issue) > threshold
      }
    },
    message: (issue) => {
      if (issue.statusSummary) {
        const daysSinceUpdate = getDaysSinceStatusSummaryUpdate(issue)
        return `Status summary hasn't been updated in ${daysSinceUpdate} days. Please provide a recent update on progress.`
      } else {
        const daysInStatus = getDaysInStatus(issue)
        return `This issue has been in ${issue.status} for ${daysInStatus} days without a status summary. Add a summary to communicate progress.`
      }
    }
  },
  {
    id: 'missing-color-status',
    name: 'Missing Color Status',
    description: 'Issues In Progress need a health indicator (Green/Yellow/Red) so leadership can quickly identify items needing attention.',
    remediation: 'Open the issue in Jira and set the Color Status field to Green, Yellow, or Red based on current health.',
    category: 'metadata',
    defaultEnabled: true,
    check: (issue) => {
      return isInProgress(issue) && !issue.colorStatus
    },
    message: (issue) => {
      return `This issue is in ${issue.status} but has no color status set. Set the color status to indicate health (Red/Yellow/Green).`
    }
  },
  {
    id: 'missing-release-type',
    name: 'Missing Release Type',
    description: 'Features In Progress must specify their release type (GA, Tech Preview, Dev Preview) for accurate release planning and documentation.',
    remediation: 'Open the issue in Jira and set the Release Type field to GA, Tech Preview, or Dev Preview.',
    category: 'metadata',
    defaultEnabled: true,
    check: (issue) => {
      return isInProgress(issue) && issue.issueType === 'Feature' && !issue.releaseType
    },
    message: (issue) => {
      return `This feature is in ${issue.status} but has no release type set. Set the release type (GA, Tech Preview, etc.) for planning.`
    }
  },
  {
    id: 'missing-rfe-link',
    name: 'Missing RFE Link',
    description: 'Features should be cloned from an approved RFE to ensure proper product management review and customer traceability. The feature must use a "clones" link type to the RFE; other link types will still trigger this warning.',
    remediation: 'Ensure your feature is cloned from an RFE that is in Approved status. Use the "clones" link type when linking to the RFE.',
    category: 'lifecycle',
    defaultEnabled: true,
    check: (issue) => {
      if (issue.issueType !== 'Feature') return false
      if (!isInRefinement(issue) && !isInProgress(issue)) return false
      return !issue.linkedRfeApproved
    },
    message: (issue) => {
      if (!issue.linkedRfeKey) {
        return 'This feature is not linked to an RFE. Features should be cloned from an approved RFE.'
      }
      return `This feature is linked to RFE ${issue.linkedRfeKey} which is not in Approved status.`
    }
  },
  {
    id: 'missing-fix-version',
    name: 'Missing Fix Version',
    description: 'Features and Initiatives In Progress must have a Fix Version set. Fix Version is the single source of truth for delivery commitment.',
    remediation: 'Open the issue in Jira and set the Fix Version field to the release you are committed to delivering in.',
    category: 'lifecycle',
    defaultEnabled: true,
    check: (issue) => {
      if (issue.issueType !== 'Feature' && issue.issueType !== 'Initiative') return false
      if (!isInProgress(issue)) return false
      return !issue.fixVersions || issue.fixVersions.length === 0
    },
    message: (issue) => {
      return `This ${issue.issueType.toLowerCase()} is in ${issue.status} but has no fix version set. Set the fix version to indicate delivery commitment.`
    }
  },
  {
    id: 'missing-docs-required',
    name: 'Missing Docs Required',
    description: 'Features In Progress need to specify whether product documentation is required so docs team can plan accordingly.',
    remediation: 'Open the issue in Jira and set the "Product Documentation Required" field to Yes or No.',
    category: 'metadata',
    defaultEnabled: true,
    check: (issue) => {
      if (issue.issueType !== 'Feature') return false
      if (!isInProgress(issue)) return false
      return !issue.docsRequired || issue.docsRequired === 'None'
    },
    message: (issue) => {
      return `This feature is in ${issue.status} but has no "Product Documentation Required" value set. Set this field to Yes or No.`
    }
  },
  {
    id: 'missing-target-end',
    name: 'Missing Target End',
    description: 'Features in Refinement or In Progress must have a Target End date set for planning and tracking purposes.',
    remediation: 'Open the issue in Jira and set the Target End date field.',
    category: 'metadata',
    defaultEnabled: true,
    check: (issue) => {
      if (issue.issueType !== 'Feature') return false
      if (!isInRefinement(issue) && !isInProgress(issue)) return false
      return !issue.targetEnd
    },
    message: (issue) => {
      return `This feature is in ${issue.status} but has no Target End date. Set the target end date for planning.`
    }
  },
  {
    id: 'missing-rice-score',
    name: 'Missing RICE Score',
    description: 'Features in Refinement must have RICE score set. Features In Progress for non-grandfathered releases also require RICE score.',
    remediation: 'Open the issue in Jira and complete the RICE scoring by setting Reach, Impact, Confidence, and Effort values.',
    category: 'metadata',
    defaultEnabled: true,
    check: (issue, ruleConfig) => {
      if (issue.issueType !== 'Feature') return false

      const hasRiceScore = issue.riceStatus === 'complete'
      if (hasRiceScore) return false

      if (isInRefinement(issue)) return true

      if (isInProgress(issue)) {
        const grandfathered = ruleConfig.grandfatheredReleases || []
        if (grandfathered.length > 0 && issue.fixVersions && issue.fixVersions.length > 0) {
          const hasGrandfathered = issue.fixVersions.some(function (v) {
            return grandfathered.includes(v)
          })
          if (hasGrandfathered) return false
        }
        return true
      }

      return false
    },
    message: (issue) => {
      if (isInRefinement(issue)) {
        return 'This feature is in Refinement but has no RICE score. Set Reach, Impact, Confidence, and Effort values.'
      }
      return `This feature is in ${issue.status} and requires a RICE score. Set Reach, Impact, Confidence, and Effort values.`
    }
  },
  {
    id: 'open-children-on-closed',
    name: 'Open Children on Closed Feature',
    description: 'Features in Release Pending or Closed should not have open child issues. Open children indicate incomplete work.',
    remediation: 'Review open child issues and either close them or move them to a future release.',
    category: 'lifecycle',
    defaultEnabled: true,
    check: (issue) => {
      if (!TERMINAL_STATUSES.includes(issue.status)) return false
      return (issue.openChildCount || 0) > 0
    },
    message: (issue) => {
      const count = issue.openChildCount || 0
      return `This feature is ${issue.status} but has ${count} open child issue${count !== 1 ? 's' : ''}. Open children should be resolved or moved to a future release.`
    }
  },
  {
    id: 'open-in-released-version',
    name: 'Open Issue in Released Version',
    description: 'Features should not remain open after their target version has reached GA. Open issues in released versions indicate missed work.',
    remediation: 'Either close the feature, move it to a future version, or update its status to reflect completion.',
    category: 'lifecycle',
    defaultEnabled: true,
    check: (issue) => {
      if (!issue.versionReleased) return false
      return !TERMINAL_STATUSES.includes(issue.status)
    },
    message: (issue) => {
      const gaDate = issue.versionGaDate ? ' (GA: ' + issue.versionGaDate + ')' : ''
      return `This feature is still ${issue.status} but its target version has already been released${gaDate}. It should be closed or moved to a future version.`
    }
  },
  {
    id: 'missing-target-version',
    name: 'Missing Target Version',
    description: 'Issues with a fix version but no Target Version set. Target Version tracks when work was initially planned and helps trace the delivery trail.',
    remediation: 'Open the issue in Jira and set the Target Version field to the release version this work was originally planned for.',
    category: 'metadata',
    defaultEnabled: true,
    check: (issue) => {
      return issue.missingTargetVersion === true
    },
    message: () => {
      return 'This issue has a fix version but no Target Version set. Set the Target Version to track when this work was initially requested.'
    }
  },
  {
    id: 'missing-affected-version',
    name: 'Missing Affected Version',
    description: 'Post-release bugs must have an Affected Version set to track which release the bug was found in.',
    remediation: 'Open the bug in Jira and set the Affects Version/s field to the release version where the bug was discovered.',
    category: 'metadata',
    defaultEnabled: true,
    check: (issue) => {
      if (issue.issueType !== 'Bug') return false
      if (!issue.versionReleased) return false
      var affected = issue.affectedVersions || []
      return affected.length === 0
    },
    message: () => {
      return 'This post-release bug has no Affected Version set. Set the Affects Version/s field to indicate which release the bug was found in.'
    }
  }
]

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a feature/issue against all enabled hygiene rules.
 * @param {object} feature - The issue object with Jira fields
 * @param {Record<string, {enabled?: boolean, threshold?: number, grandfatheredReleases?: string[]}>} rulesConfig - Per-rule config keyed by rule ID
 * @returns {Array<{id: string, name: string, category: string, message: string}>} Array of violations
 */
function evaluateHygiene(feature, rulesConfig) {
  const config = rulesConfig || {}
  const violations = []

  for (let i = 0; i < hygieneRules.length; i++) {
    const rule = hygieneRules[i]
    const ruleConf = config[rule.id] || {}

    if (ruleConf.enabled === false) continue

    if (rule.check(feature, ruleConf)) {
      violations.push({
        id: rule.id,
        name: rule.name,
        category: rule.category,
        message: rule.message(feature)
      })
    }
  }

  return violations
}

/**
 * Get default configuration for all rules based on their defaultEnabled and defaultThreshold values.
 * @returns {Record<string, {enabled: boolean, threshold?: number, grandfatheredReleases?: string[]}>}
 */
function getRuleDefaults() {
  const defaults = {}

  for (let i = 0; i < hygieneRules.length; i++) {
    const rule = hygieneRules[i]
    const entry = { enabled: rule.defaultEnabled }

    if (rule.defaultThreshold !== undefined) {
      entry.threshold = rule.defaultThreshold
    }

    if (rule.id === 'missing-rice-score') {
      entry.grandfatheredReleases = []
    }

    defaults[rule.id] = entry
  }

  return defaults
}

module.exports = {
  hygieneRules,
  evaluateHygiene,
  getRuleDefaults,
  RULE_CATEGORIES
}
