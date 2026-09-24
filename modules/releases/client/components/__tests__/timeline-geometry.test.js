import { describe, it, expect } from 'vitest'
import { clampStemToCard, pointInCircle, timelineDimensionGroupKey, timelineDimensionRowKey } from '../timeline-geometry.js'

// Mirrors the pixel geometry used in ReleaseTimeline.vue:
//   above node: stem top = yMid - stemLen - 8, card bottom = yMid - stemLen - 4
//   below node: stem bottom = yMid + stemLen + 8, card top = yMid + stemLen + 4
// The base stem overshoots the card by 4px on the card-facing side.

describe('clampStemToCard', function () {
  describe('above the axis (card sits above, stem goes down to the axis)', function () {
    // yMid=300, stemLen=64 → stem top=228, bottom=294; card bottom edge=232
    var card = { y: 172, h: 60 } // card bottom = 232
    var stem = { top: 228, bottom: 294 }

    it('pulls the stem top down to the card bottom edge so it does not pierce', function () {
      var ends = clampStemToCard(stem, card, true)
      expect(ends.top).toBe(232) // card.y + card.h
      expect(ends.bottom).toBe(294) // axis-side end untouched
    })

    it('never renders above (into) the card body', function () {
      var ends = clampStemToCard(stem, card, true)
      expect(ends.top).toBeGreaterThanOrEqual(card.y + card.h)
    })

    it('leaves an already-flush stem unchanged', function () {
      var flush = { top: 232, bottom: 294 }
      var ends = clampStemToCard(flush, card, true)
      expect(ends.top).toBe(232)
      expect(ends.bottom).toBe(294)
    })
  })

  describe('below the axis (card sits below, stem goes up to the axis)', function () {
    // yMid=300, stemLen=64 → stem top=306, bottom=372; card top edge=368
    var card = { y: 368, h: 60 }
    var stem = { top: 306, bottom: 372 }

    it('pulls the stem bottom up to the card top edge so it does not pierce', function () {
      var ends = clampStemToCard(stem, card, false)
      expect(ends.bottom).toBe(368) // card.y
      expect(ends.top).toBe(306) // axis-side end untouched
    })

    it('never renders below (into) the card body', function () {
      var ends = clampStemToCard(stem, card, false)
      expect(ends.bottom).toBeLessThanOrEqual(card.y)
    })

    it('leaves a below-axis stem unchanged when it already meets the card edge', function () {
      var flush = { top: 306, bottom: 368 }
      var ends = clampStemToCard(flush, card, false)
      expect(ends.bottom).toBe(368)
    })
  })

  it('never produces an inverted line when the card fully covers the stem', function () {
    // Degenerate: card overlaps entire stem span.
    var card = { y: 100, h: 400 }
    var stem = { top: 228, bottom: 294 }
    var above = clampStemToCard(stem, card, true)
    expect(above.bottom).toBeGreaterThanOrEqual(above.top)
    var below = clampStemToCard(stem, card, false)
    expect(below.bottom).toBeGreaterThanOrEqual(below.top)
  })
})

describe('pointInCircle (milestone-dot hit test)', function () {
  // Dot centered at (200, 300) with a 10px hit radius.
  var cx = 200
  var cy = 300
  var r = 10

  it('hits at the exact center', function () {
    expect(pointInCircle(cx, cy, cx, cy, r)).toBe(true)
  })

  it('hits just inside the radius (orthogonal and diagonal)', function () {
    expect(pointInCircle(cx + 9, cy, cx, cy, r)).toBe(true)
    expect(pointInCircle(cx, cy - 9, cx, cy, r)).toBe(true)
    expect(pointInCircle(cx + 6, cy + 6, cx, cy, r)).toBe(true) // dist ≈ 8.49
  })

  it('hits exactly on the boundary', function () {
    expect(pointInCircle(cx + r, cy, cx, cy, r)).toBe(true)
  })

  it('misses just outside the radius', function () {
    expect(pointInCircle(cx + 11, cy, cx, cy, r)).toBe(false)
    expect(pointInCircle(cx + 8, cy + 8, cx, cy, r)).toBe(false) // dist ≈ 11.3
  })
})

describe('timelineDimensionGroupKey', function () {
  it('keeps same-label distance lines separate by product', function () {
    var rhai = { groupLabel: '3.6 GA', productList: ['rhai'] }
    var rhelai = { groupLabel: '3.6 GA', productList: ['rhelai'] }

    expect(timelineDimensionGroupKey(rhai, true))
      .not.toBe(timelineDimensionGroupKey(rhelai, true))
  })

  it('keeps distance row lookup independent from product grouping', function () {
    var group = timelineDimensionGroupKey({ groupLabel: '3.6 EA2', productList: ['rhelai'] }, true)
    var rowKey = timelineDimensionRowKey('3.6 EA2', true)
    expect(group).not.toBe(rowKey)
    expect(rowKey).toBe('3.6 EA2-a')
  })

  it('keeps the above and below rows separate', function () {
    var node = { groupLabel: '3.6 GA', productList: ['rhai'] }

    expect(timelineDimensionGroupKey(node, true))
      .not.toBe(timelineDimensionGroupKey(node, false))
  })

  it('handles missing product metadata deterministically', function () {
    expect(timelineDimensionGroupKey({ groupLabel: '3.6 GA' }, true))
      .toBe('3.6 GA|a|')
  })

  it('handles null nodes and non-array product metadata', function () {
    expect(timelineDimensionGroupKey(null, false)).toBe('|b|')
    expect(timelineDimensionGroupKey({ groupLabel: '3.6 GA', productList: 'rhai' }, false))
      .toBe('3.6 GA|b|')
  })
})
