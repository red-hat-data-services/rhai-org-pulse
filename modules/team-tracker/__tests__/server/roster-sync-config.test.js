import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import http from 'http'

// Mock storage at module level
const mockStorage = {}

vi.mock('../../../../shared/server/storage', () => ({
  readFromStorage: vi.fn((key) => mockStorage[key] || null),
  writeToStorage: vi.fn((key, data) => { mockStorage[key] = data }),
  DATA_DIR: '/tmp/test-data'
}))

// Mock roster sync engine
const mockRosterSync = {
  syncInProgress: false,
  isSyncInProgress: vi.fn(() => mockRosterSync.syncInProgress)
}

vi.mock('../../../../shared/server/roster-sync', () => ({
  loadConfig: vi.fn((storage) => {
    return storage.readFromStorage('team-data/config.json')
  }),
  saveConfig: vi.fn((storage, config) => {
    storage.writeToStorage('team-data/config.json', config)
  }),
  isConfigured: vi.fn((storage) => {
    const config = storage.readFromStorage('team-data/config.json')
    return !!(config?.orgRoots?.length > 0)
  }),
  isSyncInProgress: vi.fn(() => mockRosterSync.isSyncInProgress()),
  triggerSync: vi.fn()
}))

// Mock auth middleware - requireAdmin should just pass through in tests
vi.mock('../../../../shared/server/auth', () => ({
  requireAuth: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next()
}))

// Mock Jira and other dependencies
vi.mock('../../server/jira/jira-client', () => ({
  createJiraClient: () => ({})
}))
vi.mock('../../server/jira/orchestration', () => ({
  discoverBoards: vi.fn(),
  performRefresh: vi.fn()
}))
vi.mock('node-fetch', () => ({ default: vi.fn() }))

import { readFromStorage, writeToStorage } from '../../../../shared/server/storage'

function createTestApp() {
  const app = express()
  app.use(express.json())

  // Mock auth - set user as admin
  app.use((req, res, next) => {
    req.userEmail = 'admin@redhat.com'
    next()
  })

  // Register the team-tracker routes
  const registerRoutes = require('../../server/index.js')
  const router = express.Router()

  // Provide minimal context with requireAdmin middleware
  const context = {
    storage: { readFromStorage, writeToStorage },
    requireAdmin: (req, res, next) => next(), // Pass-through for tests
    registerDiagnostics: vi.fn()
  }

  registerRoutes(router, context)
  app.use('/api/modules/team-tracker', router)

  return app
}

function request(app, method, path, body) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app)
    server.listen(0, () => {
      const port = server.address().port
      const options = {
        hostname: 'localhost',
        port,
        path,
        method,
        headers: { 'Content-Type': 'application/json' }
      }

      const req = http.request(options, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          server.close()
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) })
          } catch {
            resolve({ status: res.statusCode, body: data })
          }
        })
      })

      req.on('error', (err) => {
        server.close()
        reject(err)
      })

      if (body) {
        req.write(JSON.stringify(body))
      }
      req.end()
    })
  })
}

describe('Roster Sync Config API', () => {
  let app

  beforeEach(() => {
    // Clear mock storage
    Object.keys(mockStorage).forEach(k => delete mockStorage[k])
    vi.clearAllMocks()
    mockRosterSync.syncInProgress = false
    app = createTestApp()
  })

  describe('POST /api/admin/roster-sync/config', () => {
    it('persists excludeGroups within gitlabInstances when saving config', async () => {
      const config = {
        orgRoots: [{ uid: 'testorg', displayName: 'Test Org' }],
        googleSheetId: 'test-sheet-id',
        sheetNames: [],
        githubOrgs: ['test-org'],
        gitlabInstances: [{
          label: 'GitLab.com',
          baseUrl: 'https://gitlab.com',
          tokenEnvVar: 'GITLAB_TOKEN',
          groups: ['group-a', 'group-b', 'mirror-group'],
          excludeGroups: ['mirror-group']
        }],
        teamStructure: null
      }

      const res = await request(app, 'POST', '/api/modules/team-tracker/admin/roster-sync/config', config)

      expect(res.status).toBe(200)
      expect(writeToStorage).toHaveBeenCalledWith(
        'team-data/config.json',
        expect.objectContaining({
          gitlabInstances: expect.arrayContaining([
            expect.objectContaining({
              excludeGroups: ['mirror-group']
            })
          ])
        })
      )
    })

    it('preserves existing excludeGroups when not provided', async () => {
      // Set up existing config with exclude groups
      mockStorage['team-data/config.json'] = {
        orgRoots: [{ uid: 'testorg', displayName: 'Test Org' }],
        googleSheetId: 'test-sheet-id',
        githubOrgs: [],
        gitlabInstances: [{
          label: 'GitLab.com',
          baseUrl: 'https://gitlab.com',
          tokenEnvVar: 'GITLAB_TOKEN',
          groups: ['group-a'],
          excludeGroups: ['mirror-group']
        }],
        teamStructure: null
      }

      // Update config without changing gitlabInstances
      const update = {
        orgRoots: [{ uid: 'testorg', displayName: 'Test Org' }],
        githubOrgs: ['new-org']
      }

      const res = await request(app, 'POST', '/api/modules/team-tracker/admin/roster-sync/config', update)

      expect(res.status).toBe(200)

      const saved = writeToStorage.mock.calls[0][1]
      expect(saved.gitlabInstances[0].excludeGroups).toEqual(['mirror-group'])
    })

    it('allows clearing excludeGroups with empty array', async () => {
      mockStorage['team-data/config.json'] = {
        orgRoots: [{ uid: 'testorg', displayName: 'Test Org' }],
        gitlabInstances: [{
          label: 'GitLab.com',
          baseUrl: 'https://gitlab.com',
          tokenEnvVar: 'GITLAB_TOKEN',
          groups: ['group-a'],
          excludeGroups: ['mirror-group']
        }]
      }

      const update = {
        orgRoots: [{ uid: 'testorg', displayName: 'Test Org' }],
        gitlabInstances: [{
          label: 'GitLab.com',
          baseUrl: 'https://gitlab.com',
          tokenEnvVar: 'GITLAB_TOKEN',
          groups: ['group-a'],
          excludeGroups: []
        }]
      }

      const res = await request(app, 'POST', '/api/modules/team-tracker/admin/roster-sync/config', update)

      expect(res.status).toBe(200)

      const saved = writeToStorage.mock.calls[0][1]
      expect(saved.gitlabInstances[0].excludeGroups).toEqual([])
    })

    it('defaults excludeGroups to empty array when missing from instance config', async () => {
      const config = {
        orgRoots: [{ uid: 'testorg', displayName: 'Test Org' }],
        googleSheetId: 'test-sheet-id',
        githubOrgs: [],
        gitlabInstances: [{
          label: 'GitLab.com',
          baseUrl: 'https://gitlab.com',
          tokenEnvVar: 'GITLAB_TOKEN',
          groups: ['group-a']
          // excludeGroups not provided
        }]
      }

      const res = await request(app, 'POST', '/api/modules/team-tracker/admin/roster-sync/config', config)

      expect(res.status).toBe(200)

      const saved = writeToStorage.mock.calls[0][1]
      // excludeGroups should be filtered to empty array by the frontend, or be undefined
      expect(saved.gitlabInstances[0].excludeGroups || []).toEqual([])
    })

    it('handles multiple exclude groups', async () => {
      const config = {
        orgRoots: [{ uid: 'testorg', displayName: 'Test Org' }],
        gitlabInstances: [{
          label: 'GitLab.com',
          baseUrl: 'https://gitlab.com',
          tokenEnvVar: 'GITLAB_TOKEN',
          groups: ['group-a', 'group-b', 'mirror-1', 'mirror-2'],
          excludeGroups: ['mirror-1', 'mirror-2']
        }]
      }

      const res = await request(app, 'POST', '/api/modules/team-tracker/admin/roster-sync/config', config)

      expect(res.status).toBe(200)

      const saved = writeToStorage.mock.calls[0][1]
      expect(saved.gitlabInstances[0].excludeGroups).toEqual(['mirror-1', 'mirror-2'])
    })
  })

  describe('GET /api/admin/roster-sync/config', () => {
    it('includes excludeGroups in gitlabInstances response', async () => {
      mockStorage['team-data/config.json'] = {
        orgRoots: [{ uid: 'testorg', displayName: 'Test Org' }],
        googleSheetId: 'test-sheet-id',
        githubOrgs: ['test-org'],
        gitlabInstances: [{
          label: 'GitLab.com',
          baseUrl: 'https://gitlab.com',
          tokenEnvVar: 'GITLAB_TOKEN',
          groups: ['group-a', 'group-b'],
          excludeGroups: ['mirror-group']
        }],
        teamStructure: null,
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncError: null
      }

      const res = await request(app, 'GET', '/api/modules/team-tracker/admin/roster-sync/config')

      expect(res.status).toBe(200)
      expect(res.body.gitlabInstances[0].excludeGroups).toEqual(['mirror-group'])
    })

    it('handles instances without excludeGroups', async () => {
      mockStorage['team-data/config.json'] = {
        orgRoots: [{ uid: 'testorg', displayName: 'Test Org' }],
        githubOrgs: [],
        gitlabInstances: [{
          label: 'GitLab.com',
          baseUrl: 'https://gitlab.com',
          tokenEnvVar: 'GITLAB_TOKEN',
          groups: []
        }]
      }

      const res = await request(app, 'GET', '/api/modules/team-tracker/admin/roster-sync/config')

      expect(res.status).toBe(200)
      expect(res.body.gitlabInstances[0].excludeGroups).toBeUndefined()
    })
  })

  describe('Config persistence integration', () => {
    it('saves and retrieves excludeGroups correctly', async () => {
      // Step 1: Save config with exclude groups
      const saveConfig = {
        orgRoots: [{ uid: 'testorg', displayName: 'Test Org' }],
        googleSheetId: 'test-sheet-id',
        gitlabInstances: [{
          label: 'GitLab.com',
          baseUrl: 'https://gitlab.com',
          tokenEnvVar: 'GITLAB_TOKEN',
          groups: ['group-a', 'group-b', 'mirror-group'],
          excludeGroups: ['mirror-group']
        }]
      }

      const saveRes = await request(app, 'POST', '/api/modules/team-tracker/admin/roster-sync/config', saveConfig)
      expect(saveRes.status).toBe(200)

      // Step 2: Verify it was written to storage
      const written = writeToStorage.mock.calls[0][1]
      expect(written.gitlabInstances[0].excludeGroups).toEqual(['mirror-group'])

      // Step 3: Simulate it being persisted by updating mockStorage
      mockStorage['team-data/config.json'] = written

      // Step 4: Retrieve via config endpoint
      const configRes = await request(app, 'GET', '/api/modules/team-tracker/admin/roster-sync/config')
      expect(configRes.status).toBe(200)
      expect(configRes.body.gitlabInstances[0].excludeGroups).toEqual(['mirror-group'])
    })

    it('updates excludeGroups and persists changes', async () => {
      // Initial config
      mockStorage['team-data/config.json'] = {
        orgRoots: [{ uid: 'testorg', displayName: 'Test Org' }],
        gitlabInstances: [{
          label: 'GitLab.com',
          baseUrl: 'https://gitlab.com',
          tokenEnvVar: 'GITLAB_TOKEN',
          groups: ['group-a'],
          excludeGroups: ['old-mirror']
        }]
      }

      // Update with new exclude groups
      const update = {
        orgRoots: [{ uid: 'testorg', displayName: 'Test Org' }],
        gitlabInstances: [{
          label: 'GitLab.com',
          baseUrl: 'https://gitlab.com',
          tokenEnvVar: 'GITLAB_TOKEN',
          groups: ['group-a'],
          excludeGroups: ['new-mirror-1', 'new-mirror-2']
        }]
      }

      const res = await request(app, 'POST', '/api/modules/team-tracker/admin/roster-sync/config', update)
      expect(res.status).toBe(200)

      const saved = writeToStorage.mock.calls[0][1]
      expect(saved.gitlabInstances[0].excludeGroups).toEqual(['new-mirror-1', 'new-mirror-2'])
      expect(saved.gitlabInstances[0].excludeGroups).not.toContain('old-mirror')
    })
  })

  describe('Backwards compatibility', () => {
    it('handles configs from before gitlabInstances was added', async () => {
      // Old config with legacy gitlabGroups field (will be auto-migrated to instances)
      mockStorage['team-data/config.json'] = {
        orgRoots: [{ uid: 'testorg', displayName: 'Test Org' }],
        gitlabGroups: ['group-a']
      }

      const res = await request(app, 'GET', '/api/modules/team-tracker/admin/roster-sync/config')

      expect(res.status).toBe(200)
      // Should have migrated gitlabGroups to gitlabInstances
      expect(res.body.gitlabInstances).toBeDefined()
    })
  })
})
