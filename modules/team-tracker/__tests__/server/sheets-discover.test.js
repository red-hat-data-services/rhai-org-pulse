import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import http from 'http'

const mockStorage = {}

vi.mock('../../../../shared/server/storage', () => ({
  readFromStorage: vi.fn((key) => mockStorage[key] || null),
  writeToStorage: vi.fn((key, data) => { mockStorage[key] = data }),
  DATA_DIR: '/tmp/test-data'
}))

vi.mock('../../../../shared/server/roster-sync', () => ({
  loadConfig: vi.fn(() => null),
  saveConfig: vi.fn(),
  isConfigured: vi.fn(() => false),
  isSyncInProgress: vi.fn(() => false),
  triggerSync: vi.fn(),
  scheduleDaily: vi.fn()
}))

vi.mock('../../../../shared/server/auth', () => ({
  requireAuth: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
  requireTeamAdmin: (req, res, next) => next()
}))

vi.mock('../../server/jira/jira-client', () => ({
  createJiraClient: () => ({})
}))
vi.mock('../../server/jira/orchestration', () => ({
  discoverBoards: vi.fn(),
  performRefresh: vi.fn()
}))
vi.mock('node-fetch', () => ({ default: vi.fn() }))

import { readFromStorage, writeToStorage } from '../../../../shared/server/storage'

// Grab the actual sheets module to spy on discoverSheetNames
const sheetsModule = require('../../../../shared/server/roster-sync/sheets')

function createTestApp() {
  const app = express()
  app.use(express.json())
  app.use((req, res, next) => {
    req.userEmail = 'admin@redhat.com'
    next()
  })

  const registerRoutes = require('../../server/index.js')
  const router = express.Router()
  const context = {
    storage: { readFromStorage, writeToStorage },
    requireAdmin: (req, res, next) => next(),
    requireTeamAdmin: (req, res, next) => next(),
    registerDiagnostics: vi.fn()
  }
  registerRoutes(router, context)
  app.use('/api/modules/team-tracker', router)
  return app
}

function request(app, method, path) {
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
      req.end()
    })
  })
}

describe('GET /sheets/discover', () => {
  let app

  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k])
    vi.clearAllMocks()
    vi.restoreAllMocks()
    app = createTestApp()
  })

  it('returns 400 when spreadsheetId is missing', async () => {
    const res = await request(app, 'GET', '/api/modules/team-tracker/sheets/discover')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/spreadsheetId/)
  })

  it('returns 400 when spreadsheetId is empty', async () => {
    const res = await request(app, 'GET', '/api/modules/team-tracker/sheets/discover?spreadsheetId=')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/spreadsheetId/)
  })

  it('returns 400 when spreadsheetId has invalid format', async () => {
    const res = await request(app, 'GET', '/api/modules/team-tracker/sheets/discover?spreadsheetId=abc')
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Invalid spreadsheet ID/)
  })

  it('returns sheet names on success', async () => {
    vi.spyOn(sheetsModule, 'discoverSheetNames').mockResolvedValue(['Sheet1', 'Sheet2', 'Sheet3'])
    const id = '1gQfxqHE5y9PIuW-pJONDITbeNA0Vg2x1pazywAcDHTg'
    const res = await request(app, 'GET', `/api/modules/team-tracker/sheets/discover?spreadsheetId=${id}`)
    expect(res.status).toBe(200)
    expect(res.body.sheets).toEqual(['Sheet1', 'Sheet2', 'Sheet3'])
    expect(sheetsModule.discoverSheetNames).toHaveBeenCalledWith(id)
  })

  it('returns 500 with friendly error when Google API fails', async () => {
    vi.spyOn(sheetsModule, 'discoverSheetNames').mockRejectedValue(new Error('Not Found'))
    const id = '1gQfxqHE5y9PIuW-pJONDITbeNA0Vg2x1pazywAcDHTg'
    const res = await request(app, 'GET', `/api/modules/team-tracker/sheets/discover?spreadsheetId=${id}`)
    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/Could not access spreadsheet/)
  })

  it('returns empty array when spreadsheet has no sheets', async () => {
    vi.spyOn(sheetsModule, 'discoverSheetNames').mockResolvedValue([])
    const id = '1gQfxqHE5y9PIuW-pJONDITbeNA0Vg2x1pazywAcDHTg'
    const res = await request(app, 'GET', `/api/modules/team-tracker/sheets/discover?spreadsheetId=${id}`)
    expect(res.status).toBe(200)
    expect(res.body.sheets).toEqual([])
  })
})
