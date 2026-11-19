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
      error: 'Promotion Gates API not configured. Set the AIPCC Dashboard base URL in Settings.'
    });
  }

  const url = buildUpstreamUrl(baseUrl, upstreamPath, query);

  try {
    const upstream = await retry(async (bail) => {
      let r;
      try {
        r = await fetch(url, {
          signal: AbortSignal.timeout(TIMEOUT_MS),
          // JSON by default; the summary can return CSV.
          headers: { Accept: 'application/json, text/csv' }
        });
      } catch (err) {
        if (err.name === 'TimeoutError') bail(err);
        throw err;
      }
      if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
      return r;
    }, { retries: RETRIES, minTimeout: 500 });

    const totalCount = upstream.headers.get('X-Total-Count');
    const totalPages = upstream.headers.get('X-Total-Pages');
    if (totalCount) res.set('X-Total-Count', totalCount);
    if (totalPages) res.set('X-Total-Pages', totalPages);

    // The summary endpoint can answer CSV, so pass the body through as-is
    // instead of assuming JSON.
    const contentType = upstream.headers.get('Content-Type') || 'application/json';
    res.status(upstream.status).set('Content-Type', contentType);
    const disposition = upstream.headers.get('Content-Disposition');
    if (disposition) res.set('Content-Disposition', disposition);

    if (contentType.includes('application/json')) {
      res.json(await upstream.json());
      return;
    }
    res.send(await upstream.text());
  } catch (err) {
    if (err.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Upstream request timed out' });
    }
    console.error(`[system-health/promotion-gates] Proxy error for ${upstreamPath}:`, err.message);
    res.status(502).json({ error: 'Failed to reach the Promotion Gates API' });
  }
}

module.exports = { proxyGet, buildUpstreamUrl };
