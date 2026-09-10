const { fetchAllJqlResults } = require('../../../../shared/server/jira');
const { readComponentOnboarding, writeComponentOnboardingAtomic } = require('./storage');
const {
  TARGET_VERSION_FIELD,
  extractVersionNameFromJiraField,
  needsTargetVersionEnrichment
} = require('./target-version');

const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1000;

const coLock = { held: false };

function acquireLock() {
  if (coLock.held) return false;
  coLock.held = true;
  return true;
}

function releaseLock() {
  coLock.held = false;
}

/**
 * Fetch Jira Target Version (customfield_10855) for components missing a numeric release.
 * Mutates data in place.
 *
 * @param {object} data - Full component onboarding store
 * @param {Function} jiraRequest
 * @param {Function} [fetchFn] - Override for tests
 * @returns {Promise<{ synced: number, updated: number, errors: string[] }>}
 */
async function enrichTargetVersionsFromJira(data, jiraRequest, fetchFn) {
  const doFetch = fetchFn || fetchAllJqlResults;
  const keysToEnrich = [];

  for (const [key, entry] of Object.entries(data.components || {})) {
    if (needsTargetVersionEnrichment(entry.latest)) keysToEnrich.push(key);
  }

  if (keysToEnrich.length === 0) {
    return { synced: 0, updated: 0, errors: [] };
  }

  const counts = { synced: 0, updated: 0 };
  const errors = [];

  for (let i = 0; i < keysToEnrich.length; i += BATCH_SIZE) {
    const batch = keysToEnrich.slice(i, i + BATCH_SIZE);

    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }

    const jql = `key in (${batch.join(',')})`;
    let issues;
    try {
      issues = await doFetch(jiraRequest, jql, TARGET_VERSION_FIELD);
    } catch (err) {
      errors.push(`Batch at offset ${i}: ${err.message}`);
      continue;
    }

    const issueMap = new Map((issues || []).map(iss => [iss.key, iss]));

    for (const key of batch) {
      counts.synced++;
      const issue = issueMap.get(key);
      if (!issue) continue;

      const tvName = extractVersionNameFromJiraField(issue.fields?.[TARGET_VERSION_FIELD]);
      if (!tvName) continue;

      const entry = data.components[key];
      if (entry.latest.targetVersion !== tvName) {
        entry.latest.targetVersion = tvName;
        counts.updated++;
      }
    }
  }

  return { synced: counts.synced, updated: counts.updated, errors };
}

/**
 * Read storage, enrich target versions from Jira, write back when changed.
 */
async function syncComponentOnboardingFromJira(readFromStorage, writeToStorage, jiraRequest, fetchFn) {
  const data = await readComponentOnboarding(readFromStorage);
  const result = await enrichTargetVersionsFromJira(data, jiraRequest, fetchFn);

  if (result.updated > 0) {
    await writeComponentOnboardingAtomic(writeToStorage, data);
  }

  return result;
}

module.exports = {
  BATCH_SIZE,
  acquireLock,
  releaseLock,
  enrichTargetVersionsFromJira,
  syncComponentOnboardingFromJira
};
