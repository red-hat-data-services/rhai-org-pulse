const { createFeedClient, FeedError } = require('../feed-client');

const STORAGE_KEY = 'ai-catalyst/showcase/showcase-data.json';
const CACHE_TTL = 5 * 60 * 1000;
// Read routes must degrade to stored data quickly when the showcase host is
// unreachable — only the sync paths wait out the full fetch timeout.
const READ_PATH_TIMEOUT_MS = 5000;

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
// be added to the feed without needing a code change just to get a colour.
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

const ARRAY_FIELDS = new Set([
  'capabilityTags', 'customerNeedTags', 'searchKeywords',
  'knownGoodWith', 'githubUrl', 'quayUrl', 'otherResourceUrls',
]);

let _cache = null;

/**
 * Parse a list field from the POC Explorer showcase feed. Feed rows keep
 * native arrays, but string forms are accepted for robustness: the current
 * feed joins with ", " and values from the old sheet era are pipe-joined.
 */
function parseArrayField(value) {
  if (Array.isArray(value)) {
    return value.map(s => s.trim()).filter(Boolean);
  }
  if (!value || typeof value !== 'string') return [];
  const parts = value.includes('|') ? value.split('|') : value.split(', ');
  return parts.map(s => s.trim()).filter(Boolean);
}

function mapRow(row, columnMap) {
  const obj = {};
  const source = row || {};
  for (const [header, key] of Object.entries(columnMap)) {
    const raw = source[header];
    if (ARRAY_FIELDS.has(key)) {
      if (raw != null && typeof raw !== 'string' && !(Array.isArray(raw) && raw.every(s => typeof s === 'string'))) {
        throw new FeedError(`invalid showcase field "${header}" — expected a string or an array of strings`);
      }
      obj[key] = parseArrayField(raw);
    } else {
      if (raw != null && typeof raw === 'object') {
        throw new FeedError(`invalid showcase field "${header}" — expected a scalar value`);
      }
      let val = String(raw === undefined || raw === null ? '' : raw).trim();
      if (key === 'sortOrder') {
        const n = parseInt(val, 10);
        val = Number.isFinite(n) ? n : 999;
      }
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
 * Feed pillar metadata is authoritative when present, but category keys referenced
 * by data are also represented so a new pillar can be used before its metadata
 * row is refreshed. This keeps the data visible and gives it deterministic
 * display metadata until the feed catches up.
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
    const orderDiff = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
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

async function fetchShowcaseData(baseUrl, token, storage, allowedOrigins, allowLoopback, timeoutMs) {
  const client = createFeedClient({ baseUrl, token, allowedOrigins, allowLoopback, timeoutMs });
  const payload = await client.getShowcase();

  // The producer validates slug and pillar_key at load time, so a mapped row
  // without its key means a degraded feed: reject the payload instead of
  // silently dropping rows, which would wipe the stored catalog.
  const entries = payload.showcase_entries.map(row => mapRow(row, ENTRY_COLUMN_MAP));
  if (entries.some(e => !e.slug)) {
    throw new FeedError('unexpected response shape from /feed/showcase.json — every "showcase_entries" row must carry a non-empty slug');
  }

  const pillars = payload.strategy_pillars.map(row => mapRow(row, PILLAR_COLUMN_MAP));
  if (pillars.some(p => !p.pillarKey)) {
    throw new FeedError('unexpected response shape from /feed/showcase.json — every "strategy_pillars" row must carry a non-empty pillar_key');
  }
  pillars.sort((a, b) => a.sortOrder - b.sortOrder);

  const result = normalizeShowcaseData({
    entries: entries.sort((a, b) => a.sortOrder - b.sortOrder),
    pillars,
    fetchedAt: new Date().toISOString(),
  });

  if (storage) {
    await storage.writeToStorage(STORAGE_KEY, result);
  }
  // Set only after the storage write so a failed sync cannot leave the
  // in-memory cache ahead of the preserved stored catalog.
  _cache = { data: result, ts: Date.now() };

  return result;
}

async function getShowcaseData(baseUrl, token, storage, allowedOrigins, allowLoopback, timeoutMs = READ_PATH_TIMEOUT_MS) {
  if (_cache && Date.now() - _cache.ts < CACHE_TTL) {
    return _cache.data;
  }

  try {
    // A warm cache must not depend on reading configuration from the PVC.
    const url = typeof baseUrl === 'function' ? await baseUrl() : baseUrl;
    return await fetchShowcaseData(url, token, storage, allowedOrigins, allowLoopback, timeoutMs);
  } catch (err) {
    if (_cache) {
      console.error('[ai-catalyst:showcase] Feed fetch failed, using cached data:', err.message);
      return _cache.data;
    }

    if (storage) {
      const stored = await storage.readFromStorage(STORAGE_KEY);
      if (stored) {
        console.error('[ai-catalyst:showcase] Feed fetch failed, using stored fallback:', err.message);
        const normalized = normalizeShowcaseData(stored);
        _cache = { data: normalized, ts: 0 };
        return normalized;
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
  READ_PATH_TIMEOUT_MS,
  ENTRY_COLUMN_MAP,
  PILLAR_COLUMN_MAP,
  ARRAY_FIELDS,
  STORAGE_KEY,
};
