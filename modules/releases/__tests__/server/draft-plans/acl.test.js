import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const {
  resolveDraftPlanSession,
  applySessionToMeta,
  authorizeEditorSave,
  namesMatch,
  _setGetAllPeople
} = require('../../../server/draft-plans/acl')

function makeStorage(data) {
  var store = data || {}
  return {
    async readFromStorage(key) {
      return store[key] ? JSON.parse(JSON.stringify(store[key])) : null
    }
  }
}

describe('draft-plans acl', function() {
  var prevDemo
  var prevVite

  beforeEach(function() {
    prevDemo = process.env.DEMO_MODE
    prevVite = process.env.VITE_DEMO_MODE
    process.env.DEMO_MODE = 'false'
    process.env.VITE_DEMO_MODE = 'false'
    _setGetAllPeople(async function() {
      return [
        {
          uid: 'abellusci',
          name: 'Adam Bellusci',
          email: 'abellusci@redhat.com',
          jiraDisplayName: 'Adam Bellusci'
        },
        {
          uid: 'alice',
          name: 'Alice',
          email: 'alice@redhat.com'
        }
      ]
    })
  })

  afterEach(function() {
    _setGetAllPeople(null)
    if (prevDemo === undefined) delete process.env.DEMO_MODE
    else process.env.DEMO_MODE = prevDemo
    if (prevVite === undefined) delete process.env.VITE_DEMO_MODE
    else process.env.VITE_DEMO_MODE = prevVite
  })

  it('matches assignee names case-insensitively', function() {
    expect(namesMatch('Adam Bellusci', 'adam bellusci')).toBe(true)
    expect(namesMatch('Adam', 'Alice')).toBe(false)
  })

  it('resolves roster actor and denies impersonation outside demo', async function() {
    var session = await resolveDraftPlanSession(
      { userEmail: 'abellusci@redhat.com', userUid: 'abellusci', isAdmin: false },
      makeStorage()
    )
    expect(session.actor).toBe('Adam Bellusci')
    expect(session.rosterMatched).toBe(true)
    expect(session.isPlanAdmin).toBe(false)
    expect(session.canImpersonate).toBe(false)
  })

  it('grants plan admin for platform admin or planning-manager', async function() {
    var admin = await resolveDraftPlanSession(
      { userEmail: 'alice@redhat.com', isAdmin: true },
      makeStorage()
    )
    expect(admin.isPlanAdmin).toBe(true)
    expect(admin.canImpersonate).toBe(false)

    var pm = await resolveDraftPlanSession(
      { userEmail: 'alice@redhat.com', isPlanningManager: true },
      makeStorage()
    )
    expect(pm.isPlanAdmin).toBe(true)
  })

  it('allows impersonation only in DEMO_MODE', async function() {
    process.env.DEMO_MODE = 'true'
    var session = await resolveDraftPlanSession(
      { userEmail: 'abellusci@redhat.com', isAdmin: false },
      makeStorage()
    )
    expect(session.canImpersonate).toBe(true)
  })

  it('binds production meta to session actor', function() {
    var session = {
      actor: 'Adam Bellusci',
      isPlanAdmin: false,
      canImpersonate: false
    }
    var meta = applySessionToMeta(
      { currentUser: 'Admin', isPlanAdmin: true, frozenEvents: {} },
      session,
      'Admin'
    )
    expect(meta.currentUser).toBe('Adam Bellusci')
    expect(meta.isPlanAdmin).toBe(false)
  })

  it('rejects non-owner feature edits', function() {
    var session = {
      email: 'abellusci@redhat.com',
      actor: 'Adam Bellusci',
      isPlanAdmin: false,
      canImpersonate: false
    }
    var draft = {
      candidates: [
        { key: 'F-1', assignee: 'Alice', basePlacement: 'EA1' },
        { key: 'F-2', assignee: 'Adam Bellusci', basePlacement: 'EA1' }
      ]
    }
    var denied = authorizeEditorSave(
      session,
      draft,
      { edits: {}, meta: { frozenEvents: {} } },
      {
        edits: { 'F-1': { decision: 'move', placement: 'EA2' } },
        meta: { currentUser: 'Admin', frozenEvents: {} }
      }
    )
    expect(denied.ok).toBe(false)
    expect(denied.status).toBe(403)

    var allowed = authorizeEditorSave(
      session,
      draft,
      { edits: {}, meta: { frozenEvents: {} } },
      {
        edits: { 'F-2': { decision: 'move', placement: 'EA2' } },
        meta: { frozenEvents: {} }
      }
    )
    expect(allowed.ok).toBe(true)
    expect(allowed.meta.currentUser).toBe('Adam Bellusci')
  })

  it('rejects freeze changes for non-admins', function() {
    var session = {
      email: 'abellusci@redhat.com',
      actor: 'Adam Bellusci',
      isPlanAdmin: false,
      canImpersonate: false
    }
    var result = authorizeEditorSave(
      session,
      { candidates: [] },
      { edits: {}, meta: { frozenEvents: {} } },
      {
        edits: {},
        meta: {
          frozenEvents: { EA1: { frozenAt: '2026-07-16T00:00:00Z' } }
        }
      }
    )
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/freeze/i)
  })
})
