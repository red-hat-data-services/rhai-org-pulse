import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  DEFAULT_CONFIG,
  validateConfig,
  getToken,
  getTokenSource,
  loadConfig,
  runFetch,
  manualRefresh,
  startScheduler,
  stopScheduler,
  onConfigSave,
  _setFetchFn
} = require('../../server/scheduler')

const mockFetchArtifacts = vi.fn()

function makeStorage(data = {}) {
  const store = { ...data }
  return {
    readFromStorage(key) {
      return store[key] ? JSON.parse(JSON.stringify(store[key])) : null
    },
    writeToStorage(key, value) {
      store[key] = value
    },
    _store: store
  }
}

describe('scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    stopScheduler()
    _setFetchFn(mockFetchArtifacts)
    delete process.env.FEATURE_TRAFFIC_GITLAB_TOKEN
    delete process.env.GITLAB_TOKEN
  })

  afterEach(() => {
    stopScheduler()
    vi.useRealTimers()
  })

  describe('getToken / getTokenSource', () => {
    it('prefers FEATURE_TRAFFIC_GITLAB_TOKEN', () => {
      process.env.FEATURE_TRAFFIC_GITLAB_TOKEN = 'ft-token'
      process.env.GITLAB_TOKEN = 'gl-token'
      expect(getToken()).toBe('ft-token')
      expect(getTokenSource()).toBe('FEATURE_TRAFFIC_GITLAB_TOKEN')
    })

    it('falls back to GITLAB_TOKEN', () => {
      process.env.GITLAB_TOKEN = 'gl-token'
      expect(getToken()).toBe('gl-token')
      expect(getTokenSource()).toBe('GITLAB_TOKEN')
    })

    it('returns null when no token set', () => {
      expect(getToken()).toBeNull()
      expect(getTokenSource()).toBeNull()
    })
  })

  describe('loadConfig', () => {
    it('returns DEFAULT_CONFIG when no stored config', () => {
      const storage = makeStorage()
      const config = loadConfig(storage)
      expect(config).toEqual(DEFAULT_CONFIG)
    })

    it('merges stored config with defaults', () => {
      const storage = makeStorage({
        'feature-traffic/config.json': { projectPath: 'custom/path', enabled: true }
      })
      const config = loadConfig(storage)
      expect(config.projectPath).toBe('custom/path')
      expect(config.enabled).toBe(true)
      expect(config.gitlabBaseUrl).toBe('https://gitlab.com')
    })
  })

  describe('runFetch', () => {
    it('returns error when no token', async () => {
      const storage = makeStorage({
        'feature-traffic/config.json': { enabled: true }
      })
      const result = await runFetch(storage)
      expect(result.status).toBe('error')
      expect(result.message).toContain('No GitLab token')
    })

    it('skips when disabled', async () => {
      process.env.GITLAB_TOKEN = 'token'
      const storage = makeStorage({
        'feature-traffic/config.json': { enabled: false }
      })
      const result = await runFetch(storage)
      expect(result.status).toBe('skipped')
    })

    it('calls fetchArtifacts when enabled with token', async () => {
      process.env.GITLAB_TOKEN = 'token'
      mockFetchArtifacts.mockResolvedValue({ status: 'success', timestamp: new Date().toISOString() })
      const storage = makeStorage({
        'feature-traffic/config.json': { enabled: true }
      })
      const result = await runFetch(storage)
      expect(mockFetchArtifacts).toHaveBeenCalled()
      expect(result.status).toBe('success')
    })

    it('handles fetchArtifacts errors', async () => {
      process.env.GITLAB_TOKEN = 'token'
      mockFetchArtifacts.mockRejectedValue(new Error('network error'))
      const storage = makeStorage({
        'feature-traffic/config.json': { enabled: true }
      })
      const result = await runFetch(storage)
      expect(result.status).toBe('error')
      expect(result.message).toBe('network error')
      expect(storage._store['feature-traffic/last-fetch.json'].status).toBe('error')
    })

    it('writes artifact_expired to last-fetch.json', async () => {
      process.env.GITLAB_TOKEN = 'token'
      mockFetchArtifacts.mockResolvedValue({ status: 'artifact_expired', message: 'Not found' })
      const storage = makeStorage({
        'feature-traffic/config.json': { enabled: true }
      })
      await runFetch(storage)
      expect(storage._store['feature-traffic/last-fetch.json'].status).toBe('artifact_expired')
    })
  })

  describe('manualRefresh', () => {
    it('enforces cooldown after successful fetch', async () => {
      process.env.GITLAB_TOKEN = 'token'
      mockFetchArtifacts.mockResolvedValue({ status: 'success', timestamp: new Date().toISOString() })

      const storage = makeStorage({
        'feature-traffic/config.json': { enabled: true }
      })

      await manualRefresh(storage)

      const result = await manualRefresh(storage)
      expect(result.status).toBe('cooldown')
      expect(result.httpStatus).toBe(429)
      expect(result.retryAfter).toBeGreaterThan(0)
    })
  })

  describe('startScheduler / stopScheduler', () => {
    it('runs fetch on interval', async () => {
      process.env.GITLAB_TOKEN = 'token'
      mockFetchArtifacts.mockResolvedValue({ status: 'success' })

      const storage = makeStorage({
        'feature-traffic/config.json': { enabled: true }
      })

      startScheduler(storage, 1)
      expect(mockFetchArtifacts).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
      expect(mockFetchArtifacts).toHaveBeenCalledTimes(1)

      stopScheduler()
    })

    it('stopScheduler clears interval', async () => {
      process.env.GITLAB_TOKEN = 'token'
      mockFetchArtifacts.mockResolvedValue({ status: 'success' })

      const storage = makeStorage({
        'feature-traffic/config.json': { enabled: true }
      })

      startScheduler(storage, 1)
      stopScheduler()

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
      expect(mockFetchArtifacts).not.toHaveBeenCalled()
    })
  })

  describe('onConfigSave', () => {
    it('saves config and starts scheduler when enabled', async () => {
      process.env.GITLAB_TOKEN = 'token'
      const storage = makeStorage()

      await onConfigSave(storage, { enabled: true, refreshIntervalHours: 6 })

      const stored = storage._store['feature-traffic/config.json']
      expect(stored.enabled).toBe(true)
      expect(stored.refreshIntervalHours).toBe(6)

      stopScheduler()
    })

    it('triggers immediate fetch when newly enabled', async () => {
      process.env.GITLAB_TOKEN = 'token'
      mockFetchArtifacts.mockResolvedValue({ status: 'success', timestamp: new Date().toISOString() })

      const storage = makeStorage({
        'feature-traffic/config.json': { enabled: false }
      })

      const result = await onConfigSave(storage, { enabled: true })
      expect(mockFetchArtifacts).toHaveBeenCalled()
      expect(result.status).toBe('success')

      stopScheduler()
    })

    it('stops scheduler when disabled', async () => {
      process.env.GITLAB_TOKEN = 'token'
      const storage = makeStorage({
        'feature-traffic/config.json': { enabled: true }
      })

      await onConfigSave(storage, { enabled: false })
    })

    it('rejects http:// gitlabBaseUrl (SSRF prevention)', async () => {
      const storage = makeStorage()
      await expect(onConfigSave(storage, { gitlabBaseUrl: 'http://internal.svc.cluster.local' }))
        .rejects.toThrow('https://')
    })

    it('rejects invalid refreshIntervalHours', async () => {
      const storage = makeStorage()
      await expect(onConfigSave(storage, { refreshIntervalHours: 0 }))
        .rejects.toThrow('between 1 and 168')
      await expect(onConfigSave(storage, { refreshIntervalHours: 999 }))
        .rejects.toThrow('between 1 and 168')
    })
  })

  describe('validateConfig', () => {
    it('accepts valid config', () => {
      expect(() => validateConfig({
        gitlabBaseUrl: 'https://gitlab.com',
        projectPath: 'group/project',
        jobName: 'build',
        branch: 'main',
        artifactPath: 'output',
        refreshIntervalHours: 12,
        enabled: true
      })).not.toThrow()
    })

    it('rejects http:// gitlabBaseUrl', () => {
      expect(() => validateConfig({ gitlabBaseUrl: 'http://evil.com' }))
        .toThrow('https://')
    })

    it('rejects non-URL gitlabBaseUrl', () => {
      expect(() => validateConfig({ gitlabBaseUrl: 'not-a-url' }))
        .toThrow('https://')
    })

    it('rejects non-string gitlabBaseUrl', () => {
      expect(() => validateConfig({ gitlabBaseUrl: 123 }))
        .toThrow('https://')
    })

    it('rejects refreshIntervalHours out of range', () => {
      expect(() => validateConfig({ refreshIntervalHours: 0 })).toThrow()
      expect(() => validateConfig({ refreshIntervalHours: 169 })).toThrow()
      expect(() => validateConfig({ refreshIntervalHours: -1 })).toThrow()
      expect(() => validateConfig({ refreshIntervalHours: Infinity })).toThrow()
      expect(() => validateConfig({ refreshIntervalHours: NaN })).toThrow()
    })

    it('rejects non-number refreshIntervalHours', () => {
      expect(() => validateConfig({ refreshIntervalHours: 'abc' })).toThrow()
    })

    it('rejects non-string config fields', () => {
      expect(() => validateConfig({ projectPath: 123 })).toThrow('projectPath')
      expect(() => validateConfig({ jobName: true })).toThrow('jobName')
      expect(() => validateConfig({ branch: [] })).toThrow('branch')
      expect(() => validateConfig({ artifactPath: {} })).toThrow('artifactPath')
    })

    it('rejects non-boolean enabled', () => {
      expect(() => validateConfig({ enabled: 'yes' })).toThrow('enabled')
      expect(() => validateConfig({ enabled: 1 })).toThrow('enabled')
    })

    it('accepts empty config (all optional)', () => {
      expect(() => validateConfig({})).not.toThrow()
    })
  })
})
