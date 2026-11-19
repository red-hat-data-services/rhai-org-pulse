// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { resolvePersona, resolveUserEmail } from '../../server/persona-resolver.js'

let mtimeCounter = 0

function createMockStorage(registry, personaMap) {
  const mtime = ++mtimeCounter
  return {
    readFromStorage: vi.fn(async function (key) {
      if (key === 'team-data/registry.json') return registry
      if (key === 'usage/persona-map.json') return personaMap
      return null
    }),
    getFileMtime: vi.fn(async function () { return mtime })
  }
}

const sampleRegistry = {
  people: {
    jdoe: { status: 'active', email: 'jdoe@redhat.com', title: 'Senior Software Engineer' },
    msmith: { status: 'active', email: 'msmith@redhat.com', title: 'Engineering Manager' },
    nobody: { status: 'active', email: 'nobody@redhat.com', title: null },
    inactive: { status: 'inactive', email: 'gone@redhat.com', title: 'Software Engineer' }
  }
}

const samplePersonaMap = {
  'Software Engineer': 'developer',
  'Senior Software Engineer': 'developer',
  'Engineering Manager': 'engineering-manager'
}

describe('resolvePersona', () => {
  it('resolves persona from registry title', async () => {
    const storage = createMockStorage(sampleRegistry, samplePersonaMap)
    const req = { userUid: 'jdoe' }
    const result = await resolvePersona(req, storage)
    expect(result).toBe('developer')
  })

  it('resolves manager persona', async () => {
    const storage = createMockStorage(sampleRegistry, samplePersonaMap)
    const req = { userUid: 'msmith' }
    const result = await resolvePersona(req, storage)
    expect(result).toBe('engineering-manager')
  })

  it('returns other for unmapped titles', async () => {
    const registry = { people: { user1: { status: 'active', title: 'Unknown Role' } } }
    const storage = createMockStorage(registry, samplePersonaMap)
    const req = { userUid: 'user1' }
    const result = await resolvePersona(req, storage)
    expect(result).toBe('other')
  })

  it('returns other when person has no title', async () => {
    const storage = createMockStorage(sampleRegistry, samplePersonaMap)
    const req = { userUid: 'nobody' }
    const result = await resolvePersona(req, storage)
    expect(result).toBe('other')
  })

  it('returns null when no userUid', async () => {
    const storage = createMockStorage(sampleRegistry, samplePersonaMap)
    const req = { userUid: null }
    const result = await resolvePersona(req, storage)
    expect(result).toBeNull()
  })

  it('returns null when user not in registry', async () => {
    const storage = createMockStorage(sampleRegistry, samplePersonaMap)
    const req = { userUid: 'nonexistent' }
    const result = await resolvePersona(req, storage)
    expect(result).toBeNull()
  })
})

describe('resolveUserEmail', () => {
  it('returns req.userEmail', () => {
    expect(resolveUserEmail({ userEmail: 'test@redhat.com' })).toBe('test@redhat.com')
  })

  it('returns null when not set', () => {
    expect(resolveUserEmail({})).toBeNull()
  })
})
