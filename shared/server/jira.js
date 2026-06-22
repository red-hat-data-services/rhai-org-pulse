const JIRA_HOST = process.env.JIRA_HOST || 'https://redhat.atlassian.net';

/** @deprecated Use createJiraClient() instead */
function getJiraAuth() {
  const token = process.env.JIRA_TOKEN;
  const email = process.env.JIRA_EMAIL;
  if (!token || !email) {
    throw new Error(
      'JIRA_TOKEN and JIRA_EMAIL environment variables must be set.\n' +
      'Set them in a .env file or pass them directly:\n' +
      '  JIRA_EMAIL=you@redhat.com JIRA_TOKEN=your-api-token node server/dev-server.js'
    );
  }
  return Buffer.from(`${email}:${token}`).toString('base64');
}

/** @deprecated Use createJiraClient() instead */
async function jiraRequest(path, { method = 'GET', body } = {}) {
  const auth = getJiraAuth();
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const options = {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
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
      let msg = `Jira API error (${response.status}): ${text}`;
      if (response.status === 401) {
        msg +=
          ' Auth: use a Jira Cloud API token + JIRA_EMAIL in .env (see https://id.atlassian.com/manage-profile/security/api-tokens), then restart the API.';
      }
      throw new Error(msg);
    }

    return response.json();
  }
}

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
 * Fetch all versions from the given Jira projects.
 * Uses the unpaginated /versions endpoint (returns flat array).
 * @param {Function} jiraRequestFn - The jiraRequest function
 * @param {string[]} projects - Jira project keys (e.g., ['RHAISTRAT', 'RHOAIENG'])
 * @returns {Promise<Array<{ name: string, id: string, project: string, released: boolean, archived: boolean, releaseDate: string|null }>>}
 */
async function fetchProjectVersions(jiraRequestFn, projects) {
  const versions = [];

  for (const project of projects) {
    try {
      const data = await jiraRequestFn(
        `/rest/api/3/project/${encodeURIComponent(project)}/versions`
      );
      const arr = Array.isArray(data) ? data : [];

      for (let i = 0; i < arr.length; i++) {
        const v = arr[i];
        const name = String(v.name || '').trim();
        if (!name) continue;
        versions.push({
          name,
          id: String(v.id || ''),
          project,
          released: v.released === true,
          archived: v.archived === true,
          releaseDate: v.releaseDate || null
        });
      }
    } catch (err) {
      console.warn(`[jira] Failed to fetch versions for project ${project}: ${err.message}`);
    }
  }

  return versions;
}

/**
 * Create a Jira API client with bound credentials.
 * @param {{ email: string, token: string, host?: string }} config
 * @returns {{ jiraRequest: Function, fetchAllJqlResults: Function, fetchProjectVersions: Function, JIRA_HOST: string }}
 */
function createJiraClient({ email, token, host }) {
  const jiraHost = host || 'https://redhat.atlassian.net';
  const auth = Buffer.from(`${email}:${token}`).toString('base64');

  async function boundJiraRequest(path, { method = 'GET', body } = {}) {
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const options = {
        method,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      };
      if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
      }
      const response = await fetch(`${jiraHost}${path}`, options);

      if (response.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = parseInt(response.headers.get('retry-after'), 10);
        const delay = (!isNaN(retryAfter) && retryAfter > 0) ? retryAfter * 1000 : Math.pow(2, attempt + 1) * 1000;
        console.warn(`[Jira API] Rate limited (429), retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        let msg = `Jira API error (${response.status}): ${text}`;
        if (response.status === 401) {
          msg +=
            ' Auth: use a Jira Cloud API token + JIRA_EMAIL in .env (see https://id.atlassian.com/manage-profile/security/api-tokens), then restart the API.';
        }
        throw new Error(msg);
      }

      return response.json();
    }
  }

  return {
    jiraRequest: boundJiraRequest,
    JIRA_HOST: jiraHost,
    fetchAllJqlResults: (jql, fields, opts) => fetchAllJqlResults(boundJiraRequest, jql, fields, opts),
    fetchProjectVersions: (projects) => fetchProjectVersions(boundJiraRequest, projects)
  };
}

module.exports = { JIRA_HOST, getJiraAuth, jiraRequest, fetchAllJqlResults, fetchProjectVersions, createJiraClient };
