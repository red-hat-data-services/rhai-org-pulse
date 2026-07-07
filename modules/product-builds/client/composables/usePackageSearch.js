import { ref, computed } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const BASE = '/modules/product-builds/package-search'

export function usePackageSearch() {
  const options = ref(null)
  const results = ref(null)
  const loading = ref(false)
  const error = ref(null)
  const archFilter = ref('')

  async function loadOptions() {
    try {
      options.value = await apiRequest(BASE + '/options')
    } catch (e) {
      console.warn('[package-checker] Failed to load options:', e.message)
    }
  }

  async function search({ packageName, packageVersion, productVersion, variant, repoTypes, expandUpstream }) {
    loading.value = true
    error.value = null
    results.value = null
    archFilter.value = ''

    const params = new URLSearchParams()
    params.set('package_name', packageName.trim())
    if (packageVersion && packageVersion.trim()) {
      params.set('package_version', packageVersion.trim())
    }
    if (productVersion) {
      params.set('product_version', productVersion)
    }
    if (variant) {
      params.set('variant', variant)
    }
    if (repoTypes === 'all' && options.value && options.value.repo_types) {
      for (const rt of options.value.repo_types) {
        params.append('repo_type', rt)
      }
    } else if (repoTypes === 'test' || repoTypes === 'production') {
      params.append('repo_type', repoTypes)
    }
    if (expandUpstream) {
      params.set('expand_upstream', 'true')
    }

    try {
      const data = await apiRequest(BASE + '/search?' + params.toString())
      results.value = data
    } catch (e) {
      error.value = e.data && e.data.message ? e.data.message : e.message
    } finally {
      loading.value = false
    }
  }

  const productVersions = computed(function () {
    if (!results.value) return []
    return [...new Set(results.value.results.map(function (r) { return r.product_version }))]
  })

  const anyFound = computed(function () {
    return results.value && results.value.results.some(function (r) {
      return r.files && r.files.length > 0
    })
  })

  const anyPackageFound = computed(function () {
    return results.value && results.value.results.some(function (r) { return r.found })
  })

  const anyIndexExists = computed(function () {
    return results.value && results.value.results.some(function (r) { return r.index_exists })
  })

  const availableArchs = computed(function () {
    if (!results.value) return []
    const archs = new Set()
    for (const r of results.value.results) {
      for (const f of (r.files || [])) {
        archs.add(f.platform ? f.platform.replace(/^linux_/, '') : 'source')
      }
    }
    return [...archs].sort()
  })

  const packageUiHref = computed(function () {
    if (!options.value || !options.value.package_ui_url || !results.value) return null
    return options.value.package_ui_url
  })

  const upstreamPypiAvailable = computed(function () {
    return options.value && options.value.upstream_pypi_available === true
  })

  return {
    options,
    results,
    loading,
    error,
    archFilter,
    loadOptions,
    search,
    productVersions,
    anyFound,
    anyPackageFound,
    anyIndexExists,
    availableArchs,
    packageUiHref,
    upstreamPypiAvailable
  }
}
