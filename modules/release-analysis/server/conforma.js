'use strict'

const STORAGE_KEY = 'release-analysis/conforma.json'
const DEFAULT_MIN_DATE = '2024-01-01'

function validateRelease(r) {
  if (!r || typeof r !== 'object') return 'must be an object'
  if (!r.version || typeof r.version !== 'string') return 'missing version'
  if (!r.gaDate || typeof r.gaDate !== 'string') return 'missing gaDate'
  if (!r.exceptions || typeof r.exceptions !== 'object') return 'missing exceptions'
  return null
}

module.exports = function registerConformaRoutes(router, context) {
  const { storage, requireAuth, requireAdmin, requireScope } = context
  const { readFromStorage, writeToStorage, deleteFromStorage } = storage

  // GET /conforma/status
  router.get('/conforma/status', requireAuth, requireScope('release-analysis:read'), function (req, res) {
    const data = readFromStorage(STORAGE_KEY)
    if (!data) return res.json({ status: 'no_data' })
    res.json({
      fetchedAt: data.fetchedAt || null,
      count: data.count || (data.releases || []).length,
      minDate: data.minDate || DEFAULT_MIN_DATE
    })
  })

  // GET /conforma/releases — list all
  router.get('/conforma/releases', requireAuth, requireScope('release-analysis:read'), function (req, res) {
    const data = readFromStorage(STORAGE_KEY)
    if (!data) {
      return res.status(404).json({ error: 'No conforma data available. Run the ingestion pipeline.' })
    }
    res.json({
      fetchedAt: data.fetchedAt,
      minDate: data.minDate || DEFAULT_MIN_DATE,
      count: data.count || (data.releases || []).length,
      releases: data.releases || []
    })
  })

  // GET /conforma/releases/:version — single release
  router.get('/conforma/releases/:version', requireAuth, requireScope('release-analysis:read'), function (req, res) {
    const data = readFromStorage(STORAGE_KEY)
    if (!data) {
      return res.status(404).json({ error: 'No conforma data available.' })
    }
    const release = (data.releases || []).find(r => r.version === req.params.version)
    if (!release) {
      return res.status(404).json({ error: `Release '${req.params.version}' not found.` })
    }
    res.json(release)
  })

  // POST /conforma/bulk — ingest releases (admin only, called by pipeline)
  router.post('/conforma/bulk', requireAdmin, requireScope('release-analysis:write'), function (req, res) {
    if (process.env.DEMO_MODE === 'true') {
      return res.json({ status: 'skipped', message: 'Conforma ingest disabled in demo mode.' })
    }

    const { releases, minDate } = req.body || {}

    if (!Array.isArray(releases)) {
      return res.status(400).json({ error: 'releases must be an array' })
    }
    if (releases.length > 500) {
      return res.status(400).json({ error: 'Bulk payload exceeds maximum of 500 releases' })
    }

    const errors = []
    const valid = []
    for (const r of releases) {
      const err = validateRelease(r)
      if (err) {
        errors.push({ version: r?.version || '(unknown)', error: err })
      } else {
        valid.push(r)
      }
    }

    if (valid.length === 0 && errors.length > 0) {
      return res.status(400).json({ error: 'All releases failed validation', errors })
    }

    const savedAt = new Date().toISOString()
    writeToStorage(STORAGE_KEY, {
      fetchedAt: savedAt,
      minDate: minDate || DEFAULT_MIN_DATE,
      count: valid.length,
      releases: valid
    })

    res.json({ count: valid.length, savedAt, errors })
  })

  // DELETE /conforma — clear all data (admin only)
  router.delete('/conforma', requireAdmin, requireScope('release-analysis:write'), function (req, res) {
    if (process.env.DEMO_MODE === 'true') {
      return res.status(400).json({ error: 'Cannot delete in demo mode.' })
    }
    try {
      deleteFromStorage(STORAGE_KEY)
    } catch {
      // File may not exist — treat as already cleared
    }
    res.status(204).end()
  })
}
