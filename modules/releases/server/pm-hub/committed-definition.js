/**
 * PM Hub "Committed" classification.
 *
 * Requested = Target Version intersects selected release scope (handled by caller).
 * Committed = Fix Version intersects selected release scope (FV only — no TV gate).
 * TV/FV relationship is surfaced separately via alignmentCategory (Delta 5-category).
 */

const {
  parseReleaseName,
  compareReleasesTemporally
} = require('../tv-fv-delta/routes')

/**
 * True when both names parse to the same product + major.minor.
 * Kept for alignment / cycle helpers; not used to gate Committed.
 */
function sameReleaseCycle(a, b) {
  var pa = parseReleaseName(a)
  var pb = parseReleaseName(b)
  if (!pa || !pb) return false
  return pa.product === pb.product && pa.major === pb.major && pa.minor === pb.minor
}

/**
 * Filter Fix Versions that intersect the selected release scope.
 * Committed is FV-in-scope only; `tvNames` is ignored (kept for call-site compat).
 *
 * @param {string[]} matchingFv - Fix Versions that intersect the selected scope
 * @param {string[]} [_tvNames] - unused (TV does not gate Committed)
 * @returns {string[]} matchingFv (or empty)
 */
function filterCommittedFixVersions(matchingFv, _tvNames) {
  if (!Array.isArray(matchingFv) || matchingFv.length === 0) return []
  return matchingFv.slice()
}

module.exports = {
  sameReleaseCycle,
  filterCommittedFixVersions,
  parseReleaseName,
  compareReleasesTemporally
}
