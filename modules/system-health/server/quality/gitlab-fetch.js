const AdmZip = require('adm-zip');
const {
  readReports,
  writeReportsAtomic,
  upsertReport,
  repoKeyFromSlug,
  writeHtmlReport
} = require('./storage');
const { validateQualityReport } = require('./validation');

let _fetch = globalThis.fetch;

const CONFIG_KEY = 'system-health/quality/config.json';

const DEFAULT_CONFIG = {
  gitlabBaseUrl: 'https://gitlab.com',
  projectPath: '',
  jobName: 'quality-assessment',
  branch: 'main',
  artifactJsonPath: 'quality-reports.json',
  artifactHtmlDir: 'html/'
};

async function getConfig(readFromStorage) {
  const saved = await readFromStorage(CONFIG_KEY);
  if (!saved || typeof saved !== 'object') return { ...DEFAULT_CONFIG };
  return { ...DEFAULT_CONFIG, ...saved };
}

async function saveConfig(writeToStorage, updates) {
  const allowed = ['gitlabBaseUrl', 'projectPath', 'jobName', 'branch', 'artifactJsonPath', 'artifactHtmlDir'];
  const config = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      config[key] = String(updates[key]);
    }
  }
  await writeToStorage(CONFIG_KEY, config);
  return config;
}

async function fetchReports(storage, token) {
  const { readFromStorage, writeToStorage } = storage;
  const config = await getConfig(readFromStorage);

  if (!config.projectPath) {
    return {
      status: 'not_configured',
      message: 'Quality report GitLab project path not configured. Set it in Settings > System Health.',
      timestamp: new Date().toISOString()
    };
  }

  let parsedBase;
  try {
    parsedBase = new URL(config.gitlabBaseUrl);
  } catch {
    throw new Error('Invalid gitlabBaseUrl');
  }
  if (!['https:', 'http:'].includes(parsedBase.protocol)) {
    throw new Error('gitlabBaseUrl must use http or https');
  }

  const encodedProject = encodeURIComponent(config.projectPath);
  const url = `${parsedBase.origin}/api/v4/projects/${encodedProject}/jobs/artifacts/${encodeURIComponent(config.branch)}/download?job=${encodeURIComponent(config.jobName)}`;

  console.log(`[system-health/quality] Fetching artifacts from ${config.projectPath} (branch: ${config.branch}, job: ${config.jobName})`);
  const startTime = Date.now();

  const response = await _fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
    signal: AbortSignal.timeout(60000)
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 401) {
      throw new Error('GitLab API authentication failed (401). Check GITLAB_TOKEN.');
    }
    if (status === 404) {
      return {
        status: 'artifact_not_found',
        message: 'Artifacts not found (404). They may have expired or the project/job/branch is incorrect.',
        timestamp: new Date().toISOString()
      };
    }
    if (status === 429) {
      throw new Error('GitLab API rate limited (429). Try again later.');
    }
    throw new Error('GitLab API returned ' + status + ': ' + response.statusText);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();

  const jsonPath = config.artifactJsonPath;
  const htmlDir = config.artifactHtmlDir.replace(/\/$/, '') + '/';

  let reportsJson = null;
  const htmlFiles = new Map();

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    if (entry.entryName === jsonPath || entry.entryName.endsWith('/' + jsonPath)) {
      try {
        reportsJson = JSON.parse(entry.getData().toString('utf8'));
      } catch (err) {
        throw new Error('Failed to parse ' + jsonPath + ': ' + err.message, { cause: err });
      }
    }

    if (entry.entryName.startsWith(htmlDir) && entry.entryName.endsWith('.html')) {
      const filename = entry.entryName.slice(htmlDir.length);
      const key = filename.replace(/\.html$/, '');
      htmlFiles.set(key, entry.getData().toString('utf8'));
    }
  }

  if (!reportsJson) {
    return {
      status: 'no_data',
      message: 'Artifact zip did not contain ' + jsonPath,
      timestamp: new Date().toISOString()
    };
  }

  if (!Array.isArray(reportsJson)) {
    return {
      status: 'invalid_data',
      message: jsonPath + ' is not an array',
      timestamp: new Date().toISOString()
    };
  }

  const data = await readReports(readFromStorage);
  const counts = { created: 0, updated: 0, unchanged: 0 };
  const errors = [];
  let htmlCount = 0;

  for (const report of reportsJson) {
    if (!report || typeof report !== 'object') {
      errors.push('Skipped non-object entry');
      continue;
    }

    const result = validateQualityReport(report);
    if (!result.valid) {
      errors.push('Validation failed for ' + (report.repository || 'unknown') + ': ' + result.errors.join('; '));
      continue;
    }

    const repoKey = report.id || repoKeyFromSlug(result.data.repository);
    const status = upsertReport(data, repoKey, result.data);
    counts[status]++;

    const htmlContent = htmlFiles.get(repoKey) || report.reportHtml;
    if (htmlContent) {
      await writeHtmlReport(writeToStorage, repoKey, htmlContent);
      if (Object.hasOwn(data.reports, repoKey)) {
        data.reports[repoKey].latest.hasHtmlReport = true;
      }
      htmlCount++;
    }
  }

  data.lastSyncedAt = new Date().toISOString();
  data.totalReports = Object.keys(data.reports).length;
  await writeReportsAtomic(writeToStorage, data);

  const elapsed = Date.now() - startTime;
  console.log(`[system-health/quality] Fetched ${reportsJson.length} reports (${counts.created} created, ${counts.updated} updated, ${htmlCount} HTML) in ${elapsed}ms`);

  return {
    status: 'success',
    created: counts.created,
    updated: counts.updated,
    unchanged: counts.unchanged,
    htmlReports: htmlCount,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString()
  };
}

function _setFetch(fn) {
  _fetch = fn;
}

module.exports = {
  fetchReports,
  getConfig,
  saveConfig,
  DEFAULT_CONFIG,
  _setFetch
};
