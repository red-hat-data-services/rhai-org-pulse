/**
 * Release Readiness sub-router.
 *
 * Serves pre-generated release readiness metrics (produced by the
 * external fetch_release_metrics.py script, pushed via /upload) from
 * local storage.
 *
 * Mount: /api/modules/releases/release-readiness/
 */

const STORAGE_PREFIX = 'releases/release-readiness';

/**
 * @openapi
 * /api/modules/releases/release-readiness:
 *   get:
 *     tags: [Releases]
 *     summary: Get release readiness metrics for a release version
 *     parameters:
 *       - in: query
 *         name: version
 *         required: true
 *         schema: { type: string }
 *         description: Release version (e.g. "RHOAI 2.20")
 *     responses:
 *       200:
 *         description: Aggregated delivery metrics payload
 *       404:
 *         description: No metrics found for the specified version
 */

/**
 * @openapi
 * /api/modules/releases/release-readiness/versions:
 *   get:
 *     tags: [Releases]
 *     summary: List available release readiness versions
 *     responses:
 *       200:
 *         description: Object with versions array and default_version
 */

/**
 * @openapi
 * /api/modules/releases/release-readiness/upload:
 *   post:
 *     tags: [Releases]
 *     summary: Upload release readiness metrics JSON (from external script)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Metrics stored successfully
 *       400:
 *         description: Invalid payload (missing version or summary)
 */

function registerReleaseReadinessRoutes(router, { storage, requireAuth, requireScope }) {

  router.get('/', requireAuth, requireScope('releases:read'), async (req, res) => {
    const version = req.query.version;
    if (!version) {
      return res.status(400).json({ error: 'version query parameter is required' });
    }

    const filename = sanitizeFilename(version);
    const data = await storage.readFromStorage(`${STORAGE_PREFIX}/${filename}.json`);

    if (!data) {
      return res.status(404).json({ error: `No release readiness metrics found for version "${version}"` });
    }

    res.json(data);
  });

  router.get('/versions', requireAuth, requireScope('releases:read'), async (req, res) => {
    let files;
    try {
      files = await storage.listStorageFiles(STORAGE_PREFIX);
    } catch {
      return res.json({ versions: [], default_version: null });
    }

    const versions = (files || [])
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', '').replace(/_/g, ' '));

    const defaultVersion = findUpcomingVersion(versions, storage);

    res.json({ versions, default_version: defaultVersion });
  });

  router.post('/upload', requireAuth, requireScope('releases:write'), async (req, res) => {
    const payload = req.body;

    if (!payload || !payload.version || !payload.summary) {
      return res.status(400).json({ error: 'Invalid payload: must include version and summary' });
    }

    const filename = sanitizeFilename(payload.version);
    await storage.writeToStorage(`${STORAGE_PREFIX}/${filename}.json`, payload);

    res.json({ status: 'stored', version: payload.version, filename: `${filename}.json` });
  });

  /**
   * @openapi
   * /api/modules/releases/release-readiness/refresh:
   *   post:
   *     tags: [Releases]
   *     summary: Trigger release readiness metrics refresh
   *     parameters:
   *       - in: query
   *         name: version
   *         required: true
   *         schema: { type: string }
   *         description: Release version to refresh
   *     responses:
   *       501:
   *         description: Refresh is handled externally via CI pipeline
   */
  router.post('/refresh', requireAuth, requireScope('releases:write'), (req, res) => {
    res.status(501).json({
      error: 'Refresh is handled externally via the CI pipeline (fetch_release_metrics.py). Use the /upload endpoint to push pre-computed metrics.'
    });
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function sanitizeFilename(version) {
  return version.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Scan stored metrics to find the version with the nearest upcoming GA date.
 * Returns null if no upcoming version is found (falls back to first version
 * on the client side).
 */
function findUpcomingVersion(versions, storage) {
  const today = new Date().toISOString().slice(0, 10);
  let best = null;
  let bestGa = null;

  for (const v of versions) {
    try {
      const filename = sanitizeFilename(v);
      const data = storage.readFromStorage(`${STORAGE_PREFIX}/${filename}.json`);
      const gaDate = data?.release_schedule?.ga_date;
      if (gaDate && gaDate >= today) {
        if (!bestGa || gaDate < bestGa) {
          bestGa = gaDate;
          best = v;
        }
      }
    } catch { /* skip unreadable files */ }
  }

  return best;
}

module.exports = registerReleaseReadinessRoutes;
