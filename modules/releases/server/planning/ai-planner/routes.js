const express = require('express');
const { validateSnapshot } = require('./validation');
const { readAIPlanner, writeAIPlanner, projectSnapshot, emptySnapshot } = require('./storage');
const { PRIORITY_OUTCOMES, fetchOutcomesFromJira, calculateOutcomeMetrics } = require('./outcomes-integration');

const DEMO_MODE = process.env.DEMO_MODE === 'true';

const CVE_METRICS_KEY = 'releases/cve-sustaining/latest.json';
const PILLAR_CONFIG_KEY = 'releases/pm-hub/pillar-config.json';

/**
 * CVE load per owner, for the capacity reserve.
 *
 * CVEs are tracked per Jira component, but capacity is argued per team, and the
 * two do not line up: AI Core Dashboard alone appears under eight teams in the
 * feature data, so a component cannot simply be inverted into a team. The pillar
 * config is the one place that says who owns a component, so it is the join.
 *
 * Components the pillar config does not cover are returned separately rather
 * than dropped — a silent omission here understates somebody's load.
 */
async function buildCveReserve(readFromStorage) {
  var metrics = await readFromStorage(CVE_METRICS_KEY);
  var throughput = metrics && metrics.throughputByComponent;
  if (!throughput || !Array.isArray(throughput.components)) return null;

  var config = await readFromStorage(PILLAR_CONFIG_KEY);
  var owners = {};
  var pillars = (config && config.pillars) || [];
  for (var p = 0; p < pillars.length; p++) {
    var comps = pillars[p].components || [];
    for (var c = 0; c < comps.length; c++) {
      var comp = typeof comps[c] === 'string' ? { name: comps[c] } : comps[c];
      if (!comp || !comp.name) continue;
      owners[comp.name] = {
        pillar: pillars[p].name,
        pmLead: comp.pmLead || null,
        engLead: comp.engLead || null
      };
    }
  }

  var byPmLead = {};
  var byPillar = {};
  var unmapped = [];
  var mappedTotal = 0;

  for (var i = 0; i < throughput.components.length; i++) {
    var row = throughput.components[i];
    var owner = owners[row.component];
    if (!owner) {
      unmapped.push({ component: row.component, resolved: row.resolved });
      continue;
    }
    mappedTotal += row.resolved;

    var pmKey = owner.pmLead || 'Unassigned';
    if (!byPmLead[pmKey]) {
      byPmLead[pmKey] = { pmLead: pmKey, pillar: owner.pillar, engLeads: [], components: [], resolved: 0 };
    }
    byPmLead[pmKey].components.push(row.component);
    byPmLead[pmKey].resolved += row.resolved;
    if (owner.engLead && byPmLead[pmKey].engLeads.indexOf(owner.engLead) === -1) {
      byPmLead[pmKey].engLeads.push(owner.engLead);
    }

    if (!byPillar[owner.pillar]) byPillar[owner.pillar] = { pillar: owner.pillar, resolved: 0 };
    byPillar[owner.pillar].resolved += row.resolved;
  }

  // Share is of mapped work only, so the percentages a reader sees add to 100
  // rather than quietly leaving the unmapped remainder unaccounted for.
  var withShare = function(rows) {
    return rows
      .map(function(r) {
        return Object.assign({}, r, {
          perWeek: Number((r.resolved / throughput.weeks).toFixed(2)),
          share: mappedTotal > 0 ? Number((r.resolved / mappedTotal).toFixed(4)) : 0
        });
      })
      .sort(function(a, b) { return b.resolved - a.resolved; });
  };

  return {
    windowWeeks: throughput.weeks,
    windowStart: throughput.windowStart,
    windowEnd: throughput.windowEnd,
    resolvedIssues: throughput.resolvedIssues,
    mappedToOwners: mappedTotal,
    byPmLead: withShare(Object.keys(byPmLead).map(function(k) { return byPmLead[k]; })),
    byPillar: withShare(Object.keys(byPillar).map(function(k) { return byPillar[k]; })),
    unmapped: unmapped.sort(function(a, b) { return b.resolved - a.resolved; })
  };
}
const jsonLimit = express.json({ limit: '25mb' });

/**
 * Register AI Planner routes on the planning router.
 * Mirrors the epic-decomposer push/GET pattern.
 *
 * @param {import('express').Router} router
 * @param {object} context - { storage, requireAuth, requireAdmin, requireScope, buildFeatureReadiness, listStorageFiles }
 */
module.exports = function registerAIPlannerRoutes(router, context) {
  const { storage, requireAuth, requireAdmin, requireScope, buildFeatureReadiness, listStorageFiles, jira } = context;
  const { readFromStorage, writeToStorage } = storage;

  /**
   * @openapi
   * /api/modules/releases/planning/ai-planner/status:
   *   get:
   *     summary: AI Planner snapshot status
   *     tags: [releases-planning]
   *     responses:
   *       200:
   *         description: Last sync time and feature count
   */
  router.get('/ai-planner/status', requireAuth, requireScope('releases:read'), async function(req, res) {
    const data = await readAIPlanner(readFromStorage);
    res.json({
      lastSyncedAt: data.lastSyncedAt,
      featureCount: data.featureCount,
      dataDate: data.dataDate
    });
  });

  /**
   * @openapi
   * /api/modules/releases/planning/ai-planner/outcomes:
   *   get:
   *     summary: Fetch 22 prioritized outcomes from Jira plan with in-plan feature counts
   *     tags: [releases-planning]
   *     responses:
   *       200:
   *         description: Array of outcomes with child feature counts and metrics
   */
  router.get('/ai-planner/outcomes', requireAuth, requireScope('releases:read'), async function(req, res) {
    try {
      const readiness = await buildFeatureReadiness(readFromStorage, null, listStorageFiles);
      const allFeatures = (readiness.pendingReview || []).concat(readiness.ready || []);
      const inPlanFeatures = allFeatures
        .filter(f => f.status !== 'No' && f.targetVersions && f.targetVersions.some(v => v.includes('3.6')))
        .map(f => f.key);

      // Fetch outcomes from Jira if client is available
      let outcomes = [];
      const featureOutcomeMap = {};
      if (jira) {
        const jiraOutcomes = await fetchOutcomesFromJira(jira, PRIORITY_OUTCOMES);
        outcomes = calculateOutcomeMetrics(jiraOutcomes, inPlanFeatures, allFeatures);

        // Build feature→outcome mapping for dropdown filtering
        for (const outcome of outcomes) {
          const outcomeName = `${outcome.key} ${outcome.title}`;
          if (outcome.children && Array.isArray(outcome.children)) {
            for (const childKey of outcome.children) {
              featureOutcomeMap[childKey] = outcomeName;
            }
          }
        }
      }

      res.json({
        outcomes: outcomes,
        featureOutcomeMap: featureOutcomeMap,
        generatedAt: new Date().toISOString(),
        version: '3.6',
        featureCount: allFeatures.length,
        inPlanCount: inPlanFeatures.length
      });
    } catch (err) {
      console.error('Outcomes fetch error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * @openapi
   * /api/modules/releases/planning/ai-planner:
   *   post:
   *     summary: Push the AI Planner snapshot (CSV export)
   *     tags: [releases-planning]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               features:
   *                 type: array
   *               bugQueue:
   *                 type: array
   *     responses:
   *       200:
   *         description: Snapshot stored
   *       400:
   *         description: Invalid snapshot
   */
  router.post('/ai-planner', requireAdmin, requireScope('releases:write'), jsonLimit, async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'AI Planner ingest disabled in demo mode' });
    }

    const result = validateSnapshot(req.body);
    if (!result.valid) {
      return res.status(400).json({ errors: result.errors });
    }

    const snapshot = projectSnapshot(result.data);
    await writeAIPlanner(writeToStorage, snapshot);

    res.json({
      status: 'stored',
      featureCount: snapshot.featureCount,
      lastSyncedAt: snapshot.lastSyncedAt
    });
  });

  /**
   * @openapi
   * /api/modules/releases/planning/ai-planner:
   *   delete:
   *     summary: Clear the stored AI Planner snapshot
   *     tags: [releases-planning]
   *     responses:
   *       200:
   *         description: Snapshot cleared
   */
  router.delete('/ai-planner', requireAdmin, requireScope('releases:write'), async function(req, res) {
    if (DEMO_MODE) {
      return res.json({ status: 'skipped', message: 'AI Planner ingest disabled in demo mode' });
    }

    await writeAIPlanner(writeToStorage, { ...emptySnapshot(), lastSyncedAt: new Date().toISOString() });
    res.json({ status: 'cleared' });
  });

  /**
   * @openapi
   * /api/modules/releases/planning/ai-planner/outcomes:
   *   get:
   *     summary: Fetch 22 prioritized outcomes from Jira plan with in-plan feature counts
   *     tags: [releases-planning]
   *     responses:
   *       200:
   *         description: Array of outcomes with child feature counts and metrics
   */
  router.get('/ai-planner/outcomes', requireAuth, requireScope('releases:read'), async function(req, res) {
    try {
      // For now, return empty outcomes — Jira integration pending
      // Will fetch from plan view 7384 and calculate in-plan metrics
      const outcomes = [];

      res.json({
        outcomes: outcomes,
        generatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Outcomes fetch error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * @openapi
   * /api/modules/releases/planning/ai-planner:
   *   get:
   *     summary: AI Planner snapshot for the tab (live data from feature-readiness)
   *     tags: [releases-planning]
   *     responses:
   *       200:
   *         description: Live features, bug queue, and metadata
   */
  router.get('/ai-planner', requireAuth, requireScope('releases:read'), async function(req, res) {
    try {
      const readiness = await buildFeatureReadiness(readFromStorage, null, listStorageFiles);

      const allFeatures = (readiness.pendingReview || []).concat(readiness.ready || []);

      // Map to iframe expectations (index.html lines 2863-2869)
      const features = allFeatures.map(f => ({
        Key: f.key,
        Summary: f.title,
        Components: f.components || [],
        Team: f.team || '',
        Priority: f.priority || '',
        Outcome: f.bigRock || '',
        PlannedFor: (f.targetVersions && f.targetVersions[0]) || '',
        Score: f.riceScore || 0,
        // FPDoR is an object {passedCount, totalCount} - convert to string format
        FPDoR: f.fpdor ? (f.fpdor.passedCount + '/' + f.fpdor.totalCount) : '0/17',
        // The planner weights risk and confidence off the failed item names; without
        // them every feature scores as a clean pass (w:100, LOW risk, 95% confidence).
        'Failed FPDoR Items': ((f.fpdor && f.fpdor.items) || [])
          .filter(item => item.pass === false)
          .map(item => item.name)
          .join('; '),
        Confidence: f.confidence || 'not-ready',
        Labels: (f.labels || []).join(', '),
        'Fix Version': f.fixVersion || '',
        'Release Type': f.releaseType || '',
        Status: f.status || '',
        // pmOwner is a {displayName} object on the Jira path and a string elsewhere;
        // the planner contract is a string, so flatten before it leaves the API.
        PM: (f.pmOwner && typeof f.pmOwner === 'object' ? f.pmOwner.displayName : f.pmOwner) || '',
        DeliveryOwner: f.deliveryOwner || ''
      }));

      // bugQueue comes from CSV upload; for live-only mode, return empty
      // (buildFeatureReadiness doesn't include component bug data)
      const bugQueue = [];

      var cveReserve = null;
      try {
        cveReserve = await buildCveReserve(readFromStorage);
      } catch (err) {
        // The planner is useful without it; a missing reserve must not blank the tab.
        console.error('AI Planner: could not build CVE reserve', err);
      }

      res.json({
        features: features,
        bugQueue: bugQueue,
        cveReserve: cveReserve,
        featureCount: features.length,
        lastSyncedAt: (readiness.meta && readiness.meta.lastSyncedAt) || new Date().toISOString(),
        metadata: {
          source: 'live',
          generatedAt: new Date().toISOString(),
          version: '1.0'
        }
      });
    } catch (err) {
      console.error('AI Planner GET error:', err);
      res.status(500).json({ error: err.message });
    }
  });
};

// Exposed for tests; registration stays the default export.
module.exports.buildCveReserve = buildCveReserve;
