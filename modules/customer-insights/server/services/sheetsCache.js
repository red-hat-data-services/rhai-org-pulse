// Simple in-memory cache with TTL
const cache = new Map()
// eslint-disable-next-line org-pulse/no-module-process-env -- TTL is a config constant, not a secret
const TTL = parseInt(process.env.SHEETS_CACHE_TTL_MS || '30000', 10) // 30 seconds default

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null

  if (Date.now() - entry.ts > TTL) {
    cache.delete(key)
    return null
  }

  return entry.data
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() })
}

function invalidate(key) {
  cache.delete(key)
}

function invalidateAll() {
  cache.clear()
}

module.exports = {
  getCached,
  setCache,
  invalidate,
  invalidateAll,
}
