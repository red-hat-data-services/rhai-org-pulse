/**
 * Draft Plans identity + ACL.
 * Production: actor is the signed-in user (roster-resolved); no impersonation.
 * DEMO_MODE: keep Acting-as impersonation for local review.
 */

const roster = require('../../../../shared/server/roster')
const { DATA_PREFIX } = require('./fetch')

var getAllPeopleImpl = roster.getAllPeople

/** Test-only override for roster lookup. */
function _setGetAllPeople(fn) {
  getAllPeopleImpl = fn || roster.getAllPeople
}

function isDemoMode() {
  return process.env.DEMO_MODE === 'true'
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function namesMatch(a, b) {
  return normalizeName(a) === normalizeName(b) && normalizeName(a) !== ''
}

function actorNameFromPerson(person) {
  if (!person) return null
  return person.jiraDisplayName || person.name || null
}

function findPerson(people, email, uid) {
  var i
  if (email) {
    var emailLc = email.toLowerCase()
    for (i = 0; i < people.length; i++) {
      if (people[i].email && people[i].email.toLowerCase() === emailLc) return people[i]
    }
  }
  if (uid) {
    for (i = 0; i < people.length; i++) {
      if (people[i].uid === uid) return people[i]
    }
  }
  return null
}

/**
 * Resolve the signed-in actor for Draft Plans.
 * @param {object} req
 * @param {{ readFromStorage: Function }} storage
 */
async function resolveDraftPlanSession(req, storage) {
  var demo = isDemoMode()
  var email = req.userEmail ? String(req.userEmail).toLowerCase() : null
  var uid = req.userUid || (email ? email.split('@')[0] : null)
  var people = []
  try {
    people = await getAllPeopleImpl(storage)
  } catch (err) {
    console.warn('[releases/draft-plans] roster lookup failed:', err.message)
  }

  var person = findPerson(people, email, uid)
  var actor = actorNameFromPerson(person)
  if (!actor && email) actor = email.split('@')[0]
  if (!actor) actor = 'unknown'

  var isPlanAdmin = !!(req.isAdmin || req.isPlanningManager)
  // Optional config allowlist (emails), stored next to draft-plans config
  try {
    var cfg = await storage.readFromStorage(DATA_PREFIX + '/config.json')
    var allow = cfg && Array.isArray(cfg.planAdminEmails) ? cfg.planAdminEmails : null
    if (allow && email) {
      for (var a = 0; a < allow.length; a++) {
        if (String(allow[a] || '').toLowerCase() === email) {
          isPlanAdmin = true
          break
        }
      }
    }
  } catch {
    // ignore
  }

  return {
    email: email,
    uid: uid,
    actor: actor,
    rosterMatched: !!person,
    isPlanAdmin: isPlanAdmin,
    canImpersonate: demo,
    demoMode: demo
  }
}

function applySessionToMeta(meta, session, requestedUser) {
  var next = Object.assign({}, meta || {})
  if (session.canImpersonate) {
    var user = requestedUser || next.currentUser || 'Admin'
    next.currentUser = user
    next.isPlanAdmin = user === 'Admin' || session.isPlanAdmin === true
  } else {
    next.currentUser = session.actor
    next.isPlanAdmin = session.isPlanAdmin
  }
  return next
}

function metaFreezeFingerprint(meta) {
  var m = meta || {}
  return JSON.stringify({
    frozenEvents: m.frozenEvents || {},
    finalGaFrozen: !!m.finalGaFrozen,
    locked: !!m.locked
  })
}

function editFingerprint(edit) {
  return JSON.stringify(edit || null)
}

/**
 * Validate a PUT payload against session ACL.
 * Mutates payload.meta to bind identity.
 * @returns {{ ok: true, meta: object } | { ok: false, status: number, error: string }}
 */
function authorizeEditorSave(session, draft, previousEnvelope, payload) {
  if (!session) {
    return { ok: false, status: 401, error: 'Authentication required' }
  }
  if (!session.email && !session.canImpersonate) {
    return { ok: false, status: 401, error: 'Authentication required' }
  }

  var requestedUser = payload && payload.meta ? payload.meta.currentUser : null
  var meta = applySessionToMeta(payload.meta, session, requestedUser)
  var previous = previousEnvelope || { edits: {}, meta: {} }
  var prevEdits = previous.edits || {}
  var nextEdits = (payload && payload.edits) || {}

  if (metaFreezeFingerprint(previous.meta) !== metaFreezeFingerprint(meta)) {
    if (!meta.isPlanAdmin) {
      return { ok: false, status: 403, error: 'Only plan admins can freeze or unfreeze the plan' }
    }
  }

  // Mass reset (clearing all edits while previous had some) is admin-only
  var prevKeys = Object.keys(prevEdits)
  var nextKeys = Object.keys(nextEdits)
  if (prevKeys.length > 0 && nextKeys.length === 0 && !meta.isPlanAdmin) {
    return { ok: false, status: 403, error: 'Only plan admins can reset the plan' }
  }

  if (!meta.isPlanAdmin) {
    var byKey = {}
    var candidates = (draft && draft.candidates) || []
    for (var i = 0; i < candidates.length; i++) {
      byKey[candidates[i].key] = candidates[i]
    }

    var seen = {}
    var keys = prevKeys.concat(nextKeys)
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k]
      if (seen[key]) continue
      seen[key] = true
      if (editFingerprint(prevEdits[key]) === editFingerprint(nextEdits[key])) continue

      var row = byKey[key]
      if (!row) {
        return { ok: false, status: 403, error: 'Cannot edit unknown feature ' + key }
      }
      if (!namesMatch(row.assignee, meta.currentUser)) {
        return {
          ok: false,
          status: 403,
          error: 'You can only edit features assigned to you (' + meta.currentUser + ')'
        }
      }
    }
  }

  return { ok: true, meta: meta }
}

module.exports = {
  isDemoMode,
  namesMatch,
  resolveDraftPlanSession,
  applySessionToMeta,
  authorizeEditorSave,
  _setGetAllPeople
}
