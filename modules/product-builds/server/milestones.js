const path = require('path');
const { createGoogleSheetsClient } = require('../../../shared/server/google-sheets');

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
  const parts = cleaned.split(' ', 2);
  const version = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
  return { version: version || null, tentative };
}

function isInfra(name) {
  return INFRA_KEYWORDS.some(kw => name.includes(kw));
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

  return { sheet: sheetName, sub_variants: subVariants };
}

function loadSnapshot() {
  try {
    return require(path.join(__dirname, 'milestones-snapshot.json'));
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

/**
 * @param {import('express').Router} router
 * @param {import('@shared/server/module-context').ModuleContext} context
 */
module.exports = function registerMilestonesRoutes(router, context) {
  if (context.resolveSecret) {
    const sheetId = context.resolveSecret('MILESTONES_SPREADSHEET_ID');
    if (sheetId) _cfg.spreadsheetId = sheetId;
  }

  const googleKeyFile = (context.resolveSecret
    ? context.resolveSecret('GOOGLE_SERVICE_ACCOUNT_KEY_FILE')
    : null) || '/etc/secrets/google-sa-key.json';

  /**
   * @openapi
   * /api/modules/product-builds/milestones:
   *   get:
   *     tags: [Package Analysis]
   *     summary: Get package version milestones across releases and accelerator variants
   *     description: Returns planned package versions per release per accelerator variant from the planning spreadsheet. Falls back to a static snapshot when Google Sheets is unavailable.
   *     responses:
   *       200:
   *         description: Milestone data with releases, accelerators, sub-variants, and package versions
   */
  router.get('/milestones', async function (req, res) {
    const now = Date.now();
    if (_cache && (now - _cacheAt) < CACHE_TTL) {
      return res.json(_cache);
    }

    try {
      const data = await fetchFromSheets(googleKeyFile);
      _cache = data;
      _cacheAt = now;
      return res.json(data);
    } catch (err) {
      console.warn('[milestones] Google Sheets unavailable, using snapshot:', err.message);
      const snapshot = loadSnapshot();
      if (snapshot) {
        _cache = snapshot;
        _cacheAt = now;
        return res.json(snapshot);
      }
      return res.status(503).json({ error: 'Milestones data unavailable' });
    }
  });

  /**
   * @openapi
   * /api/modules/product-builds/milestones/refresh:
   *   post:
   *     tags: [Package Analysis]
   *     summary: Force refresh milestones data from the planning spreadsheet
   *     description: Clears the server cache and re-fetches from Google Sheets. Falls back to snapshot if Sheets is unavailable.
   *     responses:
   *       200:
   *         description: Refreshed milestone data
   *       503:
   *         description: Google Sheets and snapshot both unavailable
   */
  router.post('/milestones/refresh', async function (req, res) {
    _cache = null;
    _cacheAt = 0;

    try {
      const data = await fetchFromSheets(googleKeyFile);
      _cache = data;
      _cacheAt = Date.now();
      return res.json(data);
    } catch (err) {
      console.warn('[milestones] Refresh failed, using snapshot:', err.message);
      const snapshot = loadSnapshot();
      if (snapshot) {
        _cache = snapshot;
        _cacheAt = Date.now();
        return res.json(snapshot);
      }
      return res.status(503).json({ error: 'Milestones data unavailable' });
    }
  });
};
