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
   *     summary: Get Jira issue count for a JQL query
   *     tags: [System Health - Quality Reports]
   *     parameters:
   *       - name: jql
   *         in: query
   *         required: true
   *         schema:
   *           type: string
   *         description: JQL query string
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
   *         description: Missing JQL parameter
   */
  router.get('/jira-count', requireAuth, requireScope('system-health:read'), async function(req, res) {
    const jql = req.query.jql;
    if (!jql) {
      return res.status(400).json({ error: 'Missing jql parameter' });
    }

    // Security: Validate JQL is restricted to RHOAIENG project and allowed labels
    const allowedProjects = ['RHOAIENG'];
    const jqlLower = jql.toLowerCase();
    
    // Check that JQL targets only allowed project
    const hasAllowedProject = allowedProjects.some(proj => 
      jqlLower.includes(`project = ${proj.toLowerCase()}`) || 
      jqlLower.includes(`project=${proj.toLowerCase()}`)
    );
    
    if (!hasAllowedProject) {
      return res.status(400).json({ error: 'JQL must target project RHOAIENG' });
    }

    // Block potentially dangerous JQL patterns
    const dangerousPatterns = [
      /project\s*(!=|<>|not\s+in)/i,  // Negated project filters
      /\bOR\s+project\b/i,             // OR with different project
    ];
    
    if (dangerousPatterns.some(pattern => pattern.test(jql))) {
      return res.status(400).json({ error: 'Invalid JQL pattern' });
    }

    try {
      const { createJiraClient } = require('@shared/jira');
      const jiraClient = createJiraClient(context.secrets);
      const result = await jiraClient.search(jql, { maxResults: 0 });
      res.json({ count: result.total || 0 });
    } catch (error) {
      // Security: Return generic error message to avoid leaking internal details
      console.error('[system-health/quality] Jira count query failed:', error.message);
      res.status(500).json({ error: 'Jira query failed' });
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
    const { version, release, from_date, to_date, component } = req.query;

    console.log('[system-health/quality] tfa-charts request:', { version, release, from_date, to_date, component });

    if (!version || !release) {
      console.log('[system-health/quality] Missing version or release');
      return res.status(400).json({ error: 'Missing version or release parameter' });
    }

    // Security: Sanitize inputs to prevent JQL injection
    // Remove quotes, parentheses, and JQL operators from user inputs
    const sanitizeJqlValue = (val) => {
      if (!val || val === 'All') return val;
      // Remove characters that could break out of JQL string context
      return val.replace(/["'()\\]/g, '').replace(/\b(AND|OR|NOT|IN|IS|WAS|CHANGED|ORDER BY)\b/gi, '');
    };
    
    const safeVersion = sanitizeJqlValue(version);
    const safeRelease = sanitizeJqlValue(release);
    const safeComponent = sanitizeJqlValue(component);
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const safeFromDate = from_date && dateRegex.test(from_date) ? from_date : null;
    const safeToDate = to_date && dateRegex.test(to_date) ? to_date : null;

    try {
      // For demo mode, return demo data
      if (DEMO_MODE) {
        console.log('[system-health/quality] Demo mode - returning demo data');
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
          }
        });
      }

      // Try to initialize Jira client
      let jiraClient;
      try {
        const { createJiraClient } = require('@shared/jira');
        jiraClient = createJiraClient(context.secrets);
        console.log('[system-health/quality] Jira client initialized');
      } catch (err) {
        console.warn('[system-health/quality] Jira client initialization failed:', err.message);
        // Fall back to empty data if Jira client fails
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
          }
        });
      }

      // Build base JQL - filter by component if provided (using sanitized values)
      let baseJql = 'project = RHOAIENG AND labels = "test-failed"';
      if (safeComponent && safeComponent !== 'All') {
        baseJql += ` AND component = "${safeComponent}"`;
      }
      baseJql += ` AND status NOT IN ("Closed","Resolved")`; // Only open issues

      // Add version/release filtering (using sanitized values)
      if (safeVersion !== 'All' || safeRelease !== 'All') {
        baseJql += ` AND (fixVersion ~ "${safeVersion}" OR 'Target Version' ~ "${safeVersion}")`;
      }

      // Add date range if provided (already validated format)
      if (safeFromDate) {
        baseJql += ` AND created >= "${safeFromDate}"`;
      }
      if (safeToDate) {
        baseJql += ` AND created <= "${safeToDate}"`;
      }

      console.log('[system-health/quality] Executing JQL:', baseJql.substring(0, 100) + '...');

      // Query for all test-failed issues with a timeout
      let allIssues;
      try {
        allIssues = await Promise.race([
          jiraClient.search(baseJql, {
            maxResults: 1000,
            fields: ['labels', 'status', 'components', 'created']
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Jira query timeout')), 10000))
        ]);
        console.log('[system-health/quality] JQL query succeeded, got', allIssues?.issues?.length || 0, 'issues');
      } catch (err) {
        console.warn('[system-health/quality] Jira search failed:', err.message);
        // Return empty data instead of error
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
          }
        });
      }

      // Define TFA labels
      const TFA_LABELS = [
        'tfa-product-bug',
        'tfa-automation-bug',
        'tfa-infra-issue',
        'tfa-env-setup',
        'tfa-duplicate',
        'tfa-known-issue',
        'tfa-false-positive',
        'tfa-wrong-assignment'
      ];

      const TFA_NAMES = {
        'tfa-product-bug': 'Product Bug',
        'tfa-automation-bug': 'Automation Bug',
        'tfa-infra-issue': 'Infrastructure',
        'tfa-env-setup': 'Environment Setup',
        'tfa-duplicate': 'Duplicate',
        'tfa-known-issue': 'Known Issue',
        'tfa-false-positive': 'False Positive',
        'tfa-wrong-assignment': 'Wrong Assignment'
      };

      // Aggregate data
      const perComponentMap = {};
      const classificationCounts = {};
      const statusCounts = {};
      let totalFailed = 0;
      let totalClassified = 0;

      if (allIssues && allIssues.issues) {
        allIssues.issues.forEach(issue => {
          totalFailed++;
          const labels = issue.fields.labels || [];
          const status = issue.fields.status?.name || 'Unknown';

          // Count by status
          statusCounts[status] = (statusCounts[status] || 0) + 1;

          // Check if classified
          let isClassified = false;
          TFA_LABELS.forEach(tfaLabel => {
            if (labels.includes(tfaLabel)) {
              isClassified = true;
              classificationCounts[tfaLabel] = (classificationCounts[tfaLabel] || 0) + 1;
            }
          });

          if (!isClassified) {
            classificationCounts['unclassified'] = (classificationCounts['unclassified'] || 0) + 1;
          } else {
            totalClassified++;
          }

          // Aggregate by component
          const components = issue.fields.components || [];
          if (components.length === 0) {
            components.push({ name: '(No component)' });
          }

          components.forEach(comp => {
            const compName = comp.name;
            if (!perComponentMap[compName]) {
              perComponentMap[compName] = { failed: 0, classified: 0, unclassified: 0 };
            }
            perComponentMap[compName].failed++;

            if (isClassified) {
              perComponentMap[compName].classified++;
            } else {
              perComponentMap[compName].unclassified++;
            }
          });
        });
      }

      // Build response
      const perComponentData = Object.entries(perComponentMap)
        .map(([component, data]) => ({ component, ...data }))
        .sort((a, b) => b.failed - a.failed);

      const classificationBreakdown = Object.entries(classificationCounts)
        .map(([label, count]) => ({
          label,
          name: TFA_NAMES[label] || label,
          count
        }))
        .sort((a, b) => b.count - a.count);

      const statusDistribution = Object.entries(statusCounts)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);

      const responseData = {
        version: safeVersion,
        release: safeRelease,
        perComponentData,
        classificationBreakdown,
        statusDistribution,
        totals: {
          total_failed: totalFailed,
          classified: totalClassified,
          unclassified: totalFailed - totalClassified
        }
      };

      console.log('[system-health/quality] Returning response:', {
        totalFailed,
        totalClassified,
        componentsCount: perComponentData.length
      });

      res.json(responseData);
    } catch (error) {
      // Security: Log full error internally but return generic message to client
      console.error('[system-health/quality] Unexpected error in tfa-charts:', error);
      // Return graceful empty response instead of error
      res.json({
        version: safeVersion,
        release: safeRelease,
        perComponentData: [],
        classificationBreakdown: [],
        statusDistribution: [],
        totals: {
          total_failed: 0,
          classified: 0,
          unclassified: 0
        }
      });
    }
  });
};
