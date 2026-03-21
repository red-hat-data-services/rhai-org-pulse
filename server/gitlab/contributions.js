/**
 * Fetch GitLab contribution stats via the Events API
 * (/api/v4/users/:id/events).
 *
 * Primary strategy: fetch all events since a date in one paginated pass.
 * Fallback: if the API returns HTTP 500 (common for large date ranges),
 * retry with monthly chunks.
 *
 * Uses node-fetch (v2) for HTTP requests.
 */

const fetch = require('node-fetch');

const GITLAB_BASE_URL = process.env.GITLAB_BASE_URL || 'https://gitlab.com';
const GITLAB_TOKEN = process.env.GITLAB_TOKEN;
const MAX_REQUESTS_PER_SEC = GITLAB_TOKEN ? 10 : 1;
const DEFAULT_CONCURRENCY = 5;

function buildHeaders() {
  const headers = {};
  if (GITLAB_TOKEN) {
    headers['PRIVATE-TOKEN'] = GITLAB_TOKEN;
  }
  return headers;
}

if (!GITLAB_TOKEN) {
  console.warn('[gitlab] GITLAB_TOKEN not set — only public project contributions will be counted');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a shared rate limiter that enforces a maximum request rate.
 * All concurrent workers share a single limiter instance.
 */
function createRateLimiter(maxPerSecond) {
  const minIntervalMs = 1000 / maxPerSecond;
  let lastRequestTime = 0;
  let pending = Promise.resolve();

  return function acquire() {
    pending = pending.then(async () => {
      const now = Date.now();
      const elapsed = now - lastRequestTime;
      if (elapsed < minIntervalMs) {
        await delay(minIntervalMs - elapsed);
      }
      lastRequestTime = Date.now();
    });
    return pending;
  };
}

/**
 * Resolve a GitLab username to a numeric user ID.
 * Results are cached in userIdCache (mutated in place).
 */
async function resolveUserId(username, userIdCache, rateLimiter) {
  if (userIdCache[username]) return userIdCache[username];

  await rateLimiter();
  const url = `${GITLAB_BASE_URL}/api/v4/users?username=${encodeURIComponent(username)}`;
  const res = await fetch(url, { headers: buildHeaders(), timeout: 15000 });
  if (!res.ok) return null;

  const users = await res.json();
  if (!Array.isArray(users) || users.length === 0) return null;

  userIdCache[username] = users[0].id;
  return users[0].id;
}

/**
 * Fetch events for a user within a date range, paginating through all pages.
 *
 * @param {number} userId
 * @param {string} afterDate - "YYYY-MM-DD" exclusive lower bound
 * @param {string|null} beforeDate - "YYYY-MM-DD" exclusive upper bound, or null
 * @param {Function} rateLimiter
 * @returns {{ ok: boolean, events?: object[] }}
 */
async function fetchEventsPaginated(userId, afterDate, beforeDate, rateLimiter) {
  const events = [];
  let page = 1;
  const MAX_PAGES = 1000;

  while (page <= MAX_PAGES) {
    await rateLimiter();
    let url = `${GITLAB_BASE_URL}/api/v4/users/${encodeURIComponent(userId)}/events?per_page=100&page=${page}&after=${encodeURIComponent(afterDate)}`;
    if (beforeDate) url += `&before=${encodeURIComponent(beforeDate)}`;

    let res;
    try {
      res = await fetch(url, { headers: buildHeaders(), timeout: 15000 });
    } catch (err) {
      // Network error or timeout — treat as server failure to trigger fallback
      console.warn(`[gitlab] Request failed for user ${userId} (page ${page}): ${err.message}`);
      return { ok: false };
    }

    if (res.status === 500) {
      return { ok: false };
    }

    if (res.status === 429) {
      const retryAfter = Math.min(parseInt(res.headers.get('Retry-After') || '60', 10), 300);
      console.log(`[gitlab] Rate limited, waiting ${retryAfter}s...`);
      await delay(retryAfter * 1000);

      // Retry once
      await rateLimiter();
      const retryRes = await fetch(url, { headers: buildHeaders(), timeout: 15000 });
      if (!retryRes.ok) {
        // Treat as done
        break;
      }
      const retryData = await retryRes.json();
      if (!Array.isArray(retryData) || retryData.length === 0) break;
      events.push(...retryData);
      page++;
      continue;
    }

    if (!res.ok) {
      // 403, 404, etc. — treat as done
      break;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    events.push(...data);
    page++;
  }

  return { ok: true, events };
}

/**
 * Generate contiguous monthly date range chunks from afterDate to today.
 * Each chunk: { after: "YYYY-MM-DD", before: "YYYY-MM-DD" }
 * The last chunk's `before` is tomorrow to avoid missing today's events.
 */
function generateMonthlyChunks(afterDate) {
  const chunks = [];
  const start = new Date(afterDate);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  let current = new Date(start);

  while (current < tomorrow) {
    const next = new Date(current);
    next.setMonth(next.getMonth() + 1);

    const before = next < tomorrow ? next : tomorrow;

    chunks.push({
      after: current.toISOString().slice(0, 10),
      before: before.toISOString().slice(0, 10)
    });

    current = new Date(before);
  }

  return chunks;
}

/**
 * Fetch events in monthly chunks (fallback for 500 errors on large ranges).
 */
async function fetchEventsChunked(userId, afterDate, rateLimiter) {
  const chunks = generateMonthlyChunks(afterDate);
  const allEvents = [];

  for (const chunk of chunks) {
    const result = await fetchEventsPaginated(userId, chunk.after, chunk.before, rateLimiter);
    if (!result.ok) {
      console.warn(`[gitlab] Chunk ${chunk.after}..${chunk.before} returned 500, skipping`);
      continue;
    }
    allEvents.push(...result.events);
  }

  return allEvents;
}

/**
 * Orchestrator: try full fetch first, fall back to chunked on 500.
 */
async function fetchEvents(userId, sinceDate, rateLimiter) {
  const afterDate = sinceDate
    || (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10); })();

  const result = await fetchEventsPaginated(userId, afterDate, null, rateLimiter);
  if (result.ok) return result.events;

  console.log(`[gitlab] Full fetch returned 500 for user ${userId}, falling back to monthly chunks`);
  return fetchEventsChunked(userId, afterDate, rateLimiter);
}

/**
 * Bucket events by month using event.created_at.
 * @param {object[]} events - array of event objects with created_at field
 * @returns {object} { "YYYY-MM": count }
 */
function bucketByMonth(events) {
  const months = {};
  for (const event of events) {
    const monthKey = event.created_at.slice(0, 7);
    months[monthKey] = (months[monthKey] || 0) + 1;
  }
  return months;
}

/**
 * Merge incremental monthly data with existing data.
 * Boundary month (the month containing sinceDate) and newer: replace with fresh.
 * Older months: keep existing counts.
 */
function mergeMonths(existing, fresh, sinceDate) {
  if (!sinceDate) {
    // Full fetch — fresh data replaces everything, but add any existing older months
    return { ...existing, ...fresh };
  }

  const boundary = sinceDate.slice(0, 7);
  const merged = {};

  // Keep existing months that are before the boundary
  for (const [month, count] of Object.entries(existing)) {
    if (month < boundary) {
      merged[month] = count;
    }
  }

  // Add all fresh months (boundary and newer)
  for (const [month, count] of Object.entries(fresh)) {
    merged[month] = count;
  }

  return merged;
}

/**
 * Fetch GitLab data (contributions + history) for a list of usernames.
 *
 * @param {string[]} usernames - GitLab usernames to query
 * @param {object} [options]
 * @param {object} [options.existingData] - existing cached data keyed by username
 * @param {object} [options.userIdCache] - mutable cache of username -> numeric ID
 * @param {number} [options.concurrency] - number of concurrent workers (default 5)
 * @returns {Object} Map of username -> { totalContributions, months, fetchedAt, source } or null
 */
async function fetchGitlabData(usernames, options = {}) {
  const { existingData = {}, userIdCache = {}, concurrency = DEFAULT_CONCURRENCY } = options;
  const rateLimiter = createRateLimiter(MAX_REQUESTS_PER_SEC);

  console.log(`[gitlab] Fetching data for ${usernames.length} users (concurrency: ${concurrency})`);

  const results = {};
  let idx = 0;
  let completed = 0;

  async function worker() {
    while (idx < usernames.length) {
      const i = idx++;
      const username = usernames[i];

      try {
        const userId = await resolveUserId(username, userIdCache, rateLimiter);
        if (!userId) {
          console.log(`[gitlab] ${username}: could not resolve user ID (${++completed}/${usernames.length})`);
          results[username] = null;
          continue;
        }

        // Determine sinceDate — only use incremental if existing data is from events source
        let sinceDate = null;
        const existing = existingData[username];
        if (existing && existing.fetchedAt && existing.source === 'events') {
          sinceDate = existing.fetchedAt.slice(0, 10);
        }

        const events = await fetchEvents(userId, sinceDate, rateLimiter);
        const freshMonths = bucketByMonth(events);

        let months;
        if (sinceDate && existing && existing.months) {
          months = mergeMonths(existing.months, freshMonths, sinceDate);
        } else {
          months = freshMonths;
        }

        const totalContributions = Object.values(months).reduce((a, b) => a + b, 0);
        results[username] = {
          totalContributions,
          months,
          fetchedAt: new Date().toISOString(),
          source: 'events'
        };

        completed++;
        console.log(`[gitlab] ${username}: ${totalContributions} contributions (${completed}/${usernames.length})`);
      } catch (err) {
        console.error(`[gitlab] Error fetching ${username}:`, err.message);
        results[username] = null;
        completed++;
      }
    }
  }

  const workers = [];
  for (let w = 0; w < Math.min(concurrency, usernames.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  return results;
}

module.exports = { fetchGitlabData };
