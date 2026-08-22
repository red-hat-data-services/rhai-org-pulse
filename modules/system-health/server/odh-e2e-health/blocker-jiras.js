/**
 * Auto-filed E2E blocker JIRAs
 *
 * The opendatahub-operator repo runs an "e2e-failure-triage" automation
 * (.github/scripts/e2e-failure-triage/triage.py) that automatically files Jira
 * blocker bugs when a component's E2E tests fail. Every auto-filed bug is created
 * in the RHOAIENG project with the label `odh-operator-auto-e2e-blocker` (the
 * automation's own dedup key — it files one open blocker per component, then
 * comments on repeats) and is linked to the template issue RHOAIENG-79740 via a
 * "Cloners" link.
 *
 * This module fetches the currently-open blockers (identified by that label) via
 * a single JQL query and persists a snapshot to storage so the dashboard can
 * serve it quickly. See the accompanying route + view for how leadership sees it.
 *
 * Data-flow note (hard constraint #3): this is lightweight fetch-and-serve — one
 * bounded JQL query per refresh, not a compute pipeline.
 */

const { createJiraClient } = require('../../../../shared/server/jira');

const AUTO_BLOCKER_LABEL = 'odh-operator-auto-e2e-blocker';
const JIRA_PROJECT_KEY = 'RHOAIENG';
const TEMPLATE_ISSUE_KEY = 'RHOAIENG-79740';
const STORAGE_KEY = 'system-health/odh-e2e-blocker-jiras.json';

// Only the currently-open blockers matter for leadership visibility. Filtering on
// `resolution = Unresolved` here (combined with snapshot-overwrite semantics in
// refreshBlockerJiras) means any JIRA that has been resolved/closed since the last
// run naturally drops off the list.
const JQL = `project = ${JIRA_PROJECT_KEY} AND labels = "${AUTO_BLOCKER_LABEL}" AND resolution = Unresolved ORDER BY created DESC`;

const JQL_FIELDS = 'summary,status,priority,components,assignee,created,updated,versions';

/**
 * Build a Jira issue-search deep link for the blocker JQL, so the UI can offer a
 * "View all in Jira" link.
 * @param {string} host - Jira host (e.g. https://redhat.atlassian.net)
 * @returns {string}
 */
function buildJqlDeepLink(host) {
  return `${host}/issues/?jql=${encodeURIComponent(JQL)}`;
}

/**
 * Map a raw Jira issue into the compact shape the UI consumes.
 *
 * Every field is defensively defaulted: Jira may omit optional fields entirely
 * (no assignee, no components, no fix versions) or return objects without the
 * nested property we read. We normalize to sensible defaults here so the UI
 * never has to guard against `undefined` / `null` / partial shapes.
 */
function mapIssue(issue = {}, host) {
  const f = issue.fields || {};

  // Filter out entries that lack a name so a join never yields "undefined" or
  // stray separators (e.g. ["a", undefined].join(', ') => "a, ").
  const componentNames = (f.components || []).map((c) => c?.name).filter(Boolean);
  const versionNames = (f.versions || []).map((v) => v?.name).filter(Boolean);

  const key = issue.key || 'UNKNOWN';

  return {
    key,
    summary: f.summary || '(no summary)',
    status: f.status?.name || 'Unknown',
    priority: f.priority?.name || 'Unset',
    component: componentNames.length ? componentNames.join(', ') : null,
    affectsVersions: versionNames,
    assignee: f.assignee?.displayName || null,
    created: f.created || null,
    updated: f.updated || null,
    url: issue.key ? `${host}/browse/${issue.key}` : null
  };
}

/**
 * Fetch the currently-open auto-filed E2E blocker JIRAs.
 *
 * Returns a result object for the expected states (demo mode, missing
 * credentials, success). May throw on Jira/network errors (the underlying
 * client calls can reject); the caller (`refreshBlockerJiras`) catches these
 * and preserves the last-known-good snapshot.
 * @param {Object} secrets - Resolved module secrets (JIRA_EMAIL / JIRA_TOKEN)
 * @param {Object} [options]
 * @param {boolean} [options.isDemoMode]
 * @param {Object} [options.logger]
 * @returns {Promise<{ available: boolean, reason?: string, issues: Array, jql: string, host: string }>}
 */
async function fetchBlockerJiras(secrets = {}, { isDemoMode = false, logger = console } = {}) {
  const host = process.env.JIRA_HOST || 'https://redhat.atlassian.net';

  // In demo mode the fixture is served straight from storage by the route; the
  // refresh handler has nothing live to fetch.
  if (isDemoMode) {
    return { available: true, issues: [], jql: JQL, host };
  }

  const email = secrets.JIRA_EMAIL || '';
  const token = secrets.JIRA_TOKEN || '';
  if (!email || !token) {
    logger.warn('[blocker-jiras] JIRA_EMAIL/JIRA_TOKEN not configured — skipping blocker JIRA fetch');
    return { available: false, reason: 'missing-credentials', issues: [], jql: JQL, host };
  }

  const jira = createJiraClient({ email, token, host });
  const rawIssues = await jira.fetchAllJqlResults(JQL, JQL_FIELDS, { maxResults: 100 });
  const issues = rawIssues.map((issue) => mapIssue(issue, jira.JIRA_HOST));
  return { available: true, issues, jql: JQL, host: jira.JIRA_HOST };
}

/**
 * Refresh handler: fetch the open blocker JIRAs and persist a snapshot.
 *
 * Snapshot semantics: on a successful fetch we FULLY OVERWRITE the stored file
 * with the current open set (no merge/accumulate), so newly-closed JIRAs are
 * evicted on the next run. On a transient failure (network/VPN/API error) we do
 * NOT wipe the last-known-good list — we preserve the previous `issues` and mark
 * the snapshot unavailable, so an outage doesn't blank the dashboard.
 *
 * @param {Object} context - { logger, config (secrets), storage }
 * @returns {Promise<Object>} Refresh result with status + metrics
 */
async function refreshBlockerJiras(context = {}) {
  const { logger = console, config = {}, storage } = context;

  if (!storage) {
    throw new Error('Storage context is required for E2E blocker JIRA refresh');
  }

  const { readFromStorage, writeToStorage } = storage;
  const isDemoMode = process.env.DEMO_MODE === 'true';

  logger.info('Starting E2E blocker JIRA refresh...');

  try {
    const result = await fetchBlockerJiras(config, { isDemoMode, logger });

    // Missing credentials: store an explicit unavailable snapshot (empty list is
    // correct here — there is nothing to preserve).
    if (!result.available && result.reason === 'missing-credentials') {
      await writeToStorage(STORAGE_KEY, {
        lastSyncedAt: new Date().toISOString(),
        available: false,
        reason: 'missing-credentials',
        count: 0,
        jql: result.jql,
        jqlUrl: buildJqlDeepLink(result.host),
        templateIssue: TEMPLATE_ISSUE_KEY,
        issues: []
      });
      return { status: 'skipped', reason: 'missing-credentials', count: 0 };
    }

    await writeToStorage(STORAGE_KEY, {
      lastSyncedAt: new Date().toISOString(),
      available: true,
      count: result.issues.length,
      jql: result.jql,
      jqlUrl: buildJqlDeepLink(result.host),
      templateIssue: TEMPLATE_ISSUE_KEY,
      issues: result.issues
    });

    logger.info(`E2E blocker JIRA refresh complete: ${result.issues.length} open blocker(s)`);
    return { status: 'success', count: result.issues.length };
  } catch (error) {
    // Transient failure: preserve the last-known-good snapshot rather than wiping it.
    logger.error(`E2E blocker JIRA refresh failed: ${error.message}`);
    let previous;
    try {
      previous = await readFromStorage(STORAGE_KEY);
    } catch {
      previous = null;
    }

    // Note: the raw error is logged above but deliberately NOT persisted in the
    // snapshot — it's served over the API and could leak internal details.
    await writeToStorage(STORAGE_KEY, {
      lastSyncedAt: previous?.lastSyncedAt || null,
      available: false,
      reason: 'fetch-error',
      count: previous?.issues?.length || 0,
      jql: JQL,
      jqlUrl: buildJqlDeepLink(process.env.JIRA_HOST || 'https://redhat.atlassian.net'),
      templateIssue: TEMPLATE_ISSUE_KEY,
      issues: previous?.issues || []
    });

    return { status: 'error', error: error.message };
  }
}

module.exports = {
  AUTO_BLOCKER_LABEL,
  JIRA_PROJECT_KEY,
  TEMPLATE_ISSUE_KEY,
  STORAGE_KEY,
  JQL,
  buildJqlDeepLink,
  fetchBlockerJiras,
  refreshBlockerJiras
};
