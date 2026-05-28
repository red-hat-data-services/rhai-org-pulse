/**
 * Unified Release Registry — CRUD + auto-discover.
 *
 * Canonical source of truth for release identity. Eliminates brittle
 * version-string matching across planning, execution, and delivery domains.
 *
 * Storage: releases/registry.json
 */

const { logAudit } = require('./planning/audit-log');
const { loadRegistryConfig, saveRegistryConfig } = require('./registry-config');

const REGISTRY_FILE = 'releases/registry.json';
const SCHEMA_VERSION = 1;

const VALID_STATES = ['active', 'archived'];
// Fields controlled by Product Pages — cannot be edited locally on PP-sourced releases
const PP_MANAGED_FIELDS = ['displayName', 'productPagesShortname', 'productPagesVersion', 'milestones'];

/**
 * Read the registry from storage, returning a normalized object.
 */
function readRegistry(readFromStorage) {
  const data = readFromStorage(REGISTRY_FILE);
  if (data && Array.isArray(data.releases)) return data;
  return { schemaVersion: SCHEMA_VERSION, releases: [] };
}

/**
 * Write the registry to storage.
 */
function writeRegistry(writeToStorage, registry) {
  writeToStorage(REGISTRY_FILE, registry);
}

/**
 * Validate a release object. Returns an error string or null if valid.
 */
function validateRelease(release) {
  if (!release) return 'Release object is required';
  if (!release.id || typeof release.id !== 'string') return 'id is required and must be a string';
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(release.id)) {
    return 'id must be lowercase alphanumeric with dots, hyphens, or underscores (must start with alphanumeric)';
  }
  if (!release.displayName || typeof release.displayName !== 'string') {
    return 'displayName is required and must be a string';
  }
  if (release.fixVersions && !Array.isArray(release.fixVersions)) {
    return 'fixVersions must be an array';
  }
  if (release.milestones && typeof release.milestones !== 'object') {
    return 'milestones must be an object';
  }
  if (release.state && !VALID_STATES.includes(release.state)) {
    return `state must be one of: ${VALID_STATES.join(', ')}`;
  }
  return null;
}

/**
 * Normalize a release object for storage.
 */
function normalizeRelease(input) {
  const now = new Date().toISOString();
  return {
    id: input.id.trim().toLowerCase(),
    displayName: input.displayName.trim(),
    fixVersions: Array.isArray(input.fixVersions) ? input.fixVersions : [],
    productPagesShortname: input.productPagesShortname || null,
    productPagesVersion: input.productPagesVersion || null,
    milestones: input.milestones || {},
    state: input.state || 'active',
    source: input.source || 'manual',
    createdAt: input.createdAt || now,
    updatedAt: now
  };
}

/**
 * Normalize a version name for fuzzy matching.
 * Lowercases, strips ".z" suffixes (Product Pages z-stream convention),
 * collapses separators (hyphens, dots) to spaces, and trims.
 * @param {string} name
 * @returns {string}
 */
function normalizeVersionName(name) {
  var s = String(name).toLowerCase();
  // Strip ".z" suffix (but not ".z." — only terminal .z)
  s = s.replace(/\.z(?=$|\.)/g, '');
  // Collapse hyphens and dots to spaces
  s = s.replace(/[-._]+/g, ' ');
  // Collapse multiple spaces
  s = s.replace(/\s+/g, ' ');
  return s.trim();
}

/**
 * Match Jira project versions against registry releases.
 * @param {Array<{ name: string, id: string, project: string }>} jiraVersions
 * @param {Array<{ id: string, displayName: string, fixVersions: string[], state: string }>} registryReleases
 * @returns {{ matches: Array<{ releaseId: string, releaseName: string, currentFixVersions: string[], proposedFixVersions: string[], jiraMatches: Array<{ name: string, id: string, project: string }> }>, unmatched: Array<{ name: string, id: string, project: string }> }}
 */
function matchVersionsToReleases(jiraVersions, registryReleases) {
  // Build normalized lookup for active releases
  var releasesByNormalized = {};
  for (var ri = 0; ri < registryReleases.length; ri++) {
    var rel = registryReleases[ri];
    if (rel.state === 'archived') continue;

    // Normalize displayName and all existing fixVersions as candidate keys
    var keys = [normalizeVersionName(rel.displayName)];
    var fvs = rel.fixVersions || [];
    for (var fi = 0; fi < fvs.length; fi++) {
      var nfv = normalizeVersionName(fvs[fi]);
      if (keys.indexOf(nfv) === -1) keys.push(nfv);
    }

    for (var ki = 0; ki < keys.length; ki++) {
      if (!releasesByNormalized[keys[ki]]) {
        releasesByNormalized[keys[ki]] = rel;
      }
    }
  }

  // Match each Jira version
  var matchMap = {}; // releaseId -> { release, jiraMatches[], proposedVersionNames Set }
  var unmatched = [];

  for (var ji = 0; ji < jiraVersions.length; ji++) {
    var jv = jiraVersions[ji];
    var normalized = normalizeVersionName(jv.name);
    var release = releasesByNormalized[normalized];

    if (release) {
      if (!matchMap[release.id]) {
        matchMap[release.id] = {
          release: release,
          jiraMatches: [],
          proposedNames: {}
        };
      }
      matchMap[release.id].jiraMatches.push({
        name: jv.name,
        id: jv.id,
        project: jv.project
      });
      matchMap[release.id].proposedNames[jv.name] = true;
    } else {
      unmatched.push({ name: jv.name, id: jv.id, project: jv.project });
    }
  }

  // Build matches array
  var matches = [];
  var matchIds = Object.keys(matchMap);
  for (var mi = 0; mi < matchIds.length; mi++) {
    var entry = matchMap[matchIds[mi]];
    var currentFvs = entry.release.fixVersions || [];
    // Proposed = current + any new Jira version names not already present
    var proposed = currentFvs.slice();
    var proposedNames = Object.keys(entry.proposedNames);
    for (var pi = 0; pi < proposedNames.length; pi++) {
      if (proposed.indexOf(proposedNames[pi]) === -1) {
        proposed.push(proposedNames[pi]);
      }
    }

    matches.push({
      releaseId: entry.release.id,
      releaseName: entry.release.displayName,
      currentFixVersions: currentFvs,
      proposedFixVersions: proposed,
      jiraMatches: entry.jiraMatches
    });
  }

  return { matches: matches, unmatched: unmatched };
}

/**
 * Register release registry routes on the provided router.
 */
function registerRegistryRoutes(router, context) {
  const { storage, requireAuth, requireReleaseManager, requireScope } = context;
  const { readFromStorage, writeToStorage } = storage;

  /**
   * @openapi
   * /api/modules/releases/registry:
   *   get:
   *     tags: [Releases]
   *     summary: List all releases in the registry
   *     responses:
   *       200:
   *         description: Release registry
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 schemaVersion:
   *                   type: integer
   *                 releases:
   *                   type: array
   *                   items:
   *                     type: object
   */
  router.get('/registry', requireAuth, requireScope('releases:read'), function(req, res) {
    const registry = readRegistry(readFromStorage);
    res.json(registry);
  });

  /**
   * @openapi
   * /api/modules/releases/registry/config:
   *   get:
   *     tags: [Releases]
   *     summary: Get registry configuration (Jira projects for version resolution)
   *     responses:
   *       200:
   *         description: Registry config
   */
  router.get('/registry/config', requireReleaseManager, requireScope('releases:read'), function(req, res) {
    var config = loadRegistryConfig(storage);
    res.json(config);
  });

  /**
   * @openapi
   * /api/modules/releases/registry/config:
   *   post:
   *     tags: [Releases]
   *     summary: Save registry configuration
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               jiraProjects:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Config saved
   *       400:
   *         description: Validation error
   */
  router.post('/registry/config', requireReleaseManager, requireScope('releases:write'), function(req, res) {
    try {
      saveRegistryConfig(storage, req.body);
      res.json({ status: 'saved' });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  /**
   * @openapi
   * /api/modules/releases/registry/{id}:
   *   get:
   *     tags: [Releases]
   *     summary: Get a single release by ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Release object
   *       404:
   *         description: Release not found
   */
  router.get('/registry/:id', requireAuth, requireScope('releases:read'), function(req, res) {
    const registry = readRegistry(readFromStorage);
    const release = registry.releases.find(r => r.id === req.params.id);
    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }
    res.json(release);
  });

  /**
   * @openapi
   * /api/modules/releases/registry:
   *   post:
   *     tags: [Releases]
   *     summary: Create a new release
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [id, displayName]
   *             properties:
   *               id:
   *                 type: string
   *               displayName:
   *                 type: string
   *               fixVersions:
   *                 type: array
   *                 items:
   *                   type: string
   *               productPagesShortname:
   *                 type: string
   *               productPagesVersion:
   *                 type: string
   *               milestones:
   *                 type: object
   *               state:
   *                 type: string
   *                 enum: [active, archived]
   *     responses:
   *       201:
   *         description: Release created
   *       400:
   *         description: Validation error or duplicate ID
   */
  router.post('/registry', requireReleaseManager, requireScope('releases:write'), function(req, res) {
    const error = validateRelease(req.body);
    if (error) {
      return res.status(400).json({ error });
    }

    const registry = readRegistry(readFromStorage);
    const normalizedId = req.body.id.trim().toLowerCase();

    if (registry.releases.some(r => r.id === normalizedId)) {
      return res.status(400).json({ error: `Release with id "${normalizedId}" already exists` });
    }

    const release = normalizeRelease(req.body);
    registry.releases.push(release);
    writeRegistry(writeToStorage, registry);

    logAudit(readFromStorage, writeToStorage, {
      domain: 'registry',
      action: 'registry_create',
      user: req.userEmail || 'unknown',
      summary: 'Created release ' + release.displayName + ' (' + release.id + ')',
      details: { releaseId: release.id }
    });

    res.status(201).json(release);
  });

  /**
   * @openapi
   * /api/modules/releases/registry/{id}:
   *   put:
   *     tags: [Releases]
   *     summary: Update an existing release
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       200:
   *         description: Release updated
   *       400:
   *         description: Validation error
   *       404:
   *         description: Release not found
   */
  router.put('/registry/:id', requireReleaseManager, requireScope('releases:write'), function(req, res) {
    const registry = readRegistry(readFromStorage);
    const idx = registry.releases.findIndex(r => r.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Release not found' });
    }

    // Merge body into existing, preserving createdAt, id, and source
    const existing = registry.releases[idx];

    // For PP-sourced releases, reject changes to PP-managed fields
    if (existing.source === 'product-pages') {
      for (const field of PP_MANAGED_FIELDS) {
        if (field in req.body) {
          return res.status(400).json({
            error: `Cannot edit "${field}" on a Product Pages release. This field is managed by Product Pages.`
          });
        }
      }
    }

    const merged = {
      ...req.body,
      id: existing.id,
      source: existing.source,
      createdAt: existing.createdAt
    };

    const error = validateRelease(merged);
    if (error) {
      return res.status(400).json({ error });
    }

    const updated = normalizeRelease(merged);
    updated.createdAt = existing.createdAt; // preserve original
    registry.releases[idx] = updated;
    writeRegistry(writeToStorage, registry);

    logAudit(readFromStorage, writeToStorage, {
      domain: 'registry',
      action: 'registry_update',
      user: req.userEmail || 'unknown',
      summary: 'Updated release ' + updated.displayName + ' (' + updated.id + ')',
      details: { releaseId: updated.id }
    });

    res.json(updated);
  });

  /**
   * @openapi
   * /api/modules/releases/registry/{id}:
   *   delete:
   *     tags: [Releases]
   *     summary: Archive or delete a release
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Release archived
   *       404:
   *         description: Release not found
   */
  router.delete('/registry/:id', requireReleaseManager, requireScope('releases:write'), function(req, res) {
    const registry = readRegistry(readFromStorage);
    const idx = registry.releases.findIndex(r => r.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Release not found' });
    }

    // Archive rather than hard delete
    registry.releases[idx].state = 'archived';
    registry.releases[idx].updatedAt = new Date().toISOString();
    writeRegistry(writeToStorage, registry);

    logAudit(readFromStorage, writeToStorage, {
      domain: 'registry',
      action: 'registry_archive',
      user: req.userEmail || 'unknown',
      summary: 'Archived release ' + registry.releases[idx].displayName + ' (' + registry.releases[idx].id + ')',
      details: { releaseId: registry.releases[idx].id }
    });

    res.json({ status: 'archived', release: registry.releases[idx] });
  });

  /**
   * @openapi
   * /api/modules/releases/registry/discover:
   *   post:
   *     tags: [Releases]
   *     summary: Auto-discover releases from Product Pages
   *     description: Placeholder for future auto-discovery integration with Product Pages API
   *     responses:
   *       200:
   *         description: Discovery results
   */
  router.post('/registry/discover', requireReleaseManager, requireScope('releases:write'), async function(req, res) {
    try {
      const { getConfig } = require('./delivery/config');
      const { fetchProductsByShortname, getAuthStatus } = require('./delivery/product-pages');

      const deliveryConfig = getConfig(readFromStorage);
      const authStatus = getAuthStatus();

      if (authStatus === 'none') {
        return res.status(400).json({
          error: 'Product Pages auth is not configured. Set PRODUCT_PAGES_CLIENT_ID/SECRET or PRODUCT_PAGES_TOKEN.'
        });
      }

      const shortnames = deliveryConfig.productPagesProductShortnames || [];
      if (shortnames.length === 0) {
        return res.status(400).json({
          error: 'No product shortnames configured. Configure them in Delivery settings first.'
        });
      }

      const ppReleases = await fetchProductsByShortname(shortnames, deliveryConfig);
      if (ppReleases.length === 0) {
        return res.json({ status: 'empty', discovered: 0, created: 0, message: 'No releases found from Product Pages' });
      }

      // Map Product Pages releases to registry format
      const registry = readRegistry(readFromStorage);
      const existingById = new Map(registry.releases.map(r => [r.id, r]));
      let created = 0;
      let updated = 0;
      let archived = 0;
      const discovered = [];
      const discoveredIds = new Set();

      for (const ppRelease of ppReleases) {
        const releaseNumber = ppRelease.releaseNumber || '';
        if (!releaseNumber) continue;

        const id = releaseNumber.toLowerCase().replace(/\s+/g, '-');
        if (!/^[a-z0-9][a-z0-9._-]*$/.test(id)) continue;

        discoveredIds.add(id);
        discovered.push({
          id,
          displayName: releaseNumber,
          productName: ppRelease.productName,
          dueDate: ppRelease.dueDate,
          codeFreezeDate: ppRelease.codeFreezeDate
        });

        const existing = existingById.get(id);

        if (existing) {
          // Skip archived releases — respect the user's archive decision
          if (existing.state === 'archived') continue;

          // Update PP-managed fields on existing PP-sourced releases
          if (existing.source === 'product-pages') {
            existing.displayName = releaseNumber;
            existing.productPagesShortname = releaseNumber.split('-')[0] || existing.productPagesShortname;
            existing.productPagesVersion = releaseNumber;
            existing.milestones = {
              ...(existing.milestones || {}),
              ga: ppRelease.dueDate || existing.milestones?.ga || null,
              codeFreeze: ppRelease.codeFreezeDate || existing.milestones?.codeFreeze || null
            };
            existing.updatedAt = new Date().toISOString();
            updated++;
          }
          // Manual releases with matching ID are left untouched
        } else {
          // Create new PP-sourced release
          const release = normalizeRelease({
            id,
            displayName: releaseNumber,
            productPagesShortname: releaseNumber.split('-')[0] || null,
            productPagesVersion: releaseNumber,
            milestones: {
              ga: ppRelease.dueDate || null,
              codeFreeze: ppRelease.codeFreezeDate || null
            },
            source: 'product-pages',
            state: 'active'
          });

          registry.releases.push(release);
          existingById.set(id, release);
          created++;
        }
      }

      // Auto-archive PP-sourced releases that are no longer in Product Pages
      for (const release of registry.releases) {
        if (release.source === 'product-pages' && release.state === 'active' && !discoveredIds.has(release.id)) {
          release.state = 'archived';
          release.updatedAt = new Date().toISOString();
          archived++;
        }
      }

      if (created > 0 || updated > 0 || archived > 0) {
        writeRegistry(writeToStorage, registry);
        logAudit(readFromStorage, writeToStorage, {
          domain: 'registry',
          action: 'registry_discover',
          user: req.userEmail || 'unknown',
          summary: `Synced with Product Pages: ${created} created, ${updated} updated, ${archived} archived`,
          details: { discovered: discovered.length, created, updated, archived, shortnames }
        });
      }

      res.json({ status: 'ok', discovered: discovered.length, created, updated, archived, releases: discovered });
    } catch (err) {
      console.error('[releases/registry] Auto-discover failed:', err.message);
      res.status(500).json({ error: 'Auto-discover failed: ' + err.message });
    }
  });

  /**
   * @openapi
   * /api/modules/releases/registry/resolve-jira-versions:
   *   post:
   *     tags: [Releases]
   *     summary: Preview Jira version resolution against registry releases
   *     description: >
   *       Fetches all versions from configured Jira projects and matches them
   *       against registry releases using normalized string comparison.
   *       Returns proposed fixVersions mappings without writing.
   *     responses:
   *       200:
   *         description: Proposed version mappings
   *       400:
   *         description: No Jira projects configured
   *       500:
   *         description: Jira API error
   */
  router.post('/registry/resolve-jira-versions', requireReleaseManager, requireScope('releases:write'), async function(req, res) {
    try {
      var config = loadRegistryConfig(storage);
      var projects = config.jiraProjects || [];

      if (projects.length === 0) {
        return res.status(400).json({
          error: 'No Jira projects configured. Set jiraProjects in registry config first.'
        });
      }

      var { fetchProjectVersions, jiraRequest: jiraRequestFn } = require('../../../shared/server/jira');

      var jiraVersions = await fetchProjectVersions(jiraRequestFn, projects);
      var registry = readRegistry(readFromStorage);
      var result = matchVersionsToReleases(jiraVersions, registry.releases);

      res.json({
        status: 'ok',
        jiraVersionCount: jiraVersions.length,
        projects: projects,
        matches: result.matches,
        unmatched: result.unmatched
      });
    } catch (err) {
      console.error('[releases/registry] Jira version resolution failed:', err.message);
      res.status(500).json({ error: 'Jira version resolution failed: ' + err.message });
    }
  });

  /**
   * @openapi
   * /api/modules/releases/registry/resolve-jira-versions/apply:
   *   post:
   *     tags: [Releases]
   *     summary: Apply resolved Jira versions to registry releases
   *     description: >
   *       Accepts a list of release-to-fixVersions mappings and writes them
   *       to the registry. Only updates releases included in the request.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [mappings]
   *             properties:
   *               mappings:
   *                 type: array
   *                 items:
   *                   type: object
   *                   required: [releaseId, fixVersions]
   *                   properties:
   *                     releaseId:
   *                       type: string
   *                     fixVersions:
   *                       type: array
   *                       items:
   *                         type: string
   *     responses:
   *       200:
   *         description: Versions applied
   *       400:
   *         description: Invalid request
   */
  router.post('/registry/resolve-jira-versions/apply', requireReleaseManager, requireScope('releases:write'), function(req, res) {
    var mappings = req.body && req.body.mappings;
    if (!Array.isArray(mappings) || mappings.length === 0) {
      return res.status(400).json({ error: 'mappings array is required and must not be empty' });
    }

    var registry = readRegistry(readFromStorage);
    var updated = [];

    for (var i = 0; i < mappings.length; i++) {
      var mapping = mappings[i];
      if (!mapping.releaseId || !Array.isArray(mapping.fixVersions)) continue;

      // Filter to string values only
      var cleanVersions = mapping.fixVersions.filter(function(v) { return typeof v === 'string' && v.trim().length > 0; });

      var release = null;
      for (var ri = 0; ri < registry.releases.length; ri++) {
        if (registry.releases[ri].id === mapping.releaseId) {
          release = registry.releases[ri];
          break;
        }
      }

      if (!release) continue;

      release.fixVersions = cleanVersions;
      release.updatedAt = new Date().toISOString();
      updated.push({ releaseId: release.id, fixVersions: release.fixVersions });
    }

    if (updated.length > 0) {
      writeRegistry(writeToStorage, registry);
      logAudit(readFromStorage, writeToStorage, {
        domain: 'registry',
        action: 'registry_resolve_jira_versions',
        user: req.userEmail || 'unknown',
        summary: 'Applied Jira version mappings to ' + updated.length + ' releases',
        details: { updated: updated }
      });
    }

    res.json({ status: 'ok', updated: updated });
  });
}

module.exports = {
  registerRegistryRoutes, readRegistry, writeRegistry, validateRelease, normalizeRelease,
  normalizeVersionName, matchVersionsToReleases, REGISTRY_FILE
};
