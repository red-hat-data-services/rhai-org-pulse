const path = require('path');
const { createGoogleSheetsClient } = require('../../../shared/server/google-sheets');
const { createJiraClient } = require('../../../shared/server/jira');
const { normalizeRelease } = require('../lib/normalize-release');

const JIRA_KEY_RE = /^[A-Z]+-\d+$/;

const DEFAULTS = {
  spreadsheetId: '1cFIL4klt4uRflIsTH2pigls1_3RdzyGx8sXZ6F2UtQ0',
};

let _cfg = { ...DEFAULTS };

const ACCELERATOR_SHEETS = new Set([
  'CUDA', 'ROCm', 'Google TPU', 'Spyre', 'AWS Neuron', 'CPU', 'Intel Gaudi',
]);

const INFRA_KEYWORDS = ['python', 'gcc', 'rhel', 'ubi'];

let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 15 * 60 * 1000;

function isInternalOnlyRow(row) {
  for (let i = 0; i < row.length; i++) {
    if (String(row[i] || '').includes('INTERNAL ONLY')) return true;
  }
  return false;
}

function extractPkgName(cell) {
  if (!cell) return null;
  const s = cell.trim();
  if (!s || s === '-' || s === '?') return null;
  const first = s.split(' ', 1)[0].toLowerCase().replace(/,$/, '');
  if (['no', 'internal', '', '-', '[spyre]'].includes(first)) return null;
  return first;
}

function parseVersionCell(cell) {
  if (!cell) return null;
  const s = cell.trim();
  if (!s) return null;
  if (s === '-') return { version: null, dropped: true, tentative: false };
  const tentative = s.includes('(?)') || (s.endsWith('?') && !s.endsWith('(?)'));
  const cleaned = s.replace(/\(\?\)/g, '').replace(/\?$/, '').trim();
  const spaceIdx = cleaned.indexOf(' ');
  const version = spaceIdx > 0 ? cleaned.slice(spaceIdx + 1) : cleaned;
  return { version: version || null, tentative };
}

function isInfra(name) {
  return INFRA_KEYWORDS.some(kw => name.includes(kw));
}

function findPlanningBoundary(headerRow, releaseMap, cleanReleases) {
  for (let i = 0; i < headerRow.length; i++) {
    const cell = String(headerRow[i] || '').toLowerCase();
    if (cell.includes('planning in progress') || cell.includes('planning')) {
      const relIdx = i - 2;
      if (releaseMap[relIdx]) return cleanReleases.indexOf(releaseMap[relIdx]);
      for (let j = relIdx; j < relIdx + 3; j++) {
        if (releaseMap[j]) return cleanReleases.indexOf(releaseMap[j]);
      }
    }
  }
  return null;
}

function parseSheet(sheetName, rows) {
  if (!rows || rows.length < 2) return null;

  const releaseRow = rows[1];
  const releaseMap = {};
  const cleanReleases = [];

  for (let i = 2; i < releaseRow.length; i++) {
    const r = String(releaseRow[i] || '').trim();
    if (r) {
      releaseMap[i - 2] = r;
      if (!cleanReleases.includes(r)) cleanReleases.push(r);
    }
  }

  const blocks = [];
  let current = [];

  for (let ri = 2; ri < rows.length; ri++) {
    const row = rows[ri] || [];
    const isEmpty = row.length === 0 || row.every(c => !String(c || '').trim());

    if (isEmpty) {
      if (current.length) { blocks.push(current); current = []; }
      continue;
    }
    if (isInternalOnlyRow(row)) continue;
    current.push(row);
  }
  if (current.length) blocks.push(current);

  const subVariants = [];

  for (const block of blocks) {
    if (block.length < 2) continue;

    const variantName = String(block[0][0] || '').trim();
    if (!variantName) continue;

    const sdkVersions = {};
    for (let i = 2; i < block[0].length; i++) {
      const relIdx = i - 2;
      if (releaseMap[relIdx] && block[0][i]) {
        const val = String(block[0][i]).trim();
        if (val) sdkVersions[releaseMap[relIdx]] = val;
      }
    }

    const arch = block[1] ? String(block[1][0] || '').trim() : '';

    const packages = [];
    const infra = [];

    for (let ri = 1; ri < block.length; ri++) {
      const row = block[ri];
      if (!row) continue;

      let pkgName = null;
      const versions = {};

      for (let i = 2; i < Math.max(row.length, releaseRow.length); i++) {
        const relIdx = i - 2;
        if (!releaseMap[relIdx]) continue;
        const release = releaseMap[relIdx];
        const cell = i < row.length ? String(row[i] || '').trim() : '';
        if (!cell) continue;

        if (!pkgName) pkgName = extractPkgName(cell);
        const parsed = parseVersionCell(cell);
        if (parsed) versions[release] = parsed;
      }

      const colA = String(row[0] || '').trim();
      if (colA && !pkgName) {
        pkgName = colA.toLowerCase().split('(')[0].split(',')[0].trim();
      }

      if (pkgName && Object.keys(versions).length > 0) {
        const entry = { name: pkgName, versions };
        if (isInfra(pkgName)) infra.push(entry);
        else packages.push(entry);
      }
    }

    const allIndices = new Set();
    for (const p of [...packages, ...infra]) {
      for (const r of Object.keys(p.versions)) {
        const idx = cleanReleases.indexOf(r);
        if (idx !== -1) allIndices.add(idx);
      }
    }

    subVariants.push({
      name: variantName,
      architectures: arch,
      first_release_index: allIndices.size > 0 ? Math.min(...allIndices) : 0,
      last_release_index: allIndices.size > 0 ? Math.max(...allIndices) : null,
      sdk_versions: sdkVersions,
      packages,
      infra,
    });
  }

  const headerRow = rows[0] || [];
  const planningFromIndex = findPlanningBoundary(headerRow, releaseMap, cleanReleases);

  return { sheet: sheetName, sub_variants: subVariants, planning_from_index: planningFromIndex };
}

function loadSnapshot() {
  try {
    return require(path.join(__dirname, 'version-map-snapshot.json'));
  } catch {
    return null;
  }
}

async function fetchFromSheets(googleKeyFile) {
  const sheetsClient = createGoogleSheetsClient({ keyFile: googleKeyFile });
  const tabNames = await sheetsClient.discoverSheetNames(_cfg.spreadsheetId);
  const acceleratorTabs = tabNames.filter(t => ACCELERATOR_SHEETS.has(t));

  let releases = null;
  const accelerators = [];

  for (const tab of acceleratorTabs) {
    const raw = await sheetsClient.fetchRawSheet(_cfg.spreadsheetId, tab);
    const allRows = [raw.headers, ...raw.rows];

    if (!releases && allRows.length > 1) {
      releases = [];
      const seen = new Set();
      const releaseRow = allRows[1];
      for (let i = 2; i < releaseRow.length; i++) {
        const r = String(releaseRow[i] || '').trim();
        if (r && !seen.has(r)) { releases.push(r); seen.add(r); }
      }
    }

    const parsed = parseSheet(tab, allRows);
    if (parsed) accelerators.push(parsed);
  }

  return {
    releases: releases || [],
    accelerators,
    source: 'live',
    cached_at: new Date().toISOString(),
  };
}

// --- JIRA variant feature links ---

let _jiraLinksCache = null;
let _jiraLinksCacheAt = 0;
const JIRA_LINKS_CACHE_TTL = 60 * 60 * 1000;

const VARIANT_FEATURE_RE = /^(.+?)-ubi9\s+for\s+(.+)$/i;

function parseFeatureSummary(summary) {
  const m = summary.match(VARIANT_FEATURE_RE);
  if (!m) return null;
  return { variant: m[1].toLowerCase().trim(), release: m[2].trim() };
}

const VARIANT_TO_SHEET = {
  cuda: 'CUDA',
  rocm: 'ROCm',
  cpu: 'CPU',
  gaudi: 'Intel Gaudi',
  tpu: 'Google TPU',
  neuron: 'AWS Neuron',
  spyre: 'Spyre',
};

function extractVariantBase(variant) {
  const m = variant.match(/^([a-z]+)/);
  return m ? m[1] : variant;
}

function extractPackageFromEpic(summary) {
  const lower = summary.toLowerCase();
  let m = lower.match(/update\s+(.+?)\s+to\s+/);
  if (m) return m[1].replace(/-ubi9.*/, '').trim();
  m = lower.match(/upgrade\s+(.+?)\s+to\s+/);
  if (m) return m[1].replace(/-ubi9.*/, '').trim();
  m = lower.match(/wheels\s+for\s+(\S+)/);
  if (m) return m[1].trim();
  return null;
}

async function buildJiraLinks(jira) {
  const jql = 'project = AIPCC AND issuetype = Feature AND "Target Version" is not EMPTY ORDER BY created DESC';
  const allFeatures = await jira.fetchAllJqlResults(jql, 'key,summary,status');
  const features = allFeatures.filter(f => VARIANT_FEATURE_RE.test(f.fields.summary));

  const links = {};
  const featureMap = {};
  const BATCH = 10;

  for (let i = 0; i < features.length; i += BATCH) {
    const batch = features.slice(i, i + BATCH);
    const childResults = await Promise.all(
      batch.map(f =>
        JIRA_KEY_RE.test(f.key)
          ? jira.fetchAllJqlResults(`parent = ${f.key}`, 'key,summary,status', { maxResults: 50 }).catch(() => [])
          : Promise.resolve([])
      )
    );

    for (let j = 0; j < batch.length; j++) {
      const feature = batch[j];
      const children = childResults[j];
      const parsed = parseFeatureSummary(feature.fields.summary);
      if (!parsed) continue;

      const variantBase = extractVariantBase(parsed.variant);
      const normRelease = normalizeRelease(parsed.release);

      const featureKey = `${parsed.variant}:${normRelease}`;
      featureMap[featureKey] = {
        key: feature.key,
        summary: feature.fields.summary,
        variant: parsed.variant,
        variantBase,
        sheet: VARIANT_TO_SHEET[variantBase] || null,
        release: normRelease,
        status: (feature.fields.status && feature.fields.status.name) || '',
      };

      for (const child of children) {
        const pkg = extractPackageFromEpic(child.fields.summary);
        if (!pkg) continue;
        const linkKey = `${parsed.variant}:${normRelease}:${pkg}`;
        links[linkKey] = {
          key: child.key,
          summary: child.fields.summary,
          status: (child.fields.status && child.fields.status.name) || '',
          status_category: (child.fields.status && child.fields.status.statusCategory && child.fields.status.statusCategory.key) || 'undefined',
        };
      }
    }
  }

  return { links, features: featureMap, generated_at: new Date().toISOString() };
}

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerVersionMapRoutes(router, context) {
  if (context.resolveSecret) {
    const sheetId = context.resolveSecret('VERSION_MAP_SPREADSHEET_ID');
    if (sheetId) _cfg.spreadsheetId = sheetId;
  }

  const googleKeyFile = (context.resolveSecret
    ? context.resolveSecret('GOOGLE_SERVICE_ACCOUNT_KEY_FILE')
    : null) || '/etc/secrets/google-sa-key.json';

  async function fetchWithFallback(label) {
    try {
      const data = await fetchFromSheets(googleKeyFile);
      _cache = data;
      _cacheAt = Date.now();
      return data;
    } catch (err) {
      console.warn(`[version-map] ${label} failed, using snapshot:`, err.message);
      const snapshot = loadSnapshot();
      if (snapshot) {
        _cache = snapshot;
        _cacheAt = Date.now();
        return snapshot;
      }
      return null;
    }
  }

  /**
   * @openapi
   * /api/modules/product-builds/version-map:
   *   get:
   *     tags: [Package Analysis]
   *     summary: Get package version map across releases and accelerator variants
   *     description: Returns planned package versions per release per accelerator variant from the planning spreadsheet. Falls back to a static snapshot when Google Sheets is unavailable.
   *     responses:
   *       200:
   *         description: Version map data with releases, accelerators, sub-variants, and package versions
   */
  router.get('/version-map', async function (req, res) {
    if (_cache && (Date.now() - _cacheAt) < CACHE_TTL) {
      return res.json(_cache);
    }
    const data = await fetchWithFallback('Fetch');
    if (data) return res.json(data);
    return res.status(503).json({ error: 'Version map data unavailable' });
  });

  /**
   * @openapi
   * /api/modules/product-builds/version-map/refresh:
   *   post:
   *     tags: [Package Analysis]
   *     summary: Force refresh version map data from the planning spreadsheet
   *     description: Clears the server cache and re-fetches from Google Sheets. Falls back to snapshot if Sheets is unavailable.
   *     responses:
   *       200:
   *         description: Refreshed version map data
   *       503:
   *         description: Google Sheets and snapshot both unavailable
   */
  router.post('/version-map/refresh', context.requireAdmin, async function (req, res) {
    _cache = null;
    _cacheAt = 0;
    const data = await fetchWithFallback('Refresh');
    if (data) return res.json(data);
    return res.status(503).json({ error: 'Version map data unavailable' });
  });

  // --- JIRA links for version map cells ---

  let _jira;
  function getJira() {
    if (!_jira) {
      _jira = createJiraClient({
        email: (context.secrets && context.secrets.JIRA_EMAIL) || '',
        token: (context.secrets && context.secrets.JIRA_TOKEN) || '',
      });
    }
    return _jira;
  }

  /**
   * @openapi
   * /api/modules/product-builds/version-map/jira-links:
   *   get:
   *     tags: [Package Analysis]
   *     summary: Get JIRA links for version map cells
   *     description: Returns a lookup map of variant feature epics and their child work items, matched by variant, release, and package name. Cached for 1 hour.
   *     responses:
   *       200:
   *         description: JIRA links map with features and per-package epics
   *       500:
   *         description: Failed to fetch JIRA data
   */
  router.get('/version-map/jira-links', async function (req, res) {
    const now = Date.now();
    if (_jiraLinksCache && (now - _jiraLinksCacheAt) < JIRA_LINKS_CACHE_TTL) {
      return res.json(_jiraLinksCache);
    }
    try {
      _jiraLinksCache = await buildJiraLinks(getJira());
      _jiraLinksCacheAt = Date.now();
      res.json(_jiraLinksCache);
    } catch (err) {
      console.error('[version-map] JIRA links fetch failed:', err.message);
      if (_jiraLinksCache) return res.json(_jiraLinksCache);
      res.status(500).json({ error: 'Failed to fetch JIRA links' });
    }
  });
};

module.exports._testExports = {
  parseFeatureSummary, extractVariantBase, extractPackageFromEpic,
};
