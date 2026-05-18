import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

// Mock Vue lifecycle hooks so the composable can register them without a component
var mountedHooks = []
var unmountedHooks = []

vi.mock('vue', async () => {
  var actual = await vi.importActual('vue')
  return {
    ...actual,
    onMounted: function(fn) { mountedHooks.push(fn) },
    onUnmounted: function(fn) { unmountedHooks.push(fn) }
  }
})

import { useRefreshPolling } from '../../../client/plan/composables/useRefreshPolling'

describe('useRefreshPolling', function() {
  beforeEach(function() {
    vi.useFakeTimers()
    mountedHooks = []
    unmountedHooks = []
  })

  afterEach(function() {
    // Run all unmount hooks to clean up timers
    unmountedHooks.forEach(function(fn) { fn() })
    vi.useRealTimers()
  })

  it('starts polling when refreshing becomes true', async function() {
    var refreshing = ref(false)
    var checkCount = 0
    var completeCount = 0

    useRefreshPolling(
      refreshing,
      async function() { checkCount++; return { running: true } },
      function() { completeCount++ }
    )

    // Trigger the watch
    refreshing.value = true
    await vi.advanceTimersByTimeAsync(3000)
    expect(checkCount).toBe(1)
    expect(completeCount).toBe(0)

    await vi.advanceTimersByTimeAsync(3000)
    expect(checkCount).toBe(2)
  })

  it('stops polling and calls onComplete when status.running is false', async function() {
    var refreshing = ref(false)
    var completed = false
    var callCount = 0

    useRefreshPolling(
      refreshing,
      async function() {
        callCount++
        return { running: callCount < 2 }
      },
      function() { completed = true }
    )

    refreshing.value = true
    await vi.advanceTimersByTimeAsync(3000)
    expect(callCount).toBe(1)
    expect(completed).toBe(false)

    await vi.advanceTimersByTimeAsync(3000)
    expect(callCount).toBe(2)
    expect(completed).toBe(true)

    // Should not poll again after stopping
    await vi.advanceTimersByTimeAsync(3000)
    expect(callCount).toBe(2)
  })

  it('uses custom interval', async function() {
    var refreshing = ref(false)
    var checkCount = 0

    useRefreshPolling(
      refreshing,
      async function() { checkCount++; return { running: true } },
      function() {},
      { interval: 1000 }
    )

    refreshing.value = true
    await vi.advanceTimersByTimeAsync(1000)
    expect(checkCount).toBe(1)

    await vi.advanceTimersByTimeAsync(1000)
    expect(checkCount).toBe(2)
  })

  it('cleans up on unmount', async function() {
    var refreshing = ref(false)
    var checkCount = 0

    useRefreshPolling(
      refreshing,
      async function() { checkCount++; return { running: true } },
      function() {}
    )

    // Start polling via watch
    refreshing.value = true
    await vi.advanceTimersByTimeAsync(3000)
    expect(checkCount).toBe(1)

    // Unmount
    unmountedHooks.forEach(function(fn) { fn() })
    unmountedHooks = [] // prevent double cleanup in afterEach

    // Should not poll after unmount
    await vi.advanceTimersByTimeAsync(6000)
    expect(checkCount).toBe(1)
  })

  it('returns start and stop functions', function() {
    var refreshing = ref(false)
    var result = useRefreshPolling(
      refreshing,
      async function() { return { running: false } },
      function() {}
    )

    expect(typeof result.start).toBe('function')
    expect(typeof result.stop).toBe('function')
  })
})
