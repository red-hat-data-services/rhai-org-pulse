/**
 * PM Hub PM/DO Aligned + readiness helpers (client-side aggregation).
 */
import { describe, it, expect } from 'vitest'

function computeNotAlignedCount(features) {
  var count = 0
  for (var i = 0; i < features.length; i++) {
    if (!features[i].pmDoAligned) count++
  }
  return count
}

function computeTotalNotAligned(groups) {
  var seen = {}
  var count = 0
  for (var gi = 0; gi < groups.length; gi++) {
    var comps = groups[gi].components || []
    for (var ci = 0; ci < comps.length; ci++) {
      var lists = [comps[ci].requestedFeatures || [], comps[ci].committedFeatures || []]
      for (var li = 0; li < lists.length; li++) {
        for (var fi = 0; fi < lists[li].length; fi++) {
          var f = lists[li][fi]
          if (!seen[f.key] && !f.pmDoAligned) {
            seen[f.key] = true
            count++
          }
        }
      }
    }
  }
  return count
}

function makeFeature(overrides) {
  return Object.assign({
    key: 'X-1',
    summary: 'Test',
    pmDoAligned: false,
    fpdor: { items: [], passedCount: 0, applicableCount: 17, allApplicablePassed: false },
    confidence: 'not-ready'
  }, overrides || {})
}

function makeGroup(features) {
  return {
    component: 'Comp',
    features: features,
    notAlignedCount: computeNotAlignedCount(features)
  }
}

describe('PM/DO Aligned aggregation', function () {
  it('counts features that are not aligned', function () {
    var features = [
      makeFeature({ key: 'X-1', pmDoAligned: true }),
      makeFeature({ key: 'X-2', pmDoAligned: false }),
      makeFeature({ key: 'X-3', pmDoAligned: false })
    ]
    expect(computeNotAlignedCount(features)).toBe(2)
    expect(makeGroup(features).notAlignedCount).toBe(2)
  })

  it('dedupes by key across requested/committed lists', function () {
    var f = makeFeature({ key: 'DUP-1', pmDoAligned: false })
    var groups = [{
      components: [{
        requestedFeatures: [f],
        committedFeatures: [f]
      }]
    }]
    expect(computeTotalNotAligned(groups)).toBe(1)
  })

  it('returns 0 when all aligned', function () {
    expect(computeNotAlignedCount([
      makeFeature({ key: 'A', pmDoAligned: true }),
      makeFeature({ key: 'B', pmDoAligned: true })
    ])).toBe(0)
  })
})
