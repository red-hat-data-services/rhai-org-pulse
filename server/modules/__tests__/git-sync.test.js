import { describe, it, expect, vi } from 'vitest'

// Test pure logic functions by importing from the built module
// CJS mocking of child_process/fs is unreliable in vitest node env,
// so we test the logic functions directly (same pattern as github tests).
const gitSync = await import('../git-sync')
const { _sanitizeError: sanitizeError, isSyncing } = gitSync

describe('git-sync', () => {
  describe('sanitizeError', () => {
    it('removes tokens from error messages', () => {
      const token = 'glpat-secret-token-123'
      const message = `Authentication failed for https://${token}@gitlab.com/repo`
      const result = sanitizeError(message, token)
      expect(result).not.toContain(token)
      expect(result).toContain('[REDACTED]')
    })

    it('returns message unchanged when no token', () => {
      const message = 'fatal: repository not found'
      expect(sanitizeError(message, null)).toBe(message)
      expect(sanitizeError(message, '')).toBe(message)
    })

    it('returns "Unknown error" for null message without token', () => {
      expect(sanitizeError(null, null)).toBe('Unknown error')
    })

    it('handles multiple token occurrences', () => {
      const token = 'my-secret'
      const message = `Error: my-secret appeared, then my-secret again`
      const result = sanitizeError(message, token)
      expect(result).toBe('Error: [REDACTED] appeared, then [REDACTED] again')
    })
  })

  describe('isSyncing', () => {
    it('returns false when module is not syncing', () => {
      expect(isSyncing('nonexistent-module')).toBe(false)
    })
  })

  describe('syncModule validation', () => {
    it('skips non-git-static modules', async () => {
      const storage = { readFromStorage: vi.fn(), writeToStorage: vi.fn(), DATA_DIR: '/tmp' }
      const result = await gitSync.syncModule(storage, { type: 'built-in', slug: 'test' })
      expect(result.status).toBe('skipped')
    })

    it('returns error for missing gitUrl', async () => {
      const storage = { readFromStorage: vi.fn(), writeToStorage: vi.fn(), DATA_DIR: '/tmp' }
      const result = await gitSync.syncModule(storage, { type: 'git-static', slug: 'test-no-url', gitUrl: null })
      expect(result.status).toBe('error')
      expect(result.message).toContain('gitUrl')
    })

    it('returns error for non-HTTPS URL', async () => {
      const storage = { readFromStorage: vi.fn(), writeToStorage: vi.fn(), DATA_DIR: '/tmp' }
      const result = await gitSync.syncModule(storage, {
        type: 'git-static',
        slug: 'test-bad-url',
        gitUrl: 'file:///etc/passwd'
      })
      expect(result.status).toBe('error')
      expect(result.message).toContain('HTTPS')
    })
  })

  describe('syncAllModules', () => {
    it('returns empty results when config is null', async () => {
      const storage = { readFromStorage: vi.fn(() => null), writeToStorage: vi.fn(), DATA_DIR: '/tmp' }
      const result = await gitSync.syncAllModules(storage)
      expect(result.results).toEqual([])
    })

    it('returns empty results when no git-static modules', async () => {
      const storage = {
        readFromStorage: vi.fn(() => ({ modules: [{ slug: 'tt', type: 'built-in' }] })),
        writeToStorage: vi.fn(),
        DATA_DIR: '/tmp'
      }
      const result = await gitSync.syncAllModules(storage)
      expect(result.results).toEqual([])
    })
  })

  describe('getSyncStatus', () => {
    it('returns empty modules when no config', () => {
      const storage = { readFromStorage: vi.fn(() => null), writeToStorage: vi.fn(), DATA_DIR: '/tmp' }
      const status = gitSync.getSyncStatus(storage)
      expect(status.modules).toEqual([])
    })

    it('returns status for git-static modules only', () => {
      const storage = {
        readFromStorage: vi.fn(() => ({
          modules: [
            { slug: 'tt', type: 'built-in' },
            { slug: 'rfe', type: 'git-static', lastSyncAt: '2024-01-01', lastSyncStatus: 'success', lastSyncError: null }
          ]
        })),
        writeToStorage: vi.fn(),
        DATA_DIR: '/tmp'
      }
      const status = gitSync.getSyncStatus(storage)
      expect(status.modules).toHaveLength(1)
      expect(status.modules[0].slug).toBe('rfe')
      expect(status.modules[0].lastSyncStatus).toBe('success')
      expect(status.modules[0].syncing).toBe(false)
    })
  })
})
