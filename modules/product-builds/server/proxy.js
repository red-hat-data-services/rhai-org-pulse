const TIMEOUT_MS = 30_000;

function buildUpstreamUrl(baseUrl, path, query) {
  const url = new URL(path, baseUrl);
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
    const upstream = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'Accept': 'application/json' }
    });

    const body = await upstream.json();
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
