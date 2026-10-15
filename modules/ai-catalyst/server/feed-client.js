const DEFAULT_TIMEOUT_MS = 30000;

// Loopback is the dev/test carve-out: a token sent to loopback stays on the
// machine. It is strictly opt-in via POC_EXPLORER_ALLOW_LOOPBACK=1 so a
// stored settings URL can never aim the production token at a local listener.
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

class FeedError extends Error {
  constructor(message, { status, body, cause } = {}) {
    super(message);
    this.name = 'FeedError';
    this.status = status || null;
    this.body = body || null;
    this.cause = cause || null;
  }
}

function parseJsonBody(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

/**
 * Validate the feed destination BEFORE the bearer token leaves the process:
 * HTTPS only (except opt-in loopback), and — when callers pass an allowlist —
 * only operator-approved origins. A URL from stored module settings must land
 * in that set or the request never happens.
 */
function validateFeedDestination(root, allowedOrigins, allowLoopback) {
  let parsed;
  try {
    parsed = new URL(root);
  } catch {
    throw new FeedError(`POC Explorer feed URL is not a valid URL: ${root}`);
  }

  const isLoopback = LOOPBACK_HOSTNAMES.has(parsed.hostname);
  if (isLoopback && !allowLoopback) {
    throw new FeedError(`POC Explorer feed URL points at loopback, which is only allowed when POC_EXPLORER_ALLOW_LOOPBACK=1: ${root}`);
  }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopback)) {
    throw new FeedError(`POC Explorer feed URL must use HTTPS (plain HTTP is only allowed on loopback): ${root}`);
  }

  if (Array.isArray(allowedOrigins) && !isLoopback && !allowedOrigins.includes(parsed.origin)) {
    throw new FeedError(
      `POC Explorer feed URL is not an approved origin: ${parsed.origin} (approved: ${allowedOrigins.join(', ')})`,
    );
  }
}

/**
 * HTTP client for the POC Explorer machine feeds (ADR-077 producer side).
 * All endpoints require `Authorization: Bearer <token>` and return JSON.
 */
function createFeedClient({ baseUrl, token, timeoutMs = DEFAULT_TIMEOUT_MS, fetchFn = globalThis.fetch, allowedOrigins, allowLoopback = false }) {
  const root = String(baseUrl || '').replace(/\/+$/, '');

  async function request(path) {
    if (!token) {
      throw new FeedError('POC Explorer feed token is not configured — set POC_EXPLORER_FEED_TOKEN');
    }
    if (!root) {
      throw new FeedError('POC Explorer feed URL is not configured — set POC_EXPLORER_FEED_URL');
    }
    validateFeedDestination(root, allowedOrigins, allowLoopback);

    const url = root + path;
    const controller = new AbortController();
    // The timer stays armed until the response body has been consumed —
    // clearing it after headers arrive would let a stalled body hang forever.
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchFn(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      const text = await response.text();
      const body = parseJsonBody(text);

      if (response.status === 401) {
        throw new FeedError('unauthorized — check POC_EXPLORER_FEED_TOKEN', { status: 401, body });
      }
      if (response.status === 404) {
        let message = `not found at ${path}`;
        if (body && typeof body.error === 'string' && body.error) {
          message = body.error;
        }
        if (body && Array.isArray(body.known)) {
          message += ` (${body.known.length} known)`;
        }
        throw new FeedError(message, { status: 404, body });
      }
      if (!response.ok) {
        throw new FeedError(`POC Explorer feed request failed with HTTP ${response.status} at ${path}`, { status: response.status, body });
      }
      if (body === null || typeof body !== 'object') {
        throw new FeedError(`POC Explorer feed returned non-JSON response at ${path}`, { status: response.status });
      }
      return body;
    } catch (err) {
      if (err instanceof FeedError) throw err;
      if (err && err.name === 'AbortError') {
        throw new FeedError(`POC Explorer feed request timed out after ${Math.round(timeoutMs / 1000)}s: ${url}`, { cause: err });
      }
      throw new FeedError(
        `Failed to reach POC Explorer feed at ${root}: ${err.message}. Check POC_EXPLORER_FEED_URL and network connectivity.`,
        { cause: err },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async listBoards() {
      const body = await request('/feed/boards.json');
      if (!Array.isArray(body.boards)) {
        throw new FeedError('unexpected response shape from /feed/boards.json — expected a "boards" array');
      }
      if (!body.boards.every(b => typeof b === 'string')) {
        throw new FeedError('unexpected response shape from /feed/boards.json — "boards" entries must all be strings');
      }
      return body.boards;
    },
    async getBoard(name) {
      const body = await request(`/feed/board.json?board=${encodeURIComponent(name)}`);
      if (body.name !== undefined && body.name !== name) {
        throw new FeedError(`unexpected board name from /feed/board.json — expected ${name}`);
      }
      if (!Array.isArray(body.rows)) {
        throw new FeedError('unexpected response shape from /feed/board.json — expected a "rows" array');
      }
      // A degraded feed can serve a shape-valid empty board; a missing or
      // mismatched count, or non-object rows, must not wipe the cache. The
      // producer always emits count = rows.length (ADR-077).
      if (typeof body.count !== 'number' || body.count !== body.rows.length) {
        throw new FeedError(`unexpected response shape from /feed/board.json — count must be a number matching rows length (count: ${JSON.stringify(body.count)}, rows: ${body.rows.length})`);
      }
      if (!body.rows.every(r => r && typeof r === 'object' && !Array.isArray(r))) {
        throw new FeedError('unexpected response shape from /feed/board.json — "rows" entries must all be objects');
      }
      // The producer stringifies every cell (ADR-077); a non-string cell
      // value is producer drift that crashes string consumers downstream.
      // Missing or null cells stay allowed (existing missing-field semantics).
      if (!body.rows.every(r => Object.values(r).every(v => v == null || typeof v === 'string'))) {
        throw new FeedError('unexpected response shape from /feed/board.json — row cell values must all be strings');
      }
      return body;
    },
    async getShowcase() {
      const body = await request('/feed/showcase.json');
      for (const key of ['showcase_entries', 'strategy_pillars']) {
        if (!Array.isArray(body[key])) {
          throw new FeedError(`unexpected response shape from /feed/showcase.json — expected a "${key}" array`);
        }
        // Null or non-object rows would be silently dropped by the row mapper,
        // wiping the cached catalog with a "successful" empty sync.
        if (!body[key].every(r => r && typeof r === 'object' && !Array.isArray(r))) {
          throw new FeedError(`unexpected response shape from /feed/showcase.json — "${key}" entries must all be objects`);
        }
      }
      return body;
    },
  };
}

module.exports = { createFeedClient, FeedError };
