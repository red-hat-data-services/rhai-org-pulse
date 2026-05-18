/**
 * Unified Release Registry — CRUD + auto-discover.
 *
 * Canonical source of truth for release identity. Eliminates brittle
 * version-string matching across planning, execution, and delivery domains.
 *
 * Storage: releases/registry.json
 */

const { logAudit } = require('./planning/audit-log');

const REGISTRY_FILE = 'releases/registry.json';
const SCHEMA_VERSION = 1;

const VALID_STATES = ['active', 'archived'];

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
    createdAt: input.createdAt || now,
    updatedAt: now
  };
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

    // Merge body into existing, preserving createdAt and id
    const existing = registry.releases[idx];
    const merged = {
      ...req.body,
      id: existing.id,
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
      const existingIds = new Set(registry.releases.map(r => r.id));
      let created = 0;
      const discovered = [];

      for (const ppRelease of ppReleases) {
        const releaseNumber = ppRelease.releaseNumber || '';
        if (!releaseNumber) continue;

        const id = releaseNumber.toLowerCase().replace(/\s+/g, '-');
        if (!/^[a-z0-9][a-z0-9._-]*$/.test(id)) continue;

        discovered.push({
          id,
          displayName: releaseNumber,
          productName: ppRelease.productName,
          dueDate: ppRelease.dueDate,
          codeFreezeDate: ppRelease.codeFreezeDate
        });

        if (existingIds.has(id)) continue;

        const release = normalizeRelease({
          id,
          displayName: releaseNumber,
          productPagesShortname: releaseNumber.split('-')[0] || null,
          productPagesVersion: releaseNumber,
          milestones: {
            gaDate: ppRelease.dueDate || null,
            codeFreezeDate: ppRelease.codeFreezeDate || null
          },
          state: 'active'
        });

        registry.releases.push(release);
        existingIds.add(id);
        created++;
      }

      if (created > 0) {
        writeRegistry(writeToStorage, registry);
        logAudit(readFromStorage, writeToStorage, {
          domain: 'registry',
          action: 'registry_discover',
          user: req.userEmail || 'unknown',
          summary: 'Auto-discovered ' + created + ' new release(s) from Product Pages',
          details: { discovered: discovered.length, created, shortnames }
        });
      }

      res.json({ status: 'ok', discovered: discovered.length, created, releases: discovered });
    } catch (err) {
      console.error('[releases/registry] Auto-discover failed:', err.message);
      res.status(500).json({ error: 'Auto-discover failed: ' + err.message });
    }
  });
}

module.exports = { registerRegistryRoutes, readRegistry, writeRegistry, validateRelease, normalizeRelease, REGISTRY_FILE };
