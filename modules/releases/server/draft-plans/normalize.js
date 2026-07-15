/**
 * Normalize pipeline draft JSON for Org Pulse Draft Plans editor.
 * CommonJS twin of client draft-plan-model.normalizeDraft (keep in sync).
 */

function readyLabel(row) {
  if (row.ready === true || row.readyBool === true) return 'Plan-ready'
  if (typeof row.ready === 'string' && row.ready) return row.ready
  if (row.humanSignoff || row.qg1Pass) return 'Partial'
  return 'Not ready'
}

function normalizeCandidate(row) {
  var basePlacement = row.basePlacement || row.proposed || 'Below cut'
  var component = row.component || row.primaryComponent || 'Unassigned'
  var readyBool = row.readyBool === true || row.ready === true
  return {
    key: row.key,
    summary: row.summary || '',
    basePlacement: basePlacement,
    priority: row.priority || '',
    component: component,
    assignee: row.assignee || '—',
    currentTV: row.currentTV || '',
    targetVersions: Array.isArray(row.targetVersions) ? row.targetVersions : [],
    productFamily: row.productFamily || 'RHOAI',
    productFamilyConflict: !!row.productFamilyConflict,
    status: row.status || '',
    ready: readyLabel(row),
    readyBool: readyBool,
    cycleBudget: Number(row.cycleBudget) || 0,
    placeReason: row.placeReason || '',
    capacitySource: row.capacitySource || '',
    rank: Number(row.rank) || 0
  }
}

function normalizeDraft(raw) {
  if (!raw || typeof raw !== 'object') {
    return { version: null, generatedAt: null, summary: null, candidates: [], ceilingsByComponent: {} }
  }

  var ceilings = raw.ceilingsByComponent || {}
  var candidates = []

  if (Array.isArray(raw.candidates) && raw.candidates.length > 0) {
    for (var i = 0; i < raw.candidates.length; i++) {
      candidates.push(normalizeCandidate(raw.candidates[i]))
    }
  } else {
    var pools = []
    if (Array.isArray(raw.scheduled)) pools = pools.concat(raw.scheduled)
    if (Array.isArray(raw.belowCut)) pools = pools.concat(raw.belowCut)
    for (var j = 0; j < pools.length; j++) {
      candidates.push(normalizeCandidate(pools[j]))
    }
  }

  var byEvent = { EA1: 0, EA2: 0, GA: 0, 'Below cut': 0 }
  var scheduled = 0
  for (var k = 0; k < candidates.length; k++) {
    var p = candidates[k].basePlacement
    if (byEvent[p] != null) byEvent[p] += 1
    if (p === 'EA1' || p === 'EA2' || p === 'GA') scheduled += 1
  }

  return {
    version: raw.version || null,
    generatedAt: raw.generatedAt || null,
    baselineAsOf: raw.baselineAsOf || null,
    demoMode: !!raw.demoMode,
    summary: raw.summary || {
      candidateCount: candidates.length,
      scheduled: scheduled,
      belowCut: candidates.length - scheduled,
      byEvent: byEvent
    },
    candidates: candidates,
    ceilingsByComponent: ceilings
  }
}

module.exports = {
  normalizeDraft,
  normalizeCandidate
}
