/**
 * Person-level Jira metrics via JQL
 *
 * Fetches resolved and in-progress issues for a given Jira display name,
 * then computes aggregate metrics (counts, story points, cycle time).
 *
 * Supports incremental mode: if existing cached data is provided, only
 * fetches issues resolved since the last fetch and merges with cached data.
 *
 * Compatible with Jira Cloud (v3 search/jql API with cursor pagination).
 */

const STORY_POINTS_FIELD = process.env.JIRA_STORY_POINTS_FIELD || 'customfield_10028';

const FIELDS = `summary,issuetype,status,assignee,resolutiondate,created,components,${STORY_POINTS_FIELD}`;

// Bump this when FIELDS or computed metrics change to invalidate cached data
const FIELDS_VERSION = 'v1';

// Force a full refresh if the last full refresh was more than 7 days ago
const FULL_REFRESH_INTERVAL_DAYS = 7;

/**
 * Fetch paginated JQL results using the v3 search/jql GET API (all pages).
 * Uses nextPageToken cursor-based pagination.
 */
async function fetchAllJqlResults(jiraRequest, jql, fields, { maxResults = 100, expand } = {}) {
  const issues = [];
  let nextPageToken = null;

  while (true) {
    const params = new URLSearchParams({
      jql,
      fields,
      maxResults: String(maxResults)
    });
    if (expand) {
      params.set('expand', expand);
    }
    if (nextPageToken) {
      params.set('nextPageToken', nextPageToken);
    }

    const data = await jiraRequest(`/rest/api/3/search/jql?${params}`);
    if (!data.issues || data.issues.length === 0) break;

    issues.push(...data.issues);

    if (data.isLast !== false) break;
    nextPageToken = data.nextPageToken;
    if (!nextPageToken) break;
  }

  return issues;
}

/**
 * Extract story points from an issue.
 */
function getStoryPoints(issue) {
  const val = issue.fields[STORY_POINTS_FIELD];
  return typeof val === 'number' ? val : 0;
}

/**
 * Build a JQL project filter clause from an array of project keys.
 * Returns empty string if no keys are configured (no filtering).
 */
function buildProjectFilter(projectKeys) {
  if (!projectKeys || projectKeys.length === 0) return '';
  const quoted = projectKeys.map(k => `"${k}"`).join(', ');
  return ` AND project in (${quoted})`;
}

const ACTIVE_STATUSES = ['in progress', 'coding in progress', 'code review', 'review', 'testing'];

/**
 * Find the earliest changelog transition to an active work status.
 * Returns the ISO timestamp of that transition, or null if none found.
 */
function findWorkStartDate(issue) {
  const histories = issue.changelog?.histories;
  if (!Array.isArray(histories)) return null;

  for (const history of histories) {
    for (const item of history.items || []) {
      if (item.field === 'status' && ACTIVE_STATUSES.includes(item.toString?.toLowerCase())) {
        return history.created;
      }
    }
  }
  return null;
}

/**
 * Compute cycle time in days from work start to resolution.
 * Uses the first transition to an active status from the changelog,
 * falling back to issue creation date if no transition is found.
 */
function computeCycleTimeDays(issue) {
  const resolved = issue.fields.resolutiondate;
  if (!resolved) return null;

  const workStart = findWorkStartDate(issue) || issue.fields.created;
  if (!workStart) return null;

  const ms = new Date(resolved).getTime() - new Date(workStart).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

/**
 * Map a raw Jira issue to a compact representation.
 */
function mapIssue(issue) {
  return {
    key: issue.key,
    summary: issue.fields.summary,
    issueType: issue.fields.issuetype?.name,
    status: issue.fields.status?.name,
    storyPoints: getStoryPoints(issue),
    created: issue.fields.created,
    resolutionDate: issue.fields.resolutiondate,
    components: (issue.fields.components || []).map(c => c.name)
  };
}

/**
 * Resolve a roster display name to the Jira Cloud accountId.
 * Uses a cache to avoid repeated lookups. Falls back to null
 * if no match is found (and does NOT cache failures so we retry next time).
 *
 * Resolution order:
 * 1. Email search (most reliable — exact match)
 * 2. Username guess (firstInitial + lastName)
 * 3. Last name only
 * 4. Full display name
 *
 * Cache format: { "Display Name": { accountId: "...", displayName: "..." } }
 */
async function resolveJiraDisplayName(jiraRequest, rosterName, nameCache, email) {
  if (!nameCache) return { accountId: null, displayName: rosterName };

  const cached = nameCache[rosterName];
  if (cached && typeof cached === 'object' && cached.accountId) {
    // If we have an email and the cache was resolved without one (or with a different one),
    // re-resolve to ensure correctness
    if (!email || cached.resolvedViaEmail === email) {
      return cached;
    }
  }

  // Try email search first (most reliable)
  if (email) {
    const resolved = await tryEmailSearch(jiraRequest, email);
    if (resolved) {
      resolved.resolvedViaEmail = email;
      nameCache[rosterName] = resolved;
      return resolved;
    }
  }

  // Search by display name parts
  const parts = rosterName.trim().split(/\s+/);
  const lastName = parts[parts.length - 1];
  const firstInitial = parts[0]?.[0]?.toLowerCase() || '';
  const username = firstInitial + lastName.toLowerCase();

  const resolved = await tryUserSearch(jiraRequest, username, rosterName);
  if (resolved) {
    nameCache[rosterName] = resolved;
    return resolved;
  }

  // Fall back to last-name-only search
  if (username !== lastName.toLowerCase()) {
    const resolved2 = await tryUserSearch(jiraRequest, lastName.toLowerCase(), rosterName);
    if (resolved2) {
      nameCache[rosterName] = resolved2;
      return resolved2;
    }
  }

  // Try full name search
  const resolved3 = await tryUserSearch(jiraRequest, rosterName, rosterName);
  if (resolved3) {
    nameCache[rosterName] = resolved3;
    return resolved3;
  }

  // All lookups failed — return original name, do NOT cache
  return { accountId: null, displayName: rosterName };
}

/**
 * Search for a Jira user by email address. Returns exactly one match or null.
 */
async function tryEmailSearch(jiraRequest, email) {
  try {
    const users = await jiraRequest(`/rest/api/2/user/search?query=${encodeURIComponent(email)}`);
    if (!Array.isArray(users) || users.length === 0) return null;

    // Find exact email match
    const match = users.find(u => u.emailAddress?.toLowerCase() === email.toLowerCase());
    if (match) return { accountId: match.accountId, displayName: match.displayName };

    // If only one result, trust it
    if (users.length === 1) {
      return { accountId: users[0].accountId, displayName: users[0].displayName };
    }

    return null;
  } catch {
    return null;
  }
}

async function tryUserSearch(jiraRequest, query, rosterName) {
  try {
    const users = await jiraRequest(`/rest/api/2/user/search?query=${encodeURIComponent(query)}`);
    if (!Array.isArray(users) || users.length === 0) return null;

    // Extract last name from roster name for matching
    const parts = rosterName.trim().split(/\s+/);
    const lastName = parts[parts.length - 1];

    if (users.length === 1) {
      return { accountId: users[0].accountId, displayName: users[0].displayName };
    }
    // Multiple results — match on last name
    const match = users.find(u =>
      u.displayName?.toLowerCase().endsWith(lastName.toLowerCase())
    );
    if (match) return { accountId: match.accountId, displayName: match.displayName };
    return null;
  } catch {
    return null;
  }
}

/**
 * Compute a stable fingerprint for the project keys config.
 * Used to detect config changes and force full refresh.
 */
function projectKeysFingerprint(projectKeys) {
  if (!projectKeys || projectKeys.length === 0) return '';
  return [...projectKeys].sort().join(',');
}

/**
 * Determine whether a full refresh is needed instead of incremental.
 */
function needsFullRefresh(existingData, projectKeys) {
  if (!existingData) return true;
  if (!existingData.fetchedAt) return true;
  if (existingData.fieldsVersion !== FIELDS_VERSION) return true;

  // Force full refresh if project filter config changed
  const currentFingerprint = projectKeysFingerprint(projectKeys);
  if ((existingData.projectKeysFingerprint || '') !== currentFingerprint) return true;

  // Force full refresh if last full refresh was too long ago
  const lastFull = existingData.lastFullRefreshAt || existingData.fetchedAt;
  const daysSinceFullRefresh = (Date.now() - new Date(lastFull).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceFullRefresh >= FULL_REFRESH_INTERVAL_DAYS) return true;

  return false;
}

/**
 * Merge freshly fetched resolved issues with existing cached issues.
 * - Matches by issue key: fresh data replaces existing for the same key
 * - Adds new issues not in the existing set
 * - Removes issues older than the lookback window
 */
function mergeResolvedIssues(existingIssues, freshIssues, lookbackDays) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);
  const cutoffMs = cutoff.getTime();

  // Build map from existing, keyed by issue key
  const issueMap = {};
  for (const issue of existingIssues) {
    issueMap[issue.key] = issue;
  }

  // Merge fresh issues (replace or add)
  for (const issue of freshIssues) {
    issueMap[issue.key] = issue;
  }

  // Filter out issues older than the lookback window
  return Object.values(issueMap).filter(issue => {
    if (!issue.resolutionDate) return true;
    return new Date(issue.resolutionDate).getTime() >= cutoffMs;
  });
}

/**
 * Verify that existing cached issues still belong to this person and are still resolved.
 * Returns the set of issue keys that are still valid.
 */
async function verifyExistingIssues(jiraRequest, accountId, issueKeys, projectFilter = '') {
  if (issueKeys.length === 0) return new Set();

  // JQL has a limit on IN clause size; batch if needed
  const BATCH_SIZE = 100;
  const validKeys = new Set();

  for (let i = 0; i < issueKeys.length; i += BATCH_SIZE) {
    const batch = issueKeys.slice(i, i + BATCH_SIZE);
    const keyList = batch.map(k => `"${k}"`).join(', ');
    const jql = `key in (${keyList}) AND assignee = "${accountId}" AND resolved is not EMPTY${projectFilter}`;

    try {
      const issues = await fetchAllJqlResults(jiraRequest, jql, 'key');
      for (const issue of issues) {
        validKeys.add(issue.key);
      }
    } catch (err) {
      // If verification fails, keep all existing issues rather than losing data
      console.warn(`[jira] Verification query failed, keeping existing issues: ${err.message}`);
      for (const key of batch) {
        validKeys.add(key);
      }
    }
  }

  return validKeys;
}

/**
 * Compute aggregate metrics from a list of mapped resolved issues.
 */
function computeAggregates(resolvedMapped) {
  const resolvedPoints = resolvedMapped.reduce((sum, i) => sum + (i.storyPoints || 0), 0);
  const cycleTimes = resolvedMapped
    .map(i => i.cycleTimeDays)
    .filter(d => d !== null && d >= 0);

  let avgDays = null;
  let medianDays = null;

  if (cycleTimes.length > 0) {
    avgDays = +(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length).toFixed(1);
    const sorted = [...cycleTimes].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    medianDays = sorted.length % 2 === 0
      ? +((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1)
      : +sorted[mid].toFixed(1);
  }

  return { resolvedPoints, avgDays, medianDays };
}

/**
 * Fetch individual person metrics from Jira.
 *
 * @param {Function} jiraRequest - The authenticated Jira HTTP request function
 * @param {string} jiraDisplayName - Exact Jira display name (from roster)
 * @param {object} [options]
 * @param {number} [options.lookbackDays=365] - How far back to look for resolved issues
 * @param {object} [options.nameCache] - Mutable name resolution cache
 * @param {object} [options.existingData] - Cached person metrics for incremental refresh
 * @param {string} [options.email] - Email address for more reliable Jira user lookup
 * @param {string[]} [options.projectKeys] - Jira project keys to filter by
 * @returns {Promise<object>} Person metrics object
 */
async function fetchPersonMetrics(jiraRequest, jiraDisplayName, options = {}) {
  const lookbackDays = options.lookbackDays || 365;
  const nameCache = options.nameCache || null;
  const existingData = options.existingData || null;
  const email = options.email || null;
  const projectFilter = buildProjectFilter(options.projectKeys);

  // Resolve the roster name to the Jira Cloud accountId
  const resolved = await resolveJiraDisplayName(jiraRequest, jiraDisplayName, nameCache, email);
  const accountId = resolved.accountId;
  const resolvedDisplayName = resolved.displayName;

  if (!accountId) {
    return {
      jiraDisplayName,
      fetchedAt: new Date().toISOString(),
      fieldsVersion: FIELDS_VERSION,
      lookbackDays,
      resolved: { count: 0, storyPoints: 0, issues: [] },
      inProgress: { count: 0, storyPoints: 0, issues: [] },
      cycleTime: { avgDays: null, medianDays: null },
      _nameNotFound: true,
      _error: `Could not resolve Jira accountId for "${jiraDisplayName}"`
    };
  }

  const isIncremental = !needsFullRefresh(existingData, options.projectKeys);
  const now = new Date().toISOString();
  const pkFingerprint = projectKeysFingerprint(options.projectKeys);

  // Always fetch in-progress fresh (represents current state)
  const inProgressJql = `assignee = "${accountId}" AND status in ("In Progress", "Code Review", "Review", "Coding In Progress", "Testing", "Refinement", "Planning") AND issuetype in (Story, Bug, Task, Vulnerability, Weakness)${projectFilter}`;

  let resolvedMapped;

  if (isIncremental) {
    // Incremental: only fetch issues resolved since last fetch (minus 1-day buffer)
    const sinceDate = new Date(existingData.fetchedAt);
    sinceDate.setDate(sinceDate.getDate() - 1);
    const sinceDateStr = sinceDate.toISOString().slice(0, 10);

    const resolvedJql = `assignee = "${accountId}" AND resolved >= "${sinceDateStr}" AND issuetype in (Story, Bug, Task, Vulnerability, Weakness)${projectFilter}`;

    const [freshResolvedIssues, inProgressIssues] = await Promise.all([
      fetchAllJqlResults(jiraRequest, resolvedJql, FIELDS, { expand: 'changelog' }),
      fetchAllJqlResults(jiraRequest, inProgressJql, FIELDS)
    ]);

    const freshMapped = freshResolvedIssues.map(issue => ({
      ...mapIssue(issue),
      cycleTimeDays: computeCycleTimeDays(issue)
    }));

    // Merge with existing
    const merged = mergeResolvedIssues(existingData.resolved?.issues || [], freshMapped, lookbackDays);

    // Verify existing issues are still valid (not reassigned or reopened)
    const existingKeys = (existingData.resolved?.issues || []).map(i => i.key);
    const freshKeys = new Set(freshMapped.map(i => i.key));
    const keysToVerify = existingKeys.filter(k => !freshKeys.has(k));

    if (keysToVerify.length > 0) {
      const validKeys = await verifyExistingIssues(jiraRequest, accountId, keysToVerify, projectFilter);
      resolvedMapped = merged.filter(i => freshKeys.has(i.key) || validKeys.has(i.key));
    } else {
      resolvedMapped = merged;
    }

    const inProgressMapped = inProgressIssues.map(mapIssue);
    const inProgressPoints = inProgressIssues.reduce((sum, i) => sum + getStoryPoints(i), 0);
    const { resolvedPoints, avgDays, medianDays } = computeAggregates(resolvedMapped);

    const result = {
      jiraDisplayName,
      jiraAccountId: accountId,
      fetchedAt: now,
      fieldsVersion: FIELDS_VERSION,
      projectKeysFingerprint: pkFingerprint,
      lastFullRefreshAt: existingData.lastFullRefreshAt || existingData.fetchedAt,
      lookbackDays,
      resolved: {
        count: resolvedMapped.length,
        storyPoints: resolvedPoints,
        issues: resolvedMapped
      },
      inProgress: {
        count: inProgressMapped.length,
        storyPoints: inProgressPoints,
        issues: inProgressMapped
      },
      cycleTime: { avgDays, medianDays }
    };

    if (resolvedDisplayName !== jiraDisplayName) {
      result._resolvedName = resolvedDisplayName;
    }

    console.log(`[jira] ${jiraDisplayName}: incremental refresh (${freshMapped.length} new, ${resolvedMapped.length} total resolved)`);
    return result;
  }

  // Full refresh
  const resolvedJql = `assignee = "${accountId}" AND resolved >= -${lookbackDays}d AND issuetype in (Story, Bug, Task, Vulnerability, Weakness)${projectFilter}`;

  const [resolvedIssues, inProgressIssues] = await Promise.all([
    fetchAllJqlResults(jiraRequest, resolvedJql, FIELDS, { expand: 'changelog' }),
    fetchAllJqlResults(jiraRequest, inProgressJql, FIELDS)
  ]);

  resolvedMapped = resolvedIssues.map(issue => ({
    ...mapIssue(issue),
    cycleTimeDays: computeCycleTimeDays(issue)
  }));

  const inProgressMapped = inProgressIssues.map(mapIssue);
  const inProgressPoints = inProgressIssues.reduce((sum, i) => sum + getStoryPoints(i), 0);
  const { resolvedPoints, avgDays, medianDays } = computeAggregates(resolvedMapped);

  const result = {
    jiraDisplayName,
    jiraAccountId: accountId,
    fetchedAt: now,
    fieldsVersion: FIELDS_VERSION,
    projectKeysFingerprint: pkFingerprint,
    lastFullRefreshAt: now,
    lookbackDays,
    resolved: {
      count: resolvedMapped.length,
      storyPoints: resolvedPoints,
      issues: resolvedMapped
    },
    inProgress: {
      count: inProgressMapped.length,
      storyPoints: inProgressPoints,
      issues: inProgressMapped
    },
    cycleTime: { avgDays, medianDays }
  };

  if (resolvedDisplayName !== jiraDisplayName) {
    result._resolvedName = resolvedDisplayName;
  }

  return result;
}

module.exports = {
  fetchPersonMetrics,
  buildProjectFilter,
  projectKeysFingerprint,
  computeCycleTimeDays,
  findWorkStartDate,
  resolveJiraDisplayName,
  mergeResolvedIssues,
  needsFullRefresh,
  FIELDS_VERSION
};
