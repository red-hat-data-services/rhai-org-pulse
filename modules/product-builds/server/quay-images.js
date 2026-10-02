const retry = require('async-retry');

const QUAY_API_BASE = 'https://quay.io/api/v1';
const CACHE_KEY = 'product-builds/quay-images/cache.json';
const REPOS_KEY = 'product-builds/quay-images/repos.json';
const CACHE_TTL_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;
const RETRIES = 2;

const DEMO_MODE = process.env.DEMO_MODE === 'true';

const DEFAULT_REPOS = [
  { namespace: 'opendatahub', repo: 'odh-openshell-gateway', component: 'OpenShell', stream: 'ODH' },
  { namespace: 'opendatahub', repo: 'odh-openshell-supervisor', component: 'OpenShell', stream: 'ODH' },
  { namespace: 'opendatahub', repo: 'odh-openshell-sandbox', component: 'OpenShell', stream: 'ODH' },
  { namespace: 'opendatahub', repo: 'odh-openshell-cli', component: 'OpenShell', stream: 'ODH' },
  { namespace: 'rhoai', repo: 'odh-openshell-gateway-rhel9', component: 'OpenShell', stream: 'RHOAI' },
  { namespace: 'rhoai', repo: 'odh-openshell-supervisor-rhel9', component: 'OpenShell', stream: 'RHOAI' },
  { namespace: 'rhoai', repo: 'odh-openshell-sandbox-rhel9', component: 'OpenShell', stream: 'RHOAI' },
  { namespace: 'rhoai', repo: 'odh-openshell-cli-rhel9', component: 'OpenShell', stream: 'RHOAI' },
];

async function fetchRepoTags(namespace, repo, token) {
  const url = `${QUAY_API_BASE}/repository/${namespace}/${repo}/tag/?onlyActiveTags=true&limit=20`;
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await retry(async function(bail) {
    let r;
    try {
      r = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      if (err.name === 'TimeoutError') bail(err);
      throw err;
    }
    if (r.status === 401 || r.status === 403) {
      bail(new Error(`Auth required for ${namespace}/${repo} (HTTP ${r.status})`));
    }
    if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
    return r;
  }, { retries: RETRIES, minTimeout: 500 });

  if (!response.ok) {
    return { error: `HTTP ${response.status}`, tags: [] };
  }

  const data = await response.json();
  const tags = (data.tags || []).map(function(t) {
    return {
      name: t.name,
      manifest_digest: t.manifest_digest,
      size: t.size || null,
      last_modified: t.last_modified,
      is_manifest_list: t.is_manifest_list || false,
    };
  });

  return { tags, has_additional: data.has_additional || false };
}

async function refreshCache(repos, readFromStorage, writeToStorage, token) {
  const results = [];

  for (const entry of repos) {
    try {
      const data = await fetchRepoTags(entry.namespace, entry.repo, token);
      results.push({
        namespace: entry.namespace,
        repo: entry.repo,
        component: entry.component,
        stream: entry.stream,
        pullspec: `quay.io/${entry.namespace}/${entry.repo}`,
        quay_url: `https://quay.io/repository/${entry.namespace}/${entry.repo}?tab=tags`,
        tags: data.tags,
        has_additional: data.has_additional,
        error: data.error || null,
        fetched_at: new Date().toISOString(),
      });
    } catch (err) {
      results.push({
        namespace: entry.namespace,
        repo: entry.repo,
        component: entry.component,
        stream: entry.stream,
        pullspec: `quay.io/${entry.namespace}/${entry.repo}`,
        quay_url: `https://quay.io/repository/${entry.namespace}/${entry.repo}?tab=tags`,
        tags: [],
        has_additional: false,
        error: err.message,
        fetched_at: new Date().toISOString(),
      });
    }
  }

  const cache = { repos: results, refreshed_at: new Date().toISOString() };
  await writeToStorage(CACHE_KEY, cache);
  return cache;
}

module.exports = function registerQuayRoutes(router, context) {
  const { storage, requireAdmin, RefreshSkip } = context;
  const { readFromStorage, writeToStorage } = storage;

  function getToken() {
    return (context.secrets && context.secrets.QUAY_ROBOT_TOKEN) || null;
  }

  async function getRepos() {
    const saved = await readFromStorage(REPOS_KEY);
    if (saved && Array.isArray(saved.repos) && saved.repos.length > 0) return saved.repos;
    return DEFAULT_REPOS;
  }

  async function getCachedOrRefresh() {
    const cached = await readFromStorage(CACHE_KEY);
    if (cached && cached.refreshed_at) {
      const age = Date.now() - new Date(cached.refreshed_at).getTime();
      if (age < CACHE_TTL_MS || DEMO_MODE) return cached;
    }
    if (DEMO_MODE) return { repos: [], refreshed_at: null };
    const repos = await getRepos();
    return refreshCache(repos, readFromStorage, writeToStorage, getToken());
  }

  /**
   * @openapi
   * /api/modules/product-builds/quay-images:
   *   get:
   *     tags: [Product Builds]
   *     summary: Get Quay container image tags for tracked repos
   *     description: Returns cached tag metadata for all configured Quay repositories. Data is refreshed automatically every 15 minutes.
   *     parameters:
   *       - name: stream
   *         in: query
   *         schema:
   *           type: string
   *           enum: [ODH, RHOAI]
   *         description: Filter by image stream
   *       - name: component
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by component name
   *     responses:
   *       200:
   *         description: Object with repos array and refreshed_at timestamp
   *       502:
   *         description: Failed to fetch Quay image data
   */
  router.get('/quay-images', async function(req, res) {
    try {
      const data = await getCachedOrRefresh();
      let repos = data.repos || [];
      if (req.query.stream) {
        repos = repos.filter(function(r) { return r.stream === req.query.stream; });
      }
      if (req.query.component) {
        repos = repos.filter(function(r) { return r.component === req.query.component; });
      }
      res.json({ repos, refreshed_at: data.refreshed_at });
    } catch (err) {
      console.error('[product-builds] Quay images fetch error:', err.message);
      res.status(502).json({ error: 'Failed to fetch Quay image data' });
    }
  });

  /**
   * @openapi
   * /api/modules/product-builds/quay-images/repos:
   *   get:
   *     tags: [Product Builds]
   *     summary: Get tracked Quay repository configuration
   *     responses:
   *       200:
   *         description: Object with repos array of tracked repository definitions
   */
  router.get('/quay-images/repos', async function(req, res) {
    const repos = await getRepos();
    res.json({ repos });
  });

  /**
   * @openapi
   * /api/modules/product-builds/quay-images/repos:
   *   post:
   *     tags: [Product Builds]
   *     summary: Update tracked Quay repository configuration (admin)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               repos:
   *                 type: array
   *                 items:
   *                   type: object
   *                   required: [namespace, repo, component, stream]
   *                   properties:
   *                     namespace:
   *                       type: string
   *                     repo:
   *                       type: string
   *                     component:
   *                       type: string
   *                     stream:
   *                       type: string
   *     responses:
   *       200:
   *         description: Configuration saved
   *       400:
   *         description: Invalid repos format
   */
  router.post('/quay-images/repos', requireAdmin, async function(req, res) {
    const { repos } = req.body;
    if (!Array.isArray(repos)) {
      return res.status(400).json({ error: 'repos must be an array' });
    }
    for (const r of repos) {
      if (!r.namespace || !r.repo || !r.component || !r.stream) {
        return res.status(400).json({ error: 'Each repo must have namespace, repo, component, and stream' });
      }
    }
    await writeToStorage(REPOS_KEY, { repos });
    res.json({ status: 'ok', count: repos.length });
  });

  /**
   * @openapi
   * /api/modules/product-builds/quay-images/refresh:
   *   post:
   *     tags: [Product Builds]
   *     summary: Force refresh Quay image tag cache (admin)
   *     responses:
   *       200:
   *         description: Cache refreshed with latest tag data
   *       502:
   *         description: Refresh failed
   */
  router.post('/quay-images/refresh', requireAdmin, async function(req, res) {
    try {
      const repos = await getRepos();
      const data = await refreshCache(repos, readFromStorage, writeToStorage, getToken());
      res.json(data);
    } catch (err) {
      console.error('[product-builds] Quay refresh error:', err.message);
      res.status(502).json({ error: 'Refresh failed: ' + err.message });
    }
  });

  if (context.registerRefresh) {
    context.registerRefresh('quay-images', {
      description: 'Refresh Quay container image tag cache',
      order: 300,
      timeout: 120000,
      cadence: '15m',
      handler: async function() {
        if (DEMO_MODE) return new RefreshSkip('Demo mode');
        const repos = await getRepos();
        await refreshCache(repos, readFromStorage, writeToStorage, getToken());
      },
    });
  }
};
