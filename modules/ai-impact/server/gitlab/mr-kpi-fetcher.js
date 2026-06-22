const { resolveGitlabToken } = require('../mr-status');

let _fetch = globalThis.fetch;

const MR_KPI_SOURCES = [
  {
    host: 'https://gitlab.cee.redhat.com',
    project: 'documentation-red-hat-openshift-data-science-documentation/openshift-ai-documentation',
    labels: ['ai1st-jira-contributed']
  }
];

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 200;

async function listMergeRequests(host, project, label, token) {
  const encodedProject = encodeURIComponent(project);
  const encodedLabel = encodeURIComponent(label);
  const allMrs = [];
  let page = 1;

  while (true) {
    const url = `${host}/api/v4/projects/${encodedProject}/merge_requests?labels=${encodedLabel}&state=all&per_page=100&page=${page}`;
    const res = await _fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        console.warn(`[ai-impact/mr-kpi] Auth failed for ${host} (${res.status})`);
      }
      throw new Error(`GitLab API returned ${res.status} for ${host}/${project}`);
    }

    const mrs = await res.json();
    if (mrs.length === 0) break;

    for (const mr of mrs) {
      allMrs.push({
        iid: mr.iid,
        title: mr.title,
        state: mr.state === 'opened' ? 'opened' : mr.state,
        createdAt: mr.created_at,
        mergedAt: mr.merged_at || null,
        author: mr.author?.username || null,
        webUrl: mr.web_url,
        commentCount: mr.user_notes_count || 0,
        sourceProject: project,
        sourceHost: host
      });
    }

    if (mrs.length < 100) break;
    page++;
  }

  return allMrs;
}

async function fetchCommitCount(host, project, iid, token) {
  const encodedProject = encodeURIComponent(project);
  const url = `${host}/api/v4/projects/${encodedProject}/merge_requests/${iid}/commits?per_page=100`;

  try {
    const res = await _fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const commits = await res.json();
    return commits.length;
  } catch (err) {
    console.warn(`[ai-impact/mr-kpi] Failed to fetch commits for MR !${iid}: ${err.message}`);
    return null;
  }
}

const BOT_USERNAMES = [
  'cp-ops-service',
  'project_82936_bot_de8f25c2e1ca1c33b2b507874163e1c7'
];

function isBotAuthor(username) {
  if (!username) return true;
  return BOT_USERNAMES.includes(username);
}

async function fetchFirstReviewAt(host, project, iid, token) {
  const encodedProject = encodeURIComponent(project);
  const url = `${host}/api/v4/projects/${encodedProject}/merge_requests/${iid}/notes?sort=asc&per_page=20`;

  try {
    const res = await _fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const notes = await res.json();
    const humanNote = notes.find(n => !n.system && !isBotAuthor(n.author?.username));
    return humanNote?.created_at || null;
  } catch (err) {
    console.warn(`[ai-impact/mr-kpi] Failed to fetch notes for MR !${iid}: ${err.message}`);
    return null;
  }
}

async function enrichMrDetails(mrs, host, project, token) {
  const tasks = mrs.map(mr => ({
    mr,
    fetchCommits: true,
    fetchFirstReview: mr.commentCount > 0
  }));

  for (let i = 0; i < tasks.length; i += BATCH_SIZE) {
    const batch = tasks.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(batch.map(async ({ mr, fetchCommits, fetchFirstReview }) => {
      const [commitCount, firstReviewAt] = await Promise.all([
        fetchCommits ? fetchCommitCount(host, project, mr.iid, token) : Promise.resolve(null),
        fetchFirstReview ? fetchFirstReviewAt(host, project, mr.iid, token) : Promise.resolve(null)
      ]);
      return { iid: mr.iid, commitCount, firstReviewAt };
    }));

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const mr = mrs.find(m => m.iid === result.value.iid);
        if (mr) {
          if (result.value.commitCount !== null) mr.commitCount = result.value.commitCount;
          if (result.value.firstReviewAt !== null) mr.firstReviewAt = result.value.firstReviewAt;
        }
      }
    }

    if (i + BATCH_SIZE < tasks.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }
}

/**
 * Fetch MR KPI data directly from GitLab (no Jira dependency).
 * Queries all configured projects/labels and returns enriched MR objects.
 */
async function fetchMrKpiData() {
  const allMrs = [];
  const seen = new Set();

  for (const source of MR_KPI_SOURCES) {
    const token = resolveGitlabToken(source.host);
    if (!token) {
      console.warn(`[ai-impact/mr-kpi] No token for ${source.host}, skipping`);
      continue;
    }

    for (const label of source.labels) {
      console.log(`[ai-impact/mr-kpi] Fetching MRs from ${source.host}/${source.project} with label "${label}"`);

      const mrs = await listMergeRequests(source.host, source.project, label, token);
      console.log(`[ai-impact/mr-kpi] Found ${mrs.length} MRs with label "${label}"`);

      // Deduplicate across labels
      const newMrs = [];
      for (const mr of mrs) {
        const key = `${mr.sourceHost}|${mr.sourceProject}|${mr.iid}`;
        if (!seen.has(key)) {
          seen.add(key);
          mr.commitCount = 1;
          mr.firstReviewAt = null;
          newMrs.push(mr);
        }
      }

      await enrichMrDetails(newMrs, source.host, source.project, token);
      allMrs.push(...newMrs);
    }
  }

  return { mergeRequests: allMrs };
}

module.exports = {
  fetchMrKpiData,
  MR_KPI_SOURCES,
  _setFetch(fn) { _fetch = fn; }
};
