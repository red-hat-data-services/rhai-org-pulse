const { proxyGet } = require('./proxy');

const CONFIG_PATH = 'system-health/promotion-gates/config.json';

const DEFAULT_CONFIG = {
  baseUrl: ''
};

async function getConfig(readFromStorage) {
  const saved = await readFromStorage(CONFIG_PATH);
  if (saved && typeof saved === 'object' && !saved._deleted && saved.baseUrl) {
    return { ...DEFAULT_CONFIG, ...saved };
  }
  const envUrl = process.env.PROMOTION_GATES_API_URL;
  if (envUrl) {
    return { ...DEFAULT_CONFIG, baseUrl: envUrl };
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Sub-router for the Promotion Gates page. Proxies the AIPCC Dashboard API's
 * promotion-gates endpoints server-side (same pattern as product-builds), so
 * the browser never sees the dashboard URL and no CORS setup is needed.
 */
module.exports = function registerPromotionGatesRoutes(router, context) {
  const { storage, requireAdmin } = context;
  const { readFromStorage, writeToStorage } = storage;

  async function upstream(upstreamPath, req, res) {
    const { baseUrl } = await getConfig(readFromStorage);
    // The dashboard exposes promotion-gates under /promotion-gates/...
    return proxyGet(baseUrl, upstreamPath, req.query, res);
  }

  // --- Config routes (admin) ---

  /**
   * @openapi
   * /api/modules/system-health/promotion-gates/config:
   *   get:
   *     tags: [System Health - Promotion Gates]
   *     summary: Get promotion gates configuration (admin)
   *     responses:
   *       200:
   *         description: Current configuration including AIPCC Dashboard API base URL
   */
  router.get('/config', requireAdmin, async function(req, res) {
    res.json(await getConfig(readFromStorage));
  });

  /**
   * @openapi
   * /api/modules/system-health/promotion-gates/config:
   *   post:
   *     tags: [System Health - Promotion Gates]
   *     summary: Save promotion gates configuration (admin)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               baseUrl:
   *                 type: string
   *                 description: Base URL of the AIPCC Dashboard API server
   *     responses:
   *       200:
   *         description: Configuration saved
   *       400:
   *         description: Invalid baseUrl (must be HTTP/HTTPS or empty string)
   */
  router.post('/config', requireAdmin, async function(req, res) {
    const { baseUrl } = req.body;
    if (typeof baseUrl !== 'string') {
      return res.status(400).json({ error: 'baseUrl must be a string' });
    }
    const trimmed = baseUrl.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      return res.status(400).json({ error: 'baseUrl must be an HTTP or HTTPS URL' });
    }
    await writeToStorage(CONFIG_PATH, { baseUrl: trimmed });
    res.json({ status: 'ok', baseUrl: trimmed });
  });

  /**
   * @openapi
   * /api/modules/system-health/promotion-gates/health:
   *   get:
   *     tags: [System Health - Promotion Gates]
   *     summary: Check AIPCC Dashboard API connectivity
   *     responses:
   *       200:
   *         description: Health status with latency
   */
  router.get('/health', async function(req, res) {
    const { baseUrl } = await getConfig(readFromStorage);
    if (!baseUrl) {
      return res.json({ status: 'not_configured' });
    }
    const start = Date.now();
    try {
      const upstreamRes = await fetch(baseUrl, {
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' }
      });
      res.json({
        status: upstreamRes.ok ? 'ok' : 'degraded',
        latency: Date.now() - start
      });
    } catch {
      res.json({
        status: 'unavailable',
        latency: Date.now() - start
      });
    }
  });

  // --- Proxy routes (AIPCC Dashboard API) ---

  /**
   * @openapi
   * /api/modules/system-health/promotion-gates/latest:
   *   get:
   *     tags: [System Health - Promotion Gates]
   *     summary: Get the latest promotion gates job
   *     description: Retrieves the most recent daily promotion-gates leader PR job, including gate statuses, early-gate build/test results, per-repo child PRs, and creator outcomes.
   *     responses:
   *       200:
   *         description: Latest PromotionGatesJob object
   *       404:
   *         description: No promotion gates data yet
   *       503:
   *         description: AIPCC Dashboard API not configured
   */
  router.get('/latest', async function(req, res) {
    await upstream('/promotion-gates/latest', req, res);
  });

  /**
   * @openapi
   * /api/modules/system-health/promotion-gates/jobs:
   *   get:
   *     tags: [System Health - Promotion Gates]
   *     summary: List promotion gates jobs
   *     description: Retrieves a paginated list of promotion-gates jobs. Pagination via X-Total-Count and X-Total-Pages response headers, forwarded from the AIPCC Dashboard API.
   *     parameters:
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 20
   *         description: Page size
   *       - name: offset
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *         description: Page offset
   *     responses:
   *       200:
   *         description: Array of PromotionGatesJob objects
   *       503:
   *         description: AIPCC Dashboard API not configured
   */
  router.get('/jobs', async function(req, res) {
    await upstream('/promotion-gates/jobs', req, res);
  });

  /**
   * @openapi
   * /api/modules/system-health/promotion-gates/jobs/{prNumber}:
   *   get:
   *     tags: [System Health - Promotion Gates]
   *     summary: Get a single promotion gates job
   *     description: Retrieves one promotion-gates job by its leader PR number.
   *     parameters:
   *       - name: prNumber
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: Leader PR number
   *     responses:
   *       200:
   *         description: PromotionGatesJob object
   *       404:
   *         description: Job not found
   *       503:
   *         description: AIPCC Dashboard API not configured
   */
  router.get('/jobs/:number', async function(req, res) {
    const number = parseInt(req.params.number, 10);
    if (!Number.isInteger(number) || number <= 0) {
      return res.status(400).json({ error: 'prNumber must be a positive integer' });
    }
    await upstream(`/promotion-gates/jobs/${number}`, req, res);
  });
};

module.exports.getConfig = getConfig;
