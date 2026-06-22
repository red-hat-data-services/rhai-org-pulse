/**
 * Fetch GitHub contribution stats via GraphQL API.
 *
 * Single-pass: fetches the contribution calendar with daily breakdown,
 * deriving both total counts and monthly history from one query.
 * Supports TTL-based skip for recently-fetched users.
 *
 * Requires a GITHUB_TOKEN for authentication, passed via options.token.
 * Batches users into groups to minimize API calls.
 */

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const BATCH_SIZE = 5; // Uses history query (larger response), so smaller batches
const BATCH_DELAY_MS = 2000;
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function delay(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

async function graphqlRequest(query, token) {
  const response = await fetch(GITHUB_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Authorization': `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'team-tracker'
    },
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch GitHub data (contributions + history) for a list of usernames.
 * Single-pass: uses the daily contribution calendar to derive both
 * total contribution count and monthly breakdown.
 *
 * @param {string[]} usernames - GitHub usernames to query
 * @param {object} [options]
 * @param {string} options.token - GitHub API token
 * @param {object} [options.existingData] - Map of username -> { totalContributions, months, fetchedAt }
 *   Users with fetchedAt within the TTL are skipped (their existing data is returned as-is).
 * @param {number} [options.ttlMs] - TTL in milliseconds for skip logic (default: 12 hours)
 * @returns {Object} Map of username -> { totalContributions, months, fetchedAt } or null
 */
async function fetchGithubData(usernames, options = {}) {
  const token = options.token;
  if (!token) {
    throw new Error('GITHUB_TOKEN is not configured');
  }
  const existingData = options.existingData || {};
  const ttlMs = options.ttlMs != null ? options.ttlMs : DEFAULT_TTL_MS;
  const now = Date.now();

  // Separate users into "needs fetch" and "skip (TTL fresh)"
  const toFetch = [];
  const results = {};

  for (const username of usernames) {
    const existing = existingData[username];
    if (existing && existing.fetchedAt && (now - new Date(existing.fetchedAt).getTime()) < ttlMs) {
      results[username] = existing;
    } else {
      toFetch.push(username);
    }
  }

  if (toFetch.length === 0) {
    console.log(`[github] All ${usernames.length} users within TTL, skipping fetch`);
    return results;
  }

  const skipped = usernames.length - toFetch.length;
  if (skipped > 0) {
    console.log(`[github] Skipping ${skipped} users (within TTL), fetching ${toFetch.length}`);
  }

  const batches = [];
  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    batches.push(toFetch.slice(i, i + BATCH_SIZE));
  }

  console.log(`[github] Fetching data for ${toFetch.length} users in ${batches.length} batch(es)`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const aliases = batch.map(function(username, i) {
      const safeAlias = `u${i}`;
      return `${safeAlias}: user(login: ${JSON.stringify(username)}) { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } }`;
    });

    const query = `query { ${aliases.join(' ')} }`;

    try {
      const response = await graphqlRequest(query, token);
      const fetchedAt = new Date().toISOString();

      for (let i = 0; i < batch.length; i++) {
        const alias = `u${i}`;
        const userData = response.data?.[alias];
        if (userData) {
          const calendar = userData.contributionsCollection.contributionCalendar;
          const totalContributions = calendar.totalContributions;
          const months = {};
          for (const week of calendar.weeks || []) {
            for (const day of week.contributionDays || []) {
              const monthKey = day.date.slice(0, 7);
              months[monthKey] = (months[monthKey] || 0) + day.contributionCount;
            }
          }
          results[batch[i]] = { totalContributions, months, fetchedAt };
        } else {
          results[batch[i]] = null;
        }
      }

      if (response.errors) {
        for (const err of response.errors) {
          const match = err.path?.[0]?.match(/^u(\d+)$/);
          if (match) {
            const idx = parseInt(match[1]);
            if (idx < batch.length) {
              console.log(`[github] User not found or error: ${batch[idx]} - ${err.message}`);
              results[batch[idx]] = null;
            }
          }
        }
      }

      console.log(`[github] Batch ${batchIdx + 1}/${batches.length} complete (${batch.length} users)`);
    } catch (err) {
      console.error(`[github] Batch ${batchIdx + 1} failed:`, err.message);
      for (const username of batch) {
        if (!(username in results)) {
          results[username] = null;
        }
      }
    }

    if (batchIdx < batches.length - 1) {
      await delay(BATCH_DELAY_MS);
    }
  }

  return results;
}

module.exports = { fetchGithubData };
