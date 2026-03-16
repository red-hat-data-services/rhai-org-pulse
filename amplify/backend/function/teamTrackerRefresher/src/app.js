const fetch = require('node-fetch');
const { readFromS3, writeToS3 } = require('./s3-storage');
const { fetchPersonMetrics } = require('./person-metrics');

const JIRA_HOST = process.env.JIRA_HOST || 'https://redhat.atlassian.net';
const CONCURRENCY = 5;
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function sanitizeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

/**
 * Refresh person metrics for a list of Jira display names.
 * Fetches from Jira with concurrency-limited workers and writes results to S3.
 */
async function refreshPersonMetrics({ jiraToken, members, force = false }) {
  console.log(`Starting person metrics refresh for ${members.length} members`);

  // Load name resolution cache
  const nameCache = await readFromS3('jira-name-map.json') || {};

  const jiraEmail = process.env.JIRA_EMAIL;
  const basicAuth = Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64');

  async function jiraRequest(path, { method = 'GET', body } = {}) {
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const options = {
        method,
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Accept': 'application/json'
        }
      };
      if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
      const response = await fetch(`${JIRA_HOST}${path}`, options);

      if (response.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = parseInt(response.headers.get('retry-after'), 10);
        const delay = (!isNaN(retryAfter) && retryAfter > 0) ? retryAfter * 1000 : Math.pow(2, attempt + 1) * 1000;
        console.warn(`[Jira API] Rate limited (429), retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Jira API error (${response.status}): ${text}`);
      }

      return response.json();
    }
  }

  // Concurrency-limited worker queue
  let index = 0;
  let completed = 0;
  let failed = 0;

  async function worker() {
    while (index < members.length) {
      const memberName = members[index++];
      try {
        const key = sanitizeFilename(memberName);
        const cachePath = `people/${key}.json`;

        // Skip members whose cache is still fresh (unless force refresh)
        if (!force) {
          const cached = await readFromS3(cachePath);
          if (cached && cached.fetchedAt) {
            const age = Date.now() - new Date(cached.fetchedAt).getTime();
            if (age < CACHE_TTL_MS) {
              console.log(`[refresh] Skipping ${memberName} (cache is ${Math.round(age / 60000)}m old)`);
              completed++;
              continue;
            }
          }
        }

        console.log(`[refresh] Fetching metrics for ${memberName} (${completed + failed + 1}/${members.length})`);
        const metrics = await fetchPersonMetrics(jiraRequest, memberName, { nameCache });
        if (metrics._resolvedName) {
          delete metrics._resolvedName;
        }
        await writeToS3(cachePath, metrics);
        completed++;
      } catch (error) {
        console.error(`[refresh] Failed for ${memberName}:`, error.message);
        failed++;
      }
    }
  }

  const workers = [];
  for (let w = 0; w < Math.min(CONCURRENCY, members.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  // Persist name cache after all refreshes
  await writeToS3('jira-name-map.json', nameCache);

  console.log(`[refresh] Complete: ${completed} succeeded, ${failed} failed out of ${members.length}`);
  return { completed, failed };
}

module.exports = { refreshPersonMetrics };
