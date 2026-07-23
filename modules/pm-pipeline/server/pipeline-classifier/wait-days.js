import { PRIORITY_ORDER } from './constants.js'

/**
 * Compute days waiting since last relevant update.
 */
export function computeWaitDays(item, stage) {
  let dateStr = item.updated || item.created
  if (stage.playbookSection === 6 || stage.id === 'strat-awaiting-signoff') {
    dateStr = item.reviewedAt || item.updated || item.created
  }
  if (!dateStr) return 0
  const ms = new Date(dateStr).getTime()
  if (Number.isNaN(ms)) return 0
  return Math.max(0, Math.floor((Date.now() - ms) / (1000 * 60 * 60 * 24)))
}

export function sortPipelineItems(items) {
  return [...items].sort((a, b) => {
    if (a.stage.pmActionable !== b.stage.pmActionable) {
      return a.stage.pmActionable ? -1 : 1
    }
    const waitDiff = b.waitDays - a.waitDays
    if (waitDiff !== 0) return waitDiff
    return (PRIORITY_ORDER[a.priority] ?? 10) - (PRIORITY_ORDER[b.priority] ?? 10)
  })
}
