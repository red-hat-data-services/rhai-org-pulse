/**
 * Tests for useReleaseFamily composable — release name parsing, product
 * filtering, release family sorting, and target alignment thresholds.
 */
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import {
  parseReleaseName,
  compareReleases,
  extractProduct,
  extractFamily,
  familyLabel,
  productLabel,
  getAlignmentTarget,
  useReleaseFamily,
} from '../../../client/composables/useReleaseFamily'

// ═══ parseReleaseName ═══

describe('parseReleaseName', function () {
  it('parses rhoai GA version', function () {
    var r = parseReleaseName('rhoai-3.5')
    expect(r).toEqual({
      product: 'rhoai', major: 3, minor: 5,
      milestone: 'GA', milestoneOrder: 99, raw: 'rhoai-3.5',
    })
  })

  it('parses rhoai EA1 version', function () {
    var r = parseReleaseName('rhoai-3.6.EA1')
    expect(r).toEqual({
      product: 'rhoai', major: 3, minor: 6,
      milestone: 'EA1', milestoneOrder: 1, raw: 'rhoai-3.6.EA1',
    })
  })

  it('parses rhoai EA2 version', function () {
    var r = parseReleaseName('rhoai-3.6.EA2')
    expect(r).toEqual({
      product: 'rhoai', major: 3, minor: 6,
      milestone: 'EA2', milestoneOrder: 2, raw: 'rhoai-3.6.EA2',
    })
  })

  it('parses RHELAI version (case-insensitive)', function () {
    var r = parseReleaseName('RHELAI-3.2')
    expect(r).toEqual({
      product: 'rhelai', major: 3, minor: 2,
      milestone: 'GA', milestoneOrder: 99, raw: 'RHELAI-3.2',
    })
  })

  it('returns null for z-stream-like RHAII versions', function () {
    // RHAII-3.2.3 has ".3" not ".EA<N>", so it doesn't match the pattern
    expect(parseReleaseName('RHAII-3.2.3')).toBeNull()
  })

  it('returns null for unrecognised names', function () {
    expect(parseReleaseName('openshift-4.15')).toBeNull()
    expect(parseReleaseName('')).toBeNull()
    expect(parseReleaseName('random-text')).toBeNull()
  })

  it('handles underscore and space separators', function () {
    var r = parseReleaseName('rhoai_3.5')
    expect(r).not.toBeNull()
    expect(r.product).toBe('rhoai')
    expect(r.major).toBe(3)
    expect(r.minor).toBe(5)
  })
})

// ═══ extractProduct ═══

describe('extractProduct', function () {
  it('extracts rhoai', function () {
    expect(extractProduct('rhoai-3.5')).toBe('rhoai')
    expect(extractProduct('rhoai-3.6.EA1')).toBe('rhoai')
  })

  it('extracts rhelai (case-insensitive)', function () {
    expect(extractProduct('RHELAI-3.2')).toBe('rhelai')
  })

  it('extracts rhaii', function () {
    expect(extractProduct('RHAII-3.2.3')).toBe('rhaii')
  })

  it('returns null for unknown products', function () {
    expect(extractProduct('openshift-4.15')).toBeNull()
    expect(extractProduct('')).toBeNull()
  })
})

// ═══ productLabel ═══

describe('productLabel', function () {
  it('returns uppercase labels', function () {
    expect(productLabel('rhoai')).toBe('RHOAI')
    expect(productLabel('rhelai')).toBe('RHELAI')
    expect(productLabel('rhaii')).toBe('RHAII')
  })

  it('passes through unknown products', function () {
    expect(productLabel('foo')).toBe('foo')
  })
})

// ═══ compareReleases ═══

describe('compareReleases', function () {
  it('sorts EA1 before EA2 before GA within same version', function () {
    var names = ['rhoai-3.6', 'rhoai-3.6.EA2', 'rhoai-3.6.EA1']
    var sorted = names.slice().sort(compareReleases)
    expect(sorted).toEqual(['rhoai-3.6.EA1', 'rhoai-3.6.EA2', 'rhoai-3.6'])
  })

  it('sorts newer minor versions first (descending)', function () {
    var names = ['rhoai-3.4', 'rhoai-3.6', 'rhoai-3.5']
    var sorted = names.slice().sort(compareReleases)
    expect(sorted).toEqual(['rhoai-3.6', 'rhoai-3.5', 'rhoai-3.4'])
  })

  it('sorts by product alphabetically', function () {
    var names = ['rhoai-3.5', 'RHELAI-3.2', 'RHAII-3.2.3']
    var sorted = names.slice().sort(compareReleases)
    // rhaii < rhelai < rhoai alphabetically
    // But RHAII-3.2.3 won't parse (z-stream), so it sorts last
    expect(sorted[sorted.length - 1]).toBe('RHAII-3.2.3')
  })

  it('puts unparseable names last, sorted alphabetically', function () {
    var names = ['rhoai-3.5', 'unknown-1.0', 'rhoai-3.6']
    var sorted = names.slice().sort(compareReleases)
    expect(sorted).toEqual(['rhoai-3.6', 'rhoai-3.5', 'unknown-1.0'])
  })

  it('handles full multi-product multi-milestone sort', function () {
    var names = [
      'rhoai-3.5', 'rhoai-3.5.EA1', 'rhoai-3.5.EA2',
      'rhoai-3.6', 'rhoai-3.6.EA1', 'rhoai-3.6.EA2',
      'RHELAI-3.2',
    ]
    var sorted = names.slice().sort(compareReleases)
    // rhelai first (alphabetically), then rhoai 3.6 family, then 3.5 family
    expect(sorted).toEqual([
      'RHELAI-3.2',
      'rhoai-3.6.EA1', 'rhoai-3.6.EA2', 'rhoai-3.6',
      'rhoai-3.5.EA1', 'rhoai-3.5.EA2', 'rhoai-3.5',
    ])
  })
})

// ═══ getAlignmentTarget ═══

describe('getAlignmentTarget', function () {
  it('returns 100%* for ≤30 days', function () {
    expect(getAlignmentTarget(30)).toEqual({ target: 100, label: '100%*', maxDays: 30 })
    expect(getAlignmentTarget(1)).toEqual({ target: 100, label: '100%*', maxDays: 30 })
  })

  it('returns 100%* for released (≤0 days)', function () {
    expect(getAlignmentTarget(0)).toEqual({ target: 100, label: '100%*', maxDays: 0 })
    expect(getAlignmentTarget(-5)).toEqual({ target: 100, label: '100%*', maxDays: 0 })
  })

  it('returns 95%* for 31-60 days', function () {
    expect(getAlignmentTarget(31)).toEqual({ target: 95, label: '95%*', maxDays: 60 })
    expect(getAlignmentTarget(60)).toEqual({ target: 95, label: '95%*', maxDays: 60 })
  })

  it('returns 90%* for 61-90 days', function () {
    expect(getAlignmentTarget(61)).toEqual({ target: 90, label: '90%*', maxDays: 90 })
    expect(getAlignmentTarget(90)).toEqual({ target: 90, label: '90%*', maxDays: 90 })
  })

  it('returns null for >90 days', function () {
    expect(getAlignmentTarget(91)).toBeNull()
    expect(getAlignmentTarget(180)).toBeNull()
    expect(getAlignmentTarget(365)).toBeNull()
  })

  it('returns null for null/undefined input', function () {
    expect(getAlignmentTarget(null)).toBeNull()
    expect(getAlignmentTarget(undefined)).toBeNull()
  })
})

// ═══ useReleaseFamily composable ═══

function makeSummaryRows() {
  return [
    { release: 'rhoai-3.6.EA1', total: 7, aligned: 2, tv_only: 3, fv_only: 1, mismatched: 1, alignment_pct: 28.6, ga_date: '2026-09-17' },
    { release: 'rhoai-3.6.EA2', total: 4, aligned: 0, tv_only: 2, fv_only: 1, mismatched: 1, alignment_pct: 0, ga_date: '2026-10-15' },
    { release: 'rhoai-3.6', total: 12, aligned: 3, tv_only: 5, fv_only: 2, mismatched: 2, alignment_pct: 25, ga_date: '2026-11-19' },
    { release: 'rhoai-3.5', total: 155, aligned: 50, tv_only: 60, fv_only: 25, mismatched: 20, alignment_pct: 32.3, ga_date: '2026-08-20' },
    { release: 'rhoai-3.5.EA1', total: 24, aligned: 14, tv_only: 5, fv_only: 3, mismatched: 2, alignment_pct: 58.3, ga_date: null },
    { release: 'RHELAI-3.2', total: 1, aligned: 1, tv_only: 0, fv_only: 0, mismatched: 0, alignment_pct: 100, ga_date: null },
    { release: 'RHAII-3.2.3', total: 3, aligned: 2, tv_only: 1, fv_only: 0, mismatched: 0, alignment_pct: 66.7, ga_date: null },
  ]
}

// ═══ extractFamily ═══

describe('extractFamily', function () {
  it('extracts family from GA version', function () {
    expect(extractFamily('rhoai-3.6')).toBe('rhoai-3.6')
  })

  it('extracts family from EA version', function () {
    expect(extractFamily('rhoai-3.6.EA1')).toBe('rhoai-3.6')
    expect(extractFamily('rhoai-3.6.EA2')).toBe('rhoai-3.6')
  })

  it('extracts family case-insensitively', function () {
    expect(extractFamily('RHELAI-3.2')).toBe('rhelai-3.2')
  })

  it('falls back to lowercase name for unparseable releases', function () {
    expect(extractFamily('RHAII-3.2.3')).toBe('rhaii-3.2')
  })
})

// ═══ familyLabel ═══

describe('familyLabel', function () {
  it('formats rhoai family', function () {
    expect(familyLabel('rhoai-3.6')).toBe('RHOAI 3.6')
  })

  it('formats rhelai family', function () {
    expect(familyLabel('rhelai-3.2')).toBe('RHELAI 3.2')
  })

  it('passes through unknown keys', function () {
    expect(familyLabel('unknown')).toBe('unknown')
  })
})

describe('useReleaseFamily composable', function () {
  function makeDataRef() {
    return ref({ executive_summary: makeSummaryRows() })
  }

  describe('release family filtering', function () {
    it('defaults to all', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())
      expect(rf.selectedFamily.value).toBe('all')
    })

    it('filters to a specific release family', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())

      rf.selectedFamily.value = 'rhoai-3.6'
      var rows = rf.productFilteredSummary.value
      expect(rows.length).toBe(3) // EA1, EA2, GA
      expect(rows.every(function (r) { return extractFamily(r.release) === 'rhoai-3.6' })).toBe(true)
    })

    it('shows all releases when set to "all"', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())
      expect(rf.productFilteredSummary.value.length).toBe(7)
    })

    it('filters to rhelai family', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())
      rf.selectedFamily.value = 'rhelai-3.2'
      var rows = rf.productFilteredSummary.value
      expect(rows.length).toBe(1)
      expect(rows[0].release).toBe('RHELAI-3.2')
    })

    it('discovers families from full data, not just filtered summary', function () {
      var filteredOnly = ref(makeSummaryRows().filter(function (r) { return extractProduct(r.release) === 'rhoai' }))
      var fullData = makeDataRef()
      var rf = useReleaseFamily(filteredOnly, fullData)
      var familyKeys = rf.availableFamilies.value.map(function (f) { return f.key })
      expect(familyKeys).toContain('rhoai-3.6')
      expect(familyKeys).toContain('rhoai-3.5')
      expect(familyKeys).toContain('rhelai-3.2')
    })

    it('lists families with display labels', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())
      var labels = rf.availableFamilies.value.map(function (f) { return f.label })
      expect(labels).toContain('RHOAI 3.6')
      expect(labels).toContain('RHOAI 3.5')
      expect(labels).toContain('RHELAI 3.2')
    })
  })

  describe('sorting', function () {
    it('default sort is release family order (all products)', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())
      var sorted = rf.sortedSummary.value
      var names = sorted.map(function (r) { return r.release })
      // Default is "all", so all products show — rhelai first (alpha), then rhaii (unparseable, last), then rhoai
      expect(names[0]).toBe('RHELAI-3.2')
      // rhoai 3.6 family then 3.5 family
      expect(names.indexOf('rhoai-3.6.EA1')).toBeLessThan(names.indexOf('rhoai-3.6'))
      expect(names.indexOf('rhoai-3.6')).toBeLessThan(names.indexOf('rhoai-3.5'))
    })

    it('sorts within filtered family', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())
      rf.selectedFamily.value = 'rhoai-3.6'
      var sorted = rf.sortedSummary.value
      var names = sorted.map(function (r) { return r.release })
      expect(names).toEqual([
        'rhoai-3.6.EA1', 'rhoai-3.6.EA2', 'rhoai-3.6',
      ])
    })

    it('toggleSort cycles asc → desc → clear', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())

      rf.toggleSummarySort('total')
      expect(rf.sortColumn.value).toBe('total')
      expect(rf.sortDirection.value).toBe('asc')

      rf.toggleSummarySort('total')
      expect(rf.sortDirection.value).toBe('desc')

      rf.toggleSummarySort('total')
      expect(rf.sortColumn.value).toBeNull()
      expect(rf.sortDirection.value).toBe('asc')
    })

    it('sorts by total ascending', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())
      rf.toggleSummarySort('total')
      var totals = rf.sortedSummary.value.map(function (r) { return r.total })
      for (var i = 1; i < totals.length; i++) {
        expect(totals[i]).toBeGreaterThanOrEqual(totals[i - 1])
      }
    })

    it('sorts by total descending', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())
      rf.toggleSummarySort('total')
      rf.toggleSummarySort('total')
      var totals = rf.sortedSummary.value.map(function (r) { return r.total })
      for (var i = 1; i < totals.length; i++) {
        expect(totals[i]).toBeLessThanOrEqual(totals[i - 1])
      }
    })

    it('sorts by alignment_pct', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())
      rf.toggleSummarySort('alignment_pct')
      var pcts = rf.sortedSummary.value.map(function (r) { return r.alignment_pct })
      for (var i = 1; i < pcts.length; i++) {
        expect(pcts[i]).toBeGreaterThanOrEqual(pcts[i - 1])
      }
    })

    it('sortIcon returns correct state', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())
      expect(rf.summarySortIcon('total')).toBe('none')
      rf.toggleSummarySort('total')
      expect(rf.summarySortIcon('total')).toBe('asc')
      expect(rf.summarySortIcon('aligned')).toBe('none')
      rf.toggleSummarySort('total')
      expect(rf.summarySortIcon('total')).toBe('desc')
    })

    it('switching columns resets direction to asc', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())
      rf.toggleSummarySort('total')
      rf.toggleSummarySort('total') // desc
      rf.toggleSummarySort('aligned') // switch column
      expect(rf.sortColumn.value).toBe('aligned')
      expect(rf.sortDirection.value).toBe('asc')
    })
  })
})
