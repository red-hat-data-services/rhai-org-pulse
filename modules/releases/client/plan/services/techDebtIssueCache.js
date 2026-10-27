const CACHE_TTL_MS = 5 * 60 * 1000
const MAX_CACHE_ENTRIES = 6
const responseCache = new Map()

export function techDebtIssueCacheKey(components, issueType, triage) {
  const normalizedComponents = (Array.isArray(components) ? components : [])
    .map(function (component) { return String(component || '').trim() })
    .filter(Boolean)
    .sort(function (a, b) { return a.localeCompare(b) })

  return JSON.stringify({
    components: normalizedComponents,
    issueType: String(issueType || ''),
    triage: String(triage || '')
  })
}

export function readTechDebtIssueCache(key, now = Date.now()) {
  const entry = responseCache.get(key)
  if (!entry) return null

  // Refresh insertion order so the Map doubles as a small LRU cache.
  responseCache.delete(key)
  responseCache.set(key, entry)

  return {
    data: entry.data,
    cachedAt: entry.cachedAt,
    fresh: now - entry.cachedAt < CACHE_TTL_MS
  }
}

export function writeTechDebtIssueCache(key, data, now = Date.now()) {
  responseCache.delete(key)
  responseCache.set(key, { data, cachedAt: now })

  while (responseCache.size > MAX_CACHE_ENTRIES) {
    responseCache.delete(responseCache.keys().next().value)
  }
}

export function clearTechDebtIssueCache() {
  responseCache.clear()
}

export const TECH_DEBT_CACHE_TTL_MS = CACHE_TTL_MS
export const TECH_DEBT_CACHE_MAX_ENTRIES = MAX_CACHE_ENTRIES
