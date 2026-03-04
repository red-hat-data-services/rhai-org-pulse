/**
 * Person-level Jira metrics via JQL
 *
 * Fetches resolved and in-progress issues for a given Jira display name,
 * then computes aggregate metrics (counts, story points, cycle time).
 */

const STORY_POINTS_FIELD = process.env.JIRA_STORY_POINTS_FIELD || 'customfield_12310243';

const FIELDS = `summary,issuetype,status,assignee,resolutiondate,created,components,${STORY_POINTS_FIELD}`;

/**
 * Fetch paginated JQL results (all pages).
 */
async function fetchAllJqlResults(jiraRequest, jql, fields, { maxResults = 100, expand } = {}) {
  const issues = [];
  let startAt = 0;

  while (true) {
    const params = new URLSearchParams({
      jql,
      fields,
      startAt: String(startAt),
      maxResults: String(maxResults)
    });
    if (expand) {
      params.set('expand', expand);
    }

    const data = await jiraRequest(`/rest/api/2/search?${params}`);
    if (!data.issues || data.issues.length === 0) break;

    issues.push(...data.issues);
    startAt += data.issues.length;

    if (startAt >= data.total) break;
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
 * Resolve a roster display name to the actual Jira display name.
 * Uses a cache to avoid repeated lookups. Falls back to the original name
 * if no match is found (and does NOT cache failures so we retry next time).
 */
async function resolveJiraDisplayName(jiraRequest, rosterName, nameCache) {
  if (!nameCache) return rosterName;

  if (rosterName in nameCache) {
    return nameCache[rosterName];
  }

  const escaped = rosterName.replace(/"/g, '\\"');

  // Step 1: check if the roster name works directly
  const checkParams = new URLSearchParams({
    jql: `project = RHOAIENG AND assignee = "${escaped}" AND updated >= -365d`,
    fields: 'summary',
    maxResults: '1'
  });
  try {
    const check = await jiraRequest(`/rest/api/2/search?${checkParams}`);
    if (check.total > 0) {
      nameCache[rosterName] = rosterName;
      return rosterName;
    }
  } catch (err) {
    // If the check itself fails, fall through to user search
  }

  // Step 2: user search by first-initial + last-name
  const parts = rosterName.trim().split(/\s+/);
  const lastName = parts[parts.length - 1];
  const firstInitial = parts[0]?.[0]?.toLowerCase() || '';
  const username = firstInitial + lastName.toLowerCase();

  const resolved = await tryUserSearch(jiraRequest, username, lastName);
  if (resolved) {
    nameCache[rosterName] = resolved;
    return resolved;
  }

  // Step 3: fall back to last-name-only search
  if (username !== lastName.toLowerCase()) {
    const resolved2 = await tryUserSearch(jiraRequest, lastName.toLowerCase(), lastName);
    if (resolved2) {
      nameCache[rosterName] = resolved2;
      return resolved2;
    }
  }

  // All lookups failed — return original name, do NOT cache
  return rosterName;
}

async function tryUserSearch(jiraRequest, query, lastName) {
  try {
    const users = await jiraRequest(`/rest/api/2/user/search?username=${encodeURIComponent(query)}`);
    if (!Array.isArray(users) || users.length === 0) return null;
    if (users.length === 1) return users[0].displayName;
    // Multiple results — match on last name
    const match = users.find(u =>
      u.displayName?.toLowerCase().endsWith(lastName.toLowerCase())
    );
    return match?.displayName || null;
  } catch (err) {
    return null;
  }
}

/**
 * Fetch individual person metrics from Jira.
 *
 * @param {Function} jiraRequest - The authenticated Jira HTTP request function
 * @param {string} jiraDisplayName - Exact Jira display name (from roster)
 * @param {object} [options]
 * @param {number} [options.lookbackDays=90] - How far back to look for resolved issues
 * @param {object} [options.nameCache] - Mutable name resolution cache
 * @returns {Promise<object>} Person metrics object
 */
async function fetchPersonMetrics(jiraRequest, jiraDisplayName, options = {}) {
  const lookbackDays = options.lookbackDays || 90;
  const nameCache = options.nameCache || null;

  // Resolve the roster name to the actual Jira display name
  const resolvedName = await resolveJiraDisplayName(jiraRequest, jiraDisplayName, nameCache);

  // Escape the name for JQL (double-quote wrapping handles apostrophes)
  const escapedName = resolvedName.replace(/"/g, '\\"');

  const resolvedJql = `project = RHOAIENG AND assignee = "${escapedName}" AND resolved >= -${lookbackDays}d AND issuetype in (Story, Bug, Task, Vulnerability, Weakness)`;
  const inProgressJql = `project = RHOAIENG AND assignee = "${escapedName}" AND status in ("In Progress", "Code Review", "Review", "Coding In Progress", "Testing", "Refinement", "Planning") AND issuetype in (Story, Bug, Task, Vulnerability, Weakness)`;

  const [resolvedIssues, inProgressIssues] = await Promise.all([
    fetchAllJqlResults(jiraRequest, resolvedJql, FIELDS, { expand: 'changelog' }),
    fetchAllJqlResults(jiraRequest, inProgressJql, FIELDS)
  ]);

  // Compute resolved metrics
  const resolvedMapped = resolvedIssues.map(issue => ({
    ...mapIssue(issue),
    cycleTimeDays: computeCycleTimeDays(issue)
  }));
  const resolvedPoints = resolvedIssues.reduce((sum, i) => sum + getStoryPoints(i), 0);

  // Compute in-progress metrics
  const inProgressMapped = inProgressIssues.map(mapIssue);
  const inProgressPoints = inProgressIssues.reduce((sum, i) => sum + getStoryPoints(i), 0);

  // Compute cycle time for resolved issues
  const cycleTimes = resolvedIssues
    .map(computeCycleTimeDays)
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

  const result = {
    jiraDisplayName,
    fetchedAt: new Date().toISOString(),
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
    cycleTime: {
      avgDays,
      medianDays
    }
  };

  if (resolvedName !== jiraDisplayName) {
    result._resolvedName = resolvedName;
  }

  return result;
}

module.exports = { fetchPersonMetrics, computeCycleTimeDays, findWorkStartDate, resolveJiraDisplayName };
