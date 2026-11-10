const { EnvHttpProxyAgent, fetch: undiciFetch } = require('undici');

// Captured before any test can stub globalThis.fetch: only the real global
// fetch may be swapped for undici's, so stubs and injected functions win.
const nativeFetch = globalThis.fetch;

const DEFAULT_TIMEOUT_MS = 30000;

// Loopback is the dev/test carve-out: a token sent to loopback stays on the
// machine. It is strictly opt-in via POC_EXPLORER_ALLOW_LOOPBACK=1 so a
// stored settings URL can never aim the production token at a local listener.
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Node's global fetch ignores HTTP_PROXY/HTTPS_PROXY. Production pods reach
 * external hosts only through the corporate proxy, so without a dispatcher
 * the request never leaves the cluster. This mirrors the workflow-validation
 * client: a per-client agent, never a global dispatcher.
 */
function proxyDispatcherFromEnv(env = process.env) {
  const httpProxy = env.HTTP_PROXY || env.http_proxy;
  const httpsProxy = env.HTTPS_PROXY || env.https_proxy;
  if (!httpsProxy && !httpProxy) return null;
  return new EnvHttpProxyAgent({
    httpProxy: httpProxy || undefined,
    httpsProxy: httpsProxy || undefined,
    noProxy: env.NO_PROXY || env.no_proxy || undefined,
  });
}

let _defaultDispatcher;
let _proxyKey;

function proxyEnvKey(env) {
  return [env.HTTPS_PROXY, env.https_proxy, env.HTTP_PROXY, env.http_proxy, env.NO_PROXY, env.no_proxy].join('\u0000');
}

/** Memoize the proxy dispatcher for the current proxy environment. */
function defaultDispatcher(env = process.env) {
  // Reuse one agent per proxy configuration. Keying on the env (instead of
  // caching a single value) keeps tests and any runtime env change honest.
  const key = proxyEnvKey(env);
  if (_defaultDispatcher === undefined || _proxyKey !== key) {
    _proxyKey = key;
    _defaultDispatcher = proxyDispatcherFromEnv(env);
  }
  return _defaultDispatcher;
}

/**
 * Render a URL without userinfo. Anything that is not a single valid URL
 * (including a malformed stored value) becomes an opaque placeholder, so the
 * value can never be echoed with credentials.
 */
function redactUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    // Only hierarchical http(s) URLs are safe to render; an opaque or
    // scheme-only value could hide credentials in its path.
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '(invalid URL)';
    if (!parsed.host) return '(invalid URL)';
    const pathname = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.protocol}//${parsed.host}${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '(invalid URL)';
  }
}

/** Strip scheme-based userinfo from free text such as an error message. */
function redactText(value) {
  return String(value || '').replace(/([a-z][a-z0-9+.-]*:\/\/)[^/\s]*@/gi, '$1');
}

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
    throw new FeedError(`POC Explorer feed URL is not a valid URL`);
  }

  const isLoopback = LOOPBACK_HOSTNAMES.has(parsed.hostname);
  if (isLoopback && !allowLoopback) {
    throw new FeedError(`POC Explorer feed URL points at loopback, which is only allowed when POC_EXPLORER_ALLOW_LOOPBACK=1`);
  }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopback)) {
    throw new FeedError(`POC Explorer feed URL must use HTTPS (plain HTTP is only allowed on loopback)`);
  }

  // Credentials in the URL would be sent to the feed and echoed by /config;
  // they are never a valid base URL.
  if (parsed.username || parsed.password) {
    throw new FeedError('POC Explorer feed URL must not contain credentials');
  }

  // The client appends the feed path itself; a query or fragment can only
  // produce a broken URL.
  if (parsed.search || parsed.hash) {
    throw new FeedError(`POC Explorer feed URL must not contain a query or fragment`);
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
function createFeedClient({ baseUrl, token, timeoutMs = DEFAULT_TIMEOUT_MS, fetchFn = globalThis.fetch, allowedOrigins, allowLoopback = false, dispatcher }) {
  const root = String(baseUrl || '').replace(/\/+$/, '');

  /** Fetch one feed path with bearer auth, timeout and destination validation. */
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
      const options = {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      };
      // Resolve the proxy lazily: a malformed proxy URL must not break
      // loopback stubs, and it should surface as a feed error, not a crash.
      // Loopback stays direct even when a proxy is configured.
      if (!LOOPBACK_HOSTNAMES.has(new URL(root).hostname)) {
        const agent = dispatcher === undefined ? defaultDispatcher() : dispatcher;
        if (agent) options.dispatcher = agent;
      }
      // A dispatcher and the fetch that uses it must come from the same
      // undici copy: Node's global fetch rejects a dispatcher from another
      // version (CI runs Node 22 with undici 8, prod runs Node 26 with 7).
      const doFetch = options.dispatcher && fetchFn === nativeFetch ? undiciFetch : fetchFn;
      const response = await doFetch(url, options);
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
        throw new FeedError(`POC Explorer feed request timed out after ${Math.round(timeoutMs / 1000)}s: ${redactUrl(url)}`, { cause: err });
      }
      // undici hides the real cause two levels deep (e.g. a 407 from the
      // proxy), so report it instead of the generic "fetch failed".
      const detail = redactText(
        (err && err.cause && err.cause.cause && err.cause.cause.message)
        || (err && err.cause && err.cause.message)
        || err.message,
      );
      throw new FeedError(
        `Failed to reach POC Explorer feed at ${redactUrl(root)}: ${detail}. Check POC_EXPLORER_FEED_URL and network connectivity.`,
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

module.exports = { createFeedClient, FeedError, proxyDispatcherFromEnv, validateFeedDestination, redactUrl, redactText };
