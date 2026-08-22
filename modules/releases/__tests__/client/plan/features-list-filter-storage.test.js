import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  STORAGE_KEY,
  DEFAULT_FILTERS,
  saveFeaturesListFilters,
  restoreFeaturesListFilters,
  clearFeaturesListFiltersStorage
} from '../../../client/plan/utils/features-list-filter-storage.js'

describe('features-list-filter-storage', function() {
  beforeEach(function() {
    localStorage.clear()
  })

  afterEach(function() {
    localStorage.clear()
  })

  it('returns null when nothing is stored', function() {
    expect(restoreFeaturesListFilters()).toBeNull()
  })

  it('round-trips filters and selectedVersion', function() {
    saveFeaturesListFilters({
      outcome: ['Rock A'],
      targetVersion: ['3.5'],
      fixVersion: [],
      component: ['Dashboard'],
      priority: ['Major'],
      team: [],
      product: ['RHOAI'],
      fpdorItems: ['Child epics'],
      readiness: 'not-ready'
    }, '3.5')

    var restored = restoreFeaturesListFilters()
    expect(restored).toBeTruthy()
    expect(restored.selectedVersion).toBe('3.5')
    expect(restored.filters.outcome).toEqual(['Rock A'])
    expect(restored.filters.component).toEqual(['Dashboard'])
    expect(restored.filters.fpdorItems).toEqual(['Child epics'])
    expect(restored.filters.readiness).toBe('not-ready')
    expect(restored.filters.fixVersion).toEqual([])
    expect(restored.filters.alignment).toEqual([])
  })

  it('round-trips alignment filter', function() {
    saveFeaturesListFilters({
      outcome: [],
      targetVersion: [],
      fixVersion: [],
      component: [],
      priority: [],
      team: [],
      product: [],
      fpdorItems: [],
      alignment: ['misaligned', 'tv_only'],
      readiness: null
    }, '')
    var restored = restoreFeaturesListFilters()
    expect(restored.filters.alignment).toEqual(['misaligned', 'tv_only'])
  })

  it('ignores non-array filter values', function() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      filters: { outcome: 'Rock A', component: ['Dashboard'] },
      selectedVersion: '3.6'
    }))
    var restored = restoreFeaturesListFilters()
    expect(restored.filters.outcome).toEqual([])
    expect(restored.filters.component).toEqual(['Dashboard'])
    expect(restored.selectedVersion).toBe('3.6')
  })

  it('clearFeaturesListFiltersStorage removes the key', function() {
    saveFeaturesListFilters(DEFAULT_FILTERS, '3.5')
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy()
    clearFeaturesListFiltersStorage()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(restoreFeaturesListFilters()).toBeNull()
  })
})
