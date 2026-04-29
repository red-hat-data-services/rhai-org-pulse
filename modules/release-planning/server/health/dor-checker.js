/**
 * Definition of Ready (DoR) checker.
 *
 * Defines all 13 DoR criteria and evaluates them per-feature,
 * combining automated checks (from feature-traffic data + Jira enrichment)
 * with manual toggles (persisted in dor-state-{version}.json).
 *
 * IMPORTANT: Automated checks operate on RAW data from loadIndex() and
 * loadFeatureDetail(), NOT on mapToCandidate() output. mapToCandidate()
 * stringifies labels and components via .join(', '), which breaks array
 * methods like .includes() and .length checks.
 */

const { CLOSED_STATUSES } = require('../constants')

/**
 * DoR checklist items.
 *
 * Each item has:
 *   - id: unique identifier (F-1 through F-13)
 *   - label: human-readable description
 *   - type: 'automated' (evaluated from data) or 'manual' (toggled by PM)
 *   - source: where the data comes from ('index', 'detail', 'jira', 'manual')
 *   - check: function(feature, enrichment) => boolean (automated items only)
 *
 * Feature objects are RAW data from loadIndex()/loadFeatureDetail():
 *   - feature.summary (string)
 *   - feature.targetVersions (array)
 *   - feature.assignee (string or object)
 *   - feature.pm (object with displayName, from detail files)
 *   - feature.components (array, from detail files)
 *   - feature.releaseType (string, from detail files)
 *   - feature.labels (array, from detail files)
 *
 * Enrichment objects come from jira-enrichment.js:
 *   - enrichment.hasDescription (boolean)
 *   - enrichment.storyPoints (number or null)
 *   - enrichment.dependencyLinks (array)
 */
const DOR_ITEMS = [
  // Automated checks
  {
    id: 'F-1',
    label: 'Clear title and description',
    type: 'automated',
    source: 'jira',
    check: function(feature, enrichment) {
      return !!feature.summary && !!(enrichment && enrichment.hasDescription)
    }
  },
  {
    id: 'F-2',
    label: 'Target release version set',
    type: 'automated',
    source: 'index',
    check: function(feature) {
      var versions = feature.targetVersions
      return Array.isArray(versions) && versions.length > 0
    }
  },
  {
    id: 'F-4',
    label: 'PM assigned',
    type: 'automated',
    source: 'detail',
    check: function(feature) {
      if (!feature.pm) return false
      if (typeof feature.pm === 'string') return feature.pm.length > 0
      if (feature.pm.displayName) return true
      return false
    }
  },
  {
    id: 'F-5',
    label: 'Delivery owner assigned',
    type: 'automated',
    source: 'index',
    check: function(feature) {
      if (!feature.assignee) return false
      if (typeof feature.assignee === 'string') return feature.assignee.length > 0
      if (feature.assignee.displayName) return true
      return false
    }
  },
  {
    id: 'F-6',
    label: 'Component/team assignment',
    type: 'automated',
    source: 'detail',
    check: function(feature) {
      return Array.isArray(feature.components) && feature.components.length > 0
    }
  },
  {
    id: 'F-7',
    label: 'Estimated scope (story points)',
    type: 'automated',
    source: 'jira',
    check: function(feature, enrichment) {
      return !!(enrichment && enrichment.storyPoints && enrichment.storyPoints > 0)
    }
  },
  {
    id: 'F-8',
    label: 'No unresolved blocking dependencies',
    type: 'automated',
    source: 'jira',
    // Inverted logic: passes by DEFAULT, fails only if there are
    // unresolved inward "Blocks" links. Most features have no blocking
    // dependencies, so the default is "passing."
    check: function(feature, enrichment) {
      if (!enrichment || !enrichment.dependencyLinks) return true
      var blocking = enrichment.dependencyLinks.filter(function(d) {
        return d.direction === 'inward' &&
          d.type === 'Blocks' &&
          CLOSED_STATUSES.indexOf(d.linkedStatus) === -1
      })
      return blocking.length === 0
    }
  },
  {
    id: 'F-10',
    label: 'Release type/phase specified',
    type: 'automated',
    source: 'detail',
    check: function(feature) {
      return !!feature.releaseType
    }
  },

  // Manual checks -- toggled by PM in the UI
  {
    id: 'F-3',
    label: 'Acceptance criteria defined',
    type: 'manual',
    source: 'manual'
  },
  {
    id: 'F-9',
    label: 'RFE linkage (if customer-driven)',
    type: 'manual',
    source: 'manual'
  },
  {
    id: 'F-11',
    label: 'Architectural alignment reviewed',
    type: 'manual',
    source: 'manual'
  },
  {
    id: 'F-12',
    label: 'Cross-functional engagement confirmed',
    type: 'manual',
    source: 'manual'
  },
  {
    id: 'F-13',
    label: 'Licensing review complete',
    type: 'manual',
    source: 'manual'
  }
]

/**
 * Evaluate the DoR checklist for a single feature.
 *
 * @param {object} feature - Raw feature data from loadIndex()/loadFeatureDetail().
 *   Must include: summary, targetVersions, assignee, pm, components, releaseType
 * @param {object|null} enrichment - Jira enrichment data from jira-enrichment.js.
 *   May be null if Jira enrichment was skipped.
 * @param {object|null} manualChecks - Persisted manual check state from dor-state file.
 *   Format: { "F-3": { checked: true, ... }, "F-9": { checked: false, ... }, ... }
 * @returns {{ checkedCount: number, totalCount: number, completionPct: number, items: Array<object> }}
 */
function evaluateDor(feature, enrichment, manualChecks) {
  var safeEnrichment = enrichment || {}
  var safeManual = manualChecks || {}
  var items = []
  var checkedCount = 0
  var totalCount = DOR_ITEMS.length

  for (var i = 0; i < DOR_ITEMS.length; i++) {
    var item = DOR_ITEMS[i]
    var checked = false

    if (item.type === 'automated') {
      checked = item.check(feature, safeEnrichment)
    } else {
      // Manual check -- read from persisted state
      var manualEntry = safeManual[item.id]
      if (manualEntry && manualEntry.checked) checked = true
    }

    if (checked) checkedCount++

    items.push({
      id: item.id,
      label: item.label,
      type: item.type,
      checked: checked,
      source: item.source
    })
  }

  var completionPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0

  return {
    checkedCount: checkedCount,
    totalCount: totalCount,
    completionPct: completionPct,
    items: items
  }
}

module.exports = {
  DOR_ITEMS: DOR_ITEMS,
  evaluateDor: evaluateDor
}
