import { describe, it, expect, beforeEach } from 'vitest'

const apiTokens = require('../api-tokens')

function createMockStorage() {
  const store = {}
  return {
    readFromStorage(key) {
      return store[key] || null
    },
    writeToStorage(key, data) {
      store[key] = JSON.parse(JSON.stringify(data))
    },
    _store: store
  }
}

describe('api-tokens', () => {
  let storage

  beforeEach(() => {
    storage = createMockStorage()
    apiTokens.init(storage)
    apiTokens._resetForTest()
  })

  describe('createToken', () => {
    it('creates a token and returns the raw token', async () => {
      const result = await apiTokens.createToken('user@test.com', 'My Token', null)
      expect(result.token).toMatch(/^tt_[a-f0-9]{32}$/)
      expect(result.id).toBeTruthy()
      expect(result.name).toBe('My Token')
      expect(result.expiresAt).toBeNull()
    })

    it('creates a token with 30d expiration', async () => {
      const result = await apiTokens.createToken('user@test.com', 'Expiring', '30d')
      expect(result.expiresAt).toBeTruthy()
      const expires = new Date(result.expiresAt)
      const now = new Date()
      const diffDays = (expires - now) / (1000 * 60 * 60 * 24)
      expect(diffDays).toBeGreaterThan(29)
      expect(diffDays).toBeLessThan(31)
    })

    it('creates a token with 90d expiration', async () => {
      const result = await apiTokens.createToken('user@test.com', 'Expiring', '90d')
      expect(result.expiresAt).toBeTruthy()
    })

    it('creates a token with 1y expiration', async () => {
      const result = await apiTokens.createToken('user@test.com', 'Expiring', '1y')
      expect(result.expiresAt).toBeTruthy()
    })

    it('rejects invalid expiresIn values', async () => {
      await expect(apiTokens.createToken('user@test.com', 'Bad', '7d')).rejects.toThrow('Invalid expiresIn')
    })

    it('enforces per-user token limit', async () => {
      for (let i = 0; i < 25; i++) {
        await apiTokens.createToken('user@test.com', `Token ${i}`, null)
      }
      await expect(apiTokens.createToken('user@test.com', 'One too many', null)).rejects.toThrow('Token limit reached')
    })

    it('per-user limit is independent between users', async () => {
      for (let i = 0; i < 25; i++) {
        await apiTokens.createToken('user1@test.com', `Token ${i}`, null)
      }
      // Different user should succeed
      const result = await apiTokens.createToken('user2@test.com', 'Token 0', null)
      expect(result.token).toBeTruthy()
    })

    it('stores hashed token, not raw token', async () => {
      await apiTokens.createToken('user@test.com', 'Test', null)
      const data = storage._store['api-tokens.json']
      expect(data.tokens[0].tokenHash).toBeTruthy()
      expect(data.tokens[0].tokenHash).not.toContain('tt_')
    })

    it('stores token prefix', async () => {
      const result = await apiTokens.createToken('user@test.com', 'Test', null)
      const data = storage._store['api-tokens.json']
      expect(data.tokens[0].tokenPrefix).toBe(result.token.substring(0, 11))
    })
  })

  describe('validateToken', () => {
    it('validates a valid token', async () => {
      const { token } = await apiTokens.createToken('user@test.com', 'Test', null)
      const record = apiTokens.validateToken(token)
      expect(record).toBeTruthy()
      expect(record.ownerEmail).toBe('user@test.com')
    })

    it('returns null for invalid token', () => {
      const record = apiTokens.validateToken('tt_0000000000000000000000000000000f')
      expect(record).toBeNull()
    })

    it('returns null for non-tt_ prefixed token', () => {
      expect(apiTokens.validateToken('not-a-token')).toBeNull()
    })

    it('returns null for null/undefined', () => {
      expect(apiTokens.validateToken(null)).toBeNull()
      expect(apiTokens.validateToken(undefined)).toBeNull()
    })

    it('returns null for expired token', async () => {
      const { token } = await apiTokens.createToken('user@test.com', 'Expiring', '30d')
      // Manually expire it
      const data = storage._store['api-tokens.json']
      data.tokens[0].expiresAt = new Date(Date.now() - 1000).toISOString()
      apiTokens._resetForTest() // Clear index to force re-read
      const record = apiTokens.validateToken(token)
      expect(record).toBeNull()
    })
  })

  describe('isValidToken', () => {
    it('returns true for valid token', async () => {
      const { token } = await apiTokens.createToken('user@test.com', 'Test', null)
      expect(apiTokens.isValidToken(token)).toBe(true)
    })

    it('returns false for invalid token', () => {
      expect(apiTokens.isValidToken('tt_invalid')).toBe(false)
    })
  })

  describe('listUserTokens', () => {
    it('lists only tokens belonging to the user', async () => {
      await apiTokens.createToken('user1@test.com', 'User1 Token', null)
      await apiTokens.createToken('user2@test.com', 'User2 Token', null)
      const list = apiTokens.listUserTokens('user1@test.com')
      expect(list).toHaveLength(1)
      expect(list[0].name).toBe('User1 Token')
      expect(list[0].tokenHash).toBeUndefined() // sanitized
    })
  })

  describe('listAllTokens', () => {
    it('lists all tokens without hashes', async () => {
      await apiTokens.createToken('user1@test.com', 'Token 1', null)
      await apiTokens.createToken('user2@test.com', 'Token 2', null)
      const list = apiTokens.listAllTokens()
      expect(list).toHaveLength(2)
      expect(list[0].tokenHash).toBeUndefined()
      expect(list[1].tokenHash).toBeUndefined()
    })
  })

  describe('revokeToken', () => {
    it('revokes own token', async () => {
      const { id } = await apiTokens.createToken('user@test.com', 'Test', null)
      const result = await apiTokens.revokeToken(id, 'user@test.com')
      expect(result).toBe(true)
      expect(apiTokens.listUserTokens('user@test.com')).toHaveLength(0)
    })

    it('does not revoke another user\'s token', async () => {
      const { id } = await apiTokens.createToken('user1@test.com', 'Test', null)
      const result = await apiTokens.revokeToken(id, 'user2@test.com')
      expect(result).toBe(false)
      expect(apiTokens.listUserTokens('user1@test.com')).toHaveLength(1)
    })

    it('returns false for non-existent token', async () => {
      const result = await apiTokens.revokeToken('non-existent', 'user@test.com')
      expect(result).toBe(false)
    })

    it('revoked token is no longer valid', async () => {
      const { token, id } = await apiTokens.createToken('user@test.com', 'Test', null)
      await apiTokens.revokeToken(id, 'user@test.com')
      expect(apiTokens.validateToken(token)).toBeNull()
    })
  })

  describe('adminRevokeToken', () => {
    it('revokes any token regardless of owner', async () => {
      const { id } = await apiTokens.createToken('user@test.com', 'Test', null)
      const result = await apiTokens.adminRevokeToken(id)
      expect(result).toBe(true)
      expect(apiTokens.listAllTokens()).toHaveLength(0)
    })
  })

  describe('touchLastUsed', () => {
    it('updates lastUsedAt on token', async () => {
      const { id } = await apiTokens.createToken('user@test.com', 'Test', null)
      apiTokens.touchLastUsed(id)
      // Give the fire-and-forget write a moment
      await new Promise(r => setTimeout(r, 50))
      const data = storage._store['api-tokens.json']
      expect(data.tokens[0].lastUsedAt).toBeTruthy()
    })
  })

  describe('_hashToken', () => {
    it('produces consistent SHA-256 hex', () => {
      const hash1 = apiTokens._hashToken('tt_test')
      const hash2 = apiTokens._hashToken('tt_test')
      expect(hash1).toBe(hash2)
      expect(hash1).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe('write lock serialization', () => {
    it('handles concurrent creates without data loss', async () => {
      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(apiTokens.createToken('user@test.com', `Token ${i}`, null))
      }
      await Promise.all(promises)
      expect(apiTokens.listUserTokens('user@test.com')).toHaveLength(5)
    })
  })
})
