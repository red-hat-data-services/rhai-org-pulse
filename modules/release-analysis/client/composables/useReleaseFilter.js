import { computed, reactive, ref, watch } from 'vue'

function extractProduct(releaseNumber) {
  const s = (releaseNumber || '').toLowerCase()
  const dash = s.indexOf('-')
  return dash > 0 ? s.slice(0, dash) : s
}

function extractVersion(releaseNumber) {
  const s = releaseNumber || ''
  const dash = s.indexOf('-')
  return dash > 0 ? s.slice(dash + 1) : s
}

/**
 * Shared dual-filter composable for Product + Version multi-select.
 * Accepts a computed/ref array of release objects (each must have `.releaseNumber`).
 */
export function useReleaseFilter(allReleases) {
  const selectedProducts = reactive(new Set())
  const selectedVersions = reactive(new Set())
  const productDropdownOpen = ref(false)
  const versionDropdownOpen = ref(false)

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

  function resetFilters() {
    selectedProducts.clear()
    selectedVersions.clear()
  }

  return {
    selectedProducts,
    selectedVersions,
    productDropdownOpen,
    versionDropdownOpen,
    allProducts,
    allVersions,
    visibleProducts,
    visibleVersions,
    filteredReleases,
    toggleProduct,
    toggleVersion,
    resetFilters
  }
}
