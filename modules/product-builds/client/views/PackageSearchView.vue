<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { usePackageSearch } from '../composables/usePackageSearch'

const {
  options,
  results,
  loading,
  error,
  loadOptions,
  search,
  productVersions,
  anyFound,
  anyPackageFound,
  anyIndexExists,
  packageUiHref,
  upstreamPypiAvailable
} = usePackageSearch()

const packageName = ref('')
const packageVersion = ref('')
const selectedProductVersion = ref('')
const selectedVariant = ref('')
const selectedRepoTypes = ref('default')
const expandUpstream = ref(false)

function compareVersionsDesc(a, b) {
  const normalize = v => v.replace(/([a-zA-Z]+)/g, '.$1.').split('.').filter(Boolean)
  const pa = normalize(a)
  const pb = normalize(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = Number(pa[i]), nb = Number(pb[i])
    const aNum = !isNaN(na), bNum = !isNaN(nb)
    if (aNum && bNum) { if (nb !== na) return nb - na }
    else if (aNum !== bNum) { return aNum ? -1 : 1 }
    else { const cmp = (pa[i] || '').localeCompare(pb[i] || ''); if (cmp !== 0) return cmp }
  }
  return 0
}

const REPO_TYPE_LABELS = {
  production: 'Production Repo',
  test: 'Test Repo',
  sdists: 'SDists',
  'sdists-test': 'SDists Test',
  upstream: 'PyPI'
}
const REPO_TYPE_ORDER = ['test', 'production', 'sdists-test', 'sdists', 'upstream']

function formatUploadDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function relativeTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function newestUploadDate(files) {
  if (!files?.length) return null
  let newest = null
  for (const f of files) {
    if (f.uploadTime && (!newest || f.uploadTime > newest)) newest = f.uploadTime
  }
  return newest
}

function productVersionLabel(pv) {
  if (pv === 'upstream-pypi') return 'Upstream PyPI (pypi.org)'
  return pv
}

const showVersionDropdown = ref(false)
const versionInputEdited = ref(false)

const filteredProductVersions = computed(() => {
  const versions = options.value?.product_versions
  if (!versions) return []
  if (!versionInputEdited.value) return versions
  const q = selectedProductVersion.value.trim().toLowerCase()
  if (!q) return versions
  return versions.filter(v => v.toLowerCase().includes(q))
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
const linkCopied = ref(false)

function copySearchLink() {
  navigator.clipboard.writeText(window.location.href)
    .then(() => {
      linkCopied.value = true
      setTimeout(() => { linkCopied.value = false }, 2000)
    })
    .catch(() => {})
}

function pushSearchToUrl() {
  const hash = window.location.hash || ''
  const basePath = hash.split('?')[0] || '#/product-builds/package-analysis'
  const params = new URLSearchParams()
  params.set('tab', 'search')
  params.set('pkg', packageName.value.trim())
  if (packageVersion.value.trim()) params.set('ver', packageVersion.value.trim())
  if (selectedProductVersion.value.trim()) params.set('pv', selectedProductVersion.value.trim())
  if (selectedVariant.value) params.set('variant', selectedVariant.value)
  if (selectedRepoTypes.value !== 'default') params.set('repos', selectedRepoTypes.value)
  if (expandUpstream.value) params.set('upstream', '1')
  const newHash = basePath + '?' + params.toString()
  if (window.location.hash !== newHash) {
    history.replaceState(null, '', window.location.pathname + window.location.search + newHash)
  }
}

function readSearchFromUrl() {
  const hash = window.location.hash || ''
  const qIdx = hash.indexOf('?')
  if (qIdx === -1) return null
  const params = new URLSearchParams(hash.slice(qIdx + 1))
  if (params.get('tab') !== 'search') return null
  const pkg = params.get('pkg')
  if (!pkg) return null
  return {
    packageName: pkg,
    packageVersion: params.get('ver') || '',
    productVersion: params.get('pv') || '',
    variant: params.get('variant') || '',
    repoTypes: params.get('repos') || 'default',
    expandUpstream: params.get('upstream') === '1'
  }
}

onMounted(async () => {
  await loadOptions()
  const urlParams = readSearchFromUrl()
  if (urlParams) {
    packageName.value = urlParams.packageName
    packageVersion.value = urlParams.packageVersion
    selectedProductVersion.value = urlParams.productVersion
    selectedVariant.value = urlParams.variant
    selectedRepoTypes.value = urlParams.repoTypes
    expandUpstream.value = urlParams.expandUpstream || false
    await nextTick()
    handleSubmit()
  }
})

const expandedPvs = ref(new Set())

function togglePv(pv) {
  const next = new Set(expandedPvs.value)
  if (next.has(pv)) next.delete(pv)
  else next.add(pv)
  expandedPvs.value = next
}

function pvHasFiles(group) {
  return group.variants.some(v => Object.values(v.repos).some(r => r?.found && r?.files?.length))
}

async function handleSubmit() {
  if (!canSubmit.value) return
  expandedVersions.value = new Set()
  expandedCells.value = new Set()
  expandedPvs.value = new Set()
  versionVariantFilter.value = ''
  versionRepoFilter.value = ''
  pushSearchToUrl()
  await search({
    packageName: packageName.value,
    packageVersion: packageVersion.value,
    productVersion: selectedProductVersion.value,
    variant: selectedVariant.value,
    repoTypes: selectedRepoTypes.value,
    expandUpstream: expandUpstream.value
  })
}

const hasUpstreamData = computed(() => {
  return results.value?.results?.some(r => r.source === 'upstream') ?? false
})

watch(expandUpstream, (on) => {
  if (!results.value || !canSubmit.value) return
  if (on && !hasUpstreamData.value) {
    handleSubmit()
  } else {
    pushSearchToUrl()
  }
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

function jumpToVersion(version) {
  if (!expandedVersions.value.has(version)) {
    const next = new Set(expandedVersions.value)
    next.add(version)
    expandedVersions.value = next
  }
  nextTick(() => {
    const el = document.getElementById('pkg-ver-' + version)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function toggleVersion(version) {
  const next = new Set(expandedVersions.value)
  if (next.has(version)) next.delete(version)
  else next.add(version)
  expandedVersions.value = next
}

const processedResults = computed(() => {
  if (!results.value) return []
  const raw = results.value.results
  const internalVersions = new Set()
  for (const r of raw) {
    if (r.source === 'upstream' || !r.found || !r.files) continue
    for (const f of r.files) {
      if (f.version && f.version !== 'unknown') internalVersions.add(f.version)
    }
  }
  if (internalVersions.size === 0) return raw
  const maxInternal = [...internalVersions].sort(compareVersionsDesc)[0]
  return raw.map(r => {
    if (r.source !== 'upstream' || !r.found || !r.files) return r
    const newer = r.files.filter(f => f.version && f.version !== 'unknown' && compareVersionsDesc(f.version, maxInternal) < 0)
    return { ...r, files: newer }
  })
})

const versionBreakdown = computed(() => {
  if (!results.value) return []
  const byVersion = {}
  for (const r of processedResults.value) {
    if (!r.found || !r.files) continue
    for (const f of r.files) {
      if (f.version === 'unknown') continue
      const entry = byVersion[f.version] ??= {
        version: f.version,
        files: 0,
        variants: new Set(),
        repoTypes: new Set(),
        productVersions: new Set(),
        byVariant: {}
      }
      entry.files++
      entry.variants.add(r.variant)
      entry.repoTypes.add(r.repo_type)
      entry.productVersions.add(r.product_version)
      const variantGroup = entry.byVariant[r.variant] ??= { variant: r.variant, repoTypes: {} }
      const repoGroup = variantGroup.repoTypes[r.repo_type] ??= { repoType: r.repo_type, indexUrl: r.index_url, files: [] }
      repoGroup.files.push(f)
    }
  }
  return Object.values(byVersion)
    .map(v => ({
      version: v.version,
      files: v.files,
      variants: [...v.variants].sort(),
      repoTypes: [...v.repoTypes].sort((a, b) => REPO_TYPE_ORDER.indexOf(a) - REPO_TYPE_ORDER.indexOf(b)),
      productVersions: [...v.productVersions],
      groups: Object.values(v.byVariant)
        .map(g => ({
          variant: g.variant,
          columns: REPO_TYPE_ORDER
            .filter(rt => g.repoTypes[rt])
            .map(rt => g.repoTypes[rt])
        }))
        .sort((a, b) => a.variant.localeCompare(b.variant))
    }))
    .sort((a, b) => compareVersionsDesc(a.version, b.version))
})

const filteredVersionBreakdown = computed(() => {
  if (!versionVariantFilter.value && !versionRepoFilter.value) return versionBreakdown.value
  return versionBreakdown.value
    .map(v => {
      let groups = v.groups
      if (versionVariantFilter.value) {
        groups = groups.filter(g => g.variant === versionVariantFilter.value)
      }
      if (versionRepoFilter.value) {
        groups = groups.map(g => ({
          ...g,
          columns: g.columns.filter(c => c.repoType === versionRepoFilter.value)
        })).filter(g => g.columns.length > 0)
      }
      if (groups.length === 0) return null
      const files = groups.reduce((sum, g) => sum + g.columns.reduce((s, c) => s + c.files.length, 0), 0)
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

const expandedCells = ref(new Set())

function cellKey(pv, variant, rt) {
  return `${pv}\0${variant}\0${rt}`
}

function toggleCell(key) {
  const next = new Set(expandedCells.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedCells.value = next
}

const indexAvailability = computed(() => {
  if (!results.value) return []
  const byPv = {}
  const rtByPv = {}
  for (const r of processedResults.value) {
    const variantMap = (byPv[r.product_version] ??= {})
    ;(variantMap[r.variant] ??= {})[r.repo_type] = r
    ;(rtByPv[r.product_version] ??= new Set()).add(r.repo_type)
  }

  return productVersions.value.map(pv => {
    const variantMap = byPv[pv] || {}
    const variants = Object.keys(variantMap).sort()
    const repoTypes = [...(rtByPv[pv] || [])]
      .sort((a, b) => REPO_TYPE_ORDER.indexOf(a) - REPO_TYPE_ORDER.indexOf(b))
    return {
      productVersion: pv,
      repoTypes,
      variants: variants.map(v => ({
        variant: v,
        repos: variantMap[v]
      }))
    }
  })
})

const upstreamGroup = computed(() => {
  return indexAvailability.value.find(g => g.productVersion === 'upstream-pypi') || null
})

const upstreamFiles = computed(() => {
  if (!upstreamGroup.value) return []
  const files = []
  for (const row of upstreamGroup.value.variants) {
    for (const rt of upstreamGroup.value.repoTypes) {
      const r = row.repos[rt]
      if (!r?.found || !r?.files) continue
      for (const f of r.files) files.push(f)
    }
  }
  files.sort((a, b) => compareVersionsDesc(a.version || 'unknown', b.version || 'unknown'))
  return files
})

const internalGroups = computed(() => {
  return indexAvailability.value.filter(g => g.productVersion !== 'upstream-pypi')
})

function cellStatus(result) {
  if (!result) return { label: 'N/A', type: 'gray' }
  if (result.error === 'timeout') return { label: 'Timeout', type: 'amber' }
  if (result.error) return { label: 'Error', type: 'amber' }
  if (!result.index_exists) return { label: 'No index', type: 'gray' }
  if (!result.found) return { label: 'Not found', type: 'amber' }
  const count = result.files ? result.files.length : 0
  if (count === 0 && result.source === 'upstream') return { label: 'No newer versions', type: 'gray' }
  if (count === 0) return { label: 'Not found', type: 'amber' }
  const suffix = result.source === 'upstream' ? ' newer' : ' found'
  return { label: `Available (${count} file${count !== 1 ? 's' : ''}${suffix})`, type: 'green' }
}

const versionMatrix = computed(() => {
  if (!results.value || !isMultiProductSearch.value) return null
  const pkgVersions = new Set()
  const prodVersions = [...productVersions.value]
  const cells = {}

  for (const r of processedResults.value) {
    if (!r.found || !r.files) continue
    for (const f of r.files) {
      if (f.version === 'unknown') continue
      pkgVersions.add(f.version)
      const key = f.version + '\0' + r.product_version
      if (!cells[key]) cells[key] = { count: 0, variants: new Set() }
      cells[key].count++
      cells[key].variants.add(r.variant)
    }
  }

  const sortedPkgVersions = [...pkgVersions].sort(compareVersionsDesc)

  function getCell(pkgVer, prodVer) {
    return cells[pkgVer + '\0' + prodVer] || null
  }

  return { pkgVersions: sortedPkgVersions, prodVersions, getCell }
})

const htmlFallbackIndexes = computed(() => {
  if (!results.value) return []
  return processedResults.value
    .filter(r => r.found && r.format === 'html')
    .map(r => `${r.product_version}/${r.variant}/${r.repo_type}`)
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
                <option v-for="v in (options?.variants ?? [])" :key="v" :value="v">{{ v }}</option>
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
            <div v-if="upstreamPypiAvailable" class="flex items-center gap-2 self-end pb-1">
              <button
                type="button"
                role="switch"
                :aria-checked="expandUpstream"
                class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                :class="expandUpstream ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'"
                @click="expandUpstream = !expandUpstream"
              >
                <span
                  class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200"
                  :class="expandUpstream ? 'translate-x-4' : 'translate-x-0'"
                />
              </button>
              <span class="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap cursor-pointer select-none" @click="expandUpstream = !expandUpstream">
                Show upstream versions
              </span>
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
      <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">Searching indexes...</p>
    </div>

    <!-- Error -->
    <div v-if="error" class="p-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
      <svg class="w-4 h-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
      </svg>
      {{ error }}
    </div>

    <!-- Results -->
    <template v-if="results && !loading && !error">

      <!-- Not Found Warning -->
      <div v-if="!anyFound" class="p-3 rounded-xl border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 text-sm text-yellow-800 dark:text-yellow-300 flex items-center gap-2">
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

      <!-- Results header -->
      <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm border-t-4 border-t-primary-500">
        <div class="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
              {{ results.package_name }}<template v-if="results.requested_version"> <span class="text-base text-gray-500 dark:text-gray-400 font-normal">@ {{ results.requested_version }}</span></template>
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ results.results.length }} indexes checked</p>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors"
              :class="linkCopied
                ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500'"
              @click="copySearchLink"
              title="Copy a shareable URL for this search"
            >
              <svg v-if="!linkCopied" class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9.334a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
              </svg>
              <svg v-else class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {{ linkCopied ? 'Link copied!' : 'Copy results URL' }}
            </button>
            <a
              v-if="packageUiHref"
              :href="packageUiHref"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >View on packages.redhat.com &#8599;</a>
          </div>
        </div>
      </div>

      <!-- HTML fallback notice -->
      <div v-if="htmlFallbackIndexes.length > 0" class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 px-4 py-3 flex items-start gap-2.5">
        <svg class="w-4 h-4 text-amber-500 mt-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
        <div class="text-xs text-amber-700 dark:text-amber-300">
          <span class="font-medium">Upload dates unavailable</span> for {{ htmlFallbackIndexes.length }} index{{ htmlFallbackIndexes.length !== 1 ? 'es' : '' }} — {{ htmlFallbackIndexes.length <= 3 ? htmlFallbackIndexes.join(', ') : htmlFallbackIndexes.slice(0, 3).join(', ') + ' and ' + (htmlFallbackIndexes.length - 3) + ' more' }}. These indexes returned HTML format which does not include date metadata.
        </div>
      </div>

      <!-- Version × Product Version Matrix -->
      <details v-if="versionMatrix && versionMatrix.pkgVersions.length > 0" class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden group/matrix">
        <summary class="px-4 py-3 bg-gray-100 dark:bg-gray-700 cursor-pointer flex items-center gap-2 hover:bg-gray-200/80 dark:hover:bg-gray-600 transition-colors">
          <svg class="w-3.5 h-3.5 text-gray-400 transition-transform group-open/matrix:rotate-90 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
            Version availability across product versions
          </span>
        </summary>
        <div class="overflow-x-auto border-t border-gray-100 dark:border-gray-700">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th class="px-4 py-3 font-medium sticky left-0 bg-white dark:bg-gray-800">Package Version</th>
                <th
                  v-for="pv in versionMatrix.prodVersions"
                  :key="pv"
                  class="px-4 py-3 font-medium text-center whitespace-nowrap"
                  :class="pv === 'upstream-pypi' ? 'text-purple-700 dark:text-purple-300' : ''"
                >{{ productVersionLabel(pv) }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr
                v-for="pkgVer in versionMatrix.pkgVersions"
                :key="pkgVer"
                class="hover:bg-gray-50/80 dark:hover:bg-gray-900/30"
              >
                <td class="px-4 py-3 font-medium sticky left-0 bg-white dark:bg-gray-800">
                  <button
                    type="button"
                    class="text-primary-600 dark:text-primary-400 hover:underline"
                    @click="jumpToVersion(pkgVer)"
                  >{{ pkgVer }}</button>
                </td>
                <td
                  v-for="pv in versionMatrix.prodVersions"
                  :key="pv"
                  class="px-4 py-3 text-center"
                >
                  <template v-for="(cell, ci) in [versionMatrix.getCell(pkgVer, pv)]" :key="ci">
                    <span
                      v-if="cell"
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      :title="[...cell.variants].join(', ')"
                    >{{ cell.count }} file{{ cell.count !== 1 ? 's' : '' }}</span>
                    <span v-else class="text-gray-300 dark:text-gray-600">&mdash;</span>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <!-- Upstream PyPI Section -->
      <details
        v-if="expandUpstream && upstreamFiles.length > 0"
        class="rounded-xl border border-purple-300 dark:border-purple-700 bg-purple-50/30 dark:bg-purple-900/10 shadow-sm overflow-hidden group/pv"
        open
      >
        <summary class="px-4 py-3 border-b border-purple-200 dark:border-purple-800 bg-purple-50/80 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 cursor-pointer flex items-center gap-2 transition-colors">
          <svg class="w-3.5 h-3.5 text-purple-400 transition-transform group-open/pv:rotate-90 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <span class="text-sm font-medium text-purple-700 dark:text-purple-300">Upstream PyPI (pypi.org)</span>
          <span class="text-xs text-purple-500 dark:text-purple-400">&mdash; {{ upstreamFiles.length }} file{{ upstreamFiles.length !== 1 ? 's' : '' }} newer</span>
        </summary>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-purple-600 dark:text-purple-400 border-b border-purple-100 dark:border-purple-800">
                <th class="px-4 py-3 font-medium">Version</th>
                <th class="px-4 py-3 font-medium w-32">Architecture</th>
                <th class="px-4 py-3 font-medium w-32">Release Date</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-purple-100 dark:divide-purple-800">
              <tr v-for="f in upstreamFiles" :key="f.filename" class="hover:bg-purple-50/80 dark:hover:bg-purple-900/30">
                <td class="px-4 py-2.5">
                  <a
                    :href="f.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400 hover:underline"
                  >{{ f.version || 'unknown' }}</a>
                  <span class="text-xs text-gray-400 dark:text-gray-500 ml-1.5">{{ f.filename }}</span>
                </td>
                <td class="px-4 py-2.5 font-mono text-sm text-gray-600 dark:text-gray-300">
                  {{ f.platform ? f.platform.replace(/^linux_/, '') : 'any' }}
                </td>
                <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-gray-300" :title="f.uploadTime ? relativeTime(f.uploadTime) : ''">
                  {{ f.uploadTime ? formatUploadDate(f.uploadTime) : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
      <div
        v-else-if="expandUpstream && upstreamGroup && upstreamFiles.length === 0"
        class="rounded-xl border border-purple-200 dark:border-purple-700 bg-purple-50/30 dark:bg-purple-900/10 px-4 py-3 text-sm text-purple-600 dark:text-purple-400"
      >
        No newer upstream versions found on PyPI
      </div>

      <!-- Product Version Pills -->
      <div v-if="internalGroups.length > 1" class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm px-4 py-3">
        <p class="text-xs uppercase tracking-wide font-medium text-gray-500 dark:text-gray-400 mb-2">Product Versions</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="group in internalGroups"
            :key="'pill-' + group.productVersion"
            type="button"
            class="px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer"
            :class="[
              pvHasFiles(group)
                ? expandedPvs.has(group.productVersion)
                  ? 'bg-green-600 text-white ring-2 ring-green-300 dark:ring-green-700'
                  : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                : expandedPvs.has(group.productVersion)
                  ? 'bg-gray-400 text-white ring-2 ring-gray-300 dark:ring-gray-600 dark:bg-gray-500'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            ]"
            @click="togglePv(group.productVersion)"
          >{{ group.productVersion }}</button>
        </div>
      </div>

      <!-- Expanded Product Version Blocks -->
      <template v-for="group in internalGroups" :key="group.productVersion">
      <details
        v-if="internalGroups.length === 1 || expandedPvs.has(group.productVersion)"
        class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden group/pv"
        open
      >
        <summary class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center justify-between transition-colors">
          <div class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 text-gray-400 transition-transform group-open/pv:rotate-90 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
              Product Version: {{ group.productVersion }}
            </span>
          </div>
          <button v-if="internalGroups.length > 1" type="button" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" @click.prevent="togglePv(group.productVersion)">
            <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
          </button>
        </summary>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th class="px-4 py-3 font-medium">Index</th>
                <th
                  v-for="rt in group.repoTypes"
                  :key="rt"
                  class="px-4 py-3 font-medium text-center"
                  :class="{
                    'text-blue-600 dark:text-blue-400': rt === 'test',
                    'text-green-600 dark:text-green-400': rt === 'production'
                  }"
                >{{ REPO_TYPE_LABELS[rt] || rt }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <template v-for="row in group.variants" :key="row.variant">
                <tr class="hover:bg-gray-50/80 dark:hover:bg-gray-900/30">
                  <td class="px-4 py-3 font-mono text-sm text-gray-900 dark:text-gray-100">{{ row.variant }}</td>
                  <td
                    v-for="rt in group.repoTypes"
                    :key="rt"
                    class="px-4 py-3 text-center"
                  >
                    <template v-for="(s, si) in [cellStatus(row.repos[rt])]" :key="si">
                      <div v-if="s.type === 'green'" class="flex flex-col items-center gap-0.5">
                        <button
                          type="button"
                          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 cursor-pointer transition-colors"
                          @click="toggleCell(cellKey(group.productVersion, row.variant, rt))"
                        >
                          <span class="inline-block w-1.5 h-1.5 rounded-full bg-green-500"></span>
                          {{ s.label }}
                          <svg class="w-3 h-3 transition-transform" :class="{ 'rotate-180': expandedCells.has(cellKey(group.productVersion, row.variant, rt)) }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                        </button>
                        <template v-for="(uploadDate, _) in [newestUploadDate(row.repos[rt]?.files)]" :key="_">
                        <span v-if="uploadDate" class="text-[10px] text-gray-400 dark:text-gray-500" :title="relativeTime(uploadDate)">
                          {{ formatUploadDate(uploadDate) }}
                        </span>
                        </template>
                      </div>
                      <span
                        v-else-if="s.type === 'amber'"
                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      >
                        <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        {{ s.label }}
                      </span>
                      <span
                        v-else
                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                      >
                        <span class="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500"></span>
                        {{ s.label }}
                      </span>
                    </template>
                  </td>
                </tr>
                <!-- Expanded file details row -->
                <template v-for="rt in group.repoTypes" :key="'exp-' + rt">
                  <tr v-if="expandedCells.has(cellKey(group.productVersion, row.variant, rt)) && row.repos[rt]?.files?.length > 0">
                    <td :colspan="group.repoTypes.length + 1" class="px-4 py-3 bg-gray-50/50 dark:bg-gray-900/20">
                      <div class="ml-4 border-l-2 border-gray-200 dark:border-gray-600 pl-4">
                        <div class="flex items-center gap-2 mb-2">
                          <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ row.variant }} &middot; {{ REPO_TYPE_LABELS[rt] || rt }}</span>
                          <a
                            :href="row.repos[rt].index_url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-xs text-primary-600 dark:text-primary-400 hover:underline"
                          >Open index &#8599;</a>
                        </div>
                        <table class="w-full text-sm">
                          <thead>
                            <tr class="text-left text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500">
                              <th class="py-1 pr-4 font-medium">File</th>
                              <th class="py-1 pr-4 font-medium w-32">Architecture</th>
                              <th class="py-1 font-medium w-32">Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="f in row.repos[rt].files" :key="f.filename">
                              <td class="py-0.5 pr-4">
                                <a
                                  :href="f.url"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  class="text-sm text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:underline"
                                >{{ f.filename }}</a>
                              </td>
                              <td class="py-0.5 pr-4 font-mono text-sm text-gray-500 dark:text-gray-400">
                                {{ f.platform ? f.platform.replace(/^linux_/, '') : 'any' }}
                              </td>
                              <td class="py-0.5 text-sm text-gray-500 dark:text-gray-400" :title="f.uploadTime ? relativeTime(f.uploadTime) : ''">
                                {{ f.uploadTime ? formatUploadDate(f.uploadTime) : '—' }}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>
      </details>
      </template>

      <!-- Version Breakdown (collapsed by default) -->
      <details v-if="showVersionBreakdown" class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm group/vb">
        <summary class="px-4 py-3 bg-gray-100 dark:bg-gray-700 cursor-pointer flex items-center gap-2 hover:bg-gray-200/80 dark:hover:bg-gray-600 transition-colors">
          <svg class="w-3.5 h-3.5 text-gray-400 transition-transform group-open/vb:rotate-90 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          <span class="text-sm font-medium text-gray-900 dark:text-gray-100">
            Version details &mdash; {{ filteredVersionBreakdown.length }} version{{ filteredVersionBreakdown.length !== 1 ? 's' : '' }} built
          </span>
        </summary>
        <div class="border-t border-gray-100 dark:border-gray-700">
          <!-- Filter pills -->
          <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40">
            <div class="flex flex-wrap items-center gap-2">
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
              <button
                v-if="versionVariantFilter || versionRepoFilter"
                type="button"
                class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-1"
                @click="clearVersionFilters()"
              >&times; Clear</button>
            </div>
          </div>
          <!-- Version rows -->
          <div class="divide-y divide-gray-100 dark:divide-gray-700">
            <div v-for="v in filteredVersionBreakdown" :key="v.version" :id="'pkg-ver-' + v.version">
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
              <div v-if="expandedVersions.has(v.version)" class="px-4 pb-4 pt-2 ml-8 border-l-2 border-gray-100 dark:border-gray-700">
                <div v-for="group in v.groups" :key="group.variant" class="mb-4 last:mb-0">
                  <div class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">{{ group.variant }}</div>
                  <div class="grid gap-4" :style="{ gridTemplateColumns: 'repeat(' + group.columns.length + ', 1fr)' }">
                    <div v-for="col in group.columns" :key="col.repoType">
                      <div class="flex items-center gap-2 mb-1.5">
                        <span
                          class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium"
                          :class="{
                            'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300': col.repoType === 'production',
                            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300': col.repoType === 'test',
                            'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400': col.repoType !== 'production' && col.repoType !== 'test'
                          }"
                        >{{ REPO_TYPE_LABELS[col.repoType] || col.repoType }}</span>
                        <a
                          :href="col.indexUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-xs text-primary-600 dark:text-primary-400 hover:underline truncate"
                          @click.stop
                        >&#8599;</a>
                      </div>
                      <ul class="pl-1">
                        <li v-for="f in col.files" :key="f.filename" class="text-sm py-0.5">
                          <a
                            :href="f.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 hover:underline"
                            @click.stop
                          >{{ f.filename }}</a>
                          <span v-if="f.platform && f.platform !== 'any'" class="text-gray-400 dark:text-gray-500 text-xs ml-1">{{ f.platform.replace(/^linux_/, '') }}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </details>

    </template>
  </div>
</template>
