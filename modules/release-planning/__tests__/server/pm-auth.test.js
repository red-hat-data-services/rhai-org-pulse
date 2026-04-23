import { describe, it, expect, vi } from 'vitest'
const { createRequirePM, getPMUsers, addPMUser, removePMUser } = require('../../server/pm-auth')

function createMockStorage(data) {
  return {
    readFromStorage: vi.fn(function(key) {
      return data[key] || null
    }),
    writeToStorage: vi.fn(function(key, value) {
      data[key] = value
    })
  }
}

describe('createRequirePM', () => {
  it('allows admin users through', () => {
    var storage = createMockStorage({})
    var requirePM = createRequirePM(storage.readFromStorage)
    var req = { isAdmin: true, userEmail: 'admin@redhat.com' }
    var res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    var next = vi.fn()

    requirePM(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('allows listed PM users through', () => {
    var storage = createMockStorage({
      'release-planning/pm-users.json': { emails: ['pm@redhat.com'] }
    })
    var requirePM = createRequirePM(storage.readFromStorage)
    var req = { isAdmin: false, userEmail: 'pm@redhat.com' }
    var res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    var next = vi.fn()

    requirePM(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('blocks non-admin, non-PM users', () => {
    var storage = createMockStorage({
      'release-planning/pm-users.json': { emails: ['pm@redhat.com'] }
    })
    var requirePM = createRequirePM(storage.readFromStorage)
    var req = { isAdmin: false, userEmail: 'nobody@redhat.com' }
    var res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    var next = vi.fn()

    requirePM(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('handles missing pm-users.json gracefully', () => {
    var storage = createMockStorage({})
    var requirePM = createRequirePM(storage.readFromStorage)
    var req = { isAdmin: false, userEmail: 'pm@redhat.com' }
    var res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    var next = vi.fn()

    requirePM(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })
})

describe('getPMUsers', () => {
  it('returns emails from storage', () => {
    var storage = createMockStorage({
      'release-planning/pm-users.json': { emails: ['a@redhat.com', 'b@redhat.com'] }
    })
    expect(getPMUsers(storage.readFromStorage)).toEqual(['a@redhat.com', 'b@redhat.com'])
  })

  it('returns empty array when no file exists', () => {
    var storage = createMockStorage({})
    expect(getPMUsers(storage.readFromStorage)).toEqual([])
  })
})

describe('addPMUser', () => {
  it('adds a new email', () => {
    var data = {}
    var storage = createMockStorage(data)
    var result = addPMUser(storage.readFromStorage, storage.writeToStorage, 'new@redhat.com')
    expect(result).toContain('new@redhat.com')
    expect(storage.writeToStorage).toHaveBeenCalled()
  })

  it('does not duplicate existing email', () => {
    var data = {
      'release-planning/pm-users.json': { emails: ['existing@redhat.com'] }
    }
    var storage = createMockStorage(data)
    var result = addPMUser(storage.readFromStorage, storage.writeToStorage, 'existing@redhat.com')
    expect(result).toEqual(['existing@redhat.com'])
    expect(storage.writeToStorage).not.toHaveBeenCalled()
  })
})

describe('removePMUser', () => {
  it('removes an existing email', () => {
    var data = {
      'release-planning/pm-users.json': { emails: ['a@redhat.com', 'b@redhat.com'] }
    }
    var storage = createMockStorage(data)
    var result = removePMUser(storage.readFromStorage, storage.writeToStorage, 'a@redhat.com')
    expect(result).toEqual(['b@redhat.com'])
    expect(storage.writeToStorage).toHaveBeenCalled()
  })

  it('handles removing non-existent email gracefully', () => {
    var data = {
      'release-planning/pm-users.json': { emails: ['a@redhat.com'] }
    }
    var storage = createMockStorage(data)
    var result = removePMUser(storage.readFromStorage, storage.writeToStorage, 'nonexistent@redhat.com')
    expect(result).toEqual(['a@redhat.com'])
  })
})
