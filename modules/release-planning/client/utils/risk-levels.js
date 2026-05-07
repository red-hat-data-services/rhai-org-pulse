/**
 * Risk severity ranking: lower number = worse risk.
 * Used by DashboardView and BigRocksTable to compare risk levels.
 */
var RISK_SEVERITY = { red: 0, yellow: 1, green: 2 }

/**
 * Returns true when levelA is worse (more severe) than levelB.
 * Unknown levels default to green (severity 2).
 */
function isWorse(levelA, levelB) {
  return (RISK_SEVERITY[levelA] != null ? RISK_SEVERITY[levelA] : 2) < (RISK_SEVERITY[levelB] != null ? RISK_SEVERITY[levelB] : 2)
}

export { RISK_SEVERITY, isWorse }
