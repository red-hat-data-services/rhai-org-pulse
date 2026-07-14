'use strict'

const { logAudit } = require('../planning/audit-log')

const { STORAGE_KEY: AIPCC_STORAGE_KEY } = require('./conforma-fetcher')

const STORAGE_KEY = 'releases/delivery/conforma.json'
const DEFAULT_MIN_DATE = '2024-01-01'

function validateRelease(r) {
  if (!r || typeof r !== 'object') return 'must be an object'
  if (!r.version || typeof r.version !== 'string') return 'missing version'
  if (r.gaDate != null && typeof r.gaDate !== 'string') return 'gaDate must be a string'
  if (!r.gaDate && !r.productLayer) return 'missing gaDate (required unless productLayer is set)'
  if (!r.exceptions || typeof r.exceptions !== 'object') return 'missing exceptions'
  return null
}

module.exports = async function registerConformaRoutes(router, context) {
  const { storage, requireAuth, requireAdmin, requireScope } = context
  const { readFromStorage, writeToStorage, deleteFromStorage } = storage

  async function getMergedReleases() {
    const rhoai = await readFromStorage(STORAGE_KEY)
    const aipcc = await readFromStorage(AIPCC_STORAGE_KEY)
    const rhoaiReleases = rhoai ? (rhoai.releases || []) : []
    const aipccReleases = aipcc ? (aipcc.releases || []) : []
    const releases = [...rhoaiReleases, ...aipccReleases]
    if (!rhoai && !aipcc) return null
    const latest = [rhoai?.fetchedAt, aipcc?.fetchedAt].filter(Boolean).sort().pop() || null
    return {
      fetchedAt: latest,
      minDate: rhoai?.minDate || DEFAULT_MIN_DATE,
      count: releases.length,
      releases
    }
  }

  /**
   * @openapi
   * /api/modules/releases/delivery/conforma/status:
   *   get:
   *     summary: Get conforma data status
   *     tags: [Releases - Delivery]
   *     responses:
   *       200:
   *         description: Conforma data status
   */
  router.get('/conforma/status', requireAuth, requireScope('releases:read'), async function (req, res) {
    const data = await getMergedReleases()
    if (!data) return res.json({ status: 'no_data' })
    res.json({
      fetchedAt: data.fetchedAt || null,
      count: data.count,
      minDate: data.minDate || DEFAULT_MIN_DATE
    })
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/conforma/releases:
   *   get:
   *     summary: List all conforma releases
   *     tags: [Releases - Delivery]
   *     responses:
   *       200:
   *         description: Conforma releases list
   */
  router.get('/conforma/releases', requireAuth, requireScope('releases:read'), async function (req, res) {
    const data = await getMergedReleases()
    if (!data) {
      return res.status(404).json({ error: 'No conforma data available. Run the ingestion pipeline.' })
    }
    res.json({
      fetchedAt: data.fetchedAt,
      minDate: data.minDate || DEFAULT_MIN_DATE,
      count: data.count,
      releases: data.releases
    })
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/conforma/releases/{version}:
   *   get:
   *     summary: Get a single conforma release by version
   *     tags: [Releases - Delivery]
   *     responses:
   *       200:
   *         description: Single conforma release
   */
  router.get('/conforma/releases/:version', requireAuth, requireScope('releases:read'), async function (req, res) {
    const data = await getMergedReleases()
    if (!data) {
      return res.status(404).json({ error: 'No conforma data available.' })
    }
    const release = data.releases.find(r => r.version === req.params.version)
    if (!release) {
      return res.status(404).json({ error: `Release '${req.params.version}' not found.` })
    }
    res.json(release)
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/conforma/bulk:
   *   post:
   *     summary: Bulk ingest conforma releases (admin only)
   *     tags: [Releases - Delivery]
   *     responses:
   *       200:
   *         description: Bulk import results
   */
  router.post('/conforma/bulk', requireAdmin, requireScope('releases:write'), async function (req, res) {
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
    await writeToStorage(STORAGE_KEY, {
      fetchedAt: savedAt,
      minDate: minDate || DEFAULT_MIN_DATE,
      count: valid.length,
      releases: valid
    })

    await logAudit(readFromStorage, writeToStorage, {
      domain: 'delivery',
      action: 'conforma_bulk_import',
      user: req.userEmail || 'unknown',
      summary: 'Bulk imported ' + valid.length + ' conforma release(s)',
      details: { count: valid.length, errors: errors.length > 0 ? errors : undefined }
    })

    res.json({ count: valid.length, savedAt, errors })
  })

  /**
   * @openapi
   * /api/modules/releases/delivery/conforma:
   *   delete:
   *     summary: Clear RHOAI conforma data (admin only)
   *     tags: [Releases - Delivery]
   *     responses:
   *       204:
   *         description: Conforma data cleared
   */
  router.delete('/conforma', requireAdmin, requireScope('releases:write'), async function (req, res) {
    if (process.env.DEMO_MODE === 'true') {
      return res.status(400).json({ error: 'Cannot delete in demo mode.' })
    }
    try {
      await deleteFromStorage(STORAGE_KEY)
    } catch {
      // File may not exist — treat as already cleared
    }
    res.status(204).end()
  })
}
