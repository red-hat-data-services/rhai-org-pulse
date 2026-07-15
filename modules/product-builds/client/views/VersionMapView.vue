<script setup>
import { ref, computed, onMounted } from 'vue'
import { useVersionMap } from '../composables/useVersionMap.js'

const {
  data, loading, error, load, refresh, refreshing,
  releases, accelerators, source, allPackageNames, totalVariants,
  jiraLinks, loadJiraLinks,
} = useVersionMap()

const JIRA_BASE = 'https://redhat.atlassian.net/browse'

const packageFilter = ref('')
const selectedAccelerators = ref([])
const selectedReleases = ref([])
const hoveredCell = ref(null)

function prevRelease(release) {
  const idx = releases.value.indexOf(release)
  return idx > 0 ? releases.value[idx - 1] : null
}

function getVersion(pkg, release) {
  return pkg.versions[release] || null
}

function versionChanged(pkg, release) {
  const prev = prevRelease(release)
  if (!prev) return false
  const cur = getVersion(pkg, release)
  const old = getVersion(pkg, prev)
  if (!cur || !old) return !!cur
  if (cur.dropped) return false
  return cur.version !== old.version
}

function isPlanning(acc, release) {
  const planIdx = acc.planning_from_index
  if (planIdx == null) return false
  return releases.value.indexOf(release) >= planIdx
}

function displayVersion(pkg, release, acc) {
  const entry = getVersion(pkg, release)
  if (!entry) return isPlanning(acc, release) ? 'TBD' : ''
  if (entry.dropped) return '—'
  return entry.version || (isPlanning(acc, release) ? 'TBD' : '')
}

function cellTooltip(pkg, release, acc) {
  const entry = getVersion(pkg, release)
  let tip
  if (!entry) {
    if (isPlanning(acc, release)) tip = `${pkg.name}: version not yet decided for ${release}`
    else return ''
  } else if (entry.dropped) {
    tip = `${pkg.name}: dropped in ${release}`
  } else {
    const ver = entry.version || 'TBD'
    const prev = prevRelease(release)
    if (!prev) tip = `${pkg.name} ${ver}`
    else {
      const old = getVersion(pkg, prev)
      if (!old || old.dropped) tip = `${pkg.name} ${ver} (new in ${release})`
      else if (old.version === ver) tip = `${pkg.name} ${ver} (unchanged)`
      else tip = `${pkg.name}: ${old.version} → ${ver}`
    }
  }
  return tip
}

function cellTooltipWithLink(pkg, release, acc, link) {
  let tip = cellTooltip(pkg, release, acc)
  if (link) tip += ` — ${link.key}`
  return tip
}

function isTbd(pkg, release, acc) {
  const entry = getVersion(pkg, release)
  if (!entry) return isPlanning(acc, release)
  return !entry.dropped && !entry.version && isPlanning(acc, release)
}

function cellKey(svName, pkgName, release) {
  return `${svName}\0${pkgName}\0${release}`
}

const visibleReleases = computed(() => {
  if (selectedReleases.value.length > 0) return selectedReleases.value
  if (!releases.value.length) return []
  const idx = releases.value.findIndex(r => r.includes('3.4'))
  return releases.value.slice(idx >= 0 ? idx : 0)
})

const packageQuery = computed(() => packageFilter.value.toLowerCase().trim())

const acceleratorNames = computed(() => {
  if (!accelerators.value) return []
  return accelerators.value.map(a => a.sheet)
})

const filteredAccelerators = computed(() => {
  if (!accelerators.value) return []
  if (selectedAccelerators.value.length === 0) return accelerators.value
  return accelerators.value.filter(acc => selectedAccelerators.value.includes(acc.sheet))
})

function toggleAccelerator(name) {
  const idx = selectedAccelerators.value.indexOf(name)
  if (idx >= 0) {
    selectedAccelerators.value = selectedAccelerators.value.filter(x => x !== name)
  } else {
    selectedAccelerators.value = [...selectedAccelerators.value, name]
  }
}

function clearAcceleratorFilter() {
  selectedAccelerators.value = []
}

function matchesPackageFilter(name) {
  const q = packageQuery.value
  return !q || name.toLowerCase().includes(q)
}

const INFRA_NAMES = new Set(['python', 'gcc', 'rhel', 'ubi'])

function isInfra(name) {
  return INFRA_NAMES.has(name.toLowerCase())
}

const _rowsCache = new WeakMap()
function allRows(sv) {
  let rows = _rowsCache.get(sv)
  if (!rows) { rows = [...sv.packages, ...sv.infra]; _rowsCache.set(sv, rows) }
  return rows
}

function filteredRows(sv) {
  const rows = allRows(sv)
  return packageQuery.value ? rows.filter(p => matchesPackageFilter(p.name)) : rows
}

function hasVisibleRows(sv) {
  return filteredRows(sv).length > 0
}

function toggleRelease(r) {
  const idx = selectedReleases.value.indexOf(r)
  if (idx >= 0) {
    selectedReleases.value = selectedReleases.value.filter(x => x !== r)
  } else {
    selectedReleases.value = [...selectedReleases.value, r].sort(
      (a, b) => releases.value.indexOf(a) - releases.value.indexOf(b)
    )
  }
}

function clearReleaseFilter() {
  selectedReleases.value = []
}

const totalPackages = computed(() => allPackageNames.value.length)

const SHEET_TO_JIRA_BASE = {
  'CUDA': 'cuda', 'ROCm': 'rocm', 'Google TPU': 'tpu', 'CPU': 'cpu',
  'Intel Gaudi': 'gaudi', 'AWS Neuron': 'neuron', 'Spyre': 'spyre',
}

function extractVariantSlug(sheetName, svName) {
  const base = SHEET_TO_JIRA_BASE[sheetName] || sheetName.toLowerCase()
  const stripped = svName.replace(new RegExp('^' + sheetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'), '')
  const versionMatch = stripped.match(/^(\d[\d.]*)/)
  return versionMatch ? `${base}${versionMatch[1]}` : base
}

function normalizeRelease(r) {
  return r.replace(/^RHAI\s+/i, '').replace(/\.+\s/g, ' ').replace(/[-\s]*(EA|GA)[-\s]*/gi, ' $1').replace(/\s+/g, ' ').trim()
}

function getCellJiraLink(pkg, release, acc, sv) {
  if (!jiraLinks.value) return null
  const entry = getVersion(pkg, release)
  if (!entry) return null
  return findJiraLink(acc.sheet, sv.name, pkg.name, release)
}

function findJiraLink(sheetName, svName, pkgName, release) {
  if (!jiraLinks.value) return null
  const variant = extractVariantSlug(sheetName, svName)
  const pkg = pkgName.toLowerCase()
  const normR = normalizeRelease(release)
  const candidateReleases = normR.includes('EA') ? [normR] : [`${normR} GA`, normR]
  for (const rel of candidateReleases) {
    const epicLink = jiraLinks.value.links[`${variant}:${rel}:${pkg}`]
    if (epicLink) return { key: epicLink.key, type: 'epic' }
  }
  for (const fk of Object.keys(jiraLinks.value.features)) {
    if (!fk.startsWith(variant)) continue
    const fRelease = fk.split(':')[1]
    if (candidateReleases.includes(fRelease)) {
      const epicLink = jiraLinks.value.links[`${fk}:${pkg}`]
      if (epicLink) return { key: epicLink.key, type: 'epic' }
    }
  }
  for (const rel of candidateReleases) {
    const featureLink = jiraLinks.value.features[`${variant}:${rel}`]
    if (featureLink) return { key: featureLink.key, type: 'feature' }
  }
  for (const fk of Object.keys(jiraLinks.value.features)) {
    if (!fk.startsWith(variant)) continue
    const fRelease = fk.split(':')[1]
    if (candidateReleases.includes(fRelease)) return { key: jiraLinks.value.features[fk].key, type: 'feature' }
  }
  return null
}
onMounted(() => {
  load()
  loadJiraLinks()
})
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="text-center py-24">
      <svg class="animate-spin h-10 w-10 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <div class="mt-4 text-gray-500 dark:text-gray-400">Loading version map...</div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
      {{ error }}
    </div>

    <template v-else-if="data">
      <!-- Header -->
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-3">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Package version targets across releases and accelerator variants
          </p>
          <span
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            :class="source === 'live'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'"
          >{{ source === 'live' ? 'Live' : 'Snapshot' }}</span>
        </div>
        <div class="flex items-center gap-4">
          <span class="text-xs text-gray-400 dark:text-gray-500">{{ totalVariants }} variants</span>
          <span class="text-xs text-gray-400 dark:text-gray-500">{{ totalPackages }} packages</span>
          <button
            :disabled="refreshing"
            @click="refresh"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg
              class="w-3.5 h-3.5"
              :class="{ 'animate-spin': refreshing }"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {{ refreshing ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- Filter bar -->
      <div class="space-y-3 mb-5 pb-4 border-b border-gray-200 dark:border-gray-700">
        <!-- Row 1: Accelerator pills + package text filter -->
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">Accelerator:</span>
            <button
              v-for="name in acceleratorNames"
              :key="name"
              @click="toggleAccelerator(name)"
              class="px-2.5 py-0.5 text-xs rounded-full border transition-colors"
              :class="selectedAccelerators.length === 0 || selectedAccelerators.includes(name)
                ? 'bg-gray-700 text-white border-gray-700 dark:bg-gray-200 dark:text-gray-900 dark:border-gray-200'
                : 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700'"
            >{{ name }}</button>
            <button
              v-if="selectedAccelerators.length > 0"
              @click="clearAcceleratorFilter"
              class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-1"
            >Reset</button>
          </div>

          <div class="ml-auto relative">
            <input
              v-model="packageFilter"
              type="text"
              placeholder="Filter packages..."
              class="w-48 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
            <button
              v-if="packageFilter"
              @click="packageFilter = ''"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >&times;</button>
          </div>
        </div>

        <!-- Row 2: Release pills + legend -->
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">Release:</span>
            <button
              v-for="r in releases"
              :key="r"
              @click="toggleRelease(r)"
              class="px-2.5 py-0.5 text-xs rounded-full border transition-colors"
              :class="selectedReleases.length === 0 || selectedReleases.includes(r)
                ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700'
                : 'bg-gray-50 text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700'"
            >{{ r.replace('RHAI ', '') }}</button>
            <button
              v-if="selectedReleases.length > 0"
              @click="clearReleaseFilter"
              class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-1"
            >Reset</button>
          </div>

          <!-- Legend -->
          <div class="flex items-center gap-4 ml-auto text-xs text-gray-500 dark:text-gray-400">
            <span class="flex items-center gap-1.5">
              <svg class="w-2.5 h-2.5" viewBox="0 0 10 10" aria-hidden="true"><polygon points="5,1 9,9 1,9" fill="#0ca30c" /></svg>
              Bumped
            </span>
            <span class="flex items-center gap-1.5">
              <svg class="w-2.5 h-2.5" viewBox="0 0 10 10" aria-hidden="true"><polygon points="5,0 10,5 5,10 0,5" fill="#d97706" /></svg>
              Tentative
            </span>
            <span class="flex items-center gap-1">
              <span class="text-gray-400">—</span>
              Dropped
            </span>
          </div>
        </div>
      </div>

      <!-- Accelerator sections -->
      <div v-for="acc in filteredAccelerators" :key="acc.sheet" class="mb-4">
        <details open class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden shadow-sm group/acc">
          <!-- Accelerator header -->
          <summary class="px-5 py-3.5 bg-gray-200 dark:bg-gray-700 cursor-pointer flex items-center gap-3 hover:bg-gray-300/70 dark:hover:bg-gray-600/70 transition-colors list-none [&::-webkit-details-marker]:hidden">
            <svg class="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform group-open/acc:rotate-90 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <h2 class="text-base font-bold text-gray-900 dark:text-white tracking-tight">{{ acc.sheet }}</h2>
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ acc.sub_variants.length }} variant{{ acc.sub_variants.length !== 1 ? 's' : '' }}</span>
          </summary>

          <!-- Sub-variants -->
          <div class="p-4 space-y-3 border-t border-gray-200 dark:border-gray-700">
            <template v-for="sv in acc.sub_variants" :key="sv.name">
              <details v-if="hasVisibleRows(sv)" open class="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden group/sv">
                <!-- Sub-variant header -->
                <summary class="px-4 py-2.5 cursor-pointer flex items-center gap-3 bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors list-none [&::-webkit-details-marker]:hidden">
                  <svg class="w-3.5 h-3.5 text-gray-400 transition-transform group-open/sv:rotate-90 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  <span class="text-sm font-bold text-gray-800 dark:text-white">{{ sv.name }}</span>
                  <span class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ sv.architectures }}</span>
                  <span class="text-xs font-medium text-gray-400 dark:text-gray-500 ml-auto">{{ filteredRows(sv).length }} items</span>
                </summary>

                <!-- Version matrix table -->
                <div class="overflow-x-auto border-t border-gray-200 dark:border-gray-700">
                  <table class="w-full text-sm" style="border-collapse: collapse; font-variant-numeric: tabular-nums">
                    <thead>
                      <tr class="border-b-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/40">
                        <th class="text-left py-2.5 px-3 text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider sticky left-0 z-[2] bg-gray-100 dark:bg-gray-700/40 min-w-[130px]">Package</th>
                        <th
                          v-for="r in visibleReleases"
                          :key="r"
                          class="text-left py-2.5 px-3 text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider min-w-[96px] whitespace-nowrap"
                        >{{ r.replace('RHAI ', '') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <!-- SDK row -->
                      <tr class="bg-gray-50 dark:bg-gray-800/50">
                        <td class="py-1.5 px-3 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide sticky left-0 z-[1] bg-gray-50 dark:bg-gray-800/50">SDK</td>
                        <td
                          v-for="r in visibleReleases"
                          :key="r"
                          class="py-1.5 px-3 text-left text-[11px] text-gray-400 dark:text-gray-500"
                        >{{ sv.sdk_versions[r] || '' }}</td>
                      </tr>
                      <!-- Package + infra rows -->
                      <tr
                        v-for="pkg in filteredRows(sv)"
                        :key="pkg.name"
                        class="border-b border-gray-100 dark:border-gray-700/40 hover:bg-blue-50/40 dark:hover:bg-blue-900/5 transition-colors"
                      >
                        <td class="py-1.5 px-3 font-medium text-gray-900 dark:text-gray-200 sticky left-0 z-[1] bg-white dark:bg-gray-800">
                          {{ pkg.name }}
                          <span
                            v-if="isInfra(pkg.name)"
                            class="inline-block ml-1 px-1 text-[9px] font-medium uppercase tracking-wide rounded bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                          >infra</span>
                        </td>
                        <td
                          v-for="r in visibleReleases"
                          :key="r"
                          class="py-1.5 px-3 text-left text-[13px] whitespace-nowrap"
                          :class="{
                            'bg-blue-50/30 dark:bg-blue-900/10': hoveredCell === cellKey(sv.name, pkg.name, r),
                            'text-gray-400 dark:text-gray-500 italic': getVersion(pkg, r)?.dropped,
                            'text-blue-400 dark:text-blue-500 italic text-xs': isTbd(pkg, r, acc),
                            'text-gray-600 dark:text-gray-300': !isTbd(pkg, r, acc) && !getVersion(pkg, r)?.dropped,
                          }"
                          @pointerenter="hoveredCell = cellKey(sv.name, pkg.name, r)"
                          @pointerleave="hoveredCell = null"
                        >
                          <template v-for="(jlink, _ji) in [getCellJiraLink(pkg, r, acc, sv)]" :key="_ji">
                            <a
                              v-if="jlink"
                              :href="`${JIRA_BASE}/${jlink.key}`"
                              :title="cellTooltipWithLink(pkg, r, acc, jlink)"
                              target="_blank"
                              rel="noopener noreferrer"
                              class="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                              @click.stop
                            >
                              <svg v-if="versionChanged(pkg, r) && displayVersion(pkg, r, acc) !== 'TBD'" class="w-2 h-2 shrink-0" viewBox="0 0 10 10" aria-label="bumped"><polygon points="5,1 9,9 1,9" fill="#0ca30c" /></svg>
                              <span>{{ displayVersion(pkg, r, acc) }}</span>
                              <svg v-if="getVersion(pkg, r)?.tentative" class="w-2 h-2 shrink-0" viewBox="0 0 10 10" aria-label="tentative"><polygon points="5,0 10,5 5,10 0,5" fill="#d97706" /></svg>
                            </a>
                            <span v-else class="inline-flex items-center gap-1" :title="cellTooltip(pkg, r, acc)">
                              <svg v-if="versionChanged(pkg, r) && displayVersion(pkg, r, acc) !== 'TBD'" class="w-2 h-2 shrink-0" viewBox="0 0 10 10" aria-label="bumped"><polygon points="5,1 9,9 1,9" fill="#0ca30c" /></svg>
                              <span>{{ displayVersion(pkg, r, acc) }}</span>
                              <svg v-if="getVersion(pkg, r)?.tentative" class="w-2 h-2 shrink-0" viewBox="0 0 10 10" aria-label="tentative"><polygon points="5,0 10,5 5,10 0,5" fill="#d97706" /></svg>
                            </span>
                          </template>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </details>
            </template>
          </div>
        </details>
      </div>
    </template>
  </div>
</template>
