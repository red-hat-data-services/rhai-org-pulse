/**
 * Compute the average requested features per release.
 *
 * @param {number} totalRequested - Total requested feature count across all releases.
 * @param {number} releaseCount   - Number of selected portfolio releases.
 * @returns {string} Formatted average rounded to one decimal place, or '—' when no releases are selected.
 */
function avgPerRelease(totalRequested, releaseCount) {
  if (!releaseCount || releaseCount <= 0) return '—'
  var avg = totalRequested / releaseCount
  return avg % 1 === 0 ? String(avg) : avg.toFixed(1)
}

export { avgPerRelease }
