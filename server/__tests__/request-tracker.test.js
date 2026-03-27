import { describe, it, expect, beforeEach } from 'vitest'

// Load fresh module for each test
function loadFreshModule() {
  const modulePath = require.resolve('../request-tracker')
  delete require.cache[modulePath]
  return require('../request-tracker')
}

function createMockReqRes(method, path, statusCode) {
  const listeners = {}
  const req = { method, path, originalUrl: path }
  const res = {
    statusCode,
    on(event, fn) { listeners[event] = fn },
    removeListener() {}
  }
  return {
    req,
    res,
    finish() {
      if (listeners.finish) listeners.finish()
    }
  }
}

describe('request-tracker', () => {
  let tracker

  beforeEach(() => {
    tracker = loadFreshModule()
  })

  it('getSnapshot returns empty state initially', () => {
    const snap = tracker.getSnapshot()
    expect(snap.totalTracked).toBe(0)
    expect(snap.entries).toEqual([])
    expect(snap.uptimeSecs).toBeGreaterThanOrEqual(0)
  })

  it('middleware tracks /api/ requests', () => {
    const mw = tracker.createMiddleware()
    const { req, res, finish } = createMockReqRes('GET', '/api/roster', 200)

    mw(req, res, () => {})
    res.statusCode = 200
    finish()

    const snap = tracker.getSnapshot()
    expect(snap.totalTracked).toBe(1)
    expect(snap.entries[0].method).toBe('GET')
    expect(snap.entries[0].path).toBe('/api/roster')
    expect(snap.entries[0].status).toBe(200)
  })

  it('middleware ignores non-api requests', () => {
    const mw = tracker.createMiddleware()
    const { req, res } = createMockReqRes('GET', '/healthz', 200)
    let nextCalled = false

    mw(req, res, () => { nextCalled = true })

    expect(nextCalled).toBe(true)
    expect(tracker.getSnapshot().totalTracked).toBe(0)
  })

  it('respects buffer size', () => {
    const mw = tracker.createMiddleware({ bufferSize: 2 })

    for (let i = 0; i < 5; i++) {
      const { req, res, finish } = createMockReqRes('GET', '/api/test' + i, 200)
      mw(req, res, () => {})
      finish()
    }

    const snap = tracker.getSnapshot()
    expect(snap.totalTracked).toBe(5)
    expect(snap.entries.length).toBe(2)
  })

  it('getSummary computes correct stats', () => {
    const entries = [
      { method: 'GET', path: '/api/roster', status: 200, ms: 50, at: '2026-01-01T00:00:00Z' },
      { method: 'GET', path: '/api/roster', status: 200, ms: 100, at: '2026-01-01T00:00:01Z' },
      { method: 'POST', path: '/api/refresh', status: 500, ms: 5000, at: '2026-01-01T00:00:02Z' }
    ]

    const summary = tracker.getSummary(entries)
    expect(summary.totalRequests).toBe(3)
    expect(summary.errorCount).toBe(1)
    expect(summary.byStatus[200]).toBe(2)
    expect(summary.byStatus[500]).toBe(1)
    expect(summary.byEndpoint['GET /api/roster'].count).toBe(2)
    expect(summary.byEndpoint['POST /api/refresh'].errors).toBe(1)
    expect(summary.slowestRequests[0].ms).toBe(5000)
  })

  it('getSummary handles empty entries', () => {
    const summary = tracker.getSummary([])
    expect(summary.totalRequests).toBe(0)
    expect(summary.errorCount).toBe(0)
  })

  it('getRecentErrors filters 4xx and 5xx', () => {
    const entries = [
      { method: 'GET', path: '/api/a', status: 200, ms: 10, at: '2026-01-01T00:00:00Z' },
      { method: 'GET', path: '/api/b', status: 404, ms: 5, at: '2026-01-01T00:00:01Z' },
      { method: 'POST', path: '/api/c', status: 500, ms: 100, at: '2026-01-01T00:00:02Z' }
    ]

    const errors = tracker.getRecentErrors(entries)
    expect(errors.length).toBe(2)
    expect(errors[0].status).toBe(404)
    expect(errors[1].status).toBe(500)
  })

  it('clear resets state', () => {
    const mw = tracker.createMiddleware()
    const { req, res, finish } = createMockReqRes('GET', '/api/test', 200)
    mw(req, res, () => {})
    finish()
    expect(tracker.getSnapshot().totalTracked).toBe(1)

    tracker.clear()
    expect(tracker.getSnapshot().totalTracked).toBe(0)
    expect(tracker.getSnapshot().entries).toEqual([])
  })
})
