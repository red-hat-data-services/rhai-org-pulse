import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

// Mock Vue lifecycle hooks
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

import { useClickOutside } from '../../../client/plan/composables/useClickOutside'

describe('useClickOutside', function() {
  beforeEach(function() {
    mountedHooks = []
    unmountedHooks = []
  })

  afterEach(function() {
    // Run unmount hooks to clean up listeners
    unmountedHooks.forEach(function(fn) { fn() })
  })

  it('calls handler on document click when no element ref', function() {
    var called = 0
    useClickOutside(null, function() { called++ })

    // Simulate mount
    mountedHooks.forEach(function(fn) { fn() })

    document.dispatchEvent(new Event('click'))
    expect(called).toBe(1)

    document.dispatchEvent(new Event('click'))
    expect(called).toBe(2)
  })

  it('calls handler when click is outside the element', function() {
    var container = document.createElement('div')
    document.body.appendChild(container)
    var elementRef = ref(container)
    var called = 0

    useClickOutside(elementRef, function() { called++ })
    mountedHooks.forEach(function(fn) { fn() })

    // Click outside
    var outsideEl = document.createElement('div')
    document.body.appendChild(outsideEl)
    var event = new Event('click', { bubbles: true })
    Object.defineProperty(event, 'target', { value: outsideEl })
    document.dispatchEvent(event)

    expect(called).toBe(1)

    // Cleanup
    document.body.removeChild(container)
    document.body.removeChild(outsideEl)
  })

  it('does not call handler when click is inside the element', function() {
    var container = document.createElement('div')
    var child = document.createElement('span')
    container.appendChild(child)
    document.body.appendChild(container)
    var elementRef = ref(container)
    var called = 0

    useClickOutside(elementRef, function() { called++ })
    mountedHooks.forEach(function(fn) { fn() })

    // Click inside
    var event = new Event('click', { bubbles: true })
    Object.defineProperty(event, 'target', { value: child })
    document.dispatchEvent(event)

    expect(called).toBe(0)

    // Cleanup
    document.body.removeChild(container)
  })

  it('removes listener on unmount', function() {
    var called = 0
    useClickOutside(null, function() { called++ })

    mountedHooks.forEach(function(fn) { fn() })
    document.dispatchEvent(new Event('click'))
    expect(called).toBe(1)

    // Unmount
    unmountedHooks.forEach(function(fn) { fn() })
    unmountedHooks = []

    document.dispatchEvent(new Event('click'))
    expect(called).toBe(1) // should not increment
  })

  it('calls handler when element ref is null', function() {
    var elementRef = ref(null)
    var called = 0

    useClickOutside(elementRef, function() { called++ })
    mountedHooks.forEach(function(fn) { fn() })

    document.dispatchEvent(new Event('click'))
    expect(called).toBe(1)
  })
})
