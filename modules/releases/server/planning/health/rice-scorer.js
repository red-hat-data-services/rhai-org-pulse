/**
 * RICE score computation.
 *
 * RICE = (Reach * Impact * Confidence%) / Effort
 *
 * RICE fields are read from RHAISTRAT parent features (outcome keys).
 * The field IDs must be discovered and configured before RICE scoring
 * can be enabled (see healthConfig.enableRice).
 *
 * Returns null for features with incomplete RICE data -- this is not
 * an error condition, just means the data is not available yet.
 */

/**
 * Compute the RICE score from component values.
 *
 * @param {object|null} rice - { reach, impact, confidence, effort }
 *   - reach: number of users/quarter affected
 *   - impact: 0.25 (minimal), 0.5 (low), 1 (medium), 2 (high), 3 (massive)
 *   - confidence: percentage (0-100)
 *   - effort: person-months
 * @returns {number|null} Computed RICE score, or null if data is incomplete
 */
function computeRiceScore(rice) {
  if (!rice) return null
  if (!rice.reach || !rice.impact || !rice.confidence || !rice.effort) return null

  var reach = Number(rice.reach)
  var impact = Number(rice.impact)
  var confidence = Number(rice.confidence)
  var effort = Number(rice.effort)

  if (isNaN(reach) || isNaN(impact) || isNaN(confidence) || isNaN(effort)) return null
  if (effort === 0) return null

  var confidencePct = confidence / 100
  return Math.round((reach * impact * confidencePct) / effort)
}

/**
 * Build a complete RICE result object for inclusion in the health cache.
 *
 * @param {object|null} rice - Raw RICE values from Jira enrichment
 * @returns {object|null} RICE result with score, or null if incomplete
 */
function buildRiceResult(rice) {
  if (!rice) return null

  var score = computeRiceScore(rice)
  var complete = score !== null

  return {
    reach: rice.reach || null,
    impact: rice.impact || null,
    confidence: rice.confidence || null,
    effort: rice.effort || null,
    score: score,
    complete: complete
  }
}

module.exports = {
  computeRiceScore: computeRiceScore,
  buildRiceResult: buildRiceResult
}
