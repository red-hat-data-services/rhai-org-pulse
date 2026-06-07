const { createJiraClient } = require('../../../shared/server/jira')
const { buildReport } = require('./analysis')

const DEMO_MODE = process.env.DEMO_MODE === 'true' || process.env.VITE_DEMO_MODE === 'true'
const STORAGE_PREFIX = 'daily-aipcc-package-analysis/reports'
const INDEX_PATH = `${STORAGE_PREFIX}/index.json`

function rebuildIndex(readFromStorage, listStorageFiles) {
  const files = listStorageFiles(STORAGE_PREFIX + '/')
  const index = []
  for (const file of files) {
    if (file === 'index.json') continue
    if (!file.endsWith('.json')) continue
    const report = readFromStorage(`${STORAGE_PREFIX}/${file}`)
    if (report && report.summary) {
      index.push({
        report_date: report.report_date,
        report_time: report.report_time,
        summary: report.summary,
      })
    }
  }
  index.sort((a, b) => b.report_date.localeCompare(a.report_date))
  return index
}

async function generateAndStore(jira, storage, reportDate) {
  const { readFromStorage, writeToStorage, listStorageFiles } = storage
  const report = await buildReport(jira, { reportDate })
  writeToStorage(`${STORAGE_PREFIX}/${report.report_date}.json`, report)
  const index = rebuildIndex(readFromStorage, listStorageFiles)
  writeToStorage(INDEX_PATH, index)
  return report
}

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoutes(router, context) {
  const { storage, requireAdmin } = context
  const { readFromStorage, listStorageFiles } = storage

  const jira = createJiraClient({
    email: (context.secrets && context.secrets.JIRA_EMAIL) || '',
    token: (context.secrets && context.secrets.JIRA_TOKEN) || '',
  })

  /**
   * @openapi
   * /api/modules/daily-aipcc-package-analysis/reports:
   *   get:
   *     tags: [Package Analysis]
   *     summary: List all reports (summaries only)
   *     responses:
   *       200:
   *         description: Array of report summaries sorted by date descending
   */
  router.get('/reports', function(req, res) {
    const index = readFromStorage(INDEX_PATH)
    res.json(index || [])
  })

  /**
   * @openapi
   * /api/modules/daily-aipcc-package-analysis/reports/latest:
   *   get:
   *     tags: [Package Analysis]
   *     summary: Get the most recent full report
   *     responses:
   *       200:
   *         description: Full report with categories and epic details
   *       404:
   *         description: No reports available
   */
  router.get('/reports/latest', function(req, res) {
    const index = readFromStorage(INDEX_PATH)
    if (!index || index.length === 0) {
      return res.status(404).json({ error: 'No reports available' })
    }
    const latest = readFromStorage(`${STORAGE_PREFIX}/${index[0].report_date}.json`)
    if (!latest) {
      return res.status(404).json({ error: 'Report file not found' })
    }
    res.json(latest)
  })

  /**
   * @openapi
   * /api/modules/daily-aipcc-package-analysis/reports/{date}:
   *   get:
   *     tags: [Package Analysis]
   *     summary: Get full report for a specific date
   *     parameters:
   *       - name: date
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *           pattern: '^\d{4}-\d{2}-\d{2}$'
   *         description: Report date (YYYY-MM-DD)
   *     responses:
   *       200:
   *         description: Full report with categories and epic details
   *       404:
   *         description: No report for the specified date
   */
  router.get('/reports/:date', function(req, res) {
    const report = readFromStorage(`${STORAGE_PREFIX}/${req.params.date}.json`)
    if (!report) {
      return res.status(404).json({ error: `No report for ${req.params.date}` })
    }
    res.json(report)
  })

  /**
   * @openapi
   * /api/modules/daily-aipcc-package-analysis/generate:
   *   post:
   *     tags: [Package Analysis]
   *     summary: Generate a report for today (admin only)
   *     responses:
   *       200:
   *         description: Generated report
   *       500:
   *         description: Report generation failed
   */
  router.post('/generate', requireAdmin, async function(req, res) {
    try {
      const report = await generateAndStore(jira, storage)
      res.json(report)
    } catch (err) {
      console.error('[package-analysis] Generation failed:', err.message)
      res.status(500).json({ error: 'Report generation failed', detail: err.message })
    }
  })

  context.registerRefresh('analysis', {
    order: 200,
    timeout: 600000,
    handler: async function() {
      if (DEMO_MODE) return
      await generateAndStore(jira, storage)
    },
  })

  context.registerDiagnostics(async function() {
    const index = readFromStorage(INDEX_PATH)
    const hasReports = index && index.length > 0
    return {
      status: hasReports ? 'ok' : 'no_data',
      latestReport: hasReports ? index[0].report_date : null,
      reportCount: hasReports ? index.length : 0,
    }
  })
}
