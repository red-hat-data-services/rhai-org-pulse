import { computed } from 'vue'

/** Per-release component breakdown computation. */
export function useComponentBreakdown(data, releaseData) {
  const releaseComponentBreakdown = computed(() => {
    if (!releaseData.value || !data.value) return []

    const allFeatures = [
      ...releaseData.value.aligned.map(f => ({ ...f, category: 'aligned' })),
      ...releaseData.value.tv_only.map(f => ({ ...f, category: 'tv_only' })),
      ...releaseData.value.fv_only.map(f => ({ ...f, category: 'fv_only' })),
      ...releaseData.value.mismatched.map(f => ({ ...f, category: 'mismatched' })),
    ]

    const compMap = {}
    for (const feat of allFeatures) {
      const comps = Array.isArray(feat.components)
        ? feat.components
        : (feat.component ? feat.component.split(', ').map(c => c.trim()).filter(Boolean) : [])
      for (const comp of comps) {
        if (!compMap[comp]) {
          compMap[comp] = {
            component: comp, total: 0, aligned: 0,
            tv_only: 0, fv_only: 0, mismatched: 0, keys: new Set(),
          }
        }
        if (!compMap[comp].keys.has(feat.key)) {
          compMap[comp].keys.add(feat.key)
          compMap[comp].total++
          compMap[comp][feat.category]++
        }
      }
    }

    const allComponentNames = data.value.metadata?.all_components || []

    let compList
    if (allComponentNames.length > 0) {
      compList = allComponentNames.map(compName => {
        const c = compMap[compName]
        if (!c) {
          return { component: compName, total: 0, aligned: 0, tv_only: 0, fv_only: 0, mismatched: 0, alignment_pct: 0 }
        }
        return {
          component: compName, total: c.total, aligned: c.aligned,
          tv_only: c.tv_only, fv_only: c.fv_only, mismatched: c.mismatched,
          alignment_pct: c.total ? Math.round(1000 * c.aligned / c.total) / 10 : 0,
        }
      })
    } else {
      compList = Object.values(compMap).map(c => ({
        component: c.component, total: c.total, aligned: c.aligned, tv_only: c.tv_only, fv_only: c.fv_only, mismatched: c.mismatched,
        alignment_pct: c.total ? Math.round(1000 * c.aligned / c.total) / 10 : 0,
      }))
    }

    return compList.sort((a, b) => b.total - a.total || a.component.localeCompare(b.component))
  })

  return { releaseComponentBreakdown }
}
