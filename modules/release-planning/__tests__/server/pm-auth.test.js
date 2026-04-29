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
    const storage = createMockStorage({})
    const requirePM = createRequirePM(storage.readFromStorage)
    const req = { isAdmin: true, userEmail: 'admin@redhat.com' }
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const next = vi.fn()

    requirePM(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('allows listed PM users through', () => {
    const storage = createMockStorage({
      'release-planning/pm-users.json': { emails: ['pm@redhat.com'] }
    })
    const requirePM = createRequirePM(storage.readFromStorage)
    const req = { isAdmin: false, userEmail: 'pm@redhat.com' }
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const next = vi.fn()

    requirePM(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('blocks non-admin, non-PM users', () => {
    const storage = createMockStorage({
      'release-planning/pm-users.json': { emails: ['pm@redhat.com'] }
    })
    const requirePM = createRequirePM(storage.readFromStorage)
    const req = { isAdmin: false, userEmail: 'nobody@redhat.com' }
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const next = vi.fn()

    requirePM(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('handles missing pm-users.json gracefully', () => {
    const storage = createMockStorage({})
    const requirePM = createRequirePM(storage.readFromStorage)
    const req = { isAdmin: false, userEmail: 'pm@redhat.com' }
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const next = vi.fn()

    requirePM(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })
})

describe('getPMUsers', () => {
  it('returns emails from storage', () => {
    const storage = createMockStorage({
      'release-planning/pm-users.json': { emails: ['a@redhat.com', 'b@redhat.com'] }
    })
    expect(getPMUsers(storage.readFromStorage)).toEqual(['a@redhat.com', 'b@redhat.com'])
  })

  it('returns empty array when no file exists', () => {
    const storage = createMockStorage({})
    expect(getPMUsers(storage.readFromStorage)).toEqual([])
  })
})

describe('addPMUser', () => {
  it('adds a new email', () => {
    const data = {}
    const storage = createMockStorage(data)
    const result = addPMUser(storage.readFromStorage, storage.writeToStorage, 'new@redhat.com')
    expect(result).toContain('new@redhat.com')
    expect(storage.writeToStorage).toHaveBeenCalled()
  })

  it('does not duplicate existing email', () => {
    const data = {
      'release-planning/pm-users.json': { emails: ['existing@redhat.com'] }
    }
    const storage = createMockStorage(data)
    const result = addPMUser(storage.readFromStorage, storage.writeToStorage, 'existing@redhat.com')
    expect(result).toEqual(['existing@redhat.com'])
    expect(storage.writeToStorage).not.toHaveBeenCalled()
  })
})

describe('removePMUser', () => {
  it('removes an existing email', () => {
    const data = {
      'release-planning/pm-users.json': { emails: ['a@redhat.com', 'b@redhat.com'] }
    }
    const storage = createMockStorage(data)
    const result = removePMUser(storage.readFromStorage, storage.writeToStorage, 'a@redhat.com')
    expect(result).toEqual(['b@redhat.com'])
    expect(storage.writeToStorage).toHaveBeenCalled()
  })

  it('handles removing non-existent email gracefully', () => {
    const data = {
      'release-planning/pm-users.json': { emails: ['a@redhat.com'] }
    }
    const storage = createMockStorage(data)
    const result = removePMUser(storage.readFromStorage, storage.writeToStorage, 'nonexistent@redhat.com')
    expect(result).toEqual(['a@redhat.com'])
  })
})
