const API_TIMEOUT = 30_000;
const JOBS_PER_PAGE = 100;
const PACKAGES_CONCURRENCY = 5;
const PREFERRED_VARIANT = 'cpu-ubi9';

const packagesCache = new Map();

let GITLAB_BASE_URL = 'https://gitlab.com';
let GITLAB_PROJECT = 'redhat%2Frhel-ai%2Frhai%2Fpipeline';
let SCHEDULE_ID = '4256496';

function getToken(secrets) {
  return secrets.NIGHTLY_PIPELINE_GITLAB_TOKEN || secrets.GITLAB_TOKEN || null;
}

async function gitlabApi(path, token) {
  const url = `${GITLAB_BASE_URL}/api/v4${path}`;
  const res = await fetch(url, {
    headers: { 'PRIVATE-TOKEN': token, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(API_TIMEOUT),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`GitLab API ${res.status}: ${body.slice(0, 200)}`);
    err.upstreamStatus = res.status;
    throw err;
  }
  return res.json();
}

const STAGE_SUFFIXES = ['bootstrap-and-onboard', 'build-wheels', 'publish-wheels', 'release-tarball'];
const SPECIAL_JOB_PREFIXES = ['slack-notify-', 'update-publish-config'];

function parseJobName(name) {
  if (SPECIAL_JOB_PREFIXES.some(p => name.startsWith(p))) return null;

  for (const suffix of STAGE_SUFFIXES) {
    if (!name.endsWith(suffix)) continue;
    const prefix = name.slice(0, -(suffix.length + 1));
    const ubi9Idx = prefix.lastIndexOf('-ubi9');
    if (ubi9Idx === -1) continue;

    const collectionAndVariant = prefix.slice(0, ubi9Idx);
    const arch = prefix.slice(ubi9Idx + 5);

    const lastDash = collectionAndVariant.lastIndexOf('-');
    if (lastDash === -1) continue;

    const possibleVariant = collectionAndVariant.slice(lastDash + 1);
    const KNOWN_VARIANTS = ['cpu', 'cuda12.9', 'cuda13.0', 'rocm7.1', 'rocm7.14', 'spyre'];

    let collection, variant;
    if (KNOWN_VARIANTS.includes(possibleVariant)) {
      collection = collectionAndVariant.slice(0, lastDash);
      variant = possibleVariant;
    } else {
      const secondLastDash = collectionAndVariant.lastIndexOf('-', lastDash - 1);
      if (secondLastDash === -1) continue;
      const twoPartVariant = collectionAndVariant.slice(secondLastDash + 1);
      if (KNOWN_VARIANTS.includes(twoPartVariant)) {
        collection = collectionAndVariant.slice(0, secondLastDash);
        variant = twoPartVariant;
      } else {
        continue;
      }
    }

    return { collection, variant, arch, stage: suffix };
  }

  return null;
}

function rollUpStatus(statuses) {
  if (statuses.includes('failed')) return 'failed';
  if (statuses.includes('running')) return 'running';
  if (statuses.includes('canceled')) return 'canceled';
  if (statuses.includes('skipped') && statuses.every(s => s === 'skipped' || s === 'success' || s === 'manual')) return 'success';
  if (statuses.every(s => s === 'success' || s === 'manual')) return 'success';
  if (statuses.includes('skipped')) return 'skipped';
  return 'unknown';
}

function structureJobs(jobs) {
  const collections = {};
  const specialJobs = [];
  const failedJobs = [];

  for (const job of jobs) {
    const parsed = parseJobName(job.name);
    if (!parsed) {
      if (SPECIAL_JOB_PREFIXES.some(p => job.name.startsWith(p))) {
        specialJobs.push({
          name: job.name,
          status: job.status,
          web_url: job.web_url,
        });
      }
      continue;
    }

    const { collection, variant, arch, stage } = parsed;
    collections[collection] ??= {};
    collections[collection][variant] ??= {};
    collections[collection][variant][arch] ??= {};
    collections[collection][variant][arch][stage] = {
      id: job.id,
      status: job.status,
      web_url: job.web_url,
      duration: job.duration,
      failure_reason: job.failure_reason || null,
    };

    if (job.status === 'failed') {
      failedJobs.push({
        name: job.name,
        id: job.id,
        status: job.status,
        web_url: job.web_url,
        collection,
        variant,
        arch,
        stage,
        failure_reason: job.failure_reason || null,
      });
    }
  }

  const collectionSummaries = {};
  for (const [name, variants] of Object.entries(collections)) {
    const allStatuses = [];
    for (const archs of Object.values(variants)) {
      for (const stages of Object.values(archs)) {
        for (const job of Object.values(stages)) {
          allStatuses.push(job.status);
        }
      }
    }
    collectionSummaries[name] = {
      status: rollUpStatus(allStatuses),
      variants,
    };
  }

  const allStatuses = jobs.filter(j => parseJobName(j.name)).map(j => j.status);
  return {
    summary: {
      total: allStatuses.length,
      success: allStatuses.filter(s => s === 'success').length,
      failed: allStatuses.filter(s => s === 'failed').length,
      skipped: allStatuses.filter(s => s === 'skipped').length,
    },
    failed_jobs: failedJobs,
    collections: collectionSummaries,
    special_jobs: specialJobs,
  };
}

function parsePackageName(line) {
  let s = line.split('#')[0].trim();
  if (!s) return null;
  s = s.split(';')[0].trim();
  s = s.replace(/\[.*?\]/g, '');
  s = s.replace(/[><=!~].*$/, '').trim();
  return s.toLowerCase().replace(/[._]+/g, '-') || null;
}

function parseRequirementsFile(content) {
  const packages = [];
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const name = parsePackageName(line);
    if (name) packages.push(name);
  }
  return [...new Set(packages)].sort();
}

async function concurrentMap(items, fn, limit) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function fetchPipelineSha(token, pipelineId) {
  const pipeline = await gitlabApi(`/projects/${GITLAB_PROJECT}/pipelines/${pipelineId}`, token);
  return pipeline.sha;
}

async function fetchTreeListing(token, path, ref) {
  const allEntries = [];
  let page = 1;
  while (true) {
    const entries = await gitlabApi(
      `/projects/${GITLAB_PROJECT}/repository/tree?path=${encodeURIComponent(path)}&ref=${ref}&per_page=100&page=${page}`,
      token
    );
    allEntries.push(...entries);
    if (entries.length < 100) break;
    page++;
  }
  return allEntries;
}

async function fetchFileRaw(token, filePath, ref) {
  const url = `/projects/${GITLAB_PROJECT}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${ref}`;
  const res = await fetch(`${GITLAB_BASE_URL}/api/v4${url}`, {
    headers: { 'PRIVATE-TOKEN': token, 'Accept': 'text/plain' },
    signal: AbortSignal.timeout(API_TIMEOUT),
  });
  if (!res.ok) return null;
  return res.text();
}

async function fetchCollectionPackages(token, sha, collection, variant) {
  const cacheKey = `${sha}:${collection}:${variant}`;
  if (packagesCache.has(cacheKey)) return packagesCache.get(cacheKey);

  const reqPath = `collections/${collection}/${variant}/requirements`;
  let tree;
  try {
    tree = await fetchTreeListing(token, reqPath, sha);
  } catch (err) {
    if (err.upstreamStatus === 404) {
      const result = { collection, variant, sha, groups: [], totalCount: 0 };
      packagesCache.set(cacheKey, result);
      return result;
    }
    throw err;
  }
  const txtFiles = tree.filter(e => e.type === 'blob' && e.name.endsWith('.txt') && e.name !== 'onboarded.txt');

  const groups = await concurrentMap(txtFiles, async (entry) => {
    const content = await fetchFileRaw(token, `${reqPath}/${entry.name}`, sha);
    if (!content) return null;
    const packages = parseRequirementsFile(content);
    const source = entry.name.replace(/\.txt$/, '');
    return packages.length > 0 ? { source, packages } : null;
  }, PACKAGES_CONCURRENCY);

  const validGroups = groups.filter(Boolean).sort((a, b) => a.source.localeCompare(b.source));
  const allPkgs = new Set();
  for (const g of validGroups) g.packages.forEach(p => allPkgs.add(p));

  const result = { collection, variant, sha, groups: validGroups, totalCount: allPkgs.size };
  packagesCache.set(cacheKey, result);
  return result;
}

async function resolveVariant(token, sha, collection, requestedVariant) {
  if (requestedVariant) return requestedVariant;
  try {
    const tree = await fetchTreeListing(token, `collections/${collection}`, sha);
    const dirs = tree.filter(e => e.type === 'tree' && e.name.endsWith('-ubi9')).map(e => e.name);
    if (!dirs.length) return null;
    return dirs.includes(PREFERRED_VARIANT) ? PREFERRED_VARIANT : dirs.sort()[0];
  } catch (err) {
    if (err.upstreamStatus === 404) return null;
    throw err;
  }
}

async function fetchAllJobs(token, pipelineId) {
  const allJobs = [];
  let page = 1;
  while (true) {
    const jobs = await gitlabApi(
      `/projects/${GITLAB_PROJECT}/pipelines/${pipelineId}/jobs?per_page=${JOBS_PER_PAGE}&page=${page}`,
      token
    );
    allJobs.push(...jobs);
    if (jobs.length < JOBS_PER_PAGE) break;
    page++;
  }
  return allJobs;
}

module.exports = function registerNightlyPipelineRoutes(router, context) {
  const secrets = context.secrets || {};

  if (context.resolveSecret) {
    GITLAB_BASE_URL = (context.resolveSecret('NIGHTLY_PIPELINE_GITLAB_BASE_URL') || GITLAB_BASE_URL).replace(/\/+$/, '');
    GITLAB_PROJECT = context.resolveSecret('NIGHTLY_PIPELINE_GITLAB_PROJECT') || GITLAB_PROJECT;
    SCHEDULE_ID = context.resolveSecret('NIGHTLY_PIPELINE_SCHEDULE_ID') || SCHEDULE_ID;
  }

  router.get('/nightly-pipelines', async (req, res) => {
    const token = getToken(secrets);
    if (!token) {
      return res.status(503).json({ error: 'GitLab token not configured' });
    }
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 14, 1), 100);

      const [schedule, ...pipelinePages] = await Promise.all([
        gitlabApi(`/projects/${GITLAB_PROJECT}/pipeline_schedules/${SCHEDULE_ID}`, token),
        gitlabApi(`/projects/${GITLAB_PROJECT}/pipeline_schedules/${SCHEDULE_ID}/pipelines?per_page=100&page=1`, token),
      ]);

      let allPipelines = pipelinePages[0];
      if (allPipelines.length === 100) {
        let page = 2;
        while (allPipelines.length < limit) {
          const batch = await gitlabApi(
            `/projects/${GITLAB_PROJECT}/pipeline_schedules/${SCHEDULE_ID}/pipelines?per_page=100&page=${page}`,
            token
          );
          if (!batch.length) break;
          allPipelines.push(...batch);
          if (batch.length < 100) break;
          page++;
        }
      }

      const sorted = allPipelines
        .map(p => ({
          id: p.id,
          iid: p.iid,
          status: p.status,
          ref: p.ref,
          sha: p.sha,
          created_at: p.created_at,
          updated_at: p.updated_at,
          web_url: p.web_url,
        }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, limit);

      res.json({
        schedule_id: Number(SCHEDULE_ID),
        project_web_url: `${GITLAB_BASE_URL}/${decodeURIComponent(GITLAB_PROJECT)}`,
        schedule: {
          description: schedule.description,
          cron: schedule.cron,
          cron_timezone: schedule.cron_timezone,
          next_run_at: schedule.next_run_at,
          ref: (schedule.ref || '').replace('refs/heads/', ''),
          active: schedule.active,
        },
        pipelines: sorted,
      });
    } catch (err) {
      const status = err.upstreamStatus || 500;
      res.status(status).json({ error: err.message });
    }
  });

  router.get('/nightly-pipelines/:pipelineId/jobs', async (req, res) => {
    const token = getToken(secrets);
    if (!token) {
      return res.status(503).json({ error: 'GitLab token not configured' });
    }
    const { pipelineId } = req.params;
    if (!/^\d+$/.test(pipelineId)) {
      return res.status(400).json({ error: 'Invalid pipeline ID' });
    }
    try {
      const jobs = await fetchAllJobs(token, pipelineId);
      const structured = structureJobs(jobs);
      res.json({
        pipeline_id: Number(pipelineId),
        ...structured,
      });
    } catch (err) {
      const status = err.upstreamStatus || 500;
      res.status(status).json({ error: err.message });
    }
  });

  router.get('/nightly-pipelines/:pipelineId/packages', async (req, res) => {
    const token = getToken(secrets);
    if (!token) {
      return res.status(503).json({ error: 'GitLab token not configured' });
    }
    const { pipelineId } = req.params;
    if (!/^\d+$/.test(pipelineId)) {
      return res.status(400).json({ error: 'Invalid pipeline ID' });
    }
    const { collection, variant } = req.query;
    if (!collection) {
      return res.status(400).json({ error: 'collection query parameter is required' });
    }
    try {
      const sha = await fetchPipelineSha(token, pipelineId);
      const resolvedVariant = await resolveVariant(token, sha, collection, variant);
      if (!resolvedVariant) {
        return res.json({ collection, variant: null, sha, groups: [], totalCount: 0 });
      }
      const result = await fetchCollectionPackages(token, sha, collection, resolvedVariant);
      res.json(result);
    } catch (err) {
      const status = err.upstreamStatus || 500;
      res.status(status).json({ error: err.message });
    }
  });
};

module.exports.parseJobName = parseJobName;
module.exports.structureJobs = structureJobs;
module.exports.rollUpStatus = rollUpStatus;