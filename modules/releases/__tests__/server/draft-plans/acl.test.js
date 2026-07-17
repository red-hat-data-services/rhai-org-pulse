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
        },
        {
          uid: 'emarion',
          name: 'Emarion',
          email: 'emarion@redhat.com',
          jiraDisplayName: 'Emarion'
        },
        {
          uid: 'trozell',
          name: 'Tiffany Rozell',
          email: 'trozell@redhat.com',
          jiraDisplayName: 'Tiffany Rozell'
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

  it('grants plan admin only for allowlisted emails (not platform admin)', async function() {
    var platformOnly = await resolveDraftPlanSession(
      { userEmail: 'alice@redhat.com', isAdmin: true },
      makeStorage()
    )
    expect(platformOnly.isPlanAdmin).toBe(false)

    var planningMgr = await resolveDraftPlanSession(
      { userEmail: 'alice@redhat.com', isPlanningManager: true },
      makeStorage()
    )
    expect(planningMgr.isPlanAdmin).toBe(false)

    var allowlisted = await resolveDraftPlanSession(
      { userEmail: 'emarion@redhat.com', isAdmin: false },
      makeStorage()
    )
    expect(allowlisted.isPlanAdmin).toBe(true)
    expect(allowlisted.planAdminNames).toContain('Tiffany Rozell')
    expect(allowlisted.planAdminNames).toContain('Emarion')

    var tiffany = await resolveDraftPlanSession(
      { userEmail: 'trozell@redhat.com' },
      makeStorage()
    )
    expect(tiffany.isPlanAdmin).toBe(true)
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
      canImpersonate: false,
      planAdminNames: ['Emarion', 'Tiffany Rozell']
    }
    var meta = applySessionToMeta(
      { currentUser: 'Admin', isPlanAdmin: true, frozenEvents: {} },
      session,
      'Admin'
    )
    expect(meta.currentUser).toBe('Adam Bellusci')
    expect(meta.isPlanAdmin).toBe(false)
  })

  it('demo impersonation grants admin only for plan-admin names', function() {
    var session = {
      actor: 'Adam Bellusci',
      isPlanAdmin: false,
      canImpersonate: true,
      planAdminNames: ['Emarion', 'Tiffany Rozell']
    }
    var asTiffany = applySessionToMeta({ frozenEvents: {} }, session, 'Tiffany Rozell')
    expect(asTiffany.currentUser).toBe('Tiffany Rozell')
    expect(asTiffany.isPlanAdmin).toBe(true)

    var asOwner = applySessionToMeta({ frozenEvents: {} }, session, 'Adam Bellusci')
    expect(asOwner.isPlanAdmin).toBe(false)

    var asLegacyAdmin = applySessionToMeta({ frozenEvents: {} }, session, 'Admin')
    expect(asLegacyAdmin.isPlanAdmin).toBe(false)
  })

  it('rejects non-owner feature edits', function() {
    var session = {
      email: 'abellusci@redhat.com',
      actor: 'Adam Bellusci',
      isPlanAdmin: false,
      canImpersonate: false,
      planAdminNames: ['Emarion', 'Tiffany Rozell']
    }
    var draft = {
      candidates: [
        { key: 'F-1', assignee: 'Alice', pm: 'Jenny Yi', basePlacement: 'EA1' },
        { key: 'F-2', assignee: 'Adam Bellusci', basePlacement: 'EA1' },
        { key: 'F-3', assignee: 'Bob', pm: 'Adam Bellusci', basePlacement: 'EA1' }
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

    var asPm = authorizeEditorSave(
      session,
      draft,
      { edits: {}, meta: { frozenEvents: {} } },
      {
        edits: { 'F-3': { decision: 'descope', placement: null } },
        meta: { frozenEvents: {} }
      }
    )
    expect(asPm.ok).toBe(true)
  })

  it('rejects freeze changes for non-admins', function() {
    var session = {
      email: 'abellusci@redhat.com',
      actor: 'Adam Bellusci',
      isPlanAdmin: false,
      canImpersonate: false,
      planAdminNames: ['Emarion', 'Tiffany Rozell']
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
