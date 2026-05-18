var RISK_SEVERITY = { red: 0, yellow: 1, green: 2 }

function isWorse(levelA, levelB) {
  return (RISK_SEVERITY[levelA] != null ? RISK_SEVERITY[levelA] : 2) < (RISK_SEVERITY[levelB] != null ? RISK_SEVERITY[levelB] : 2)
}

export { RISK_SEVERITY, isWorse }
