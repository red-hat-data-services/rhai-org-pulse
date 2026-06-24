/**
 * Git-static module CRUD and built-in module state management routes.
 *
 * @param {import('express').Express} app
 * @param {object} context - Core services context
 */

function registerModuleManagementRoutes(app, context) {
  const {
    storage, requireAdmin, requireScope, builtInModules,
    modulesConfig, gitSync, invalidateStaticCache, DEMO_MODE,
    loadModuleState, saveModuleState, getEffectiveState,
    resolveEnableOrder, checkDisableAllowed, computeRequiredBy, wasMountedAtStartup
  } = context;

  /**
   * @openapi
   * /api/modules:
   *   get:
   *     tags: [Git-Static Modules]
   *     summary: List all git-static modules (public fields)
   *     responses:
   *       200:
   *         description: List of modules
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 modules:
   *                   type: array
   *                   items:
   *                     type: object
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  app.get('/api/modules', function(req, res) {
    try {
      const config = modulesConfig.loadModulesConfig(storage) || { modules: [] };
      res.json({ modules: config.modules.map(modulesConfig.sanitizeForPublic) });
    } catch (error) {
      console.error('List modules error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/modules/{slug}:
   *   get:
   *     tags: [Git-Static Modules]
   *     summary: Get a single git-static module (public fields)
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Module details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  app.get('/api/modules/:slug', function(req, res) {
    try {
      const mod = modulesConfig.getModule(storage, req.params.slug);
      if (!mod) {
        return res.status(404).json({ error: `Module "${req.params.slug}" not found` });
      }
      res.json(modulesConfig.sanitizeForPublic(mod));
    } catch (error) {
      console.error('Get module error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/admin/modules:
   *   get:
   *     tags: [Git-Static Modules]
   *     summary: List all git-static modules (admin, includes git fields)
   *     responses:
   *       200:
   *         description: List of modules with admin details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 modules:
   *                   type: array
   *                   items:
   *                     type: object
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  app.get('/api/admin/modules', requireAdmin, requireScope('admin:manage'), function(req, res) {
    try {
      const config = modulesConfig.loadModulesConfig(storage) || { modules: [] };
      res.json({ modules: config.modules.map(modulesConfig.sanitizeForAdmin) });
    } catch (error) {
      console.error('Admin list modules error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/admin/modules:
   *   post:
   *     tags: [Git-Static Modules]
   *     summary: Register a new git-static module
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *     responses:
   *       201:
   *         description: Module created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  app.post('/api/admin/modules', requireAdmin, requireScope('admin:manage'), function(req, res) {
    try {
      const result = modulesConfig.addModule(storage, req.body);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      invalidateStaticCache(result.module.slug);
      res.status(201).json(modulesConfig.sanitizeForAdmin(result.module));
    } catch (error) {
      console.error('Add module error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/admin/modules/{slug}:
   *   put:
   *     tags: [Git-Static Modules]
   *     summary: Update a git-static module
   *     parameters:
   *       - in: path
   *         name: slug
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
   *         description: Updated module
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  app.put('/api/admin/modules/:slug', requireAdmin, requireScope('admin:manage'), function(req, res) {
    try {
      const result = modulesConfig.updateModule(storage, req.params.slug, req.body);
      if (result.error) {
        const status = result.error.includes('not found') ? 404 : 400;
        return res.status(status).json({ error: result.error });
      }
      invalidateStaticCache(req.params.slug);
      res.json(modulesConfig.sanitizeForAdmin(result.module));
    } catch (error) {
      console.error('Update module error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/admin/modules/{slug}:
   *   delete:
   *     tags: [Git-Static Modules]
   *     summary: Remove a git-static module
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Module removed
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  app.delete('/api/admin/modules/:slug', requireAdmin, requireScope('admin:manage'), function(req, res) {
    try {
      const result = modulesConfig.removeModule(storage, req.params.slug);
      if (result.error) {
        const status = result.error.includes('not found') ? 404 : 400;
        return res.status(status).json({ error: result.error });
      }
      invalidateStaticCache(req.params.slug);
      res.json({ success: true });
    } catch (error) {
      console.error('Remove module error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/admin/modules/{slug}/sync:
   *   post:
   *     tags: [Git-Static Modules]
   *     summary: Trigger sync for a single git-static module
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Sync started
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: started
   *                 slug:
   *                   type: string
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       409:
   *         description: Sync already in progress
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  app.post('/api/admin/modules/:slug/sync', requireAdmin, requireScope('admin:manage'), async function(req, res) {
    try {
      const mod = modulesConfig.getModule(storage, req.params.slug);
      if (!mod) {
        return res.status(404).json({ error: `Module "${req.params.slug}" not found` });
      }
      if (gitSync.isSyncing(req.params.slug)) {
        return res.status(409).json({ error: 'Sync already in progress for this module' });
      }
      gitSync.syncModule(storage, mod).then(function(result) {
        invalidateStaticCache(req.params.slug);
        console.log(`[module-sync] On-demand sync for ${req.params.slug}:`, result.status);
      }).catch(function(err) {
        console.error(`[module-sync] On-demand sync error for ${req.params.slug}:`, err.message);
      });
      res.json({ status: 'started', slug: req.params.slug });
    } catch (error) {
      console.error('Sync module error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/admin/modules/sync:
   *   post:
   *     tags: [Git-Static Modules]
   *     summary: Trigger sync for all git-static modules
   *     responses:
   *       200:
   *         description: Sync started
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: started
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  app.post('/api/admin/modules/sync', requireAdmin, requireScope('admin:manage'), async function(req, res) {
    try {
      gitSync.syncAllModules(storage).then(function(result) {
        for (const r of result.results) {
          invalidateStaticCache(r.slug);
        }
        console.log(`[module-sync] Sync all complete: ${result.results.length} modules`);
      }).catch(function(err) {
        console.error('[module-sync] Sync all error:', err.message);
      });
      res.json({ status: 'started' });
    } catch (error) {
      console.error('Sync all modules error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/admin/modules/sync/status:
   *   get:
   *     tags: [Git-Static Modules]
   *     summary: Get sync status for all git-static modules
   *     responses:
   *       200:
   *         description: Sync status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  app.get('/api/admin/modules/sync/status', requireAdmin, requireScope('admin:manage'), function(req, res) {
    try {
      res.json(gitSync.getSyncStatus(storage));
    } catch (error) {
      console.error('Module sync status error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Built-in Module Admin Endpoints ───

  /**
   * @openapi
   * /api/admin/modules/state:
   *   get:
   *     tags: [Built-in Modules]
   *     summary: Get all built-in modules with enable/disable state
   *     responses:
   *       200:
   *         description: Built-in module states
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 modules:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       slug:
   *                         type: string
   *                       name:
   *                         type: string
   *                       enabled:
   *                         type: boolean
   *                       requiredBy:
   *                         type: array
   *                         items:
   *                           type: string
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  app.get('/api/admin/modules/state', requireAdmin, requireScope('admin:manage'), function(req, res) {
    try {
      const discovered = builtInModules;
      const currentState = loadModuleState(storage);
      const effective = getEffectiveState(discovered, currentState);
      const requiredBy = computeRequiredBy(discovered);

      const modules = discovered.map(function(mod) {
        return {
          slug: mod.slug,
          name: mod.name,
          description: mod.description,
          icon: mod.icon,
          order: mod.order,
          requires: mod.requires,
          defaultEnabled: mod.defaultEnabled,
          enabled: effective[mod.slug],
          requiredBy: requiredBy[mod.slug] || []
        };
      });

      res.json({ modules });
    } catch (error) {
      console.error('Get built-in module state error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/admin/modules/{slug}/enable:
   *   post:
   *     tags: [Built-in Modules]
   *     summary: Enable a built-in module
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Module enabled
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 enabled:
   *                   type: array
   *                   items:
   *                     type: string
   *                 autoEnabled:
   *                   type: array
   *                   items:
   *                     type: string
   *                 restartRequired:
   *                   type: boolean
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  app.post('/api/admin/modules/:slug/enable', requireAdmin, requireScope('admin:manage'), function(req, res) {
    try {
      if (DEMO_MODE) {
        return res.json({ status: 'skipped', message: 'Module state changes disabled in demo mode' });
      }

      const slug = req.params.slug;
      const discovered = builtInModules;
      const mod = discovered.find(function(m) { return m.slug === slug; });
      if (!mod) {
        return res.status(404).json({ error: `Module "${slug}" not found` });
      }

      const currentState = loadModuleState(storage);
      const effective = getEffectiveState(discovered, currentState);

      if (effective[slug]) {
        return res.json({ enabled: [slug], autoEnabled: [], restartRequired: false });
      }

      const result = resolveEnableOrder(slug, discovered, effective);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      for (const s of result.toEnable) {
        currentState[s] = true;
      }
      saveModuleState(storage, currentState);

      const restartRequired = result.toEnable.some(function(s) { return !wasMountedAtStartup(s); });

      res.json({
        enabled: result.toEnable,
        autoEnabled: result.autoEnabled,
        restartRequired: restartRequired
      });
    } catch (error) {
      console.error('Enable module error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/admin/modules/{slug}/disable:
   *   post:
   *     tags: [Built-in Modules]
   *     summary: Disable a built-in module
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Module disabled
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 disabled:
   *                   type: string
   *       400:
   *         description: Cannot disable - required by other modules
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  app.post('/api/admin/modules/:slug/disable', requireAdmin, requireScope('admin:manage'), function(req, res) {
    try {
      if (DEMO_MODE) {
        return res.json({ status: 'skipped', message: 'Module state changes disabled in demo mode' });
      }

      const slug = req.params.slug;
      const discovered = builtInModules;
      const mod = discovered.find(function(m) { return m.slug === slug; });
      if (!mod) {
        return res.status(404).json({ error: `Module "${slug}" not found` });
      }

      const currentState = loadModuleState(storage);
      const effective = getEffectiveState(discovered, currentState);

      if (!effective[slug]) {
        return res.json({ disabled: slug });
      }

      const check = checkDisableAllowed(slug, discovered, effective);
      if (!check.allowed) {
        return res.status(400).json({
          error: `Cannot disable "${slug}": required by ${check.blockedBy.join(', ')}`,
          blockedBy: check.blockedBy
        });
      }

      currentState[slug] = false;
      saveModuleState(storage, currentState);

      res.json({ disabled: slug });
    } catch (error) {
      console.error('Disable module error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/built-in-modules/state:
   *   get:
   *     tags: [Built-in Modules]
   *     summary: Get enabled built-in module slugs (public)
   *     responses:
   *       200:
   *         description: List of enabled module slugs
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 enabledSlugs:
   *                   type: array
   *                   items:
   *                     type: string
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  app.get('/api/built-in-modules/state', function(req, res) {
    try {
      const currentState = loadModuleState(storage);
      const effective = getEffectiveState(builtInModules, currentState);
      const enabledList = Object.entries(effective)
        .filter(function(entry) { return entry[1]; })
        .map(function(entry) { return entry[0]; });

      res.json({ enabledSlugs: enabledList });
    } catch (error) {
      console.error('Get enabled built-in modules error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = registerModuleManagementRoutes;
