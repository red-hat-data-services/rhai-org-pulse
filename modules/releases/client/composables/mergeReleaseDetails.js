/**
 * Merge per-release TV/FV detail buckets across multiple product versions
 * (e.g. 3.6 EA1 RHOAI + RHAII + RHELAI) into one view, deduping by issue key.
 *
 * @param {Record<string, {
 *   aligned_on_time?: object[],
 *   aligned_late?: object[],
 *   after_requested?: object[],
 *   tv_only?: object[],
 *   fv_only?: object[],
 *   misaligned?: object[],
 * }>|null|undefined} releasesMap
 * @param {string[]} names
 * @returns {{
 *   aligned_on_time: object[],
 *   aligned_late: object[],
 *   after_requested: object[],
 *   tv_only: object[],
 *   fv_only: object[],
 *   misaligned: object[],
 * }|null}
 */
export function mergeReleaseDetails(releasesMap, names) {
  if (!releasesMap || !names || !names.length) return null

  var cats = ['aligned_on_time', 'aligned_late', 'after_requested', 'tv_only', 'fv_only', 'misaligned']
  var out = {
    aligned_on_time: [],
    aligned_late: [],
    after_requested: [],
    tv_only: [],
    fv_only: [],
    misaligned: [],
  }
  var seen = {
    aligned_on_time: {},
    aligned_late: {},
    after_requested: {},
    tv_only: {},
    fv_only: {},
    misaligned: {},
  }
  var any = false

  for (var i = 0; i < names.length; i++) {
    var rd = releasesMap[names[i]]
    if (!rd) continue
    any = true
    for (var ci = 0; ci < cats.length; ci++) {
      var cat = cats[ci]
      // Fall back to pre-5-category bucket names if present
      var list = rd[cat] || []
      if (!list.length && cat === 'aligned_on_time' && Array.isArray(rd.aligned)) list = rd.aligned
      if (!list.length && cat === 'misaligned' && Array.isArray(rd.mismatched)) list = rd.mismatched
      for (var fi = 0; fi < list.length; fi++) {
        var feat = list[fi]
        var key = feat && feat.key
        if (!key || seen[cat][key]) continue
        seen[cat][key] = true
        out[cat].push(feat)
      }
    }
  }

  return any ? out : null
}

/**
 * Count unique issue keys per category (and overall) for a multi-product scope.
 * Prefer this over summing per-product executive_summary counts — the same
 * feature can appear under more than one product version.
 *
 * @param {Record<string, object>|null|undefined} releasesMap
 * @param {string[]} names
 * @returns {{
 *   total: number,
 *   aligned_on_time: number,
 *   aligned_late: number,
 *   after_requested: number,
 *   tv_only: number,
 *   fv_only: number,
 *   misaligned: number,
 *   alignment_pct: number,
 * }|null}
 */
export function countUniqueCategoryTotals(releasesMap, names) {
  if (!releasesMap || !names || !names.length) return null

  // Require detail buckets for every product so we never under-count vs summary
  for (var ni = 0; ni < names.length; ni++) {
    if (!releasesMap[names[ni]]) return null
  }

  var merged = mergeReleaseDetails(releasesMap, names)
  if (!merged) return null

  var cats = ['aligned_on_time', 'aligned_late', 'after_requested', 'tv_only', 'fv_only', 'misaligned']
  var allKeys = {}
  var counts = {
    aligned_on_time: 0,
    aligned_late: 0,
    after_requested: 0,
    tv_only: 0,
    fv_only: 0,
    misaligned: 0,
  }

  for (var ci = 0; ci < cats.length; ci++) {
    var cat = cats[ci]
    var list = merged[cat] || []
    counts[cat] = list.length
    for (var fi = 0; fi < list.length; fi++) {
      var key = list[fi] && list[fi].key
      if (key) allKeys[key] = true
    }
  }

  var total = Object.keys(allKeys).length
  return {
    total: total,
    aligned_on_time: counts.aligned_on_time,
    aligned_late: counts.aligned_late,
    after_requested: counts.after_requested,
    tv_only: counts.tv_only,
    fv_only: counts.fv_only,
    misaligned: counts.misaligned,
    alignment_pct: total > 0
      ? Math.round(1000 * (counts.aligned_on_time + counts.aligned_late) / total) / 10
      : 0,
  }
}
