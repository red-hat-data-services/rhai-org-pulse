export function getVerdictClass(verdict) {
  switch (verdict) {
    case 'Ready': return 'text-green-600 dark:text-green-400'
    case 'Revise': return 'text-amber-600 dark:text-amber-400'
    case 'Rework': return 'text-red-600 dark:text-red-400'
    default: return 'text-gray-600 dark:text-gray-400'
  }
}

export function getVerdictBgClass(verdict) {
  switch (verdict) {
    case 'Ready': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
    case 'Revise': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
    case 'Rework': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  }
}

export function getVerdictLabel(verdict) {
  switch (verdict) {
    case 'Ready': return 'Ready'
    case 'Revise': return 'Revise'
    case 'Rework': return 'Rework'
    default: return verdict || 'N/A'
  }
}

export function getCriterionLabel(criterion) {
  if (!criterion) return ''
  return criterion
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function getCriterionScoreClass(score) {
  if (score === 2) return 'text-green-600 dark:text-green-400'
  if (score === 1) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export function getScoreColorClass(score, max = 10) {
  const ratio = score / max
  if (ratio >= 0.8) return 'text-green-600 dark:text-green-400'
  if (ratio >= 0.5) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export const CRITERIA = ['specificity', 'grounding', 'scope_fidelity', 'actionability', 'consistency']
