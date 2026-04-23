/**
 * Jira RFE (Feature Request) backlog queries.
 * Fetches open Feature Requests per Jira component.
 */

const fetch = require('node-fetch');

function getJiraAuth() {
  const token = process.env.JIRA_TOKEN;
  const email = process.env.JIRA_EMAIL;
  if (!token || !email) {
    throw new Error('JIRA_TOKEN and JIRA_EMAIL environment variables must be set.');
  }
  return Buffer.from(`${email}:${token}`).toString('base64');
}

async function jiraRequest(path) {
  const auth = getJiraAuth();
  const host = process.env.JIRA_HOST || 'https://redhat.atlassian.net';
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(`${host}${path}`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = parseInt(response.headers.get('retry-after'), 10);
      const delay = (!isNaN(retryAfter) && retryAfter > 0) ? retryAfter * 1000 : Math.pow(2, attempt + 1) * 1000;
      console.warn(`[org-roster rfe] Rate limited, retrying in ${delay / 1000}s`);
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

/**
 * Fetch all open RFE issues for a single Jira component.
 * Returns { count, issues: [{ key, summary, status, priority, created, components }] }
 */
async function fetchRfeForComponent(component, options = {}) {
  const project = options.jiraProject || 'RHAIRFE';
  const issueType = options.rfeIssueType || 'Feature Request';
  const escaped = component.replace(/"/g, '\\"');
  const jql = `project = ${project} AND component = "${escaped}" AND issuetype = "${issueType}" AND statusCategory != "Done"`;

  try {
    const issues = [];
    let nextPageToken = null;
    let page = 0;
    while (true) {
      const params = new URLSearchParams({
        jql,
        fields: 'summary,status,priority,created,components',
        maxResults: '100'
      });
      if (nextPageToken) params.set('nextPageToken', nextPageToken);
      const data = await jiraRequest(`/rest/api/3/search/jql?${params}`);
      const pageIssues = data.issues || [];
      page++;

      if (page === 1 && pageIssues.length === 0) {
        console.log(`[org-roster rfe] "${component}": 0 issues`);
      } else if (page === 1) {
        console.log(`[org-roster rfe] "${component}": fetching page ${page} (${pageIssues.length} issues)${data.isLast === false ? ', more pages...' : ''}`);
      } else {
        console.log(`[org-roster rfe] "${component}": page ${page} (+${pageIssues.length} issues)`);
      }

      for (const issue of pageIssues) {
        issues.push({
          key: issue.key,
          summary: issue.fields?.summary || '',
          status: issue.fields?.status?.name || '',
          statusCategory: issue.fields?.status?.statusCategory?.name || '',
          priority: issue.fields?.priority?.name || '',
          created: issue.fields?.created || '',
          components: (issue.fields?.components || []).map(c => c.name)
        });
      }

      if (data.isLast !== false || !data.nextPageToken) break;
      nextPageToken = data.nextPageToken;
    }
    console.log(`[org-roster rfe] "${component}": done — ${issues.length} total issues`);
    return { count: issues.length, issues };
  } catch (err) {
    console.warn(`[org-roster rfe] "${component}": FAILED — ${err.message}`);
    return { count: 0, issues: [], error: err.message };
  }
}

/**
 * Fetch RFE backlog for all components.
 * Batches requests with delays to avoid rate limiting.
 */
async function fetchAllRfeBacklog(components, teams, options = {}) {
  const BATCH_SIZE = 5;
  const BATCH_DELAY = 1000;
  const componentMapping = options.componentMapping || {};

  const byComponent = {};
  const componentList = [...new Set(components)];
  const mappedCount = Object.keys(componentMapping).length;

  console.log(`[org-roster rfe] Starting RFE sync for ${componentList.length} components (${mappedCount} mapped to Jira names)`);

  for (let i = 0; i < componentList.length; i += BATCH_SIZE) {
    const batch = componentList.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(componentList.length / BATCH_SIZE);
    console.log(`[org-roster rfe] Batch ${batchNum}/${totalBatches}: ${batch.join(', ')}`);

    const results = await Promise.all(
      batch.map(async (comp) => {
        const jiraComp = componentMapping[comp] || comp;
        if (jiraComp !== comp) {
          console.log(`[org-roster rfe] Mapping "${comp}" → "${jiraComp}"`);
        }
        const result = await fetchRfeForComponent(jiraComp, options);
        return { component: comp, ...result };
      })
    );

    for (const result of results) {
      byComponent[result.component] = {
        count: result.count,
        issues: result.issues,
        error: result.error || null
      };
    }

    if (i + BATCH_SIZE < componentList.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  // Aggregate by team
  const byTeam = {};
  let totalIssues = 0;
  let errorCount = 0;
  for (const [, val] of Object.entries(byComponent)) {
    totalIssues += val.count;
    if (val.error) errorCount++;
  }
  console.log(`[org-roster rfe] Component fetch complete: ${totalIssues} total issues across ${componentList.length} components (${errorCount} errors)`);

  if (teams) {
    for (const team of teams) {
      const teamKey = `${team.org}::${team.name}`;
      const teamIssues = [];
      const seenKeys = new Set();
      for (const comp of (team.components || [])) {
        if (byComponent[comp]) {
          for (const issue of byComponent[comp].issues) {
            if (!seenKeys.has(issue.key)) {
              seenKeys.add(issue.key);
              teamIssues.push(issue);
            }
          }
        }
      }
      byTeam[teamKey] = { count: teamIssues.length, issues: teamIssues };
    }
    console.log(`[org-roster rfe] Aggregated RFEs for ${Object.keys(byTeam).length} teams`);
  }

  return { byComponent, byTeam };
}

module.exports = {
  fetchRfeForComponent,
  fetchAllRfeBacklog
};
