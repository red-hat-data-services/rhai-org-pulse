/**
 * Tests for PM Hub refresh cadence logic.
 *
 * Covers:
 * - Auto-refresh timer setup and cleanup
 * - Visibility-based skip logic
 * - startAutoRefresh / stopAutoRefresh lifecycle
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Inlined from ComponentReleaseLoadReport.vue
// ---------------------------------------------------------------------------

var AUTO_REFRESH_MS = 5 * 60 * 1000

function createRefreshManager() {
  var timer = null
  var hasFetched = false
  var loadingData = false
  var loadDataCalls = 0
  var visibilityState = 'visible'

  function loadData() {
    loadDataCalls++
  }

  function stopAutoRefresh() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh()
    timer = setInterval(function () {
      if (!hasFetched || loadingData) return
      if (visibilityState !== 'visible') return
      loadData()
    }, AUTO_REFRESH_MS)
  }

  return {
    get timer() { return timer },
    set timer(v) { timer = v },
    get hasFetched() { return hasFetched },
    set hasFetched(v) { hasFetched = v },
    get loadingData() { return loadingData },
    set loadingData(v) { loadingData = v },
    get loadDataCalls() { return loadDataCalls },
    get visibilityState() { return visibilityState },
    set visibilityState(v) { visibilityState = v },
    startAutoRefresh: startAutoRefresh,
    stopAutoRefresh: stopAutoRefresh,
    loadData: loadData
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AUTO_REFRESH_MS constant', function () {
  it('equals 5 minutes in milliseconds', function () {
    expect(AUTO_REFRESH_MS).toBe(300000)
  })
})

describe('auto-refresh timer lifecycle', function () {
  beforeEach(function () {
    vi.useFakeTimers()
  })

  afterEach(function () {
    vi.useRealTimers()
  })

  it('startAutoRefresh creates an interval timer', function () {
    var mgr = createRefreshManager()
    mgr.hasFetched = true
    mgr.startAutoRefresh()
    expect(mgr.timer).not.toBeNull()
    mgr.stopAutoRefresh()
  })

  it('stopAutoRefresh clears the timer', function () {
    var mgr = createRefreshManager()
    mgr.hasFetched = true
    mgr.startAutoRefresh()
    expect(mgr.timer).not.toBeNull()
    mgr.stopAutoRefresh()
    expect(mgr.timer).toBeNull()
  })

  it('stopAutoRefresh is safe to call when no timer exists', function () {
    var mgr = createRefreshManager()
    expect(function () { mgr.stopAutoRefresh() }).not.toThrow()
    expect(mgr.timer).toBeNull()
  })

  it('startAutoRefresh replaces existing timer', function () {
    var mgr = createRefreshManager()
    mgr.hasFetched = true
    mgr.startAutoRefresh()
    var firstTimer = mgr.timer
    mgr.startAutoRefresh()
    expect(mgr.timer).not.toBeNull()
    expect(mgr.timer).not.toBe(firstTimer)
    mgr.stopAutoRefresh()
  })

  it('calls loadData after AUTO_REFRESH_MS when conditions are met', function () {
    var mgr = createRefreshManager()
    mgr.hasFetched = true
    mgr.visibilityState = 'visible'
    mgr.startAutoRefresh()

    expect(mgr.loadDataCalls).toBe(0)
    vi.advanceTimersByTime(AUTO_REFRESH_MS)
    expect(mgr.loadDataCalls).toBe(1)
    vi.advanceTimersByTime(AUTO_REFRESH_MS)
    expect(mgr.loadDataCalls).toBe(2)

    mgr.stopAutoRefresh()
  })

  it('does not call loadData before AUTO_REFRESH_MS elapses', function () {
    var mgr = createRefreshManager()
    mgr.hasFetched = true
    mgr.visibilityState = 'visible'
    mgr.startAutoRefresh()

    vi.advanceTimersByTime(AUTO_REFRESH_MS - 1)
    expect(mgr.loadDataCalls).toBe(0)

    mgr.stopAutoRefresh()
  })

  it('skips refresh when hasFetched is false', function () {
    var mgr = createRefreshManager()
    mgr.hasFetched = false
    mgr.visibilityState = 'visible'
    mgr.startAutoRefresh()

    vi.advanceTimersByTime(AUTO_REFRESH_MS)
    expect(mgr.loadDataCalls).toBe(0)

    mgr.stopAutoRefresh()
  })

  it('skips refresh when loadingData is true', function () {
    var mgr = createRefreshManager()
    mgr.hasFetched = true
    mgr.loadingData = true
    mgr.visibilityState = 'visible'
    mgr.startAutoRefresh()

    vi.advanceTimersByTime(AUTO_REFRESH_MS)
    expect(mgr.loadDataCalls).toBe(0)

    mgr.stopAutoRefresh()
  })

  it('skips refresh when tab is not visible', function () {
    var mgr = createRefreshManager()
    mgr.hasFetched = true
    mgr.visibilityState = 'hidden'
    mgr.startAutoRefresh()

    vi.advanceTimersByTime(AUTO_REFRESH_MS)
    expect(mgr.loadDataCalls).toBe(0)

    mgr.stopAutoRefresh()
  })

  it('resumes refresh when tab becomes visible again', function () {
    var mgr = createRefreshManager()
    mgr.hasFetched = true
    mgr.visibilityState = 'hidden'
    mgr.startAutoRefresh()

    vi.advanceTimersByTime(AUTO_REFRESH_MS)
    expect(mgr.loadDataCalls).toBe(0)

    mgr.visibilityState = 'visible'
    vi.advanceTimersByTime(AUTO_REFRESH_MS)
    expect(mgr.loadDataCalls).toBe(1)

    mgr.stopAutoRefresh()
  })

  it('does not call loadData after stopAutoRefresh', function () {
    var mgr = createRefreshManager()
    mgr.hasFetched = true
    mgr.visibilityState = 'visible'
    mgr.startAutoRefresh()

    vi.advanceTimersByTime(AUTO_REFRESH_MS)
    expect(mgr.loadDataCalls).toBe(1)

    mgr.stopAutoRefresh()
    vi.advanceTimersByTime(AUTO_REFRESH_MS * 5)
    expect(mgr.loadDataCalls).toBe(1)
  })
})
