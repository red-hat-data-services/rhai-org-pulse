const MAX_CONCURRENT_FETCHES = 20

// Runs fn on each item with bounded concurrency. fn must handle its own
// errors — any unhandled rejection will propagate to the caller.
async function pMap(items, fn, concurrency) {
  const results = new Array(items.length)
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      results[i] = await fn(items[i], i)
    }
  }
  const workers = []
  for (let w = 0; w < Math.min(concurrency, items.length); w++) {
    workers.push(worker())
  }
  await Promise.all(workers)
  return results
}

const ACCEPT_HEADER = 'application/vnd.pypi.simple.v1+json'
const ACCEPT_HEADER_FALLBACK =
  'application/vnd.pypi.simple.v1+json, ' +
  'application/vnd.pypi.simple.v1+html;q=0.2, ' +
  'text/html;q=0.01'

const PACKAGE_NAME_RE = /^[a-zA-Z][a-zA-Z0-9._-]*$/
const VERSION_RE = /^[a-zA-Z0-9._-]+$/

const ALL_REPO_TYPES = {
  production: '',
  test: '-test',
  sdists: '-sdists',
  'sdists-test': '-sdists-test'
}
const DEFAULT_REPO_TYPES = ['test', 'production']

// --- In-memory cache ---

const _cache = new Map()
const MAX_CACHE_ENTRIES = 1000

function getCacheTtl() {
  return parseInt(process.env.PACKAGE_INDEX_CACHE_TTL || '300', 10) * 1000
}

function cacheGet(key) {
  const entry = _cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > getCacheTtl()) {
    _cache.delete(key)
    return null
  }
  return entry.result
}

function cacheSet(key, result) {
  _cache.set(key, { timestamp: Date.now(), result })
  if (_cache.size > MAX_CACHE_ENTRIES) {
    const first = _cache.keys().next().value
    _cache.delete(first)
  }
}

function clearCache() {
  _cache.clear()
}

function getCacheStats() {
  return { size: _cache.size, maxEntries: MAX_CACHE_ENTRIES }
}

// --- PEP 503 name normalization ---

function canonicalizeName(name) {
  return name.replace(/[-_.]+/g, '-').toLowerCase()
}

// --- Response parsing ---

function parseSimpleHtml(html) {
  const files = []
  const TAG_RE = /<a\s(?:[^>"]*|"[^"]*")*>([^<]*)<\/a>/gi
  const HREF_RE = /href="([^"]*)"/i
  let tagMatch
  while ((tagMatch = TAG_RE.exec(html)) !== null) {
    const fullMatch = tagMatch[0]
    const text = tagMatch[1].trim()
    const openTag = fullMatch.slice(0, fullMatch.indexOf('>'))
    const hrefMatch = HREF_RE.exec(openTag)
    if (hrefMatch && text) {
      files.push({ filename: text, url: hrefMatch[1] })
    }
  }
  return files
}

function parseSimpleJson(data) {
  if (!data || !Array.isArray(data.files)) return []
  return data.files.map(function (f) {
    return { filename: f.filename, url: f.url, uploadTime: f['upload-time'] || null }
  })
}

// --- Index fetcher ---

function getQueryTimeout() {
  return parseInt(process.env.PACKAGE_INDEX_QUERY_TIMEOUT || '15', 10) * 1000
}

async function fetchWithRetry(url, acceptHeader, timeout) {
  let response
  try {
    response = await fetch(url, {
      headers: { Accept: acceptHeader },
      signal: AbortSignal.timeout(timeout)
    })
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return { response: null, error: 'timeout' }
    }
    try {
      response = await fetch(url, {
        headers: { Accept: acceptHeader },
        signal: AbortSignal.timeout(timeout)
      })
    } catch (retryErr) {
      return { response: null, error: retryErr.message }
    }
  }
  return { response, error: null }
}

async function fetchIndex(indexUrl, packageName) {
  const normalized = canonicalizeName(packageName)
  const cacheKey = indexUrl + '\0' + normalized
  const cached = cacheGet(cacheKey)
  if (cached) return { ...cached, error: null }

  const url = indexUrl + normalized + '/'
  const timeout = getQueryTimeout()

  let { response, error } = await fetchWithRetry(url, ACCEPT_HEADER, timeout)
  if (error) return { indexExists: false, found: false, files: [], error }

  // Server doesn't support JSON — retry with HTML fallback
  if (response.status === 406) {
    ;({ response, error } = await fetchWithRetry(url, ACCEPT_HEADER_FALLBACK, timeout))
    if (error) return { indexExists: false, found: false, files: [], error }
  }

  try {
    if (response.status === 404) {
      const result = { indexExists: true, found: false, files: [] }
      cacheSet(cacheKey, result)
      return { ...result, error: null }
    }

    if (!response.ok) {
      return { indexExists: false, found: false, files: [], error: 'HTTP ' + response.status }
    }

    const contentType = response.headers.get('content-type') || ''
    let files
    let format
    if (contentType.includes('json')) {
      const data = await response.json()
      files = parseSimpleJson(data)
      format = 'json'
    } else {
      const html = await response.text()
      files = parseSimpleHtml(html)
      format = 'html'
    }

    const result = { indexExists: true, found: true, files, format }
    cacheSet(cacheKey, result)
    return { ...result, error: null }
  } catch (err) {
    return { indexExists: false, found: false, files: [], error: err.message }
  }
}

// --- Configuration helpers ---

function getBaseUrl() {
  return (process.env.PACKAGE_INDEX_BASE_URL ||
    'https://packages.redhat.com/api/pypi/public-rhai/rhoai').replace(/\/+$/, '')
}

function getVariants() {
  const raw = process.env.PACKAGE_INDEX_VARIANTS || 'cpu-ubi9'
  return raw.split(',').map(function (v) { return v.trim() }).filter(Boolean)
}

const DEFAULT_PRODUCT_VERSIONS = [
  '3.2',
  '3.3',
  '3.4-EA1', '3.4-EA2', '3.4',
  '3.5-EA1', '3.5-EA2', '3.5',
  '3.6-EA1', '3.6-EA2', '3.6',
  '3.7-EA1', '3.7-EA2', '3.7',
  '3.8-EA1', '3.8-EA2', '3.8',
  '3.9-EA1', '3.9-EA2', '3.9',
  '4.0'
]

function getProductVersions() {
  const raw = process.env.PACKAGE_INDEX_PRODUCT_VERSIONS
  if (raw) return raw.split(',').map(function (v) { return v.trim() }).filter(Boolean)
  return DEFAULT_PRODUCT_VERSIONS
}

function getDefaultProductVersion() {
  return process.env.PACKAGE_INDEX_DEFAULT_PRODUCT_VERSION || null
}

function getUpstreamPypiUrl() {
  const raw = process.env.UPSTREAM_PYPI_URL || 'https://pypi.org/simple/'
  return raw.replace(/\/+$/, '') + '/'
}

function isUpstreamPypiEnabled() {
  const val = process.env.UPSTREAM_PYPI_ENABLED
  return val !== 'false' && val !== '0'
}

module.exports = {
  PACKAGE_NAME_RE,
  VERSION_RE,
  ALL_REPO_TYPES,
  DEFAULT_REPO_TYPES,
  canonicalizeName,
  parseSimpleHtml,
  parseSimpleJson,
  fetchIndex,
  getBaseUrl,
  getVariants,
  getProductVersions,
  getDefaultProductVersion,
  getUpstreamPypiUrl,
  isUpstreamPypiEnabled,
  clearCache,
  getCacheStats,
  pMap,
  MAX_CONCURRENT_FETCHES
}
