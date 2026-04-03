/**
 * API Token CRUD helpers.
 *
 * Manages personal API tokens for bearer-token authentication.
 * Tokens are stored as SHA-256 hashes in data/api-tokens.json.
 * An in-memory hash map provides O(1) lookups; a write lock
 * serializes filesystem mutations.
 */

const crypto = require('crypto');

const TOKEN_PREFIX = 'tt_';
const TOKEN_HEX_LENGTH = 32; // 128 bits of entropy
const MAX_TOKENS_PER_USER = 25;
const LAST_USED_THROTTLE_MS = 60_000;

const EXPIRATION_OPTIONS = {
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000
};

// In-memory state
let _hashIndex = null; // Map<tokenHash, tokenRecord>
let _lastUsedWriteTimes = new Map(); // Map<tokenId, timestamp>
let _writeLock = Promise.resolve();
let _storage = null;

const STORAGE_KEY = 'api-tokens.json';

function _loadTokens() {
  const data = _storage.readFromStorage(STORAGE_KEY);
  return (data && Array.isArray(data.tokens)) ? data.tokens : [];
}

function _saveTokens(tokens) {
  _storage.writeToStorage(STORAGE_KEY, { tokens });
}

function _buildIndex(tokens) {
  const map = new Map();
  for (const t of tokens) {
    map.set(t.tokenHash, t);
  }
  return map;
}

function _ensureIndex() {
  if (!_hashIndex) {
    _hashIndex = _buildIndex(_loadTokens());
  }
  return _hashIndex;
}

function _invalidateIndex() {
  _hashIndex = null;
}

function _hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Serialize write operations to prevent concurrent filesystem mutations.
 */
function _withWriteLock(fn) {
  const next = _writeLock.then(fn);
  _writeLock = next.catch(() => {});
  return next;
}

/**
 * Initialize the token store with a storage module.
 */
function init(storageModule) {
  _storage = storageModule;
  _hashIndex = null;
  _lastUsedWriteTimes = new Map();
}

/**
 * Generate a new raw token string.
 */
function generateToken() {
  const hex = crypto.randomBytes(TOKEN_HEX_LENGTH / 2).toString('hex');
  return TOKEN_PREFIX + hex;
}

/**
 * Create a new API token for a user.
 * Returns { token, id, name, expiresAt } on success, or throws on validation error.
 */
function createToken(ownerEmail, name, expiresIn) {
  return _withWriteLock(() => {
    const tokens = _loadTokens();

    // Per-user limit
    const userTokens = tokens.filter(t => t.ownerEmail === ownerEmail);
    if (userTokens.length >= MAX_TOKENS_PER_USER) {
      const err = new Error(`Token limit reached. Maximum ${MAX_TOKENS_PER_USER} tokens per user.`);
      err.statusCode = 400;
      throw err;
    }

    const rawToken = generateToken();
    const tokenHash = _hashToken(rawToken);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    let expiresAt = null;
    if (expiresIn && expiresIn !== null) {
      const ms = EXPIRATION_OPTIONS[expiresIn];
      if (!ms) {
        const err = new Error(`Invalid expiresIn value. Must be one of: 30d, 90d, 1y, or null.`);
        err.statusCode = 400;
        throw err;
      }
      expiresAt = new Date(Date.now() + ms).toISOString();
    }

    const record = {
      id,
      name,
      tokenHash,
      tokenPrefix: rawToken.substring(0, 3 + 8), // "tt_" + 8 hex chars
      ownerEmail,
      createdAt: now,
      expiresAt,
      lastUsedAt: null
    };

    tokens.push(record);
    _saveTokens(tokens);
    _invalidateIndex();

    return {
      token: rawToken,
      id,
      name,
      expiresAt
    };
  });
}

/**
 * Validate a raw token string. Returns the token record if valid, null otherwise.
 * Does NOT update lastUsedAt (caller should do that separately).
 */
function validateToken(rawToken) {
  if (!rawToken || !rawToken.startsWith(TOKEN_PREFIX)) return null;

  const hash = _hashToken(rawToken);
  const index = _ensureIndex();
  const record = index.get(hash);

  if (!record) return null;

  // Check expiration
  if (record.expiresAt && new Date(record.expiresAt) <= new Date()) {
    return null;
  }

  return record;
}

/**
 * Quick hash-only check: does a valid, non-expired token exist for this raw token?
 * Used by proxySecretGuard for inline validation.
 */
function isValidToken(rawToken) {
  return validateToken(rawToken) !== null;
}

/**
 * Update lastUsedAt for a token, throttled to avoid excessive writes.
 */
function touchLastUsed(tokenId) {
  const now = Date.now();
  const lastWritten = _lastUsedWriteTimes.get(tokenId);
  if (lastWritten && (now - lastWritten) < LAST_USED_THROTTLE_MS) {
    return;
  }
  _lastUsedWriteTimes.set(tokenId, now);

  // Fire-and-forget write
  _withWriteLock(() => {
    const tokens = _loadTokens();
    const token = tokens.find(t => t.id === tokenId);
    if (token) {
      token.lastUsedAt = new Date().toISOString();
      _saveTokens(tokens);
      _invalidateIndex();
    }
  }).catch(err => console.error('touchLastUsed write error:', err));
}

/**
 * List tokens for a specific user (metadata only, no hashes).
 */
function listUserTokens(ownerEmail) {
  const tokens = _loadTokens();
  return tokens
    .filter(t => t.ownerEmail === ownerEmail)
    .map(sanitizeToken);
}

/**
 * List all tokens (admin view, metadata only).
 */
function listAllTokens() {
  const tokens = _loadTokens();
  return tokens.map(sanitizeToken);
}

/**
 * Remove sensitive fields from a token record.
 */
function sanitizeToken(t) {
  return {
    id: t.id,
    name: t.name,
    tokenPrefix: t.tokenPrefix,
    ownerEmail: t.ownerEmail,
    createdAt: t.createdAt,
    expiresAt: t.expiresAt,
    lastUsedAt: t.lastUsedAt
  };
}

/**
 * Revoke a token by ID. Returns true if found and removed, false otherwise.
 * If ownerEmail is provided, only revoke if the token belongs to that user.
 */
function revokeToken(tokenId, ownerEmail) {
  return _withWriteLock(() => {
    const tokens = _loadTokens();
    const idx = tokens.findIndex(t => {
      if (t.id !== tokenId) return false;
      if (ownerEmail && t.ownerEmail !== ownerEmail) return false;
      return true;
    });

    if (idx === -1) return false;

    tokens.splice(idx, 1);
    _saveTokens(tokens);
    _invalidateIndex();
    _lastUsedWriteTimes.delete(tokenId);
    return true;
  });
}

/**
 * Revoke a token by ID (admin — no owner check).
 */
function adminRevokeToken(tokenId) {
  return revokeToken(tokenId, null);
}

// Exported for testing
module.exports = {
  init,
  createToken,
  validateToken,
  isValidToken,
  touchLastUsed,
  listUserTokens,
  listAllTokens,
  revokeToken,
  adminRevokeToken,
  // Constants for testing
  TOKEN_PREFIX,
  MAX_TOKENS_PER_USER,
  EXPIRATION_OPTIONS,
  // Internal for testing
  _hashToken,
  _resetForTest() {
    _hashIndex = null;
    _lastUsedWriteTimes = new Map();
    _writeLock = Promise.resolve();
  }
};
