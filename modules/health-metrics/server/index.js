module.exports = function registerRoutes(router, context) {
  const { storage, requireAdmin, roleStore } = context;
  const { readFromStorage, writeToStorage } = storage;
  const { DATA_DIR } = require('../../../shared/server/storage');
  const { createEventStore } = require('./event-store');
  const { aggregateEvents, mergeDailyBreakdown } = require('./aggregator');

  const DEMO_MODE = process.env.DEMO_MODE === 'true';
  const eventStore = createEventStore(DATA_DIR);

  // ─── In-memory user-type cache ───

  const userTypeCache = new Map();
  let configuredFieldId = null;
  let registryMtime = 0;

  function loadConfig() {
    return readFromStorage('health-metrics/config.json') || {
      userTypeFieldId: null,
      retentionDays: 90,
    };
  }

  function saveConfig(config) {
    writeToStorage('health-metrics/config.json', config);
  }

  function rebuildUserTypeCache() {
    const config = loadConfig();
    configuredFieldId = config.userTypeFieldId;
    userTypeCache.clear();
    if (!configuredFieldId) return;

    const registry = readFromStorage('team-data/registry.json');
    if (!registry?.people) return;

    for (const [uid, person] of Object.entries(registry.people)) {
      if (person.status !== 'active') continue;
      const val = person._appFields?.[configuredFieldId];
      if (val) {
        userTypeCache.set(uid, typeof val === 'string' ? val : String(val));
      }
    }
  }

  // Build cache on startup
  rebuildUserTypeCache();

  // Poll registry mtime every 60s to detect roster sync changes
  const registryCheckInterval = setInterval(() => {
    try {
      const fs = require('fs');
      const path = require('path');
      const registryPath = path.join(DATA_DIR, 'team-data', 'registry.json');
      const stat = fs.statSync(registryPath);
      if (stat.mtimeMs > registryMtime) {
        registryMtime = stat.mtimeMs;
        rebuildUserTypeCache();
      }
    } catch {
      // registry file may not exist yet
    }
  }, 60_000);

  // Prevent interval from keeping the process alive
  if (registryCheckInterval.unref) registryCheckInterval.unref();

  // ─── Server-side dedup ───

  const recentEvents = new Set();
  const DEDUP_WINDOW_MS = 10_000;

  function isDuplicate(email, page) {
    const key = `${email}::${page}`;
    if (recentEvents.has(key)) return true;
    recentEvents.add(key);
    setTimeout(() => recentEvents.delete(key), DEDUP_WINDOW_MS);
    return false;
  }

  // ─── Access control ───

  function requireMetricsViewer(req, res, next) {
    if (req.isAdmin) return next();
    if (roleStore.hasRole(req.userEmail, 'usage-metrics-viewer')) return next();
    return res.status(403).json({ error: 'Usage metrics access required. Ask an admin to assign the usage-metrics-viewer role.' });
  }

  // ─── Opt-out ───

  function loadOptedOut() {
    return readFromStorage('health-metrics/opted-out.json') || { emails: [] };
  }

  function saveOptedOut(data) {
    writeToStorage('health-metrics/opted-out.json', data);
  }

  // ─── Aggregate cache (current month, 5-min TTL) ───

  let currentMonthAggregate = null;
  let currentMonthAggregateAt = 0;
  const AGGREGATE_TTL_MS = 5 * 60 * 1000;

  function getOrComputeAggregate(monthKey) {
    // Check for pre-computed aggregate
    const stored = readFromStorage(`health-metrics/aggregates/${monthKey}.json`);
    if (stored) return stored;

    // For current month, use in-memory cache with TTL
    const now = Date.now();
    const currentMonth = eventStore.getMonthKey(new Date());
    if (monthKey === currentMonth && currentMonthAggregate && (now - currentMonthAggregateAt) < AGGREGATE_TTL_MS) {
      return currentMonthAggregate;
    }

    // Compute from raw events
    const events = eventStore.readMonth(monthKey);
    if (events.length === 0) return null;

    const agg = aggregateEvents(events, monthKey);
    if (monthKey === currentMonth) {
      currentMonthAggregate = agg;
      currentMonthAggregateAt = now;
    }
    return agg;
  }

  function invalidateCurrentMonthCache() {
    currentMonthAggregate = null;
    currentMonthAggregateAt = 0;
  }

  // ─── Pruning scheduler ───

  function runPruning() {
    const config = loadConfig();
    const retentionDays = config.retentionDays || 90;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const cutoffMonth = eventStore.getMonthKey(cutoff);
    const cutoffTs = cutoff.toISOString();

    const monthFiles = eventStore.listMonthFiles();
    if (monthFiles.length === 0) return;

    eventStore.startPruning();
    try {
      for (const monthKey of monthFiles) {
        if (monthKey > cutoffMonth) continue;

        const events = eventStore.readMonth(monthKey);
        if (events.length === 0) continue;

        if (monthKey < cutoffMonth) {
          // Fully expired month: aggregate then delete
          const existing = readFromStorage(`health-metrics/aggregates/${monthKey}.json`);
          if (!existing) {
            const agg = aggregateEvents(events, monthKey);
            writeToStorage(`health-metrics/aggregates/${monthKey}.json`, agg);
          }
          eventStore.deleteMonthFile(monthKey);
        } else {
          // Boundary month: filter out expired events
          const kept = events.filter(e => e.ts >= cutoffTs);
          if (kept.length < events.length) {
            // Aggregate the pruned events before removing them
            const pruned = events.filter(e => e.ts < cutoffTs);
            if (pruned.length > 0) {
              const existing = readFromStorage(`health-metrics/aggregates/${monthKey}.json`);
              if (!existing) {
                const agg = aggregateEvents(events, monthKey);
                writeToStorage(`health-metrics/aggregates/${monthKey}.json`, agg);
              }
            }
            eventStore.rewriteMonth(monthKey, kept);
          }
        }
      }
    } finally {
      eventStore.finishPruning();
    }
    invalidateCurrentMonthCache();
  }

  // Deferred startup pruning + daily schedule
  if (!DEMO_MODE) {
    const pruneTimer = setTimeout(() => {
      try { runPruning(); } catch (err) {
        console.error('[health-metrics] Pruning error:', err.message);
      }
    }, 30_000);
    if (pruneTimer.unref) pruneTimer.unref();

    const dailyPrune = setInterval(() => {
      try { runPruning(); } catch (err) {
        console.error('[health-metrics] Pruning error:', err.message);
      }
    }, 24 * 60 * 60 * 1000);
    if (dailyPrune.unref) dailyPrune.unref();
  }

  // ─── Helper: collect aggregates for a date range ───

  function collectAggregates(from, to) {
    const fromMonth = eventStore.getMonthKey(new Date(from));
    const toMonth = eventStore.getMonthKey(new Date(to));
    const aggregates = [];

    // Scan stored aggregates
    const storedFiles = (storage.listStorageFiles?.('health-metrics/aggregates') || []);
    const monthFiles = eventStore.listMonthFiles();
    const allMonths = new Set([
      ...storedFiles.map(f => f.replace('.json', '')),
      ...monthFiles,
    ]);

    for (const monthKey of [...allMonths].sort()) {
      if (monthKey < fromMonth || monthKey > toMonth) continue;
      const agg = getOrComputeAggregate(monthKey);
      if (agg) aggregates.push(agg);
    }
    return aggregates;
  }

  // ─── Per-user rate limiting for /track ───

  const RATE_LIMIT_MAX = 30;
  const RATE_LIMIT_WINDOW_MS = 60_000;
  const rateCounts = new Map();

  function isRateLimited(email) {
    const now = Date.now();
    const entry = rateCounts.get(email);
    if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
      rateCounts.set(email, { windowStart: now, count: 1 });
      return false;
    }
    entry.count++;
    return entry.count > RATE_LIMIT_MAX;
  }

  // ─── Routes: Tracking ───

  const PAGE_ID_PATTERN = /^[a-zA-Z0-9:_/-]+$/;
  const PAGE_ID_MAX_LENGTH = 200;

  router.post('/track', (req, res) => {
    if (DEMO_MODE) return res.json({ ok: true });

    const { page } = req.body;
    if (!page || typeof page !== 'string' || !page.includes('::')) {
      return res.status(400).json({ error: 'Invalid page format. Expected module::viewId.' });
    }
    if (page.length > PAGE_ID_MAX_LENGTH || !PAGE_ID_PATTERN.test(page)) {
      return res.status(400).json({ error: 'Invalid page ID: too long or contains invalid characters.' });
    }

    const email = req.userEmail;
    if (!email) return res.status(401).json({ error: 'Authentication required.' });

    // Per-user rate limit
    if (isRateLimited(email)) {
      return res.status(429).json({ error: 'Too many tracking events. Try again later.' });
    }

    // Check opt-out (server-side defense in depth)
    const optedOut = loadOptedOut();
    if (optedOut.emails.includes(email)) {
      return res.json({ ok: true, tracked: false });
    }

    // Server-side dedup
    if (isDuplicate(email, page)) {
      return res.json({ ok: true, deduped: true });
    }

    const userType = (req.userUid && userTypeCache.get(req.userUid)) || 'unknown';
    const permissionTier = req.permissionTier || 'user';

    eventStore.append({
      ts: new Date().toISOString(),
      page,
      email,
      userType,
      permissionTier,
    });

    invalidateCurrentMonthCache();
    res.json({ ok: true });
  });

  router.get('/tracking/status', (req, res) => {
    const optedOut = loadOptedOut();
    res.json({ optedOut: optedOut.emails.includes(req.userEmail) });
  });

  router.post('/tracking/opt-out', (req, res) => {
    const optedOut = loadOptedOut();
    if (!optedOut.emails.includes(req.userEmail)) {
      optedOut.emails.push(req.userEmail);
      saveOptedOut(optedOut);
    }
    res.json({ ok: true, optedOut: true });
  });

  router.delete('/tracking/opt-out', (req, res) => {
    const optedOut = loadOptedOut();
    const idx = optedOut.emails.indexOf(req.userEmail);
    if (idx !== -1) {
      optedOut.emails.splice(idx, 1);
      saveOptedOut(optedOut);
    }
    res.json({ ok: true, optedOut: false });
  });

  // ─── Routes: Dashboard (admin or viewer) ───

  router.get('/dashboard', requireMetricsViewer, (req, res) => {
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    const fromDate = new Date(req.query.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    const toDate = new Date(to);

    const aggregates = collectAggregates(fromDate, toDate);

    // Merge aggregates into summary
    let totalViews = 0;
    const pageStats = {};
    const userTypeTotals = {};
    const dailyData = {};

    for (const agg of aggregates) {
      for (const [pageId, data] of Object.entries(agg.pages || {})) {
        totalViews += data.views;
        if (!pageStats[pageId]) {
          pageStats[pageId] = { views: 0, uniqueUsers: 0, byUserType: {}, byPermissionTier: {} };
        }
        pageStats[pageId].views += data.views;
        pageStats[pageId].uniqueUsers += data.uniqueUsers;

        for (const [ut, count] of Object.entries(data.byUserType || {})) {
          pageStats[pageId].byUserType[ut] = (pageStats[pageId].byUserType[ut] || 0) + count;
          userTypeTotals[ut] = (userTypeTotals[ut] || 0) + count;
        }
        for (const [pt, count] of Object.entries(data.byPermissionTier || {})) {
          pageStats[pageId].byPermissionTier[pt] = (pageStats[pageId].byPermissionTier[pt] || 0) + count;
        }
      }
    }

    // Also compute daily breakdown from current month's raw events
    const currentMonth = eventStore.getMonthKey(new Date());
    if (!DEMO_MODE) {
      const events = eventStore.readMonth(currentMonth);
      const daily = mergeDailyBreakdown(events);
      Object.assign(dailyData, daily);
    }

    const topPages = Object.entries(pageStats)
      .sort((a, b) => b[1].views - a[1].views)
      .slice(0, 10)
      .map(([pageId, data]) => ({ pageId, ...data }));

    res.json({
      totalViews,
      activePages: Object.keys(pageStats).length,
      topPages,
      userTypes: userTypeTotals,
      daily: dailyData,
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
    });
  });

  router.get('/pages', requireMetricsViewer, (req, res) => {
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    const fromDate = new Date(req.query.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    const toDate = new Date(to);
    const sort = req.query.sort === 'unique' ? 'uniqueUsers' : 'views';
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    const aggregates = collectAggregates(fromDate, toDate);
    const pageStats = {};

    for (const agg of aggregates) {
      for (const [pageId, data] of Object.entries(agg.pages || {})) {
        if (!pageStats[pageId]) {
          pageStats[pageId] = { views: 0, uniqueUsers: 0, byUserType: {}, byPermissionTier: {} };
        }
        pageStats[pageId].views += data.views;
        pageStats[pageId].uniqueUsers += data.uniqueUsers;
        for (const [ut, count] of Object.entries(data.byUserType || {})) {
          pageStats[pageId].byUserType[ut] = (pageStats[pageId].byUserType[ut] || 0) + count;
        }
        for (const [pt, count] of Object.entries(data.byPermissionTier || {})) {
          pageStats[pageId].byPermissionTier[pt] = (pageStats[pageId].byPermissionTier[pt] || 0) + count;
        }
      }
    }

    const pages = Object.entries(pageStats)
      .sort((a, b) => b[1][sort] - a[1][sort])
      .slice(0, limit)
      .map(([pageId, data]) => ({ pageId, ...data }));

    res.json({ pages });
  });

  router.get('/pages/:pageId', requireMetricsViewer, (req, res) => {
    const pageId = req.params.pageId;
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    const fromDate = new Date(req.query.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    const toDate = new Date(to);

    const aggregates = collectAggregates(fromDate, toDate);
    const merged = { views: 0, uniqueUsers: 0, byUserType: {}, byPermissionTier: {} };

    for (const agg of aggregates) {
      const data = agg.pages?.[pageId];
      if (!data) continue;
      merged.views += data.views;
      merged.uniqueUsers += data.uniqueUsers;
      for (const [ut, count] of Object.entries(data.byUserType || {})) {
        merged.byUserType[ut] = (merged.byUserType[ut] || 0) + count;
      }
      for (const [pt, count] of Object.entries(data.byPermissionTier || {})) {
        merged.byPermissionTier[pt] = (merged.byPermissionTier[pt] || 0) + count;
      }
    }

    // Daily breakdown from raw events for current month
    let daily = {};
    if (!DEMO_MODE) {
      const currentMonth = eventStore.getMonthKey(new Date());
      const events = eventStore.readMonth(currentMonth).filter(e => e.page === pageId);
      daily = mergeDailyBreakdown(events);
    }

    res.json({ pageId, ...merged, daily });
  });

  router.get('/user-types', requireMetricsViewer, (req, res) => {
    const to = req.query.to || new Date().toISOString().slice(0, 10);
    const fromDate = new Date(req.query.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    const toDate = new Date(to);

    const aggregates = collectAggregates(fromDate, toDate);
    const userTypes = {};

    for (const agg of aggregates) {
      for (const data of Object.values(agg.pages || {})) {
        for (const [ut, count] of Object.entries(data.byUserType || {})) {
          userTypes[ut] = (userTypes[ut] || 0) + count;
        }
      }
    }

    res.json({ userTypes });
  });

  // ─── Routes: Admin config ───

  router.get('/config', requireAdmin, (req, res) => {
    res.json(loadConfig());
  });

  router.post('/config', requireAdmin, (req, res) => {
    const config = loadConfig();
    if (req.body.userTypeFieldId !== undefined) {
      config.userTypeFieldId = req.body.userTypeFieldId;
    }
    if (req.body.retentionDays !== undefined) {
      const days = parseInt(req.body.retentionDays);
      if (isNaN(days) || days < 30 || days > 365) {
        return res.status(400).json({ error: 'retentionDays must be between 30 and 365.' });
      }
      config.retentionDays = days;
    }
    saveConfig(config);
    rebuildUserTypeCache();
    res.json(config);
  });

  router.post('/aggregate', requireAdmin, (req, res) => {
    const monthFiles = eventStore.listMonthFiles();
    let generated = 0;
    for (const monthKey of monthFiles) {
      const events = eventStore.readMonth(monthKey);
      if (events.length === 0) continue;
      const agg = aggregateEvents(events, monthKey);
      writeToStorage(`health-metrics/aggregates/${monthKey}.json`, agg);
      generated++;
    }
    invalidateCurrentMonthCache();
    res.json({ ok: true, generated });
  });

  router.delete('/events', requireAdmin, (req, res) => {
    eventStore.deleteAllEvents();
    invalidateCurrentMonthCache();
    res.json({ ok: true });
  });

  // ─── Routes: Field definitions (for settings UI) ───

  router.get('/field-definitions', requireAdmin, (req, res) => {
    const fieldDefs = readFromStorage('team-data/field-definitions.json');
    if (!fieldDefs) return res.json({ person: [], team: [] });
    // Return only person-level fields for user-type selection
    const personFields = (fieldDefs.personFields || []).filter(f => !f.deleted);
    res.json({ person: personFields });
  });
};
