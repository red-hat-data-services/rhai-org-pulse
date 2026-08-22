/**
 * Allocation platform extension — server entry.
 *
 * Mounted by core's platform-loader as a `module-views` extension targeting
 * team-tracker: core calls `module.exports(router, context)` and mounts the
 * router at `/api/modules/team-tracker`, so the allocation routes land at
 * `/api/modules/team-tracker/allocation/...` (see ./routes.js).
 *
 * This entry makes the extension self-sufficient now that core (v2.0.61) removed
 * `loadAllocationStrategy` and `context.allocationStrategy`:
 *
 *   1. Strategy — loaded here from this extension's own manifest metadata
 *      (`manifest.strategy`) + classification logic (`../classify.js`), then
 *      threaded into the routes/orchestration engine via an augmented context.
 *   2. Jira transport — built from `context.secrets` (declared as the `jira`
 *      platform secret group in manifest.json) using core's shared
 *      `createJiraClient` factory. Credentials are never read from process.env
 *      here; only non-secret config (JIRA_HOST) is.
 *   3. Refresh — the routes register the allocation refresh handler via
 *      `context.registerRefresh`, preserved unchanged.
 */

const path = require('path');
const { createJiraClient } = require('../../../shared/server/jira');
const registerAllocationRoutes = require('./routes');

/**
 * Build the frozen allocation strategy object from the extension's manifest
 * metadata and bundled classifier. Mirrors the shape the old core
 * `loadAllocationStrategy` produced ({ id, name, description, categories,
 * classifyIssue, getJiraFields }).
 *
 * @returns {object|null}
 */
function loadStrategy() {
  let manifest;
  try {
    manifest = require(path.join(__dirname, '..', 'manifest.json'));
  } catch (err) {
    console.error('[allocation] Failed to read manifest.json:', err.message);
    return null;
  }

  const meta = manifest.strategy;
  if (!meta || !meta.id) {
    console.error('[allocation] manifest.json missing "strategy" metadata — allocation disabled');
    return null;
  }

  let classifier;
  try {
    classifier = require('../classify');
  } catch (err) {
    console.error('[allocation] Failed to load classify.js:', err.message);
    return null;
  }

  if (typeof classifier.classifyIssue !== 'function') {
    console.error('[allocation] classify.js must export classifyIssue()');
    return null;
  }

  return Object.freeze({
    id: meta.id,
    name: meta.name,
    description: meta.description || '',
    categories: Object.freeze((meta.categories || []).map((c) => Object.freeze({ ...c }))),
    classifyIssue: classifier.classifyIssue,
    getJiraFields: typeof classifier.getJiraFields === 'function' ? classifier.getJiraFields : null
  });
}

/**
 * Resolve a secret via the injected module context (never process.env).
 * @param {object} context
 * @param {string} key
 * @returns {string|undefined}
 */
function readSecret(context, key) {
  if (context.secrets && context.secrets[key] != null) return context.secrets[key];
  if (typeof context.resolveSecret === 'function') return context.resolveSecret(key);
  return undefined;
}

module.exports = function registerAllocationExtension(router, context) {
  const strategy = loadStrategy();
  if (strategy) {
    console.log(`[allocation] Loaded strategy: ${strategy.name} (${strategy.id})`);
  } else {
    console.warn('[allocation] No strategy loaded — allocation refresh will be a no-op');
  }

  // Jira credentials come from the `jira` platform secret group declared in
  // manifest.json, resolved per this extension's slug (team-tracker/allocation).
  const email = readSecret(context, 'JIRA_EMAIL');
  const token = readSecret(context, 'JIRA_TOKEN');
  // JIRA_HOST is non-secret config (exempt from the no-process-env rule).
  const host = process.env.JIRA_HOST || 'https://redhat.atlassian.net';
  const jira = createJiraClient({ email, token, host });

  // Thread the self-loaded strategy + Jira transport into the routes/engine,
  // which previously read these off core-provided context fields.
  const extendedContext = Object.assign({}, context, {
    allocationStrategy: strategy,
    jiraRequest: jira.jiraRequest,
    jiraHost: jira.JIRA_HOST
  });

  registerAllocationRoutes(router, extendedContext);
};
