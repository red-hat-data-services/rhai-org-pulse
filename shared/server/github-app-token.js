/**
 * GitHub App installation token generator.
 *
 * Generates short-lived installation tokens from a GitHub App's private key,
 * caches them, and refreshes proactively before expiry. Modules read the
 * token via a getter on context.secrets.GITHUB_TOKEN — no module code changes
 * needed.
 *
 * Env vars:
 *   GITHUB_APP_ID              — GitHub App ID
 *   GITHUB_APP_PRIVATE_KEY_FILE — Path to PEM file (production, volume-mounted)
 *   GITHUB_APP_PRIVATE_KEY     — Inline PEM string (local dev fallback)
 *   GITHUB_APP_INSTALLATION_ID — Installation ID for the target org
 *
 * If none are set, the module is a no-op and getTokenSync() returns null,
 * allowing fallback to a classic GITHUB_TOKEN PAT.
 *
 * @module shared/server/github-app-token
 */

const crypto = require('crypto');
const fs = require('fs');

const GITHUB_API = 'https://api.github.com';
const REFRESH_INTERVAL_MS = 50 * 60 * 1000; // 50 minutes (tokens expire at 60)
const JWT_EXPIRY_SECONDS = 10 * 60; // 10 minutes

let _token = null;
let _expiresAt = 0;
let _refreshTimer = null;
let _appMode = false;
let _config = null;

/**
 * Build a RS256 JWT using Node built-in crypto (no jsonwebtoken dependency).
 */
function buildJwt(appId, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = { iat: now - 60, exp: now + JWT_EXPIRY_SECONDS, iss: appId };

  const segments = [
    base64url(JSON.stringify(header)),
    base64url(JSON.stringify(payload))
  ];
  const signingInput = segments.join('.');

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(privateKey, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return signingInput + '.' + signature;
}

function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Exchange a JWT for an installation access token.
 */
async function requestInstallationToken(jwt, installationId) {
  const res = await fetch(`${GITHUB_API}/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'org-pulse'
    }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }

  const data = await res.json();
  return {
    token: data.token,
    expiresAt: new Date(data.expires_at).getTime()
  };
}

/**
 * Generate (or refresh) the installation token.
 */
async function generateToken() {
  if (!_config) return null;

  const jwt = buildJwt(_config.appId, _config.privateKey);
  const result = await requestInstallationToken(jwt, _config.installationId);

  _token = result.token;
  _expiresAt = result.expiresAt;

  return _token;
}

/**
 * Read the PEM private key from file or inline env var.
 */
function readPrivateKey() {
  const keyFile = process.env.GITHUB_APP_PRIVATE_KEY_FILE;
  if (keyFile) {
    try {
      return fs.readFileSync(keyFile, 'utf8');
    } catch (err) {
      console.error(`[github-app-token] Failed to read key file ${keyFile}: ${err.message}`);
      return null;
    }
  }

  const inline = process.env.GITHUB_APP_PRIVATE_KEY;
  if (inline) return inline;

  return null;
}

/**
 * Initialize the GitHub App token system.
 *
 * If App env vars are configured, generates the first token and starts a
 * background refresh timer. If init fails but GITHUB_TOKEN is set, falls
 * back silently (isAppMode() returns false).
 *
 * Safe to call even if env vars are missing — no-op in that case.
 */
async function init() {
  const appId = process.env.GITHUB_APP_ID;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;

  if (!appId || !installationId) return;

  const privateKey = readPrivateKey();
  if (!privateKey) {
    console.warn('[github-app-token] GITHUB_APP_ID set but no private key found (check GITHUB_APP_PRIVATE_KEY_FILE or GITHUB_APP_PRIVATE_KEY)');
    return;
  }

  _config = { appId, installationId, privateKey };

  try {
    await generateToken();
    _appMode = true;
    console.log(`[github-app-token] Installation token generated (expires ${new Date(_expiresAt).toISOString()})`);

    _refreshTimer = setInterval(async function () {
      try {
        await generateToken();
        console.log(`[github-app-token] Token refreshed (expires ${new Date(_expiresAt).toISOString()})`);
      } catch (err) {
        console.error(`[github-app-token] Token refresh failed: ${err.message}`);
        // Stale token continues until it expires — next refresh cycle will retry
      }
    }, REFRESH_INTERVAL_MS);
    _refreshTimer.unref();
  } catch (err) {
    console.error(`[github-app-token] Initial token generation failed: ${err.message}`);
    _config = null;

    if (process.env.GITHUB_TOKEN) {
      console.warn('[github-app-token] Falling back to GITHUB_TOKEN PAT');
    }
    // _appMode stays false — module-context.js will use static PAT from secrets
  }
}

/**
 * Get the current cached token synchronously.
 * Returns null if App auth is not active.
 */
function getTokenSync() {
  return _token;
}

/**
 * Whether the App token system is active (init succeeded).
 */
function isAppMode() {
  return _appMode;
}

/**
 * Clear the refresh timer. Call on graceful shutdown.
 */
function shutdown() {
  if (_refreshTimer) {
    clearInterval(_refreshTimer);
    _refreshTimer = null;
  }
  _token = null;
  _expiresAt = 0;
  _appMode = false;
  _config = null;
}

module.exports = { init, getTokenSync, isAppMode, shutdown };
