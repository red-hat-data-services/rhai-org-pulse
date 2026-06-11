<script setup>
import { ref, reactive, computed, watch, onMounted, inject, defineAsyncComponent } from 'vue'
import { useArtifactDetail } from '../composables/useArtifacts'
import { formatDate, envBadgeClass, archBadgeClass, konfluxStateBadgeClass, testStatusBadgeClass, testStatusLabel, formatDuration, getAcceleratorInfo, getCommitUrl } from '../utils/formatting'

const DependencyGraph = defineAsyncComponent(() => import('../components/DependencyGraph.vue'))

const nav = inject('moduleNav')
const { artifact, wheels, containers, loading, error, loadArtifact, loadWheels, loadContainers } = useArtifactDetail()

const currentArtifactKey = computed(() => nav.params.value.key)
const productKey = computed(() => nav.params.value.product || '')
const copiedValue = ref(null)
const otherLabelsExpanded = ref(false)
const wheelsWithPackages = ref([])
const packagesShowAll = reactive(new Set())
const buildSequenceFilter = ref('new')

async function loadAll(key) {
  if (!key) return
  wheelsWithPackages.value = []
  packagesShowAll.clear()
  otherLabelsExpanded.value = false
  buildSequenceFilter.value = 'new'
  await loadArtifact(key)
  loadContainers(key)
  if (artifact.value?.type === 'containers') {
    await loadWheels(key)
    fetchWheelPackages()
  } else {
    loadWheels(key)
  }
}

watch(currentArtifactKey, (key) => loadAll(key))
onMounted(() => loadAll(currentArtifactKey.value))

async function fetchWheelPackages() {
  if (!wheels.value.length) return
  const parsed = wheels.value.map(w => {
    try {
      const p = JSON.parse(w.constraints_file || '{}')
      return { key: w.key, variant: w.variant, main: p.main || [], all: p.all || [] }
    } catch { return { key: w.key, variant: w.variant, main: [], all: [] } }
  })
  wheelsWithPackages.value = parsed
}

function toggleShowAll(wheelKey) {
  if (packagesShowAll.has(wheelKey)) {
    packagesShowAll.delete(wheelKey)
  } else {
    packagesShowAll.add(wheelKey)
  }
}

function canonicalizeName(name) {
  return name.toLowerCase().replace(/[-_.]+/g, '-')
}

const buildSequence = computed(() => {
  const json = artifact.value?.build_sequence_summary
  if (!json) return null
  try {
    const entries = JSON.parse(json)
    if (!Array.isArray(entries)) return null
    const newBuilds = []
    const prebuilt = []
    const skipped = []
    for (const e of entries) {
      if (e.skipped) skipped.push(e)
      else if (e.prebuilt) prebuilt.push(e)
      else newBuilds.push(e)
    }
    return { newBuilds, prebuilt, skipped, all: entries, total: entries.length }
  } catch { return null }
})

const installableNames = computed(() => {
  const json = artifact.value?.constraints_file
  if (!json) return new Set()
  try {
    const parsed = JSON.parse(json)
    const all = parsed.all || []
    return new Set(all.map(e => canonicalizeName(e.split('==')[0].split('>=')[0].split('<=')[0].split('!=')[0].split('~=')[0].trim())))
  } catch { return new Set() }
})

const installableCount = computed(() => {
  if (!buildSequence.value || installableNames.value.size === 0) return 0
  return buildSequence.value.all.filter(e => installableNames.value.has(canonicalizeName(e.name))).length
})

const filteredBuildEntries = computed(() => {
  if (!buildSequence.value) return []
  const f = buildSequenceFilter.value
  return buildSequence.value.all
    .filter(e => {
      if (f === 'all') return true
      if (f === 'installable') return installableNames.value.has(canonicalizeName(e.name))
      const cat = e.skipped ? 'skipped' : e.prebuilt ? 'prebuilt' : 'new'
      return cat === f
    })
    .sort((a, b) => a.name.localeCompare(b.name))
})

function entryCategory(entry) {
  if (entry.skipped) return 'skipped'
  if (entry.prebuilt) return 'prebuilt'
  return 'new'
}

const CATEGORY_META = {
  new: { label: 'New Builds', tooltip: 'Built from source for this release', iconPath: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z' },
  prebuilt: { label: 'Pre-built', tooltip: 'Reused from a previous build (not rebuilt)', iconPath: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  skipped: { label: 'Skipped', tooltip: 'Already existed, build was skipped', iconPath: 'M13 5l7 7-7 7M5 5l7 7-7 7' },
}

function downloadBuildSequenceAsJson() {
  const json = artifact.value?.build_sequence_summary
  if (!json) return
  const key = (artifact.value?.key || 'build-sequence').replace(/[^a-zA-Z0-9\-_+.]/g, '_').substring(0, 100)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${key}-build-sequence.json`
  a.click()
  URL.revokeObjectURL(url)
}

function downloadDependencyGraphAsJson() {
  const json = artifact.value?.dependency_graph
  if (!json) return
  const key = (artifact.value?.key || 'dependency-graph').replace(/[^a-zA-Z0-9\-_+.]/g, '_').substring(0, 100)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${key}-graph.json`
  a.click()
  URL.revokeObjectURL(url)
}

function navigateToArtifact(key) {
  nav.navigateTo('artifact-detail', { key, product: productKey.value })
}

function getReleaseNotesUrl(art) {
  if (!art || art.type !== 'wheels-collections' || !art.key) return null
  let repoUrl = null
  if (art.git_repository) {
    repoUrl = typeof art.git_repository === 'string' ? art.git_repository : art.git_repository?.url
  }
  if (!repoUrl) {
    const labels = art.labels || {}
    repoUrl = labels['git.url'] || labels['org.opencontainers.image.source'] || labels['url'] || null
  }
  if (!repoUrl || typeof repoUrl !== 'string') return null
  const baseUrl = repoUrl.replace(/\.git$/, '').replace(/\/$/, '')
  return `${baseUrl}/-/releases/${art.key}`
}

function copyToClipboard(value) {
  navigator.clipboard.writeText(value)
  copiedValue.value = value
  setTimeout(() => { copiedValue.value = null }, 1500)
}

function getDigestUrl(art) {
  if (!art?.sha_digest || !art?.key) return null
  if (art.key.startsWith('quay.io/')) {
    const path = art.key.replace('quay.io/', '').split(':')[0]
    return `https://quay.io/repository/${path}/manifest/${art.sha_digest}`
  }
  return null
}

function sbomState(art) {
  const links = art?.sbom_links
  if (!links || !Array.isArray(links)) return null
  if (links.length === 0) return 'empty'
  if (links.length === 1 && !links[0].name && !links[0].atlas_url) return 'incompatible'
  return 'valid'
}

function isContainerType(art) {
  return art?.type === 'containers' || art?.type === 'base-images'
}

function formatDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

function downloadPackagesAsJson() {
  const grouped = new Map()
  for (const w of wheelsWithPackages.value) {
    const sorted = [...w.all].sort()
    const k = JSON.stringify(sorted)
    if (grouped.has(k)) {
      grouped.get(k).wheel_keys.push(w.key)
    } else {
      grouped.set(k, { wheel_keys: [w.key], total_packages: sorted.length, packages: sorted })
    }
  }
  const json = JSON.stringify({
    artifact_key: artifact.value?.key,
    collections: [...grouped.values()],
    exported_at: new Date().toISOString(),
  }, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(artifact.value?.key || 'artifact').replace(/[/:.]/g, '_')}_packages.json`
  a.click()
  URL.revokeObjectURL(url)
}

const LABELS_ALREADY_DISPLAYED = [
  'com.redhat.aiplatform.python',
  'com.redhat.aiplatform.image',
  'com.redhat.aiplatform.accelerator',
  'com.redhat.aiplatform.cuda_version',
  'com.redhat.aiplatform.rocm_version',
]

const IMPORTANT_LABEL_KEYS = [
  'version', 'build-date', 'vcs-ref', 'description', 'maintainer',
  'org.opencontainers.image.version', 'org.opencontainers.image.created',
  'org.opencontainers.image.revision', 'org.opencontainers.image.source',
  'org.opencontainers.image.description', 'org.opencontainers.image.authors',
  'org.opencontainers.image.vendor', 'org.opencontainers.image.licenses',
  'com.redhat.component', 'com.redhat.license_terms',
]

const DEDUP_MAP = {
  'vcs-ref': 'org.opencontainers.image.revision',
  'description': 'org.opencontainers.image.description',
  'version': 'org.opencontainers.image.version',
  'build-date': 'org.opencontainers.image.created',
  'git.commit': 'org.opencontainers.image.revision',
  'io.k8s.description': 'org.opencontainers.image.description',
  'vendor': 'org.opencontainers.image.vendor',
  'git.url': 'org.opencontainers.image.source',
  'url': 'org.opencontainers.image.source',
}

const TIMESTAMP_LABELS = ['build-date', 'created', 'org.opencontainers.image.created']
const URL_LABELS = ['com.redhat.license_terms', 'url', 'git.url', 'org.opencontainers.image.source']

function formatLabelValue(key, value) {
  if (TIMESTAMP_LABELS.includes(key)) {
    try {
      const d = new Date(value)
      if (!isNaN(d.getTime())) return d.toLocaleString()
    } catch { /* ignore invalid dates */ }
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function isUrlLabel(key, value) {
  if (URL_LABELS.includes(key)) return true
  const s = String(value)
  return s.startsWith('http://') || s.startsWith('https://')
}

function filterLabels(labels, includeImportant) {
  return Object.entries(labels)
    .filter(([key, value]) => {
      if (value === null || value === undefined || value === '') return false
      if (LABELS_ALREADY_DISPLAYED.includes(key)) return false
      if (DEDUP_MAP[key] && labels[DEDUP_MAP[key]]) return false
      return includeImportant ? IMPORTANT_LABEL_KEYS.includes(key) : !IMPORTANT_LABEL_KEYS.includes(key)
    })
    .sort(([a], [b]) => a.localeCompare(b))
}

const importantLabels = computed(() => {
  if (!isContainerType(artifact.value) || !artifact.value?.labels) return []
  return filterLabels(artifact.value.labels, true)
})

const otherLabels = computed(() => {
  if (!isContainerType(artifact.value) || !artifact.value?.labels) return []
  return filterLabels(artifact.value.labels, false)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Back button -->
    <button
      @click="nav.goBack()"
      class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
    >&larr; Back</button>

    <!-- Loading / Error -->
    <div v-if="loading && !artifact" class="text-sm text-gray-500 dark:text-gray-400">Loading artifact…</div>
    <div v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</div>

    <template v-if="artifact">
      <!-- Header -->
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100 break-all">{{ artifact.key }}</h1>
        <div v-if="artifact.series" class="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
          <span>Series: <span class="text-gray-900 dark:text-gray-100">{{ artifact.series }}</span></span>
        </div>
      </div>

      <!-- Details grid -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Details</h3>
        <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div v-if="artifact.variant">
            <dt class="text-gray-500 dark:text-gray-400">Variant</dt>
            <dd class="text-gray-900 dark:text-gray-100 mt-0.5">{{ artifact.variant }}</dd>
          </div>
          <div v-if="artifact.environments?.length">
            <dt class="text-gray-500 dark:text-gray-400">Environments</dt>
            <dd class="mt-0.5 flex gap-1 flex-wrap">
              <span
                v-for="env in artifact.environments"
                :key="env"
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                :class="envBadgeClass(env)"
              >{{ env }}</span>
            </dd>
          </div>
          <div v-if="artifact.drop_keys?.length">
            <dt class="text-gray-500 dark:text-gray-400">Drop</dt>
            <dd class="mt-0.5 space-y-1">
              <div v-for="dk in artifact.drop_keys" :key="dk" class="flex items-center gap-1">
                <button @click="nav.navigateTo('drop-detail', { key: dk, product: productKey.value })" class="text-primary-600 dark:text-blue-400 hover:underline text-left break-all">{{ dk }}</button>
                <button @click="copyToClipboard(dk)" class="shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  <svg v-if="copiedValue === dk" class="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                  <svg v-else class="w-3 h-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </button>
              </div>
            </dd>
          </div>
          <div v-if="artifact.commit">
            <dt class="text-gray-500 dark:text-gray-400">Commit</dt>
            <dd class="mt-0.5 flex items-center gap-1">
              <a v-if="getCommitUrl(artifact)" :href="getCommitUrl(artifact)" target="_blank" rel="noopener noreferrer" class="font-mono text-xs text-primary-600 dark:text-blue-400 hover:underline">{{ artifact.commit }}</a>
              <span v-else class="text-gray-900 dark:text-gray-100 font-mono text-xs">{{ artifact.commit }}</span>
              <button @click="copyToClipboard(artifact.commit)" class="shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                <svg v-if="copiedValue === artifact.commit" class="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                <svg v-else class="w-3 h-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </button>
            </dd>
          </div>
          <div v-if="artifact.source_branch">
            <dt class="text-gray-500 dark:text-gray-400">Branch</dt>
            <dd class="text-gray-900 dark:text-gray-100 mt-0.5">{{ artifact.source_branch }}</dd>
          </div>
          <div v-if="artifact.archs?.length">
            <dt class="text-gray-500 dark:text-gray-400">Architectures</dt>
            <dd class="mt-0.5 flex gap-1 flex-wrap">
              <span
                v-for="arch in artifact.archs"
                :key="arch"
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                :class="archBadgeClass(arch)"
              >{{ arch }}</span>
            </dd>
          </div>
          <div v-if="getAcceleratorInfo(artifact).accel">
            <dt class="text-gray-500 dark:text-gray-400">Accelerator</dt>
            <dd class="text-gray-900 dark:text-gray-100 mt-0.5">{{ getAcceleratorInfo(artifact).accel }}</dd>
          </div>
          <div v-if="getAcceleratorInfo(artifact).runtime">
            <dt class="text-gray-500 dark:text-gray-400">{{ getAcceleratorInfo(artifact).accel?.toUpperCase() }} Runtime</dt>
            <dd class="text-gray-900 dark:text-gray-100 mt-0.5">{{ getAcceleratorInfo(artifact).runtime }}</dd>
          </div>
          <div v-if="getAcceleratorInfo(artifact).python">
            <dt class="text-gray-500 dark:text-gray-400">Python</dt>
            <dd class="text-gray-900 dark:text-gray-100 mt-0.5">{{ getAcceleratorInfo(artifact).python }}</dd>
          </div>
          <div v-if="getAcceleratorInfo(artifact).baseImage">
            <dt class="text-gray-500 dark:text-gray-400">Base Image</dt>
            <dd class="mt-0.5 flex items-center gap-1">
              <button @click="navigateToArtifact(getAcceleratorInfo(artifact).baseImage)" class="text-primary-600 dark:text-blue-400 hover:underline text-sm break-all text-left">{{ getAcceleratorInfo(artifact).baseImage }}</button>
              <button @click="copyToClipboard(getAcceleratorInfo(artifact).baseImage)" class="shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                <svg v-if="copiedValue === getAcceleratorInfo(artifact).baseImage" class="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                <svg v-else class="w-3 h-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </button>
            </dd>
          </div>
          <div v-if="getReleaseNotesUrl(artifact)">
            <dt class="text-gray-500 dark:text-gray-400">Release Notes</dt>
            <dd class="mt-0.5">
              <a :href="getReleaseNotesUrl(artifact)" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 text-sm">
                Open GitLab Release Page
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            </dd>
          </div>
          <div v-if="artifact.created_at">
            <dt class="text-gray-500 dark:text-gray-400">Created</dt>
            <dd class="text-gray-900 dark:text-gray-100 mt-0.5">{{ formatDate(artifact.created_at) }}</dd>
          </div>
          <div v-if="artifact.sha_digest">
            <dt class="text-gray-500 dark:text-gray-400">Digest</dt>
            <dd class="mt-0.5 flex items-start gap-1">
              <a v-if="getDigestUrl(artifact)" :href="getDigestUrl(artifact)" target="_blank" rel="noopener noreferrer" class="font-mono text-xs text-primary-600 dark:text-blue-400 hover:underline break-all">{{ artifact.sha_digest }}</a>
              <span v-else class="text-gray-900 dark:text-gray-100 font-mono text-xs break-all">{{ artifact.sha_digest }}</span>
              <button @click="copyToClipboard(artifact.sha_digest)" class="shrink-0 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                <svg v-if="copiedValue === artifact.sha_digest" class="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                <svg v-else class="w-3 h-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              </button>
            </dd>
          </div>
          <div v-if="isContainerType(artifact) && sbomState(artifact) === 'valid'">
            <dt class="text-gray-500 dark:text-gray-400">Atlas SBOMs</dt>
            <dd class="mt-0.5">
              <ul class="list-disc pl-5 space-y-1">
                <li v-for="(sbom, i) in artifact.sbom_links" :key="i">
                  <a :href="sbom.atlas_url" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-blue-400 hover:underline text-sm break-all">{{ sbom.name || sbom.atlas_url }}</a>
                </li>
              </ul>
            </dd>
          </div>
          <div v-else-if="isContainerType(artifact) && sbomState(artifact) === 'incompatible'">
            <dt class="text-gray-500 dark:text-gray-400">Atlas SBOMs</dt>
            <dd class="mt-0.5 text-xs text-red-600 dark:text-red-400">Incompatible (Legacy SBOM - cannot be resolved)</dd>
          </div>
          <div v-else-if="isContainerType(artifact) && sbomState(artifact) === 'empty'">
            <dt class="text-gray-500 dark:text-gray-400">Atlas SBOMs</dt>
            <dd class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">No SBOM links available</dd>
          </div>
        </dl>
      </div>

      <!-- Konflux Build Information -->
      <div v-if="artifact.konflux_data" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Konflux Build Information</h3>
        <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div v-if="artifact.konflux_data.component_name">
            <dt class="text-gray-500 dark:text-gray-400">Component</dt>
            <dd class="text-gray-900 dark:text-gray-100 mt-0.5">{{ artifact.konflux_data.component_name }}</dd>
          </div>
          <div v-if="artifact.konflux_data.pipelinerun_name">
            <dt class="text-gray-500 dark:text-gray-400">Pipeline Run</dt>
            <dd class="mt-0.5">
              <a v-if="artifact.konflux_data.pipelinerun_url" :href="artifact.konflux_data.pipelinerun_url" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-blue-400 hover:underline break-all">{{ artifact.konflux_data.pipelinerun_name }}</a>
              <span v-else class="text-gray-900 dark:text-gray-100">{{ artifact.konflux_data.pipelinerun_name }}</span>
            </dd>
          </div>
          <div v-if="artifact.konflux_data.snapshot_name">
            <dt class="text-gray-500 dark:text-gray-400">Snapshot</dt>
            <dd class="mt-0.5">
              <a v-if="artifact.konflux_data.snapshot_url" :href="artifact.konflux_data.snapshot_url" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-blue-400 hover:underline break-all">{{ artifact.konflux_data.snapshot_name }}</a>
              <span v-else class="text-gray-900 dark:text-gray-100">{{ artifact.konflux_data.snapshot_name }}</span>
            </dd>
          </div>
          <div v-if="artifact.konflux_data.releases && artifact.konflux_data.releases.length > 0" class="md:col-span-2">
            <dt class="text-gray-500 dark:text-gray-400">Releases</dt>
            <dd class="mt-0.5">
              <ul class="list-disc pl-5 space-y-2">
                <li v-for="(rel, i) in artifact.konflux_data.releases" :key="i">
                  <div class="flex items-center gap-2 flex-wrap">
                    <a v-if="rel.url" :href="rel.url" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-blue-400 hover:underline">{{ rel.name }}</a>
                    <span v-else class="text-gray-900 dark:text-gray-100">{{ rel.name }}</span>
                    <span v-if="rel.release_plan" class="text-gray-400 dark:text-gray-500 text-xs" :title="'Konflux ReleasePlan applied for this release'">({{ rel.release_plan }})</span>
                    <span v-if="rel.state" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium" :class="konfluxStateBadgeClass(rel.state)">{{ rel.state }}</span>
                  </div>
                  <div v-if="rel.created_at" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Created: {{ formatDateTime(rel.created_at) }}</div>
                </li>
              </ul>
            </dd>
          </div>
          <div v-else-if="artifact.konflux_data.releases && artifact.konflux_data.releases.length === 0">
            <dt class="text-gray-500 dark:text-gray-400">Releases</dt>
            <dd class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">No releases found</dd>
          </div>
          <div v-if="artifact.konflux_data.tests && artifact.konflux_data.tests.length > 0" class="md:col-span-2">
            <dt class="text-gray-500 dark:text-gray-400">Integration Tests</dt>
            <dd class="mt-0.5">
              <ul class="list-disc pl-5 space-y-2">
                <li v-for="(test, i) in artifact.konflux_data.tests" :key="i">
                  <div class="flex items-center gap-2 flex-wrap">
                    <a v-if="test.pipelinerun_url" :href="test.pipelinerun_url" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-blue-400 hover:underline">{{ test.scenario }}</a>
                    <span v-else class="text-gray-900 dark:text-gray-100">{{ test.scenario }}</span>
                    <span v-if="test.status" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium" :class="testStatusBadgeClass(test.status)">{{ testStatusLabel(test.status) }}</span>
                    <span v-if="test.is_optional" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">optional</span>
                  </div>
                  <div v-if="test.completion_time && test.start_time" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Duration: {{ formatDuration(test.start_time, test.completion_time) }}</div>
                  <div v-else-if="test.start_time" class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Started: {{ formatDateTime(test.start_time) }}</div>
                </li>
              </ul>
            </dd>
          </div>
        </dl>
      </div>

      <!-- Container Image Labels -->
      <div v-if="importantLabels.length || otherLabels.length" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <template v-if="importantLabels.length">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Container Image Labels</h3>
          <div class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <template v-for="[key, value] in importantLabels" :key="key">
              <div class="font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">{{ key }}</div>
              <div class="break-all">
                <a v-if="isUrlLabel(key, value)" :href="formatLabelValue(key, value)" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-blue-400 hover:underline">{{ formatLabelValue(key, value) }}</a>
                <span v-else class="text-gray-700 dark:text-gray-300">{{ formatLabelValue(key, value) }}</span>
              </div>
            </template>
          </div>
        </template>

        <div v-if="otherLabels.length" :class="importantLabels.length ? 'mt-4' : ''">
          <button
            @click="otherLabelsExpanded = !otherLabelsExpanded"
            class="text-sm text-primary-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <svg class="w-3 h-3 transition-transform" :class="otherLabelsExpanded ? 'rotate-90' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            {{ otherLabelsExpanded ? `Hide all other labels (${otherLabels.length})` : `Show all other labels (${otherLabels.length})` }}
          </button>
          <div v-if="otherLabelsExpanded" class="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm mt-3">
            <template v-for="[key, value] in otherLabels" :key="key">
              <div class="font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">{{ key }}</div>
              <div class="break-all">
                <a v-if="isUrlLabel(key, value)" :href="formatLabelValue(key, value)" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-blue-400 hover:underline">{{ formatLabelValue(key, value) }}</a>
                <span v-else class="text-gray-700 dark:text-gray-300">{{ formatLabelValue(key, value) }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Package Dependencies (containers) -->
      <div v-if="artifact.type === 'containers' && wheelsWithPackages.length" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center gap-2 mb-3">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Package Dependencies</h3>
          <button @click="downloadPackagesAsJson" class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Download packages as JSON">
            <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
        </div>
        <div v-for="w in wheelsWithPackages" :key="w.key" class="mb-4 last:mb-0">
          <div class="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-2">
            <button @click="navigateToArtifact(w.key)" class="text-primary-600 dark:text-blue-400 hover:underline break-all text-left">{{ w.key }}</button>
          </div>
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
      <div v-else-if="artifact.type === 'containers' && !wheels.length && !loading" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">No package dependencies found for this container.</p>
      </div>

      <!-- Used in Containers (wheel collections / base images) -->
      <div v-if="(artifact.type === 'wheels-collections' || artifact.type === 'base-images') && containers.length" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Used in Containers</h3>
        <ul class="list-disc pl-5 space-y-2">
          <li v-for="c in containers" :key="c.key" class="text-sm">
            <button @click="navigateToArtifact(c.key)" class="text-primary-600 dark:text-blue-400 hover:underline break-all text-left">{{ c.key }}</button>
            <span v-if="c.variant" class="text-gray-500 dark:text-gray-400 ml-2">({{ c.variant }})</span>
          </li>
        </ul>
      </div>

      <!-- Packages (wheel collections) -->
      <div v-if="artifact.type === 'wheels-collections' && buildSequence" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center gap-2 mb-3">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Packages</h3>
          <button @click="downloadBuildSequenceAsJson" class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Download build sequence as JSON">
            <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
        </div>

        <!-- Filter chips -->
        <div class="flex gap-2 mb-4 flex-wrap items-center">
          <span class="text-xs text-gray-400 dark:text-gray-500 mr-1">Show:</span>
          <button
            @click="buildSequenceFilter = 'all'"
            class="inline-flex items-center px-2 py-1 rounded text-xs font-medium border transition-colors"
            :class="buildSequenceFilter === 'all'
              ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700'
              : 'bg-white text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'"
          >All ({{ buildSequence.total }})</button>
          <button
            v-for="cat in ['new', 'prebuilt', 'skipped']"
            :key="cat"
            @click="buildSequenceFilter = cat"
            class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors"
            :class="buildSequenceFilter === cat
              ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700'
              : 'bg-white text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'"
            :title="CATEGORY_META[cat].tooltip"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="CATEGORY_META[cat].iconPath" /></svg>
            {{ CATEGORY_META[cat].label }} ({{ buildSequence[cat === 'new' ? 'newBuilds' : cat].length }})
          </button>
          <button
            v-if="installableNames.size > 0"
            @click="buildSequenceFilter = 'installable'"
            class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors"
            :class="buildSequenceFilter === 'installable'
              ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700'
              : 'bg-white text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'"
            title="Only show packages that would be installed (appear in constraints)"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Installable ({{ installableCount }})
          </button>
        </div>

        <!-- Package grid -->
        <p v-if="filteredBuildEntries.length === 0" class="text-sm text-gray-400 dark:text-gray-500 italic">No packages match the selected filter.</p>
        <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-1.5 font-mono text-[13px]">
          <div
            v-for="(entry, i) in filteredBuildEntries"
            :key="i"
            class="flex items-center gap-1.5 py-1"
          >
            <svg
              class="w-3 h-3 shrink-0 cursor-help"
              :class="{
                'text-blue-500 dark:text-blue-400': entryCategory(entry) === 'new',
                'text-cyan-500 dark:text-cyan-400': entryCategory(entry) === 'prebuilt',
                'text-gray-400 dark:text-gray-500': entryCategory(entry) === 'skipped',
              }"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            ><title>{{ CATEGORY_META[entryCategory(entry)].tooltip }}</title><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="CATEGORY_META[entryCategory(entry)].iconPath" /></svg>
            <svg
              v-if="installableNames.size > 0 && installableNames.has(canonicalizeName(entry.name))"
              class="w-3 h-3 shrink-0 text-green-500 dark:text-green-400 cursor-help"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            ><title>In installable set (appears in constraints)</title><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span class="text-gray-800 dark:text-gray-200">{{ entry.name }}=={{ entry.version }}</span>
          </div>
        </div>
      </div>
      <div v-else-if="artifact.type === 'wheels-collections' && !artifact.build_sequence_summary && !loading" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">No package information found for this wheel collection.</p>
      </div>

      <!-- Dependency Graph (wheel collections) -->
      <div v-if="artifact.type === 'wheels-collections' && artifact.dependency_graph" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div class="flex items-center gap-2 mb-3">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Dependency Graph</h3>
          <button @click="downloadDependencyGraphAsJson" class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Download graph as JSON">
            <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
        </div>
        <DependencyGraph :dependency-graph-json="artifact.dependency_graph" />
      </div>
    </template>
  </div>
</template>
