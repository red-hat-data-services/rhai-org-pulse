/**
 * Fetch GitLab contribution stats via the GraphQL API.
 *
 * Uses the group-level `contributions` query to get pre-aggregated
 * event counts per user. Queries each configured group in monthly
 * windows (the API has a 93-day max per query).
 *
 * Uses node-fetch (v2) for HTTP requests.
 */

const fetch = require('node-fetch');

const INSTANCE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes per instance

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate an array of GitLab instance configs.
 * Returns only valid entries; invalid ones are logged and skipped.
 */
function validateInstances(instances) {
  if (!Array.isArray(instances)) return [];
  const valid = [];
  for (const inst of instances) {
    if (!inst || typeof inst !== 'object') {
      console.warn('[gitlab] Skipping invalid instance entry (not an object)');
      continue;
    }
    if (!inst.baseUrl || typeof inst.baseUrl !== 'string' || !inst.baseUrl.startsWith('https://')) {
      console.warn(`[gitlab] Skipping instance: baseUrl must be a non-empty string starting with https:// (got "${inst.baseUrl}")`);
      continue;
    }
    if (!inst.label || typeof inst.label !== 'string') {
      console.warn(`[gitlab] Skipping instance ${inst.baseUrl}: label is required`);
      continue;
    }
    if (!inst.tokenEnvVar || typeof inst.tokenEnvVar !== 'string') {
      console.warn(`[gitlab] Skipping instance ${inst.baseUrl}: tokenEnvVar is required`);
      continue;
    }
    if (!Array.isArray(inst.groups)) {
      console.warn(`[gitlab] Skipping instance ${inst.baseUrl}: groups must be an array`);
      continue;
    }
    valid.push({ ...inst, baseUrl: inst.baseUrl.replace(/\/+$/, '') });
  }
  return valid;
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Generate monthly date windows for the last year.
 * Each window: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }
 * All windows are <=31 days (well within the 93-day API limit).
 */
function generateMonthlyWindows() {
  const windows = [];
  const now = new Date();
  const todayYear = now.getUTCFullYear();
  const todayMonth = now.getUTCMonth();
  const todayDate = now.getUTCDate();

  for (let i = 11; i >= 0; i--) {
    const from = new Date(Date.UTC(todayYear, todayMonth - i, 1));
    let to;
    if (i === 0) {
      // Current month: up to tomorrow to include today's events
      to = new Date(Date.UTC(todayYear, todayMonth, todayDate + 1));
    } else {
      // Past months: first of next month
      to = new Date(Date.UTC(todayYear, todayMonth - i + 1, 1));
    }

    windows.push({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      monthKey: from.toISOString().slice(0, 7)
    });
  }

  return windows;
}

const CONTRIBUTIONS_QUERY = `
  query($groupPath: ID!, $from: ISO8601Date!, $to: ISO8601Date!, $cursor: String) {
    group(fullPath: $groupPath) {
      contributions(from: $from, to: $to, after: $cursor) {
        nodes {
          user { username }
          totalEvents
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

/**
 * Execute a GraphQL query against the GitLab API.
 * @param {string} query
 * @param {Object} variables
 * @param {{ baseUrl: string, token: string }} credentials
 */
async function graphqlRequest(query, variables, { baseUrl, token }) {
  const url = `${baseUrl}/api/graphql`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables }),
    timeout: 30000
  });

  if (!res.ok) {
    throw new Error(`GitLab GraphQL HTTP ${res.status}`);
  }

  const body = await res.json();
  if (body.errors && body.errors.length > 0) {
    throw new Error(`GitLab GraphQL error: ${body.errors[0].message}`);
  }

  return body.data;
}

/**
 * Fetch contribution counts for a single group and time window.
 * Handles pagination via cursor.
 * @param {string} groupPath
 * @param {string} from
 * @param {string} to
 * @param {{ baseUrl: string, token: string }} credentials
 * @returns {Object} Map of username -> totalEvents
 */
async function fetchGroupWindowContributions(groupPath, from, to, credentials) {
  const counts = {};
  let cursor = null;

  while (true) {
    const data = await graphqlRequest(CONTRIBUTIONS_QUERY, {
      groupPath,
      from,
      to,
      cursor
    }, credentials);

    const group = data.group;
    if (!group || !group.contributions) break;

    for (const node of group.contributions.nodes) {
      const username = node.user.username;
      counts[username] = (counts[username] || 0) + node.totalEvents;
    }

    if (!group.contributions.pageInfo.hasNextPage) break;
    cursor = group.contributions.pageInfo.endCursor;
    await delay(100);
  }

  return counts;
}

/**
 * Fetch contributions for a single instance (all its groups, sequentially with delays).
 * @returns {{ counts: Object<string, Object<string, number>>, instanceInfo: { baseUrl, label } }}
 */
async function fetchInstanceContributions(instance, credentials, usernameSet, windows) {
  const userMonths = {};

  for (const group of instance.groups) {
    for (const window of windows) {
      try {
        const counts = await fetchGroupWindowContributions(group, window.from, window.to, credentials);

        for (const [username, total] of Object.entries(counts)) {
          if (!usernameSet.has(username)) continue;
          if (!userMonths[username]) userMonths[username] = {};
          userMonths[username][window.monthKey] = (userMonths[username][window.monthKey] || 0) + total;
        }

        await delay(200);
      } catch (err) {
        console.error(`[gitlab] Error fetching ${group} ${window.from}..${window.to} on ${instance.label}: ${err.message}`);
      }
    }
  }

  return { counts: userMonths, instanceInfo: { baseUrl: instance.baseUrl, label: instance.label } };
}

/**
 * Fetch GitLab contribution data for a list of usernames using the
 * group-level GraphQL contributions API across multiple instances.
 *
 * @param {string[]} usernames - GitLab usernames to include in results
 * @param {object} [options]
 * @param {Array<{label, baseUrl, tokenEnvVar, groups}>} [options.gitlabInstances] - Instance configs
 * @returns {Object} Map of username -> { totalContributions, months, fetchedAt, source, instances } or null
 */
async function fetchGitlabData(usernames, options = {}) {
  const instances = validateInstances(options.gitlabInstances || []);

  if (instances.length === 0) {
    console.warn('[gitlab] No valid GitLab instances configured, skipping GitLab contributions');
    return Object.fromEntries(usernames.map(u => [u, null]));
  }

  const usernameSet = new Set(usernames);
  const windows = generateMonthlyWindows();

  const totalGroups = instances.reduce((sum, i) => sum + i.groups.length, 0);
  console.log(`[gitlab] Fetching contributions for ${usernames.length} users across ${instances.length} instance(s), ${totalGroups} group(s), ${windows.length} monthly windows`);

  // Launch all instances in parallel
  const instancePromises = instances.map(instance => {
    const token = process.env[instance.tokenEnvVar];
    if (!token) {
      console.warn(`[gitlab] Token env var ${instance.tokenEnvVar} not set, skipping ${instance.label}`);
      return Promise.resolve({ counts: {}, instanceInfo: { baseUrl: instance.baseUrl, label: instance.label } });
    }
    return withTimeout(
      fetchInstanceContributions(instance, { baseUrl: instance.baseUrl, token }, usernameSet, windows),
      INSTANCE_TIMEOUT_MS,
      instance.label
    );
  });

  const settled = await Promise.allSettled(instancePromises);

  // Merge results across instances
  // { username: { "YYYY-MM": count } } for aggregated months
  // { username: [{ baseUrl, label, contributions }] } for per-instance breakdown
  const userMonths = {};
  const userInstances = {};

  for (const result of settled) {
    if (result.status === 'rejected') {
      console.error(`[gitlab] Instance failed: ${result.reason.message}`);
      continue;
    }
    const { counts, instanceInfo } = result.value;
    for (const [username, months] of Object.entries(counts)) {
      if (!userMonths[username]) userMonths[username] = {};
      let instanceTotal = 0;
      for (const [monthKey, count] of Object.entries(months)) {
        userMonths[username][monthKey] = (userMonths[username][monthKey] || 0) + count;
        instanceTotal += count;
      }
      if (instanceTotal > 0) {
        if (!userInstances[username]) userInstances[username] = [];
        userInstances[username].push({
          baseUrl: instanceInfo.baseUrl,
          label: instanceInfo.label,
          contributions: instanceTotal
        });
      }
    }
  }

  // Build results for all requested usernames
  const results = {};
  const now = new Date().toISOString();

  for (const username of usernames) {
    const months = userMonths[username] || {};
    const totalContributions = Object.values(months).reduce((a, b) => a + b, 0);
    results[username] = {
      totalContributions,
      months,
      fetchedAt: now,
      source: 'graphql'
    };
    if (userInstances[username] && userInstances[username].length > 0) {
      results[username].instances = userInstances[username];
    }
  }

  const withContribs = Object.values(results).filter(r => r.totalContributions > 0).length;
  console.log(`[gitlab] Done: ${withContribs}/${usernames.length} users had contributions`);

  return results;
}

module.exports = { fetchGitlabData, generateMonthlyWindows, validateInstances };
