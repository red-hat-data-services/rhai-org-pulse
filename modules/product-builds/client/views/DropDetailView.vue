<script setup>
import { onMounted, inject, ref, computed, reactive, watch } from 'vue'
import { useDropDetail } from '../composables/useDrops'
import { useArtifacts } from '../composables/useArtifacts'
import { apiRequest } from '@shared/client/services/api'
import { formatDate, envBadgeClass, archBadgeClass, konfluxStateBadgeClass, testStatusBadgeClass, testStatusLabel, formatDuration } from '../utils/formatting'
import DropTimeline from '../components/DropTimeline.vue'

const BASE = '/modules/product-builds'
const nav = inject('moduleNav')
const { drop, changelog, metrics, loading, error, loadDrop, loadChangelog, loadMetrics } = useDropDetail()
const { artifacts, loading: artifactsLoading, error: artifactsError, loadArtifacts } = useArtifacts()

const currentDropKey = computed(() => nav.params.value.key)
const wheelsData = reactive(new Map())
const wheelsRaw = reactive(new Map())
const packagesPopup = ref(null)
const packagesShowAll = reactive(new Set())

const productKey = computed(() => nav.params.value.product || '')

function extractAccelerator(variant) {
  if (!variant) return null
  const first = variant.toLowerCase().split('-')[0]
  const match = first.match(/^[a-z]+/)
  return match ? match[0] : null
}

function isGenericDrop(name) {
  if (!name) return false
  const n = name.toLowerCase()
  if (/^v\d+(\.\d+)*-\d{6,}$/.test(n)) return true
  if (/^v\d+(?:\.\d+)+(?:\.\d{6,})$/.test(n)) return true
  if (/^v\d{6,}$/.test(n)) return true
  if (/^preview-\d{6,}$/.test(n)) return true
  if (/^[A-Z]+-\d+$/i.test(name)) return true
  return false
}

const NO_WARNING_PRODUCTS = new Set(['rhel-ai'])

const dropCommit = computed(() => {
  const first = artifacts.value.find(a => a.commit)
  return first || null
})

const acceleratorWarning = computed(() => {
  if (!drop.value || NO_WARNING_PRODUCTS.has(productKey.value)) return null
  if (isGenericDrop(drop.value.name)) return null
  const accels = new Set(artifacts.value.map(a => extractAccelerator(a.variant)).filter(Boolean))
  if (accels.size <= 1) return null
  return [...accels].join(', ')
})

const NO_WHEELS_PRODUCTS = new Set(['rhel-ai', 'builder-images'])

async function fetchWheelsForArtifacts() {
  if (NO_WHEELS_PRODUCTS.has(productKey.value)) return
  await Promise.all(
    artifacts.value
      .filter(a => a.type === 'containers')
      .map(async (a) => {
        try {
          const data = await apiRequest(`${BASE}/artifacts/${encodeURIComponent(a.key)}/wheels`)
          const wheels = Array.isArray(data) ? data : []
          if (wheels.length > 0) {
            const parsed = wheels.map(w => {
              try {
                const p = JSON.parse(w.constraints_file || '{}')
                return { key: w.key, main: p.main || [], all: p.all || [] }
              } catch { return { key: w.key, main: [], all: [] } }
            })
            const count = parsed.reduce((sum, w) => sum + w.all.length, 0)
            wheelsData.set(a.key, count)
            wheelsRaw.set(a.key, parsed)
          }
        } catch { /* skip */ }
      })
  )
}

watch(artifacts, (val) => {
  if (val.length > 0) fetchWheelsForArtifacts()
})

async function loadAll(key) {
  if (!key) return
  wheelsData.clear()
  wheelsRaw.clear()
  expandedRows.clear()
  await loadDrop(key)
  loadArtifacts({ drop_key: key })
  loadChangelog(key)
  loadMetrics(key)
}

watch(currentDropKey, (key) => loadAll(key))
onMounted(() => loadAll(currentDropKey.value))

function navigateToArtifact(artifactKey) {
  nav.navigateTo('artifact-detail', { key: artifactKey, product: productKey.value })
}

function navigateToDrop(key) {
  nav.navigateTo('drop-detail', { key, product: productKey.value })
}

function formatRelativeDate(dateString) {
  if (!dateString) return ''
  const diffMs = Date.now() - new Date(dateString)
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 30) return `${diffDays} days ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths === 1) return '1 month ago'
  if (diffMonths < 12) return `${diffMonths} months ago`
  const diffYears = Math.floor(diffDays / 365)
  return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`
}

function getQuayDirectTagUrl(key) {
  if (!key || !key.startsWith('quay.io/')) return null
  const withoutRegistry = key.replace('quay.io/', '')
  const [path, tag] = withoutRegistry.split(':')
  if (!tag) return null
  return `https://quay.io/repository/${path}/tag/${tag}`
}

function getQuayAllTagsUrl(key) {
  if (!key || !key.startsWith('quay.io/')) return null
  const withoutRegistry = key.replace('quay.io/', '')
  const [path, tag] = withoutRegistry.split(':')
  const url = `https://quay.io/repository/${path}?tab=tags`
  return tag ? `${url}&tag=${tag}` : url
}

function getRegistryUrl(key) {
  if (!key) return null
  if (key.startsWith('quay.io/')) {
    const path = key.replace('quay.io/', '').split(':')[0]
    return `https://quay.io/repository/${path}?tab=tags`
  }
  if (key.startsWith('registry.redhat.io/')) {
    const path = key.replace('registry.redhat.io/', '').split(':')[0]
    return `https://catalog.redhat.com/en/search?searchType=All&q=${encodeURIComponent(path)}&p=1`
  }
  return null
}

function getCommitUrl(artifact) {
  if (!artifact?.commit) return null
  const labels = artifact.labels || {}
  const repoUrl = labels['git.url'] || labels['org.opencontainers.image.source'] || labels['vcs-url']
  if (!repoUrl) return null
  const clean = repoUrl.replace(/\.git$/, '')
  return `${clean}/commit/${artifact.commit}`
}

function downloadPackagesAsJson(artifactKey) {
  const parsed = wheelsRaw.get(artifactKey)
  if (!parsed) return
  const grouped = new Map()
  for (const w of parsed) {
    const sorted = [...w.all].sort()
    const k = JSON.stringify(sorted)
    if (grouped.has(k)) {
      grouped.get(k).wheel_keys.push(w.key)
    } else {
      grouped.set(k, { wheel_keys: [w.key], total_packages: sorted.length, packages: sorted })
    }
  }
  const json = JSON.stringify({ artifact_key: artifactKey, collections: [...grouped.values()], exported_at: new Date().toISOString() }, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${artifactKey.replace(/[/:.]/g, '_')}_packages.json`
  a.click()
  URL.revokeObjectURL(url)
}

function showPackages(artifactKey, event) {
  event.stopPropagation()
  const raw = wheelsRaw.get(artifactKey)
  if (!raw) return
  packagesShowAll.clear()
  packagesPopup.value = { artifactKey, wheels: raw }
}

function toggleShowAll(wheelKey) {
  if (packagesShowAll.has(wheelKey)) {
    packagesShowAll.delete(wheelKey)
  } else {
    packagesShowAll.add(wheelKey)
  }
}

const copiedKey = ref(null)
const expandedRows = reactive(new Set())
const copiedJson = ref(null)

function copyKey(key, event) {
  event.stopPropagation()
  navigator.clipboard.writeText(key)
  copiedKey.value = key
  setTimeout(() => { copiedKey.value = null }, 1500)
}

function toggleRow(key, event) {
  event.stopPropagation()
  if (expandedRows.has(key)) {
    expandedRows.delete(key)
  } else {
    expandedRows.add(key)
  }
}

function copyArtifactJson(art, event) {
  event.stopPropagation()
  navigator.clipboard.writeText(JSON.stringify(art, null, 2))
  copiedJson.value = art.key
  setTimeout(() => { copiedJson.value = null }, 1500)
}

function getAcceleratorInfo(artifact) {
  const labels = artifact?.labels || {}
  let accel = artifact?.variant ? artifact.variant.split('-')[0] : 'unknown'
  let runtime = null
  if (accel !== 'unknown') {
    runtime = labels[`com.redhat.aiplatform.${accel}_version`] || null
  }
  return {
    accel: accel || 'unknown',
    runtime: runtime || 'unknown',
    python: labels['com.redhat.aiplatform.python'] || 'unknown',
    baseImage: labels['com.redhat.aiplatform.image'] || null
  }
}

function getDigestUrl(artifact) {
  if (!artifact?.sha_digest || !artifact?.key) return null
  if (!artifact.key.startsWith('quay.io/')) return null
  const path = artifact.key.replace('quay.io/', '').split(':')[0]
  return `https://quay.io/repository/${path}/manifest/${artifact.sha_digest}`
}

const totalColumns = 7
</script>

<template>
  <div class="space-y-6">
    <!-- Back button -->
    <button
      @click="nav.goBack()"
      class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
    >&larr; Back</button>

    <!-- Loading / Error -->
    <div v-if="loading && !drop" class="text-sm text-gray-500 dark:text-gray-400">Loading drop…</div>
    <div v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</div>

    <template v-if="drop">
      <!-- Header -->
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Drop: {{ drop.name }}</h1>
        <div class="flex items-center gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
          <span>Version: <span class="text-gray-900 dark:text-gray-100">{{ drop.product_version }}</span></span>
          <span v-if="drop.git_branch">&middot; Branch: <span class="text-gray-900 dark:text-gray-100">{{ drop.git_branch }}</span></span>
          <span v-if="dropCommit">&middot; Commit:
            <a
              v-if="getCommitUrl(dropCommit)"
              :href="getCommitUrl(dropCommit)"
              target="_blank"
              rel="noopener noreferrer"
              class="font-mono text-primary-600 dark:text-blue-400 hover:underline"
            >{{ dropCommit.commit.slice(0, 8) }}</a>
            <span v-else class="font-mono text-gray-900 dark:text-gray-100">{{ dropCommit.commit.slice(0, 8) }}</span>
          </span>
        </div>
        <div v-if="drop.environments?.length" class="flex gap-1 mt-2">
          <span
            v-for="env in drop.environments"
            :key="env"
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            :class="envBadgeClass(env)"
          >{{ env }}</span>
        </div>
      </div>

      <!-- Release timing -->
      <div v-if="drop.release_timings?.length" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Release Timeline</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div v-for="timing in drop.release_timings" :key="timing.phase">
            <p class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ timing.phase }}</p>
            <p class="text-sm text-gray-900 dark:text-gray-100 mt-0.5">{{ formatDate(timing.timestamp) }}</p>
          </div>
        </div>
      </div>

      <!-- Artifacts -->
      <div>
        <div v-if="artifactsLoading" class="text-sm text-gray-500 dark:text-gray-400">Loading artifacts…</div>
        <div v-else-if="artifactsError" class="text-sm text-red-600 dark:text-red-400">{{ artifactsError }}</div>
        <div v-else-if="artifacts.length === 0" class="text-sm text-gray-500 dark:text-gray-400">No artifacts for this drop.</div>
        <div v-else class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[30%]">Artifact Key</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[7%]">Links</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">Architectures</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">Environments</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">Packages</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[15%]">Created</th>
                <th class="w-[5%]"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <template v-for="art in artifacts" :key="art.key">
                <tr
                  @click="toggleRow(art.key, $event)"
                  class="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                >
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-1.5">
                      <span
                        class="text-sm font-medium text-primary-600 dark:text-blue-400 truncate hover:underline"
                        @click.stop="navigateToArtifact(art.key)"
                      >{{ art.key }}</span>
                      <button
                        @click="copyKey(art.key, $event)"
                        class="shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        title="Copy artifact key"
                      >
                        <svg v-if="copiedKey === art.key" class="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                        <svg v-else class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>
                    </div>
                  </td>
                  <td class="px-4 py-3" @click.stop>
                    <div class="flex items-center gap-1.5">
                      <a
                        v-if="getQuayDirectTagUrl(art.key)"
                        :href="getQuayDirectTagUrl(art.key)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary-600 dark:text-blue-400 hover:text-primary-700 dark:hover:text-blue-300"
                        title="Direct link to this tag"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                      <a
                        v-if="getQuayAllTagsUrl(art.key)"
                        :href="getQuayAllTagsUrl(art.key)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                        title="View all tags (old Quay.io UI)"
                      >all tags</a>
                      <a
                        v-if="!getQuayDirectTagUrl(art.key) && getRegistryUrl(art.key)"
                        :href="getRegistryUrl(art.key)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-primary-600 dark:text-blue-400 hover:text-primary-700 dark:hover:text-blue-300"
                        title="View in registry"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                      <span v-if="!getQuayDirectTagUrl(art.key) && !getQuayAllTagsUrl(art.key) && !getRegistryUrl(art.key)" class="text-gray-400 dark:text-gray-500">—</span>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1 flex-wrap">
                      <span
                        v-for="arch in (art.archs || [])"
                        :key="arch"
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        :class="archBadgeClass(arch)"
                      >{{ arch }}</span>
                      <span v-if="!(art.archs || []).length" class="text-sm text-gray-400 dark:text-gray-500">—</span>
                    </div>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1 flex-wrap">
                      <span
                        v-for="env in (art.environments || [])"
                        :key="env"
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        :class="envBadgeClass(env)"
                      >{{ env }}</span>
                      <span v-if="!(art.environments || []).length" class="text-sm text-gray-400 dark:text-gray-500">—</span>
                    </div>
                  </td>
                  <td class="px-4 py-3 text-sm" @click.stop>
                    <div v-if="wheelsData.has(art.key)" class="inline-flex items-center gap-1">
                      <button
                        @click="showPackages(art.key, $event)"
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 cursor-pointer transition-colors"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                        {{ wheelsData.get(art.key) }} packages
                      </button>
                      <button
                        @click="downloadPackagesAsJson(art.key)"
                        class="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        title="Download packages as JSON"
                      >
                        <svg class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </button>
                    </div>
                    <span v-else class="text-gray-400 dark:text-gray-500">—</span>
                  </td>
                  <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ formatDate(art.created_at) }}</td>
                  <td class="px-4 py-3 text-center" @click.stop>
                    <button
                      @click="toggleRow(art.key, $event)"
                      class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      :aria-label="expandedRows.has(art.key) ? 'Collapse row' : 'Expand row'"
                    >
                      <svg
                        class="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform"
                        :class="{ 'rotate-90': expandedRows.has(art.key) }"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </td>
                </tr>

                <!-- Expanded detail row -->
                <tr v-if="expandedRows.has(art.key)" class="bg-gray-50/50 dark:bg-gray-900/30">
                  <td :colspan="totalColumns" class="px-6 py-4">
                    <div class="relative">
                      <!-- Copy JSON button -->
                      <button
                        @click="copyArtifactJson(art, $event)"
                        class="absolute top-0 right-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        title="Copy raw JSON"
                      >
                        <svg v-if="copiedJson === art.key" class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                        <svg v-else class="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      </button>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <!-- Left column: Platform / Runtime -->
                        <div class="space-y-2">
                          <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Platform / Runtime Information</h4>
                          <div class="text-gray-700 dark:text-gray-300"><span class="font-medium text-gray-900 dark:text-gray-100">Variant:</span> {{ art.variant || 'unknown' }}</div>
                          <div class="text-gray-700 dark:text-gray-300"><span class="font-medium text-gray-900 dark:text-gray-100">Accelerator:</span> {{ getAcceleratorInfo(art).accel }}</div>
                          <div class="text-gray-700 dark:text-gray-300"><span class="font-medium text-gray-900 dark:text-gray-100">{{ getAcceleratorInfo(art).accel.toUpperCase() }} Runtime:</span> {{ getAcceleratorInfo(art).runtime }}</div>
                          <div class="text-gray-700 dark:text-gray-300"><span class="font-medium text-gray-900 dark:text-gray-100">Python:</span> {{ getAcceleratorInfo(art).python }}</div>
                          <div v-if="getAcceleratorInfo(art).baseImage" class="text-gray-700 dark:text-gray-300">
                            <span class="font-medium text-gray-900 dark:text-gray-100">Base Image:</span>
                            <span class="text-primary-600 dark:text-blue-400 hover:underline cursor-pointer ml-1" @click.stop="navigateToArtifact(getAcceleratorInfo(art).baseImage)">{{ getAcceleratorInfo(art).baseImage }}</span>
                            <button @click="copyKey(getAcceleratorInfo(art).baseImage, $event)" class="ml-1 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 inline-flex align-middle">
                              <svg v-if="copiedKey === getAcceleratorInfo(art).baseImage" class="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                              <svg v-else class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            </button>
                          </div>
                          <div v-if="art.alternative_names?.length" class="mt-3">
                            <span class="font-medium text-gray-900 dark:text-gray-100">Alternative Names:</span>
                            <div v-for="name in art.alternative_names" :key="name" class="ml-3 text-gray-600 dark:text-gray-400 mt-0.5">
                              - <span class="font-mono text-xs">{{ name }}</span>
                              <button @click="copyKey(name, $event)" class="ml-1 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 inline-flex align-middle">
                                <svg v-if="copiedKey === name" class="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                                <svg v-else class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                              </button>
                            </div>
                          </div>
                          <div v-if="art.drop_keys?.length" class="mt-3">
                            <span class="font-medium text-gray-900 dark:text-gray-100">Linked Drops:</span>
                            <div v-for="dk in art.drop_keys" :key="dk" class="ml-3 text-gray-600 dark:text-gray-400 mt-0.5">
                              - <span class="text-primary-600 dark:text-blue-400 hover:underline cursor-pointer font-mono text-xs" @click.stop="navigateToDrop(dk)">{{ dk }}</span>
                            </div>
                          </div>
                        </div>

                        <!-- Right column: Build / Technical -->
                        <div class="space-y-2">
                          <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Build / Technical Information</h4>
                          <div class="text-gray-700 dark:text-gray-300"><span class="font-medium text-gray-900 dark:text-gray-100">Created:</span> {{ formatDate(art.created_at) }}</div>
                          <div v-if="art.source_branch" class="text-gray-700 dark:text-gray-300"><span class="font-medium text-gray-900 dark:text-gray-100">Source branch:</span> {{ art.source_branch }}</div>
                          <div class="text-gray-700 dark:text-gray-300">
                            <span class="font-medium text-gray-900 dark:text-gray-100">Commit:</span>
                            <template v-if="art.commit">
                              <a v-if="getCommitUrl(art)" :href="getCommitUrl(art)" target="_blank" rel="noopener noreferrer" class="font-mono text-primary-600 dark:text-blue-400 hover:underline ml-1" @click.stop>{{ art.commit }}</a>
                              <span v-else class="font-mono ml-1">{{ art.commit }}</span>
                              <button @click="copyKey(art.commit, $event)" class="ml-1 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 inline-flex align-middle">
                                <svg v-if="copiedKey === art.commit" class="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                                <svg v-else class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                              </button>
                            </template>
                            <span v-else class="ml-1">unknown</span>
                          </div>
                          <div class="text-gray-700 dark:text-gray-300">
                            <span class="font-medium text-gray-900 dark:text-gray-100">Digest:</span>
                            <template v-if="art.sha_digest">
                              <a v-if="getDigestUrl(art)" :href="getDigestUrl(art)" target="_blank" rel="noopener noreferrer" class="font-mono text-primary-600 dark:text-blue-400 hover:underline ml-1 break-all" @click.stop>{{ art.sha_digest }}</a>
                              <span v-else class="font-mono ml-1 break-all">{{ art.sha_digest }}</span>
                              <button @click="copyKey(art.sha_digest, $event)" class="ml-1 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 inline-flex align-middle">
                                <svg v-if="copiedKey === art.sha_digest" class="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                                <svg v-else class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                              </button>
                            </template>
                            <span v-else class="ml-1">no digest available</span>
                          </div>

                          <!-- SBOM Links -->
                          <template v-if="(art.type === 'containers' || art.type === 'base-images') && art.sbom_links">
                            <div v-if="art.sbom_links.length > 0 && !(art.sbom_links.length === 1 && !art.sbom_links[0].name && !art.sbom_links[0].atlas_url)" class="mt-3">
                              <span class="font-medium text-gray-900 dark:text-gray-100">Atlas SBOMs:</span>
                              <div v-for="(sbom, i) in art.sbom_links" :key="i" class="ml-3 mt-0.5">
                                - <a :href="sbom.atlas_url" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-blue-400 hover:underline" @click.stop>{{ sbom.name || sbom.atlas_url }}</a>
                              </div>
                            </div>
                            <div v-else-if="art.sbom_links.length === 1 && !art.sbom_links[0].name && !art.sbom_links[0].atlas_url" class="mt-3">
                              <span class="font-medium text-gray-900 dark:text-gray-100">Atlas SBOMs:</span>
                              <span class="text-red-600 dark:text-red-400 text-xs ml-1">Incompatible (Legacy SBOM - cannot be resolved)</span>
                            </div>
                            <div v-else-if="art.sbom_links.length === 0" class="mt-3">
                              <span class="font-medium text-gray-900 dark:text-gray-100">Atlas SBOMs:</span>
                              <span class="text-gray-400 dark:text-gray-500 text-xs ml-1">No SBOM links available</span>
                            </div>
                          </template>

                          <!-- Konflux Data -->
                          <template v-if="art.konflux_data">
                            <div v-if="art.konflux_data.component_name" class="mt-3 text-gray-700 dark:text-gray-300">
                              <span class="font-medium text-gray-900 dark:text-gray-100">Konflux Component:</span> {{ art.konflux_data.component_name }}
                            </div>
                            <div v-if="art.konflux_data.pipelinerun_name" class="text-gray-700 dark:text-gray-300">
                              <span class="font-medium text-gray-900 dark:text-gray-100">Konflux Pipeline Run:</span>
                              <a v-if="art.konflux_data.pipelinerun_url" :href="art.konflux_data.pipelinerun_url" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-blue-400 hover:underline ml-1" @click.stop>{{ art.konflux_data.pipelinerun_name }}</a>
                              <span v-else class="ml-1">{{ art.konflux_data.pipelinerun_name }}</span>
                            </div>
                            <div v-if="art.konflux_data.snapshot_name" class="text-gray-700 dark:text-gray-300">
                              <span class="font-medium text-gray-900 dark:text-gray-100">Konflux Snapshot:</span>
                              <a v-if="art.konflux_data.snapshot_url" :href="art.konflux_data.snapshot_url" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-blue-400 hover:underline ml-1" @click.stop>{{ art.konflux_data.snapshot_name }}</a>
                              <span v-else class="ml-1">{{ art.konflux_data.snapshot_name }}</span>
                            </div>
                            <div v-if="art.konflux_data.releases?.length" class="mt-2">
                              <span class="font-medium text-gray-900 dark:text-gray-100">Konflux Releases:</span>
                              <div v-for="(rel, ri) in art.konflux_data.releases" :key="ri" class="ml-3 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>-</span>
                                <a v-if="rel.url" :href="rel.url" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-blue-400 hover:underline" @click.stop>{{ rel.name }}</a>
                                <span v-else>{{ rel.name }}</span>
                                <span v-if="rel.release_plan" class="text-gray-400 dark:text-gray-500 text-xs">({{ rel.release_plan }})</span>
                                <span v-if="rel.state" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium" :class="konfluxStateBadgeClass(rel.state)">{{ rel.state }}</span>
                              </div>
                            </div>
                            <div v-if="art.konflux_data.tests?.length" class="mt-2">
                              <span class="font-medium text-gray-900 dark:text-gray-100">Integration Tests:</span>
                              <div v-for="(test, ti) in art.konflux_data.tests" :key="ti" class="ml-3 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>-</span>
                                <a v-if="test.pipelinerun_url" :href="test.pipelinerun_url" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-blue-400 hover:underline" @click.stop>{{ test.scenario }}</a>
                                <span v-else>{{ test.scenario }}</span>
                                <span v-if="test.status" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium" :class="testStatusBadgeClass(test.status)">{{ testStatusLabel(test.status) }}</span>
                                <span v-if="test.completion_time && test.start_time" class="text-gray-400 dark:text-gray-500 text-xs">({{ formatDuration(test.start_time, test.completion_time) }})</span>
                              </div>
                            </div>
                          </template>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
          <div v-if="acceleratorWarning" class="px-4 py-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <svg class="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg>
            <span>This drop includes artifacts built for <span class="font-medium">{{ acceleratorWarning }}</span> accelerators. This can happen when multiple accelerator builds share the same commit.</span>
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <div>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Build & Release Timeline</h3>
        <div v-if="!metrics" class="text-sm text-gray-500 dark:text-gray-400">No timeline data available.</div>
        <DropTimeline v-else :metrics="metrics" />
      </div>

      <!-- Changelog -->
      <div>
        <div class="flex items-center gap-2 mb-3">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Changelog</h3>
          <span v-if="changelog?.changelogs?.length" class="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium px-2 py-0.5 rounded-full">
            {{ changelog.changelogs.reduce((s, cl) => s + cl.total_commits, 0) }} commits
          </span>
          <span v-if="changelog?.git_branch" class="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-xs font-medium px-2 py-0.5 rounded-full">
            branch: {{ changelog.git_branch }}
          </span>
        </div>
        <div v-if="!changelog?.changelogs?.length" class="text-sm text-gray-500 dark:text-gray-400">
          No changelog available — this may be the first drop or data is still being computed.
        </div>
        <div v-else class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          <p class="px-4 py-2 text-xs text-gray-400 dark:text-gray-500">Commits between consecutive drops on the same branch.</p>
          <div v-for="cl in changelog.changelogs" :key="cl.repository_key" class="px-4 py-3">
            <!-- Repo header -->
            <div class="flex items-center gap-2 mb-2">
              <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ cl.repository_key.split('/').pop() }}</span>
              <span class="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium px-1.5 py-0.5 rounded-full">
                {{ cl.total_commits }} {{ cl.total_commits === 1 ? 'commit' : 'commits' }}
              </span>
              <span v-if="cl.from_drop" class="text-xs text-gray-400 dark:text-gray-500">
                Changes since
                <button @click="navigateToDrop(cl.from_drop)" class="text-primary-600 dark:text-blue-400 hover:underline">{{ cl.from_drop }}</button>
              </span>
            </div>
            <!-- Commit rows -->
            <div class="space-y-0 divide-y divide-gray-100 dark:divide-gray-700/50">
              <div
                v-for="commit in [...cl.commits].sort((a, b) => new Date(b.committed_date) - new Date(a.committed_date))"
                :key="commit.sha"
                class="flex items-baseline gap-3 py-1.5 text-sm"
              >
                <a
                  v-if="cl.repository_url"
                  :href="`${cl.repository_url.replace(/\/$/, '')}/-/commit/${commit.sha}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-mono text-xs text-primary-600 dark:text-blue-400 hover:underline shrink-0"
                >{{ commit.short_id }}</a>
                <span v-else class="font-mono text-xs text-gray-400 dark:text-gray-500 shrink-0">{{ commit.short_id }}</span>
                <span class="flex-1 text-gray-700 dark:text-gray-300 truncate">{{ commit.title }}</span>
                <span class="text-xs text-gray-400 dark:text-gray-500 shrink-0">{{ commit.author_name }}</span>
                <span class="text-xs text-gray-400 dark:text-gray-500 shrink-0">{{ formatRelativeDate(commit.committed_date) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Packages popup -->
    <teleport to="body">
      <div v-if="packagesPopup" class="fixed inset-0 z-50 flex items-center justify-center" @click="packagesPopup = null">
        <div class="absolute inset-0 bg-black/40"></div>
        <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[80vh] flex flex-col" @click.stop>
          <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Package Dependencies</h3>
            <button @click="packagesPopup = null" class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="overflow-y-auto px-5 py-4 space-y-5">
            <div v-for="w in packagesPopup.wheels" :key="w.key">
              <div class="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2">{{ w.key }}</div>
              <div v-if="w.all.length === 0" class="text-xs text-gray-400 dark:text-gray-500">No packages</div>
              <template v-else>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="pkg in (packagesShowAll.has(w.key) ? w.all : w.main)"
                    :key="pkg"
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  >{{ pkg }}</span>
                </div>
                <div v-if="w.all.length > w.main.length" class="flex items-center gap-1.5 mt-2">
                  <button
                    @click="toggleShowAll(w.key)"
                    class="text-xs text-primary-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                  >
                    {{ packagesShowAll.has(w.key) ? 'Show less' : `Show all (${w.all.length} packages)` }}
                    <svg class="w-3 h-3 transition-transform" :class="{ 'rotate-180': packagesShowAll.has(w.key) }" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <svg class="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 cursor-help" fill="currentColor" viewBox="0 0 20 20" title="Packages shown by default are the key dependencies required for the wheel collection to function properly."><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>
