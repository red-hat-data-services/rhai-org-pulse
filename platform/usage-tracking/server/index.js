const crypto = require('crypto')
const { validateAction, sanitizeTarget, sanitizeString } = require('./sanitize')
const { resolvePersona, resolveUserEmail } = require('./persona-resolver')
const { runReportGeneration, parseEvents } = require('./report-generator')

const MAX_EVENTS_PER_BATCH = 500

function hashEmail(email, hmacKey) {
  if (!email) return 'anonymous'
  const hmac = crypto.createHmac('sha256', hmacKey)
  hmac.update(email.toLowerCase().trim())
  return 'hmac:' + hmac.digest('hex')
}

/**
 * @param {import('express').Router} router
 * @param {import('@org-pulse/core').ModuleContext} context
 */
async function getOrCreateHmacKey(storage, resolveSecret) {
  const configured = resolveSecret ? resolveSecret('USAGE_TRACKING_HMAC_KEY') : undefined
  if (configured) return configured
  const stored = await storage.readRawFromStorage('usage/hmac-key.txt')
  if (stored) return stored.trim()
  const generated = crypto.randomBytes(32).toString('hex')
  await storage.writeRawToStorage('usage/hmac-key.txt', generated)
  return generated
}

module.exports = function registerUsageTracking(router, context) {
  const { storage, requireAuth, requireAdmin } = context
  let hmacKeyPromise = null
  function getHmacKey() {
    if (!hmacKeyPromise) {
      hmacKeyPromise = getOrCreateHmacKey(storage, context.resolveSecret).catch(function (err) {
        hmacKeyPromise = null
        throw err
      })
    }
    return hmacKeyPromise
  }

  context.registerRefresh('report', {
    handler: async function () {
      const result = await runReportGeneration(context)
      console.log(`[usage-tracking] Report generated: ${result.eventCount} events, ${result.periodStart} to ${result.periodEnd}`)
      return result
    },
    cadence: '24h',
    timeout: 60_000,
    order: 500
  })

  /**
   * @openapi
   * /api/usage/events:
   *   post:
   *     summary: Ingest a batch of usage tracking events
   *     tags: [usage-tracking]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               events:
   *                 type: array
   *                 items:
   *                   type: object
   *     responses:
   *       200:
   *         description: Events accepted
   */
  router.post('/events', requireAuth, async function (req, res) {
    const events = req.body && req.body.events
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events array required' })
    }
    if (events.length > MAX_EVENTS_PER_BATCH) {
      return res.status(400).json({ error: `Too many events. Maximum ${MAX_EVENTS_PER_BATCH} per request.` })
    }

    const email = resolveUserEmail(req)
    const hmacKey = await getHmacKey()
    const userId = hashEmail(email, hmacKey)
    const persona = await resolvePersona(req, storage)
    const now = new Date()
    const dateKey = now.toISOString().slice(0, 10)

    const lines = []
    for (const e of events) {
      if (!e || typeof e !== 'object') continue
      const action = validateAction(e.action)
      if (!action) continue
      const mod = sanitizeString(e.module)
      if (!mod) continue

      lines.push(JSON.stringify({
        ts: now.toISOString(),
        module: mod,
        view: sanitizeString(e.view),
        action: action,
        target: sanitizeTarget(e.target),
        userId: userId,
        persona: persona,
        org: sanitizeString(e.org)
      }))
    }

    if (lines.length > 0) {
      await storage.appendToStorage(
        `usage/events-${dateKey}.jsonl`,
        lines.join('\n') + '\n'
      )
    }

    res.json({ status: 'ok', count: lines.length })
  })

  /**
   * @openapi
   * /api/usage/report:
   *   get:
   *     summary: Latest usage report (text)
   *     tags: [usage-tracking]
   *     responses:
   *       200:
   *         description: Plain text report
   */
  router.get('/report', requireAdmin, async function (req, res) {
    const report = await storage.readRawFromStorage('usage/report-latest.txt')
    if (!report) {
      return res.type('text/plain').send('No report generated yet. Reports are generated daily.')
    }
    res.type('text/plain').send(report)
  })

  /**
   * @openapi
   * /api/usage/raw:
   *   get:
   *     summary: Raw events for a given date (admin only)
   *     tags: [usage-tracking]
   *     parameters:
   *       - in: query
   *         name: date
   *         schema:
   *           type: string
   *         description: Date in YYYY-MM-DD format (defaults to today)
   *     responses:
   *       200:
   *         description: Array of raw event objects
   */
  router.get('/raw', requireAdmin, async function (req, res) {
    const dateKey = req.query.date || new Date().toISOString().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' })
    }
    const raw = await storage.readRawFromStorage(`usage/events-${dateKey}.jsonl`)
    if (!raw) {
      return res.json({ date: dateKey, events: [] })
    }
    const events = parseEvents(raw)
    res.json({ date: dateKey, events: events, count: events.length })
  })

  /**
   * @openapi
   * /api/usage/days:
   *   get:
   *     summary: List available event dates (admin only)
   *     tags: [usage-tracking]
   *     responses:
   *       200:
   *         description: Array of date strings
   */
  router.get('/days', requireAdmin, async function (req, res) {
    const files = await storage.listAllStorageFiles('usage')
    const days = files
      .filter(function (f) { return f.startsWith('events-') && f.endsWith('.jsonl') })
      .map(function (f) { return f.replace('events-', '').replace('.jsonl', '') })
      .sort()
      .reverse()
    res.json({ days: days })
  })

  /**
   * @openapi
   * /api/usage/report/generate:
   *   post:
   *     summary: Trigger report generation (admin only)
   *     tags: [usage-tracking]
   *     responses:
   *       200:
   *         description: Report generation result
   */
  router.post('/report/generate', requireAdmin, async function (req, res) {
    try {
      const result = await runReportGeneration(context)
      res.json({ status: 'ok', ...result })
    } catch (err) {
      console.error('[usage-tracking] Report generation failed:', err.message)
      res.status(500).json({ error: 'Report generation failed' })
    }
  })
}
