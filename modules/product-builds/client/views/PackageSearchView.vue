<script setup>
import { ref, onMounted, computed } from 'vue'
import { usePackageSearch } from '../composables/usePackageSearch'

const {
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
  packageUiHref
} = usePackageSearch()

const packageName = ref('')
const packageVersion = ref('')
const selectedProductVersion = ref('')
const selectedVariant = ref('')
const selectedRepoTypes = ref('default')

const REPO_TYPE_LABELS = {
  production: 'Production',
  test: 'Test',
  sdists: 'SDists',
  'sdists-test': 'SDists Test'
}
const REPO_TYPE_ORDER = ['test', 'production', 'sdists-test', 'sdists']

const showVersionDropdown = ref(false)
const versionInputEdited = ref(false)

const filteredProductVersions = computed(() => {
  if (!options.value || !options.value.product_versions) return []
  if (!versionInputEdited.value) return options.value.product_versions
  const q = selectedProductVersion.value.trim().toLowerCase()
  if (!q) return options.value.product_versions
  return options.value.product_versions.filter(v => v.toLowerCase().includes(q))
})

function onVersionFocus() {
  versionInputEdited.value = false
  showVersionDropdown.value = true
}

function onVersionInput() {
  versionInputEdited.value = true
  showVersionDropdown.value = true
}

function selectProductVersion(v) {
  selectedProductVersion.value = v
  showVersionDropdown.value = false
  versionInputEdited.value = false
}

function hideVersionDropdown() {
  setTimeout(() => { showVersionDropdown.value = false }, 200)
}

const canSubmit = computed(() => !loading.value && packageName.value.trim() && options.value)
const hasSearched = computed(() => results.value !== null)

onMounted(async () => {
  await loadOptions()
})

async function handleSubmit() {
  if (!canSubmit.value) return
  await search({
    packageName: packageName.value,
    packageVersion: packageVersion.value,
    productVersion: selectedProductVersion.value,
    variant: selectedVariant.value,
    repoTypes: selectedRepoTypes.value
  })
}

function filterFiles(files) {
  if (!archFilter.value) return files
  return files.filter(f => {
    if (archFilter.value === 'source') return !f.platform
    return f.platform && f.platform.includes(archFilter.value)
  })
}

function getVersionResults(pv) {
  if (!results.value) return []
  return results.value.results.filter(r => r.product_version === pv)
}

function getVariantsForVersion(versionResults) {
  return [...new Set(versionResults.map(r => r.variant))]
}

function getRepoTypesForVersion(versionResults) {
  const rts = [...new Set(versionResults.map(r => r.repo_type))]
  return rts.sort((a, b) => REPO_TYPE_ORDER.indexOf(a) - REPO_TYPE_ORDER.indexOf(b))
}

function getResult(versionResults, variant, repoType) {
  return versionResults.find(r => r.variant === variant && r.repo_type === repoType)
}

function badgeFor(result) {
  if (!result) return null
  if (!result.index_exists && result.error === 'timeout') return { label: 'Timeout', style: 'warn' }
  if (!result.index_exists) return { label: 'No index', style: 'muted' }
  if (!result.found) return { label: 'Not found', style: 'warn' }
  const count = filterFiles(result.files).length
  if (count === 0) return { label: '0 files', style: 'muted' }
  return { label: count + ' file' + (count !== 1 ? 's' : ''), style: 'success' }
}

function hasFiles(r) {
  return r && r.found && r.files && filterFiles(r.files).length > 0
}

const repoAvailability = computed(() => {
  if (!results.value) return { testOnly: [], prodOnly: [] }
  const testOnly = []
  const prodOnly = []

  for (const pv of productVersions.value) {
    const vr = getVersionResults(pv)
    for (const v of getVariantsForVersion(vr)) {
      const test = getResult(vr, v, 'test')
      const prod = getResult(vr, v, 'production')
      const inTest = hasFiles(test)
      const inProd = hasFiles(prod)
      if (inTest && !inProd) testOnly.push({ productVersion: pv, variant: v })
      if (inProd && !inTest) prodOnly.push({ productVersion: pv, variant: v })
    }
  }
  return { testOnly, prodOnly }
})

const hasAvailabilityInsights = computed(() => {
  return repoAvailability.value.testOnly.length > 0 || repoAvailability.value.prodOnly.length > 0
})

const resultSummary = computed(() => {
  if (!results.value) return null
  const total = results.value.results.length
  const found = results.value.results.filter(r => r.found && r.files && r.files.length > 0).length
  const notFound = results.value.results.filter(r => r.index_exists && !r.found).length
  const noIndex = results.value.results.filter(r => !r.index_exists).length
  return { total, found, notFound, noIndex }
})

const expandedVersions = ref(new Set())
const versionVariantFilter = ref('')
const versionRepoFilter = ref('')

function clearVersionFilters() {
  versionVariantFilter.value = ''
  versionRepoFilter.value = ''
}

function toggleVariantFilter(variant) {
  versionVariantFilter.value = versionVariantFilter.value === variant ? '' : variant
}

function toggleRepoFilter(rt) {
  versionRepoFilter.value = versionRepoFilter.value === rt ? '' : rt
}

function toggleVersion(version) {
  const next = new Set(expandedVersions.value)
  if (next.has(version)) next.delete(version)
  else next.add(version)
  expandedVersions.value = next
}

const versionBreakdown = computed(() => {
  if (!results.value) return []
  const byVersion = {}
  for (const r of results.value.results) {
    if (!r.found || !r.files) continue
    for (const f of filterFiles(r.files)) {
      if (f.version === 'unknown') continue
      if (!byVersion[f.version]) {
        byVersion[f.version] = {
          version: f.version,
          files: 0,
          variants: new Set(),
          repoTypes: new Set(),
          productVersions: new Set(),
          byVariant: {}
        }
      }
      const entry = byVersion[f.version]
      entry.files++
      entry.variants.add(r.variant)
      entry.repoTypes.add(r.repo_type)
      entry.productVersions.add(r.product_version)
      const variantKey = r.variant + ' / ' + (REPO_TYPE_LABELS[r.repo_type] || r.repo_type)
      if (!entry.byVariant[variantKey]) {
        entry.byVariant[variantKey] = { variant: r.variant, repoType: r.repo_type, label: variantKey, indexUrl: r.index_url, files: [] }
      }
      entry.byVariant[variantKey].files.push(f)
    }
  }
  return Object.values(byVersion)
    .map(v => ({
      version: v.version,
      files: v.files,
      variants: [...v.variants].sort(),
      repoTypes: [...v.repoTypes].sort((a, b) => REPO_TYPE_ORDER.indexOf(a) - REPO_TYPE_ORDER.indexOf(b)),
      productVersions: [...v.productVersions],
      groups: Object.values(v.byVariant).sort((a, b) => a.label.localeCompare(b.label))
    }))
    .sort((a, b) => {
      const pa = a.version.split('.').map(Number)
      const pb = b.version.split('.').map(Number)
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0)
      }
      return 0
    })
})

const filteredVersionBreakdown = computed(() => {
  if (!versionVariantFilter.value && !versionRepoFilter.value) return versionBreakdown.value
  return versionBreakdown.value
    .map(v => {
      const groups = v.groups.filter(g =>
        (!versionVariantFilter.value || g.variant === versionVariantFilter.value) &&
        (!versionRepoFilter.value || g.repoType === versionRepoFilter.value)
      )
      if (groups.length === 0) return null
      const files = groups.reduce((sum, g) => sum + g.files.length, 0)
      return { ...v, groups, files }
    })
    .filter(Boolean)
})

const allVersionVariants = computed(() => {
  const s = new Set()
  for (const v of versionBreakdown.value) {
    for (const variant of v.variants) s.add(variant)
  }
  return [...s].sort()
})

const allVersionRepoTypes = computed(() => {
  const s = new Set()
  for (const v of versionBreakdown.value) {
    for (const rt of v.repoTypes) s.add(rt)
  }
  return [...s].sort((a, b) => REPO_TYPE_ORDER.indexOf(a) - REPO_TYPE_ORDER.indexOf(b))
})

const showVersionBreakdown = computed(() => {
  return versionBreakdown.value.length > 1 || (versionBreakdown.value.length === 1 && !results.value.requested_version)
})

const isMultiProductSearch = computed(() => {
  return results.value && !selectedProductVersion.value.trim() && productVersions.value.length > 1
})

const versionMatrix = computed(() => {
  if (!results.value || !isMultiProductSearch.value) return null
  const pkgVersions = new Set()
  const prodVersions = [...productVersions.value]
  const cells = {}

  for (const r of results.value.results) {
    if (!r.found || !r.files) continue
    for (const f of filterFiles(r.files)) {
      if (f.version === 'unknown') continue
      pkgVersions.add(f.version)
      const key = f.version + '\0' + r.product_version
      if (!cells[key]) cells[key] = { count: 0, variants: new Set() }
      cells[key].count++
      cells[key].variants.add(r.variant)
    }
  }

  const sortedPkgVersions = [...pkgVersions].sort((a, b) => {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      if ((pb[i] || 0) !== (pa[i] || 0)) return (pb[i] || 0) - (pa[i] || 0)
    }
    return 0
  })

  function getCell(pkgVer, prodVer) {
    return cells[pkgVer + '\0' + prodVer] || null
  }

  return { pkgVersions: sortedPkgVersions, prodVersions, getCell }
})
</script>

<template>
  <div class="space-y-6">

    <!-- Search Form -->
    <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
      <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 rounded-t-xl">
        <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Search filters</p>
      </div>
      <div class="p-4">
        <form @submit.prevent="handleSubmit">
          <!-- Row 1: Package name + version -->
          <div class="flex flex-wrap gap-3 mb-3">
            <div class="flex-[2] min-w-[220px]">
              <label class="block text-xs uppercase tracking-wide font-medium text-gray-500 dark:text-gray-400 mb-1">
                Package Name <span class="text-red-500">*</span>
              </label>
              <input
                v-model="packageName"
                type="text"
                placeholder="torch, vllm, transformers..."
                autofocus
                class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 w-full placeholder-gray-400"
              />
            </div>
            <div class="flex-1 min-w-[140px]">
              <label class="block text-xs uppercase tracking-wide font-medium text-gray-500 dark:text-gray-400 mb-1">
                Package Version
              </label>
              <input
                v-model="packageVersion"
                type="text"
                placeholder="e.g. 2.5.1"
                class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 w-full placeholder-gray-400"
              />
            </div>
          </div>

          <!-- Row 2: Filters + Search -->
          <div class="flex flex-wrap gap-3 items-end">
            <div class="flex-1 min-w-[120px] relative">
              <label class="block text-xs uppercase tracking-wide font-medium text-gray-500 dark:text-gray-400 mb-1">
                Product Version
              </label>
              <div class="relative">
                <input
                  v-model="selectedProductVersion"
                  type="text"
                  placeholder="e.g. 3.4"
                  class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 pr-8 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 w-full placeholder-gray-400"
                  @focus="onVersionFocus()"
                  @input="onVersionInput()"
                  @blur="hideVersionDropdown()"
                />
                <svg class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
              <ul
                v-if="showVersionDropdown && filteredProductVersions.length > 0"
                class="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg py-1"
              >
                <li
                  v-for="v in filteredProductVersions"
                  :key="v"
                  class="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-900/30"
                  :class="{ 'bg-gray-50 dark:bg-gray-900/30 font-medium text-gray-900 dark:text-gray-100': v === selectedProductVersion }"
                  @mousedown.prevent="selectProductVersion(v)"
                >{{ v }}</li>
              </ul>
            </div>
            <div class="flex-1 min-w-[120px]">
              <label class="block text-xs uppercase tracking-wide font-medium text-gray-500 dark:text-gray-400 mb-1">
                Variant
              </label>
              <select
                v-model="selectedVariant"
                class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 w-full"
              >
                <option value="">All variants</option>
                <option v-for="v in (options ? options.variants : [])" :key="v" :value="v">{{ v }}</option>
              </select>
            </div>
            <div class="flex-1 min-w-[120px]">
              <label class="block text-xs uppercase tracking-wide font-medium text-gray-500 dark:text-gray-400 mb-1">
                Index
              </label>
              <select
                v-model="selectedRepoTypes"
                class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 w-full"
              >
                <option value="test">Test Index</option>
                <option value="production">Production Index</option>
                <option value="default">Test &amp; Production</option>
                <option value="all">All (incl. SDists)</option>
              </select>
            </div>
            <div>
              <button
                type="submit"
                :disabled="!canSubmit"
                class="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg v-if="loading" class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <svg v-else class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                {{ loading ? 'Searching...' : 'Search' }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!hasSearched && !loading" class="text-center py-12 text-gray-400 dark:text-gray-500">
      <svg class="mx-auto w-12 h-12 mb-3 opacity-40" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
      <p class="text-sm">Search for a package to check availability across indexes</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-10">
      <svg class="animate-spin inline-block w-8 h-8 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">Searching {{ results ? results.total : '' }} indexes...</p>
    </div>

    <!-- Error -->
    <div v-if="error" class="p-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
      <svg class="w-4 h-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
      {{ error }}
    </div>

    <!-- Not Found Warning -->
    <div v-if="results && !loading && !error && !anyFound" class="p-3 rounded-xl border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 text-sm text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
      <svg class="w-4 h-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126Z" />
      </svg>
      <span v-if="anyPackageFound">
        No files found for <strong>{{ results.package_name }}</strong><template v-if="results.requested_version"> version {{ results.requested_version }}</template>
      </span>
      <span v-else-if="anyIndexExists">
        Package <strong>"{{ results.package_name }}"</strong> not found in any index
      </span>
      <span v-else>
        No accessible indexes found for <strong>"{{ results.package_name }}"</strong>
      </span>
    </div>

    <!-- Results -->
    <template v-if="results && !loading && !error && anyFound">

      <!-- Summary bar -->
      <div v-if="resultSummary" class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
          <span class="font-medium text-gray-900 dark:text-gray-100">
            {{ results.package_name }}<template v-if="results.requested_version"> @ {{ results.requested_version }}</template>
          </span>
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full bg-green-500"></span>
            {{ resultSummary.found }} found
          </span>
          <span v-if="resultSummary.notFound > 0" class="flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full bg-amber-400"></span>
            {{ resultSummary.notFound }} not found
          </span>
          <span v-if="resultSummary.noIndex > 0" class="flex items-center gap-1.5">
            <span class="inline-block w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600"></span>
            {{ resultSummary.noIndex }} no index
          </span>
          <span class="text-gray-400 dark:text-gray-500">{{ resultSummary.total }} indexes checked</span>
        </div>
        <a
          v-if="packageUiHref"
          :href="packageUiHref"
          target="_blank"
          rel="noopener noreferrer"
          class="shrink-0 text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >View on packages.redhat.com &#8599;</a>
      </div>

      <!-- Availability Insights -->
      <div v-if="hasAvailabilityInsights" class="space-y-2">
        <div v-if="repoAvailability.testOnly.length > 0" class="p-3 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-sm flex gap-2">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 shrink-0">Not yet in production</span>
          <span class="text-gray-600 dark:text-gray-300">
            Available in test index only for: {{ repoAvailability.testOnly.map(i => i.variant + ' (' + i.productVersion + ')').join(', ') }}
          </span>
        </div>
        <div v-if="repoAvailability.prodOnly.length > 0" class="p-3 rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-sm flex gap-2">
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 shrink-0">Production only</span>
          <span class="text-gray-600 dark:text-gray-300">
            In production but not in test index for: {{ repoAvailability.prodOnly.map(i => i.variant + ' (' + i.productVersion + ')').join(', ') }}
          </span>
        </div>
      </div>

      <!-- Version × Product Version Matrix -->
      <div v-if="versionMatrix && versionMatrix.pkgVersions.length > 0" class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
        <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40">
          <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
            Version availability across product versions
          </p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th class="px-4 py-3 font-medium sticky left-0 bg-white dark:bg-gray-800">Package Version</th>
                <th
                  v-for="pv in versionMatrix.prodVersions"
                  :key="pv"
                  class="px-4 py-3 font-medium text-center whitespace-nowrap"
                >{{ pv }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr
                v-for="pkgVer in versionMatrix.pkgVersions"
                :key="pkgVer"
                class="hover:bg-gray-50/80 dark:hover:bg-gray-900/30"
              >
                <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-800">{{ pkgVer }}</td>
                <td
                  v-for="pv in versionMatrix.prodVersions"
                  :key="pv"
                  class="px-4 py-3 text-center"
                >
                  <template v-if="versionMatrix.getCell(pkgVer, pv)">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      :title="[...versionMatrix.getCell(pkgVer, pv).variants].join(', ')"
                    >{{ versionMatrix.getCell(pkgVer, pv).count }} file{{ versionMatrix.getCell(pkgVer, pv).count !== 1 ? 's' : '' }}</span>
                  </template>
                  <span v-else class="text-gray-300 dark:text-gray-600">&mdash;</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Version Breakdown (expandable with filters) -->
      <div v-if="showVersionBreakdown" class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
        <!-- Header with filter pills -->
        <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
              {{ filteredVersionBreakdown.length }} version{{ filteredVersionBreakdown.length !== 1 ? 's' : '' }} built
            </p>
            <div class="flex flex-wrap items-center gap-2">
              <!-- Variant filter pills -->
              <button
                v-for="variant in allVersionVariants"
                :key="'fv-' + variant"
                type="button"
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors"
                :class="versionVariantFilter === variant
                  ? 'bg-primary-600 text-white ring-1 ring-primary-600'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'"
                @click="toggleVariantFilter(variant)"
              >{{ variant }}</button>
              <!-- Repo type filter pills -->
              <button
                v-for="rt in allVersionRepoTypes"
                :key="'fr-' + rt"
                type="button"
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors"
                :class="versionRepoFilter === rt
                  ? 'bg-primary-600 text-white ring-1 ring-primary-600'
                  : (rt === 'production' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50' : rt === 'test' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600')"
                @click="toggleRepoFilter(rt)"
              >{{ REPO_TYPE_LABELS[rt] || rt }}</button>
              <!-- Clear filters -->
              <button
                v-if="versionVariantFilter || versionRepoFilter"
                type="button"
                class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-1"
                @click="clearVersionFilters()"
              >&times; Clear</button>
            </div>
          </div>
        </div>
        <!-- Version rows -->
        <div class="divide-y divide-gray-100 dark:divide-gray-700">
          <div v-for="v in filteredVersionBreakdown" :key="v.version">
            <div
              class="px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-900/30 transition-colors"
              @click="toggleVersion(v.version)"
            >
              <svg
                class="w-3.5 h-3.5 text-gray-400 transition-transform shrink-0"
                :class="{ 'rotate-90': expandedVersions.has(v.version) }"
                xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
              <span class="font-medium text-gray-900 dark:text-gray-100 min-w-[80px]">{{ v.version }}</span>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              >{{ v.files }} file{{ v.files !== 1 ? 's' : '' }}</span>
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="variant in v.variants"
                  :key="variant"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                >{{ variant }}</span>
              </div>
              <div class="flex flex-wrap gap-1 ml-auto">
                <span
                  v-for="rt in v.repoTypes"
                  :key="rt"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="{
                    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300': rt === 'production',
                    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300': rt === 'test',
                    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400': rt !== 'production' && rt !== 'test'
                  }"
                >{{ REPO_TYPE_LABELS[rt] || rt }}</span>
              </div>
            </div>
            <!-- Expanded: files grouped by variant -->
            <div v-if="expandedVersions.has(v.version)" class="px-4 pb-4 pt-1 ml-8 border-l-2 border-gray-100 dark:border-gray-700">
              <div v-for="group in v.groups" :key="group.label" class="mb-3 last:mb-0">
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ group.variant }}</span>
                  <span
                    class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium"
                    :class="{
                      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300': group.repoType === 'production',
                      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300': group.repoType === 'test',
                      'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400': group.repoType !== 'production' && group.repoType !== 'test'
                    }"
                  >{{ REPO_TYPE_LABELS[group.repoType] || group.repoType }}</span>
                  <a
                    :href="group.indexUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-xs text-primary-600 dark:text-primary-400 hover:underline truncate ml-auto"
                    @click.stop
                  >{{ group.indexUrl }} &#8599;</a>
                </div>
                <ul class="pl-3">
                  <li v-for="f in group.files" :key="f.filename" class="text-sm py-0.5">
                    <a
                      :href="f.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:underline"
                      @click.stop
                    >{{ f.filename }}</a>
                    <span v-if="f.platform" class="text-gray-400 dark:text-gray-500 text-xs ml-1">{{ f.platform.replace(/^linux_/, '') }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Results Card -->
      <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm">
        <!-- Architecture filter -->
        <div v-if="availableArchs.length > 1" class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 flex items-center gap-3">
          <label class="text-xs uppercase tracking-wide font-medium text-gray-500 dark:text-gray-400">Architecture</label>
          <select
            v-model="archFilter"
            class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="">All</option>
            <option v-for="a in availableArchs" :key="a" :value="a">{{ a }}</option>
          </select>
        </div>

        <div class="overflow-x-auto">
          <!-- Results Table per Product Version -->
          <div v-for="pv in productVersions" :key="pv">
            <div class="px-4 py-2 bg-gray-50/80 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700">
              <p class="text-xs uppercase tracking-wide font-medium text-gray-500 dark:text-gray-400">{{ pv }}</p>
            </div>
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th class="px-4 py-3 font-medium">Variant</th>
                  <th
                    v-for="rt in getRepoTypesForVersion(getVersionResults(pv))"
                    :key="rt"
                    class="px-4 py-3 font-medium text-center"
                  >{{ REPO_TYPE_LABELS[rt] || rt }}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                <tr
                  v-for="variant in getVariantsForVersion(getVersionResults(pv))"
                  :key="variant"
                  class="hover:bg-gray-50/80 dark:hover:bg-gray-900/30"
                >
                  <td class="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{{ variant }}</td>
                  <td
                    v-for="rt in getRepoTypesForVersion(getVersionResults(pv))"
                    :key="rt"
                    class="px-4 py-3 text-center"
                  >
                    <template v-if="badgeFor(getResult(getVersionResults(pv), variant, rt))">
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        :class="{
                          'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300': badgeFor(getResult(getVersionResults(pv), variant, rt)).style === 'success',
                          'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300': badgeFor(getResult(getVersionResults(pv), variant, rt)).style === 'warn',
                          'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400': badgeFor(getResult(getVersionResults(pv), variant, rt)).style === 'muted'
                        }"
                      >{{ badgeFor(getResult(getVersionResults(pv), variant, rt)).label }}</span>
                    </template>
                    <span v-else class="text-gray-300 dark:text-gray-600">&mdash;</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </template>
  </div>
</template>
