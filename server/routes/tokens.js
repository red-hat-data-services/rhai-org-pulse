/**
 * API token routes (user + admin).
 *
 * @param {import('express').Express} app
 * @param {object} context - Core services context
 */

function registerTokenRoutes(app, context) {
  const { requireAdmin, requireScope, blockDuringImpersonation, apiTokens, scopeRegistry } = context;

  /**
   * @openapi
   * /api/token-scopes:
   *   get:
   *     tags: [Auth]
   *     summary: Get available token scope catalog
   *     description: Returns available scopes and presets for the UI. Requires authentication but no specific scope.
   *     responses:
   *       200:
   *         description: Scope catalog with presets
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 scopes:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       key:
   *                         type: string
   *                       label:
   *                         type: string
   *                       description:
   *                         type: string
   *                       category:
   *                         type: string
   *                 presets:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       key:
   *                         type: string
   *                       label:
   *                         type: string
   *                       description:
   *                         type: string
   *                       scopes:
   *                         type: array
   *                         items:
   *                           type: string
   */
  app.get('/api/token-scopes', function(req, res) {
    const scopes = scopeRegistry.getAll();
    const readOnlyScopes = scopes
      .filter(s => s.key.endsWith(':read'))
      .map(s => s.key);

    res.json({
      scopes: scopes.map(s => ({
        key: s.key,
        label: s.label,
        description: s.description,
        category: s.category
      })),
      presets: [
        {
          key: 'read-only',
          label: 'Read Only',
          description: 'Read access to all data, no mutations',
          scopes: readOnlyScopes
        },
        {
          key: 'full-access',
          label: 'Full Access',
          description: 'All scopes (same as no restrictions)',
          scopes: ['*']
        }
      ]
    });
  });

  /**
   * @openapi
   * /api/tokens:
   *   get:
   *     tags: [Auth]
   *     summary: List current user's API tokens
   *     responses:
   *       200:
   *         description: List of tokens (metadata only)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 tokens:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ApiToken'
   */
  app.get('/api/tokens', blockDuringImpersonation, requireScope('tokens:manage'), function(req, res) {
    try {
      const tokens = apiTokens.listUserTokens(req.userEmail);
      res.json({ tokens });
    } catch (error) {
      console.error('List tokens error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/tokens:
   *   post:
   *     tags: [Auth]
   *     summary: Create a new API token
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name]
   *             properties:
   *               name:
   *                 type: string
   *                 maxLength: 100
   *               expiresIn:
   *                 type: string
   *                 enum: [30d, 90d, 1y]
   *                 nullable: true
   *               scopes:
   *                 type: array
   *                 items:
   *                   type: string
   *                 nullable: true
   *                 description: Scope restrictions. Null or omitted for full access.
   *     responses:
   *       201:
   *         description: Token created (raw token shown only once)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *                 id:
   *                   type: string
   *                 name:
   *                   type: string
   *                 scopes:
   *                   type: array
   *                   items:
   *                     type: string
   *                   nullable: true
   *                 expiresAt:
   *                   type: string
   *                   nullable: true
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       403:
   *         description: Scope escalation attempt
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  app.post('/api/tokens', blockDuringImpersonation, requireScope('tokens:manage'), async function(req, res) {
    try {
      const { name, expiresIn, scopes } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Token name is required' });
      }
      if (name.length > 100) {
        return res.status(400).json({ error: 'Token name must be 100 characters or fewer' });
      }

      if (expiresIn !== undefined && expiresIn !== null && !['30d', '90d', '1y'].includes(expiresIn)) {
        return res.status(400).json({ error: 'expiresIn must be one of: 30d, 90d, 1y, or null' });
      }

      if (req.authMethod === 'token') {
        const validated = scopes != null ? apiTokens.validateScopes(scopes) : null;
        const escalation = apiTokens.enforceTokenScopeCeiling(req.tokenScopes, validated);
        if (escalation) {
          return res.status(403).json({ error: escalation });
        }
      }

      const result = await apiTokens.createToken(req.userEmail, name.trim(), expiresIn || null, scopes !== undefined ? scopes : null);
      res.status(201).json(result);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      if (error.message && (error.message.includes('Invalid scopes') || error.message.includes('scopes must be'))) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Create token error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/tokens/{id}:
   *   delete:
   *     tags: [Auth]
   *     summary: Revoke own API token
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Token revoked
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  app.delete('/api/tokens/:id', blockDuringImpersonation, requireScope('tokens:manage'), async function(req, res) {
    try {
      const revoked = await apiTokens.revokeToken(req.params.id, req.userEmail);
      if (!revoked) {
        return res.status(404).json({ error: 'Token not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Revoke token error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/tokens/{id}/scopes:
   *   patch:
   *     tags: [Auth]
   *     summary: Update scopes on own API token
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
   *             required: [scopes]
   *             properties:
   *               scopes:
   *                 type: array
   *                 items:
   *                   type: string
   *                 nullable: true
   *     responses:
   *       200:
   *         description: Updated token record
   *       400:
   *         description: Invalid scopes
   *       403:
   *         description: Scope escalation or impersonation blocked
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  app.patch('/api/tokens/:id/scopes', blockDuringImpersonation, requireScope('tokens:manage'), async function(req, res) {
    try {
      const { scopes } = req.body;

      if (req.authMethod === 'token') {
        const validated = scopes != null ? apiTokens.validateScopes(scopes) : null;
        const escalation = apiTokens.enforceTokenScopeCeiling(req.tokenScopes, validated);
        if (escalation) {
          return res.status(403).json({ error: escalation });
        }
      }

      const updated = await apiTokens.updateTokenScopes(req.params.id, req.userEmail, scopes);
      if (!updated) {
        return res.status(404).json({ error: 'Token not found' });
      }
      res.json(updated);
    } catch (error) {
      if (error.message && (error.message.includes('Invalid scopes') || error.message.includes('scopes must be'))) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Update token scopes error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/admin/tokens:
   *   get:
   *     tags: [Auth]
   *     summary: List all API tokens (admin)
   *     responses:
   *       200:
   *         description: All tokens (metadata only)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 tokens:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ApiToken'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  app.get('/api/admin/tokens', requireAdmin, requireScope('admin:manage'), function(req, res) {
    try {
      const tokens = apiTokens.listAllTokens();
      res.json({ tokens });
    } catch (error) {
      console.error('Admin list tokens error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/admin/tokens/{id}:
   *   delete:
   *     tags: [Auth]
   *     summary: Revoke any API token (admin)
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Token revoked
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  app.delete('/api/admin/tokens/:id', requireAdmin, requireScope('admin:manage'), blockDuringImpersonation, async function(req, res) {
    try {
      const revoked = await apiTokens.adminRevokeToken(req.params.id);
      if (!revoked) {
        return res.status(404).json({ error: 'Token not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Admin revoke token error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/admin/tokens/{id}/scopes:
   *   patch:
   *     tags: [Auth]
   *     summary: Update scopes on any API token (admin)
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
   *             required: [scopes]
   *             properties:
   *               scopes:
   *                 type: array
   *                 items:
   *                   type: string
   *                 nullable: true
   *     responses:
   *       200:
   *         description: Updated token record
   *       400:
   *         description: Invalid scopes
   *       403:
   *         description: Admin access required or scope escalation
   *       404:
   *         $ref: '#/components/responses/NotFound'
   */
  app.patch('/api/admin/tokens/:id/scopes', requireAdmin, requireScope('admin:manage'), blockDuringImpersonation, async function(req, res) {
    try {
      const { scopes } = req.body;

      if (req.authMethod === 'token') {
        const validated = scopes != null ? apiTokens.validateScopes(scopes) : null;
        const escalation = apiTokens.enforceTokenScopeCeiling(req.tokenScopes, validated);
        if (escalation) {
          return res.status(403).json({ error: escalation });
        }
      }

      const updated = await apiTokens.updateTokenScopes(req.params.id, null, scopes);
      if (!updated) {
        return res.status(404).json({ error: 'Token not found' });
      }
      res.json(updated);
    } catch (error) {
      if (error.message && (error.message.includes('Invalid scopes') || error.message.includes('scopes must be'))) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Admin update token scopes error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

module.exports = registerTokenRoutes;
