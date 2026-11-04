const { listChannels, getChannel, AS_OF } = require('./channels-mock');
const { proxyGet } = require('./proxy');

const CHANNEL_NAME_RE = /^[a-z0-9][a-z0-9.+-]{0,127}$/;

// Use the dashboard's collected catalog, drops and wheels verbatim. An
// unconfigured demo uses the sample catalog; upstream errors never fall back
// to sample data. The rest of the app can stay in demo mode while testing a
// configured live channel API.
module.exports = function registerChannelRoutes(router, { getBaseUrl, demoMode = false }) {
  /**
   * @openapi
   * /api/modules/product-builds/channels:
   *   get:
   *     tags: [Product Builds]
   *     summary: List content channels
   *     description: Proxies channel summaries from the configured AIPCC Dashboard API. Sample data is used only in demo mode when no API URL is configured.
   *     parameters:
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 1000
   *           default: 50
   *       - name: offset
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 0
   *           default: 0
   *     responses:
   *       200:
   *         description: >-
   *           Object with source ("dashboard", or "sample" for demo data), as_of and channels array.
   *           name, description, accelerator, accelerator_version, torch_version, rhel_version
   *           and compatible_releases mirror Pulp distribution labels; visibility,
   *           os_release, wheel_count, wheel_kinds, drop_count and latest_drop are derived
   *           and optional.
   *       503:
   *         description: Dashboard API is not configured
   *       502:
   *         description: Dashboard API could not be reached
   *       504:
   *         description: Dashboard API request timed out
   */
  router.get('/channels', async function(req, res) {
    const baseUrl = await getBaseUrl();
    if (demoMode && !baseUrl) {
      const limit = Number(req.query.limit) || 50;
      const offset = Number(req.query.offset) || 0;
      return res.json({ source: 'sample', as_of: AS_OF, channels: listChannels().slice(offset, offset + limit) });
    }
    return proxyGet(baseUrl, '/channels', req.query, res);
  });

  /**
   * @openapi
   * /api/modules/product-builds/channels/{name}:
   *   get:
   *     tags: [Product Builds]
   *     summary: Get content channel details
   *     description: Returns one channel with its RHAIBI base image drops (newest first) and the wheels it publishes with their versions.
   *     parameters:
   *       - name: name
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Channel name (e.g. cuda13.0-torch2.11-el9.8)
   *     responses:
   *       200:
   *         description: >-
   *           Object with source, as_of and channel (summary fields plus drops and wheels arrays).
   *           Drops use the Drop field names (key, name, product_key, git_branch, created_at) plus
   *           pullspec and changes; wheels are name, version and an optional kind
   *           (accelerated, native or pure).
   *       400:
   *         description: Invalid channel name
   *       404:
   *         description: Channel not found
   *       503:
   *         description: Dashboard API is not configured
   *       502:
   *         description: Dashboard API could not be reached
   *       504:
   *         description: Dashboard API request timed out
   */
  router.get('/channels/:name', async function(req, res) {
    const { name } = req.params;
    if (!CHANNEL_NAME_RE.test(name)) {
      return res.status(400).json({ error: 'Invalid channel name' });
    }
    const baseUrl = await getBaseUrl();
    if (demoMode && !baseUrl) {
      const channel = getChannel(name);
      if (!channel) {
        return res.status(404).json({ error: `Channel ${name} not found` });
      }
      return res.json({ source: 'sample', as_of: AS_OF, channel });
    }
    return proxyGet(baseUrl, `/channels/${encodeURIComponent(name)}`, req.query, res);
  });
};
