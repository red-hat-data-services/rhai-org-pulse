/**
 * Client-side phase filter utility.
 *
 * Ported from server/health/health-pipeline.js passesPhaseFilter().
 * Determines whether a feature should appear in a given phase tab
 * based on its fixVersion string.
 */

var VALID_PHASES = ['EA1', 'EA2', 'GA']

/**
 * Split a comma-separated string into a trimmed array.
 * @param {string} str
 * @returns {Array<string>}
 */
function splitCommaString(str) {
  if (!str || typeof str !== 'string') return []
  return str.split(',').map(function(s) { return s.trim() }).filter(Boolean)
}

/**
 * Check whether a feature passes the phase filter.
 * If no phase is specified, all features pass.
 * If a feature has a phase-specific fixVersion (e.g., rhoai-3.5-EA2),
 * it only appears in the matching phase view.
 * Features without phase-specific fixVersions appear in all views.
 *
 * @param {object} feature - Feature object with fixVersion string
 * @param {string} version - Release version (e.g., '3.5')
 * @param {string|null} phase - Selected phase (EA1/EA2/GA) or null
 * @returns {boolean}
 */
export function passesPhaseFilter(feature, version, phase) {
  if (!phase) return true

  var fixVersionStr = feature.fixVersion || ''
  var fixVersions = splitCommaString(fixVersionStr)

  var hasPhaseSpecific = false
  var matchesRequestedPhase = false

  for (var i = 0; i < fixVersions.length; i++) {
    var fv = fixVersions[i].toUpperCase()
    for (var j = 0; j < VALID_PHASES.length; j++) {
      if (fv.indexOf('-' + VALID_PHASES[j]) !== -1) {
        hasPhaseSpecific = true
        if (VALID_PHASES[j] === phase.toUpperCase()) {
          matchesRequestedPhase = true
        }
      }
    }
  }

  if (!hasPhaseSpecific) return true
  return matchesRequestedPhase
}
