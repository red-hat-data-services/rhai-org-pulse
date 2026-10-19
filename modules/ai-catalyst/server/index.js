const { createFeedClient } = require('./feed-client');
const {
  getShowcaseData,
  fetchShowcaseData,
  STORAGE_KEY: SHOWCASE_STORAGE_KEY,
  getReferencedPillarKeys,
  mergePillarMetadata,
  normalizeShowcaseData,
  parseArrayField,
} = require('./showcase/feed-sync');
const { getConfig: getShowcaseConfig, saveConfig: saveShowcaseConfig } = require('./showcase/config');
const { getConfig: getBoardConfig, saveConfig: saveBoardConfig } = require('./board-config');

const DEMO_MODE = process.env.DEMO_MODE === 'true';
const BOARD_NAME_RE = /^board-\d{4}-\d{2}$/;
const STORAGE_PREFIX = 'ai-catalyst';
const INDEX_PATH = `${STORAGE_PREFIX}/index.json`;
const DEFAULT_FEED_URL = 'https://pocexplorer.redhataicatalyst.com';
const DEFAULT_SHOWCASE_FEED_URL = 'https://showcase.redhataicatalyst.com';

const LIST_FIELDS = new Set([
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

/**
 * Map one feed row (object keyed by snake_case column) to the camelCase
 * candidate contract. Board feed rows stringify every value to former-sheet
 * semantics: "yes"/"no" booleans, decimal-string numbers, ", "-joined lists.
 */
function parseFeedRow(row) {
  const obj = {};
  for (const [key, raw] of Object.entries(row || {})) {
    if (!key) continue;
    const camel = snakeToCamel(key);
    const val = typeof raw === 'string' ? raw.trim() : raw;

    if (LIST_FIELDS.has(key)) {
      obj[camel] = parseArrayField(raw);
    } else if (NUMERIC_FIELDS.has(key)) {
      const n = Number(val);
      obj[camel] = (val === '' || val === null || val === undefined) ? null : (Number.isFinite(n) ? n : null);
    } else if (BOOLEAN_FIELDS.has(key)) {
      const s = typeof val === 'string' ? val.toLowerCase() : '';
      obj[camel] = s === 'yes' || s === 'true' || s === '1';
    } else if (JSON_FIELDS.has(key)) {
      // Empty means "no review history yet"; anything else must parse to an
      // array or the board fails loudly instead of silently erasing history.
      if (val === '' || val === null || val === undefined) {
        obj[camel] = [];
      } else {
        let parsed;
        try {
          parsed = JSON.parse(val);
        } catch {
          parsed = undefined;
        }
        if (!Array.isArray(parsed)) {
          throw new Error(`malformed ${key} on feed row "${row.title || row.unique_id || 'unknown'}" — expected a JSON array`);
        }
        // Elements reach CandidateDetail.vue, which reads review.timestamp
        // and lowercases review.decision: a null element or non-string
        // decision must fail the board here, not crash the client later.
        const badElement = parsed.find(e =>
          !(e && typeof e === 'object' && !Array.isArray(e)) ||
          (e.decision !== undefined && typeof e.decision !== 'string'));
        if (badElement !== undefined) {
          throw new Error(`malformed ${key} on feed row "${row.title || row.unique_id || 'unknown'}" — every element must be an object with a string decision`);
        }
        obj[camel] = parsed;
      }
    } else {
      obj[camel] = val;
    }
  }
  return obj;
}

function parseBoardRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    // Padding rows are empty after trimming — the parser trims every cell,
    // so an untrimmed emptiness test would keep whitespace-only rows and
    // store garbage candidates over valid cached data.
    .filter(row => row && Object.values(row).some(v => v != null && String(v).trim() !== ''))
    .map(row => parseFeedRow(row));
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
  const { readFromStorage, writeToStorage } = storage;

  context.registerScopes([
    { key: 'ai-catalyst:read', label: 'AI Catalyst (Read)', description: 'Read AI Catalyst board data', category: 'AI Catalyst' },
    { key: 'ai-catalyst:showcase', label: 'AI Catalyst Showcase (Read)', description: 'Read AI Catalyst showcase data', category: 'AI Catalyst' }
  ]);

  let lastSyncTime = null;
  let syncRunning = false;

  // Loopback feed URLs are opt-in: without this flag the token never goes to
  // a local listener, so stored settings cannot exfiltrate it on-loopback.
  // Declared in module.json (non-secret flag); resolveSecret is the
  // sanctioned env accessor — module server code never reads secrets
  // from process.env.
  const allowLoopback = context.resolveSecret('POC_EXPLORER_ALLOW_LOOPBACK') === '1';

  function getFeedToken() {
    return (secrets && secrets.POC_EXPLORER_FEED_TOKEN) || context.resolveSecret('POC_EXPLORER_FEED_TOKEN') || '';
  }

  async function getBoardFeedUrl() {
    const configured = (await getBoardConfig(readFromStorage)).feedUrl;
    return configured || (secrets && secrets.POC_EXPLORER_FEED_URL) || DEFAULT_FEED_URL;
  }

  async function getShowcaseFeedUrl() {
    const configured = (await getShowcaseConfig(readFromStorage)).feedUrl;
    return configured || (secrets && secrets.POC_EXPLORER_SHOWCASE_FEED_URL) || DEFAULT_SHOWCASE_FEED_URL;
  }

  // Origins the feed token may be sent to: the two documented defaults plus
  // env-configured URLs (machine-level operator approval). Loopback is only
  // reachable at all when POC_EXPLORER_ALLOW_LOOPBACK=1 is set.
  function getAllowedFeedOrigins() {
    const origins = new Set();
    for (const url of [
      DEFAULT_FEED_URL,
      DEFAULT_SHOWCASE_FEED_URL,
      secrets && secrets.POC_EXPLORER_FEED_URL,
      secrets && secrets.POC_EXPLORER_SHOWCASE_FEED_URL,
    ]) {
      if (!url) continue;
      try {
        origins.add(new URL(url).origin);
      } catch {
        // Malformed env URLs fall through to the feed client's own validation.
      }
    }
    return [...origins];
  }

  async function isConfigured() {
    return !!getFeedToken();
  }

  async function readIndex() {
    return (await readFromStorage(INDEX_PATH)) || { boards: [] };
  }

  async function readBoard(month) {
    return await readFromStorage(`${STORAGE_PREFIX}/boards/${month}.json`);
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

  /**
   * Resolve the pillar metadata represented by a complete monthly board.
   *
   * Board filters only change the candidate list returned to the client; the
   * pillar catalog must continue to describe the full unfiltered board. Do
   * not include showcase entry references here because those entries are a
   * separate catalog and may contain pillars with no board candidates.
   */
  function getBoardPillars(candidates, showcaseData) {
    const referencedKeys = getReferencedPillarKeys([], candidates);
    const referencedSet = new Set(referencedKeys);
    const metadata = (showcaseData && Array.isArray(showcaseData.pillars))
      ? showcaseData.pillars.filter(pillar => pillar && referencedSet.has(pillar.pillarKey))
      : [];

    return mergePillarMetadata(
      metadata,
      referencedKeys,
    );
  }

  /**
   * Resolve the complete showcase pillar catalog, including configured
   * pillars that currently have no entries. Entry references are synthesized
   * when a feed refresh has entries ahead of its pillar metadata row.
   */
  function getShowcasePillars(entries, showcaseData) {
    return mergePillarMetadata(
      showcaseData && showcaseData.pillars,
      getReferencedPillarKeys(entries, []),
    );
  }

  // --- Sync logic ---

  async function syncBoards() {
    if (syncRunning) return { status: 'skipped', reason: 'sync already running' };
    if (!(await isConfigured())) return { status: 'skipped', reason: 'not configured' };
    syncRunning = true;
    try {
      const client = createFeedClient({
        baseUrl: await getBoardFeedUrl(),
        token: getFeedToken(),
        allowedOrigins: getAllowedFeedOrigins(),
        allowLoopback,
      });

      const listedBoards = await client.listBoards();

      if (listedBoards.length === 0) {
        // A shape-valid empty list is a degraded feed, not a successful
        // sync: the skip shape keeps the refresh handler due for the next
        // tick instead of stamping success for a full cadence window.
        return { status: 'skipped', reason: 'feed returned no boards' };
      }

      // A name the board filter drops is failed propagation, not a silent
      // skip: it rides failed[] so the refresh handler rejects the run.
      const failed = listedBoards
        .filter(n => !BOARD_NAME_RE.test(n))
        .map(n => ({ board: n, error: 'board name does not match board-YYYY-MM' }));
      const boardNames = listedBoards.filter(n => BOARD_NAME_RE.test(n));

      const existingIndex = await readIndex();
      const previousByMonth = new Map((existingIndex.boards || []).map(b => [b.month, b]));
      const months = new Set(previousByMonth.keys());
      const syncedMonths = new Set();
      let syncCount = 0;

      for (const boardName of boardNames) {
        const month = boardName.replace('board-', '');
        try {
          const payload = await client.getBoard(boardName);
          const candidates = parseBoardRows(payload.rows);
          if (candidates.some(candidate => !candidate.uniqueId && !candidate.link)) {
            throw new Error('invalid candidate identity — expected a unique_id or source link');
          }
          if (candidates.length === 0 && payload.count > 0) {
            throw new Error(`degraded board payload — reported ${payload.count} rows but none parsed into candidates`);
          }
          await writeToStorage(`${STORAGE_PREFIX}/boards/${month}.json`, candidates);
          syncCount++;
          syncedMonths.add(month);
          months.add(month);
        } catch (err) {
          failed.push({ board: boardName, error: err.message || String(err) });
        }
      }

      const now = new Date().toISOString();
      const boards = [];
      for (const month of [...months].sort().reverse()) {
        const data = await readBoard(month);
        boards.push({
          month,
          candidateCount: Array.isArray(data) ? data.length : 0,
          // Months that did not sync this run keep their previous timestamp,
          // so a failed refresh cannot masquerade as a fresh sync.
          lastSynced: syncedMonths.has(month) ? now : (previousByMonth.get(month) || {}).lastSynced || null
        });
      }

      const runFailed = failed.length > 0;
      await writeToStorage(INDEX_PATH, {
        boards,
        lastSynced: runFailed ? (existingIndex.lastSynced || null) : now
      });
      if (!runFailed) {
        lastSyncTime = now;
      }
      return { synced: syncCount, failed, total: listedBoards.length };
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
  router.get('/board-config', requireAdmin, async function(req, res) {
    res.json(await getBoardConfig(readFromStorage));
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
  router.post('/board-config', requireAdmin, async function(req, res) {
    try {
      await saveBoardConfig(writeToStorage, req.body);
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
  router.get('/config', requireAuth, requireScope('ai-catalyst:read'), async function(req, res) {
    const index = DEMO_MODE ? getDemoIndex() : await readIndex();
    res.json({
      configured: await isConfigured(),
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
  router.get('/boards', requireAuth, requireScope('ai-catalyst:read'), async function(req, res) {
    const index = DEMO_MODE ? getDemoIndex() : await readIndex();
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
   *         description: Filtered and sorted candidates with the pillar metadata referenced by the board
   *       400:
   *         description: Invalid month format
   *       404:
   *         description: Board not found
   */
  router.get('/boards/:month', requireAuth, requireScope('ai-catalyst:read'), async function(req, res) {
    const { month } = req.params;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Month must be in YYYY-MM format' });
    }

    const candidates = DEMO_MODE ? getDemoBoard(month) : await readBoard(month);
    if (!candidates) {
      return res.status(404).json({ error: `Board not found for ${month}` });
    }

    const filtered = filterCandidates(candidates, req.query);
    const showcaseData = await loadPillarData();
    res.json({
      month,
      total: candidates.length,
      filtered: filtered.length,
      pillars: getBoardPillars(candidates, showcaseData),
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
    *         description: Candidate unique_id, or source link for legacy rows without an ID
   *     responses:
   *       200:
   *         description: Candidate details with the resolved strategy pillar metadata
   *       404:
   *         description: Candidate not found
   */
  router.get('/candidates/:id', requireAuth, requireScope('ai-catalyst:read'), async function(req, res) {
    const { id } = req.params;
    const index = DEMO_MODE ? getDemoIndex() : await readIndex();
    const months = (index && index.boards) ? index.boards.map(b => b.month) : [];

    for (const month of months) {
      const candidates = DEMO_MODE ? getDemoBoard(month) : await readBoard(month);
      if (!Array.isArray(candidates)) continue;
      const found = candidates.find(c => c.uniqueId === id || (!c.uniqueId && c.link === id));
      if (found) {
        const showcaseData = await loadPillarData();
        const pillar = getBoardPillars([found], showcaseData)
          .find(p => p.pillarKey === found.category) || null;
        return res.json({ ...found, boardMonth: month, pillar });
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
  router.get('/stats', requireAuth, requireScope('ai-catalyst:read'), async function(req, res) {
    const { month } = req.query;
    const index = DEMO_MODE ? getDemoIndex() : await readIndex();

    if (month) {
      const candidates = DEMO_MODE ? getDemoBoard(month) : await readBoard(month);
      return res.json(computeStats(candidates || []));
    }

    const allCandidates = [];
    const months = (index && index.boards) ? index.boards.map(b => b.month) : [];
    for (const m of months) {
      const candidates = DEMO_MODE ? getDemoBoard(m) : await readBoard(m);
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
   *     summary: Manually trigger board sync from the POC Explorer feed (admin)
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

  async function loadShowcaseDemoData() {
    return normalizeShowcaseData(
      (await readFromStorage(SHOWCASE_STORAGE_KEY)) || { entries: [], pillars: [], fetchedAt: null },
    );
  }

  // Board and showcase data are synced independently. Prefer the cached
  // showcase catalog so board requests remain available when the feed is
  // temporarily unreachable, and synthesize metadata for any category that
  // has arrived in a board before its pillar row has been refreshed.
  async function loadPillarData() {
    try {
      const stored = await readFromStorage(SHOWCASE_STORAGE_KEY);
      if (stored) return normalizeShowcaseData(stored);
    } catch (err) {
      console.error('[ai-catalyst:showcase] Failed to read pillar cache:', err.message);
    }

    if (DEMO_MODE) {
      return loadShowcaseDemoData();
    }

    try {
      if (await isConfigured()) {
        return normalizeShowcaseData(
          await getShowcaseData(getShowcaseFeedUrl, getFeedToken(), storage, getAllowedFeedOrigins(), allowLoopback),
        );
      }
    } catch (err) {
      console.error('[ai-catalyst:showcase] Failed to load pillar metadata:', err.message);
    }

    return normalizeShowcaseData({ entries: [], pillars: [], fetchedAt: null });
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
  router.get('/showcase/config', requireAdmin, async function(req, res) {
    res.json(await getShowcaseConfig(readFromStorage));
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
  router.post('/showcase/config', requireAdmin, async function(req, res) {
    try {
      await saveShowcaseConfig(writeToStorage, req.body);
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
      if (DEMO_MODE || !(await isConfigured())) {
        data = await loadShowcaseDemoData();
      } else {
        data = await getShowcaseData(getShowcaseFeedUrl, getFeedToken(), storage, getAllowedFeedOrigins(), allowLoopback);
      }

      data = normalizeShowcaseData(data);

      const entries = (data.entries || []).filter(function(e) {
        return e.status !== 'draft';
      });

      res.json({
        entries,
        pillars: getShowcasePillars(entries, data),
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
      if (DEMO_MODE || !(await isConfigured())) {
        data = await loadShowcaseDemoData();
      } else {
        data = await getShowcaseData(getShowcaseFeedUrl, getFeedToken(), storage, getAllowedFeedOrigins(), allowLoopback);
      }

      data = normalizeShowcaseData(data);

      const entry = (data.entries || []).find(function(e) {
        return e.slug === req.params.slug;
      });

      if (!entry) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      const pillar = getShowcasePillars(data.entries, data).find(function(p) {
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
   *     summary: Force refresh showcase data from the POC Explorer feed (admin)
   *     responses:
   *       200:
   *         description: Refresh result
   */
  router.post('/showcase/refresh', requireAdmin, async function(req, res) {
    if (DEMO_MODE || !(await isConfigured())) {
      return res.json({ status: 'skipped', reason: 'Demo mode or feed not configured' });
    }

    try {
      const data = await fetchShowcaseData(await getShowcaseFeedUrl(), getFeedToken(), storage, getAllowedFeedOrigins(), allowLoopback);
      res.json({
        status: 'refreshed',
        entries: data.entries.length,
        pillars: data.pillars.length,
        fetchedAt: data.fetchedAt,
      });
    } catch (err) {
      console.error('[ai-catalyst:showcase] POST /refresh error:', err.message);
      res.status(500).json({ error: 'Failed to refresh from POC Explorer feed', details: err.message });
    }
  });

  // --- Refresh handler ---

  if (context.registerRefresh) {
    context.registerRefresh('ai-catalyst:sync-boards', {
      order: 80,
      cadence: '1h',
      description: 'Sync monthly board data from the POC Explorer feed',
      handler: async function() {
        if (DEMO_MODE) return { status: 'skipped', reason: 'demo mode' };
        if (!(await isConfigured())) return { status: 'skipped', reason: 'not configured' };
        const result = await syncBoards();
        if (result.status === 'skipped') return result;
        if (result.failed && result.failed.length) {
          // Throwing is the refresh registry's retry mechanism: a returned
          // value counts as success and would advance lastSuccessfulRun,
          // silencing retries for a full cadence window.
          throw new Error(
            `Board sync failed for ${result.failed.length}/${result.total} boards — `
            + result.failed.map(f => `${f.board}: ${f.error}`).join('; '),
          );
        }
        return { status: 'success', ...result };
      }
    });

    context.registerRefresh('ai-catalyst:showcase-sync', {
      order: 81,
      cadence: '1h',
      description: 'Sync AI Catalyst Showcase data from the POC Explorer feed',
      handler: async function() {
        // A bare return counts as success and burns the cadence window;
        // the skip shape keeps the handler due for the next tick.
        if (DEMO_MODE) return { status: 'skipped', reason: 'demo mode' };
        if (!(await isConfigured())) return { status: 'skipped', reason: 'not configured' };
        await fetchShowcaseData(await getShowcaseFeedUrl(), getFeedToken(), storage, getAllowedFeedOrigins(), allowLoopback);
      },
    });
  }

  // --- Diagnostics ---

  if (context.registerDiagnostics) {
    context.registerDiagnostics(async function() {
      const index = await readIndex();
      const showcaseData = await readFromStorage(SHOWCASE_STORAGE_KEY);
      return {
        configured: await isConfigured(),
        demoMode: DEMO_MODE,
        lastSyncTime,
        syncRunning,
        boardCount: (index && index.boards) ? index.boards.length : 0,
        boards: (index && index.boards) || [],
        feed: {
          url: await getBoardFeedUrl(),
          tokenConfigured: !!getFeedToken(),
        },
        showcase: {
          configured: await isConfigured(),
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
      const index = await exportStorage.readFromStorage(INDEX_PATH);
      if (!index) return;
      addFile(INDEX_PATH, index);

      const boards = (index && index.boards) || [];
      for (const b of boards) {
        const data = await exportStorage.readFromStorage(`${STORAGE_PREFIX}/boards/${b.month}.json`);
        if (data) {
          addFile(`${STORAGE_PREFIX}/boards/${b.month}.json`, data);
        }
      }

      const showcaseData = await exportStorage.readFromStorage(SHOWCASE_STORAGE_KEY);
      if (showcaseData) {
        addFile(SHOWCASE_STORAGE_KEY, showcaseData);
      }
    });
  }
};
