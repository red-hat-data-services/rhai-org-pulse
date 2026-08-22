/**
 * Draft Plan red-pen model (WI-7 / AIPCC-19984).
 * Mirrors release-planning DRAFT-PLAN-EDITOR-CONTRACT.md — pure helpers, no I/O.
 */

var PLACEMENTS = ['EA1', 'EA2', 'GA', 'Below cut']
var SCHEDULED = { EA1: true, EA2: true, GA: true }
var EVENT_RANK = { EA1: 0, EA2: 1, GA: 2, 'Below cut': 3, Descope: 4 }
var SUPPORT_COMPONENTS = { Documentation: true, UXD: true }
var NON_ENG = { Unassigned: true, '': true, '—': true, '-': true }
var ADMIN = 'Admin'
var AUDIT_CAP = 500

function isScheduled(placement) {
  return !!SCHEDULED[placement]
}

function emptyMeta(planVersion, baseGeneratedAt) {
  return {
    planVersion: planVersion || null,
    baseGeneratedAt: baseGeneratedAt || null,
    currentUser: ADMIN,
    isPlanAdmin: true,
    editorsAllowlist: null,
    frozenEvents: {},
    finalGaFrozen: false,
    locked: false,
    lockedBy: null,
    lockedAt: null
  }
}

function namesMatch(a, b) {
  var left = String(a || '')
    .trim()
    .toLowerCase()
  var right = String(b || '')
    .trim()
    .toLowerCase()
  return left !== '' && left === right
}

function emptyEditorState(planVersion, baseGeneratedAt) {
  return {
    edits: {},
    meta: emptyMeta(planVersion, baseGeneratedAt),
    audit: []
  }
}

/**
 * Normalize pipeline draft JSON (scheduled/belowCut or candidates[]) → candidates[].
 */
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
    if (isScheduled(p)) scheduled += 1
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
    pm: row.pm || '—',
    bigRock: row.bigRock || '',
    bigRockPriority: row.bigRockPriority != null && row.bigRockPriority !== ''
      ? Number(row.bigRockPriority)
      : null,
    outcomeKey: row.outcomeKey || '',
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

function getEdit(edits, key) {
  return edits && edits[key] ? edits[key] : null
}

function ensureEdit(edits, key) {
  if (!edits[key]) {
    edits[key] = {
      decision: null,
      placement: null,
      approved: false,
      approvedBy: null,
      approvedAt: null,
      proposedFixVersion: null
    }
  }
  return edits[key]
}

function effectiveDecision(row, edits) {
  var e = getEdit(edits, row.key)
  return e && e.decision ? e.decision : 'unset'
}

function effectivePlacement(row, edits) {
  var e = getEdit(edits, row.key)
  if (!e || !e.decision) return row.basePlacement
  if (e.decision === 'descope') return 'Descope'
  if (e.decision === 'move') return e.placement || row.basePlacement
  return row.basePlacement
}

function isApproved(row, edits) {
  var e = getEdit(edits, row.key)
  return !!(e && e.approved)
}

function proposedFV(row, edits) {
  var e = getEdit(edits, row.key)
  return (e && e.proposedFixVersion) || null
}

function isChanged(row, edits) {
  var d = effectiveDecision(row, edits)
  if (d === 'descope') return true
  if (d === 'move') return effectivePlacement(row, edits) !== row.basePlacement
  return false
}

function isFinalFrozen(meta) {
  return !!(meta && (meta.finalGaFrozen || meta.locked))
}

function eventFrozen(meta, ev) {
  return !!(meta && meta.frozenEvents && meta.frozenEvents[ev])
}

function rowFrozen(row, edits, meta) {
  if (isFinalFrozen(meta)) return true
  var p = effectivePlacement(row, edits)
  return isScheduled(p) && eventFrozen(meta, p)
}

function isAdmin(meta) {
  if (!meta) return false
  return meta.isPlanAdmin === true
}

function ownsRow(row, user) {
  return namesMatch(row && row.assignee, user) || namesMatch(row && row.pm, user)
}

function canEditRow(row, edits, meta) {
  if (rowFrozen(row, edits, meta)) return false
  if (isAdmin(meta)) return true
  return ownsRow(row, meta && meta.currentUser)
}

/**
 * Descope stays reversible until Final GA / plan lock.
 * Event freezes must not block Undo (descoped rows leave EA1/EA2/GA).
 */
function canReverseDescope(row, edits, meta) {
  if (isFinalFrozen(meta)) return false
  if (isAdmin(meta)) return true
  return ownsRow(row, meta && meta.currentUser)
}

function familyForFV(row) {
  if (row.productFamily === 'RHAII') return 'RHAII'
  return 'RHOAI'
}

function fvTemplate(planVersion, family, event) {
  var ver = planVersion || '0.0'
  if (family === 'RHAII') {
    if (event === 'EA1') return 'RHAII-' + ver + ' EA1'
    if (event === 'EA2') return 'RHAII-' + ver + ' EA2'
    if (event === 'GA') return 'RHAII-' + ver
    return null
  }
  if (event === 'EA1') return 'rhoai-' + ver + '.EA1'
  if (event === 'EA2') return 'rhoai-' + ver + '.EA2'
  if (event === 'GA') return 'rhoai-' + ver
  return null
}

function isRealEng(comp) {
  return !!(comp && !SUPPORT_COMPONENTS[comp] && !NON_ENG[comp])
}

function histCycleBudget(ceilings, comp) {
  var c = ceilings && ceilings[comp]
  if (!c) return 0
  return (Number(c.EA1) || 0) + (Number(c.EA2) || 0) + (Number(c.GA) || 0)
}

function usesCycleFloor(ceilings, comp) {
  return isRealEng(comp) && histCycleBudget(ceilings, comp) === 0
}

function effectiveCycleBudget(ceilings, comp) {
  var hist = histCycleBudget(ceilings, comp)
  if (isRealEng(comp) && hist === 0) return 1
  return hist
}

function componentLoad(candidates, edits, comp, event, excludeKey) {
  var n = 0
  for (var i = 0; i < candidates.length; i++) {
    var base = candidates[i]
    if (base.component !== comp) continue
    if (excludeKey && base.key === excludeKey) continue
    if (effectivePlacement(base, edits) === event) n += 1
  }
  return n
}

function cycleLoad(candidates, edits, comp, excludeKey) {
  var n = 0
  for (var i = 0; i < candidates.length; i++) {
    var base = candidates[i]
    if (base.component !== comp) continue
    if (excludeKey && base.key === excludeKey) continue
    if (isScheduled(effectivePlacement(base, edits))) n += 1
  }
  return n
}

/**
 * @returns {null|{over:boolean, mode:'cycle_floor'|'ceiling'|'none', loadAfter:number, budget:number|null, message:string}}
 */
function capacityCheckForMove(candidates, edits, ceilings, row, placement) {
  if (!isScheduled(placement)) return null
  var comp = row.component
  if (usesCycleFloor(ceilings, comp)) {
    var budget = effectiveCycleBudget(ceilings, comp)
    var loadAfter = cycleLoad(candidates, edits, comp, row.key) + 1
    return {
      over: loadAfter > budget,
      mode: 'cycle_floor',
      loadAfter: loadAfter,
      budget: budget,
      message:
        comp +
        ' cycle budget ' +
        budget +
        ' (floor): load would be ' +
        loadAfter +
        ' across EA1/EA2/GA. Move anyway?'
    }
  }
  var c = ceilings && ceilings[comp]
  if (!c || c[placement] == null) {
    return {
      over: false,
      mode: 'none',
      loadAfter: componentLoad(candidates, edits, comp, placement, row.key) + 1,
      budget: null,
      message: null
    }
  }
  var ceil = Number(c[placement])
  var after = componentLoad(candidates, edits, comp, placement, row.key) + 1
  return {
    over: after > ceil,
    mode: 'ceiling',
    loadAfter: after,
    budget: ceil,
    message: comp + ' @ ' + placement + ': load would be ' + after + ' (ceiling ' + ceil + '). Move anyway?'
  }
}

function clearApprovalIfNeeded(edit, prevPlacement, nextPlacement) {
  if (!edit || !edit.approved) return false
  if (prevPlacement === nextPlacement) return false
  edit.approved = false
  edit.approvedBy = null
  edit.approvedAt = null
  return true
}

function auditEntriesEqual(a, b) {
  if (!a || !b) return false
  return (
    a.actor === b.actor &&
    a.action === b.action &&
    a.key === b.key &&
    a.from === b.from &&
    a.to === b.to &&
    a.detail === b.detail
  )
}

const AUDIT_DISPLAY_CAP = 80

function formatAuditDetail(entry) {
  if (!entry) return ''
  if (entry.detail) return entry.detail
  var parts = []
  if (entry.key) parts.push(entry.key)
  if (entry.from != null) parts.push(entry.from + ' → ' + entry.to)
  if (entry.action) parts.push(entry.action)
  return parts.filter(Boolean).join(' · ')
}

function appendAudit(audit, entry, actor) {
  var next = {
    ts: new Date().toISOString(),
    actor: actor || ADMIN,
    action: entry.action,
    key: entry.key || null,
    from: entry.from || null,
    to: entry.to || null,
    detail: entry.detail || ''
  }
  if (audit.length > 0 && auditEntriesEqual(audit[0], next)) return false
  audit.unshift(next)
  if (audit.length > AUDIT_CAP) audit.length = AUDIT_CAP
  return true
}

function viewRow(base, edits, meta) {
  var placement = effectivePlacement(base, edits)
  return Object.assign({}, base, {
    event: placement,
    eventRank: EVENT_RANK[placement] != null ? EVENT_RANK[placement] : 9,
    scheduled: isScheduled(placement),
    decision: effectiveDecision(base, edits),
    approved: isApproved(base, edits),
    changed: isChanged(base, edits),
    frozen: rowFrozen(base, edits, meta),
    proposedFixVersion: proposedFV(base, edits),
    editable: canEditRow(base, edits, meta),
    canUndescope: canReverseDescope(base, edits, meta)
  })
}

function applyMove(state, candidates, ceilings, row, placement, opts) {
  opts = opts || {}
  var edits = state.edits
  var meta = state.meta
  // Moving off Descope is a reverse-descope until Final GA freeze
  if (effectiveDecision(row, edits) === 'descope') {
    if (!canReverseDescope(row, edits, meta)) return { ok: false, reason: 'forbidden' }
  } else if (!canEditRow(row, edits, meta)) {
    return { ok: false, reason: 'forbidden' }
  }

  var prevPlacement = effectivePlacement(row, edits)
  var prevDecision = effectiveDecision(row, edits)

  if (!opts.skipCapacity && isScheduled(placement)) {
    var check = capacityCheckForMove(candidates, edits, ceilings, row, placement)
    if (check && check.over && !opts.capacityOverride) {
      return { ok: false, reason: 'capacity', check: check, pending: { key: row.key, placement: placement } }
    }
  }

  var e = ensureEdit(edits, row.key)
  var cleared
  if (placement === row.basePlacement) {
    e.decision = null
    e.placement = null
    cleared = clearApprovalIfNeeded(e, prevPlacement, placement)
    appendAudit(
      state.audit,
      {
        action: 'decision',
        key: row.key,
        from: prevDecision + '/' + prevPlacement,
        to: 'unset/' + placement,
        detail: row.key + ' → restored base (' + placement + ')'
      },
      meta.currentUser
    )
  } else {
    e.decision = 'move'
    e.placement = placement
    cleared = clearApprovalIfNeeded(e, prevPlacement, placement)
    appendAudit(
      state.audit,
      {
        action: opts.capacityOverride ? 'capacity_override' : 'decision',
        key: row.key,
        from: prevDecision + '/' + prevPlacement,
        to: 'move/' + placement,
        detail:
          row.key +
          ' → move (' +
          placement +
          ')' +
          (opts.capacityOverride ? ' [over ceiling]' : '')
      },
      meta.currentUser
    )
  }
  if (cleared) {
    appendAudit(
      state.audit,
      { action: 'approval_cleared', key: row.key, detail: row.key + ' approval cleared (placement changed)' },
      meta.currentUser
    )
  }
  return { ok: true }
}

function applyDescope(state, row) {
  var edits = state.edits
  var meta = state.meta
  if (!canEditRow(row, edits, meta)) return { ok: false, reason: 'forbidden' }
  var prevPlacement = effectivePlacement(row, edits)
  var prevDecision = effectiveDecision(row, edits)
  if (prevDecision === 'descope') return { ok: true, noop: true }
  var e = ensureEdit(edits, row.key)
  e.decision = 'descope'
  e.placement = null
  var cleared = clearApprovalIfNeeded(e, prevPlacement, 'Descope')
  appendAudit(
    state.audit,
    {
      action: 'decision',
      key: row.key,
      from: prevDecision + '/' + prevPlacement,
      to: 'descope/Descope',
      detail: row.key + ' → descope (out of ' + (meta.planVersion || 'cycle') + ')'
    },
    meta.currentUser
  )
  if (cleared) {
    appendAudit(
      state.audit,
      { action: 'approval_cleared', key: row.key, detail: row.key + ' approval cleared (placement changed)' },
      meta.currentUser
    )
  }
  return { ok: true }
}

function clearDescope(state, row) {
  var edits = state.edits
  var meta = state.meta
  if (!canReverseDescope(row, edits, meta)) return { ok: false, reason: 'forbidden' }
  var e = getEdit(edits, row.key)
  if (!e || e.decision !== 'descope') return { ok: true, noop: true }
  e.decision = null
  e.placement = null
  clearApprovalIfNeeded(e, 'Descope', row.basePlacement)
  appendAudit(
    state.audit,
    {
      action: 'decision',
      key: row.key,
      from: 'descope/Descope',
      to: 'unset/' + row.basePlacement,
      detail: row.key + ' → undescoped (base ' + row.basePlacement + ')'
    },
    meta.currentUser
  )
  return { ok: true }
}

function setApproved(state, row, approved) {
  var edits = state.edits
  var meta = state.meta
  if (!canEditRow(row, edits, meta)) return { ok: false, reason: 'forbidden' }
  var e = ensureEdit(edits, row.key)
  var was = !!e.approved
  if (was === !!approved) return { ok: true, noop: true }
  e.approved = !!approved
  e.approvedBy = approved ? meta.currentUser : null
  e.approvedAt = approved ? new Date().toISOString() : null
  appendAudit(
    state.audit,
    {
      action: approved ? 'approve' : 'unapprove',
      key: row.key,
      detail: row.key + (approved ? ' owner approved (commitment)' : ' approval removed')
    },
    meta.currentUser
  )
  return { ok: true }
}

function freezeEvent(state, candidates, eventName) {
  var meta = state.meta
  if (!isAdmin(meta) || isFinalFrozen(meta) || eventFrozen(meta, eventName)) {
    return { ok: false, reason: 'forbidden' }
  }
  var count = 0
  for (var i = 0; i < candidates.length; i++) {
    var base = candidates[i]
    if (effectivePlacement(base, state.edits) !== eventName) continue
    var e = ensureEdit(state.edits, base.key)
    e.proposedFixVersion = fvTemplate(meta.planVersion, familyForFV(base), eventName)
    count += 1
  }
  meta.frozenEvents[eventName] = {
    frozenAt: new Date().toISOString(),
    frozenBy: meta.currentUser,
    featureCount: count
  }
  appendAudit(
    state.audit,
    {
      action: 'freeze_event',
      detail: 'Freeze ' + eventName + ' (' + count + ' features, FV simulated, below-cut untouched)'
    },
    meta.currentUser
  )
  return { ok: true, featureCount: count }
}

function finalGaFreeze(state, candidates) {
  var meta = state.meta
  if (!isAdmin(meta) || isFinalFrozen(meta)) return { ok: false, reason: 'forbidden' }

  var gaCount = 0
  for (var i = 0; i < candidates.length; i++) {
    var base = candidates[i]
    if (effectivePlacement(base, state.edits) !== 'GA') continue
    var e = ensureEdit(state.edits, base.key)
    e.proposedFixVersion = fvTemplate(meta.planVersion, familyForFV(base), 'GA')
    gaCount += 1
  }
  meta.frozenEvents.GA = {
    frozenAt: new Date().toISOString(),
    frozenBy: meta.currentUser,
    featureCount: gaCount
  }

  var descoped = 0
  for (var j = 0; j < candidates.length; j++) {
    var row = candidates[j]
    if (effectivePlacement(row, state.edits) !== 'Below cut') continue
    var ed = ensureEdit(state.edits, row.key)
    ed.decision = 'descope'
    ed.placement = null
    descoped += 1
  }

  meta.finalGaFrozen = true
  meta.locked = true
  meta.lockedBy = meta.currentUser
  meta.lockedAt = new Date().toISOString()

  appendAudit(
    state.audit,
    {
      action: 'final_ga_freeze',
      detail: 'Final GA freeze: ' + gaCount + ' GA locked, ' + descoped + ' Below cut auto-descoped'
    },
    meta.currentUser
  )
  return { ok: true, gaCount: gaCount, descoped: descoped }
}

function unfreezeEvent(state, candidates, eventName) {
  var meta = state.meta
  if (!isAdmin(meta)) return { ok: false, reason: 'forbidden' }
  if (isFinalFrozen(meta)) return { ok: false, reason: 'final_locked' }
  if (!eventFrozen(meta, eventName)) return { ok: false, reason: 'not_frozen' }

  delete meta.frozenEvents[eventName]
  for (var i = 0; i < candidates.length; i++) {
    var base = candidates[i]
    var e = state.edits[base.key]
    if (!e || !e.proposedFixVersion) continue
    if (effectivePlacement(base, state.edits) === eventName) e.proposedFixVersion = null
  }
  appendAudit(
    state.audit,
    { action: 'unfreeze_event', detail: 'Unfreeze ' + eventName + ' (admin)' },
    meta.currentUser
  )
  return { ok: true }
}

function unfreezePlan(state, candidates) {
  var meta = state.meta
  if (!isAdmin(meta)) return { ok: false, reason: 'forbidden' }
  var hasEventFreeze = meta.frozenEvents && Object.keys(meta.frozenEvents).length > 0
  if (!isFinalFrozen(meta) && !meta.locked && !hasEventFreeze) {
    return { ok: false, reason: 'nothing' }
  }

  meta.frozenEvents = {}
  meta.finalGaFrozen = false
  meta.locked = false
  meta.lockedBy = null
  meta.lockedAt = null
  for (var i = 0; i < candidates.length; i++) {
    var e = state.edits[candidates[i].key]
    if (e && e.proposedFixVersion) e.proposedFixVersion = null
  }
  appendAudit(
    state.audit,
    { action: 'unfreeze_plan', detail: 'Plan unfrozen (admin); simulated FVs cleared' },
    meta.currentUser
  )
  return { ok: true }
}

function resetToBase(state, planVersion, baseGeneratedAt) {
  var user = state.meta && state.meta.currentUser ? state.meta.currentUser : ADMIN
  var wasAdmin = isAdmin(state.meta)
  state.edits = {}
  state.meta = emptyMeta(planVersion, baseGeneratedAt)
  state.meta.currentUser = user
  state.meta.isPlanAdmin = wasAdmin
  state.audit = []
  appendAudit(state.audit, { action: 'reset', detail: 'Reset to base draft' }, user)
  return { ok: true }
}

/**
 * Top-level summary counts, mirroring the red-pen editor's stat bar
 * (Candidates / Scheduled / EA1 / EA2 / GA / Below cut / Descoped / Approved).
 * `rows` should be view rows (post viewRow()) scoped to the active product filter,
 * but BEFORE the event/component/search filters — matches editor semantics where
 * only "Showing" reflects the search/filter result.
 */
function summaryCounts(rows) {
  var byEvent = { EA1: 0, EA2: 0, GA: 0, 'Below cut': 0, Descope: 0 }
  var approved = 0
  for (var i = 0; i < rows.length; i++) {
    var ev = rows[i].event
    if (byEvent[ev] != null) byEvent[ev] += 1
    if (rows[i].approved) approved += 1
  }
  return {
    candidates: rows.length,
    scheduled: byEvent.EA1 + byEvent.EA2 + byEvent.GA,
    ea1: byEvent.EA1,
    ea2: byEvent.EA2,
    ga: byEvent.GA,
    belowCut: byEvent['Below cut'],
    descoped: byEvent.Descope,
    approved: approved
  }
}

function loadBarsByComponent(candidates, edits, ceilings, eventName) {
  var loads = {}
  for (var i = 0; i < candidates.length; i++) {
    var row = candidates[i]
    if (effectivePlacement(row, edits) !== eventName) continue
    loads[row.component] = (loads[row.component] || 0) + 1
  }
  var bars = []
  var comps = Object.keys(loads).sort()
  for (var j = 0; j < comps.length; j++) {
    var comp = comps[j]
    var load = loads[comp]
    var budget = null
    if (usesCycleFloor(ceilings, comp)) {
      budget = effectiveCycleBudget(ceilings, comp)
    } else if (ceilings && ceilings[comp] && ceilings[comp][eventName] != null) {
      budget = Number(ceilings[comp][eventName])
    }
    bars.push({ component: comp, load: load, budget: budget })
  }
  return bars
}

export {
  ADMIN,
  PLACEMENTS,
  EVENT_RANK,
  emptyEditorState,
  emptyMeta,
  normalizeDraft,
  normalizeCandidate,
  effectiveDecision,
  effectivePlacement,
  isApproved,
  isChanged,
  rowFrozen,
  canEditRow,
  canReverseDescope,
  ownsRow,
  isAdmin,
  isFinalFrozen,
  eventFrozen,
  fvTemplate,
  familyForFV,
  usesCycleFloor,
  capacityCheckForMove,
  componentLoad,
  cycleLoad,
  AUDIT_DISPLAY_CAP,
  appendAudit,
  formatAuditDetail,
  viewRow,
  applyMove,
  applyDescope,
  clearDescope,
  setApproved,
  freezeEvent,
  unfreezeEvent,
  unfreezePlan,
  finalGaFreeze,
  resetToBase,
  loadBarsByComponent,
  summaryCounts,
  isScheduled
}
