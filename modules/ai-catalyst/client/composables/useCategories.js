const CATEGORIES = {
  'model-inference': { name: 'Model Inference', shortName: 'Inference', color: 'blue', bgClass: 'bg-blue-100 dark:bg-blue-900/30', textClass: 'text-blue-700 dark:text-blue-300', dotClass: 'bg-blue-500' },
  'model-customization': { name: 'Model Customization', shortName: 'Customization', color: 'purple', bgClass: 'bg-purple-100 dark:bg-purple-900/30', textClass: 'text-purple-700 dark:text-purple-300', dotClass: 'bg-purple-500' },
  'agentic-ai': { name: 'Agentic AI', shortName: 'Agentic', color: 'green', bgClass: 'bg-green-100 dark:bg-green-900/30', textClass: 'text-green-700 dark:text-green-300', dotClass: 'bg-green-500' },
  'management-observability-security': { name: 'Mgmt & Security', shortName: 'Mgmt', color: 'amber', bgClass: 'bg-amber-100 dark:bg-amber-900/30', textClass: 'text-amber-700 dark:text-amber-300', dotClass: 'bg-amber-500' }
}

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

export function useCategories() {
  function getCategoryMeta(key) {
    return CATEGORIES[key] || { name: key, shortName: key, color: 'gray', bgClass: 'bg-gray-100 dark:bg-gray-700', textClass: 'text-gray-600 dark:text-gray-400', dotClass: 'bg-gray-500' }
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
    getCategoryMeta,
    getDecisionStatus,
    getDecisionMeta,
    getSourceLabel,
    getScoreColor,
    getScoreClasses
  }
}
