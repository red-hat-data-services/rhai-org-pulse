var PHASE_LABELS = ['EA1', 'EA2', 'GA']

function splitCommaString(str) {
  if (!str || typeof str !== 'string') return []
  return str.split(',').map(function(s) { return s.trim() }).filter(Boolean)
}

/**
 * @param {object} feature - Feature object with fixVersions or fixVersion
 * @param {string} version - Release version (e.g., '3.5')
 * @param {string|null} phase - Selected phase (EA1/EA2/GA) or null
 * @param {boolean} [strict=true] - When true (committed phase), only features
 *   with a fix version containing both the version AND the phase label pass.
 *   When false (uncommitted phase), all features pass EXCEPT those exclusively
 *   tagged for a different phase (e.g., EA1-only features are excluded from EA2).
 * @returns {boolean}
 */
export function passesPhaseFilter(feature, version, phase, strict) {
  if (strict === undefined) strict = true
  if (!phase) return true

  var fixVersionStr = feature.fixVersions || feature.fixVersion || ''
  var fixVersions = splitCommaString(fixVersionStr)
  var phaseUpper = phase.toUpperCase()
  var versionUpper = (version || '').toUpperCase()

  if (strict) {
    for (var i = 0; i < fixVersions.length; i++) {
      var fv = fixVersions[i].toUpperCase()
      if (fv.indexOf(versionUpper) !== -1 && fv.indexOf(phaseUpper) !== -1) {
        return true
      }
    }
    return false
  }

  // Inclusive mode: exclude features exclusively tagged for a different phase
  if (fixVersions.length === 0) return true

  var hasMatchingPhase = false
  var hasDifferentPhase = false
  var hasUnphased = false

  for (var k = 0; k < fixVersions.length; k++) {
    var fvk = fixVersions[k].toUpperCase()
    if (fvk.indexOf(versionUpper) === -1) continue

    if (fvk.indexOf(phaseUpper) !== -1) {
      hasMatchingPhase = true
      continue
    }

    var taggedPhase = false
    for (var j = 0; j < PHASE_LABELS.length; j++) {
      if (fvk.indexOf(PHASE_LABELS[j]) !== -1) {
        taggedPhase = true
        break
      }
    }

    if (taggedPhase) {
      hasDifferentPhase = true
    } else {
      hasUnphased = true
    }
  }

  if (hasMatchingPhase) return true
  if (hasUnphased) return true
  if (hasDifferentPhase) return false
  return true
}
