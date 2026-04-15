import { computed, reactive, watch } from 'vue'

export function extractProduct(releaseNumber) {
  const s = (releaseNumber || '').toLowerCase()
  const dash = s.indexOf('-')
  return dash > 0 ? s.slice(0, dash) : s
}

export function extractVersion(releaseNumber) {
  const s = releaseNumber || ''
  const dash = s.indexOf('-')
  return dash > 0 ? s.slice(dash + 1) : s
}


function aggregateRisk(releases) {
  if (releases.some(r => r.risk === 'red')) return 'red'
  if (releases.some(r => r.risk === 'yellow')) return 'yellow'
  return 'green'
}

function aggregateTotals(releases) {
  const agg = { to_do: 0, doing: 0, done: 0, remaining: 0, total: 0, issues: 0, issues_to_do: 0, issues_doing: 0, issues_done: 0 }
  for (const r of releases) {
    const t = r.totals || {}
    agg.to_do += t.to_do || 0
    agg.doing += t.doing || 0
    agg.done += t.done || 0
    agg.remaining += t.remaining || 0
    agg.total += t.total || 0
    agg.issues += t.issues || 0
    agg.issues_to_do += t.issues_to_do || 0
    agg.issues_doing += t.issues_doing || 0
    agg.issues_done += t.issues_done || 0
  }
  return agg
}

/**
 * Shared dual-filter composable for Product + Version multi-select.
 * Accepts a computed/ref array of release objects (each must have `.releaseNumber`).
 */
export function useReleaseFilter(allReleases) {
  const selectedProducts = reactive(new Set())
  const selectedVersions = reactive(new Set())

  const allProducts = computed(() =>
    [...new Set(allReleases.value.map(r => extractProduct(r.releaseNumber)).filter(Boolean))].sort()
  )

  const allVersions = computed(() =>
    [...new Set(allReleases.value.map(r => extractVersion(r.releaseNumber)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  )

  const visibleProducts = computed(() => {
    if (!selectedVersions.size) return allProducts.value
    return [...new Set(
      allReleases.value
        .filter(r => selectedVersions.has(extractVersion(r.releaseNumber)))
        .map(r => extractProduct(r.releaseNumber))
        .filter(Boolean)
    )].sort()
  })

  const visibleVersions = computed(() => {
    if (!selectedProducts.size) return allVersions.value
    return [...new Set(
      allReleases.value
        .filter(r => selectedProducts.has(extractProduct(r.releaseNumber)))
        .map(r => extractVersion(r.releaseNumber))
        .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  })

  watch(visibleProducts, (available) => {
    for (const p of [...selectedProducts]) {
      if (!available.includes(p)) selectedProducts.delete(p)
    }
  })

  watch(visibleVersions, (available) => {
    for (const v of [...selectedVersions]) {
      if (!available.includes(v)) selectedVersions.delete(v)
    }
  })

  function toggleProduct(product) {
    if (selectedProducts.has(product)) selectedProducts.delete(product)
    else selectedProducts.add(product)
  }

  function toggleVersion(version) {
    if (selectedVersions.has(version)) selectedVersions.delete(version)
    else selectedVersions.add(version)
  }

  const filteredReleases = computed(() => {
    return allReleases.value.filter(r => {
      if (selectedProducts.size && !selectedProducts.has(extractProduct(r.releaseNumber))) return false
      if (selectedVersions.size && !selectedVersions.has(extractVersion(r.releaseNumber))) return false
      return true
    })
  })

  const groupedByVersion = computed(() => {
    const map = new Map()
    for (const r of filteredReleases.value) {
      const majorVer = extractVersion(r.releaseNumber)
      if (!map.has(majorVer)) map.set(majorVer, [])
      map.get(majorVer).push(r)
    }

    const groups = []
    for (const [version, releases] of map) {
      const earliest = releases.reduce((min, r) => {
        const d = new Date(r.dueDate)
        return d < min ? d : min
      }, new Date('9999-12-31'))

      const cfDates = releases.map(r => r.codeFreezeDate).filter(Boolean)
      const earliestCodeFreeze = cfDates.length
        ? cfDates.reduce((min, d) => (new Date(d) < new Date(min) ? d : min))
        : null

      const dueDates = releases.map(r => r.dueDate).filter(Boolean)
      const earliestRelease = dueDates.length
        ? dueDates.reduce((min, d) => (new Date(d) < new Date(min) ? d : min))
        : null

      const products = [...new Set(releases.map(r => extractProduct(r.releaseNumber)))]

      groups.push({
        version,
        releases,
        risk: aggregateRisk(releases),
        totals: aggregateTotals(releases),
        earliestDue: earliest,
        earliestCodeFreeze,
        earliestRelease,
        productCount: products.length,
        productNames: products,
        releaseCount: releases.length
      })
    }

    groups.sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }))
    return groups
  })

  function clearProducts() {
    selectedProducts.clear()
  }

  function clearVersions() {
    selectedVersions.clear()
  }

  function resetFilters() {
    selectedProducts.clear()
    selectedVersions.clear()
  }

  return {
    selectedProducts,
    selectedVersions,
    allProducts,
    allVersions,
    visibleProducts,
    visibleVersions,
    filteredReleases,
    groupedByVersion,
    toggleProduct,
    toggleVersion,
    clearProducts,
    clearVersions,
    resetFilters
  }
}
