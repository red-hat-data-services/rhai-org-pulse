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
  short_title: 'shortTitle',
  summary: 'summary',
  sort_order: 'sortOrder',
  visual_url: 'visualUrl',
  color: 'color',
};

// Keep the fallback palette stable. The key-based hash means a new pillar can
// be added to the sheet without needing a code change just to get a colour.
const PILLAR_FALLBACK_COLORS = [
  '#3b82f6', // blue
  '#a855f7', // purple
  '#22c55e', // green
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#ef4444', // red
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
];

const KNOWN_PILLAR_COLORS = {
  'model-inference': '#3b82f6',
  'model-customization': '#a855f7',
  'agentic-ai': '#22c55e',
  'management-observability-security': '#f59e0b',
  'data-science-engineering': '#06b6d4',
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

function humanizePillarKey(key) {
  return String(key || '')
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getPillarColor(key) {
  const normalizedKey = String(key || '').trim().toLowerCase();
  if (KNOWN_PILLAR_COLORS[normalizedKey]) return KNOWN_PILLAR_COLORS[normalizedKey];

  // A small deterministic hash is preferable to an index-based choice here:
  // inserting a new pillar should not change the colours of existing pillars.
  let hash = 0;
  for (let i = 0; i < normalizedKey.length; i++) {
    hash = ((hash << 5) - hash + normalizedKey.charCodeAt(i)) | 0;
  }
  const index = (hash >>> 0) % PILLAR_FALLBACK_COLORS.length;
  return PILLAR_FALLBACK_COLORS[index];
}

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim());
}

function normalizePillar(pillar) {
  const source = pillar && typeof pillar === 'object' ? pillar : {};
  const pillarKey = String(source.pillarKey || '').trim();
  if (!pillarKey) return null;

  const title = String(source.title || '').trim() || humanizePillarKey(pillarKey);
  const shortTitle = String(source.shortTitle || '').trim() || title;
  const sortOrder = Number(source.sortOrder);

  return {
    ...source,
    pillarKey,
    title,
    shortTitle,
    summary: String(source.summary || '').trim(),
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 999,
    visualUrl: String(source.visualUrl || '').trim(),
    color: isHexColor(source.color) ? source.color.trim().toLowerCase() : getPillarColor(pillarKey),
  };
}

/**
 * Build the shared pillar catalog used by board and showcase responses.
 *
 * Sheet metadata is authoritative when present, but category keys referenced
 * by data are also represented so a new pillar can be used before its metadata
 * row is refreshed. This keeps the data visible and gives it deterministic
 * display metadata until the sheet catches up.
 */
function mergePillarMetadata(pillars, referencedKeys) {
  const byKey = new Map();

  for (const pillar of Array.isArray(pillars) ? pillars : []) {
    const normalized = normalizePillar(pillar);
    if (!normalized) continue;
    const existing = byKey.get(normalized.pillarKey);
    byKey.set(normalized.pillarKey, existing ? { ...existing, ...normalized } : normalized);
  }

  for (const key of Array.isArray(referencedKeys) ? referencedKeys : []) {
    const pillarKey = String(key || '').trim();
    if (!pillarKey || byKey.has(pillarKey)) continue;
    byKey.set(pillarKey, normalizePillar({ pillarKey }));
  }

  return [...byKey.values()].sort((a, b) => {
    const orderDiff = (a.sortOrder || 999) - (b.sortOrder || 999);
    return orderDiff || a.pillarKey.localeCompare(b.pillarKey);
  });
}

function getReferencedPillarKeys(entries, candidates) {
  const keys = new Set();
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (entry && entry.strategyPillarKey) keys.add(String(entry.strategyPillarKey).trim());
  }
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    if (candidate && candidate.category) keys.add(String(candidate.category).trim());
  }
  return [...keys].filter(Boolean);
}

function normalizeShowcaseData(data) {
  const source = data && typeof data === 'object' ? data : {};
  const entries = Array.isArray(source.entries) ? source.entries : [];
  const pillars = mergePillarMetadata(
    source.pillars,
    getReferencedPillarKeys(entries),
  );

  return {
    ...source,
    entries,
    pillars,
    fetchedAt: source.fetchedAt || null,
  };
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

  const result = normalizeShowcaseData({
    entries: entries.sort((a, b) => a.sortOrder - b.sortOrder),
    pillars,
    fetchedAt: new Date().toISOString(),
  });

  _cache = { data: result, ts: Date.now() };

  if (storage) {
    await storage.writeToStorage(STORAGE_KEY, result);
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
      const stored = await storage.readFromStorage(STORAGE_KEY);
      if (stored) {
        console.error('[ai-catalyst:showcase] Sheet fetch failed, using stored fallback:', err.message);
        _cache = { data: stored, ts: 0 };
        return normalizeShowcaseData(stored);
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
  humanizePillarKey,
  getPillarColor,
  normalizePillar,
  mergePillarMetadata,
  getReferencedPillarKeys,
  normalizeShowcaseData,
  ENTRY_COLUMN_MAP,
  PILLAR_COLUMN_MAP,
  PIPE_DELIMITED_FIELDS,
  STORAGE_KEY,
};
