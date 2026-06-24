/**
 * Health, whoami, and site-config routes.
 *
 * Split into pre-auth and post-auth registration because Express
 * processes middleware in registration order. Pre-auth routes (healthz,
 * manifests) must be registered before authMiddleware.
 *
 * @param {import('express').Express} app
 * @param {object} context - Core services context
 */

const auditLog = require('../../shared/server/audit-log');

/** Validate a domain name per RFC 1123 */
function isValidDomain(domain) {
  if (!domain || typeof domain !== 'string') return false;
  if (domain.length > 253) return false;
  if (domain.includes('@') || /\s/.test(domain)) return false;
  const labels = domain.split('.');
  if (labels.length < 1) return false;
  return labels.every(label =>
    label.length >= 1 && label.length <= 63 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label)
  );
}

/**
 * Register routes that must come BEFORE authMiddleware.
 */
function registerPreAuthRoutes(app, context) {
  const { builtInModules } = context;

  // Root-level health check — not in Swagger docs
  app.get('/healthz', function(req, res) {
    res.json({ status: 'ok' });
  });

  /**
   * @openapi
   * /api/healthz:
   *   get:
   *     tags: [Health]
   *     summary: Health check (API prefix)
   *     security: []
   *     responses:
   *       200:
   *         description: Server is healthy
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: ok
   */
  app.get('/api/healthz', function(req, res) {
    res.json({ status: 'ok' });
  });

  /**
   * Built-in module manifests — intentionally public (no auth, no proxy secret).
   */
  app.get('/api/built-in-modules/manifests', function(req, res) {
    try {
      const modules = builtInModules.map(function(mod) {
        return {
          slug: mod.slug,
          name: mod.name,
          description: mod.description,
          icon: mod.icon,
          order: mod.order,
          client: mod.client,
          requires: mod.requires || [],
          defaultEnabled: mod.defaultEnabled
        };
      });
      res.json({ modules });
    } catch (error) {
      console.error('Get built-in module manifests error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

/**
 * Register routes that come AFTER authMiddleware.
 */
function registerPostAuthRoutes(app, context) {
  const { storage, requireAdmin, requireScope, roleStore, DEMO_MODE } = context;
  const { readFromStorage, writeToStorage } = storage;

  /**
   * @openapi
   * /api/whoami:
   *   get:
   *     tags: [Auth]
   *     summary: Get current user info
   *     responses:
   *       200:
   *         description: Current user information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 email:
   *                   type: string
   *                   format: email
   *                 displayName:
   *                   type: string
   *                 isAdmin:
   *                   type: boolean
   *                 isTeamAdmin:
   *                   type: boolean
   *                 isManager:
   *                   type: boolean
   *                 roles:
   *                   type: array
   *                   items:
   *                     type: string
   *                 authMethod:
   *                   type: string
   *                   enum: [token, proxy, local-dev]
   *                 impersonating:
   *                   type: boolean
   *                   description: Present and true when X-Impersonate-Uid header is active
   *                 realAdmin:
   *                   type: string
   *                   format: email
   *                   description: The real admin's email (only present during impersonation)
   *                 apiBaseUrl:
   *                   type: string
   *                   nullable: true
   *                   description: Dedicated API server URL for token-authenticated requests (null if not configured)
   */
  app.get('/api/whoami', function(req, res) {
    let displayName = req.userEmail;
    if (req.authMethod !== 'token') {
      const preferred = req.headers['x-forwarded-preferred-username'];
      const user = req.headers['x-forwarded-user'];
      const email = req.headers['x-forwarded-email'];
      displayName = preferred || user || email || req.userEmail;
    }

    const response = {
      email: req.userEmail,
      displayName,
      isAdmin: req.isAdmin,
      isTeamAdmin: req.isTeamAdmin || false,
      isManager: req.isManager || false,
      roles: req.userRoles || [],
      authMethod: req.authMethod || (req.headers['x-forwarded-email'] ? 'proxy' : 'local-dev'),
      apiBaseUrl: process.env.API_PUBLIC_URL || null
    };

    if (req.isImpersonating) {
      response.impersonating = true;
      response.realAdmin = req.realAdminEmail;
      if (req.impersonatedDisplayName) response.displayName = req.impersonatedDisplayName;
    }

    res.json(response);
  });

  /**
   * @openapi
   * /api/site-config:
   *   get:
   *     tags: [Config]
   *     summary: Get site configuration
   *     responses:
   *       200:
   *         description: Site configuration
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 titlePrefix:
   *                   type: string
   *                 authEmailDomain:
   *                   type: string
   *                   description: Auth email domain for role matching (e.g. cluster.local)
   */
  app.get('/api/site-config', function(req, res) {
    try {
      const config = readFromStorage('site-config.json') || {};
      res.json({
        titlePrefix: config.titlePrefix || '',
        authEmailDomain: config.authEmailDomain || ''
      });
    } catch (error) {
      console.error('Get site-config error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/site-config:
   *   post:
   *     tags: [Config]
   *     summary: Update site configuration (admin only)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               titlePrefix:
   *                 type: string
   *                 maxLength: 100
   *               authEmailDomain:
   *                 type: string
   *                 maxLength: 253
   *                 description: Auth email domain for role matching (e.g. cluster.local)
   *     responses:
   *       200:
   *         description: Updated site configuration
   */
  app.post('/api/site-config', requireAdmin, requireScope('admin:manage'), function(req, res) {
    try {
      if (DEMO_MODE) {
        return res.json({ status: 'skipped', message: 'Configuration changes disabled in demo mode' });
      }
      const existing = readFromStorage('site-config.json') || {};
      const updates = {};

      if (req.body.titlePrefix !== undefined) {
        if (typeof req.body.titlePrefix !== 'string' || req.body.titlePrefix.length > 100) {
          return res.status(400).json({ error: 'titlePrefix must be a string of 100 characters or fewer' });
        }
        updates.titlePrefix = req.body.titlePrefix;
      }

      if (req.body.authEmailDomain !== undefined) {
        const domain = req.body.authEmailDomain.trim().toLowerCase();
        if (domain && !isValidDomain(domain)) {
          return res.status(400).json({ error: 'authEmailDomain must be a valid domain name (no @ or whitespace, max 253 chars)' });
        }
        updates.authEmailDomain = domain;
      }

      const config = { ...existing, ...updates };
      writeToStorage('site-config.json', config);

      if (updates.authEmailDomain !== undefined && updates.authEmailDomain !== existing.authEmailDomain) {
        auditLog.appendAuditEntry({ readFromStorage, writeToStorage }, {
          action: 'config.authEmailDomain.change',
          actor: req.userEmail || 'unknown',
          entityType: 'config',
          entityId: 'site-config',
          field: 'authEmailDomain',
          oldValue: existing.authEmailDomain || '',
          newValue: updates.authEmailDomain,
          detail: `Auth email domain changed from "${existing.authEmailDomain || ''}" to "${updates.authEmailDomain}"`
        });

        roleStore.invalidateCache();
        const count = roleStore.migrateEmailDomains();
        if (count > 0) {
          console.log(`site-config: authEmailDomain changed, migrated ${count} role(s)`);
        }
      }

      res.json(config);
    } catch (error) {
      console.error('Save site-config error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // App-wide messages
  app.get('/api/messages', async function(req, res) {
    const userContext = {
      email: req.userEmail,
      uid: req.userUid,
      isAdmin: req.isAdmin,
      isTeamAdmin: req.isTeamAdmin,
      isManager: req.isManager,
      roles: req.userRoles
    };

    try {
      const computed = await context.messageRegistry.getMessages(userContext);
      const stored = readFromStorage('messages.json') || [];
      const all = [...computed, ...stored];
      res.json({ messages: all });
    } catch (err) {
      console.error('[messages] Aggregation failed:', err.message);
      res.json({ messages: [] });
    }
  });

  app.post('/api/admin/messages', requireAdmin, requireScope('admin:manage'), function(req, res) {
    const { type, text, link } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text is required and must be a non-empty string' });
    }

    const allowedTypes = ['warning', 'info', 'error'];
    if (!type || !allowedTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${allowedTypes.join(', ')}` });
    }

    if (link != null) {
      if (typeof link !== 'object' || typeof link.label !== 'string' || !link.label.trim()
          || typeof link.href !== 'string' || !link.href.trim()) {
        return res.status(400).json({ error: 'link must have non-empty string "label" and "href" properties' });
      }
      const SAFE_HREF = /^(https?:\/\/|#)/i;
      if (!SAFE_HREF.test(link.href.trim())) {
        return res.status(400).json({ error: 'link.href must be an http(s) or hash URL' });
      }
    }

    const id = `admin:${Date.now()}`;
    const message = {
      id,
      type,
      text: text.trim(),
      link: link ? { label: link.label.trim(), href: link.href.trim() } : null
    };

    const stored = readFromStorage('messages.json') || [];
    stored.push(message);
    writeToStorage('messages.json', stored);

    res.status(201).json(message);
  });

  app.delete('/api/admin/messages/:id', requireAdmin, requireScope('admin:manage'), function(req, res) {
    const stored = readFromStorage('messages.json') || [];
    const index = stored.findIndex(m => m.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Message not found' });
    }

    stored.splice(index, 1);
    writeToStorage('messages.json', stored);

    res.status(204).end();
  });
}

module.exports = { registerPreAuthRoutes, registerPostAuthRoutes, isValidDomain };
