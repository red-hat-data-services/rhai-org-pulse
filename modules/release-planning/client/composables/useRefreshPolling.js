import { watch, onUnmounted } from 'vue'

/**
 * Composable that encapsulates the poll/stop pattern for refresh status checking.
 *
 * Watches a reactive `refreshing` ref and starts polling when it becomes true.
 * When the server reports the refresh is complete, calls `onComplete` and stops.
 *
 * @param {import('vue').Ref<boolean>} refreshing - reactive ref indicating whether a refresh is in progress
 * @param {Function} checkStatus - async function that returns { running: boolean }
 * @param {Function} onComplete - called when a refresh finishes (e.g. reload data)
 * @param {Object} [options]
 * @param {number} [options.interval=3000] - polling interval in ms
 */
export function useRefreshPolling(refreshing, checkStatus, onComplete, options) {
  var interval = (options && options.interval) || 3000
  var timer = null

  function start() {
    stop()
    timer = setInterval(async function() {
      var status = await checkStatus()
      if (!status.running) {
        stop()
        if (onComplete) onComplete()
      }
    }, interval)
  }

  function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  watch(refreshing, function(isRefreshing) {
    if (isRefreshing) {
      start()
    }
  })

  onUnmounted(function() {
    stop()
  })

  return { start: start, stop: stop }
}
