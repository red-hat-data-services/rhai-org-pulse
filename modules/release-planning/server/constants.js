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
  PRIORITY_STYLES
}
