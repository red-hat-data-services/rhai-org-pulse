const { getShowcaseData, fetchShowcaseData, clearCache, STORAGE_KEY } = require('./sheets-sync');
const { getConfig, saveConfig } = require('./config');

const DEMO_MODE = process.env.DEMO_MODE === 'true';

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoutes(router, context) {
  const { storage, requireAuth, requireAdmin } = context;
  const { readFromStorage, writeToStorage } = storage;
  const keyFile = context.resolveSecret('GOOGLE_SERVICE_ACCOUNT_KEY_FILE') || '/etc/secrets/google-sa-key.json';

  function loadDemoData() {
    return readFromStorage(STORAGE_KEY) || { entries: [], pillars: [], fetchedAt: null };
  }

  /**
   * @openapi
   * /api/modules/catalyst-showcase/config:
   *   get:
   *     tags: [Catalyst Showcase]
   *     summary: Get module configuration (admin)
   *     responses:
   *       200:
   *         description: Current configuration
   */
  router.get('/config', requireAdmin, function(req, res) {
    res.json(getConfig(readFromStorage));
  });

  /**
   * @openapi
   * /api/modules/catalyst-showcase/config:
   *   post:
   *     tags: [Catalyst Showcase]
   *     summary: Update module configuration (admin)
   *     responses:
   *       200:
   *         description: Configuration saved
   *       400:
   *         description: Validation error
   */
  router.post('/config', requireAdmin, function(req, res) {
    try {
      saveConfig(writeToStorage, req.body);
      res.json({ status: 'saved' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * @openapi
   * /api/modules/catalyst-showcase/entries:
   *   get:
   *     tags: [Catalyst Showcase]
   *     summary: List all active showcase entries with strategy pillars
   *     responses:
   *       200:
   *         description: Entries, pillars, and metadata
   */
  router.get('/entries', requireAuth, async function(req, res) {
    try {
      let data;
      const sheetId = getConfig(readFromStorage).sheetId;
      if (DEMO_MODE || !sheetId) {
        data = loadDemoData();
      } else {
        data = await getShowcaseData(sheetId, keyFile, storage);
      }

      const entries = (data.entries || []).filter(function(e) {
        return e.status !== 'draft';
      });

      res.json({
        entries,
        pillars: data.pillars || [],
        fetchedAt: data.fetchedAt,
        totalEntries: entries.length,
      });
    } catch (err) {
      console.error('[catalyst-showcase] GET /entries error:', err.message);
      res.status(500).json({ error: 'Failed to load showcase data' });
    }
  });

  /**
   * @openapi
   * /api/modules/catalyst-showcase/entries/{slug}:
   *   get:
   *     tags: [Catalyst Showcase]
   *     summary: Get a single showcase entry by slug
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Full entry detail with its strategy pillar
   *       404:
   *         description: Entry not found
   */
  router.get('/entries/:slug', requireAuth, async function(req, res) {
    try {
      let data;
      const sheetId = getConfig(readFromStorage).sheetId;
      if (DEMO_MODE || !sheetId) {
        data = loadDemoData();
      } else {
        data = await getShowcaseData(sheetId, keyFile, storage);
      }

      const entry = (data.entries || []).find(function(e) {
        return e.slug === req.params.slug;
      });

      if (!entry) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      const pillar = (data.pillars || []).find(function(p) {
        return p.pillarKey === entry.strategyPillarKey;
      });

      res.json({ entry, pillar: pillar || null });
    } catch (err) {
      console.error('[catalyst-showcase] GET /entries/:slug error:', err.message);
      res.status(500).json({ error: 'Failed to load showcase entry' });
    }
  });

  /**
   * @openapi
   * /api/modules/catalyst-showcase/refresh:
   *   post:
   *     tags: [Catalyst Showcase]
   *     summary: Force refresh showcase data from Google Sheets (admin)
   *     responses:
   *       200:
   *         description: Refresh result
   */
  router.post('/refresh', requireAdmin, async function(req, res) {
    const sheetId = getConfig(readFromStorage).sheetId;
    if (DEMO_MODE || !sheetId) {
      return res.json({ status: 'skipped', reason: 'Demo mode or no sheet configured' });
    }

    try {
      clearCache();
      const data = await fetchShowcaseData(sheetId, keyFile, storage);
      res.json({
        status: 'refreshed',
        entries: data.entries.length,
        pillars: data.pillars.length,
        fetchedAt: data.fetchedAt,
      });
    } catch (err) {
      console.error('[catalyst-showcase] POST /refresh error:', err.message);
      res.status(500).json({ error: 'Failed to refresh from Google Sheets', details: err.message });
    }
  });

  if (context.registerRefresh) {
    context.registerRefresh('sheets-sync', {
      order: 80,
      cadence: '1h',
      description: 'Sync AI Catalyst Showcase data from Google Sheets',
      handler: async function() {
        const sheetId = getConfig(readFromStorage).sheetId;
        if (DEMO_MODE || !sheetId) return;
        clearCache();
        await fetchShowcaseData(sheetId, keyFile, storage);
      },
    });
  }

  if (context.registerExport) {
    context.registerExport(async function(addFile, exportStorage) {
      const data = exportStorage.readFromStorage(STORAGE_KEY);
      if (data) {
        addFile(STORAGE_KEY, data);
      }
    });
  }

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const data = readFromStorage(STORAGE_KEY);
      return {
        sheetConfigured: !!getConfig(readFromStorage).sheetId,
        dataExists: !!data,
        entryCount: data?.entries?.length || 0,
        pillarCount: data?.pillars?.length || 0,
        fetchedAt: data?.fetchedAt || null,
      };
    });
  }
};
