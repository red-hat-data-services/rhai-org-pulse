/**
 * Tests for PM Hub filter persistence logic.
 *
 * Exercises the save/restore/clear localStorage cycle inlined from
 * ComponentReleaseLoadReport.vue. Same pattern as the component-release-load-table
 * tests — pure function testing without component mounting.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

var STORAGE_KEY = 'pm-hub-filters'

// ---------------------------------------------------------------------------
// Inline the persistence functions from ComponentReleaseLoadReport.vue
// ---------------------------------------------------------------------------

function saveFilters(state) {
  try {
    var payload = {
      pillars: state.pillars || [],
      components: state.components || [],
      versions: state.versions || [],
      product: state.product || [],
      type: state.type || [],
      releaseType: state.releaseType || [],
      status: state.status || [],
      blocked: state.blocked !== undefined ? state.blocked : null,
      delOwner: state.delOwner || [],
      pmOwner: state.pmOwner || [],
      sort: state.sort || { column: null, direction: 'asc' }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch { return false }
}

function restoreFilters() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    var state = JSON.parse(raw)
    var result = {}
    if (state.pillars && Array.isArray(state.pillars)) result.pillars = state.pillars
    if (state.components && Array.isArray(state.components)) result.components = state.components
    if (state.versions && Array.isArray(state.versions)) result.versions = state.versions
    if (state.product && Array.isArray(state.product)) result.product = state.product
    if (state.type && Array.isArray(state.type)) result.type = state.type
    if (state.releaseType && Array.isArray(state.releaseType)) result.releaseType = state.releaseType
    if (state.status && Array.isArray(state.status)) result.status = state.status
    if (state.blocked !== undefined) result.blocked = state.blocked
    if (state.delOwner && Array.isArray(state.delOwner)) result.delOwner = state.delOwner
    if (state.pmOwner && Array.isArray(state.pmOwner)) result.pmOwner = state.pmOwner
    if (state.sort && typeof state.sort === 'object') result.sort = state.sort
    return result
  } catch { return null }
}

function clearFilters() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
}

// ---------------------------------------------------------------------------
// Mock localStorage for jsdom environment
// ---------------------------------------------------------------------------

var store = {}

beforeEach(function () {
  store = {}
  vi.stubGlobal('localStorage', {
    getItem: function (key) { return store[key] || null },
    setItem: function (key, val) { store[key] = String(val) },
    removeItem: function (key) { delete store[key] }
  })
})

// ---------------------------------------------------------------------------
// saveFilters
// ---------------------------------------------------------------------------

describe('saveFilters', function () {
  it('saves a complete filter state to localStorage', function () {
    var state = {
      pillars: ['Inference'],
      components: ['llm-d'],
      versions: ['3.5'],
      product: ['RHOAI'],
      type: ['committed'],
      releaseType: ['Feature'],
      status: ['Green'],
      blocked: true,
      delOwner: ['Alice'],
      pmOwner: ['Bob'],
      sort: { column: 'key', direction: 'asc' }
    }
    expect(saveFilters(state)).toBe(true)
    expect(store[STORAGE_KEY]).toBeTruthy()

    var parsed = JSON.parse(store[STORAGE_KEY])
    expect(parsed.pillars).toEqual(['Inference'])
    expect(parsed.components).toEqual(['llm-d'])
    expect(parsed.versions).toEqual(['3.5'])
    expect(parsed.product).toEqual(['RHOAI'])
    expect(parsed.type).toEqual(['committed'])
    expect(parsed.releaseType).toEqual(['Feature'])
    expect(parsed.status).toEqual(['Green'])
    expect(parsed.blocked).toBe(true)
    expect(parsed.delOwner).toEqual(['Alice'])
    expect(parsed.pmOwner).toEqual(['Bob'])
    expect(parsed.sort).toEqual({ column: 'key', direction: 'asc' })
  })

  it('saves empty state with defaults', function () {
    saveFilters({})
    var parsed = JSON.parse(store[STORAGE_KEY])
    expect(parsed.pillars).toEqual([])
    expect(parsed.components).toEqual([])
    expect(parsed.blocked).toBeNull()
    expect(parsed.sort).toEqual({ column: null, direction: 'asc' })
  })

  it('saves blocked=false correctly', function () {
    saveFilters({ blocked: false })
    var parsed = JSON.parse(store[STORAGE_KEY])
    expect(parsed.blocked).toBe(false)
  })

  it('saves blocked=null correctly', function () {
    saveFilters({ blocked: null })
    var parsed = JSON.parse(store[STORAGE_KEY])
    expect(parsed.blocked).toBeNull()
  })

  it('overwrites previous saved state', function () {
    saveFilters({ pillars: ['Inference'] })
    saveFilters({ pillars: ['Platform'] })
    var parsed = JSON.parse(store[STORAGE_KEY])
    expect(parsed.pillars).toEqual(['Platform'])
  })

  it('saves multiple filter values', function () {
    saveFilters({
      product: ['RHOAI', 'RHELAI'],
      status: ['Green', 'Yellow'],
      delOwner: ['Alice', 'Bob', 'Charlie']
    })
    var parsed = JSON.parse(store[STORAGE_KEY])
    expect(parsed.product).toHaveLength(2)
    expect(parsed.status).toHaveLength(2)
    expect(parsed.delOwner).toHaveLength(3)
  })

  it('returns false when localStorage throws', function () {
    vi.stubGlobal('localStorage', {
      getItem: function () { return null },
      setItem: function () { throw new Error('quota exceeded') },
      removeItem: function () {}
    })
    expect(saveFilters({ pillars: ['test'] })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// restoreFilters
// ---------------------------------------------------------------------------

describe('restoreFilters', function () {
  it('returns null when no saved state exists', function () {
    expect(restoreFilters()).toBeNull()
  })

  it('restores a complete filter state', function () {
    var state = {
      pillars: ['Inference'],
      components: ['llm-d'],
      versions: ['3.5'],
      product: ['RHOAI'],
      type: ['committed'],
      releaseType: ['Feature'],
      status: ['Green'],
      blocked: true,
      delOwner: ['Alice'],
      pmOwner: ['Bob'],
      sort: { column: 'priority', direction: 'desc' }
    }
    saveFilters(state)
    var restored = restoreFilters()
    expect(restored.pillars).toEqual(['Inference'])
    expect(restored.components).toEqual(['llm-d'])
    expect(restored.versions).toEqual(['3.5'])
    expect(restored.product).toEqual(['RHOAI'])
    expect(restored.type).toEqual(['committed'])
    expect(restored.releaseType).toEqual(['Feature'])
    expect(restored.status).toEqual(['Green'])
    expect(restored.blocked).toBe(true)
    expect(restored.delOwner).toEqual(['Alice'])
    expect(restored.pmOwner).toEqual(['Bob'])
    expect(restored.sort).toEqual({ column: 'priority', direction: 'desc' })
  })

  it('restores blocked=false correctly', function () {
    saveFilters({ blocked: false })
    var restored = restoreFilters()
    expect(restored.blocked).toBe(false)
  })

  it('restores blocked=null correctly', function () {
    saveFilters({ blocked: null })
    var restored = restoreFilters()
    expect(restored.blocked).toBeNull()
  })

  it('skips non-array fields gracefully', function () {
    store[STORAGE_KEY] = JSON.stringify({
      pillars: 'not-an-array',
      components: ['valid'],
      versions: 42
    })
    var restored = restoreFilters()
    expect(restored.pillars).toBeUndefined()
    expect(restored.components).toEqual(['valid'])
    expect(restored.versions).toBeUndefined()
  })

  it('skips sort if not an object', function () {
    store[STORAGE_KEY] = JSON.stringify({ sort: 'invalid' })
    var restored = restoreFilters()
    expect(restored.sort).toBeUndefined()
  })

  it('returns null for corrupted JSON', function () {
    store[STORAGE_KEY] = '{broken json{'
    expect(restoreFilters()).toBeNull()
  })

  it('returns null when localStorage throws', function () {
    vi.stubGlobal('localStorage', {
      getItem: function () { throw new Error('access denied') },
      setItem: function () {},
      removeItem: function () {}
    })
    expect(restoreFilters()).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// clearFilters
// ---------------------------------------------------------------------------

describe('clearFilters', function () {
  it('removes saved state from localStorage', function () {
    saveFilters({ pillars: ['Inference'] })
    expect(store[STORAGE_KEY]).toBeTruthy()
    clearFilters()
    expect(store[STORAGE_KEY]).toBeUndefined()
  })

  it('is safe to call when no state exists', function () {
    clearFilters()
    expect(store[STORAGE_KEY]).toBeUndefined()
  })

  it('does not throw when localStorage throws', function () {
    vi.stubGlobal('localStorage', {
      getItem: function () { return null },
      setItem: function () {},
      removeItem: function () { throw new Error('fail') }
    })
    expect(function () { clearFilters() }).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Round-trip: save → restore
// ---------------------------------------------------------------------------

describe('save/restore round-trip', function () {
  it('round-trips all filter fields correctly', function () {
    var original = {
      pillars: ['Inference', 'Platform'],
      components: ['llm-d', 'dashboard'],
      versions: ['3.5', '3.6'],
      product: ['RHOAI', 'RHELAI'],
      type: ['requested', 'committed'],
      releaseType: ['Feature', 'Enhancement'],
      status: ['Green', 'Yellow', 'Red'],
      blocked: true,
      delOwner: ['Alice', 'Bob'],
      pmOwner: ['Charlie', 'Diana'],
      sort: { column: 'priority', direction: 'desc' }
    }
    saveFilters(original)
    var restored = restoreFilters()
    expect(restored.pillars).toEqual(original.pillars)
    expect(restored.components).toEqual(original.components)
    expect(restored.versions).toEqual(original.versions)
    expect(restored.product).toEqual(original.product)
    expect(restored.type).toEqual(original.type)
    expect(restored.releaseType).toEqual(original.releaseType)
    expect(restored.status).toEqual(original.status)
    expect(restored.blocked).toEqual(original.blocked)
    expect(restored.delOwner).toEqual(original.delOwner)
    expect(restored.pmOwner).toEqual(original.pmOwner)
    expect(restored.sort).toEqual(original.sort)
  })

  it('round-trips empty filters', function () {
    saveFilters({})
    var restored = restoreFilters()
    expect(restored).not.toBeNull()
    expect(restored.blocked).toBeNull()
  })

  it('round-trips after clear returns null', function () {
    saveFilters({ pillars: ['Inference'] })
    clearFilters()
    expect(restoreFilters()).toBeNull()
  })

  it('last save wins when called multiple times', function () {
    saveFilters({ pillars: ['Inference'] })
    saveFilters({ pillars: ['Platform'] })
    saveFilters({ pillars: ['Agents'] })
    var restored = restoreFilters()
    expect(restored.pillars).toEqual(['Agents'])
  })

  it('preserves sort state independently of filters', function () {
    saveFilters({ sort: { column: 'status', direction: 'desc' } })
    var restored = restoreFilters()
    expect(restored.sort.column).toBe('status')
    expect(restored.sort.direction).toBe('desc')
  })
})
