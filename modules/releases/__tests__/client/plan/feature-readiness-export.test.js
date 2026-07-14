import {
  featureMatchesProduct,
  featureFailsSelectedFpdorItems,
  failedFpdorNames,
  featureMatchesSharedFilters
} from '../../../client/plan/utils/feature-readiness-export.js'

describe('feature-readiness-export helpers', function() {
  describe('featureMatchesProduct', function() {
    it('matches product from targetVersions', function() {
      var feature = { targetVersions: ['RHOAI 3.5'], fixVersion: null }
      expect(featureMatchesProduct(feature, ['RHOAI'])).toBe(true)
      expect(featureMatchesProduct(feature, ['RHAIIS'])).toBe(false)
    })

    it('matches product from fixVersion', function() {
      var feature = { targetVersions: [], fixVersion: 'RHAIIS-3.0' }
      expect(featureMatchesProduct(feature, ['RHAIIS'])).toBe(true)
    })

    it('passes when no product filter set', function() {
      expect(featureMatchesProduct({ targetVersions: [] }, [])).toBe(true)
    })
  })

  describe('featureFailsSelectedFpdorItems', function() {
    var feature = {
      fpdor: {
        items: [
          { name: 'Acceptance Criteria', pass: false },
          { name: 'RICE Score', pass: true },
          { name: 'Assignee', pass: false }
        ]
      }
    }

    it('matches when feature fails a selected item', function() {
      expect(featureFailsSelectedFpdorItems(feature, ['Acceptance Criteria'])).toBe(true)
    })

    it('does not match when selected item passes', function() {
      expect(featureFailsSelectedFpdorItems(feature, ['RICE Score'])).toBe(false)
    })

    it('passes when no item filter set', function() {
      expect(featureFailsSelectedFpdorItems(feature, [])).toBe(true)
    })
  })

  describe('failedFpdorNames', function() {
    it('returns failed item names', function() {
      var feature = {
        fpdor: {
          items: [
            { name: 'Acceptance Criteria', pass: false },
            { name: 'RICE Score', pass: true }
          ]
        }
      }
      expect(failedFpdorNames(feature)).toEqual(['Acceptance Criteria'])
    })
  })

  describe('featureMatchesSharedFilters', function() {
    var base = {
      bigRock: 'Rock A',
      targetVersions: ['RHOAI 3.5'],
      fixVersion: 'RHOAI-3.5',
      components: ['Dashboard'],
      priority: 'Major',
      team: 'DW Team',
      confidence: 'ready',
      fpdor: {
        items: [
          { name: 'Acceptance Criteria', pass: false },
          { name: 'RICE Score', pass: true }
        ]
      }
    }

    it('applies readiness when enabled', function() {
      var filters = {
        outcome: [], targetVersion: [], fixVersion: [], component: [],
        priority: [], team: [], product: [], fpdorItems: [], readiness: 'not-ready'
      }
      expect(featureMatchesSharedFilters(base, filters, '', { applyReadiness: true })).toBe(false)
      expect(featureMatchesSharedFilters(
        Object.assign({}, base, { confidence: 'not-ready' }),
        filters,
        '',
        { applyReadiness: true }
      )).toBe(true)
    })

    it('skips readiness when disabled for counts', function() {
      var filters = {
        outcome: [], targetVersion: [], fixVersion: [], component: [],
        priority: [], team: [], product: [], fpdorItems: [], readiness: 'not-ready'
      }
      expect(featureMatchesSharedFilters(base, filters, '', { applyReadiness: false })).toBe(true)
    })

    it('applies product and fpdor filters', function() {
      var filters = {
        outcome: [], targetVersion: [], fixVersion: [], component: [],
        priority: [], team: [], product: ['RHOAI'], fpdorItems: ['Acceptance Criteria'], readiness: null
      }
      expect(featureMatchesSharedFilters(base, filters, '', { applyReadiness: true })).toBe(true)
      filters.product = ['RHAIIS']
      expect(featureMatchesSharedFilters(base, filters, '', { applyReadiness: true })).toBe(false)
    })
  })
})
