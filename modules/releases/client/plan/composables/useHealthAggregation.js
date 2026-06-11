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
   * Planning readiness data from the health API summary.
   * Null when not in planning mode or enablePlanningChecks is off.
   */
  var planningReadiness = computed(function() {
    if (!healthData.value || !healthData.value.summary) return null
    return healthData.value.summary.planningReadiness || null
  })

  /**
   * Release phase mode from the health API response.
   * 'planning' = before GA freeze, 'execution' = at/past GA freeze, 'unknown' = cannot determine.
   */
  var releasePhaseMode = computed(function() {
    return healthData.value ? healthData.value.releasePhaseMode || 'unknown' : 'unknown'
  })

  /**
   * Per-big-rock aggregated health: worst risk level, total flags, feature count.
   * Respects risk overrides. In planning mode, also aggregates planning check data.
   */
  var rockHealth = computed(function() {
    if (Object.keys(healthByKey.value).length === 0) return {}
    var result = {}
    var isPlanningMode = releasePhaseMode.value === 'planning'
    for (var i = 0; i < features.value.length; i++) {
      var f = features.value[i]
      var rockNames = f.bigRock ? f.bigRock.split(', ') : []
      if (rockNames.length === 0) continue

      for (var ri = 0; ri < rockNames.length; ri++) {
        var rockName = rockNames[ri]
        if (!result[rockName]) {
          result[rockName] = { worstLevel: 'green', totalFlags: 0, featureCount: 0, dorPassedCount: 0, dodPassedCount: 0, planningReady: 0, planningTotal: 0, planningBlockers: 0, versionedCount: 0, missingVersionCount: 0, committedCount: 0, targetedCount: 0, distinctVersions: new Set(), releaseTypes: new Set() }
        }

        // Collect release type from candidates data (available on all features)
        var featurePhase = f.phase || ''
        if (['DP', 'TP', 'GA'].indexOf(featurePhase) !== -1) {
          result[rockName].releaseTypes.add(featurePhase)
        }

        // Health-specific aggregation below — skips features without health data
        var h = healthByKey.value[f.issueKey]
        if (!h || !h.risk) continue

        result[rockName].featureCount++
        result[rockName].totalFlags += (h.risk.score || 0)
        if (h.dor && h.dor.passed) result[rockName].dorPassedCount++
        if (h.dod && h.dod.passed) result[rockName].dodPassedCount++
        var level = effectiveLevel(h)
        if (isWorse(level, result[rockName].worstLevel)) {
          result[rockName].worstLevel = level
        }
        // Planning mode aggregation
        if (isPlanningMode && h.planningChecks) {
          result[rockName].planningTotal++
          if (!h.planningChecks.hasHardBlockers) {
            result[rockName].planningReady++
          } else {
            result[rockName].planningBlockers++
          }
        }
        // Version aggregation
        var vs = h.versionStatus || 'none'
        if (vs === 'committed' || vs === 'targeted') {
          result[rockName].versionedCount++
          if (vs === 'committed') result[rockName].committedCount++
          else result[rockName].targetedCount++
        } else {
          result[rockName].missingVersionCount++
        }
        if (h.fixVersions) {
          var fvParts = typeof h.fixVersions === 'string' ? h.fixVersions.split(', ') : []
          for (var fvi = 0; fvi < fvParts.length; fvi++) {
            if (fvParts[fvi]) result[rockName].distinctVersions.add(fvParts[fvi])
          }
        }
      }
    }
    // Convert Sets to arrays before returning
    var MATURITY_ORDER = { DP: 0, TP: 1, GA: 2 }
    var resultKeys = Object.keys(result)
    for (var rni = 0; rni < resultKeys.length; rni++) {
      result[resultKeys[rni]].distinctVersions = Array.from(result[resultKeys[rni]].distinctVersions)
      result[resultKeys[rni]].releaseTypes = Array.from(result[resultKeys[rni]].releaseTypes)
        .sort(function(a, b) { return (MATURITY_ORDER[a] !== undefined ? MATURITY_ORDER[a] : 99) - (MATURITY_ORDER[b] !== undefined ? MATURITY_ORDER[b] : 99) })
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
      var rockNames = f.bigRock ? f.bigRock.split(', ') : []
      if (rockNames.length === 0) continue
      var h = healthByKey.value[f.issueKey]
      for (var ri = 0; ri < rockNames.length; ri++) {
        var rockName = rockNames[ri]
        if (!result[rockName]) result[rockName] = []
        var level = h && h.risk ? effectiveLevel(h) : 'green'
        var flags = h && h.risk ? h.risk.flags || [] : []
        result[rockName].push({
          key: f.issueKey,
          bigRock: f.bigRock || '',
          releaseType: f.phase || '',
          level: level,
          flagCount: flags.length,
          flagCategories: flags.map(function(fl) { return fl.category }),
          summary: h ? (h.summary || '') : '',
          dorPassed: h && h.dor ? h.dor.passed : null,
          dodPassed: h && h.dod ? h.dod.passed : null,
          planningStatus: h ? (h.planningStatus || '') : '',
          deliveryOwner: h ? (h.deliveryOwner || '') : '',
          jiraUrl: h ? (h.jiraUrl || '') : '',
          override: h && h.risk ? (h.risk.override || null) : null,
          status: h ? (h.status || '') : '',
          fixVersions: h ? (h.fixVersions || '') : '',
          targetRelease: h ? (h.targetRelease || '') : '',
          versionStatus: h ? (h.versionStatus || 'none') : 'none',
          completionPct: h ? (h.completionPct || 0) : 0,
          planningChecks: h && h.planningChecks ? h.planningChecks : null
        })
      }
    }
    return result
  })

  /**
   * Tier 1 health summary: counts green/yellow/red for Tier 1 features only.
   * Filters healthData.features directly by tier === 1 and uses effectiveLevel()
   * to respect risk overrides.
   */
  var tier1HealthSummary = computed(function() {
    if (!healthData.value || !healthData.value.features) {
      return null
    }
    var counts = { green: 0, yellow: 0, red: 0 }
    var healthFeatures = healthData.value.features
    for (var i = 0; i < healthFeatures.length; i++) {
      var h = healthFeatures[i]
      if (h.tier !== 1) continue
      var level = effectiveLevel(h)
      if (level && counts[level] !== undefined) {
        counts[level]++
      }
    }
    return { byRisk: counts }
  })

  return {
    healthByKey: healthByKey,
    rfeKeyToHealth: rfeKeyToHealth,
    rockHealth: rockHealth,
    rockFeatures: rockFeatures,
    healthSummary: healthSummary,
    tier1HealthSummary: tier1HealthSummary,
    planningReadiness: planningReadiness,
    releasePhaseMode: releasePhaseMode
  }
}
