/**
 * Autofix pipeline constants — duplicated from ai-impact module.
 * Cross-module imports are forbidden (hard constraint #1), so these
 * are maintained as a local copy. The pipeline label set is stable.
 */

export const STATE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'triage-pending', label: 'AI Assessing' },
  { value: 'triage-missing-info', label: 'Missing Info' },
  { value: 'triage-not-fixable', label: 'Not AI-Fixable' },
  { value: 'triage-stale', label: 'Stale' },
  { value: 'triage-external', label: 'External Reporter' },
  { value: 'triage-security-review', label: 'Security Review' },
  { value: 'autofix-ready', label: 'Queued for AI' },
  { value: 'autofix-pending', label: 'AI Working' },
  { value: 'autofix-review', label: 'AI Fix Under Review' },
  { value: 'autofix-ci-failing', label: 'AI Fix CI Failing' },
  { value: 'autofix-merged', label: 'AI Fix Merged' },
  { value: 'autofix-rejected', label: 'AI Fix Rejected' },
  { value: 'autofix-max-retries', label: 'AI Max Retries' },
  { value: 'autofix-blocked', label: 'AI Blocked' }
]

export const PIPELINE_BAR_SEGMENTS = [
  { state: 'autofix-merged', label: 'Merged', color: 'bg-indigo-500' },
  { state: 'autofix-review', label: 'Review', color: 'bg-blue-500' },
  { state: 'autofix-pending', label: 'Pending', color: 'bg-gray-400' },
  { state: 'autofix-ci-failing', label: 'CI Failing', color: 'bg-orange-500' },
  { state: 'autofix-blocked', label: 'Blocked', color: 'bg-yellow-500' },
  { state: 'autofix-max-retries', label: 'Max Retries', color: 'bg-red-500' }
]

export function stateLabel(state) {
  const opt = STATE_OPTIONS.find(o => o.value === state)
  return opt ? opt.label : state
}

export function stateColorClass(state) {
  if (state === 'autofix-merged') return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
  if (state === 'autofix-review') return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
  if (state === 'autofix-ci-failing') return 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'
  if (state === 'autofix-pending' || state === 'autofix-ready') return 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400'
  if (state === 'autofix-rejected') return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
  if (state === 'autofix-max-retries') return 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'
  if (state === 'autofix-blocked' || state === 'triage-missing-info') return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
  if (state === 'triage-not-fixable') return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
  if (state === 'triage-stale') return 'bg-gray-100 dark:bg-gray-600/20 text-gray-600 dark:text-gray-400'
  if (state === 'triage-external') return 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400'
  if (state === 'triage-security-review') return 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400'
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
}

export const TERMINAL_STATES = new Set([
  'autofix-merged', 'autofix-rejected', 'autofix-max-retries'
])

export function getLastWeekBounds() {
  const now = new Date()
  const day = now.getUTCDay()
  const diffToMonday = day === 0 ? 6 : day - 1
  const thisMonday = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday
  ))
  const lastMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000)
  return { start: lastMonday.getTime(), end: thisMonday.getTime() }
}

export function issueTimestamp(issue, isLastWeek) {
  if (isLastWeek && TERMINAL_STATES.has(issue.pipelineState) && issue.terminalAt) {
    return new Date(issue.terminalAt).getTime()
  }
  return new Date(issue.created).getTime()
}

/**
 * Compute autofix metrics for a set of team-filtered issues.
 * Mirrors computeAutofixMetrics() from ai-impact autofix-fetcher.js.
 */
export function computeTeamMetrics(issues, timeWindow) {
  const isLastWeek = timeWindow === 'lastWeek'
  let windowStart, windowEnd

  if (isLastWeek) {
    const bounds = getLastWeekBounds()
    windowStart = bounds.start
    windowEnd = bounds.end
  } else {
    const days = timeWindow === 'week' ? 7 : timeWindow === 'month' ? 30 : 90
    windowEnd = Date.now()
    windowStart = windowEnd - days * 24 * 60 * 60 * 1000
  }

  const windowIssues = issues.filter(i => {
    const ts = issueTimestamp(i, isLastWeek)
    return ts >= windowStart && ts < windowEnd
  })

  const triageTotal = windowIssues.filter(i =>
    i.pipelineState.startsWith('triage-') || i.pipelineState.startsWith('autofix-')
  ).length

  const triageVerdicts = {
    ready: windowIssues.filter(i => i.pipelineState.startsWith('autofix-')).length,
    missingInfo: windowIssues.filter(i => i.pipelineState === 'triage-missing-info').length,
    notFixable: windowIssues.filter(i => i.pipelineState === 'triage-not-fixable').length,
    stale: windowIssues.filter(i => i.pipelineState === 'triage-stale').length,
    pending: windowIssues.filter(i => i.pipelineState === 'triage-pending').length,
    external: windowIssues.filter(i => i.pipelineState === 'triage-external').length,
    securityReview: windowIssues.filter(i => i.pipelineState === 'triage-security-review').length
  }

  const autofixStates = {
    ready: windowIssues.filter(i => i.pipelineState === 'autofix-ready').length,
    pending: windowIssues.filter(i => i.pipelineState === 'autofix-pending').length,
    review: windowIssues.filter(i => i.pipelineState === 'autofix-review').length,
    ciFailing: windowIssues.filter(i => i.pipelineState === 'autofix-ci-failing').length,
    merged: windowIssues.filter(i => i.pipelineState === 'autofix-merged').length,
    rejected: windowIssues.filter(i => i.pipelineState === 'autofix-rejected').length,
    maxRetries: windowIssues.filter(i => i.pipelineState === 'autofix-max-retries').length,
    blocked: windowIssues.filter(i => i.pipelineState === 'autofix-blocked').length
  }

  const terminalTotal = autofixStates.merged + autofixStates.rejected + autofixStates.maxRetries
  const successRate = terminalTotal > 0 ? Math.round((autofixStates.merged / terminalTotal) * 100) : 0

  return {
    triageTotal,
    triageVerdicts,
    autofixStates,
    autofixTotal: triageVerdicts.ready,
    successRate,
    terminalTotal,
    windowTotal: windowIssues.length,
    totalIssues: issues.length
  }
}

/**
 * Build weekly-bucketed trend data from team-filtered issues.
 * Mirrors buildTrendData() from ai-impact autofix-fetcher.js.
 */
export function buildTeamTrendData(issues, timeWindow) {
  const isLW = timeWindow === 'lastWeek'
  const weekCounts = (timeWindow === 'week' || isLW) ? 4 : timeWindow === 'month' ? 8 : 13
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000
  let anchor
  if (isLW) {
    const { end: thisMonday } = getLastWeekBounds()
    anchor = thisMonday
  } else {
    anchor = Date.now()
  }
  const points = []
  for (let w = weekCounts - 1; w >= 0; w--) {
    const weekEnd = new Date(anchor - w * MS_PER_WEEK)
    const weekStart = new Date(weekEnd.getTime() - MS_PER_WEEK)
    const weekIssues = issues.filter(i => {
      const ts = issueTimestamp(i, isLW)
      return ts >= weekStart.getTime() && ts < weekEnd.getTime()
    })
    const triaged = weekIssues.filter(i => i.pipelineState.startsWith('triage-') || i.pipelineState.startsWith('autofix-')).length
    const autofixed = weekIssues.filter(i => i.pipelineState.startsWith('autofix-')).length
    const merged = weekIssues.filter(i => i.pipelineState === 'autofix-merged').length
    const review = weekIssues.filter(i => i.pipelineState === 'autofix-review').length
    points.push({
      date: weekEnd.toISOString().slice(0, 10),
      triaged,
      autofixed,
      merged,
      review,
      total: weekIssues.length
    })
  }
  return points
}
