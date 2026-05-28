const retry = require('async-retry');

const TIMEOUT_MS = 30_000;
const RETRIES = 3;

function buildUpstreamUrl(baseUrl, path, query) {
  const base = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  const relative = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(relative, base);
  if (query && typeof query === 'object') {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
}

async function proxyGet(baseUrl, upstreamPath, query, res) {
  if (!baseUrl) {
    return res.status(503).json({
      error: 'Product Builds API not configured. Set the base URL in Settings.'
    });
  }

  const url = buildUpstreamUrl(baseUrl, upstreamPath, query);

  try {
    const upstream = await retry(async (bail) => {
      let r;
      try {
        r = await fetch(url, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { 'Accept': 'application/json' }
        });
      } catch (err) {
        if (err.name === 'TimeoutError') bail(err);
        throw err;
      }
      if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
      return r;
    }, { retries: RETRIES, minTimeout: 500 });

    const body = await upstream.json();
    const totalCount = upstream.headers.get('X-Total-Count');
    const totalPages = upstream.headers.get('X-Total-Pages');
    if (totalCount) res.set('X-Total-Count', totalCount);
    if (totalPages) res.set('X-Total-Pages', totalPages);
    res.status(upstream.status).json(body);
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Upstream request timed out' });
    }
    console.error(`[product-builds] Proxy error for ${upstreamPath}:`, err.message);
    res.status(502).json({ error: 'Failed to reach Product Builds API' });
  }
}

module.exports = { proxyGet, buildUpstreamUrl };
