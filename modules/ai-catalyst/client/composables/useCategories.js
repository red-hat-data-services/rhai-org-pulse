const DEFAULT_CATEGORY_DEFINITIONS = {
  'model-inference': { name: 'Model Inference', shortName: 'Inference', color: '#3b82f6', bgClass: 'bg-blue-100 dark:bg-blue-900/30', textClass: 'text-blue-700 dark:text-blue-300', dotClass: 'bg-blue-500' },
  'model-customization': { name: 'Model Customization', shortName: 'Customization', color: '#a855f7', bgClass: 'bg-purple-100 dark:bg-purple-900/30', textClass: 'text-purple-700 dark:text-purple-300', dotClass: 'bg-purple-500' },
  'agentic-ai': { name: 'Agentic AI', shortName: 'Agentic', color: '#22c55e', bgClass: 'bg-green-100 dark:bg-green-900/30', textClass: 'text-green-700 dark:text-green-300', dotClass: 'bg-green-500' },
  'management-observability-security': { name: 'Mgmt & Security', shortName: 'Mgmt', color: '#f59e0b', bgClass: 'bg-amber-100 dark:bg-amber-900/30', textClass: 'text-amber-700 dark:text-amber-300', dotClass: 'bg-amber-500' }
}

// Keep the existing exports as a compatibility fallback for older cached API
// responses. New screens should pass the pillar registry returned by the API.
const CATEGORIES = DEFAULT_CATEGORY_DEFINITIONS

const CATEGORY_KEYS = Object.keys(CATEGORIES)

const DECISION_STATUSES = {
  pending: { label: 'Pending', dotClass: 'bg-gray-400', bgClass: 'bg-gray-100 dark:bg-gray-700', textClass: 'text-gray-600 dark:text-gray-400' },
  approved: { label: 'Approved', dotClass: 'bg-green-500', bgClass: 'bg-green-100 dark:bg-green-900/30', textClass: 'text-green-700 dark:text-green-300' },
  declined: { label: 'Declined', dotClass: 'bg-red-500', bgClass: 'bg-red-100 dark:bg-red-900/30', textClass: 'text-red-700 dark:text-red-300' },
  revisit: { label: 'Revisit', dotClass: 'bg-amber-500', bgClass: 'bg-amber-100 dark:bg-amber-900/30', textClass: 'text-amber-700 dark:text-amber-300' }
}

const SOURCE_LABELS = {
  github: 'GitHub',
  hn: 'Hacker News',
  reddit: 'Reddit'
}

const FALLBACK_COLORS = [
  '#3b82f6', '#a855f7', '#22c55e', '#f59e0b', '#06b6d4', '#ec4899', '#ef4444', '#14b8a6', '#f97316', '#6366f1'
]

const COLOR_NAMES = {
  blue: '#3b82f6',
  purple: '#a855f7',
  green: '#22c55e',
  amber: '#f59e0b',
  cyan: '#06b6d4',
  red: '#ef4444',
  pink: '#ec4899',
  teal: '#14b8a6',
  orange: '#f97316',
  indigo: '#6366f1',
  gray: '#6b7280'
}

const KNOWN_PILLAR_COLORS = {
  'model-inference': '#3b82f6',
  'model-customization': '#a855f7',
  'agentic-ai': '#22c55e',
  'management-observability-security': '#f59e0b',
  'data-science-engineering': '#06b6d4'
}

function hashKey(key) {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0
  return hash >>> 0
}

function normalizeColor(color, key) {
  if (typeof color === 'string') {
    const trimmed = color.trim()
    if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed
    if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
      return '#' + trimmed.slice(1).split('').map(c => c + c).join('')
    }
    if (COLOR_NAMES[trimmed.toLowerCase()]) return COLOR_NAMES[trimmed.toLowerCase()]
  }
  const normalizedKey = String(key || '').trim().toLowerCase()
  if (KNOWN_PILLAR_COLORS[normalizedKey]) return KNOWN_PILLAR_COLORS[normalizedKey]
  return FALLBACK_COLORS[hashKey(normalizedKey) % FALLBACK_COLORS.length]
}

function humanizeKey(key) {
  return String(key || 'Unknown')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Convert the server's strategy_pillars row shape into the metadata consumed
 * by all AI Catalyst client views. The server may expose camelCase fields or
 * the original spreadsheet snake_case fields while a sync is in flight.
 */
function normalizePillar(pillar, index = 0) {
  const key = pillar?.pillarKey || pillar?.pillar_key || pillar?.key || pillar?.category || `pillar-${index + 1}`
  const fallback = DEFAULT_CATEGORY_DEFINITIONS[key] || {}
  const title = pillar?.title || pillar?.name || fallback.name || humanizeKey(key)
  const shortName = pillar?.shortTitle || pillar?.short_title || pillar?.shortName || fallback.shortName || title
  const color = normalizeColor(pillar?.color || fallback.color, key)
  const rawSortOrder = pillar?.sortOrder ?? pillar?.sort_order
  const sortOrder = Number.isFinite(Number(rawSortOrder)) ? Number(rawSortOrder) : index
  return {
    ...pillar,
    pillarKey: key,
    title,
    name: title,
    shortName,
    shortTitle: shortName,
    color,
    bgClass: pillar?.bgClass || fallback.bgClass || 'bg-gray-100 dark:bg-gray-700',
    textClass: pillar?.textClass || fallback.textClass || 'text-gray-700 dark:text-gray-300',
    dotClass: pillar?.dotClass || fallback.dotClass || 'bg-gray-500',
    sortOrder
  }
}

function getPillarRegistry(pillars = [], candidates = []) {
  const supplied = Array.isArray(pillars) ? pillars.filter(Boolean).map(normalizePillar) : []
  const registry = supplied.length ? supplied : Object.entries(DEFAULT_CATEGORY_DEFINITIONS).map(([pillarKey, meta], index) => normalizePillar({ pillarKey, ...meta }, index))
  const seen = new Set(registry.map(p => p.pillarKey))
  for (const candidate of (Array.isArray(candidates) ? candidates : [])) {
    const key = candidate?.category || candidate?.pillarKey || candidate?.strategyPillarKey
    if (key && !seen.has(key)) {
      registry.push(normalizePillar({ pillarKey: key }, registry.length))
      seen.add(key)
    }
  }
  return registry.sort((a, b) => (a.sortOrder - b.sortOrder) || a.pillarKey.localeCompare(b.pillarKey))
}

function colorWithAlpha(color, alpha = 1) {
  const hex = normalizeColor(color, '')
  const value = hex.slice(1)
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function useCategories() {
  function getCategoryMeta(key, pillars = []) {
    const registry = getPillarRegistry(pillars)
    const normalizedKey = key || 'unknown'
    return registry.find(p => p.pillarKey === normalizedKey) || normalizePillar({ pillarKey: normalizedKey })
  }

  function getDecisionStatus(candidate) {
    const dec = (candidate.pmDecision || '').toLowerCase()
    if (!dec) return 'pending'
    if (dec.includes('approve')) return 'approved'
    if (dec.includes('decline')) return 'declined'
    if (dec.includes('revisit')) return 'revisit'
    return 'pending'
  }

  function getDecisionMeta(status) {
    return DECISION_STATUSES[status] || DECISION_STATUSES.pending
  }

  function getSourceLabel(source) {
    return SOURCE_LABELS[source] || source
  }

  function getScoreColor(score) {
    if (score == null) return 'gray'
    if (score >= 7) return 'green'
    if (score >= 4) return 'amber'
    return 'red'
  }

  function getScoreClasses(score) {
    const color = getScoreColor(score)
    const map = {
      green: 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30',
      amber: 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30',
      red: 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30',
      gray: 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700'
    }
    return map[color]
  }

  return {
    CATEGORIES,
    CATEGORY_KEYS,
    DECISION_STATUSES,
    SOURCE_LABELS,
    normalizePillar,
    getPillarRegistry,
    colorWithAlpha,
    getCategoryMeta,
    getDecisionStatus,
    getDecisionMeta,
    getSourceLabel,
    getScoreColor,
    getScoreClasses
  }
}
