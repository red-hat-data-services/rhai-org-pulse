import { ref, onUnmounted, getCurrentInstance } from 'vue'
import { refreshAllocation, getRefreshStatus } from '../services/allocation-api'

/**
 * Drives a self-service allocation refresh with progress feedback.
 *
 * Flow (the "medium" async UX):
 *   1. Trigger POST /allocation/refresh (optionally scoped to a teamId).
 *   2. If it starts (or one is already running), poll GET /allocation/refresh/status
 *      until the background run finishes.
 *   3. Call `onComplete` so the caller can reload its data, then surface a result.
 *
 * The backend refresh state is global (a single in-memory run), so completion is
 * detected by `running` returning to false with a `completedAt` newer than the
 * value observed just before we triggered.
 *
 * @param {Object} [opts]
 * @param {number} [opts.pollIntervalMs] - Poll cadence (default 3000).
 * @param {number} [opts.maxPolls] - Safety cap on poll attempts (default 60 ≈ 3 min).
 */
export function useAllocationRefresh(opts = {}) {
  const pollIntervalMs = opts.pollIntervalMs ?? 3000
  const maxPolls = opts.maxPolls ?? 60

  const refreshing = ref(false)
  // 'idle' | 'starting' | 'running' | 'done' | 'cooldown' | 'unavailable' | 'error'
  const phase = ref('idle')
  const message = ref('')

  // Stop polling if the owning component unmounts (e.g. user navigates away
  // mid-refresh) so the loop doesn't keep running in the background.
  let cancelled = false
  if (getCurrentInstance()) {
    onUnmounted(() => { cancelled = true })
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async function readStatusSafe() {
    try {
      return await getRefreshStatus()
    } catch {
      return null
    }
  }

  async function pollUntilComplete(prevCompletedAt) {
    for (let i = 0; i < maxPolls; i++) {
      await sleep(pollIntervalMs)
      if (cancelled) return false
      const status = await readStatusSafe()
      if (!status) continue
      if (!status.running && status.completedAt && status.completedAt !== prevCompletedAt) {
        return status.lastResult?.status !== 'error'
      }
    }
    return false
  }

  /**
   * @param {Object} [args]
   * @param {string|null} [args.teamId] - Refresh a single team (self-service). Omit for a full, admin-only refresh.
   * @param {boolean} [args.hardRefresh]
   * @param {Function} [args.onComplete] - Awaited after the run finishes (e.g. reload data).
   * @returns {Promise<Object>} the trigger response ({ status: ... })
   */
  async function triggerRefresh({ teamId = null, hardRefresh = false, onComplete } = {}) {
    if (refreshing.value) return { status: 'busy' }

    refreshing.value = true
    phase.value = 'starting'
    message.value = 'Starting refresh…'

    try {
      const before = await readStatusSafe()
      const prevCompletedAt = before?.completedAt || null

      const res = await refreshAllocation(teamId, hardRefresh)
      const status = res?.status

      if (status === 'skipped') {
        phase.value = 'unavailable'
        message.value = res.message || 'Refresh is unavailable right now.'
        return res
      }

      if (status === 'cooldown') {
        // A run finished within the cooldown window, so the latest data is
        // already on disk — just reload it.
        phase.value = 'done'
        message.value = 'Just refreshed a moment ago — loading the latest data.'
        if (onComplete) await onComplete()
        return res
      }

      // 'started' or 'already_running' → wait for the background run to finish.
      phase.value = 'running'
      message.value = status === 'already_running'
        ? 'A refresh is already in progress…'
        : 'Fetching the latest data from Jira…'

      const ok = await pollUntilComplete(prevCompletedAt)
      if (cancelled) return res
      if (onComplete) await onComplete()

      if (ok) {
        phase.value = 'done'
        message.value = 'Done — data updated.'
      } else {
        phase.value = 'error'
        message.value = 'The refresh is taking longer than expected. Please check back shortly.'
      }
      return res
    } catch {
      phase.value = 'error'
      message.value = 'Refresh failed. Please try again.'
      return { status: 'error' }
    } finally {
      refreshing.value = false
    }
  }

  return { refreshing, phase, message, triggerRefresh }
}
