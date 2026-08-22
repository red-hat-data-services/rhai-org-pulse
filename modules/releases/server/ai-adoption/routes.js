/**
 * AI Adoption sub-router.
 *
 * Serves AI pipeline adoption scorecards across multiple projects and
 * release groups. Data is cached to storage after the first fetch;
 * subsequent reads serve from cache. Use POST /refresh to re-fetch.
 *
 * Mount: /api/modules/releases/ai-adoption/
 */

const { fetchAiAdoptionData } = require('./pipeline');

const STORAGE_KEY = 'releases/ai-adoption/latest.json';

/**
 * Apply optional filters to the cached full dataset.
 */
function applyFilters(cached, { releaseGroup, component }) {
  let groups = cached.releaseGroups;

  if (releaseGroup) {
    groups = groups.filter(g => g.releaseGroup === releaseGroup);
  }

  if (component) {
    groups = groups.map(g => {
      const filtered = (g.components || []).filter(c => c.name === component);
      const total = filtered.reduce((s, c) => s + c.total, 0);
      const aiTouched = filtered.reduce((s, c) => s + c.aiTouched, 0);
      const pipelines = {};
      for (const k of Object.keys(g.pipelines || {})) {
        pipelines[k] = filtered.reduce((s, c) => s + ((c.pipelines && c.pipelines[k]) || 0), 0);
      }
      const firstPass = {};
      for (const k of Object.keys(g.firstPass || {})) {
        firstPass[k] = filtered.reduce((acc, c) => {
          const fp = c.firstPass && c.firstPass[k];
          if (fp) { acc.accepted += fp.accepted; acc.total += fp.total; }
          return acc;
        }, { accepted: 0, total: 0 });
      }
      return { ...g, totalFeatures: total, aiTouchedFeatures: aiTouched, pipelines, firstPass, components: filtered };
    });
  }

  return { releaseGroups: groups, fetchedAt: cached.fetchedAt };
}

/**
 * @openapi
 * /api/modules/releases/ai-adoption:
 *   get:
 *     tags: [Releases]
 *     summary: Get AI pipeline adoption scorecard data (cached)
 *     description: >
 *       Returns cached AI adoption scorecard data. If no cache exists,
 *       triggers a live fetch from Jira and caches the result. Use
 *       POST /refresh to force a re-fetch.
 *     parameters:
 *       - in: query
 *         name: releaseGroup
 *         schema:
 *           type: string
 *           enum: ['3.4 GA', '3.5 EA1', '3.5 EA2', '3.5 GA']
 *         description: Filter to a single release group (omit for all)
 *       - in: query
 *         name: component
 *         schema:
 *           type: string
 *         description: Filter to a single component name
 *     responses:
 *       200:
 *         description: >
 *           Release group adoption results including per-component effort
 *           metrics (effortSignal, aggregateEffort, avgEffort) resolved
 *           from customfield_10430, RICE Effort, or subtask count
 *       503:
 *         description: Jira client not configured
 */

/**
 * @openapi
 * /api/modules/releases/ai-adoption/refresh:
 *   post:
 *     tags: [Releases]
 *     summary: Refresh AI adoption data from Jira
 *     description: Fetches all features from Jira, scans for AI pipeline labels, and caches the result
 *     responses:
 *       200:
 *         description: Refreshed AI adoption data
 *       503:
 *         description: Jira client not configured
 */

function registerAiAdoptionRoutes(router, { storage, requireAuth, requireScope, jira }) {
  async function fetchAndCache() {
    const data = await fetchAiAdoptionData(jira);
    const payload = {
      releaseGroups: data,
      fetchedAt: new Date().toISOString()
    };
    await storage.writeToStorage(STORAGE_KEY, payload);
    return payload;
  }

  router.get('/', requireAuth, requireScope('releases:read'), async function (req, res) {
    const releaseGroup = req.query.releaseGroup || null;
    const component = req.query.component || null;

    try {
      let cached = await storage.readFromStorage(STORAGE_KEY);

      if (!cached) {
        if (!jira) {
          return res.status(503).json({ error: 'Jira client not configured and no cached data available' });
        }
        cached = await fetchAndCache();
      }

      const result = applyFilters(cached, { releaseGroup, component });
      res.json(result);
    } catch (err) {
      console.error('[ai-adoption] Fetch failed:', err.message);
      res.status(500).json({ error: 'Failed to fetch AI adoption data' });
    }
  });

  router.post('/refresh', requireAuth, requireScope('releases:write'), async function (req, res) {
    if (!jira) {
      return res.status(503).json({ error: 'Jira client not configured' });
    }

    try {
      const payload = await fetchAndCache();
      res.json(payload);
    } catch (err) {
      console.error('[ai-adoption] Refresh failed:', err.message);
      res.status(500).json({ error: 'Failed to refresh AI adoption data' });
    }
  });
}

module.exports = registerAiAdoptionRoutes;
