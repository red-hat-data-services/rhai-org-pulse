const jira = require('../../../../../shared/server/jira');

async function fetchVersions(projects, { jiraFetch } = {}) {
  const request = jiraFetch || jira.jiraRequest;
  const versions = [];

  for (const project of projects) {
    try {
      const data = await request(`/rest/api/3/project/${project}/versions`);

      for (const version of data) {
        if (version.releaseDate) {
          versions.push({
            name: version.name,
            releaseDate: version.releaseDate,
            project: project,
            released: version.released || false
          });
        }
      }
    } catch (error) {
      console.warn(`[releases/quality] Failed to fetch versions for ${project}:`, error.message);
    }
  }

  // Deduplicate versions by name (case-insensitive, keep first occurrence)
  const seen = new Map();
  const deduplicated = [];
  for (const version of versions) {
    const normalizedName = version.name.toLowerCase();
    if (!seen.has(normalizedName)) {
      seen.set(normalizedName, true);
      deduplicated.push(version);
    }
  }

  return deduplicated.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
}

/**
 * Fetch Blocker/Critical/Major bugs with Affects Version
 * @param {string} project - Project key
 * @param {Array} versions - Version objects with release dates
 * @returns {Promise<Array>} - Bug objects
 */
async function fetchBugs(project, versions, { jiraFetchAll } = {}) {
  const fetchAll = jiraFetchAll || jira.fetchAllJqlResults;
  const versionReleaseMap = new Map();
  for (const v of versions) {
    versionReleaseMap.set(v.name, v.releaseDate);
  }

  const jql = `
    project = ${project}
    AND priority in (Blocker, Critical, Major)
    AND issuetype = Bug
    AND affectedVersion is not EMPTY
    AND created >= -730d
    ORDER BY created DESC
  `.trim().replace(/\s+/g, ' ');

  const fields = [
    'summary',
    'priority',
    'issuetype',
    'status',
    'versions',
    'components',
    'created',
    'resolutiondate'
  ].join(',');

  try {
    const issues = await fetchAll(jira.jiraRequest, jql, fields);

    return issues.map(issue => {
      const affectedVersions = (issue.fields.versions || []).map(v => v.name);
      const components = (issue.fields.components || []).map(c => c.name);

      let releaseDate = null;
      for (const vName of affectedVersions) {
        const vDate = versionReleaseMap.get(vName);
        if (vDate && (!releaseDate || vDate < releaseDate)) {
          releaseDate = vDate;
        }
      }

      return {
        key: issue.key,
        summary: issue.fields.summary,
        priority: issue.fields.priority?.name || 'Unknown',
        status: issue.fields.status?.name || 'Unknown',
        affectedVersions,
        components,
        created: issue.fields.created,
        resolved: issue.fields.resolutiondate || null,
        releaseDate
      };
    }).filter(bug =>
      bug.releaseDate && new Date(bug.created) >= new Date(bug.releaseDate)
    );
  } catch (error) {
    console.error(`[releases/quality] Failed to fetch bugs for ${project}:`, error.message);
    return [];
  }
}

module.exports = { fetchVersions, fetchBugs };

