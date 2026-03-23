import { describe, it, expect, vi } from 'vitest'
import {
  loadModulesConfig,
  seedIfMissing,
  addModule,
  updateModule,
  removeModule,
  isValidSlug,
  isValidGitUrl,
  sanitizeForPublic,
  sanitizeForAdmin
} from '../config'

function createMockStorage(data = {}) {
  const store = { ...data }
  return {
    readFromStorage: vi.fn((key) => {
      const val = store[key]
      return val ? JSON.parse(JSON.stringify(val)) : null
    }),
    writeToStorage: vi.fn((key, value) => { store[key] = JSON.parse(JSON.stringify(value)) }),
    DATA_DIR: '/app/data'
  }
}

describe('modules config', () => {
  describe('loadModulesConfig', () => {
    it('returns null when no config exists', () => {
      const storage = createMockStorage()
      expect(loadModulesConfig(storage)).toBeNull()
    })

    it('returns stored config', () => {
      const config = { modules: [{ slug: 'test', name: 'Test', type: 'built-in' }] }
      const storage = createMockStorage({ 'modules-config.json': config })
      expect(loadModulesConfig(storage)).toEqual(config)
    })
  })

  describe('seedIfMissing', () => {
    it('seeds default config when missing', () => {
      const storage = createMockStorage()
      const result = seedIfMissing(storage)
      expect(result.modules).toHaveLength(1)
      expect(result.modules[0].slug).toBe('team-tracker')
      expect(storage.writeToStorage).toHaveBeenCalled()
    })

    it('does not overwrite existing config', () => {
      const config = { modules: [{ slug: 'custom', name: 'Custom', type: 'built-in' }] }
      const storage = createMockStorage({ 'modules-config.json': config })
      const result = seedIfMissing(storage)
      expect(result.modules[0].slug).toBe('custom')
      expect(storage.writeToStorage).not.toHaveBeenCalled()
    })
  })

  describe('isValidSlug', () => {
    it('accepts valid slugs', () => {
      expect(isValidSlug('my-module')).toBe(true)
      expect(isValidSlug('test123')).toBe(true)
      expect(isValidSlug('a')).toBe(true)
    })

    it('rejects invalid slugs', () => {
      expect(isValidSlug('')).toBe(false)
      expect(isValidSlug('My Module')).toBe(false)
      expect(isValidSlug('has_underscore')).toBe(false)
      expect(isValidSlug('-starts-dash')).toBe(false)
      expect(isValidSlug('ends-dash-')).toBe(false)
      expect(isValidSlug('UPPER')).toBe(false)
      expect(isValidSlug(null)).toBe(false)
    })
  })

  describe('isValidGitUrl', () => {
    it('accepts HTTPS URLs', () => {
      expect(isValidGitUrl('https://github.com/user/repo')).toBe(true)
      expect(isValidGitUrl('https://gitlab.com/user/repo.git')).toBe(true)
    })

    it('rejects non-HTTPS URLs', () => {
      expect(isValidGitUrl('http://github.com/repo')).toBe(false)
      expect(isValidGitUrl('ssh://git@github.com/repo')).toBe(false)
      expect(isValidGitUrl('file:///etc/passwd')).toBe(false)
      expect(isValidGitUrl('git://github.com/repo')).toBe(false)
      expect(isValidGitUrl('')).toBe(false)
      expect(isValidGitUrl(null)).toBe(false)
    })
  })

  describe('addModule', () => {
    it('adds a built-in module', () => {
      const storage = createMockStorage({ 'modules-config.json': { modules: [] } })
      const result = addModule(storage, {
        name: 'Test',
        slug: 'test',
        type: 'built-in',
        description: 'A test module'
      })
      expect(result.module.slug).toBe('test')
      expect(result.error).toBeUndefined()
    })

    it('adds a git-static module', () => {
      const storage = createMockStorage({ 'modules-config.json': { modules: [] } })
      const result = addModule(storage, {
        name: 'Dashboard',
        slug: 'my-dashboard',
        type: 'git-static',
        gitUrl: 'https://github.com/user/repo',
        gitBranch: 'main'
      })
      expect(result.module.slug).toBe('my-dashboard')
      expect(result.module.gitUrl).toBe('https://github.com/user/repo')
      expect(result.module.gitBranch).toBe('main')
      expect(result.module.lastSyncAt).toBeNull()
    })

    it('rejects duplicate slugs', () => {
      const storage = createMockStorage({
        'modules-config.json': { modules: [{ slug: 'test', name: 'Test', type: 'built-in' }] }
      })
      const result = addModule(storage, {
        name: 'Test 2',
        slug: 'test',
        type: 'built-in'
      })
      expect(result.error).toContain('already in use')
    })

    it('rejects invalid slug format', () => {
      const storage = createMockStorage({ 'modules-config.json': { modules: [] } })
      const result = addModule(storage, {
        name: 'Test',
        slug: 'Invalid Slug',
        type: 'built-in'
      })
      expect(result.error).toContain('slug')
    })

    it('rejects git-static without HTTPS URL', () => {
      const storage = createMockStorage({ 'modules-config.json': { modules: [] } })
      const result = addModule(storage, {
        name: 'Test',
        slug: 'test',
        type: 'git-static',
        gitUrl: 'file:///etc/passwd'
      })
      expect(result.error).toContain('HTTPS')
    })

    it('rejects gitSubdirectory with path traversal', () => {
      const storage = createMockStorage({ 'modules-config.json': { modules: [] } })
      const result = addModule(storage, {
        name: 'Test',
        slug: 'test',
        type: 'git-static',
        gitUrl: 'https://github.com/user/repo',
        gitSubdirectory: '../../etc'
      })
      expect(result.error).toContain('..')
    })
  })

  describe('updateModule', () => {
    it('updates module fields', () => {
      const storage = createMockStorage({
        'modules-config.json': { modules: [{ slug: 'test', name: 'Test', type: 'built-in', description: '', icon: 'box', order: 0 }] }
      })
      const result = updateModule(storage, 'test', { name: 'Updated Test', description: 'New desc' })
      expect(result.module.name).toBe('Updated Test')
      expect(result.module.description).toBe('New desc')
    })

    it('returns error for non-existent module', () => {
      const storage = createMockStorage({ 'modules-config.json': { modules: [] } })
      const result = updateModule(storage, 'nonexistent', { name: 'Test' })
      expect(result.error).toContain('not found')
    })
  })

  describe('removeModule', () => {
    it('removes a module', () => {
      const storage = createMockStorage({
        'modules-config.json': { modules: [{ slug: 'test', name: 'Test', type: 'built-in' }] }
      })
      const result = removeModule(storage, 'test')
      expect(result.removed.slug).toBe('test')
    })

    it('returns error for non-existent module', () => {
      const storage = createMockStorage({ 'modules-config.json': { modules: [] } })
      const result = removeModule(storage, 'nonexistent')
      expect(result.error).toContain('not found')
    })
  })

  describe('sanitizeForPublic', () => {
    it('strips git fields', () => {
      const mod = {
        name: 'Test',
        slug: 'test',
        type: 'git-static',
        description: 'desc',
        icon: 'box',
        order: 1,
        gitUrl: 'https://github.com/user/repo',
        gitToken: 'secret-token',
        gitBranch: 'main',
        gitSubdirectory: '/',
        lastSyncAt: '2024-01-01'
      }
      const result = sanitizeForPublic(mod)
      expect(result.gitUrl).toBeUndefined()
      expect(result.gitToken).toBeUndefined()
      expect(result.gitBranch).toBeUndefined()
      expect(result.lastSyncAt).toBeUndefined()
      expect(result.name).toBe('Test')
      expect(result.slug).toBe('test')
    })
  })

  describe('sanitizeForAdmin', () => {
    it('masks token when present', () => {
      const mod = {
        name: 'Test',
        slug: 'test',
        type: 'git-static',
        gitToken: 'secret-token'
      }
      const result = sanitizeForAdmin(mod)
      expect(result.gitToken).toBe('••••••••')
    })

    it('keeps null token as null', () => {
      const mod = {
        name: 'Test',
        slug: 'test',
        type: 'git-static',
        gitToken: null
      }
      const result = sanitizeForAdmin(mod)
      expect(result.gitToken).toBeNull()
    })
  })
})
