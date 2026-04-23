export function getRecommendationClass(rec) {
  switch (rec) {
    case 'approve': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
    case 'revise': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
    case 'reject': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
    default: return 'bg-gray-100 text-gray-600'
  }
}

export function getRecommendationLabel(rec) {
  switch (rec) {
    case 'approve': return 'Approve'
    case 'revise': return 'Needs Revision'
    case 'reject': return 'Reject'
    default: return rec || 'N/A'
  }
}

export function getHumanReviewClass(status) {
  switch (status) {
    case 'reviewed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
    case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  }
}

export function getHumanReviewLabel(status) {
  switch (status) {
    case 'reviewed': return 'Human Reviewed'
    case 'pending': return 'Awaiting Human Review'
    default: return 'Human Review: Not Required'
  }
}

export function getScoreClass(score) {
  if (score === 2) return 'text-green-600 dark:text-green-400'
  if (score === 1) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}
