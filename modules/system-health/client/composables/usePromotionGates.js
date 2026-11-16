import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const LATEST_ENDPOINT = '/modules/system-health/promotion-gates/latest'
const SUMMARY_ENDPOINT = '/modules/system-health/promotion-gates/summary'

/** Short repo name: last path segment of a full `org/repo` string, lowercased for joins. */
export function repoKey(repo) {
  return String(repo || '').split('/').pop().toLowerCase()
}

/** A child PR is a problem when its status is anything other than `success`. */
export function isPrProblem(pr) {
  return prStatus(pr) !== 'success'
}

export function prStatus(pr) {
  return String(pr && pr['pr-status'] || '').toLowerCase()
}

/**
 * Why a child PR is blocked: the observed gate reason, else the reason of the
 * first non-success run, else the raw status.
 */
export function prProblemReason(pr) {
  const obs = (pr && pr['build-observations']) || {}
  const reason = obs['gate-reason']
  if (reason) return compactReason(reason, obs.runs || [])
  const run = (obs.runs || []).find((r) => String(r.status || '').toLowerCase() !== 'success')
  if (run && run.reason) return run.reason
  return pr['pr-status'] || 'unknown'
}

/**
 * The failure mode, without the parts the row already shows.
 *
 * The bot's gate reason opens with the failing component name and ends with
 * "(+N more)", both of which the row already renders as build links. Strip
 * them, and reduce "Konflux failure: Failed" to "Failed".
 */
export function compactReason(reason, runs = []) {
  let text = String(reason || '').trim()
  const names = runs
    .map((run) => run.component || run.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  for (const name of names) {
    if (text.startsWith(`${name} `)) {
      text = text.slice(name.length + 1)
      break
    }
  }
  // The bot prefixes the reason with the failing component even when that
  // run is not in the current observations, so drop a leading token when a
  // "Konflux ..." clause follows it.
  text = text.replace(/^\S+\s+(?=Konflux\b)/, '')
  text = text.replace(/\s*\(\+\d+ more\)\s*$/, '')
  const mode = /^Konflux\b[^:]*:\s*(.+)$/.exec(text)
  if (mode) text = mode[1]
  return text.trim() || String(reason || '').trim()
}

/** Statuses that are a hard failure, as opposed to still running or unknown. */
export const BLOCKING_STATUSES = ['build-failure', 'merge-failure']

export function isBlockingPr(pr) {
  return BLOCKING_STATUSES.includes(prStatus(pr))
}

/**
 * Overall verdict for the latest job, in display priority order:
 * `blocked` (a hard failure or a failed gate), `complete` (everything promoted
 * and the leader PR merged), `progress` (anything still running or unknown)
 * and `empty` (no components collected yet).
 */
export function promotionVerdict(job) {
  const state = (job && job.state_json) || {}
  const pullRequests = state['pull-requests'] || []
  if (pullRequests.length === 0) return 'empty'

  const gates = state['promotion-gates'] || []
  if (gates.some((gate) => String(gate.status || '').toLowerCase() === 'failed')) return 'blocked'

  const build = job && job.early_gate && job.early_gate.build
  if (String((build && build.status) || '').toLowerCase() === 'failed') return 'blocked'

  if (pullRequests.some(isBlockingPr)) return 'blocked'

  const allPromoted = pullRequests.every((pr) => prStatus(pr) === 'success')
  // Only a merged leader PR means the promotion landed; a closed one was abandoned.
  if (allPromoted && String(job.state || '').toUpperCase() === 'MERGED') return 'complete'

  return 'progress'
}

/**
 * Jira and Slack links per repo, from the job's `failure_links` (parsed by the
 * collector from the GAP bot's failure-summary comment). Jira keys are the
 * last path segment, so the staging and production Jira hosts both work.
 */
export function failureLinksByRepo(job) {
  const links = (job && job.failure_links) || []
  const byRepo = {}
  for (const link of links) {
    if (!link || !link.repo) continue
    const entry = byRepo[link.repo] || (byRepo[link.repo] = { jira: [], slack: [] })
    if (link.jira_url) {
      entry.jira.push({
        key: String(link.jira_url).split('/').filter(Boolean).pop() || 'Jira',
        url: link.jira_url,
        label: link.label || null
      })
    }
    if (link.slack_url && !entry.slack.includes(link.slack_url)) {
      entry.slack.push(link.slack_url)
    }
  }
  return byRepo
}

/** Summary counts over `state_json["pull-requests"]`: ok / failing / pending. */
export function summarizePullRequests(pullRequests) {
  const summary = { ok: 0, failing: 0, pending: 0, total: 0 }
  for (const pr of pullRequests || []) {
    summary.total++
    const status = prStatus(pr)
    if (status === 'success') summary.ok++
    else if (status === 'build-pending' || status === 'pending') summary.pending++
    else summary.failing++
  }
  return summary
}

/** GitHub compare URL showing what is in the source branch and not yet promoted. */
export function buildDiffUrl(repo, targetBranch, sourceBranch) {
  const target = targetBranch || 'stable'
  const source = sourceBranch || 'main'
  return `https://github.com/red-hat-data-services/${repo}/compare/${target}...${source}`
}

/**
 * Joins the latest job's `pull-requests` and `creator-outcomes` on repo
 * (case-insensitive short name). Every pull-request gets a row; creator
 * outcomes without a child PR (for example "already up to date") get a row
 * too, so the release-branches table covers the whole component set.
 */
export function joinReleaseBranches(stateJson) {
  const state = stateJson || {}
  const outcomesByRepo = new Map()
  for (const outcome of state['creator-outcomes'] || []) {
    outcomesByRepo.set(repoKey(outcome.repo), outcome)
  }

  const rows = []
  const seen = new Set()
  for (const pr of state['pull-requests'] || []) {
    const key = repoKey(pr.repo)
    seen.add(key)
    const outcome = outcomesByRepo.get(key) || null
    rows.push({
      repo: pr.repo,
      repoUrl: outcome ? outcome.repo : null,
      prUrl: pr['pr-url'] || null,
      prStatus: pr['pr-status'] || 'unknown',
      outcome: outcome ? outcome.outcome : null,
      reason: outcome ? outcome.reason : null,
      sourceBranch: outcome ? outcome['source-branch'] : null,
      targetBranch: outcome ? outcome['target-branch'] : null,
      diffUrl: buildDiffUrl(pr.repo, outcome && outcome['target-branch'], outcome && outcome['source-branch'])
    })
  }
  for (const outcome of state['creator-outcomes'] || []) {
    const key = repoKey(outcome.repo)
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({
      repo: outcome.repo.split('/').pop(),
      repoUrl: outcome.repo,
      prUrl: outcome['pr-url'] || null,
      prStatus: null,
      outcome: outcome.outcome,
      reason: outcome.reason,
      sourceBranch: outcome['source-branch'],
      targetBranch: outcome['target-branch'],
      diffUrl: buildDiffUrl(outcome.repo.split('/').pop(), outcome['target-branch'], outcome['source-branch'])
    })
  }
  return rows.sort((a, b) => a.repo.localeCompare(b.repo))
}

/**
 * Fetches and holds the latest promotion-gates job from the module's proxy.
 *
 * Distinguishes three failure shapes so the view can render a friendly state:
 * `notFound` (the dashboard has no data yet), `notConfigured` (the proxy has
 * no base URL) and `error` (anything else).
 */
export function usePromotionGates() {
  const loading = ref(false)
  const error = ref(null)
  const notFound = ref(false)
  const notConfigured = ref(false)
  const summary = ref(null)
  const summaryLoading = ref(false)
  const summaryError = ref(null)
  const job = ref(null)

  /** Aggregate history for the trends tab; independent of the latest job. */
  let summaryRequest = 0
  async function loadSummary(days = 30) {
    // Two quick period clicks can resolve out of order; only the newest wins.
    const request = ++summaryRequest
    summaryLoading.value = true
    summaryError.value = null
    try {
      const data = await apiRequest(
        `${SUMMARY_ENDPOINT}?days=${encodeURIComponent(days)}`
      )
      if (request === summaryRequest) summary.value = data
    } catch (err) {
      if (request === summaryRequest) {
        summaryError.value = err.message || 'Failed to load promotion gates history'
        summary.value = null
      }
    } finally {
      if (request === summaryRequest) summaryLoading.value = false
    }
  }

  async function loadLatest() {
    loading.value = true
    error.value = null
    notFound.value = false
    notConfigured.value = false
    try {
      job.value = await apiRequest(LATEST_ENDPOINT)
    } catch (err) {
      job.value = null
      if (err && err.status === 404) {
        notFound.value = true
      } else if (err && err.status === 503) {
        notConfigured.value = true
      } else {
        error.value = err.message || 'Failed to load promotion gates data'
      }
    } finally {
      loading.value = false
    }
  }

  const stateJson = computed(() => (job.value && job.value.state_json) || null)
  const pullRequests = computed(() => (stateJson.value && stateJson.value['pull-requests']) || [])
  const creatorOutcomes = computed(() => (stateJson.value && stateJson.value['creator-outcomes']) || [])
  const gates = computed(() => (stateJson.value && stateJson.value['promotion-gates']) || [])
  const repoLinks = computed(() => failureLinksByRepo(job.value))
  const issues = computed(() => creatorOutcomes.value.filter((o) => String(o.outcome || '').toLowerCase() !== 'success'))
  const releaseBranches = computed(() => joinReleaseBranches(stateJson.value))

  return {
    loading,
    error,
    notFound,
    notConfigured,
    summary,
    summaryLoading,
    summaryError,
    loadSummary,
    job,
    stateJson,
    pullRequests,
    creatorOutcomes,
    gates,
    repoLinks,
    issues,
    releaseBranches,
    loadLatest,
    refetch: loadLatest
  }
}
