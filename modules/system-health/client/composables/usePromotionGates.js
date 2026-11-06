import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const LATEST_ENDPOINT = '/modules/system-health/promotion-gates/latest'

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
  if (obs['gate-reason']) return obs['gate-reason']
  const run = (obs.runs || []).find((r) => String(r.status || '').toLowerCase() !== 'success')
  if (run && run.reason) return run.reason
  return pr['pr-status'] || 'unknown'
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
  const job = ref(null)

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
  const issues = computed(() => creatorOutcomes.value.filter((o) => String(o.outcome || '').toLowerCase() !== 'success'))
  const releaseBranches = computed(() => joinReleaseBranches(stateJson.value))

  return {
    loading,
    error,
    notFound,
    notConfigured,
    job,
    stateJson,
    pullRequests,
    creatorOutcomes,
    gates,
    issues,
    releaseBranches,
    loadLatest,
    refetch: loadLatest
  }
}
