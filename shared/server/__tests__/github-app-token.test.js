import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We need to test the module in isolation, so we re-require it with fresh state
// by using vi.resetModules() between tests.

function loadFreshModule() {
  vi.resetModules()
  return require('../github-app-token')
}

describe('github-app-token', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Clear relevant env vars
    delete process.env.GITHUB_APP_ID
    delete process.env.GITHUB_APP_PRIVATE_KEY
    delete process.env.GITHUB_APP_PRIVATE_KEY_FILE
    delete process.env.GITHUB_APP_INSTALLATION_ID
    delete process.env.GITHUB_TOKEN
  })

  afterEach(() => {
    // Restore env
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('GITHUB_APP_') || key === 'GITHUB_TOKEN') {
        delete process.env[key]
      }
    }
    Object.assign(process.env, originalEnv)
  })

  describe('init() with no env vars', () => {
    it('is a no-op — isAppMode returns false', async () => {
      const mod = loadFreshModule()
      await mod.init()
      expect(mod.isAppMode()).toBe(false)
      expect(mod.getTokenSync()).toBeNull()
      mod.shutdown()
    })
  })

  describe('init() with missing private key', () => {
    it('logs warning and stays in PAT fallback mode', async () => {
      const mod = loadFreshModule()
      process.env.GITHUB_APP_ID = '12345'
      process.env.GITHUB_APP_INSTALLATION_ID = '67890'
      // No private key set

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await mod.init()
      expect(mod.isAppMode()).toBe(false)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('no private key found')
      )
      warnSpy.mockRestore()
      mod.shutdown()
    })
  })

  describe('init() with App credentials but API failure', () => {
    it('falls back to GITHUB_TOKEN if available', async () => {
      const mod = loadFreshModule()
      process.env.GITHUB_APP_ID = '12345'
      process.env.GITHUB_APP_INSTALLATION_ID = '67890'
      process.env.GITHUB_APP_PRIVATE_KEY = [
        '-----BEGIN RSA PRIVATE KEY-----',
        'MIIBogIBAAJBALRiMLAHudeSA/x3hB2f+2NRkJLA5gRcHE0tP7gVFLUb5Cqt0oTn',
        '-----END RSA PRIVATE KEY-----'
      ].join('\n')
      process.env.GITHUB_TOKEN = 'ghp_fallback_pat'

      // Mock fetch to simulate API failure
      const originalFetch = global.fetch
      global.fetch = vi.fn().mockRejectedValue(new Error('network error'))

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await mod.init()
      expect(mod.isAppMode()).toBe(false)
      expect(mod.getTokenSync()).toBeNull()
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Falling back to GITHUB_TOKEN PAT')
      )

      global.fetch = originalFetch
      errorSpy.mockRestore()
      warnSpy.mockRestore()
      mod.shutdown()
    })
  })

  describe('init() with successful App auth', () => {
    it('generates a token and enters App mode', async () => {
      const mod = loadFreshModule()
      process.env.GITHUB_APP_ID = '12345'
      process.env.GITHUB_APP_INSTALLATION_ID = '67890'
      process.env.GITHUB_APP_PRIVATE_KEY = require('crypto')
        .generateKeyPairSync('rsa', { modulusLength: 2048 })
        .privateKey.export({ type: 'pkcs1', format: 'pem' })

      const originalFetch = global.fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          token: 'ghs_test_installation_token',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        })
      })

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      await mod.init()

      expect(mod.isAppMode()).toBe(true)
      expect(mod.getTokenSync()).toBe('ghs_test_installation_token')

      // Verify the JWT was sent to the correct endpoint
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/app/installations/67890/access_tokens',
        expect.objectContaining({ method: 'POST' })
      )

      global.fetch = originalFetch
      logSpy.mockRestore()
      mod.shutdown()
    })
  })

  describe('shutdown()', () => {
    it('clears state', async () => {
      const mod = loadFreshModule()
      process.env.GITHUB_APP_ID = '12345'
      process.env.GITHUB_APP_INSTALLATION_ID = '67890'
      process.env.GITHUB_APP_PRIVATE_KEY = require('crypto')
        .generateKeyPairSync('rsa', { modulusLength: 2048 })
        .privateKey.export({ type: 'pkcs1', format: 'pem' })

      const originalFetch = global.fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          token: 'ghs_test_token',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        })
      })

      vi.spyOn(console, 'log').mockImplementation(() => {})
      await mod.init()
      expect(mod.isAppMode()).toBe(true)

      mod.shutdown()
      expect(mod.isAppMode()).toBe(false)
      expect(mod.getTokenSync()).toBeNull()

      global.fetch = originalFetch
      vi.restoreAllMocks()
    })
  })

  describe('Object.freeze + getter interaction', () => {
    it('getter still executes on a frozen object', () => {
      let value = 'token-1'
      const obj = {}
      Object.defineProperty(obj, 'GITHUB_TOKEN', {
        get: () => value,
        enumerable: true,
        configurable: false
      })
      Object.freeze(obj)

      expect(obj.GITHUB_TOKEN).toBe('token-1')
      value = 'token-2'
      expect(obj.GITHUB_TOKEN).toBe('token-2')
    })

    it('getter value is captured by spread operator', () => {
      let value = 'token-1'
      const obj = {}
      Object.defineProperty(obj, 'GITHUB_TOKEN', {
        get: () => value,
        enumerable: true,
        configurable: false
      })
      Object.freeze(obj)

      const spread = { ...obj }
      value = 'token-2'

      // Spread captured the value at spread time
      expect(spread.GITHUB_TOKEN).toBe('token-1')
      // Original getter still returns updated value
      expect(obj.GITHUB_TOKEN).toBe('token-2')
    })

    it('getter is enumerable in Object.keys()', () => {
      const obj = { OTHER: 'val' }
      Object.defineProperty(obj, 'GITHUB_TOKEN', {
        get: () => 'tok',
        enumerable: true,
        configurable: false
      })
      Object.freeze(obj)

      expect(Object.keys(obj)).toContain('GITHUB_TOKEN')
      expect(Object.keys(obj)).toContain('OTHER')
    })
  })
})
