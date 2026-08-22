export function getTrendClass(trend) {
  if (trend === 'growing') return 'text-green-600 dark:text-green-400'
  if (trend === 'declining') return 'text-red-600 dark:text-red-400'
  return 'text-gray-500 dark:text-gray-400'
}

export function formatChange(change) {
  if (change > 0) return `+${change}%`
  return `${change}%`
}

export function formatFrictionChange(change) {
  if (change > 0) return `+${change}pp`
  if (change < 0) return `${change}pp`
  return '—'
}
