const { proxyGet } = require('./proxy');

const CONFIG_PATH = 'product-builds/config.json';

const DEFAULT_CONFIG = {
  baseUrl: ''
};

function getConfig(readFromStorage) {
  const saved = readFromStorage(CONFIG_PATH);
  if (saved && typeof saved === 'object' && !saved._deleted && saved.baseUrl) {
    return { ...DEFAULT_CONFIG, ...saved };
  }
  const envUrl = process.env.PRODUCT_BUILDS_API_URL;
  if (envUrl) {
    return { ...DEFAULT_CONFIG, baseUrl: envUrl };
  }
  return { ...DEFAULT_CONFIG };
}

module.exports = function registerRoutes(router, context) {
  const { storage, requireAdmin } = context;
  const { readFromStorage, writeToStorage } = storage;

  // --- Config routes (admin) ---

  /**
   * @openapi
   * /api/modules/product-builds/config:
   *   get:
   *     tags: [Product Builds]
   *     summary: Get product builds configuration (admin)
   *     responses:
   *       200:
   *         description: Current configuration including AIPCC Dashboard API base URL
   */
  router.get('/config', requireAdmin, function(req, res) {
    res.json(getConfig(readFromStorage));
  });

  /**
   * @openapi
   * /api/modules/product-builds/config:
   *   post:
   *     tags: [Product Builds]
   *     summary: Save product builds configuration (admin)
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
  router.post('/config', requireAdmin, function(req, res) {
    const { baseUrl } = req.body;
    if (typeof baseUrl !== 'string') {
      return res.status(400).json({ error: 'baseUrl must be a string' });
    }
    const trimmed = baseUrl.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      return res.status(400).json({ error: 'baseUrl must be an HTTP or HTTPS URL' });
    }
    writeToStorage(CONFIG_PATH, { baseUrl: trimmed });
    res.json({ status: 'ok', baseUrl: trimmed });
  });

  /**
   * @openapi
   * /api/modules/product-builds/health:
   *   get:
   *     tags: [Product Builds]
   *     summary: Check AIPCC Dashboard API connectivity
   *     responses:
   *       200:
   *         description: Health status with latency
   */
  router.get('/health', async function(req, res) {
    const { baseUrl } = getConfig(readFromStorage);
    if (!baseUrl) {
      return res.json({ status: 'not_configured' });
    }
    const start = Date.now();
    try {
      const upstream = await fetch(baseUrl, {
        signal: AbortSignal.timeout(5000),
        headers: { 'Accept': 'application/json' }
      });
      res.json({
        status: upstream.ok ? 'ok' : 'degraded',
        latency: Date.now() - start
      });
    } catch {
      res.json({
        status: 'unavailable',
        latency: Date.now() - start
      });
    }
  });

  // --- Helper to get baseUrl for proxy ---

  function upstream(upstreamPath, req, res) {
    const { baseUrl } = getConfig(readFromStorage);
    return proxyGet(baseUrl, upstreamPath, req.query, res);
  }

  // --- Proxy routes (AIPCC Dashboard API) ---

  /**
   * @openapi
   * /api/modules/product-builds/products/{key}:
   *   get:
   *     tags: [Product Builds]
   *     summary: Get product details
   *     description: Retrieves a single product by its key, including supported versions, Konflux namespace, and sync status.
   *     parameters:
   *       - name: key
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Product key (e.g. rhaiis, rhel-ai)
   *     responses:
   *       200:
   *         description: Product object with key, product_name, short_name, supported_versions, drop_strategy, sync status
   *       404:
   *         description: Product not found
   *       503:
   *         description: AIPCC Dashboard API not configured
   */
  router.get('/products/:key', function(req, res) {
    upstream(`/products/${encodeURIComponent(req.params.key)}`, req, res);
  });

  /**
   * @openapi
   * /api/modules/product-builds/drops:
   *   get:
   *     tags: [Product Builds]
   *     summary: List drops with filtering and pagination
   *     description: Retrieves drops with filtering by series, version pattern, artifact type, publication status, and date range. Pagination via X-Total-Count and X-Total-Pages response headers.
   *     parameters:
   *       - name: product_key
   *         in: query
   *         required: true
   *         schema:
   *           type: string
   *         description: Product key to filter drops
   *       - name: series
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by product version series
   *       - name: artifact_type
   *         in: query
   *         schema:
   *           type: string
   *           enum: [base-images, containers, disk-images, wheels-collections]
   *         description: Filter to drops containing this artifact type
   *       - name: supported_only
   *         in: query
   *         schema:
   *           type: boolean
   *         description: Only return drops for supported product versions
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 1000
   *           default: 50
   *       - name: offset
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *     responses:
   *       200:
   *         description: Array of Drop objects (key, name, product_key, product_version, git_branch, environments, release_timings, created_at)
   */
  router.get('/drops', function(req, res) {
    upstream('/drops', req, res);
  });

  /**
   * @openapi
   * /api/modules/product-builds/drops/{key}:
   *   get:
   *     tags: [Product Builds]
   *     summary: Get drop details
   *     description: Retrieves a single drop by its key, including release timings, environments, and git branch.
   *     parameters:
   *       - name: key
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Unique drop key
   *     responses:
   *       200:
   *         description: Drop object
   *       404:
   *         description: Drop not found
   */
  router.get('/drops/:key', function(req, res) {
    upstream(`/drops/${encodeURIComponent(req.params.key)}`, req, res);
  });

  /**
   * @openapi
   * /api/modules/product-builds/drops/{key}/changelog:
   *   get:
   *     tags: [Product Builds]
   *     summary: Get drop changelog
   *     description: Returns commits between this drop and the previous drop, aggregated across all repositories.
   *     parameters:
   *       - name: key
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Unique drop key
   *     responses:
   *       200:
   *         description: Object with drop_key and changelogs (commits grouped by repository)
   *       404:
   *         description: Drop not found
   */
  router.get('/drops/:key/changelog', function(req, res) {
    upstream(`/drops/${encodeURIComponent(req.params.key)}/changelog`, req, res);
  });

  /**
   * @openapi
   * /api/modules/product-builds/drops/{key}/metrics:
   *   get:
   *     tags: [Product Builds]
   *     summary: Get drop metrics
   *     description: Computes Konflux release statistics for a drop, aggregating build and release metrics including timeline, counts, and per-component release status.
   *     parameters:
   *       - name: key
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Unique drop key
   *     responses:
   *       200:
   *         description: Aggregated build and release metrics for the drop
   *       404:
   *         description: Drop not found
   */
  router.get('/drops/:key/metrics', function(req, res) {
    upstream(`/drops/${encodeURIComponent(req.params.key)}/metrics`, req, res);
  });

  /**
   * @openapi
   * /api/modules/product-builds/series:
   *   get:
   *     tags: [Product Builds]
   *     summary: List product series (versions)
   *     description: Returns unique series (product_versions) for a product, sorted by semantic version.
   *     parameters:
   *       - name: product_key
   *         in: query
   *         required: true
   *         schema:
   *           type: string
   *         description: Product key to get series for
   *     responses:
   *       200:
   *         description: Array of series name strings
   */
  router.get('/series', function(req, res) {
    upstream('/series', req, res);
  });

  /**
   * @openapi
   * /api/modules/product-builds/artifacts/build-sequences:
   *   get:
   *     tags: [Product Builds]
   *     summary: Get build sequence summaries for a batch of artifacts
   *     description: Returns build_sequence_summary JSON strings for up to 50 artifact keys. Used by list views to populate package detail columns on demand.
   *     parameters:
   *       - name: keys
   *         in: query
   *         required: true
   *         schema:
   *           type: string
   *         description: Comma-separated list of artifact keys (max 50)
   *     responses:
   *       200:
   *         description: Object mapping each key to its build_sequence_summary string (or null)
   *       400:
   *         description: Too many keys (over 50)
   */
  router.get('/artifacts/build-sequences', function(req, res) {
    upstream('/artifacts/build-sequences', req, res);
  });

  /**
   * @openapi
   * /api/modules/product-builds/artifacts/wheels-collections/filters:
   *   get:
   *     tags: [Product Builds]
   *     summary: Get wheel collection filter options
   *     description: Returns available product keys and variants for wheel-collection artifacts, used to populate filter dropdowns.
   *     responses:
   *       200:
   *         description: Object with product_keys (string[]) and variants (string[])
   */
  router.get('/artifacts/wheels-collections/filters', function(req, res) {
    upstream('/artifacts/wheels-collections/filters', req, res);
  });

  /**
   * @openapi
   * /api/modules/product-builds/artifacts/wheels/build-history/{packageName}:
   *   get:
   *     tags: [Product Builds]
   *     summary: Search wheel collections by package name
   *     description: Finds wheel-collection artifacts that contain the specified Python package in their build sequence.
   *     parameters:
   *       - name: packageName
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Python package name to search for (e.g. vllm, transformers)
   *       - name: product_key
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by product key
   *       - name: series
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by version series (requires product_key)
   *       - name: variant_filter
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by variant
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           default: 20
   *       - name: offset
   *         in: query
   *         schema:
   *           type: integer
   *           default: 0
   *     responses:
   *       200:
   *         description: Array of objects with artifact_key, variant, package_version, created_at
   */
  router.get('/artifacts/wheels/build-history/:packageName', function(req, res) {
    upstream(`/artifacts/wheels/build-history/${encodeURIComponent(req.params.packageName)}`, req, res);
  });

  /**
   * @openapi
   * /api/modules/product-builds/artifacts:
   *   get:
   *     tags: [Product Builds]
   *     summary: List artifacts with filtering and pagination
   *     description: Retrieves artifacts with optional filtering by product, drop, series, type, accelerator, environment, and architecture. Pagination headers X-Total-Count and X-Total-Pages are forwarded from the AIPCC Dashboard API.
   *     parameters:
   *       - name: product_key
   *         in: query
   *         schema:
   *           type: string
   *         description: Return artifacts for drops of this product
   *       - name: drop_key
   *         in: query
   *         schema:
   *           type: string
   *         description: Return artifacts for this specific drop
   *       - name: type
   *         in: query
   *         schema:
   *           type: string
   *           enum: [base-images, containers, disk-images, wheels-collections]
   *         description: Filter by artifact type
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 1000
   *           default: 50
   *       - name: offset
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *     responses:
   *       200:
   *         description: Array of Artifact objects (key, type, variant, archs, environments, commit, created_at, sha_digest, labels, konflux_data, constraints_file, build_sequence_summary)
   */
  router.get('/artifacts', function(req, res) {
    upstream('/artifacts', req, res);
  });

  /**
   * @openapi
   * /api/modules/product-builds/artifacts/{key}:
   *   get:
   *     tags: [Product Builds]
   *     summary: Get artifact details
   *     description: Retrieves a single artifact by its unique key, including labels, Konflux build data, SBOM links, constraints file, and build sequence summary.
   *     parameters:
   *       - name: key
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Unique artifact key (e.g. quay.io/org/image:tag)
   *     responses:
   *       200:
   *         description: Full Artifact object
   *       404:
   *         description: Artifact not found
   */
  router.get('/artifacts/:key', function(req, res) {
    upstream(`/artifacts/${encodeURIComponent(req.params.key)}`, req, res);
  });

  /**
   * @openapi
   * /api/modules/product-builds/artifacts/{key}/wheels:
   *   get:
   *     tags: [Product Builds]
   *     summary: Get wheel collections for an artifact
   *     description: Returns wheels-collections artifacts that are dependencies of the specified container artifact.
   *     parameters:
   *       - name: key
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Artifact key of the container
   *     responses:
   *       200:
   *         description: Array of wheel-collection Artifact objects
   *       404:
   *         description: Artifact not found
   */
  router.get('/artifacts/:key/wheels', function(req, res) {
    upstream(`/artifacts/${encodeURIComponent(req.params.key)}/wheels`, req, res);
  });

  /**
   * @openapi
   * /api/modules/product-builds/artifacts/{key}/containers:
   *   get:
   *     tags: [Product Builds]
   *     summary: Get containers using an artifact
   *     description: Returns container artifacts that depend on the specified wheels-collection or base-image artifact.
   *     parameters:
   *       - name: key
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Artifact key of the wheels-collection or base-image
   *     responses:
   *       200:
   *         description: Array of container Artifact objects
   *       400:
   *         description: Artifact is not a wheels-collection or base-image
   *       404:
   *         description: Artifact not found
   */
  router.get('/artifacts/:key/containers', function(req, res) {
    upstream(`/artifacts/${encodeURIComponent(req.params.key)}/containers`, req, res);
  });
};

module.exports.getConfig = getConfig;
