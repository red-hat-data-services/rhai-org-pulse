const { listChannels, getChannel, AS_OF } = require('./channels-mock');

const CHANNEL_NAME_RE = /^[a-z0-9][a-z0-9.+-]{0,127}$/;

// Channel data is served from a sample catalog until channels are published
// upstream (AIPCC-31813). Responses carry `source` and `as_of` so the UI can
// flag sample data. The real source must be the AIPCC Dashboard API, which
// pre-computes per-channel drops and wheels, reached through proxyGet like
// the other product-builds routes. Do not build wheel lists here by crawling
// Pulp indexes: this app is a display layer.
const SOURCE = 'sample';

module.exports = function registerChannelRoutes(router) {
  /**
   * @openapi
   * /api/modules/product-builds/channels:
   *   get:
   *     tags: [Product Builds]
   *     summary: List content channels
   *     description: Returns AIPCC content channels identified by accelerator, torch and OS, with their maturity (stable or rolling), compatible product releases, latest RHAIBI drop and wheel counts. Served from a sample catalog until the AIPCC Dashboard API publishes channel data.
   *     responses:
   *       200:
   *         description: >-
   *           Object with source ("sample"), as_of (catalog date) and channels array.
   *           name, description, accelerator, accelerator_version, torch_version, rhel_version
   *           and compatible_releases mirror Pulp distribution labels; maturity, visibility,
   *           os_release, wheel_count, wheel_kinds, drop_count and latest_drop are derived
   *           and optional.
   */
  router.get('/channels', function(req, res) {
    res.json({ source: SOURCE, as_of: AS_OF, channels: listChannels() });
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
   *         description: Channel name (e.g. cuda13.0-torch2.11-ubi9)
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
   */
  router.get('/channels/:name', function(req, res) {
    const { name } = req.params;
    if (!CHANNEL_NAME_RE.test(name)) {
      return res.status(400).json({ error: 'Invalid channel name' });
    }
    const channel = getChannel(name);
    if (!channel) {
      return res.status(404).json({ error: `Channel ${name} not found` });
    }
    res.json({ source: SOURCE, as_of: AS_OF, channel });
  });
};
