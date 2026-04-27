var PHASE_LABELS = ['EA1', 'EA2', 'GA']

function splitCommaString(str) {
  if (!str || typeof str !== 'string') return []
  return str.split(',').map(function(s) { return s.trim() }).filter(Boolean)
}

/**
 * @param {object} feature - Feature object with fixVersions or fixVersion
 * @param {string} version - Release version (e.g., '3.5')
 * @param {string|null} phase - Selected phase (EA1/EA2/GA) or null
 * @param {boolean} [strict=true] - When true, only match phase-specific fix versions.
 *   When false (inclusive), also include features whose fix versions match the
 *   release version but have no phase-specific suffix. Excludes features tagged
 *   for a different phase.
 * @returns {boolean}
 */
export function passesPhaseFilter(feature, version, phase, strict) {
  if (strict === undefined) strict = true
  if (!phase) return true

  var fixVersionStr = feature.fixVersions || feature.fixVersion || ''
  var fixVersions = splitCommaString(fixVersionStr)

  if (fixVersions.length === 0) return false

  var phaseUpper = phase.toUpperCase()
  var versionUpper = (version || '').toUpperCase()

  for (var i = 0; i < fixVersions.length; i++) {
    var fv = fixVersions[i].toUpperCase()
    if (fv.indexOf(versionUpper) === -1) continue

    if (fv.indexOf(phaseUpper) !== -1) return true

    if (!strict) {
      var hasAnyPhase = false
      for (var j = 0; j < PHASE_LABELS.length; j++) {
        if (fv.indexOf(PHASE_LABELS[j]) !== -1) {
          hasAnyPhase = true
          break
        }
      }
      if (!hasAnyPhase) return true
    }
  }

  return false
}
