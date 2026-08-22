import { computed } from 'vue'
import { buildKeysJqlUrl } from './jiraKeysJql'

var CATEGORIES = ['aligned_on_time', 'aligned_late', 'after_requested', 'tv_only', 'fv_only', 'misaligned']

function emptyBucket() {
  return {
    component: '',
    total: 0,
    aligned_on_time: 0,
    aligned_late: 0,
    after_requested: 0,
    tv_only: 0,
    fv_only: 0,
    misaligned: 0,
    alignment_pct: 0,
    total_jql: '',
    aligned_on_time_jql: '',
    aligned_late_jql: '',
    after_requested_jql: '',
    tv_only_jql: '',
    fv_only_jql: '',
    misaligned_jql: '',
  }
}

function featuresForKeys(keySet, byKey) {
  var out = []
  keySet.forEach(function (key) {
    if (byKey[key]) out.push(byKey[key])
  })
  return out
}

function toRow(compName, bucket, byKey) {
  if (!bucket) {
    var empty = emptyBucket()
    empty.component = compName
    return empty
  }

  var totalFeatures = featuresForKeys(bucket.keys, byKey)
  return {
    component: compName,
    total: bucket.total,
    aligned_on_time: bucket.aligned_on_time,
    aligned_late: bucket.aligned_late,
    after_requested: bucket.after_requested,
    tv_only: bucket.tv_only,
    fv_only: bucket.fv_only,
    misaligned: bucket.misaligned,
    alignment_pct: bucket.total
      ? Math.round(1000 * (bucket.aligned_on_time + bucket.aligned_late) / bucket.total) / 10
      : 0,
    total_jql: buildKeysJqlUrl(totalFeatures),
    aligned_on_time_jql: buildKeysJqlUrl(featuresForKeys(bucket.byCategory.aligned_on_time, byKey)),
    aligned_late_jql: buildKeysJqlUrl(featuresForKeys(bucket.byCategory.aligned_late, byKey)),
    after_requested_jql: buildKeysJqlUrl(featuresForKeys(bucket.byCategory.after_requested, byKey)),
    tv_only_jql: buildKeysJqlUrl(featuresForKeys(bucket.byCategory.tv_only, byKey)),
    fv_only_jql: buildKeysJqlUrl(featuresForKeys(bucket.byCategory.fv_only, byKey)),
    misaligned_jql: buildKeysJqlUrl(featuresForKeys(bucket.byCategory.misaligned, byKey)),
  }
}

/** Per-release component breakdown computation. */
export function useComponentBreakdown(data, releaseData) {
  const releaseComponentBreakdown = computed(() => {
    if (!releaseData.value || !data.value) return []

    const allFeatures = [
      ...(releaseData.value.aligned_on_time || []).map(f => ({ ...f, category: 'aligned_on_time' })),
      ...(releaseData.value.aligned_late || []).map(f => ({ ...f, category: 'aligned_late' })),
      ...(releaseData.value.after_requested || []).map(f => ({ ...f, category: 'after_requested' })),
      ...(releaseData.value.tv_only || []).map(f => ({ ...f, category: 'tv_only' })),
      ...(releaseData.value.fv_only || []).map(f => ({ ...f, category: 'fv_only' })),
      ...(releaseData.value.misaligned || []).map(f => ({ ...f, category: 'misaligned' })),
    ]

    const byKey = {}
    const compMap = {}
    for (const feat of allFeatures) {
      if (feat.key) byKey[feat.key] = feat
      const comps = Array.isArray(feat.components)
        ? feat.components
        : (feat.component ? feat.component.split(', ').map(c => c.trim()).filter(Boolean) : [])
      for (const comp of comps) {
        if (!compMap[comp]) {
          var byCategory = {}
          for (var ci = 0; ci < CATEGORIES.length; ci++) {
            byCategory[CATEGORIES[ci]] = new Set()
          }
          compMap[comp] = {
            component: comp,
            total: 0,
            aligned_on_time: 0,
            aligned_late: 0,
            after_requested: 0,
            tv_only: 0,
            fv_only: 0,
            misaligned: 0,
            keys: new Set(),
            byCategory: byCategory,
          }
        }
        if (!compMap[comp].keys.has(feat.key)) {
          compMap[comp].keys.add(feat.key)
          compMap[comp].total++
          compMap[comp][feat.category]++
          if (feat.key) compMap[comp].byCategory[feat.category].add(feat.key)
        }
      }
    }

    const allComponentNames = data.value.metadata?.all_components || []

    let compList
    if (allComponentNames.length > 0) {
      compList = allComponentNames.map(compName => toRow(compName, compMap[compName], byKey))
    } else {
      compList = Object.keys(compMap).map(compName => toRow(compName, compMap[compName], byKey))
    }

    return compList.sort((a, b) => b.total - a.total || a.component.localeCompare(b.component))
  })

  return { releaseComponentBreakdown }
}
