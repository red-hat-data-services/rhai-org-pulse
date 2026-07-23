/**
 * Tests for useReleaseFamily composable — release name parsing, cycle
 * filtering, milestone rollups, and target alignment thresholds.
 */
import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
import {
  parseReleaseName,
  compareReleases,
  extractProduct,
  extractFamily,
  extractCycle,
  extractMilestoneGroup,
  cycleLabel,
  milestoneGroupLabel,
  familyLabel,
  productLabel,
  getAlignmentTarget,
  buildNameRollup,
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

  it('parses product-family GA name', function () {
    var r = parseReleaseName('3.6 GA RHOAI RELEASE')
    expect(r).toEqual({
      product: 'rhoai', major: 3, minor: 6,
      milestone: 'GA', milestoneOrder: 99, raw: '3.6 GA RHOAI RELEASE',
    })
  })

  it('parses product-family EA2 name', function () {
    var r = parseReleaseName('3.5 EA2 RHAII RELEASE')
    expect(r).toEqual({
      product: 'rhaii', major: 3, minor: 5,
      milestone: 'EA2', milestoneOrder: 2, raw: '3.5 EA2 RHAII RELEASE',
    })
  })

  it('parses product-family EA1 RHELAI name', function () {
    var r = parseReleaseName('3.6 EA1 RHELAI RELEASE')
    expect(r.product).toBe('rhelai')
    expect(r.milestone).toBe('EA1')
  })

  it('parses RHELAI version (case-insensitive)', function () {
    var r = parseReleaseName('RHELAI-3.2')
    expect(r).toEqual({
      product: 'rhelai', major: 3, minor: 2,
      milestone: 'GA', milestoneOrder: 99, raw: 'RHELAI-3.2',
    })
  })

  it('returns null for z-stream-like RHAII versions', function () {
    expect(parseReleaseName('RHAII-3.2.3')).toBeNull()
  })

  it('returns null for unrecognised names', function () {
    expect(parseReleaseName('openshift-4.15')).toBeNull()
    expect(parseReleaseName('')).toBeNull()
    expect(parseReleaseName('random-text')).toBeNull()
  })
})

// ═══ extractCycle / milestone ═══

describe('extractCycle', function () {
  it('extracts cycle from product-family names', function () {
    expect(extractCycle('3.6 GA RHOAI RELEASE')).toBe('3.6')
    expect(extractCycle('3.5 EA1 RHELAI RELEASE')).toBe('3.5')
  })

  it('extracts cycle from legacy names', function () {
    expect(extractCycle('rhoai-3.6.EA1')).toBe('3.6')
    expect(extractCycle('RHELAI-3.2')).toBe('3.2')
  })
})

describe('extractMilestoneGroup', function () {
  it('builds milestone keys', function () {
    expect(extractMilestoneGroup('3.6 GA RHOAI RELEASE')).toBe('3.6-GA')
    expect(extractMilestoneGroup('3.6 EA2 RHAII RELEASE')).toBe('3.6-EA2')
    expect(extractMilestoneGroup('rhoai-3.5.EA1')).toBe('3.5-EA1')
  })
})

describe('cycleLabel / milestoneGroupLabel', function () {
  it('formats cycle and milestone labels', function () {
    expect(cycleLabel('3.6')).toBe('3.6 Release Cycle')
    expect(milestoneGroupLabel('3.6-GA')).toBe('3.6 GA Release')
    expect(milestoneGroupLabel('3.5-EA1')).toBe('3.5 EA1 Release')
  })
})

describe('buildNameRollup', function () {
  it('groups names cycle → milestone → product in numeric descending order', function () {
    var rollup = buildNameRollup([
      '3.5 EA1 RHOAI RELEASE',
      '3.6 GA RHELAI RELEASE',
      '3.6 GA RHOAI RELEASE',
      '3.6 EA1 RHOAI RELEASE',
      '3.5 GA RHOAI RELEASE',
    ])
    expect(rollup.map(function (c) { return c.key })).toEqual(['3.6', '3.5'])
    expect(rollup[0].milestones.map(function (m) { return m.key })).toEqual(['3.6-GA', '3.6-EA1'])
    expect(rollup[0].milestones[0].names).toEqual([
      '3.6 GA RHOAI RELEASE',
      '3.6 GA RHELAI RELEASE',
    ])
  })
})

// ═══ extractProduct ═══

describe('extractProduct', function () {
  it('extracts from legacy and product-family names', function () {
    expect(extractProduct('rhoai-3.5')).toBe('rhoai')
    expect(extractProduct('3.6 EA1 RHOAI RELEASE')).toBe('rhoai')
    expect(extractProduct('3.6 GA RHAII RELEASE')).toBe('rhaii')
  })
})

// ═══ productLabel ═══

describe('productLabel', function () {
  it('returns uppercase labels', function () {
    expect(productLabel('rhoai')).toBe('RHOAI')
    expect(productLabel('rhelai')).toBe('RHELAI')
    expect(productLabel('rhaii')).toBe('RHAII')
  })
})

// ═══ compareReleases ═══

describe('compareReleases', function () {
  it('sorts GA before EA2 before EA1 within same version', function () {
    var names = ['rhoai-3.6', 'rhoai-3.6.EA2', 'rhoai-3.6.EA1']
    var sorted = names.slice().sort(compareReleases)
    expect(sorted).toEqual(['rhoai-3.6', 'rhoai-3.6.EA2', 'rhoai-3.6.EA1'])
  })

  it('sorts newer minor versions first (descending)', function () {
    var names = ['rhoai-3.4', 'rhoai-3.6', 'rhoai-3.5']
    var sorted = names.slice().sort(compareReleases)
    expect(sorted).toEqual(['rhoai-3.6', 'rhoai-3.5', 'rhoai-3.4'])
  })

  it('sorts products RHOAI → RHAII → RHELAI within a milestone', function () {
    var names = [
      '3.6 GA RHELAI RELEASE',
      '3.6 GA RHOAI RELEASE',
      '3.6 GA RHAII RELEASE',
    ]
    var sorted = names.slice().sort(compareReleases)
    expect(sorted).toEqual([
      '3.6 GA RHOAI RELEASE',
      '3.6 GA RHAII RELEASE',
      '3.6 GA RHELAI RELEASE',
    ])
  })

  it('puts unparseable names last, sorted alphabetically', function () {
    var names = ['rhoai-3.5', 'unknown-1.0', 'rhoai-3.6']
    var sorted = names.slice().sort(compareReleases)
    expect(sorted).toEqual(['rhoai-3.6', 'rhoai-3.5', 'unknown-1.0'])
  })

  it('handles product-family multi-milestone sort matching default picker order', function () {
    var names = [
      '3.5 EA1 RHOAI RELEASE',
      '3.6 EA1 RHOAI RELEASE',
      '3.6 GA RHOAI RELEASE',
      '3.6 EA2 RHOAI RELEASE',
      '3.5 GA RHOAI RELEASE',
    ]
    var sorted = names.slice().sort(compareReleases)
    expect(sorted).toEqual([
      '3.6 GA RHOAI RELEASE',
      '3.6 EA2 RHOAI RELEASE',
      '3.6 EA1 RHOAI RELEASE',
      '3.5 GA RHOAI RELEASE',
      '3.5 EA1 RHOAI RELEASE',
    ])
  })
})

// ═══ getAlignmentTarget ═══

describe('getAlignmentTarget', function () {
  it('returns 100%* for ≤30 days', function () {
    expect(getAlignmentTarget(30)).toEqual({ target: 100, label: '100%*', maxDays: 30 })
  })

  it('returns null for >90 days', function () {
    expect(getAlignmentTarget(91)).toBeNull()
  })
})

// ═══ extractFamily / familyLabel ═══

describe('extractFamily', function () {
  it('extracts family from legacy and product-family names', function () {
    expect(extractFamily('rhoai-3.6')).toBe('rhoai-3.6')
    expect(extractFamily('rhoai-3.6.EA1')).toBe('rhoai-3.6')
    expect(extractFamily('3.6 EA1 RHOAI RELEASE')).toBe('rhoai-3.6')
    expect(extractFamily('3.6 GA RHAII RELEASE')).toBe('rhaii-3.6')
  })
})

describe('familyLabel', function () {
  it('formats product families', function () {
    expect(familyLabel('rhoai-3.6')).toBe('RHOAI 3.6')
    expect(familyLabel('rhelai-3.2')).toBe('RHELAI 3.2')
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

function makeProductFamilyRows() {
  return [
    { release: '3.6 GA RHOAI RELEASE', total: 10, aligned: 4, tv_only: 3, fv_only: 1, mismatched: 2, alignment_pct: 40 },
    { release: '3.6 GA RHAII RELEASE', total: 5, aligned: 2, tv_only: 2, fv_only: 0, mismatched: 1, alignment_pct: 40 },
    { release: '3.6 GA RHELAI RELEASE', total: 1, aligned: 1, tv_only: 0, fv_only: 0, mismatched: 0, alignment_pct: 100 },
    { release: '3.6 EA1 RHOAI RELEASE', total: 7, aligned: 2, tv_only: 3, fv_only: 1, mismatched: 1, alignment_pct: 28.6 },
    { release: '3.5 GA RHOAI RELEASE', total: 20, aligned: 10, tv_only: 5, fv_only: 2, mismatched: 3, alignment_pct: 50 },
  ]
}

describe('useReleaseFamily composable', function () {
  function makeDataRef(rows) {
    return ref({ executive_summary: rows || makeSummaryRows() })
  }

  describe('cycle filtering', function () {
    it('defaults to all', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())
      expect(rf.selectedFamily.value).toBe('all')
    })

    it('filters to a specific release cycle', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())

      rf.selectedFamily.value = '3.6'
      var rows = rf.productFilteredSummary.value
      expect(rows.length).toBe(3) // EA1, EA2, GA
      expect(rows.every(function (r) { return extractCycle(r.release) === '3.6' })).toBe(true)
    })

    it('shows all releases when set to "all"', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())
      expect(rf.productFilteredSummary.value.length).toBe(7)
    })

    it('lists cycles as filter chips', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())
      var keys = rf.availableFamilies.value.map(function (f) { return f.key })
      expect(keys).toContain('3.6')
      expect(keys).toContain('3.5')
      expect(keys).toContain('3.2')
      expect(keys[0]).toBe('3.6') // newer first
    })
  })

  describe('summaryRollup', function () {
    it('groups product-family rows into cycle → milestone → products', function () {
      var rows = makeProductFamilyRows()
      var summary = ref(rows)
      var rf = useReleaseFamily(summary, makeDataRef(rows))
      var rollup = rf.summaryRollup.value

      expect(rollup.length).toBe(2)
      expect(rollup[0].label).toBe('3.6 Release Cycle')
      expect(rollup[1].label).toBe('3.5 Release Cycle')

      var milestones = rollup[0].milestones.map(function (m) { return m.label })
      expect(milestones[0]).toBe('3.6 GA Release')
      expect(milestones).toContain('3.6 EA1 Release')

      var ga = rollup[0].milestones.find(function (m) { return m.key === '3.6-GA' })
      expect(ga.rows.map(function (r) { return r.release })).toEqual([
        '3.6 GA RHOAI RELEASE',
        '3.6 GA RHAII RELEASE',
        '3.6 GA RHELAI RELEASE',
      ])
      expect(ga.totals.total).toBe(16) // 10+5+1
      expect(ga.totals.aligned).toBe(7) // 4+2+1
    })

    it('rolls up cycle totals across milestones', function () {
      var rows = makeProductFamilyRows()
      var summary = ref(rows)
      var rf = useReleaseFamily(summary, makeDataRef(rows))
      var cycle36 = rf.summaryRollup.value[0]
      // 10+5+1 + 7 = 23
      expect(cycle36.totals.total).toBe(23)
    })
  })

  describe('sorting', function () {
    it('default sort is GA → EA2 → EA1, newer cycle first', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())
      var names = rf.sortedSummary.value.map(function (r) { return r.release })
      expect(names.indexOf('rhoai-3.6')).toBeLessThan(names.indexOf('rhoai-3.6.EA2'))
      expect(names.indexOf('rhoai-3.6.EA2')).toBeLessThan(names.indexOf('rhoai-3.6.EA1'))
      expect(names.indexOf('rhoai-3.6')).toBeLessThan(names.indexOf('rhoai-3.5'))
    })

    it('sorts within filtered cycle', function () {
      var summary = ref(makeSummaryRows())
      var rf = useReleaseFamily(summary, makeDataRef())
      rf.selectedFamily.value = '3.6'
      var names = rf.sortedSummary.value.map(function (r) { return r.release })
      expect(names).toEqual([
        'rhoai-3.6', 'rhoai-3.6.EA2', 'rhoai-3.6.EA1',
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
  })
})
