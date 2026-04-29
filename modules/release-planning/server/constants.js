const JIRA_BROWSE_URL = 'https://redhat.atlassian.net/browse'

const CLOSED_STATUSES = ['Closed', 'Done', 'Resolved', 'Cancelled']
const TERMINAL_STATUSES = ['Review', 'Pending Release']

const PRIORITY_ORDER = { Blocker: 0, Critical: 1, Major: 2, Normal: 3, Minor: 4 }

const JIRA_THROTTLE_MS = 1000

const CACHE_MAX_AGE_MS = 15 * 60 * 1000 // 15 minutes

const FEATURE_COLUMNS = [
  'Big Rock', 'Feature', 'Issue status', 'Priority', 'DP/TP/GA',
  'Title', 'Component[s]', 'Target Release', 'Fix Version (Committed)',
  'PM', 'Delivery Owner', 'RFE', 'Comments'
]

const RFE_COLUMNS = [
  'Big Rock', 'RFE', 'RFE Status', 'Priority', 'Title',
  'Component[s]', 'PM', 'Labels'
]

const BIG_ROCK_COLUMNS = [
  'Pillar', 'Priority', 'Big Rock', 'Outcome', 'Outcome Description',
  'State', 'Owner', 'Features', 'RFEs', 'Notes'
]

const STATUS_STYLES = {
  'New': { bg: 'bg-gray-100 dark:bg-gray-500/20', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-300 dark:border-gray-500/30' },
  'Refinement': { bg: 'bg-purple-100 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-300 dark:border-purple-500/30' },
  'In Progress': { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-500/30' },
  'Review': { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-300 dark:border-orange-500/30' },
  'Pending Release': { bg: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-300 dark:border-yellow-500/30' },
  'Approved': { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-700 dark:text-green-400', border: 'border-green-300 dark:border-green-500/30' },
  'Stakeholder Review': { bg: 'bg-cyan-100 dark:bg-cyan-500/20', text: 'text-cyan-700 dark:text-cyan-400', border: 'border-cyan-300 dark:border-cyan-500/30' }
}

const PRIORITY_STYLES = {
  'Blocker': 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',
  'Critical': 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400',
  'Major': 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  'Normal': 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',
  'Minor': 'bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400'
}

// ─── Risk Categories ───

const RISK_CATEGORIES = {
  MILESTONE_MISS: 'MILESTONE_MISS',
  VELOCITY_LAG: 'VELOCITY_LAG',
  DOR_INCOMPLETE: 'DOR_INCOMPLETE',
  BLOCKED: 'BLOCKED',
  UNESTIMATED: 'UNESTIMATED',
  MISSING_OWNER: 'MISSING_OWNER',
  NO_BIG_ROCK: 'NO_BIG_ROCK',
  LATE_COMMITMENT: 'LATE_COMMITMENT'
}

const EXECUTION_RISK_CATEGORIES = ['MILESTONE_MISS', 'VELOCITY_LAG']
const PLANNING_RISK_CATEGORIES = ['MISSING_OWNER', 'NO_BIG_ROCK', 'LATE_COMMITMENT']
const VALID_PHASES = ['EA1', 'EA2', 'GA']
const PLANNING_DEADLINE_OFFSET_DAYS = 7

// ─── DoR Item IDs ───

const DOR_ITEM_IDS = [
  'F-1', 'F-2', 'F-3', 'F-4', 'F-5', 'F-6',
  'F-7', 'F-8', 'F-9', 'F-10', 'F-11', 'F-12', 'F-13'
]

const MANUAL_DOR_IDS = ['F-3', 'F-9', 'F-11', 'F-12', 'F-13']

// ─── Health-related Status Sets ───

// Statuses considered "early" in the workflow -- features in these states
// after a code freeze are flagged as MILESTONE_MISS
const EARLY_STATUSES = ['New', 'Refinement']

// Default phase-completion expectations by milestone.
// Keys are milestone names; values map release phase (EA1/EA2/GA/TP/DP)
// to the expected completion percentage at that milestone.
const DEFAULT_PHASE_COMPLETION_EXPECTATIONS = {
  ea1_freeze: { EA1: 90, EA2: 30, GA: 10, TP: 90, DP: 30 },
  ea1_target: { EA1: 100, EA2: 50, GA: 20, TP: 100, DP: 50 },
  ea2_freeze: { EA1: 100, EA2: 90, GA: 40, TP: 100, DP: 90 },
  ea2_target: { EA1: 100, EA2: 100, GA: 60, TP: 100, DP: 100 },
  ga_freeze:  { EA1: 100, EA2: 100, GA: 90, TP: 100, DP: 100 },
  ga_target:  { EA1: 100, EA2: 100, GA: 100, TP: 100, DP: 100 }
}

// ─── Health Enrichment Fields ───

// Lightweight fields fetched in Pass 1 for ALL features
const ENRICHMENT_FIELDS = 'description,customfield_10028,issuelinks'

// Minimal fields fetched in Pass 2 (changelog comes via expand param)
const CHANGELOG_FIELDS = 'summary'

module.exports = {
  JIRA_BROWSE_URL,
  CLOSED_STATUSES,
  TERMINAL_STATUSES,
  PRIORITY_ORDER,
  JIRA_THROTTLE_MS,
  CACHE_MAX_AGE_MS,
  FEATURE_COLUMNS,
  RFE_COLUMNS,
  BIG_ROCK_COLUMNS,
  STATUS_STYLES,
  PRIORITY_STYLES,
  RISK_CATEGORIES,
  EXECUTION_RISK_CATEGORIES,
  PLANNING_RISK_CATEGORIES,
  VALID_PHASES,
  PLANNING_DEADLINE_OFFSET_DAYS,
  DOR_ITEM_IDS,
  MANUAL_DOR_IDS,
  EARLY_STATUSES,
  DEFAULT_PHASE_COMPLETION_EXPECTATIONS,
  ENRICHMENT_FIELDS,
  CHANGELOG_FIELDS
}
