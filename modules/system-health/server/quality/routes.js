const express = require('express');
const { validateQualityReport } = require('./validation');
const {
  readReports,
  writeReportsAtomic,
  upsertReport,
  repoKeyFromSlug,
  getListProjection,
  countHistoryEntries,
  readHtmlReport,
  writeHtmlReport
} = require('./storage');

// Jira client - loaded at module level for consistency
let createJiraClient;
try {
  createJiraClient = require('@shared/jira').createJiraClient;
} catch {
  // Jira client may not be available in all environments
  createJiraClient = null;
}

const DEMO_MODE = process.env.DEMO_MODE === 'true';
const jsonLimit = express.json({ limit: '50mb' });
const BULK_CAP = 5000;

/**
 * Register quality report routes on the module router.
 * Static routes registered BEFORE parameterized routes.
 *
 * @param {import('express').Router} router
 * @param {object} context
 */
module.exports = function registerQualityRoutes(router, context) {
  const { storage, requireAuth, requireAdmin, requireScope } = context;
  const { readFromStorage, writeToStorage } = storage;

  // ─── Static routes FIRST ───

  /**
   * @openapi
   * /api/modules/system-health/quality/reports/status:
   *   get:
   *     summary: Quality report data status for settings page
   *     tags: [System Health - Quality Reports]
   *     responses:
   *       200:
   *         description: Data freshness info
   */
  router.get('/reports/status', requireAdmin, requireScope('system-health:read'), async function(req, res) {
    const data = await readReports(readFromStorage);
    res.json({
      lastSyncedAt: data.lastSyncedAt,
      totalReports: data.totalReports,
      totalHistoryEntries: countHistoryEntries(data)
    });
  });

  /**
   * @openapi
   * /api/modules/system-health/quality/reports/bulk:
   *   post:
   *     summary: Bulk upsert quality reports from CI pipeline
   *     tags: [System Health - Quality Reports]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               reports:
   *                 type: array
   *     responses:
   *       200:
   *         description: Upsert result with created/updated/unchanged counts
   */
  router.post('/reports/bulk', requireAdmin, requireScope('system-health:write'), jsonLimit, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Quality report ingest disabled in demo mode' });
    }

    const { reports } = req.body;
    if (!Array.isArray(reports)) {
      return res.status(400).json({ error: 'reports must be an array' });
    }
    if (reports.length > BULK_CAP) {
      return res.status(400).json({ error: 'Bulk payload exceeds maximum of ' + BULK_CAP + ' entries' });
    }

    const data = await readReports(readFromStorage);
    const counts = { created: 0, updated: 0, unchanged: 0 };
    const errors = [];

    for (const entry of reports) {
      if (!entry || typeof entry !== 'object') {
        errors.push({ id: 'unknown', error: 'Entry must be an object' });
        continue;
      }

      const result = validateQualityReport(entry);
      if (!result.valid) {
        errors.push({ id: entry.id || entry.repository || 'unknown', errors: result.errors });
        continue;
      }

      const repoKey = entry.id || repoKeyFromSlug(result.data.repository);
      const reportData = { ...result.data };

      if (entry.reportHtml && typeof entry.reportHtml === 'string') {
        try {
          await writeHtmlReport(writeToStorage, repoKey, entry.reportHtml);
          reportData.hasHtmlReport = true;
        } catch (err) {
          console.error('[system-health/quality] Failed to write HTML for %s: %s', repoKey, err.message);
        }
      }

      const status = upsertReport(data, repoKey, reportData);
      counts[status]++;
    }

    data.lastSyncedAt = new Date().toISOString();
    data.totalReports = Object.keys(data.reports).length;

    await writeReportsAtomic(writeToStorage, data);

    res.json({
      created: counts.created,
      updated: counts.updated,
      unchanged: counts.unchanged,
      errors
    });
  });

  /**
   * @openapi
   * /api/modules/system-health/quality/reports:
   *   delete:
   *     summary: Clear all quality report data (admin only)
   *     tags: [System Health - Quality Reports]
   *     responses:
   *       200:
   *         description: Data cleared
   */
  router.delete('/reports', requireAdmin, requireScope('system-health:write'), async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Quality report ingest disabled in demo mode' });
    }

    await writeReportsAtomic(writeToStorage, { lastSyncedAt: null, totalReports: 0, reports: {} });
    res.json({ status: 'cleared' });
  });

  /**
   * @openapi
   * /api/modules/system-health/quality/refresh:
   *   post:
   *     summary: Trigger manual quality report fetch from GitLab CI artifacts (admin only)
   *     tags: [System Health - Quality Reports]
   *     responses:
   *       200:
   *         description: Refresh result
   *       429:
   *         description: Cooldown active
   */
  if (context.scheduler) {
    router.post('/refresh', requireAdmin, requireScope('system-health:write'), async function(req, res) {
      if (DEMO_MODE) {
        return res.json({ status: 'skipped', message: 'Refresh disabled in demo mode' });
      }
      try {
        const result = await context.scheduler.manualRefresh(context.storage);
        if (result.httpStatus === 429) {
          return res.status(429).json({ status: result.status, retryAfter: result.retryAfter });
        }
        res.json(result);
      } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
      }
    });
  }

  /**
   * @openapi
   * /api/modules/system-health/quality/config:
   *   get:
   *     summary: Get quality report GitLab fetch configuration
   *     tags: [System Health - Quality Reports]
   *     responses:
   *       200:
   *         description: Current fetch configuration
   */
  router.get('/config', requireAdmin, requireScope('system-health:read'), async function(req, res) {
    const { getConfig } = require('./gitlab-fetch');
    res.json(await getConfig(readFromStorage));
  });

  /**
   * @openapi
   * /api/modules/system-health/quality/config:
   *   post:
   *     summary: Update quality report GitLab fetch configuration
   *     tags: [System Health - Quality Reports]
   *     responses:
   *       200:
   *         description: Configuration saved
   */
  router.post('/config', requireAdmin, requireScope('system-health:write'), express.json(), async function(req, res) {
    const { saveConfig } = require('./gitlab-fetch');
    try {
      const saved = await saveConfig(writeToStorage, req.body);
      res.json({ status: 'saved', config: saved });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ─── List route (before parameterized) ───

  /**
   * @openapi
   * /api/modules/system-health/quality/reports:
   *   get:
   *     summary: List all latest quality reports (slim projection)
   *     tags: [System Health - Quality Reports]
   *     responses:
   *       200:
   *         description: Quality report list with scores and metadata
   */
  router.get('/reports', requireAuth, requireScope('system-health:read'), async function(req, res) {
    const data = await readReports(readFromStorage);
    res.json(getListProjection(data));
  });

  // ─── Parameterized routes AFTER ───

  /**
   * @openapi
   * /api/modules/system-health/quality/reports/{key}/html:
   *   get:
   *     summary: Serve HTML quality report for a repository
   *     tags: [System Health - Quality Reports]
   *     parameters:
   *       - in: path
   *         name: key
   *         required: true
   *         schema: { type: string }
   *         description: Repo key in owner--repo format
   *     responses:
   *       200:
   *         description: HTML report
   *       404:
   *         description: Report not found
   */
  router.get('/reports/:key/html', requireAuth, requireScope('system-health:read'), async function(req, res) {
    const key = req.params.key;

    if (key.length > 200 || !/^[a-zA-Z0-9._-]+--[a-zA-Z0-9._-]+$/.test(key)) {
      return res.status(400).json({ error: 'Invalid repo key format. Expected owner--repo.' });
    }

    const html = await readHtmlReport(readFromStorage, key);
    if (!html) {
      return res.status(404).json({ error: 'HTML report not found for ' + key });
    }

    res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:;");
    res.type('html').send(html);
  });

  /**
   * @openapi
   * /api/modules/system-health/quality/reports/{key}:
   *   get:
   *     summary: Full quality report with history for a single repository
   *     tags: [System Health - Quality Reports]
   *     parameters:
   *       - in: path
   *         name: key
   *         required: true
   *         schema: { type: string }
   *         description: Repo key in owner--repo format
   *     responses:
   *       200:
   *         description: Report with history
   *       404:
   *         description: Report not found
   */
  router.get('/reports/:key', requireAuth, requireScope('system-health:read'), async function(req, res) {
    const key = req.params.key;

    if (key.length > 200 || !/^[a-zA-Z0-9._-]+--[a-zA-Z0-9._-]+$/.test(key)) {
      return res.status(400).json({ error: 'Invalid repo key format. Expected owner--repo.' });
    }

    const data = await readReports(readFromStorage);
    const entry = data.reports[key];
    if (!entry) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({
      latest: entry.latest,
      history: entry.history
    });
  });

  /**
   * @openapi
   * /api/modules/system-health/quality/jira-count:
   *   get:
   *     summary: Get Jira issue count for test-failed or test-skipped labels
   *     tags: [System Health - Quality Reports]
   *     parameters:
   *       - name: label
   *         in: query
   *         required: true
   *         schema:
   *           type: string
   *           enum: [test-failed, test-skipped]
   *         description: Jira label to count (test-failed or test-skipped)
   *       - name: component
   *         in: query
   *         required: false
   *         schema:
   *           type: string
   *         description: Optional component name filter
   *       - name: version
   *         in: query
   *         required: false
   *         schema:
   *           type: string
   *         description: Optional version filter (e.g., "3.5", "3.6")
   *       - name: release
   *         in: query
   *         required: false
   *         schema:
   *           type: string
   *         description: Optional release filter (e.g., "EA1", "GA")
   *     responses:
   *       200:
   *         description: Issue count
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 count:
   *                   type: number
   *       400:
   *         description: Invalid or missing parameters
   */
  router.get('/jira-count', requireAuth, requireScope('system-health:read'), async function(req, res) {
    // Security: Build JQL server-side from validated parameters instead of accepting raw JQL
    const { label, component, version, release } = req.query;
    
    // Validate label parameter (required, must be from allowlist)
    const allowedLabels = ['test-failed', 'test-skipped'];
    if (!label || !allowedLabels.includes(label)) {
      return res.status(400).json({ 
        error: 'Invalid or missing label parameter. Allowed: ' + allowedLabels.join(', ') 
      });
    }

    // Security: Sanitize all user inputs - reject values with JQL injection characters
    const sanitizeParam = (val) => {
      if (!val || val === 'All') return null;
      // Reject if contains quotes, parentheses, backslashes, or JQL operators
      if (/["'()\\]/.test(val) || /\b(AND|OR|NOT|IN|IS|WAS|ORDER BY)\b/i.test(val)) {
        return null;
      }
      return val.trim();
    };

    const safeComponent = sanitizeParam(component);
    const safeVersion = sanitizeParam(version);
    const safeRelease = sanitizeParam(release);

    // Validate: if user provided a value but it failed sanitization, reject
    if (component && component !== 'All' && !safeComponent) {
      return res.status(400).json({ error: 'Invalid component parameter' });
    }
    if (version && version !== 'All' && !safeVersion) {
      return res.status(400).json({ error: 'Invalid version parameter' });
    }
    if (release && release !== 'All' && !safeRelease) {
      return res.status(400).json({ error: 'Invalid release parameter' });
    }

    // Build JQL server-side - always restricted to RHOAIENG project
    let jql = `project = RHOAIENG AND labels = "${label}"`;
    
    if (safeComponent) {
      jql += ` AND component = "${safeComponent}"`;
    }
    if (safeVersion) {
      jql += ` AND (fixVersion ~ "${safeVersion}" OR 'Target Version' ~ "${safeVersion}")`;
    }
    // Note: release filtering is typically done via version matching patterns

    // Check if Jira client is available
    if (!createJiraClient) {
      return res.status(503).json({ error: 'Jira client not available' });
    }

    try {
      const jiraClient = createJiraClient(context.secrets);
      const result = await jiraClient.search(jql, { maxResults: 0 });
      res.json({ count: result.total || 0 });
    } catch (error) {
      // Security: Return generic error message to avoid leaking internal details
      console.error('[system-health/quality] Jira count query failed:', error.message);
      res.status(500).json({ error: 'Failed to query Jira' });
    }
  });

  /**
   * @openapi
   * /api/modules/system-health/quality/tfa-charts:
   *   get:
   *     summary: Get TFA (Test Failure Analysis) chart data for a version and release
   *     tags: [System Health - Quality Reports]
   *     parameters:
   *       - name: version
   *         in: query
   *         required: true
   *         schema:
   *           type: string
   *         description: RHOAI version (e.g., "3.5", "3.6") or "All"
   *       - name: release
   *         in: query
   *         required: true
   *         schema:
   *           type: string
   *         description: Release type (e.g., "EA1", "GA") or "All"
   *       - name: from_date
   *         in: query
   *         required: false
   *         schema:
   *           type: string
   *         description: Start date (YYYY-MM-DD format)
   *       - name: to_date
   *         in: query
   *         required: false
   *         schema:
   *           type: string
   *         description: End date (YYYY-MM-DD format)
   *       - name: component
   *         in: query
   *         required: false
   *         schema:
   *           type: string
   *         description: Component name to filter by (e.g., "AI Hub", "AI Pipelines")
   *     responses:
   *       200:
   *         description: TFA chart data with classification breakdown, per-component data, and status distribution
   *       400:
   *         description: Missing or invalid parameters
   *       500:
   *         description: Jira query failed
   */
  router.get('/tfa-charts', requireAuth, requireScope('system-health:read'), async function(req, res) {
    // Note: from_date, to_date, component are accepted for API compatibility but
    // filtering is done client-side from pre-computed data (HC3 compliance)
    const { version, release, from_date: _fromDate, to_date: _toDate, component: _component } = req.query;

    if (!version || !release) {
      return res.status(400).json({ error: 'Missing version or release parameter' });
    }

    // Security: Sanitize inputs
    const sanitizeParam = (val) => {
      if (!val || val === 'All') return val;
      // Reject if contains dangerous characters
      if (/["'()\\]/.test(val) || /\b(AND|OR|NOT|IN|IS|WAS|ORDER BY)\b/i.test(val)) {
        return null;
      }
      return val.trim();
    };
    
    const safeVersion = sanitizeParam(version) || version;
    const safeRelease = sanitizeParam(release) || release;

    // HC3 Compliance: Read from pre-computed storage instead of live Jira aggregation
    // TFA data is pre-computed by the external GitLab CI pipeline and stored as JSON
    // This endpoint now serves as a thin read layer over the pre-computed data
    
    try {
      // Try to read pre-computed TFA data from storage
      const tfaData = await readFromStorage('system-health/quality/tfa-data.json');
      
      if (tfaData && tfaData.data) {
        // Filter pre-computed data by version/release/component if specified
        let filteredData = tfaData.data;
        
        // If we have version-specific data, filter it
        if (safeVersion !== 'All' && filteredData.byVersion && filteredData.byVersion[safeVersion]) {
          filteredData = filteredData.byVersion[safeVersion];
        }
        
        // Return the pre-computed data
        return res.json({
          version: safeVersion,
          release: safeRelease,
          perComponentData: filteredData.perComponentData || [],
          classificationBreakdown: filteredData.classificationBreakdown || [],
          statusDistribution: filteredData.statusDistribution || [],
          totals: filteredData.totals || { total_failed: 0, classified: 0, unclassified: 0 },
          source: 'pre-computed',
          lastUpdated: tfaData.lastUpdated || null
        });
      }
      
      // For demo mode, return demo data
      if (DEMO_MODE) {
        return res.json({
          version: safeVersion,
          release: safeRelease,
          perComponentData: [
            { component: 'AI Hub', failed: 24, classified: 18, unclassified: 6 },
            { component: 'AI Pipelines', failed: 18, classified: 15, unclassified: 3 },
            { component: 'Model Server', failed: 12, classified: 10, unclassified: 2 },
            { component: 'Training', failed: 15, classified: 11, unclassified: 4 },
            { component: 'IDE', failed: 9, classified: 7, unclassified: 2 }
          ],
          classificationBreakdown: [
            { label: 'tfa-product-bug', name: 'Product Bug', count: 31 },
            { label: 'tfa-automation-bug', name: 'Automation Bug', count: 18 },
            { label: 'tfa-infra-issue', name: 'Infrastructure', count: 14 },
            { label: 'tfa-env-setup', name: 'Env Setup', count: 8 },
            { label: 'unclassified', name: 'Unclassified', count: 17 }
          ],
          statusDistribution: [
            { status: 'Open', count: 45 },
            { status: 'In Progress', count: 18 },
            { status: 'On Hold', count: 5 },
            { status: 'Resolved', count: 20 }
          ],
          totals: {
            total_failed: 88,
            classified: 61,
            unclassified: 27
          },
          source: 'demo'
        });
      }

      // No pre-computed data available - return empty response with guidance
      // Per HC3: Complex aggregations should be done in external pipelines, not here
      return res.json({
        version: safeVersion,
        release: safeRelease,
        perComponentData: [],
        classificationBreakdown: [],
        statusDistribution: [],
        totals: {
          total_failed: 0,
          classified: 0,
          unclassified: 0
        },
        source: 'none',
        message: 'TFA data not available. Run the GitLab CI pipeline to generate pre-computed data.'
      });

    } catch (error) {
      // Security: Log full error internally but return generic message to client
      console.error('[system-health/quality] Error reading TFA data:', error.message);
      return res.json({
        version: safeVersion,
        release: safeRelease,
        perComponentData: [],
        classificationBreakdown: [],
        statusDistribution: [],
        totals: {
          total_failed: 0,
          classified: 0,
          unclassified: 0
        },
        source: 'error'
      });
    }
  });

  // ─── Test Execution Dashboard Data API ───
  // Display-layer only (HC3): an external pipeline (test-reports-opensearch)
  // pre-computes the dashboard JSON and pushes it here via the bulk endpoint.
  // The app just stores and serves it. See docs/DATA-FORMATS.md.

  const TEST_EXEC_BASE = 'system-health/test-execution';
  const TEST_EXEC_FILES = ['heatmap', 'components', 'jira_config', 'meta'];

  /**
   * @openapi
   * /api/modules/system-health/quality/test-execution/bulk:
   *   post:
   *     summary: Bulk-upload test execution dashboard data
   *     description: |
   *       Ingest endpoint for the external test-reports pipeline to push
   *       pre-computed dashboard JSON. Requires the `system-health:write` scope
   *       (a scoped pipeline token, not an interactive admin). Accepts any
   *       subset of `heatmap`, `components`, `jira_config`, and `meta`; each
   *       provided key is written to storage atomically and an upload receipt
   *       is recorded.
   *     tags: [System Health - Test Execution]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               heatmap: { type: object, description: "{ components: [...] } heatmap payload" }
   *               components: { type: object, description: "Per-component daily + quality-gate detail" }
   *               jira_config: { type: object, description: "Release/team JQL configuration" }
   *               meta: { type: object, description: "Generation metadata (dates, component list)" }
   *     responses:
   *       200:
   *         description: Upload result with the list of stored files
   *       400:
   *         description: No recognized payload keys provided
   *       403:
   *         description: Missing required scope (system-health:write)
   */
  router.post('/test-execution/bulk', requireAuth, requireScope('system-health:write'), jsonLimit, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Test execution ingest disabled in demo mode' });
    }

    const body = req.body || {};
    const provided = TEST_EXEC_FILES.filter((key) => body[key] !== undefined && body[key] !== null);

    if (provided.length === 0) {
      return res.status(400).json({ error: `No data provided. Expected one or more of: ${TEST_EXEC_FILES.join(', ')}` });
    }

    // Lightweight shape validation — reject obviously malformed payloads.
    if (body.heatmap !== undefined) {
      const hm = body.heatmap;
      const isArrayShape = Array.isArray(hm);
      const isWrappedShape = hm && typeof hm === 'object' && Array.isArray(hm.components);
      if (!isArrayShape && !isWrappedShape) {
        return res.status(400).json({ error: 'heatmap must be an array of components or an object with a components array' });
      }
    }

    try {
      const stored = [];
      for (const key of provided) {
        await writeToStorage(`${TEST_EXEC_BASE}/${key}.json`, body[key]);
        stored.push(key);
      }

      await writeToStorage(`${TEST_EXEC_BASE}/last-upload.json`, {
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user?.email || 'pipeline',
        files: stored
      });

      return res.json({ status: 'ok', stored, uploadedAt: new Date().toISOString() });
    } catch (error) {
      console.error('[system-health/quality] Error writing test execution data:', error.message);
      return res.status(500).json({ error: 'Failed to store data' });
    }
  });

  /**
   * @openapi
   * /api/modules/system-health/quality/test-execution/data:
   *   get:
   *     summary: Get test execution dashboard data
   *     description: |
   *       Returns the stored dashboard payloads. With no query params, returns a
   *       combined object `{ heatmap, components, jira_config, meta, lastUpload }`.
   *       Pass `?file=<name>` to fetch a single payload.
   *     tags: [System Health - Test Execution]
   *     parameters:
   *       - name: file
   *         in: query
   *         required: false
   *         schema: { type: string, enum: [heatmap, components, jira_config, meta] }
   *     responses:
   *       200:
   *         description: Dashboard data
   *       400:
   *         description: Invalid file parameter
   */
  router.get('/test-execution/data', requireAuth, requireScope('system-health:read'), async function(req, res) {
    try {
      const { file } = req.query;

      if (file) {
        if (!TEST_EXEC_FILES.includes(file)) {
          return res.status(400).json({ error: `Invalid file. Valid: ${TEST_EXEC_FILES.join(', ')}` });
        }
        const data = await readFromStorage(`${TEST_EXEC_BASE}/${file}.json`);
        return res.json(data || {});
      }

      const [heatmap, components, jira_config, meta, lastUpload] = await Promise.all([
        readFromStorage(`${TEST_EXEC_BASE}/heatmap.json`),
        readFromStorage(`${TEST_EXEC_BASE}/components.json`),
        readFromStorage(`${TEST_EXEC_BASE}/jira_config.json`),
        readFromStorage(`${TEST_EXEC_BASE}/meta.json`),
        readFromStorage(`${TEST_EXEC_BASE}/last-upload.json`)
      ]);

      return res.json({
        heatmap: heatmap || null,
        components: components || null,
        jira_config: jira_config || null,
        meta: meta || null,
        lastUpload: lastUpload || null
      });
    } catch (error) {
      console.error('[system-health/quality] Error reading test execution data:', error.message);
      return res.status(500).json({ error: 'Failed to read data' });
    }
  });

  /**
   * @openapi
   * /api/modules/system-health/quality/test-execution/status:
   *   get:
   *     summary: Test execution data freshness
   *     description: Returns the last upload receipt for admin/settings visibility.
   *     tags: [System Health - Test Execution]
   *     responses:
   *       200:
   *         description: Last upload metadata
   */
  router.get('/test-execution/status', requireAuth, requireScope('system-health:read'), async function(req, res) {
    try {
      const lastUpload = await readFromStorage(`${TEST_EXEC_BASE}/last-upload.json`);
      return res.json(lastUpload || { uploadedAt: null, files: [] });
    } catch (error) {
      console.error('[system-health/quality] Error reading test execution status:', error.message);
      return res.status(500).json({ error: 'Failed to read status' });
    }
  });
};
