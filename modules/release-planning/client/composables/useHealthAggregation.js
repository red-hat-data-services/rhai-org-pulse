import { computed } from 'vue'
import { isWorse } from '../utils/risk-levels'

/**
 * Composable that aggregates health data across features, RFEs, and big rocks.
 *
 * Accepts reactive refs as parameters (not singleton composables) to preserve
 * Vue reactivity chains and avoid duplicate state.
 *
 * The M5 behavioral fix is applied here: rfeKeyToHealth now respects risk
 * overrides, consistent with how rockHealth has always worked.
 *
 * @param {import('vue').Ref} healthData - reactive ref to health API response
 * @param {import('vue').Ref} features - reactive ref to features array
 * @param {import('vue').Ref} rfes - reactive ref to RFEs array (reserved for future use)
 * @param {import('vue').Ref} bigRocks - reactive ref to big rocks array (reserved for future use)
 * @returns {{ healthByKey, rfeKeyToHealth, rockHealth, rockFeatures, healthSummary }}
 */
export function useHealthAggregation(healthData, features, _rfes, _bigRocks) {
  /**
   * Map of feature issueKey -> health object from the health API.
   */
  var healthByKey = computed(function() {
    if (!healthData.value || !healthData.value.features) return {}
    var map = {}
    for (var i = 0; i < healthData.value.features.length; i++) {
      var f = healthData.value.features[i]
      map[f.key] = f
    }
    return map
  })

  /**
   * Summary from the health API response.
   */
  var healthSummary = computed(function() {
    return healthData.value ? healthData.value.summary : null
  })

  /**
   * Resolve effective risk level from a health entry, respecting overrides.
   * This is the standardized logic (M5 fix) -- both rfeKeyToHealth and
   * rockHealth now use this same function.
   */
  function effectiveLevel(h) {
    if (!h || !h.risk) return null
    return h.risk.override
      ? (h.risk.override.riskOverride || h.risk.level)
      : h.risk.level
  }

  /**
   * Map of RFE issueKey -> worst health among features that reference it.
   * Now respects risk overrides (M5 fix -- previously DashboardView ignored them).
   */
  var rfeKeyToHealth = computed(function() {
    if (!features.value || Object.keys(healthByKey.value).length === 0) return {}
    var map = {}
    for (var i = 0; i < features.value.length; i++) {
      var f = features.value[i]
      if (!f.rfe) continue
      var h = healthByKey.value[f.issueKey]
      if (!h || !h.risk) continue
      var level = effectiveLevel(h)
      var existing = map[f.rfe]
      if (!existing || isWorse(level, effectiveLevel(existing))) {
        map[f.rfe] = { risk: { ...h.risk, level: level }, dor: h.dor || null, dod: h.dod || null, planningStatus: h.planningStatus || '' }
      }
    }
    return map
  })

  /**
   * Per-big-rock aggregated health: worst risk level, total flags, feature count.
   * Respects risk overrides.
   */
  var rockHealth = computed(function() {
    if (Object.keys(healthByKey.value).length === 0) return {}
    var result = {}
    for (var i = 0; i < features.value.length; i++) {
      var f = features.value[i]
      var rockName = f.bigRock
      if (!rockName) continue
      var h = healthByKey.value[f.issueKey]
      if (!h || !h.risk) continue

      if (!result[rockName]) {
        result[rockName] = { worstLevel: 'green', totalFlags: 0, featureCount: 0 }
      }
      result[rockName].featureCount++
      result[rockName].totalFlags += (h.risk.score || 0)
      var level = effectiveLevel(h)
      if (isWorse(level, result[rockName].worstLevel)) {
        result[rockName].worstLevel = level
      }
    }
    return result
  })

  /**
   * Per-big-rock feature detail: key, effective level, flag count, flag categories.
   * Respects risk overrides.
   */
  var rockFeatures = computed(function() {
    if (Object.keys(healthByKey.value).length === 0) return {}
    var result = {}
    for (var i = 0; i < features.value.length; i++) {
      var f = features.value[i]
      var rockName = f.bigRock
      if (!rockName) continue
      var h = healthByKey.value[f.issueKey]
      if (!result[rockName]) result[rockName] = []
      var level = h && h.risk ? effectiveLevel(h) : 'green'
      var flags = h && h.risk ? h.risk.flags || [] : []
      result[rockName].push({
        key: f.issueKey,
        level: level,
        flagCount: flags.length,
        flagCategories: flags.map(function(fl) { return fl.category })
      })
    }
    return result
  })

  return {
    healthByKey: healthByKey,
    rfeKeyToHealth: rfeKeyToHealth,
    rockHealth: rockHealth,
    rockFeatures: rockFeatures,
    healthSummary: healthSummary
  }
}
