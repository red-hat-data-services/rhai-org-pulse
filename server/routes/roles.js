/**
 * Role management and allowlist routes.
 *
 * @param {import('express').Express} app
 * @param {object} context - Core services context
 */

function registerRoleRoutes(app, context) {
  const { requireAdmin, requireScope, blockDuringImpersonation, roleStore, roleRegistry } = context;

  /**
   * @openapi
   * /api/allowlist:
   *   get:
   *     tags: [Allowlist]
   *     summary: Get the email allowlist
   *     responses:
   *       200:
   *         description: List of allowed emails
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AllowlistResponse'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  app.get('/api/allowlist', requireAdmin, requireScope('admin:manage'), function(req, res) {
    try {
      res.json({ emails: roleStore.getAdminEmails() });
    } catch (error) {
      console.error('Read allowlist error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/allowlist:
   *   post:
   *     tags: [Allowlist]
   *     summary: Add an email to the allowlist
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email]
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *     responses:
   *       200:
   *         description: Updated allowlist
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AllowlistResponse'
   *       400:
   *         description: Invalid email
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   *       409:
   *         description: Email already on allowlist
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         $ref: '#/components/responses/ServerError'
   */
  app.post('/api/allowlist', requireAdmin, requireScope('admin:manage'), blockDuringImpersonation, function(req, res) {
    try {
      const { email } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required' });
      }

      const normalized = email.trim().toLowerCase();
      if (!normalized.includes('@') || normalized.indexOf('@') === 0 || normalized.indexOf('@') === normalized.length - 1) {
        return res.status(400).json({ error: 'A valid email address is required' });
      }

      if (roleStore.hasRole(normalized, 'admin')) {
        return res.status(409).json({ error: 'Email is already on the allowlist' });
      }

      const result = roleStore.assignRole(normalized, 'admin', req.auditActor || req.userEmail);
      if (result.demo) return res.json(result);
      res.json({ emails: roleStore.getAdminEmails() });
    } catch (error) {
      console.error('Add to allowlist error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/allowlist/{email}:
   *   delete:
   *     tags: [Allowlist]
   *     summary: Remove an email from the allowlist
   *     parameters:
   *       - in: path
   *         name: email
   *         required: true
   *         schema:
   *           type: string
   *           format: email
   *     responses:
   *       200:
   *         description: Updated allowlist
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AllowlistResponse'
   *       400:
   *         description: Cannot remove the last user
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
  app.delete('/api/allowlist/:email', requireAdmin, requireScope('admin:manage'), blockDuringImpersonation, function(req, res) {
    try {
      const email = decodeURIComponent(req.params.email).toLowerCase();

      if (!roleStore.hasRole(email, 'admin')) {
        return res.status(404).json({ error: 'Email not found on allowlist' });
      }

      const result = roleStore.revokeRole(email, 'admin', req.auditActor || req.userEmail);
      if (result.demo) return res.json(result);
      res.json({ emails: roleStore.getAdminEmails() });
    } catch (error) {
      if (error.message === 'Cannot remove the last admin') {
        return res.status(400).json({ error: 'Cannot remove the last user from the allowlist' });
      }
      console.error('Remove from allowlist error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/roles/me', function(req, res) {
    res.json({ roles: roleStore.getRoles(req.userEmail) });
  });

  app.get('/api/roles', requireAdmin, requireScope('admin:manage'), function(req, res) {
    try {
      res.json({ assignments: roleStore.listAssignments() });
    } catch (error) {
      console.error('List roles error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/roles/assign', requireAdmin, requireScope('admin:manage'), blockDuringImpersonation, function(req, res) {
    try {
      const { email, role } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'email is required' });
      }
      if (!role || typeof role !== 'string') {
        return res.status(400).json({ error: 'role is required' });
      }
      const result = roleStore.assignRole(email, role, req.auditActor || req.userEmail);
      if (result.demo) return res.json(result);
      res.json(result);
    } catch (error) {
      console.error('Assign role error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/roles/revoke', requireAdmin, requireScope('admin:manage'), blockDuringImpersonation, function(req, res) {
    try {
      const { email, role } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'email is required' });
      }
      if (!role || typeof role !== 'string') {
        return res.status(400).json({ error: 'role is required' });
      }
      const result = roleStore.revokeRole(email, role, req.auditActor || req.userEmail);
      if (result.demo) return res.json(result);
      res.json(result);
    } catch (error) {
      if (error.message === 'Cannot remove the last admin') {
        return res.status(400).json({ error: error.message });
      }
      console.error('Revoke role error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  /**
   * @openapi
   * /api/roles/available:
   *   get:
   *     tags: [Auth]
   *     summary: Get available role catalog
   *     description: Returns all registered roles (platform + module). Admin only.
   *     responses:
   *       200:
   *         description: Role catalog
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 roles:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       label:
   *                         type: string
   *                       description:
   *                         type: string
   *                       module:
   *                         type: string
   *       403:
   *         $ref: '#/components/responses/Forbidden'
   */
  app.get('/api/roles/available', requireAdmin, function(req, res) {
    res.json({ roles: roleRegistry.getAll() });
  });
}

module.exports = registerRoleRoutes;
