const yaml = require('js-yaml');

const API_TIMEOUT = 30_000;
const JOBS_PER_PAGE = 100;
const PACKAGES_CONCURRENCY = 5;
const PREFERRED_VARIANT = 'cpu-ubi9';

const PACKAGES_CACHE_MAX = 200;
const packagesCache = new Map();
const SAFE_NAME_RE = /^[a-zA-Z0-9_.-]+$/;

const SUPPORTED_VARIANTS_CACHE_TTL = 3600_000;
let _supportedVariantsCache = null;
let _supportedVariantsCacheTime = 0;

const DEFAULTS = {
  gitlabBaseUrl: 'https://gitlab.com',
  gitlabProject: 'redhat%2Frhel-ai%2Frhai%2Fpipeline',
  scheduleId: '4256496',
};

function getToken(secrets) {
  return secrets.NIGHTLY_PIPELINE_GITLAB_TOKEN || secrets.GITLAB_TOKEN || null;
}

let _cfg = { ...DEFAULTS };

async function gitlabApi(path, token) {
  const url = `${_cfg.gitlabBaseUrl}/api/v4${path}`;
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
const KNOWN_VARIANTS = ['cpu', 'cuda12.9', 'cuda13.0', 'rocm7.1', 'rocm7.14', 'spyre'];

function parseJobName(name) {
  if (SPECIAL_JOB_PREFIXES.some(p => name.startsWith(p))) return null;

  let stage = null, rest = null;
  for (const suffix of STAGE_SUFFIXES) {
    if (name.endsWith('-' + suffix)) {
      stage = suffix;
      rest = name.slice(0, -(suffix.length + 1));
      break;
    }
  }
  if (!stage) return null;

  const ubi9Pos = rest.lastIndexOf('-ubi9-');
  if (ubi9Pos === -1) return null;

  const collVar = rest.slice(0, ubi9Pos);
  const arch = rest.slice(ubi9Pos + 6);

  for (const v of KNOWN_VARIANTS) {
    if (collVar.endsWith('-' + v)) {
      return { collection: collVar.slice(0, -(v.length + 1)), variant: v, arch, stage };
    }
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
  const allStatuses = [];
  let totalCount = 0, successCount = 0, failedCount = 0, skippedCount = 0;
  for (const [name, variants] of Object.entries(collections)) {
    const statuses = [];
    for (const archs of Object.values(variants)) {
      for (const stages of Object.values(archs)) {
        for (const job of Object.values(stages)) {
          statuses.push(job.status);
          allStatuses.push(job.status);
          totalCount++;
          if (job.status === 'success') successCount++;
          else if (job.status === 'failed') failedCount++;
          else if (job.status === 'skipped') skippedCount++;
        }
      }
    }
    collectionSummaries[name] = {
      status: rollUpStatus(statuses),
      variants,
    };
  }

  return {
    status: rollUpStatus(allStatuses),
    summary: { total: totalCount, success: successCount, failed: failedCount, skipped: skippedCount },
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
  const pipeline = await gitlabApi(`/projects/${_cfg.gitlabProject}/pipelines/${pipelineId}`, token);
  return pipeline.sha;
}

async function fetchTreeListing(token, path, ref) {
  const allEntries = [];
  let page = 1;
  while (true) {
    const entries = await gitlabApi(
      `/projects/${_cfg.gitlabProject}/repository/tree?path=${encodeURIComponent(path)}&ref=${ref}&per_page=100&page=${page}`,
      token
    );
    allEntries.push(...entries);
    if (entries.length < 100) break;
    page++;
  }
  return allEntries;
}

async function fetchFileRaw(token, filePath, ref) {
  const url = `/projects/${_cfg.gitlabProject}/repository/files/${encodeURIComponent(filePath)}/raw?ref=${ref}`;
  const res = await fetch(`${_cfg.gitlabBaseUrl}/api/v4${url}`, {
    headers: { 'PRIVATE-TOKEN': token, 'Accept': 'text/plain' },
    signal: AbortSignal.timeout(API_TIMEOUT),
  });
  if (!res.ok) return null;
  return res.text();
}

async function fetchCollectionPackages(token, sha, collection, variant) {
  const cacheKey = `${sha}:${collection}:${variant}`;
  if (packagesCache.has(cacheKey)) {
    const cached = packagesCache.get(cacheKey);
    packagesCache.delete(cacheKey);
    packagesCache.set(cacheKey, cached);
    return cached;
  }

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
  if (packagesCache.size >= PACKAGES_CACHE_MAX) {
    const oldest = packagesCache.keys().next().value;
    packagesCache.delete(oldest);
  }
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

async function fetchSupportedVariants(token, ref = 'main') {
  const now = Date.now();
  if (_supportedVariantsCache && (now - _supportedVariantsCacheTime) < SUPPORTED_VARIANTS_CACHE_TTL) {
    return _supportedVariantsCache;
  }
  const content = await fetchFileRaw(token, 'supported_versions.yml', ref);
  if (!content) return null;
  const data = yaml.load(content);
  const entry = data?.supported_versions?.find(v => v.release_branch === ref);
  if (!entry?.variants) return null;
  const variants = new Set(entry.variants.map(v => v.replace(/-ubi9$/, '')));
  _supportedVariantsCache = variants;
  _supportedVariantsCacheTime = now;
  return variants;
}

function filterBySupported(structured, supportedVariants) {
  if (!supportedVariants) return structured;

  const filteredCollections = {};
  const allStatuses = [];
  let totalCount = 0, successCount = 0, failedCount = 0, skippedCount = 0;

  for (const [name, col] of Object.entries(structured.collections)) {
    const filteredVariants = {};
    const statuses = [];
    for (const [variant, archs] of Object.entries(col.variants)) {
      if (!supportedVariants.has(variant)) continue;
      filteredVariants[variant] = archs;
      for (const stages of Object.values(archs)) {
        for (const job of Object.values(stages)) {
          statuses.push(job.status);
          allStatuses.push(job.status);
          totalCount++;
          if (job.status === 'success') successCount++;
          else if (job.status === 'failed') failedCount++;
          else if (job.status === 'skipped') skippedCount++;
        }
      }
    }
    if (Object.keys(filteredVariants).length > 0) {
      filteredCollections[name] = { status: rollUpStatus(statuses), variants: filteredVariants };
    }
  }

  return {
    status: rollUpStatus(allStatuses),
    summary: { total: totalCount, success: successCount, failed: failedCount, skipped: skippedCount },
    failed_jobs: structured.failed_jobs.filter(j => supportedVariants.has(j.variant)),
    collections: filteredCollections,
    special_jobs: structured.special_jobs,
  };
}

async function fetchAllJobs(token, pipelineId) {
  const allJobs = [];
  let page = 1;
  while (true) {
    const jobs = await gitlabApi(
      `/projects/${_cfg.gitlabProject}/pipelines/${pipelineId}/jobs?per_page=${JOBS_PER_PAGE}&page=${page}`,
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
    _cfg = {
      gitlabBaseUrl: (context.resolveSecret('NIGHTLY_PIPELINE_GITLAB_BASE_URL') || DEFAULTS.gitlabBaseUrl).replace(/\/+$/, ''),
      gitlabProject: context.resolveSecret('NIGHTLY_PIPELINE_GITLAB_PROJECT') || DEFAULTS.gitlabProject,
      scheduleId: context.resolveSecret('NIGHTLY_PIPELINE_SCHEDULE_ID') || DEFAULTS.scheduleId,
    };
  }

  /**
   * @openapi
   * /api/modules/product-builds/nightly-pipelines:
   *   get:
   *     tags: [Nightly Pipelines]
   *     summary: List nightly pipeline runs with schedule metadata
   *     parameters:
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 14
   *         description: Number of most recent pipelines to return
   *     responses:
   *       200:
   *         description: Schedule metadata and sorted pipeline list
   *       503:
   *         description: GitLab token not configured
   */
  router.get('/nightly-pipelines', async (req, res) => {
    const token = getToken(secrets);
    if (!token) {
      return res.status(503).json({ error: 'GitLab token not configured' });
    }
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 14, 1), 100);

      const [schedule, firstPage] = await Promise.all([
        gitlabApi(`/projects/${_cfg.gitlabProject}/pipeline_schedules/${_cfg.scheduleId}`, token),
        gitlabApi(`/projects/${_cfg.gitlabProject}/pipeline_schedules/${_cfg.scheduleId}/pipelines?per_page=100&page=1`, token),
      ]);

      const allPipelines = [...firstPage];
      if (firstPage.length === 100) {
        for (let page = 2; page <= 50; page++) {
          const batch = await gitlabApi(
            `/projects/${_cfg.gitlabProject}/pipeline_schedules/${_cfg.scheduleId}/pipelines?per_page=100&page=${page}`,
            token
          );
          allPipelines.push(...batch);
          if (batch.length < 100) break;
        }
      }

      const deduped = new Map();
      for (const p of allPipelines) {
        const date = p.created_at.slice(0, 10);
        const existing = deduped.get(date);
        if (!existing || new Date(p.created_at) > new Date(existing.created_at)) {
          deduped.set(date, p);
        }
      }

      const sorted = [...deduped.values()]
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

      const supportedVariants = await fetchSupportedVariants(token).catch(() => null);
      if (supportedVariants) {
        const failedPipelines = sorted.filter(p => p.status === 'failed');
        await concurrentMap(failedPipelines, async (p) => {
          const failedJobs = await gitlabApi(
            `/projects/${_cfg.gitlabProject}/pipelines/${p.id}/jobs?scope[]=failed&per_page=100`,
            token
          ).catch(() => []);
          const hasRelevantFailure = failedJobs.some(j => {
            const parsed = parseJobName(j.name);
            return parsed && supportedVariants.has(parsed.variant);
          });
          if (!hasRelevantFailure) p.status = 'success';
        }, 5);
      }

      res.json({
        schedule_id: Number(_cfg.scheduleId),
        project_web_url: `${_cfg.gitlabBaseUrl}/${decodeURIComponent(_cfg.gitlabProject)}`,
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

  /**
   * @openapi
   * /api/modules/product-builds/nightly-pipelines/{pipelineId}/jobs:
   *   get:
   *     tags: [Nightly Pipelines]
   *     summary: Get structured job data for a nightly pipeline run
   *     parameters:
   *       - name: pipelineId
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: GitLab pipeline ID
   *     responses:
   *       200:
   *         description: Jobs grouped by collection/variant/arch/stage with summary counts
   *       400:
   *         description: Invalid pipeline ID
   *       503:
   *         description: GitLab token not configured
   */
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
      const [jobs, supportedVariants] = await Promise.all([
        fetchAllJobs(token, pipelineId),
        fetchSupportedVariants(token).catch(() => null),
      ]);
      const structured = structureJobs(jobs);
      const filtered = filterBySupported(structured, supportedVariants);
      res.json({
        pipeline_id: Number(pipelineId),
        ...filtered,
      });
    } catch (err) {
      const status = err.upstreamStatus || 500;
      res.status(status).json({ error: err.message });
    }
  });

  /**
   * @openapi
   * /api/modules/product-builds/nightly-pipelines/{pipelineId}/packages:
   *   get:
   *     tags: [Nightly Pipelines]
   *     summary: Get package list for a collection at a pipeline commit
   *     parameters:
   *       - name: pipelineId
   *         in: path
   *         required: true
   *         schema:
   *           type: integer
   *         description: GitLab pipeline ID
   *       - name: collection
   *         in: query
   *         required: true
   *         schema:
   *           type: string
   *         description: Collection name from job parsing
   *       - name: variant
   *         in: query
   *         schema:
   *           type: string
   *         description: Build variant (defaults to cpu-ubi9 or first available)
   *     responses:
   *       200:
   *         description: Package groups by source file with total count
   *       400:
   *         description: Invalid pipeline ID or missing/invalid collection
   *       503:
   *         description: GitLab token not configured
   */
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
    if (!SAFE_NAME_RE.test(collection) || (variant && !SAFE_NAME_RE.test(variant))) {
      return res.status(400).json({ error: 'Invalid collection or variant name' });
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