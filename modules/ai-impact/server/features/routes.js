const express = require('express');
const { validateFeature } = require('./validation');
const {
  readFeatures,
  getLatestProjection,
  countHistoryEntries
} = require('./storage');

const DEMO_MODE = process.env.DEMO_MODE === 'true';
const jsonLimit = express.json({ limit: '10mb' });

// Max entries in a single bulk request
const BULK_CAP = 5000;

// Port for localhost internal API calls
const API_PORT = process.env.API_PORT || 3001;

/**
 * Build auth headers for internal localhost API calls.
 * Uses PROXY_AUTH_SECRET (shared pod-internal config) to pass proxySecretGuard.
 */
function internalHeaders(contentType) {
  const headers = {};
  if (contentType) headers['Content-Type'] = contentType;
  const proxySecret = process.env.PROXY_AUTH_SECRET;
  if (proxySecret) headers['X-Proxy-Secret'] = proxySecret;
  return headers;
}

/**
 * Forward validated AI review data to the releases execution store.
 * @param {object[]} features - Array of { key, aiReview } objects
 * @returns {Promise<{ created: number, updated: number, unchanged: number }>}
 */
async function forwardToReleases(features) {
  const url = 'http://localhost:' + API_PORT + '/api/modules/releases/execution/ai-review/bulk';
  const resp = await fetch(url, {
    method: 'POST',
    headers: internalHeaders('application/json'),
    body: JSON.stringify({ features })
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error('Releases API error (' + resp.status + '): ' + body);
  }
  return resp.json();
}

/**
 * Forward a delete request to remove AI review data from releases store.
 * @returns {Promise<void>}
 */
async function forwardDeleteToReleases() {
  const url = 'http://localhost:' + API_PORT + '/api/modules/releases/execution/ai-review';
  const resp = await fetch(url, {
    method: 'DELETE',
    headers: internalHeaders()
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error('Releases API delete error (' + resp.status + '): ' + body);
  }
}

/**
 * Trigger a one-time Jira enrichment on the releases module.
 * Fire-and-forget — errors are logged but not surfaced.
 */
function triggerJiraEnrichment() {
  const url = 'http://localhost:' + API_PORT + '/api/admin/refresh-all';
  fetch(url, {
    method: 'POST',
    headers: internalHeaders('application/json'),
    body: JSON.stringify({ handlers: ['jira-enrichment'] })
  }).catch(function(err) {
    console.warn('[ai-impact] Post-bulk Jira enrichment trigger failed:', err.message);
  });
}

/**
 * Transform validated feature data into aiReview namespace format.
 * @param {object} validated - Validated feature data from validateFeature
 * @returns {object} { key, aiReview }
 */
function toAiReviewPayload(validated) {
  return {
    key: validated.key,
    aiReview: {
      title: validated.title,
      sourceRfe: validated.sourceRfe,
      size: validated.size,
      recommendation: validated.recommendation,
      needsAttention: validated.needsAttention,
      humanReviewStatus: validated.humanReviewStatus,
      scores: validated.scores,
      reviewers: validated.reviewers,
      labels: validated.labels,
      components: validated.components,
      reviewedAt: validated.reviewedAt,
      runId: validated.runId
    }
  };
}

/**
 * Register feature routes on the module router.
 * Static routes are registered BEFORE parameterized routes.
 *
 * @param {import('express').Router} router
 * @param {object} context - Module context with storage and auth middleware
 */
module.exports = function registerFeatureRoutes(router, context) {
  const { storage, requireAdmin, requireScope } = context;
  const { readFromStorage } = storage;

  // ─── 1. Static routes FIRST ───

  // GET /features/status (Admin) — feature data status for settings page
  router.get('/features/status', requireAdmin, requireScope('ai-impact:read'), function(req, res) {
    const data = readFeatures(readFromStorage);
    res.json({
      lastSyncedAt: data.lastSyncedAt,
      lastJiraSyncAt: data.lastJiraSyncAt || null,
      totalFeatures: data.totalFeatures,
      totalHistoryEntries: countHistoryEntries(data)
    });
  });

  // GET /features/sync/status — sync state for polling
  router.get('/features/sync/status', requireScope('ai-impact:read'), function(req, res) {
    res.json({
      running: false,
      startedAt: null,
      lastResult: null
    });
  });

  // POST /features/sync (Admin) — Jira sync is now handled by releases jira-enrichment
  router.post('/features/sync', requireAdmin, requireScope('ai-impact:write'), function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Sync disabled in demo mode' });
    }
    res.json({
      status: 'unified',
      message: 'Feature Jira sync is now handled by the releases jira-enrichment handler. Use POST /api/admin/refresh-all to trigger.'
    });
  });

  // POST /features/bulk (Admin) — bulk upsert features, forwarded to releases
  router.post('/features/bulk', requireAdmin, requireScope('ai-impact:write'), jsonLimit, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Feature ingest disabled in demo mode' });
    }

    const { features } = req.body;
    if (!Array.isArray(features)) {
      return res.status(400).json({ error: 'features must be an array' });
    }
    if (features.length > BULK_CAP) {
      return res.status(400).json({ error: `Bulk payload exceeds maximum of ${BULK_CAP} entries` });
    }

    const counts = { created: 0, updated: 0, unchanged: 0 };
    const errors = [];
    const releasesPayload = [];

    for (const entry of features) {
      if (!entry || typeof entry !== 'object' || (!entry.key && !entry.strat_id)) {
        errors.push({ key: entry?.key || entry?.strat_id || 'unknown', error: 'Missing key field' });
        continue;
      }

      const result = validateFeature(entry);
      if (!result.valid) {
        errors.push({ key: entry.key || entry.strat_id || 'unknown', errors: result.errors });
        continue;
      }

      releasesPayload.push(toAiReviewPayload(result.data));
    }

    // Forward all validated data to the releases store
    if (releasesPayload.length > 0) {
      try {
        const result = await forwardToReleases(releasesPayload);
        counts.created = result.created || 0;
        counts.updated = result.updated || 0;
        counts.unchanged = result.unchanged || 0;

        // Trigger Jira enrichment for newly created features
        if (counts.created > 0) {
          triggerJiraEnrichment();
        }
      } catch (err) {
        console.error('[ai-impact] Forward to releases failed:', err.message);
        return res.status(502).json({
          error: 'Failed to write to unified feature store',
          detail: err.message
        });
      }
    }

    res.json({
      created: counts.created,
      updated: counts.updated,
      unchanged: counts.unchanged,
      errors
    });
  });

  // DELETE /features (Admin) — clear AI review data from releases store
  router.delete('/features', requireAdmin, requireScope('ai-impact:write'), async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Feature ingest disabled in demo mode' });
    }

    // Forward delete to releases (async, don't block response)
    forwardDeleteToReleases().catch(function(err) {
      console.error('[ai-impact] Forward delete to releases failed:', err.message);
    });

    res.json({ status: 'cleared' });
  });

  // GET /features — list all features (slim projection)
  router.get('/features', requireScope('ai-impact:read'), function(req, res) {
    const data = readFeatures(readFromStorage);
    res.json(getLatestProjection(data));
  });

  // ─── 2. Parameterized routes AFTER ───

  // GET /features/:key — single feature + history
  router.get('/features/:key', requireScope('ai-impact:read'), function(req, res) {
    const data = readFeatures(readFromStorage);
    const entry = data.features[req.params.key];
    if (!entry) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({
      latest: entry.latest,
      history: entry.history
    });
  });

  // PUT /features/:key (Admin) — upsert single feature, forwarded to releases
  router.put('/features/:key', requireAdmin, requireScope('ai-impact:write'), jsonLimit, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'Feature ingest disabled in demo mode' });
    }

    const result = validateFeature(req.body);
    if (!result.valid) {
      return res.status(400).json({ errors: result.errors });
    }

    // Forward to releases store
    try {
      const fwdResult = await forwardToReleases([toAiReviewPayload(result.data)]);
      const status = fwdResult.created > 0 ? 'created' : fwdResult.updated > 0 ? 'updated' : 'unchanged';
      res.json({ status });
    } catch (err) {
      console.error('[ai-impact] Forward to releases failed:', err.message);
      return res.status(502).json({
        error: 'Failed to write to unified feature store',
        detail: err.message
      });
    }
  });
};
