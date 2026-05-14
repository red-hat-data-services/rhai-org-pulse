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

export function getReviewStatusClass(status) {
  switch (status) {
    case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
    case 'needs-review': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
    case 'awaiting-review': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  }
}

export function getReviewStatusLabel(status) {
  switch (status) {
    case 'approved': return 'Approved'
    case 'needs-review': return 'Flagged'
    case 'awaiting-review': return 'Awaiting Sign-off'
    default: return 'Awaiting Sign-off'
  }
}

export function getReviewStatusTooltip(status) {
  switch (status) {
    case 'approved': return 'A human engineer has reviewed and signed off on this feature. No further action needed.'
    case 'needs-review': return 'The AI pipeline flagged concerns. Open in Jira, add feedback in the Staff Engineer Input section of the description, then remove the strat-creator-needs-attention label to unblock re-refinement.'
    case 'awaiting-review': return 'This feature passed AI review but still needs a human to review and sign off. Open in Jira and add the strat-creator-human-sign-off label when ready.'
    default: return 'This feature has not yet been reviewed by a human. Open in Jira to review and sign off.'
  }
}

export function getRecommendationTooltip(rec) {
  switch (rec) {
    case 'approve': return 'All AI reviewers recommend approval. The feature still needs human sign-off.'
    case 'revise': return 'One or more AI reviewers flagged issues to address before this feature is ready.'
    case 'reject': return 'AI reviewers found significant concerns. This feature needs rework before proceeding.'
    default: return ''
  }
}

export function getScoreClass(score) {
  if (score === 2) return 'text-green-600 dark:text-green-400'
  if (score === 1) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}
