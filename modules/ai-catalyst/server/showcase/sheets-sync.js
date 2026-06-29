const { createGoogleSheetsClient } = require('../../../../shared/server/google-sheets');

const ENTRIES_TAB = 'showcase_entries';
const PILLARS_TAB = 'strategy_pillars';

const STORAGE_KEY = 'ai-catalyst/showcase/showcase-data.json';
const CACHE_TTL = 5 * 60 * 1000;

const ENTRY_COLUMN_MAP = {
  slug: 'slug',
  title: 'title',
  status: 'status',
  sort_order: 'sortOrder',
  short_summary: 'shortSummary',
  customer_problem: 'customerProblem',
  solution_summary: 'solutionSummary',
  capability_tags: 'capabilityTags',
  customer_need_tags: 'customerNeedTags',
  strategy_pillar_key: 'strategyPillarKey',
  lineage: 'lineage',
  openshift_story: 'openshiftStory',
  open_source_story: 'openSourceStory',
  ubi_story: 'ubiStory',
  demo_video_url: 'demoVideoUrl',
  poster_image_url: 'posterImageUrl',
  github_url: 'githubUrl',
  quay_url: 'quayUrl',
  blog_url: 'blogUrl',
  org_pulse_url: 'orgPulseUrl',
  other_resource_urls: 'otherResourceUrls',
  mermaid_source: 'mermaidSource',
  search_keywords: 'searchKeywords',
  known_good_with: 'knownGoodWith',
  sales_notes: 'salesNotes',
};

const PILLAR_COLUMN_MAP = {
  pillar_key: 'pillarKey',
  title: 'title',
  summary: 'summary',
  sort_order: 'sortOrder',
  visual_url: 'visualUrl',
};

const PIPE_DELIMITED_FIELDS = new Set([
  'capabilityTags', 'customerNeedTags', 'searchKeywords',
  'knownGoodWith', 'githubUrl', 'quayUrl', 'otherResourceUrls',
]);

let _cache = null;

function parseArrayField(value) {
  if (!value || typeof value !== 'string') return [];
  return value.split('|').map(s => s.trim()).filter(Boolean);
}

function mapRow(headers, row, columnMap) {
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase().trim();
    const key = columnMap[header];
    if (!key) continue;
    let val = i < row.length ? row[i] : '';
    if (val === undefined || val === null) val = '';
    if (typeof val !== 'number') val = String(val).trim();
    if (PIPE_DELIMITED_FIELDS.has(key)) {
      obj[key] = parseArrayField(val);
    } else if (key === 'sortOrder') {
      obj[key] = parseInt(val, 10) || 999;
    } else {
      obj[key] = val;
    }
  }
  return obj;
}

async function fetchShowcaseData(sheetId, keyFilePath, storage) {
  const client = createGoogleSheetsClient({ keyFile: keyFilePath });

  const [entriesRaw, pillarsRaw] = await Promise.all([
    client.fetchRawSheet(sheetId, ENTRIES_TAB),
    client.fetchRawSheet(sheetId, PILLARS_TAB),
  ]);

  const entries = entriesRaw.rows
    .map(row => mapRow(entriesRaw.headers, row, ENTRY_COLUMN_MAP))
    .filter(e => e.slug);

  const pillars = pillarsRaw.rows
    .map(row => mapRow(pillarsRaw.headers, row, PILLAR_COLUMN_MAP))
    .filter(p => p.pillarKey)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const result = {
    entries: entries.sort((a, b) => a.sortOrder - b.sortOrder),
    pillars,
    fetchedAt: new Date().toISOString(),
  };

  _cache = { data: result, ts: Date.now() };

  if (storage) {
    storage.writeToStorage(STORAGE_KEY, result);
  }

  return result;
}

async function getShowcaseData(sheetId, keyFilePath, storage) {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL) {
    return _cache.data;
  }

  try {
    return await fetchShowcaseData(sheetId, keyFilePath, storage);
  } catch (err) {
    if (_cache) {
      console.error('[ai-catalyst:showcase] Sheet fetch failed, using cached data:', err.message);
      return _cache.data;
    }

    if (storage) {
      const stored = storage.readFromStorage(STORAGE_KEY);
      if (stored) {
        console.error('[ai-catalyst:showcase] Sheet fetch failed, using stored fallback:', err.message);
        _cache = { data: stored, ts: 0 };
        return stored;
      }
    }

    throw err;
  }
}

function clearCache() {
  _cache = null;
}

module.exports = {
  fetchShowcaseData,
  getShowcaseData,
  clearCache,
  parseArrayField,
  mapRow,
  ENTRY_COLUMN_MAP,
  PILLAR_COLUMN_MAP,
  PIPE_DELIMITED_FIELDS,
  STORAGE_KEY,
};
