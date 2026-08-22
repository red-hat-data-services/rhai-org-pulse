let _fetch = globalThis.fetch;

const DATA_PREFIX = 'releases/draft-plans';

const KNOWN_PRODUCTS = ['RHOAI', 'RHAII'];

const FILES_TO_FETCH = ['release-plan.json', 'release-health.json'];

const DEFAULT_CONFIG = {
  gitlabBaseUrl: 'https://gitlab.com',
  projectId: '81798612',
  branch: 'main',
  refreshIntervalHours: 24,
  enabled: false
};

async function fetchDraftPlans(storage, config, token) {
  const {
    gitlabBaseUrl = 'https://gitlab.com',
    projectId,
    branch = 'main'
  } = config;

  if (!projectId) {
    throw new Error('projectId is required');
  }

  let parsedBase;
  try {
    parsedBase = new URL(gitlabBaseUrl);
  } catch {
    throw new Error('Invalid gitlabBaseUrl');
  }
  if (!['https:', 'http:'].includes(parsedBase.protocol)) {
    throw new Error('gitlabBaseUrl must use http or https');
  }

  console.log(`[releases/draft-plans] Fetching draft plans from project ${projectId} (branch: ${branch})`);
  const startTime = Date.now();
  const warnings = [];
  const productResults = {};
  let fileCount = 0;

  for (const product of KNOWN_PRODUCTS) {
    productResults[product] = { files: 0, errors: [] };

    for (const fileName of FILES_TO_FETCH) {
      const filePath = encodeURIComponent(`${product}/latest/${fileName}`);
      const url = `${parsedBase.origin}/api/v4/projects/${projectId}/repository/files/${filePath}/raw?ref=${encodeURIComponent(branch)}`;

      try {
        const response = await _fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: AbortSignal.timeout(30000)
        });

        if (!response.ok) {
          const status = response.status;
          if (status === 401) {
            throw new Error('GitLab API authentication failed (401). Check your token.');
          }
          if (status === 404) {
            warnings.push(`${product}/latest/${fileName} not found (404)`);
            productResults[product].errors.push(`${fileName}: not found`);
            continue;
          }
          if (status === 429) {
            throw new Error('GitLab API rate limited (429). Try again later.');
          }
          throw new Error(`GitLab API returned ${status} for ${product}/${fileName}`);
        }

        const text = await response.text();
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (err) {
          warnings.push(`Failed to parse ${product}/latest/${fileName}: ${err.message}`);
          productResults[product].errors.push(`${fileName}: invalid JSON`);
          continue;
        }

        await storage.writeToStorage(`${DATA_PREFIX}/${product}/${fileName}`, parsed);
        productResults[product].files++;
        fileCount++;
      } catch (err) {
        if (err.message.includes('401') || err.message.includes('429')) {
          throw err;
        }
        warnings.push(`Failed to fetch ${product}/latest/${fileName}: ${err.message}`);
        productResults[product].errors.push(`${fileName}: ${err.message}`);
      }
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[releases/draft-plans] Fetch complete: ${fileCount} files in ${duration}ms`);

  if (warnings.length > 0) {
    console.warn('[releases/draft-plans] Warnings:', warnings);
  }

  const result = {
    status: fileCount > 0 ? 'success' : 'no_data',
    timestamp: new Date().toISOString(),
    duration,
    fileCount,
    products: productResults,
    warnings: warnings.length > 0 ? warnings : undefined
  };

  await storage.writeToStorage(`${DATA_PREFIX}/last-fetch.json`, result);

  return result;
}

module.exports = {
  fetchDraftPlans,
  DATA_PREFIX,
  DEFAULT_CONFIG,
  KNOWN_PRODUCTS,
  FILES_TO_FETCH,
  _setFetch(fn) { _fetch = fn; }
};
