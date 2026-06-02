import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { SecretRegistry } = require('../secret-registry')

const PLATFORM_GROUPS = [
  {
    id: 'jira',
    label: 'Jira Cloud',
    description: 'Jira credentials',
    secrets: [
      { key: 'JIRA_EMAIL', description: 'Jira email', required: true },
      { key: 'JIRA_TOKEN', description: 'Jira token', required: true },
    ]
  },
  {
    id: 'github',
    label: 'GitHub',
    description: 'GitHub access',
    secrets: [
      { key: 'GITHUB_TOKEN', description: 'GitHub PAT', required: false }
    ]
  }
]

describe('SecretRegistry', () => {
  let originalEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('constructor', () => {
    it('accepts platform secret groups', () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      expect(registry.getPlatformGroupIds()).toEqual(['jira', 'github'])
    })
  })

  describe('registerModuleSecrets', () => {
    it('registers module declarations', () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      registry.registerModuleSecrets('releases', {
        platform: ['jira'],
        module: [
          { key: 'PRODUCT_PAGES_TOKEN', description: 'PP token', required: false }
        ]
      })
      // Verify via getStatus
      const status = registry.getStatus()
      expect(status.modules.releases).toBeDefined()
      expect(status.modules.releases.platform).toEqual(['jira'])
      expect(status.modules.releases.secrets).toHaveLength(1)
    })

    it('ignores null/undefined declarations', () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      registry.registerModuleSecrets('empty', null)
      registry.registerModuleSecrets('undef', undefined)
      const status = registry.getStatus()
      expect(status.modules.empty).toBeUndefined()
      expect(status.modules.undef).toBeUndefined()
    })

    it('warns on unknown platform group reference', () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      registry.registerModuleSecrets('test', { platform: ['nonexistent'] })
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('nonexistent'))
      spy.mockRestore()
    })
  })

  describe('resolve', () => {
    it('reads process.env and caches values', () => {
      process.env.JIRA_EMAIL = 'test@test.com'
      process.env.JIRA_TOKEN = 'token123'

      const registry = new SecretRegistry(PLATFORM_GROUPS)
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      registry.resolve()
      spy.mockRestore()

      const secrets = registry.getModuleSecrets('nonexistent')
      expect(Object.keys(secrets)).toHaveLength(0)
    })

    it('logs structured status on resolve', () => {
      process.env.JIRA_EMAIL = 'test@test.com'
      process.env.JIRA_TOKEN = 'token123'
      delete process.env.GITHUB_TOKEN

      const registry = new SecretRegistry(PLATFORM_GROUPS)
      registry.registerModuleSecrets('team-tracker', { platform: ['jira', 'github'] })

      const logs = []
      const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
        logs.push(args.join(' '))
      })
      registry.resolve()
      spy.mockRestore()

      const platformJiraLog = logs.find(l => l.includes('platform:jira'))
      expect(platformJiraLog).toContain('JIRA_EMAIL=configured')
      expect(platformJiraLog).toContain('JIRA_TOKEN=configured')

      const platformGithubLog = logs.find(l => l.includes('platform:github'))
      expect(platformGithubLog).toContain('GITHUB_TOKEN=not-configured(optional)')

      const summaryLog = logs.find(l => l.includes('summary'))
      expect(summaryLog).toContain('required=2/2')
    })

    it('logs MISSING for missing required secrets', () => {
      // Neither JIRA_EMAIL nor JIRA_TOKEN set
      delete process.env.JIRA_EMAIL
      delete process.env.JIRA_TOKEN

      const registry = new SecretRegistry(PLATFORM_GROUPS)
      const logs = []
      const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
        logs.push(args.join(' '))
      })
      registry.resolve()
      spy.mockRestore()

      const jiraLog = logs.find(l => l.includes('platform:jira'))
      expect(jiraLog).toContain('JIRA_EMAIL=MISSING')
      expect(jiraLog).toContain('JIRA_TOKEN=MISSING')
    })

    it('uses default values when env var is not set', () => {
      const groups = [
        {
          id: 'google',
          label: 'Google',
          description: 'Google SA',
          secrets: [
            { key: 'GOOGLE_SA_KEY', description: 'SA key path', required: false, default: '/etc/sa.json' }
          ]
        }
      ]
      delete process.env.GOOGLE_SA_KEY

      const registry = new SecretRegistry(groups)
      registry.registerModuleSecrets('test', { platform: ['google'] })

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      registry.resolve()
      spy.mockRestore()

      const secrets = registry.getModuleSecrets('test')
      expect(secrets.GOOGLE_SA_KEY).toBe('/etc/sa.json')
    })
  })

  describe('getModuleSecrets', () => {
    it('returns only secrets declared by the module', () => {
      process.env.JIRA_EMAIL = 'test@test.com'
      process.env.JIRA_TOKEN = 'token123'
      process.env.GITHUB_TOKEN = 'gh-token'
      process.env.PRODUCT_PAGES_TOKEN = 'pp-token'

      const registry = new SecretRegistry(PLATFORM_GROUPS)
      registry.registerModuleSecrets('releases', {
        platform: ['jira'],
        module: [
          { key: 'PRODUCT_PAGES_TOKEN', description: 'PP token', required: false }
        ]
      })
      registry.registerModuleSecrets('team-tracker', {
        platform: ['jira', 'github']
      })

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      registry.resolve()
      spy.mockRestore()

      const releasesSecrets = registry.getModuleSecrets('releases')
      expect(releasesSecrets.JIRA_EMAIL).toBe('test@test.com')
      expect(releasesSecrets.JIRA_TOKEN).toBe('token123')
      expect(releasesSecrets.PRODUCT_PAGES_TOKEN).toBe('pp-token')
      expect(releasesSecrets.GITHUB_TOKEN).toBeUndefined()

      const ttSecrets = registry.getModuleSecrets('team-tracker')
      expect(ttSecrets.JIRA_EMAIL).toBe('test@test.com')
      expect(ttSecrets.GITHUB_TOKEN).toBe('gh-token')
      expect(ttSecrets.PRODUCT_PAGES_TOKEN).toBeUndefined()
    })

    it('returns a frozen object', () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      registry.registerModuleSecrets('test', { platform: ['jira'] })

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      registry.resolve()
      spy.mockRestore()

      const secrets = registry.getModuleSecrets('test')
      expect(Object.isFrozen(secrets)).toBe(true)
    })

    it('returns empty frozen object for unknown module', () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      const secrets = registry.getModuleSecrets('nonexistent')
      expect(secrets).toEqual({})
      expect(Object.isFrozen(secrets)).toBe(true)
    })
  })

  describe('resolveSecret (dynamic)', () => {
    it('reads process.env at call time', () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      process.env.DYNAMIC_TOKEN = 'dynamic-value'

      const value = registry.resolveSecret('DYNAMIC_TOKEN')
      expect(value).toBe('dynamic-value')
    })

    it('returns undefined for missing env var', () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      delete process.env.NONEXISTENT_VAR

      const value = registry.resolveSecret('NONEXISTENT_VAR')
      expect(value).toBeUndefined()
    })

    it('tracks dynamic access for diagnostics', () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      process.env.TRACKED_TOKEN = 'val'

      registry.resolveSecret('TRACKED_TOKEN')
      registry.resolveSecret('TRACKED_TOKEN')
      registry.resolveSecret('OTHER_TOKEN')

      const status = registry.getStatus()
      expect(status.dynamicAccess.TRACKED_TOKEN).toBe(2)
      expect(status.dynamicAccess.OTHER_TOKEN).toBe(1)
    })
  })

  describe('resolveSecret isolation warning', () => {
    it('warns when a module resolves a key outside its declarations', () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      registry.registerModuleSecrets('releases', {
        platform: ['jira'],
        module: [{ key: 'PP_TOKEN', description: 'PP', required: false }]
      })

      process.env.GITHUB_TOKEN = 'gh-token'
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      registry.resolveSecret('GITHUB_TOKEN', 'releases')
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('undeclared secret'))
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('GITHUB_TOKEN'))
      spy.mockRestore()
    })

    it('does not warn for keys covered by platform groups', () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      registry.registerModuleSecrets('team-tracker', { platform: ['jira'] })

      process.env.JIRA_TOKEN = 'token'
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      registry.resolveSecret('JIRA_TOKEN', 'team-tracker')
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('does not warn for keys matching dynamic pattern', () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      registry.registerModuleSecrets('team-tracker', {
        platform: [],
        dynamic: { pattern: 'GITLAB_*_TOKEN' }
      })

      process.env.GITLAB_INTERNAL_TOKEN = 'tok'
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      registry.resolveSecret('GITLAB_INTERNAL_TOKEN', 'team-tracker')
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('does not warn when no caller slug is provided', () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      process.env.ANYTHING = 'val'
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      registry.resolveSecret('ANYTHING')
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })
  })

  describe('registerValidator / validateAll', () => {
    it('throws when fn is not a function', () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      expect(() => registry.registerValidator('KEY', 'not-a-function'))
        .toThrow('expected a function')
      expect(() => registry.registerValidator('KEY', null))
        .toThrow('expected a function')
    })

    it('runs registered validators and returns results', async () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)

      registry.registerValidator('JIRA_TOKEN', async () => ({
        valid: true,
        message: 'Connection OK'
      }))
      registry.registerValidator('GITHUB_TOKEN', async () => ({
        valid: false,
        message: 'Invalid token'
      }))

      const results = await registry.validateAll()
      expect(results.JIRA_TOKEN).toEqual({ valid: true, message: 'Connection OK' })
      expect(results.GITHUB_TOKEN).toEqual({ valid: false, message: 'Invalid token' })
    })

    it('handles validator errors gracefully', async () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      registry.registerValidator('BAD_KEY', async () => {
        throw new Error('Connection refused')
      })

      const results = await registry.validateAll()
      expect(results.BAD_KEY.valid).toBe(false)
      expect(results.BAD_KEY.message).toContain('Connection refused')
    })

    it('truncates long error messages to prevent secret leakage', async () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      const longMessage = 'Invalid token: sk-' + 'x'.repeat(300)
      registry.registerValidator('LEAK_KEY', async () => {
        throw new Error(longMessage)
      })

      const results = await registry.validateAll()
      expect(results.LEAK_KEY.message.length).toBeLessThanOrEqual(214) // 200 + '...(truncated)'
      expect(results.LEAK_KEY.message).toContain('...(truncated)')
    })

    it('truncates long success messages too', async () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      registry.registerValidator('LONG_OK', async () => ({
        valid: true,
        message: 'A'.repeat(300)
      }))

      const results = await registry.validateAll()
      expect(results.LONG_OK.message.length).toBeLessThanOrEqual(214)
      expect(results.LONG_OK.valid).toBe(true)
    })
  })

  describe('validateKeys', () => {
    it('runs only validators for specified keys', async () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)

      registry.registerValidator('JIRA_TOKEN', async () => ({
        valid: true,
        message: 'Jira OK'
      }))
      registry.registerValidator('GITHUB_TOKEN', async () => ({
        valid: false,
        message: 'GitHub failed'
      }))

      const results = await registry.validateKeys(['JIRA_TOKEN'])
      expect(results.JIRA_TOKEN).toEqual({ valid: true, message: 'Jira OK' })
      expect(results.GITHUB_TOKEN).toBeUndefined()
    })

    it('returns empty object when no keys match', async () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      registry.registerValidator('JIRA_TOKEN', async () => ({ valid: true, message: 'OK' }))

      const results = await registry.validateKeys(['NONEXISTENT_KEY'])
      expect(results).toEqual({})
    })

    it('handles validator errors gracefully', async () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      registry.registerValidator('BAD_KEY', async () => {
        throw new Error('Connection refused')
      })

      const results = await registry.validateKeys(['BAD_KEY'])
      expect(results.BAD_KEY.valid).toBe(false)
      expect(results.BAD_KEY.message).toContain('Connection refused')
    })
  })

  describe('getStatus', () => {
    it('returns structured status without secret values', () => {
      process.env.JIRA_EMAIL = 'test@test.com'
      process.env.JIRA_TOKEN = 'supersecret'

      const registry = new SecretRegistry(PLATFORM_GROUPS)
      registry.registerModuleSecrets('releases', {
        platform: ['jira'],
        module: [
          { key: 'PP_TOKEN', description: 'PP', required: false, group: 'pp-auth' },
          { key: 'PP_CLIENT', description: 'PP client', required: false, group: 'pp-auth', exclusive: true }
        ]
      })

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      registry.resolve()
      spy.mockRestore()

      const status = registry.getStatus()

      // Platform groups present
      expect(status.platform.jira).toBeDefined()
      expect(status.platform.jira.secrets[0].configured).toBe(true)

      // Module secrets present
      expect(status.modules.releases.secrets).toHaveLength(2)

      // Exclusive groups
      expect(status.modules.releases.exclusiveGroups['pp-auth']).toBeDefined()

      // Summary
      expect(status.summary.required.total).toBe(2)

      // No actual values leaked
      const json = JSON.stringify(status)
      expect(json).not.toContain('supersecret')
      expect(json).not.toContain('test@test.com')
    })
  })

  describe('getModuleStatus', () => {
    it('returns per-module status', () => {
      process.env.JIRA_EMAIL = 'test@test.com'
      process.env.JIRA_TOKEN = 'token'

      const registry = new SecretRegistry(PLATFORM_GROUPS)
      registry.registerModuleSecrets('team-tracker', {
        platform: ['jira', 'github'],
        module: [
          { key: 'SPECIAL_TOKEN', description: 'Special', required: false }
        ]
      })

      const status = registry.getModuleStatus('team-tracker')
      expect(status.declared).toBe(true)
      expect(status.platform.jira).toHaveLength(2)
      expect(status.platform.jira[0].configured).toBe(true)
      expect(status.module).toHaveLength(1)
    })

    it('returns { declared: false } for unknown module', () => {
      const registry = new SecretRegistry(PLATFORM_GROUPS)
      const status = registry.getModuleStatus('unknown')
      expect(status).toEqual({ declared: false })
    })
  })

  describe('module isolation', () => {
    it('prevents cross-module secret access', () => {
      process.env.JIRA_EMAIL = 'test@test.com'
      process.env.JIRA_TOKEN = 'token'
      process.env.SECRET_A = 'a-val'
      process.env.SECRET_B = 'b-val'

      const registry = new SecretRegistry(PLATFORM_GROUPS)
      registry.registerModuleSecrets('module-a', {
        platform: ['jira'],
        module: [{ key: 'SECRET_A', description: 'A secret', required: false }]
      })
      registry.registerModuleSecrets('module-b', {
        module: [{ key: 'SECRET_B', description: 'B secret', required: false }]
      })

      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      registry.resolve()
      spy.mockRestore()

      const aSecrets = registry.getModuleSecrets('module-a')
      const bSecrets = registry.getModuleSecrets('module-b')

      // Module A gets JIRA + SECRET_A, not SECRET_B
      expect(aSecrets.JIRA_EMAIL).toBe('test@test.com')
      expect(aSecrets.SECRET_A).toBe('a-val')
      expect(aSecrets.SECRET_B).toBeUndefined()

      // Module B gets SECRET_B only, no JIRA
      expect(bSecrets.SECRET_B).toBe('b-val')
      expect(bSecrets.JIRA_EMAIL).toBeUndefined()
      expect(bSecrets.SECRET_A).toBeUndefined()
    })
  })
})
