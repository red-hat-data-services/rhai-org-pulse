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

const GITLAB_BASE_URL = process.env.GITLAB_BASE_URL || 'https://gitlab.com';
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;

if (!GITLAB_TOKEN) {
  console.warn('[gitlab] GITLAB_TOKEN not set — GitLab contributions will not be fetched');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  query($groupPath: ID!, $from: String!, $to: String!, $cursor: String) {
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
 */
async function graphqlRequest(query, variables) {
  const url = `${GITLAB_BASE_URL}/api/graphql`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GITLAB_TOKEN}`
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
 * @returns {Object} Map of username -> totalEvents
 */
async function fetchGroupWindowContributions(groupPath, from, to) {
  const counts = {};
  let cursor = null;

  while (true) {
    const data = await graphqlRequest(CONTRIBUTIONS_QUERY, {
      groupPath,
      from,
      to,
      cursor
    });

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
 * Fetch GitLab contribution data for a list of usernames using the
 * group-level GraphQL contributions API.
 *
 * @param {string[]} usernames - GitLab usernames to include in results
 * @param {object} [options]
 * @param {string[]} [options.gitlabGroups] - GitLab group paths to query
 * @returns {Object} Map of username -> { totalContributions, months, fetchedAt, source } or null
 */
async function fetchGitlabData(usernames, options = {}) {
  const groups = options.gitlabGroups || [];

  if (!GITLAB_TOKEN) {
    console.warn('[gitlab] No GITLAB_TOKEN set, skipping GitLab contributions');
    return Object.fromEntries(usernames.map(u => [u, null]));
  }

  if (groups.length === 0) {
    console.warn('[gitlab] No gitlabGroups configured, skipping GitLab contributions');
    return Object.fromEntries(usernames.map(u => [u, null]));
  }

  const usernameSet = new Set(usernames);
  const windows = generateMonthlyWindows();

  console.log(`[gitlab] Fetching contributions for ${usernames.length} users across ${groups.length} group(s), ${windows.length} monthly windows`);

  // Accumulate monthly counts per username across all groups
  // { username: { "YYYY-MM": count } }
  const userMonths = {};

  for (const group of groups) {
    for (const window of windows) {
      try {
        const counts = await fetchGroupWindowContributions(group, window.from, window.to);

        for (const [username, total] of Object.entries(counts)) {
          if (!usernameSet.has(username)) continue;
          if (!userMonths[username]) userMonths[username] = {};
          userMonths[username][window.monthKey] = (userMonths[username][window.monthKey] || 0) + total;
        }

        await delay(200);
      } catch (err) {
        console.error(`[gitlab] Error fetching ${group} ${window.from}..${window.to}: ${err.message}`);
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
  }

  const withContribs = Object.values(results).filter(r => r.totalContributions > 0).length;
  console.log(`[gitlab] Done: ${withContribs}/${usernames.length} users had contributions`);

  return results;
}

module.exports = { fetchGitlabData, generateMonthlyWindows };
