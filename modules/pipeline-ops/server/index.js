const { computeHealth } = require('./health');
const { collectPipelineRuns } = require('./collector');

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoutes(router, context) {
  const { storage, requireAdmin, requireScope } = context;
  const { readFromStorage, writeToStorage } = storage;

  const DEMO_MODE = process.env.DEMO_MODE === 'true';

  const refreshState = {
    running: false,
    startedAt: null,
    lastResult: null,
  };

  function loadConfig() {
    return readFromStorage('pipeline-ops/config.json') || { pipelines: [], retentionDays: 30 };
  }

  function loadRuns() {
    return readFromStorage('pipeline-ops/runs.json') || {};
  }

  /**
   * @openapi
   * /api/modules/pipeline-ops/pipelines:
   *   get:
   *     tags: [Pipeline Operations]
   *     summary: All pipelines with computed health status
   *     responses:
   *       200:
   *         description: Array of pipelines with health fields
   */
  router.get('/pipelines', requireScope('pipeline-ops:read'), function(req, res) {
    const config = loadConfig();
    const runs = loadRuns();

    const pipelines = (config.pipelines || []).map(function(pipeline) {
      const pipelineData = runs[pipeline.slug] || {};
      const health = computeHealth(pipeline, pipelineData.runs || [], pipelineData.queue);
      return { ...pipeline, health };
    });

    res.json({ pipelines });
  });

  /**
   * @openapi
   * /api/modules/pipeline-ops/pipelines/{slug}:
   *   get:
   *     tags: [Pipeline Operations]
   *     summary: Single pipeline detail with run history
   *     parameters:
   *       - name: slug
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Pipeline detail with health and runs
   *       404:
   *         description: Pipeline not found
   */
  router.get('/pipelines/:slug', requireScope('pipeline-ops:read'), function(req, res) {
    const config = loadConfig();
    const runs = loadRuns();

    const pipeline = (config.pipelines || []).find(p => p.slug === req.params.slug);
    if (!pipeline) {
      return res.status(404).json({ error: 'Pipeline not found' });
    }

    const pipelineData = runs[pipeline.slug] || {};
    const pipelineRuns = pipelineData.runs || [];
    const health = computeHealth(pipeline, pipelineRuns, pipelineData.queue);

    res.json({
      ...pipeline,
      health,
      runs: pipelineRuns,
      lastCheckedAt: runs[pipeline.slug]?.lastCheckedAt || null
    });
  });

  /**
   * @openapi
   * /api/modules/pipeline-ops/config:
   *   get:
   *     tags: [Pipeline Operations]
   *     summary: Pipeline definitions (admin)
   *     responses:
   *       200:
   *         description: Raw pipeline configuration
   */
  router.get('/config', requireAdmin, requireScope('pipeline-ops:write'), function(req, res) {
    res.json(loadConfig());
  });

  /**
   * @openapi
   * /api/modules/pipeline-ops/config:
   *   post:
   *     tags: [Pipeline Operations]
   *     summary: Update pipeline definitions (admin)
   *     responses:
   *       200:
   *         description: Configuration saved
   *       400:
   *         description: Invalid configuration
   */
  router.post('/config', requireAdmin, requireScope('pipeline-ops:write'), function(req, res) {
    const body = req.body;
    if (!body || !Array.isArray(body.pipelines)) {
      return res.status(400).json({ error: 'pipelines must be an array' });
    }

    const slugs = body.pipelines.map(p => p.slug).filter(Boolean);
    const uniqueSlugs = new Set(slugs);
    if (slugs.length !== uniqueSlugs.size) {
      return res.status(400).json({ error: 'Duplicate pipeline slugs' });
    }

    for (const p of body.pipelines) {
      if (!p.slug || !p.name) {
        return res.status(400).json({ error: 'Each pipeline requires slug and name' });
      }
    }

    writeToStorage('pipeline-ops/config.json', {
      pipelines: body.pipelines,
      retentionDays: body.retentionDays || 30
    });

    res.json({ status: 'saved', count: body.pipelines.length });
  });

  /**
   * @openapi
   * /api/modules/pipeline-ops/refresh/status:
   *   get:
   *     tags: [Pipeline Operations]
   *     summary: Data collector last-run status
   *     responses:
   *       200:
   *         description: Refresh state
   */
  router.get('/refresh/status', requireScope('pipeline-ops:read'), function(req, res) {
    res.json(refreshState);
  });

  /**
   * @openapi
   * /api/modules/pipeline-ops/refresh:
   *   post:
   *     tags: [Pipeline Operations]
   *     summary: Trigger pipeline run data collection
   *     responses:
   *       200:
   *         description: Collection started or skipped
   */
  router.post('/refresh', requireScope('pipeline-ops:read'), function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Refresh disabled in demo mode' });
    }
    if (refreshState.running) {
      return res.json({ status: 'already_running', startedAt: refreshState.startedAt });
    }

    refreshState.running = true;
    refreshState.startedAt = new Date().toISOString();
    res.json({ status: 'started' });

    const config = loadConfig();
    const existingRuns = loadRuns();

    collectPipelineRuns(config, existingRuns)
      .then(function(result) {
        writeToStorage('pipeline-ops/runs.json', result.runs);

        if (result.scheduleUpdates && Object.keys(result.scheduleUpdates).length > 0) {
          const currentConfig = loadConfig();
          let updated = false;
          for (const p of currentConfig.pipelines) {
            const sched = result.scheduleUpdates[p.slug];
            if (!sched) continue;
            if (!p.schedule) p.schedule = {};
            p.schedule.cron = sched.cron;
            if (sched.expectedIntervalMinutes) {
              p.schedule.expectedIntervalMinutes = sched.expectedIntervalMinutes;
            }
            updated = true;
          }
          if (updated) {
            writeToStorage('pipeline-ops/config.json', currentConfig);
          }
        }

        refreshState.lastResult = {
          finishedAt: new Date().toISOString(),
          ...result.summary,
        };
      })
      .catch(function(err) {
        console.error('[pipeline-ops] Refresh failed:', err.message);
        refreshState.lastResult = {
          finishedAt: new Date().toISOString(),
          error: err.message,
        };
      })
      .finally(function() {
        refreshState.running = false;
      });
  });

  /**
   * @openapi
   * /api/modules/pipeline-ops/runs/bulk:
   *   post:
   *     tags: [Pipeline Operations]
   *     summary: Bulk ingest run data from external collector (admin)
   *     responses:
   *       200:
   *         description: Run data saved
   *       400:
   *         description: Invalid payload
   */
  router.post('/runs/bulk', requireAdmin, requireScope('pipeline-ops:write'), function(req, res) {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Request body must be an object keyed by pipeline slug' });
    }

    const existingRuns = loadRuns();
    const config = loadConfig();
    const retentionDays = config.retentionDays || 30;
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

    for (const [slug, data] of Object.entries(body)) {
      if (!Array.isArray(data?.runs)) continue;

      const existingPipelineRuns = existingRuns[slug]?.runs || [];
      const byId = new Map();
      for (const run of existingPipelineRuns) byId.set(run.id, run);
      for (const run of data.runs) byId.set(run.id, run);

      const merged = [...byId.values()]
        .filter(r => new Date(r.startedAt).getTime() >= cutoff)
        .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));

      existingRuns[slug] = {
        lastCheckedAt: data.lastCheckedAt || new Date().toISOString(),
        runs: merged,
      };
    }

    writeToStorage('pipeline-ops/runs.json', existingRuns);
    res.json({ status: 'saved', slugs: Object.keys(body) });
  });

  context.registerDiagnostics(async function() {
    const config = loadConfig();
    const runs = loadRuns();
    return {
      pipelineCount: (config.pipelines || []).length,
      hasRunData: Object.keys(runs).length > 0,
      retentionDays: config.retentionDays || 30
    };
  });
};
