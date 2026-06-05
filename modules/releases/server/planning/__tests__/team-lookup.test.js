import { describe, it, expect } from 'vitest'

const { buildTeamIndex } = require('../team-lookup')

function makeReadFromStorage(overrides) {
  return function(key) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      return overrides[key]
    }
    return null
  }
}

describe('buildTeamIndex', function() {
  it('returns empty Map when version is null', function() {
    var index = buildTeamIndex(makeReadFromStorage({}), null)
    expect(index.size).toBe(0)
  })

  it('returns empty Map when version is undefined', function() {
    var index = buildTeamIndex(makeReadFromStorage({}), undefined)
    expect(index.size).toBe(0)
  })

  it('returns empty Map when hygiene cache is absent', function() {
    var index = buildTeamIndex(makeReadFromStorage({}), '3.5')
    expect(index.size).toBe(0)
  })

  it('returns empty Map when hygiene cache has no features', function() {
    var readFromStorage = makeReadFromStorage({
      'releases/hygiene/features-3.5.json': { fetchedAt: '2026-01-01T00:00:00.000Z' }
    })
    var index = buildTeamIndex(readFromStorage, '3.5')
    expect(index.size).toBe(0)
  })

  it('builds index from hygiene cache features object', function() {
    var hygieneCache = {
      features: {
        'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Model Serving' },
        'RHAISTRAT-2': { key: 'RHAISTRAT-2', team: 'Training' }
      }
    }
    var readFromStorage = makeReadFromStorage({
      'releases/hygiene/features-3.5.json': hygieneCache
    })
    var index = buildTeamIndex(readFromStorage, '3.5')
    expect(index.size).toBe(2)
    expect(index.get('RHAISTRAT-1')).toBe('Model Serving')
    expect(index.get('RHAISTRAT-2')).toBe('Training')
  })

  it('skips features without a team field', function() {
    var hygieneCache = {
      features: {
        'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: 'Platform' },
        'RHAISTRAT-2': { key: 'RHAISTRAT-2' }
      }
    }
    var readFromStorage = makeReadFromStorage({
      'releases/hygiene/features-3.5.json': hygieneCache
    })
    var index = buildTeamIndex(readFromStorage, '3.5')
    expect(index.size).toBe(1)
    expect(index.get('RHAISTRAT-1')).toBe('Platform')
    expect(index.has('RHAISTRAT-2')).toBe(false)
  })

  it('uses the version string in the storage key', function() {
    var called = []
    function readFromStorage(key) {
      called.push(key)
      return null
    }
    buildTeamIndex(readFromStorage, 'RHOAI 2.14')
    expect(called).toContain('releases/hygiene/features-RHOAI 2.14.json')
  })

  it('returns empty Map when features have null team values', function() {
    var hygieneCache = {
      features: {
        'RHAISTRAT-1': { key: 'RHAISTRAT-1', team: null }
      }
    }
    var readFromStorage = makeReadFromStorage({
      'releases/hygiene/features-3.5.json': hygieneCache
    })
    var index = buildTeamIndex(readFromStorage, '3.5')
    expect(index.size).toBe(0)
  })
})
