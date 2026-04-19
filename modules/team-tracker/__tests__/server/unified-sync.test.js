import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import http from 'http'

// Mock storage
const mockStorage = {}
const storageMock = {
  readFromStorage: vi.fn((key) => mockStorage[key] || null),
  writeToStorage: vi.fn((key, data) => { mockStorage[key] = data }),
  listStorageFiles: vi.fn(() => []),
  deleteStorageDirectory: vi.fn(),
  DATA_DIR: '/tmp/test-data'
}

// Use vi.hoisted so the mock state is available when vi.mock factories run (they are hoisted above declarations)
const mockConsolidatedSync = vi.hoisted(() => ({
  syncInProgress: false,
  runSyncResult: { status: 'success' }
}))

vi.mock('../../../../shared/server/roster-sync/consolidated-sync', () => ({
  isSyncInProgress: vi.fn(() => mockConsolidatedSync.syncInProgress),
  runConsolidatedSync: vi.fn(async () => mockConsolidatedSync.runSyncResult),
}))

vi.mock('../../../../shared/server/roster-sync', () => ({
  runSync: vi.fn(async () => mockConsolidatedSync.runSyncResult),
  isSyncInProgress: vi.fn(() => mockConsolidatedSync.syncInProgress),
}))

vi.mock('../../../../shared/server/roster-sync/config', () => ({
  loadConfig: vi.fn((storage) => {
    return storage.readFromStorage('team-data/config.json') || {}
  }),
  isConfigured: vi.fn(() => true),
  getOrgDisplayNames: vi.fn(() => ({})),
  saveConfig: vi.fn(),
  clearDisplayNamesCache: vi.fn()
}))

vi.mock('../../../../shared/server/roster-sync/constants', () => ({
  RESERVED_KEYS: []
}))

vi.mock('../../../../shared/server/roster-sync/sheets', () => ({
  readHeaders: vi.fn(),
  matchPeopleToSheet: vi.fn()
}))

vi.mock('../../../../shared/server/roster', () => ({
  readRosterFull: vi.fn(() => null),
  getAllPeople: vi.fn(() => []),
  getTeamRollup: vi.fn(() => [])
}))

vi.mock('../../../../shared/server/auth', () => ({
  requireAuth: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next()
}))

vi.mock('../../../../shared/server/jira', () => ({
  JIRA_HOST: 'https://test.atlassian.net',
  jiraRequest: vi.fn()
}))

vi.mock('../../server/jira/person-metrics', () => ({
  fetchPersonMetrics: vi.fn()
}))
vi.mock('../../server/github/contributions', () => ({
  fetchGithubData: vi.fn()
}))
vi.mock('../../server/gitlab/contributions', () => ({
  fetchGitlabData: vi.fn()
}))
vi.mock('../../server/jira/config', () => ({
  loadConfig: vi.fn(() => ({})),
  saveConfig: vi.fn()
}))
vi.mock('../../server/snapshots', () => ({
  generateAllSnapshots: vi.fn(),
  deleteAllSnapshots: vi.fn()
}))
vi.mock('../../server/org-sync', () => ({
  runSync: vi.fn(async () => ({})),
  calculateHeadcountByRole: vi.fn(() => ({})),
  parseTeamBoardsTab: vi.fn(() => [])
}))
vi.mock('../../server/rfe', () => ({
  fetchAllRfeBacklog: vi.fn(async () => ({ byComponent: {}, byTeam: {} }))
}))
vi.mock('../../../../shared/server/google-sheets', () => ({
  fetchRawSheet: vi.fn(async () => ({ headers: [], rows: [] }))
}))
vi.mock('node-fetch', () => ({ default: vi.fn() }))

function createApp() {
  const app = express()
  app.use(express.json())
  const router = express.Router()

  const registerRoutes = require('../../server/index.js')
  registerRoutes(router, {
    storage: storageMock,
    requireAdmin: (req, res, next) => next()
  })

  app.use('/api/modules/team-tracker', router)
  return app
}

function makeRequest(app, method, path, body) {
  return new Promise((resolve) => {
    const server = http.createServer(app)
    server.listen(0, function() {
      const port = server.address().port
      const url = `http://localhost:${port}${path}`
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
      }
      if (body) options.body = JSON.stringify(body)

      fetch(url, options).then(async (res) => {
        const data = await res.json()
        server.close()
        resolve({ status: res.status, data })
      })
    })
  })
}

describe('Unified Sync Endpoint', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key])
    mockConsolidatedSync.syncInProgress = false
    mockConsolidatedSync.runSyncResult = { status: 'success' }
    storageMock.readFromStorage.mockImplementation((key) => mockStorage[key] || null)
    storageMock.writeToStorage.mockImplementation((key, data) => { mockStorage[key] = data })
  })

  it('returns started on successful trigger', async () => {
    const app = createApp()
    const { status, data } = await makeRequest(app, 'POST', '/api/modules/team-tracker/admin/roster-sync/unified')
    expect(status).toBe(200)
    expect(data.status).toBe('started')
  })

  it('returns skipped in demo mode', async () => {
    const origDemo = process.env.DEMO_MODE
    process.env.DEMO_MODE = 'true'
    try {
      vi.resetModules()
      const express2 = (await import('express')).default
      const app2 = express2()
      app2.use(express2.json())
      const router2 = express2.Router()
      const mod = await import('../../server/index.js')
      const registerRoutes2 = mod.default || mod
      registerRoutes2(router2, {
        storage: storageMock,
        requireAdmin: (req, res, next) => next()
      })
      app2.use('/api/modules/team-tracker', router2)

      const { status, data } = await makeRequest(app2, 'POST', '/api/modules/team-tracker/admin/roster-sync/unified')
      expect(status).toBe(200)
      expect(data.status).toBe('skipped')
      expect(data.message).toContain('demo mode')
    } finally {
      process.env.DEMO_MODE = origDemo
      vi.resetModules()
    }
  })

  it('returns 409 when consolidated sync is already in progress', async () => {
    const consolidatedSync = require('../../../../shared/server/roster-sync/consolidated-sync')
    consolidatedSync.isSyncInProgress = vi.fn(() => true)
    try {
      const app = createApp()
      const { status, data } = await makeRequest(app, 'POST', '/api/modules/team-tracker/admin/roster-sync/unified')
      expect(status).toBe(409)
      expect(data.error).toContain('sync already in progress')
    } finally {
      consolidatedSync.isSyncInProgress = vi.fn(() => false)
    }
  })

  it('returns 409 when org metadata sync is already in progress', async () => {
    const orgTeams = require('../../server/routes/org-teams')
    const origIsOrgSync = orgTeams.isOrgSyncInProgress
    orgTeams.isOrgSyncInProgress = () => true
    try {
      const app = createApp()
      const { status, data } = await makeRequest(app, 'POST', '/api/modules/team-tracker/admin/roster-sync/unified')
      expect(status).toBe(409)
      expect(data.error).toContain('Org metadata sync already in progress')
    } finally {
      orgTeams.isOrgSyncInProgress = origIsOrgSync
    }
  })

  it('returns 409 when unified sync is already in progress', async () => {
    let resolveSync
    const consolidatedSync = require('../../../../shared/server/roster-sync/consolidated-sync')
    const origRunSync = consolidatedSync.runConsolidatedSync
    consolidatedSync.runConsolidatedSync = () => new Promise(r => { resolveSync = r })

    try {
      const app = createApp()

      // Trigger first sync — sets unifiedSyncInProgress=true and hangs
      const first = await makeRequest(app, 'POST', '/api/modules/team-tracker/admin/roster-sync/unified')
      expect(first.status).toBe(200)
      expect(first.data.status).toBe('started')

      // Wait for the async function to start executing
      await new Promise(r => setTimeout(r, 50))

      // Second request should get 409
      const { status, data } = await makeRequest(app, 'POST', '/api/modules/team-tracker/admin/roster-sync/unified')
      expect(status).toBe(409)
      expect(data.error).toContain('Unified sync already in progress')

      // Clean up: resolve the hanging sync
      if (resolveSync) resolveSync({ status: 'success' })
      await new Promise(r => setTimeout(r, 100))
    } finally {
      consolidatedSync.runConsolidatedSync = origRunSync
    }
  })

  it('skips Phase 2 when Phase 1 returns error', async () => {
    const consolidatedSync = require('../../../../shared/server/roster-sync/consolidated-sync')
    const origRunSync = consolidatedSync.runConsolidatedSync
    consolidatedSync.runConsolidatedSync = vi.fn(async () => ({ status: 'error', message: 'LDAP timeout' }))

    const orgTeams = require('../../server/routes/org-teams')
    let phase2Called = false
    const origGetTrigger = orgTeams.getTriggerOrgSync
    orgTeams.getTriggerOrgSync = () => async () => { phase2Called = true }

    try {
      const app = createApp()
      const { status, data } = await makeRequest(app, 'POST', '/api/modules/team-tracker/admin/roster-sync/unified')
      expect(status).toBe(200)
      expect(data.status).toBe('started')

      // Wait for async execution
      await new Promise(r => setTimeout(r, 200))

      expect(phase2Called).toBe(false)
    } finally {
      consolidatedSync.runConsolidatedSync = origRunSync
      orgTeams.getTriggerOrgSync = origGetTrigger
    }
  })

  it('skips Phase 2 when Phase 1 returns skipped', async () => {
    const consolidatedSync = require('../../../../shared/server/roster-sync/consolidated-sync')
    const origRunSync = consolidatedSync.runConsolidatedSync
    consolidatedSync.runConsolidatedSync = vi.fn(async () => ({ status: 'skipped' }))

    const orgTeams = require('../../server/routes/org-teams')
    let phase2Called = false
    const origGetTrigger = orgTeams.getTriggerOrgSync
    orgTeams.getTriggerOrgSync = () => async () => { phase2Called = true }

    try {
      const app = createApp()
      const { status, data } = await makeRequest(app, 'POST', '/api/modules/team-tracker/admin/roster-sync/unified')
      expect(status).toBe(200)
      expect(data.status).toBe('started')

      await new Promise(r => setTimeout(r, 200))

      expect(phase2Called).toBe(false)
    } finally {
      consolidatedSync.runConsolidatedSync = origRunSync
      orgTeams.getTriggerOrgSync = origGetTrigger
    }
  })

  it('calls Phase 2 when Phase 1 succeeds', async () => {
    const consolidatedSync = require('../../../../shared/server/roster-sync/consolidated-sync')
    const origRunSync = consolidatedSync.runConsolidatedSync
    consolidatedSync.runConsolidatedSync = vi.fn(async () => ({ status: 'success' }))

    const orgTeams = require('../../server/routes/org-teams')
    let phase2Called = false
    const origGetTrigger = orgTeams.getTriggerOrgSync
    orgTeams.getTriggerOrgSync = () => async () => { phase2Called = true }

    try {
      const app = createApp()
      const { status, data } = await makeRequest(app, 'POST', '/api/modules/team-tracker/admin/roster-sync/unified')
      expect(status).toBe(200)
      expect(data.status).toBe('started')

      await new Promise(r => setTimeout(r, 200))

      expect(phase2Called).toBe(true)
    } finally {
      consolidatedSync.runConsolidatedSync = origRunSync
      orgTeams.getTriggerOrgSync = origGetTrigger
    }
  })
})

describe('Extended Status Endpoint', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(key => delete mockStorage[key])
    mockConsolidatedSync.syncInProgress = false
    storageMock.readFromStorage.mockImplementation((key) => mockStorage[key] || null)
    storageMock.writeToStorage.mockImplementation((key, data) => { mockStorage[key] = data })
  })

  it('returns extended status with phases and staleness', async () => {
    mockStorage['team-data/config.json'] = {
      orgRoots: [{ uid: 'test', displayName: 'Test' }],
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: 'success',
      lastSyncError: null
    }
    mockStorage['org-roster/sync-status.json'] = {
      lastSyncAt: new Date().toISOString(),
      status: 'success',
      error: null,
      teamCount: 5,
      componentCount: 3
    }

    const app = createApp()
    const { status, data } = await makeRequest(app, 'GET', '/api/modules/team-tracker/admin/roster-sync/status')

    expect(status).toBe(200)
    expect(data).toHaveProperty('phases')
    expect(data.phases).toEqual(['roster', 'metadata'])
    expect(data).toHaveProperty('rosterSync')
    expect(data).toHaveProperty('metadataSync')
    expect(data).toHaveProperty('stale')
    expect(data.stale.roster).toBe(false)
    expect(data.stale.metadata).toBe(false)
    expect(data.metadataSync.teamCount).toBe(5)
    expect(data.metadataSync.componentCount).toBe(3)
    // Backward-compatible fields
    expect(data).toHaveProperty('syncing')
    expect(data).toHaveProperty('lastSyncAt')
    expect(data).toHaveProperty('lastSyncStatus')
  })

  it('reports stale when sync timestamps are old', async () => {
    const oldDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
    mockStorage['team-data/config.json'] = {
      orgRoots: [{ uid: 'test', displayName: 'Test' }],
      lastSyncAt: oldDate,
      lastSyncStatus: 'success'
    }
    mockStorage['org-roster/sync-status.json'] = {
      lastSyncAt: oldDate,
      status: 'success'
    }

    const app = createApp()
    const { data } = await makeRequest(app, 'GET', '/api/modules/team-tracker/admin/roster-sync/status')

    expect(data.stale.roster).toBe(true)
    expect(data.stale.metadata).toBe(true)
  })

  it('returns phase info as null when not syncing', async () => {
    const app = createApp()
    const { data } = await makeRequest(app, 'GET', '/api/modules/team-tracker/admin/roster-sync/status')

    expect(data.syncing).toBe(false)
    expect(data.phase).toBeNull()
    expect(data.phaseLabel).toBeNull()
  })
})
