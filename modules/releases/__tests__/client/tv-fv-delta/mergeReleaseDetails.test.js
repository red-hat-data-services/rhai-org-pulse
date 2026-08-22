/**
 * Unit tests for merging multi-product release detail buckets.
 */
import { describe, it, expect } from 'vitest'
import { mergeReleaseDetails, countUniqueCategoryTotals } from '../../../client/composables/mergeReleaseDetails'

describe('mergeReleaseDetails', function () {
  it('returns null when no names or missing map', function () {
    expect(mergeReleaseDetails(null, ['a'])).toBeNull()
    expect(mergeReleaseDetails({}, [])).toBeNull()
    expect(mergeReleaseDetails({ a: { aligned_on_time: [] } }, ['missing'])).toBeNull()
  })

  it('merges categories across products and dedupes by key', function () {
    var releases = {
      '3.6 EA1 RHOAI RELEASE': {
        aligned_on_time: [{ key: 'RHAISTRAT-1', summary: 'A' }],
        aligned_late: [],
        tv_only: [{ key: 'RHAISTRAT-2', summary: 'B' }],
        fv_only: [],
        misaligned: [],
      },
      '3.6 EA1 RHAII RELEASE': {
        aligned_on_time: [{ key: 'RHAISTRAT-1', summary: 'A-dup' }, { key: 'RHAISTRAT-3', summary: 'C' }],
        aligned_late: [{ key: 'RHAISTRAT-5', summary: 'E' }],
        tv_only: [],
        fv_only: [{ key: 'RHAISTRAT-4', summary: 'D' }],
        misaligned: [],
      },
    }

    var merged = mergeReleaseDetails(releases, [
      '3.6 EA1 RHOAI RELEASE',
      '3.6 EA1 RHAII RELEASE',
    ])

    expect(merged.aligned_on_time.map(function (f) { return f.key })).toEqual(['RHAISTRAT-1', 'RHAISTRAT-3'])
    expect(merged.aligned_late.map(function (f) { return f.key })).toEqual(['RHAISTRAT-5'])
    expect(merged.tv_only.map(function (f) { return f.key })).toEqual(['RHAISTRAT-2'])
    expect(merged.fv_only.map(function (f) { return f.key })).toEqual(['RHAISTRAT-4'])
    expect(merged.misaligned).toEqual([])
  })

  it('skips names without detail data', function () {
    var merged = mergeReleaseDetails(
      {
        '3.6 EA1 RHOAI RELEASE': {
          aligned_on_time: [{ key: 'X' }],
          aligned_late: [],
          tv_only: [],
          fv_only: [],
          misaligned: [],
        },
      },
      ['3.6 EA1 RHOAI RELEASE', '3.6 EA1 RHELAI RELEASE'],
    )
    expect(merged.aligned_on_time).toHaveLength(1)
  })

  it('falls back to legacy aligned/mismatched buckets', function () {
    var merged = mergeReleaseDetails(
      {
        '3.6 EA1 RHOAI RELEASE': {
          aligned: [{ key: 'LEGACY-A' }],
          mismatched: [{ key: 'LEGACY-M' }],
          tv_only: [],
          fv_only: [],
        },
      },
      ['3.6 EA1 RHOAI RELEASE'],
    )
    expect(merged.aligned_on_time.map(function (f) { return f.key })).toEqual(['LEGACY-A'])
    expect(merged.misaligned.map(function (f) { return f.key })).toEqual(['LEGACY-M'])
    expect(merged.aligned_late).toEqual([])
  })
})

describe('countUniqueCategoryTotals', function () {
  it('dedupes the same key across products in every category', function () {
    var releases = {
      '3.6 EA1 RHOAI RELEASE': {
        aligned_on_time: [{ key: 'A-SHARED' }, { key: 'A-RHOAI' }],
        aligned_late: [{ key: 'L-SHARED' }],
        tv_only: [{ key: 'T-SHARED' }, { key: 'T-RHOAI' }],
        fv_only: [{ key: 'F-RHOAI' }],
        misaligned: [{ key: 'M-SHARED' }, { key: 'M-RHOAI' }],
      },
      '3.6 EA1 RHAII RELEASE': {
        aligned_on_time: [{ key: 'A-SHARED' }, { key: 'A-RHAII' }],
        aligned_late: [{ key: 'L-SHARED' }],
        tv_only: [{ key: 'T-SHARED' }, { key: 'T-RHAII' }],
        fv_only: [],
        misaligned: [{ key: 'M-SHARED' }],
      },
    }

    // Naive sum would be on_time 4, late 2, tv 4, fv 1, mis 3, total 14
    var totals = countUniqueCategoryTotals(releases, [
      '3.6 EA1 RHOAI RELEASE',
      '3.6 EA1 RHAII RELEASE',
    ])
    expect(totals.aligned_on_time).toBe(3) // A-SHARED, A-RHOAI, A-RHAII
    expect(totals.aligned_late).toBe(1) // L-SHARED
    expect(totals.tv_only).toBe(3) // T-SHARED, T-RHOAI, T-RHAII
    expect(totals.fv_only).toBe(1)
    expect(totals.misaligned).toBe(2) // M-SHARED, M-RHOAI
    expect(totals.total).toBe(10)
    expect(totals.alignment_pct).toBe(40) // (3+1)/10
  })

  it('returns null when any product is missing detail data', function () {
    expect(countUniqueCategoryTotals(
      { '3.6 EA1 RHOAI RELEASE': { aligned_on_time: [], aligned_late: [], tv_only: [], fv_only: [], misaligned: [] } },
      ['3.6 EA1 RHOAI RELEASE', '3.6 EA1 RHAII RELEASE'],
    )).toBeNull()
  })
})
