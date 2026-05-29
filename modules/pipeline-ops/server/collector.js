const fetch = require('node-fetch');

const RATE_LIMIT_DELAY = 500;

function resolveToken(pipeline) {
  const url = pipeline.repo?.url || '';
  const platform = pipeline.repo?.platform;

  if (platform === 'github') {
    return process.env.GITHUB_TOKEN || null;
  }

  try {
    const hostname = new URL(url).hostname;
    if (hostname === 'gitlab.cee.redhat.com') {
      return process.env.GITLAB_TOKEN_INTERNAL || process.env.GITLAB_CEE_REDHAT_DOCS_TOKEN || process.env.GITLAB_TOKEN || null;
    }
  } catch { /* invalid URL */ }

  return process.env.GITLAB_TOKEN || null;
}

function extractRepoPath(repoUrl) {
  try {
    const u = new URL(repoUrl);
    return u.pathname.replace(/^\//, '').replace(/\.git$/, '');
  } catch {
    return null;
  }
}

function extractGitlabHost(repoUrl) {
  try {
    const u = new URL(repoUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'https://gitlab.com';
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const GITLAB_STATUS_MAP = {
  success: 'success',
  failed: 'failed',
  canceled: 'canceled',
  skipped: 'skipped',
  running: 'running',
  pending: 'pending',
  created: 'pending',
  manual: 'pending',
};

const GITHUB_CONCLUSION_MAP = {
  success: 'success',
  failure: 'failed',
  cancelled: 'canceled',
  skipped: 'skipped',
  timed_out: 'failed',
  action_required: 'pending',
};

async function resolveGitlabProject(pipeline, token) {
  const repoPath = extractRepoPath(pipeline.repo.url);
  if (!repoPath) throw new Error('Invalid repo URL');

  const host = extractGitlabHost(pipeline.repo.url);
  const encodedPath = encodeURIComponent(repoPath);
  const projectUrl = `${host}/api/v4/projects/${encodedPath}`;
  const authHeaders = { 'Authorization': `Bearer ${token}` };

  const projectRes = await fetch(projectUrl, { headers: authHeaders, timeout: 30000 });
  if (!projectRes.ok) {
    const status = projectRes.status;
    const label = status === 401 ? 'auth failed' : status === 403 ? 'access denied' : status === 404 ? 'repo not found' : `HTTP ${status}`;
    throw new Error(`GitLab project ${label} (${status})`);
  }
  const project = await projectRes.json();
  return { projectId: project.id, host, authHeaders };
}

function mapGitlabJob(pl, j) {
  let queuedSeconds = null;
  if (j.started_at && j.created_at) {
    queuedSeconds = Math.round(
      (new Date(j.started_at).getTime() - new Date(j.created_at).getTime()) / 1000
    );
  }
  return {
    id: `${pl.id}-${j.id}`,
    job: j.name,
    createdAt: j.created_at,
    startedAt: j.started_at || null,
    finishedAt: j.finished_at || null,
    durationSeconds: j.duration ? Math.round(j.duration) : null,
    queuedSeconds,
    runnerTags: j.tag_list || [],
    status: GITLAB_STATUS_MAP[j.status] || j.status,
    ref: pl.ref,
    webUrl: j.web_url || pl.web_url,
    source: pl.source || 'push',
  };
}

async function fetchPipelineJobs(projectId, pipelineId, host, authHeaders) {
  const jobsRes = await fetch(
    `${host}/api/v4/projects/${projectId}/pipelines/${pipelineId}/jobs?per_page=100`,
    { headers: authHeaders, timeout: 30000 }
  );
  if (!jobsRes.ok) return [];
  return jobsRes.json();
}

function matchesJobFilter(jobName, filters) {
  if (!filters || filters.length === 0) return true;
  return filters.some(function(pattern) {
    if (pattern.endsWith('*')) {
      return jobName.startsWith(pattern.slice(0, -1));
    }
    return jobName === pattern;
  });
}

const SKIP_STATUSES_TOP = ['manual', 'created', 'pending', 'running', 'preparing'];
const SKIP_STATUSES_CHILD = ['manual', 'created', 'pending', 'preparing'];

async function fetchGitlabRuns(pipeline, token) {
  const { projectId, host, authHeaders } = await resolveGitlabProject(pipeline, token);

  await sleep(RATE_LIMIT_DELAY);

  const pipelinesUrl = `${host}/api/v4/projects/${projectId}/pipelines?per_page=20&order_by=updated_at`;
  const pipelinesRes = await fetch(pipelinesUrl, { headers: authHeaders, timeout: 30000 });
  if (!pipelinesRes.ok) {
    throw new Error(`GitLab pipelines fetch failed (${pipelinesRes.status})`);
  }
  const pipelinesData = await pipelinesRes.json();

  await sleep(RATE_LIMIT_DELAY);

  let childPipelines = [];
  try {
    const childRes = await fetch(
      `${host}/api/v4/projects/${projectId}/pipelines?per_page=20&order_by=updated_at&source=parent_pipeline`,
      { headers: authHeaders, timeout: 30000 }
    );
    if (childRes.ok) {
      childPipelines = await childRes.json();
    }
  } catch { /* best-effort */ }

  const topLevelIds = new Set(pipelinesData.map(p => p.id));
  const childOnly = childPipelines.filter(p => !topLevelIds.has(p.id));
  const allPipelines = [
    ...pipelinesData.map(p => ({ ...p, _isChild: false })),
    ...childOnly.map(p => ({ ...p, _isChild: true })),
  ];

  const jobFilters = pipeline.jobPatterns || pipeline.jobs || [];
  const allRuns = [];
  const queue = { waiting: 0, runnerTags: [], oldestWaitingSince: null };
  const tagSet = new Set();

  for (const pl of allPipelines) {
    await sleep(RATE_LIMIT_DELAY);

    let jobs;
    try {
      jobs = await fetchPipelineJobs(projectId, pl.id, host, authHeaders);
    } catch {
      continue;
    }

    const skipStatuses = pl._isChild ? SKIP_STATUSES_CHILD : SKIP_STATUSES_TOP;

    for (const j of jobs) {
      if (jobFilters.length > 0 && !matchesJobFilter(j.name, jobFilters)) continue;

      if (j.status === 'waiting_for_resource') {
        queue.waiting++;
        for (const tag of j.tag_list || []) tagSet.add(tag);
        if (!queue.oldestWaitingSince || j.created_at < queue.oldestWaitingSince) {
          queue.oldestWaitingSince = j.created_at;
        }
        allRuns.push(mapGitlabJob(pl, j));
        continue;
      }

      if (j.status === 'running') {
        allRuns.push(mapGitlabJob(pl, j));
        continue;
      }

      if (skipStatuses.includes(j.status)) continue;

      allRuns.push(mapGitlabJob(pl, j));
    }
  }

  queue.runnerTags = [...tagSet];
  return { runs: allRuns, queue };
}

function cronToIntervalMinutes(cron) {
  if (!cron) return null;
  const parts = cron.split(/\s+/);
  if (parts.length < 5) return null;
  const [minute, hour, dom, month] = parts;
  if (minute.startsWith('*/') && hour === '*' && dom === '*' && month === '*') {
    return parseInt(minute.slice(2), 10);
  }
  if (hour === '*' && dom === '*' && month === '*' && !minute.includes('/')) {
    return 60;
  }
  if (hour.startsWith('*/') && dom === '*' && month === '*') {
    return parseInt(hour.slice(2), 10) * 60;
  }
  if (hour !== '*' && dom === '*' && month === '*') {
    const hours = hour.split(',');
    if (hours.length >= 2) {
      return Math.round(1440 / hours.length);
    }
    return 1440;
  }
  return null;
}

async function fetchGitlabSchedules(projectId, host, authHeaders) {
  try {
    const res = await fetch(
      `${host}/api/v4/projects/${projectId}/pipeline_schedules`,
      { headers: authHeaders, timeout: 30000 }
    );
    if (!res.ok) return [];
    const schedules = await res.json();
    return schedules
      .filter(s => s.active)
      .map(s => ({
        cron: s.cron,
        description: s.description || '',
        expectedIntervalMinutes: cronToIntervalMinutes(s.cron),
      }));
  } catch {
    return [];
  }
}

async function fetchGithubRuns(pipeline, token) {
  const repoPath = extractRepoPath(pipeline.repo.url);
  if (!repoPath) return [];

  const url = `https://api.github.com/repos/${repoPath}/actions/runs?per_page=20`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github+json',
    },
    timeout: 30000,
  });
  if (!res.ok) {
    const status = res.status;
    const label = status === 401 ? 'auth failed' : status === 403 ? 'access denied' : status === 404 ? 'repo not found' : `HTTP ${status}`;
    throw new Error(`GitHub ${label} (${status})`);
  }
  const data = await res.json();
  const runs = data.workflow_runs || [];

  const mapped = runs
    .filter(r => r.status === 'completed')
    .map(r => {
      const startMs = r.run_started_at ? new Date(r.run_started_at).getTime() : null;
      const endMs = r.updated_at ? new Date(r.updated_at).getTime() : null;
      const durationSeconds = startMs && endMs ? Math.round((endMs - startMs) / 1000) : null;

      return {
        id: String(r.id),
        job: r.name || 'workflow',
        createdAt: r.created_at,
        startedAt: r.run_started_at || r.created_at,
        finishedAt: r.updated_at,
        durationSeconds,
        queuedSeconds: null,
        runnerTags: [],
        status: GITHUB_CONCLUSION_MAP[r.conclusion] || r.conclusion,
        ref: r.head_branch,
        webUrl: r.html_url,
        source: 'workflow',
      };
    });

  return { runs: mapped, queue: { waiting: 0, runnerTags: [], oldestWaitingSince: null } };
}

function mergeRuns(existing, fresh) {
  const byId = new Map();
  for (const run of existing) byId.set(run.id, run);
  for (const run of fresh) byId.set(run.id, run);
  return [...byId.values()].sort((a, b) =>
    new Date(b.startedAt || b.createdAt) - new Date(a.startedAt || a.createdAt)
  );
}

function pruneRuns(runs, retentionDays) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  return runs.filter(r => {
    const ts = r.startedAt || r.createdAt;
    return ts && new Date(ts).getTime() >= cutoff;
  });
}

async function collectPipelineRuns(config, existingRuns) {
  const retentionDays = config.retentionDays || 30;
  const results = { ...existingRuns };
  const summary = { collected: 0, skipped: 0, errors: 0, details: [] };
  const scheduleUpdates = {};

  for (const pipeline of config.pipelines || []) {
    const token = resolveToken(pipeline);
    if (!token) {
      const msg = `No token for ${pipeline.repo?.platform}`;
      console.warn(`[pipeline-ops] ${msg}, skipping ${pipeline.slug}`);
      summary.skipped++;
      summary.details.push({ slug: pipeline.slug, status: 'skipped', reason: msg });
      continue;
    }

    const platform = pipeline.repo?.platform;
    let fetchResult;

    try {
      if (platform === 'github') {
        fetchResult = await fetchGithubRuns(pipeline, token);
      } else {
        fetchResult = await fetchGitlabRuns(pipeline, token);

        try {
          const { projectId, host, authHeaders } = await resolveGitlabProject(pipeline, token);
          const schedules = await fetchGitlabSchedules(projectId, host, authHeaders);
          if (schedules.length > 0) {
            const primary = schedules[0];
            scheduleUpdates[pipeline.slug] = {
              cron: primary.cron,
              expectedIntervalMinutes: primary.expectedIntervalMinutes,
              description: primary.description,
            };
          }
        } catch { /* schedule fetch is best-effort */ }
      }
    } catch (err) {
      console.error(`[pipeline-ops] Collection failed for ${pipeline.slug}: ${err.message}`);
      summary.errors++;
      summary.details.push({ slug: pipeline.slug, status: 'error', reason: err.message });
      continue;
    }

    const { runs: freshRuns, queue } = fetchResult;
    const existingPipelineRuns = results[pipeline.slug]?.runs || [];
    const merged = mergeRuns(existingPipelineRuns, freshRuns);
    const pruned = pruneRuns(merged, retentionDays);

    results[pipeline.slug] = {
      lastCheckedAt: new Date().toISOString(),
      runs: pruned,
      queue,
    };

    summary.collected++;
    summary.details.push({ slug: pipeline.slug, status: 'ok', runsFound: freshRuns.length, queueDepth: queue.waiting });
    await sleep(RATE_LIMIT_DELAY);
  }

  return { runs: results, summary, scheduleUpdates };
}

module.exports = {
  collectPipelineRuns,
  resolveToken,
  extractRepoPath,
  matchesJobFilter,
  fetchGitlabRuns,
  fetchGithubRuns,
  fetchGitlabSchedules,
  cronToIntervalMinutes,
  mergeRuns,
  pruneRuns,
};
