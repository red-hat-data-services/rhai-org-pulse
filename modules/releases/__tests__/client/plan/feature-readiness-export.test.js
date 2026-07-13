import { describe, it, expect } from 'vitest'
import {
  featureMatchesProduct,
  featureFailsSelectedFpdorItems,
  failedFpdorNames
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
})
