const { proxyGet } = require('./proxy');
const { createJiraClient } = require('../../../shared/server/jira');
const { buildReport, getPackagesOnboarded } = require('./analysis');
const {
  PACKAGE_NAME_RE,
  VERSION_RE,
  ALL_REPO_TYPES,
  DEFAULT_REPO_TYPES,
  fetchIndex,
  getBaseUrl,
  getVariants,
  getProductVersions,
  getDefaultProductVersion,
  getUpstreamPypiUrl,
  isUpstreamPypiEnabled,
  getCacheStats,
  pMap,
  MAX_CONCURRENT_FETCHES
} = require('./package-index');
const { parsePackageFile } = require('./wheel-parser');

const DEMO_MODE = process.env.DEMO_MODE === 'true';
const PKG_STORAGE_PREFIX = 'product-builds/package-reports';
const PKG_INDEX_PATH = `${PKG_STORAGE_PREFIX}/index.json`;

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
  const { storage, requireAdmin, RefreshSkip } = context;
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

  // --- Package Analysis ---

  let _jira;
  function getJira() {
    if (!_jira) {
      _jira = createJiraClient({
        email: (context.secrets && context.secrets.JIRA_EMAIL) || '',
        token: (context.secrets && context.secrets.JIRA_TOKEN) || '',
      });
    }
    return _jira;
  }

  function rebuildPackageIndex() {
    const files = storage.listStorageFiles(PKG_STORAGE_PREFIX + '/');
    const index = [];
    for (const file of files) {
      if (file === 'index.json' || !file.endsWith('.json')) continue;
      const report = readFromStorage(`${PKG_STORAGE_PREFIX}/${file}`);
      if (report && report.summary) {
        index.push({
          report_date: report.report_date,
          report_time: report.report_time,
          summary: report.summary,
        });
      }
    }
    index.sort((a, b) => b.report_date.localeCompare(a.report_date));
    return index;
  }

  async function generatePackageReport(reportDate) {
    const report = await buildReport(getJira(), { reportDate });
    writeToStorage(`${PKG_STORAGE_PREFIX}/${report.report_date}.json`, report);
    const index = rebuildPackageIndex();
    writeToStorage(PKG_INDEX_PATH, index);
    return report;
  }

  /**
   * @openapi
   * /api/modules/product-builds/package-reports:
   *   get:
   *     tags: [Package Analysis]
   *     summary: List all package analysis reports (summaries only)
   *     responses:
   *       200:
   *         description: Array of report summaries sorted by date descending
   */
  router.get('/package-reports', function(req, res) {
    const index = readFromStorage(PKG_INDEX_PATH);
    res.json(index || []);
  });

  /**
   * @openapi
   * /api/modules/product-builds/package-reports/latest:
   *   get:
   *     tags: [Package Analysis]
   *     summary: Get the most recent full package analysis report
   *     responses:
   *       200:
   *         description: Full report with categories and epic details
   *       404:
   *         description: No reports available
   */
  router.get('/package-reports/latest', function(req, res) {
    const index = readFromStorage(PKG_INDEX_PATH);
    if (!index || index.length === 0) {
      return res.status(404).json({ error: 'No reports available' });
    }
    const latest = readFromStorage(`${PKG_STORAGE_PREFIX}/${index[0].report_date}.json`);
    if (!latest) {
      return res.status(404).json({ error: 'Report file not found' });
    }
    res.json(latest);
  });

  /**
   * @openapi
   * /api/modules/product-builds/package-reports/onboarded:
   *   get:
   *     tags: [Package Analysis]
   *     summary: Get packages onboarded (closed) in a recent time window
   *     parameters:
   *       - name: days
   *         in: query
   *         schema:
   *           type: integer
   *           default: 7
   *         description: Number of days to look back (7, 14, or 30)
   *     responses:
   *       200:
   *         description: Array of onboarded package EPICs
   *       500:
   *         description: Failed to query JIRA
   */
  router.get('/package-reports/onboarded', async function(req, res) {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 7, 1), 90);
    try {
      const epics = await getPackagesOnboarded(getJira(), days);
      res.json({ days, count: epics.length, epics });
    } catch (err) {
      console.error('[package-analysis] Onboarded query failed:', err.message);
      res.status(500).json({ error: 'Failed to fetch onboarded packages' });
    }
  });

  /**
   * @openapi
   * /api/modules/product-builds/package-reports/{date}:
   *   get:
   *     tags: [Package Analysis]
   *     summary: Get full package analysis report for a specific date
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
  router.get('/package-reports/:date', function(req, res) {
    const date = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format, expected YYYY-MM-DD' });
    }
    const report = readFromStorage(`${PKG_STORAGE_PREFIX}/${date}.json`);
    if (!report) {
      return res.status(404).json({ error: `No report for ${date}` });
    }
    res.json(report);
  });

  /**
   * @openapi
   * /api/modules/product-builds/package-reports/generate:
   *   post:
   *     tags: [Package Analysis]
   *     summary: Generate a package analysis report for today (admin only)
   *     responses:
   *       200:
   *         description: Generated report
   *       500:
   *         description: Report generation failed
   */
  router.post('/package-reports/generate', requireAdmin, async function(req, res) {
    try {
      const report = await generatePackageReport();
      res.json(report);
    } catch (err) {
      console.error('[package-analysis] Generation failed:', err.message);
      res.status(500).json({ error: 'Report generation failed' });
    }
  });

  if (context.registerRefresh) {
    context.registerRefresh('package-analysis', {
      description: 'Generate daily AIPCC package analysis report from JIRA (after 6am UTC)',
      order: 200,
      timeout: 600000,
      cadence: '24h',
      handler: async function() {
        if (DEMO_MODE) return new RefreshSkip('Demo mode');
        const now = new Date();
        if (now.getUTCHours() < 6) {
          return new RefreshSkip('Before 6am UTC');
        }
        const today = now.toISOString().slice(0, 10);
        const existing = readFromStorage(`${PKG_STORAGE_PREFIX}/${today}.json`);
        if (existing) {
          return new RefreshSkip('Report already exists for ' + today);
        }
        await generatePackageReport(today);
      },
    });
  }

  // --- Package Search ---

  /**
   * @openapi
   * /api/modules/product-builds/package-search/options:
   *   get:
   *     tags: [Package Search]
   *     summary: Get available filter options for package search
   *     responses:
   *       200:
   *         description: Available variants, repo types, product versions, and package UI URL
   */
  router.get('/package-search/options', function (_req, res) {
    const variants = getVariants();
    const productVersions = getProductVersions();
    const defaultProductVersion = getDefaultProductVersion();

    const baseUrl = getBaseUrl();
    let packageUiUrl = null;
    const parts = baseUrl.split('/api/pypi/');
    if (parts.length === 2) {
      const origin = parts[0];
      const domain = parts[1].split('/')[0];
      packageUiUrl = origin + '/domains/' + domain + '/distributions';
    }

    res.json({
      variants,
      repo_types: Object.keys(ALL_REPO_TYPES),
      default_repo_types: DEFAULT_REPO_TYPES,
      product_versions: productVersions,
      default_product_version: defaultProductVersion,
      package_ui_url: packageUiUrl,
      upstream_pypi_available: isUpstreamPypiEnabled()
    });
  });

  /**
   * @openapi
   * /api/modules/product-builds/package-search/search:
   *   get:
   *     tags: [Package Search]
   *     summary: Search for a package across PyPI Simple indexes
   *     parameters:
   *       - name: package_name
   *         in: query
   *         required: true
   *         schema:
   *           type: string
   *         description: Package name to search for
   *       - name: package_version
   *         in: query
   *         schema:
   *           type: string
   *         description: Optional version filter (e.g. 2.5.1)
   *       - name: product_version
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter to a specific product version
   *       - name: variant
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter to a specific variant (e.g. cpu-ubi9)
   *       - name: repo_type
   *         in: query
   *         schema:
   *           type: string
   *         description: Repo types to check (repeatable, default test+production)
   *       - name: expand_upstream
   *         in: query
   *         schema:
   *           type: string
   *           enum: ['true']
   *         description: When 'true', also search upstream PyPI for newer versions
   *     responses:
   *       200:
   *         description: Search results with package availability across indexes
   *       422:
   *         description: Validation error
   */
  router.get('/package-search/search', async function (req, res) {
    const { package_name, package_version, product_version, variant } = req.query;
    const expandUpstream = req.query.expand_upstream === 'true' && isUpstreamPypiEnabled();
    let repoTypeParam = req.query.repo_type;

    if (!package_name || !PACKAGE_NAME_RE.test(package_name)) {
      return res.status(422).json({
        error: 'Invalid package name',
        message: 'Package name must match ^[a-zA-Z][a-zA-Z0-9._-]*$'
      });
    }

    let requestedVersion = null;
    if (package_version) {
      const versionStr = package_version.replace(/^v/, '');
      if (!VERSION_RE.test(versionStr)) {
        return res.status(422).json({
          error: 'Invalid version',
          message: 'Version must match ^[a-zA-Z0-9._-]+$'
        });
      }
      requestedVersion = versionStr;
    }

    const allVariants = getVariants();
    const allProductVersions = getProductVersions();

    if (product_version) {
      if (!/^\d+\.\d+(-EA\d+)?$/.test(product_version)) {
        return res.status(422).json({
          error: 'Invalid product version',
          message: 'Must be a version like 3.4 or 3.5-EA1'
        });
      }
    }
    const selectedProductVersions = product_version ? [product_version] : allProductVersions;

    if (variant && !allVariants.includes(variant)) {
      return res.status(422).json({
        error: 'Invalid variant',
        message: 'Must be one of: ' + allVariants.join(', ')
      });
    }
    const selectedVariants = variant ? [variant] : allVariants;

    if (repoTypeParam && !Array.isArray(repoTypeParam)) {
      repoTypeParam = [repoTypeParam];
    }
    const selectedRepoTypes = repoTypeParam || DEFAULT_REPO_TYPES;
    const invalidRepoTypes = selectedRepoTypes.filter(function (rt) {
      return !(rt in ALL_REPO_TYPES);
    });
    if (invalidRepoTypes.length > 0) {
      return res.status(422).json({
        error: 'Invalid repo type(s)',
        message: 'Must be one of: ' + Object.keys(ALL_REPO_TYPES).join(', ')
      });
    }

    const baseUrl = getBaseUrl();
    const seenUrls = new Set();
    const tasks = [];

    for (const pv of selectedProductVersions) {
      for (const v of selectedVariants) {
        for (const rt of selectedRepoTypes) {
          const suffix = ALL_REPO_TYPES[rt];
          const indexUrl = baseUrl + '/' + pv + '/' + v + suffix + '/simple/';
          if (seenUrls.has(indexUrl)) continue;
          seenUrls.add(indexUrl);
          tasks.push({ productVersion: pv, variant: v, repoType: rt, indexUrl });
        }
      }
    }

    if (expandUpstream) {
      const upstreamUrl = getUpstreamPypiUrl();
      tasks.push({
        productVersion: 'upstream-pypi',
        variant: 'pypi.org',
        repoType: 'upstream',
        indexUrl: upstreamUrl,
        source: 'upstream'
      });
    }

    const results = await pMap(tasks, async function (task) {
      try {
        const raw = await fetchIndex(task.indexUrl, package_name);
        let files = [];
        if (raw.found && raw.files) {
          files = raw.files.map(function (f) {
            return { ...parsePackageFile(f.filename, f.url), uploadTime: f.uploadTime || null };
          });
          if (requestedVersion) {
            files = files.filter(function (f) {
              return f.version !== 'unknown' && f.version === requestedVersion;
            });
          }
        }
        const result = {
          product_version: task.productVersion,
          variant: task.variant,
          repo_type: task.repoType,
          index_url: task.indexUrl,
          index_exists: raw.indexExists,
          found: raw.found,
          files,
          format: raw.format || null,
          error: raw.error,
          source: task.source || 'internal'
        };
        return result;
      } catch (err) {
        return {
          product_version: task.productVersion,
          variant: task.variant,
          repo_type: task.repoType,
          index_url: task.indexUrl,
          index_exists: false,
          found: false,
          files: [],
          error: err.message,
          source: task.source || 'internal'
        };
      }
    }, MAX_CONCURRENT_FETCHES);

    res.json({
      package_name,
      requested_version: requestedVersion,
      total: tasks.length,
      results
    });
  });

  // --- Nightly Pipeline Analysis ---
  require('./nightly-pipeline')(router, context);

  // --- Version Map ---
  require('./version-map')(router, context);

  // --- Package Tracker ---
  require('./package-tracker')(router, context);

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const index = readFromStorage(PKG_INDEX_PATH);
      const hasReports = index && index.length > 0;
      return {
        status: hasReports ? 'ok' : 'no_data',
        latestReport: hasReports ? index[0].report_date : null,
        reportCount: hasReports ? index.length : 0,
        packageSearchCache: getCacheStats(),
      };
    });
  }

  if (context.registerExport) {
    context.registerExport(require('./export'));
  }
};

module.exports.getConfig = getConfig;
