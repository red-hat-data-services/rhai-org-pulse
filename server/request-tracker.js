/**
 * Lightweight Express middleware that tracks the last N API requests
 * in a ring buffer for diagnostics.
 */

const DEFAULT_BUFFER_SIZE = 200

let buffer = []
let bufferSize = DEFAULT_BUFFER_SIZE
let totalTracked = 0
const startTime = Date.now()

function createMiddleware(opts = {}) {
  bufferSize = opts.bufferSize || DEFAULT_BUFFER_SIZE

  return function requestTracker(req, res, next) {
    // Only track /api/ routes
    if (!req.path.startsWith('/api/')) return next()

    const start = Date.now()

    const onFinish = function() {
      res.removeListener('finish', onFinish)
      res.removeListener('close', onFinish)

      const ms = Date.now() - start
      const entry = {
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        ms,
        at: new Date().toISOString()
      }

      buffer.push(entry)
      totalTracked++

      if (buffer.length > bufferSize) {
        buffer = buffer.slice(buffer.length - bufferSize)
      }
    }

    res.on('finish', onFinish)
    res.on('close', onFinish)
    next()
  }
}

function getSnapshot() {
  return {
    bufferSize,
    totalTracked,
    uptimeSecs: Math.floor((Date.now() - startTime) / 1000),
    entries: buffer.slice()
  }
}

function getSummary(entries) {
  if (!entries || entries.length === 0) {
    return {
      totalRequests: 0,
      errorCount: 0,
      avgResponseTimeMs: 0,
      p95ResponseTimeMs: 0,
      byStatus: {},
      byEndpoint: {},
      slowestRequests: []
    }
  }

  const byStatus = {}
  const byEndpoint = {}
  let errorCount = 0
  const times = []

  for (const e of entries) {
    // Status breakdown
    byStatus[e.status] = (byStatus[e.status] || 0) + 1

    // Error count
    if (e.status >= 400) errorCount++

    times.push(e.ms)

    // Endpoint breakdown — use method + path without query string
    const pathOnly = e.path.split('?')[0]
    const key = `${e.method} ${pathOnly}`
    if (!byEndpoint[key]) {
      byEndpoint[key] = { count: 0, totalMs: 0, errors: 0 }
    }
    byEndpoint[key].count++
    byEndpoint[key].totalMs += e.ms
    if (e.status >= 400) byEndpoint[key].errors++
  }

  // Compute averages for endpoints
  const byEndpointFinal = {}
  for (const [key, val] of Object.entries(byEndpoint)) {
    byEndpointFinal[key] = {
      count: val.count,
      avgMs: Math.round(val.totalMs / val.count),
      errors: val.errors
    }
  }

  // Percentiles
  times.sort(function(a, b) { return a - b })
  const avg = Math.round(times.reduce(function(s, t) { return s + t }, 0) / times.length)
  const p95Idx = Math.floor(times.length * 0.95)
  const p95 = times[Math.min(p95Idx, times.length - 1)]

  // Slowest requests (top 5)
  const slowest = entries
    .slice()
    .sort(function(a, b) { return b.ms - a.ms })
    .slice(0, 5)
    .map(function(e) {
      return { method: e.method, path: e.path, status: e.status, ms: e.ms, at: e.at }
    })

  return {
    totalRequests: entries.length,
    errorCount,
    avgResponseTimeMs: avg,
    p95ResponseTimeMs: p95,
    byStatus,
    byEndpoint: byEndpointFinal,
    slowestRequests: slowest
  }
}

function getRecentErrors(entries) {
  if (!entries) return []
  return entries
    .filter(function(e) { return e.status >= 400 })
    .slice(-20)
}

function clear() {
  buffer = []
  totalTracked = 0
}

module.exports = { createMiddleware, getSnapshot, getSummary, getRecentErrors, clear }
