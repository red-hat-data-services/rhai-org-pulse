const { createGoogleSheetsClient } = require('../../../shared/server/google-sheets');
const { getShowcaseData, fetchShowcaseData, clearCache: clearShowcaseCache, STORAGE_KEY: SHOWCASE_STORAGE_KEY } = require('./showcase/sheets-sync');
const { getConfig: getShowcaseConfig, saveConfig: saveShowcaseConfig } = require('./showcase/config');
const { getConfig: getBoardConfig, saveConfig: saveBoardConfig } = require('./board-config');

const DEMO_MODE = process.env.DEMO_MODE === 'true';
const BOARD_SHEET_RE = /^board-\d{4}-\d{2}$/;
const STORAGE_PREFIX = 'ai-catalyst';
const INDEX_PATH = `${STORAGE_PREFIX}/index.json`;

const PIPE_DELIMITED_FIELDS = new Set([
  'capability_labels', 'red_hat_stack', 'sources'
]);

const NUMERIC_FIELDS = new Set([
  'impact_score', 'feasibility_score', 'board_feasibility_score',
  'audience_value', 'strategic_alignment', 'strategy_fit',
  'platform_leverage', 'demo_potential',
  'container_readiness', 'dependency_profile',
  'reproduction_confidence', 'complexity_sweet_spot',
  'stars', 'stars_velocity', 'contributors', 'open_issues',
  'vram_gb', 'sort_order'
]);

const BOOLEAN_FIELDS = new Set([
  'board_feasibility_estimated', 'board_passes_gate',
  'gpu_required', 'has_dockerfile'
]);

const JSON_FIELDS = new Set(['pm_review_history']);

function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function parseRow(headers, row) {
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i];
    if (!key) continue;
    const raw = i < row.length ? row[i] : '';
    const camel = snakeToCamel(key);
    const val = typeof raw === 'string' ? raw.trim() : String(raw ?? '');

    if (PIPE_DELIMITED_FIELDS.has(key)) {
      obj[camel] = val ? val.split('|').map(s => s.trim()).filter(Boolean) : [];
    } else if (NUMERIC_FIELDS.has(key)) {
      const n = Number(val);
      obj[camel] = Number.isFinite(n) ? n : null;
    } else if (BOOLEAN_FIELDS.has(key)) {
      obj[camel] = val.toLowerCase() === 'true' || val === '1';
    } else if (JSON_FIELDS.has(key)) {
      try { obj[camel] = val ? JSON.parse(val) : []; } catch { obj[camel] = []; }
    } else {
      obj[camel] = val;
    }
  }
  return obj;
}

function parseBoardSheet(headers, dataRows) {
  return dataRows
    .filter(row => row.some(c => String(c ?? '').trim()))
    .map(row => parseRow(headers, row));
}

function extractDecisionStatus(candidate) {
  const dec = (candidate.pmDecision || '').toLowerCase();
  if (!dec) return 'pending';
  if (dec.includes('approve')) return 'approved';
  if (dec.includes('decline')) return 'declined';
  if (dec.includes('revisit')) return 'revisit';
  return 'pending';
}

function filterCandidates(candidates, query) {
  let filtered = candidates;

  if (query.category) {
    filtered = filtered.filter(c => c.category === query.category);
  }
  if (query.source) {
    filtered = filtered.filter(c => c.source === query.source);
  }
  if (query.status) {
    filtered = filtered.filter(c => extractDecisionStatus(c) === query.status);
  }

  const sort = query.sort || 'impact';
  const sortFns = {
    impact: (a, b) => (b.impactScore || 0) - (a.impactScore || 0),
    feasibility: (a, b) => (b.boardFeasibilityScore || b.feasibilityScore || 0) - (a.boardFeasibilityScore || a.feasibilityScore || 0),
    stars: (a, b) => (b.stars || 0) - (a.stars || 0),
    newest: (a, b) => (b.firstSeen || '').localeCompare(a.firstSeen || '')
  };
  if (sortFns[sort]) {
    filtered = [...filtered].sort(sortFns[sort]);
  }

  return filtered;
}

function computeStats(candidates) {
  const byCategory = {};
  const byStatus = {};
  let totalImpact = 0;
  let totalFeasibility = 0;
  let impactCount = 0;
  let feasibilityCount = 0;

  for (const c of candidates) {
    const cat = c.category || 'unknown';
    byCategory[cat] = (byCategory[cat] || 0) + 1;

    const status = extractDecisionStatus(c);
    byStatus[status] = (byStatus[status] || 0) + 1;

    if (c.impactScore != null) { totalImpact += c.impactScore; impactCount++; }
    const fScore = c.boardFeasibilityScore ?? c.feasibilityScore;
    if (fScore != null) { totalFeasibility += fScore; feasibilityCount++; }
  }

  return {
    total: candidates.length,
    byCategory,
    byStatus,
    avgImpactScore: impactCount ? Math.round(totalImpact / impactCount * 100) / 100 : null,
    avgFeasibilityScore: feasibilityCount ? Math.round(totalFeasibility / feasibilityCount * 100) / 100 : null
  };
}

/**
 * @param {import('express').Router} router
 * @param {import('../../../shared/server/module-context').ModuleContext} context
 */
module.exports = function registerRoutes(router, context) {
  const { storage, requireAuth, requireAdmin, requireScope, secrets } = context;
  const { readFromStorage, writeToStorage, writeToStorageAtomic } = storage;

  context.registerScopes([
    { key: 'ai-catalyst:read', label: 'AI Catalyst (Read)', description: 'Read AI Catalyst board data', category: 'AI Catalyst' },
    { key: 'ai-catalyst:showcase', label: 'AI Catalyst Showcase (Read)', description: 'Read AI Catalyst showcase data', category: 'AI Catalyst' }
  ]);

  let lastSyncTime = null;
  let syncRunning = false;

  function getSheetId() {
    return getBoardConfig(readFromStorage).sheetId || (secrets && secrets.POC_EXPLORER_SHEET_ID) || '';
  }

  function isConfigured() {
    return !!getSheetId();
  }

  function readIndex() {
    return readFromStorage(INDEX_PATH) || { boards: [] };
  }

  function readBoard(month) {
    return readFromStorage(`${STORAGE_PREFIX}/boards/${month}.json`);
  }

  // --- Demo data ---

  function getDemoIndex() {
    try {
      return require('../../../fixtures/ai-catalyst/index.json');
    } catch {
      return { boards: [] };
    }
  }

  function getDemoBoard(month) {
    try {
      return require(`../../../fixtures/ai-catalyst/boards/${month}.json`);
    } catch {
      return null;
    }
  }

  // --- Sync logic ---

  async function syncBoards() {
    if (syncRunning || !isConfigured()) return { skipped: true };
    syncRunning = true;
    try {
      const keyFile = (secrets && secrets.GOOGLE_SERVICE_ACCOUNT_KEY_FILE) || '/etc/secrets/google-sa-key.json';
      const sheetsClient = createGoogleSheetsClient({ keyFile });
      const sheetId = getSheetId();

      const sheetNames = await sheetsClient.discoverSheetNames(sheetId);
      const boardSheets = sheetNames.filter(n => BOARD_SHEET_RE.test(n));

      if (boardSheets.length === 0) {
        return { synced: 0, message: 'No board sheets found' };
      }

      const existingIndex = readIndex();
      const existingMonths = new Set((existingIndex.boards || []).map(b => b.month));
      let syncCount = 0;

      for (const sheetName of boardSheets) {
        const month = sheetName.replace('board-', '');

        const { headers, rows } = await sheetsClient.fetchRawSheet(sheetId, sheetName);
        if (!headers.length) continue;

        const candidates = parseBoardSheet(headers, rows);
        writeToStorage(`${STORAGE_PREFIX}/boards/${month}.json`, candidates);
        syncCount++;

        if (!existingMonths.has(month)) {
          existingMonths.add(month);
        }
      }

      const boards = [...existingMonths].sort().reverse().map(month => {
        const data = readBoard(month);
        return {
          month,
          candidateCount: Array.isArray(data) ? data.length : 0,
          lastSynced: new Date().toISOString()
        };
      });

      writeToStorageAtomic(INDEX_PATH, { boards, lastSynced: new Date().toISOString() });
      lastSyncTime = new Date().toISOString();
      return { synced: syncCount, total: boardSheets.length };
    } finally {
      syncRunning = false;
    }
  }

  // --- API Routes ---

  /**
   * @openapi
   * /api/modules/ai-catalyst/board-config:
   *   get:
   *     tags: [AI Catalyst]
   *     summary: Get board configuration (admin)
   *     responses:
   *       200:
   *         description: Current board configuration
   */
  router.get('/board-config', requireAdmin, function(req, res) {
    res.json(getBoardConfig(readFromStorage));
  });

  /**
   * @openapi
   * /api/modules/ai-catalyst/board-config:
   *   post:
   *     tags: [AI Catalyst]
   *     summary: Update board configuration (admin)
   *     responses:
   *       200:
   *         description: Configuration saved
   *       400:
   *         description: Validation error
   */
  router.post('/board-config', requireAdmin, function(req, res) {
    try {
      saveBoardConfig(writeToStorage, req.body);
      res.json({ status: 'saved' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * @openapi
   * /api/modules/ai-catalyst/config:
   *   get:
   *     tags: [AI Catalyst]
   *     summary: Get module configuration and connection status
   *     responses:
   *       200:
   *         description: Configuration status
   */
  router.get('/config', requireAuth, requireScope('ai-catalyst:read'), function(req, res) {
    const index = DEMO_MODE ? getDemoIndex() : readIndex();
    res.json({
      configured: isConfigured(),
      demoMode: DEMO_MODE,
      lastSyncTime: lastSyncTime || (index && index.lastSynced) || null,
      boardCount: (index && index.boards) ? index.boards.length : 0
    });
  });

  /**
   * @openapi
   * /api/modules/ai-catalyst/boards:
   *   get:
   *     tags: [AI Catalyst]
   *     summary: List available monthly boards
   *     responses:
   *       200:
   *         description: Array of available board months with candidate counts
   */
  router.get('/boards', requireAuth, requireScope('ai-catalyst:read'), function(req, res) {
    const index = DEMO_MODE ? getDemoIndex() : readIndex();
    res.json({ boards: (index && index.boards) || [] });
  });

  /**
   * @openapi
   * /api/modules/ai-catalyst/boards/{month}:
   *   get:
   *     tags: [AI Catalyst]
   *     summary: Get candidates for a specific monthly board
   *     parameters:
   *       - name: month
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Month in YYYY-MM format
   *       - name: category
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by strategy pillar category
   *       - name: status
   *         in: query
   *         schema:
   *           type: string
   *           enum: [pending, approved, declined, revisit]
   *         description: Filter by PM decision status
   *       - name: source
   *         in: query
   *         schema:
   *           type: string
   *           enum: [github, hn, reddit]
   *         description: Filter by discovery source
   *       - name: sort
   *         in: query
   *         schema:
   *           type: string
   *           enum: [impact, feasibility, stars, newest]
   *         description: Sort order (default impact)
   *     responses:
   *       200:
   *         description: Filtered and sorted candidates
   *       400:
   *         description: Invalid month format
   *       404:
   *         description: Board not found
   */
  router.get('/boards/:month', requireAuth, requireScope('ai-catalyst:read'), function(req, res) {
    const { month } = req.params;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Month must be in YYYY-MM format' });
    }

    const candidates = DEMO_MODE ? getDemoBoard(month) : readBoard(month);
    if (!candidates) {
      return res.status(404).json({ error: `Board not found for ${month}` });
    }

    const filtered = filterCandidates(candidates, req.query);
    res.json({
      month,
      total: candidates.length,
      filtered: filtered.length,
      candidates: filtered
    });
  });

  /**
   * @openapi
   * /api/modules/ai-catalyst/candidates/{id}:
   *   get:
   *     tags: [AI Catalyst]
   *     summary: Get a single candidate by unique ID
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Candidate unique_id
   *     responses:
   *       200:
   *         description: Candidate details
   *       404:
   *         description: Candidate not found
   */
  router.get('/candidates/:id', requireAuth, requireScope('ai-catalyst:read'), function(req, res) {
    const { id } = req.params;
    const index = DEMO_MODE ? getDemoIndex() : readIndex();
    const months = (index && index.boards) ? index.boards.map(b => b.month) : [];

    for (const month of months) {
      const candidates = DEMO_MODE ? getDemoBoard(month) : readBoard(month);
      if (!Array.isArray(candidates)) continue;
      const found = candidates.find(c => c.uniqueId === id);
      if (found) {
        return res.json({ ...found, boardMonth: month });
      }
    }
    res.status(404).json({ error: `Candidate not found: ${id}` });
  });

  /**
   * @openapi
   * /api/modules/ai-catalyst/stats:
   *   get:
   *     tags: [AI Catalyst]
   *     summary: Get aggregate statistics across all boards
   *     parameters:
   *       - name: month
   *         in: query
   *         schema:
   *           type: string
   *         description: Limit stats to a specific month (YYYY-MM)
   *     responses:
   *       200:
   *         description: Aggregate statistics
   */
  router.get('/stats', requireAuth, requireScope('ai-catalyst:read'), function(req, res) {
    const { month } = req.query;
    const index = DEMO_MODE ? getDemoIndex() : readIndex();

    if (month) {
      const candidates = DEMO_MODE ? getDemoBoard(month) : readBoard(month);
      return res.json(computeStats(candidates || []));
    }

    const allCandidates = [];
    const months = (index && index.boards) ? index.boards.map(b => b.month) : [];
    for (const m of months) {
      const candidates = DEMO_MODE ? getDemoBoard(m) : readBoard(m);
      if (Array.isArray(candidates)) {
        allCandidates.push(...candidates);
      }
    }
    res.json(computeStats(allCandidates));
  });

  /**
   * @openapi
   * /api/modules/ai-catalyst/sync:
   *   post:
   *     tags: [AI Catalyst]
   *     summary: Manually trigger board sync from Google Sheets (admin)
   *     responses:
   *       200:
   *         description: Sync result
   *       500:
   *         description: Sync failed
   */
  router.post('/sync', requireAdmin, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', reason: 'demo mode' });
    }
    try {
      const result = await syncBoards();
      res.json({ status: 'ok', ...result });
    } catch (err) {
      res.status(500).json({ error: 'Sync failed: ' + (err.message || String(err)) });
    }
  });

  // --- Showcase routes ---

  const showcaseKeyFile = context.resolveSecret('GOOGLE_SERVICE_ACCOUNT_KEY_FILE') || '/etc/secrets/google-sa-key.json';

  function loadShowcaseDemoData() {
    return readFromStorage(SHOWCASE_STORAGE_KEY) || { entries: [], pillars: [], fetchedAt: null };
  }

  /**
   * @openapi
   * /api/modules/ai-catalyst/showcase/config:
   *   get:
   *     tags: [AI Catalyst]
   *     summary: Get showcase configuration (admin)
   *     responses:
   *       200:
   *         description: Current showcase configuration
   */
  router.get('/showcase/config', requireAdmin, function(req, res) {
    res.json(getShowcaseConfig(readFromStorage));
  });

  /**
   * @openapi
   * /api/modules/ai-catalyst/showcase/config:
   *   post:
   *     tags: [AI Catalyst]
   *     summary: Update showcase configuration (admin)
   *     responses:
   *       200:
   *         description: Configuration saved
   *       400:
   *         description: Validation error
   */
  router.post('/showcase/config', requireAdmin, function(req, res) {
    try {
      saveShowcaseConfig(writeToStorage, req.body);
      res.json({ status: 'saved' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * @openapi
   * /api/modules/ai-catalyst/showcase/entries:
   *   get:
   *     tags: [AI Catalyst]
   *     summary: List all active showcase entries with strategy pillars
   *     responses:
   *       200:
   *         description: Entries, pillars, and metadata
   */
  router.get('/showcase/entries', requireAuth, requireScope('ai-catalyst:showcase'), async function(req, res) {
    try {
      let data;
      const sheetId = getShowcaseConfig(readFromStorage).sheetId;
      if (DEMO_MODE || !sheetId) {
        data = loadShowcaseDemoData();
      } else {
        data = await getShowcaseData(sheetId, showcaseKeyFile, storage);
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
      console.error('[ai-catalyst:showcase] GET /entries error:', err.message);
      res.status(500).json({ error: 'Failed to load showcase data' });
    }
  });

  /**
   * @openapi
   * /api/modules/ai-catalyst/showcase/entries/{slug}:
   *   get:
   *     tags: [AI Catalyst]
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
  router.get('/showcase/entries/:slug', requireAuth, requireScope('ai-catalyst:showcase'), async function(req, res) {
    try {
      let data;
      const sheetId = getShowcaseConfig(readFromStorage).sheetId;
      if (DEMO_MODE || !sheetId) {
        data = loadShowcaseDemoData();
      } else {
        data = await getShowcaseData(sheetId, showcaseKeyFile, storage);
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
      console.error('[ai-catalyst:showcase] GET /entries/:slug error:', err.message);
      res.status(500).json({ error: 'Failed to load showcase entry' });
    }
  });

  /**
   * @openapi
   * /api/modules/ai-catalyst/showcase/refresh:
   *   post:
   *     tags: [AI Catalyst]
   *     summary: Force refresh showcase data from Google Sheets (admin)
   *     responses:
   *       200:
   *         description: Refresh result
   */
  router.post('/showcase/refresh', requireAdmin, async function(req, res) {
    const sheetId = getShowcaseConfig(readFromStorage).sheetId;
    if (DEMO_MODE || !sheetId) {
      return res.json({ status: 'skipped', reason: 'Demo mode or no sheet configured' });
    }

    try {
      clearShowcaseCache();
      const data = await fetchShowcaseData(sheetId, showcaseKeyFile, storage);
      res.json({
        status: 'refreshed',
        entries: data.entries.length,
        pillars: data.pillars.length,
        fetchedAt: data.fetchedAt,
      });
    } catch (err) {
      console.error('[ai-catalyst:showcase] POST /refresh error:', err.message);
      res.status(500).json({ error: 'Failed to refresh from Google Sheets', details: err.message });
    }
  });

  // --- Refresh handler ---

  if (context.registerRefresh) {
    context.registerRefresh('ai-catalyst:sync-boards', {
      order: 80,
      cadence: '1h',
      description: 'Sync monthly board data from POC Explorer Google Sheet',
      handler: async function() {
        if (DEMO_MODE) return { status: 'skipped', reason: 'demo mode' };
        if (!isConfigured()) return { status: 'skipped', reason: 'not configured' };
        const result = await syncBoards();
        return { status: 'success', ...result };
      }
    });

    context.registerRefresh('ai-catalyst:showcase-sync', {
      order: 81,
      cadence: '1h',
      description: 'Sync AI Catalyst Showcase data from Google Sheets',
      handler: async function() {
        const sheetId = getShowcaseConfig(readFromStorage).sheetId;
        if (DEMO_MODE || !sheetId) return;
        clearShowcaseCache();
        await fetchShowcaseData(sheetId, showcaseKeyFile, storage);
      },
    });
  }

  // --- Diagnostics ---

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const index = readIndex();
      const showcaseData = readFromStorage(SHOWCASE_STORAGE_KEY);
      return {
        configured: isConfigured(),
        demoMode: DEMO_MODE,
        lastSyncTime,
        syncRunning,
        boardCount: (index && index.boards) ? index.boards.length : 0,
        boards: (index && index.boards) || [],
        showcase: {
          sheetConfigured: !!getShowcaseConfig(readFromStorage).sheetId,
          dataExists: !!showcaseData,
          entryCount: showcaseData?.entries?.length || 0,
          pillarCount: showcaseData?.pillars?.length || 0,
          fetchedAt: showcaseData?.fetchedAt || null,
        }
      };
    });
  }

  // --- Export hook ---

  if (context.registerExport) {
    context.registerExport(async function(addFile, exportStorage) {
      const index = exportStorage.readFromStorage(INDEX_PATH);
      if (!index) return;
      addFile(INDEX_PATH, index);

      const boards = (index && index.boards) || [];
      for (const b of boards) {
        const data = exportStorage.readFromStorage(`${STORAGE_PREFIX}/boards/${b.month}.json`);
        if (data) {
          addFile(`${STORAGE_PREFIX}/boards/${b.month}.json`, data);
        }
      }

      const showcaseData = exportStorage.readFromStorage(SHOWCASE_STORAGE_KEY);
      if (showcaseData) {
        addFile(SHOWCASE_STORAGE_KEY, showcaseData);
      }
    });
  }
};
