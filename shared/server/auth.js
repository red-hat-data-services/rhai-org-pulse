/**
 * Auth middleware extracted from dev-server.js.
 * Provides authentication and authorization for Express routes.
 */

const crypto = require('crypto');

function createAuthMiddleware(readFromStorage, writeToStorage, options = {}) {
  const { tokenValidator } = options;

  function isAdmin(email) {
    const adminList = readFromStorage('allowlist.json')
    const result = adminList && adminList.emails && adminList.emails.includes(email)
    return result
  }

  function seedAdminList() {
    const existing = readFromStorage('allowlist.json')
    const currentEmails = (existing && existing.emails) ? existing.emails : []

    const adminEmails = process.env.ADMIN_EMAILS
    if (!adminEmails) {
      if (currentEmails.length > 0) {
        console.log(`Admin list: ${currentEmails.length} admin(s) loaded`)
      } else {
        console.log('Admin list: empty — first authenticated user will be auto-added as admin')
      }
      return
    }

    const envEmails = adminEmails
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)

    const merged = [...new Set([...currentEmails, ...envEmails])]

    if (merged.length !== currentEmails.length) {
      writeToStorage('allowlist.json', { emails: merged })
      console.log(`Admin list: merged to ${merged.length} admin(s) (${merged.length - currentEmails.length} added from ADMIN_EMAILS)`)
    } else {
      console.log(`Admin list: ${merged.length} admin(s) loaded`)
    }
  }

  async function authMiddleware(req, res, next) {
    if (req.method === 'OPTIONS') return next()

    // Check for Bearer token FIRST — the tt_ prefix distinguishes our tokens
    // from other Bearer schemes, which fall through to the proxy/local-dev path
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer tt_')) {
      const rawToken = authHeader.slice('Bearer '.length);
      if (tokenValidator) {
        const tokenRecord = tokenValidator.validateToken(rawToken);
        if (!tokenRecord) {
          // HARD STOP: invalid/expired token must NEVER fall through
          return res.status(401).json({ error: 'Invalid or expired API token' });
        }
        req.userEmail = tokenRecord.ownerEmail;
        req.isAdmin = isAdmin(tokenRecord.ownerEmail);
        req.authMethod = 'token';
        // Update lastUsedAt (fire-and-forget, throttled)
        tokenValidator.touchLastUsed(tokenRecord.id);
        return next();
      }
      // No token validator configured — reject token auth
      return res.status(401).json({ error: 'API token authentication is not configured' });
    }

    // Existing flow: X-Forwarded-Email or local dev fallback
    const email = req.headers['x-forwarded-email']
    if (email) {
      req.userEmail = email.toLowerCase()
    } else {
      req.userEmail = (process.env.ADMIN_EMAILS || 'local-dev@redhat.com').split(',')[0].trim().toLowerCase()
    }

    const adminList = readFromStorage('allowlist.json')
    if (!adminList || !adminList.emails || adminList.emails.length === 0) {
      const seeded = { emails: [req.userEmail] }
      writeToStorage('allowlist.json', seeded)
      console.log(`Admin list: auto-added first user ${req.userEmail}`)
    }

    req.isAdmin = isAdmin(req.userEmail)
    next()
  }

  function requireAdmin(req, res, next) {
    if (!req.isAdmin) {
      return res.status(403).json({ error: 'Admin access required.' })
    }
    next()
  }

  return { authMiddleware, requireAdmin, isAdmin, seedAdminList }
}

let _emptySecretWarned = false;

function proxySecretGuard(req, res, next, options = {}) {
  const { tokenValidator } = options;
  const expectedSecret = process.env.PROXY_AUTH_SECRET;
  if (!expectedSecret) {
    if (process.env.PROXY_AUTH_SECRET === '' && !_emptySecretWarned) {
      _emptySecretWarned = true;
      console.warn('[auth] PROXY_AUTH_SECRET is set but empty — proxy secret guard is disabled');
    }
    return next();
  }
  if (req.method === 'OPTIONS') return next();
  if (req.path === '/healthz' || req.path === '/api/healthz') return next();
  // API docs: publicly accessible without auth
  if (req.path.startsWith('/api/docs')) return next();
  // Shell module list: public metadata only (same payload as unauthenticated dev)
  if (req.method === 'GET' && req.path === '/api/built-in-modules/manifests') return next();

  const providedSecret = req.headers['x-proxy-secret'];
  if (providedSecret && providedSecret.length === expectedSecret.length &&
      crypto.timingSafeEqual(Buffer.from(providedSecret), Buffer.from(expectedSecret))) {
    return next();
  }

  // Bearer token inline validation: if request has a tt_ token, validate it
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer tt_') && tokenValidator) {
    const rawToken = authHeader.slice('Bearer '.length);
    if (tokenValidator.isValidToken(rawToken)) {
      return next();
    }
    // Invalid token — reject immediately (defense in depth)
    return res.status(401).json({ error: 'Invalid or expired API token' });
  }

  console.warn(`[auth] Proxy secret mismatch from ${req.ip} on ${req.method} ${req.path}`);
  return res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { createAuthMiddleware, proxySecretGuard }
