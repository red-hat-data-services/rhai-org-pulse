const { jiraRequest, fetchAllJqlResults } = require('../../../../shared/server/jira');
const { deriveHumanReviewStatus, PRIORITIES } = require('./validation');
const { readFeatures, writeFeaturesAtomic, trimForHistory, MAX_HISTORY } = require('./storage');

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1000;

/**
 * In-memory lock to prevent concurrent writes to features.json.
 * Shared with routes.js via module exports.
 */
const featureLock = { held: false };

/**
 * Acquire the feature write lock. Returns true if acquired, false if already held.
 */
function acquireLock() {
  if (featureLock.held) return false;
  featureLock.held = true;
  return true;
}

function releaseLock() {
  featureLock.held = false;
}

/**
 * Sync feature metadata from Jira for all features in storage.
 * Reads from storage, syncs from Jira, writes back.
 *
 * @param {Function} readFromStorage
 * @returns {Promise<{synced: number, updated: number, statusChanged: number, notFound: number, errors: string[]}>}
 */
async function syncFeaturesFromJira(readFromStorage) {
  const data = readFeatures(readFromStorage);
  const result = await syncFeatureData(data);
  data.lastJiraSyncAt = new Date().toISOString();
  writeFeaturesAtomic(data);
  return result;
}

/**
 * Core sync logic: fetches Jira data for all features and applies updates.
 * Operates on the data object in-memory (mutates in place).
 * Separated from I/O for testability.
 *
 * @param {object} data - The full features data object
 * @param {Function} [fetchFn] - Override for fetchAllJqlResults (for testing)
 * @returns {Promise<{synced: number, updated: number, statusChanged: number, notFound: number, errors: string[]}>}
 */
async function syncFeatureData(data, fetchFn) {
  const doFetch = fetchFn || fetchAllJqlResults;
  const keys = Object.keys(data.features);

  if (keys.length === 0) {
    return { synced: 0, updated: 0, statusChanged: 0, notFound: 0, errors: [] };
  }

  const counts = { synced: 0, updated: 0, statusChanged: 0, notFound: 0 };
  const errors = [];
  const foundKeys = new Set();

  // Batch keys into JQL queries
  const batches = [];
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    batches.push(keys.slice(i, i + BATCH_SIZE));
  }

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }

    const jql = `key in (${batch.join(',')})`;
    let issues;
    try {
      issues = await doFetch(jiraRequest, jql, 'summary,status,priority,labels', { expand: 'changelog' });
    } catch (err) {
      errors.push(`Batch ${i + 1}/${batches.length} failed: ${err.message}`);
      continue;
    }

    for (const issue of issues) {
      foundKeys.add(issue.key);
      const result = applyJiraFields(data, issue);
      if (result === 'updated') counts.updated++;
      else if (result === 'status_changed') { counts.statusChanged++; counts.updated++; }
    }

    counts.synced += issues.length;
  }

  // Count features not found in Jira
  counts.notFound = keys.filter(k => !foundKeys.has(k)).length;

  return { ...counts, errors };
}

const SIGN_OFF_LABEL = 'strat-creator-human-sign-off';

/**
 * Extract who added the human sign-off label and when, from the Jira changelog.
 *
 * @param {object} changelog - Jira issue changelog (from expand=changelog)
 * @returns {{ approvedBy: string, approvedAt: string } | null}
 */
function extractSignOffInfo(changelog) {
  if (!changelog?.histories) return null;
  let latest = null;
  for (const history of changelog.histories) {
    for (const item of history.items) {
      if (item.field !== 'labels') continue;
      const before = (item.fromString || '').split(/\s+/).filter(Boolean);
      const after = (item.toString || '').split(/\s+/).filter(Boolean);
      if (after.includes(SIGN_OFF_LABEL) && !before.includes(SIGN_OFF_LABEL)) {
        const date = new Date(history.created);
        if (!latest || date > new Date(latest.approvedAt)) {
          latest = {
            approvedBy: history.author?.displayName || null,
            approvedAt: history.created
          };
        }
      }
    }
  }
  return latest;
}

/**
 * Apply Jira fields to an existing feature entry. Mutates data in place.
 * Only creates a history entry when humanReviewStatus changes.
 *
 * @param {object} data - The full features data object
 * @param {object} issue - Jira issue from the API
 * @returns {'unchanged' | 'updated' | 'status_changed'}
 */
function applyJiraFields(data, issue) {
  const entry = data.features[issue.key];
  if (!entry) return 'unchanged';

  const latest = entry.latest;
  const fields = issue.fields;

  // Extract fields from Jira response (nested objects)
  const title = typeof fields.summary === 'string' ? fields.summary : latest.title;
  const status = fields.status?.name || latest.status;
  const rawPriority = fields.priority?.name || latest.priority;
  const priority = PRIORITIES.includes(rawPriority) ? rawPriority : 'Undefined';
  const labels = Array.isArray(fields.labels) ? fields.labels : latest.labels;

  // Extract sign-off info from changelog
  const signOffInfo = extractSignOffInfo(issue.changelog);

  // Check if anything changed
  const titleChanged = title !== latest.title;
  const statusChanged = status !== latest.status;
  const priorityChanged = priority !== latest.priority;
  const labelsChanged = JSON.stringify([...labels].sort()) !== JSON.stringify([...(latest.labels || [])].sort());
  const approvalChanged = (signOffInfo?.approvedBy || null) !== (latest.approvedBy || null);

  if (!titleChanged && !statusChanged && !priorityChanged && !labelsChanged && !approvalChanged) {
    return 'unchanged';
  }

  // Derive new humanReviewStatus
  const newHumanReviewStatus = deriveHumanReviewStatus(labels);
  const reviewStatusChanged = newHumanReviewStatus !== latest.humanReviewStatus;

  // If humanReviewStatus changed, snapshot current state into history
  if (reviewStatusChanged) {
    const history = [trimForHistory(latest), ...entry.history];
    entry.history = history.slice(0, MAX_HISTORY);
  }

  // Update mutable fields
  latest.title = title;
  latest.status = status;
  latest.priority = priority;
  latest.labels = labels;
  latest.humanReviewStatus = newHumanReviewStatus;

  // Update approval info
  if (signOffInfo) {
    latest.approvedBy = signOffInfo.approvedBy;
    latest.approvedAt = signOffInfo.approvedAt;
  } else if (newHumanReviewStatus !== 'approved') {
    // Clear approval info if sign-off label was removed
    latest.approvedBy = undefined;
    latest.approvedAt = undefined;
  }

  return reviewStatusChanged ? 'status_changed' : 'updated';
}

module.exports = { syncFeaturesFromJira, syncFeatureData, applyJiraFields, extractSignOffInfo, featureLock, acquireLock, releaseLock };
