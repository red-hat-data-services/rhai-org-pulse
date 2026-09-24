<script setup>
import { onMounted, ref, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { useReleaseStatus } from '../composables/useReleaseStatus'

const { data, loading, error, load } = useReleaseStatus()
const collapsedEpics = ref(new Set())

function isEpicExpanded(key) {
  return !collapsedEpics.value.has(key)
}

function toggleEpic(key) {
  const next = new Set(collapsedEpics.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsedEpics.value = next
}

const activeAction = ref(null)
const products = ['agentic-base-images', 'ai-hub', 'base-images', 'docling', 'guidellm', 'rhaiis', 'rhelai', 'torch']
const createProduct = ref('')
const createBranch = ref('')
const createVersion = ref('')
const createReleaseType = ref('')
const createAdvisoryType = ref('RHEA')
const createFeatureMode = ref('auto')
const createFeatureKey = ref('')
const createFeatureSummary = ref('')
const triggerAction = ref('planned')
const triggerInputType = ref('image-list')
const releaseEpicOptions = ref(null)
const releaseEpicLoading = ref(false)
const releaseEpicOptionsError = ref(null)
const releaseEpicOptionsCacheKey = 'product-builds:release-epic-options:v2'
const releaseEpicOptionsCacheTtl = 300000
const releaseEpicState = ref({ loading: false, error: null, duplicates: [], features: [], result: null, createdKeys: [] })

function selectedProductMetadata() {
  return releaseEpicOptions.value?.products?.find(product => product.key === createProduct.value) || null
}

function selectedBranchMetadata() {
  return selectedProductMetadata()?.branches?.find(branch => branch.branch === createBranch.value) || null
}

function resetFeatureSelection() {
  createFeatureMode.value = 'auto'
  createFeatureKey.value = ''
  createFeatureSummary.value = ''
}

async function loadReleaseEpicOptions() {
  if (releaseEpicOptions.value || releaseEpicLoading.value) return
  try {
    const cached = JSON.parse(window.localStorage.getItem(releaseEpicOptionsCacheKey) || 'null')
    if (cached?.savedAt && Date.now() - cached.savedAt < releaseEpicOptionsCacheTtl && cached.data?.sha) {
      releaseEpicOptions.value = cached.data
      return
    }
  } catch {
    window.localStorage.removeItem(releaseEpicOptionsCacheKey)
  }
  releaseEpicLoading.value = true
  releaseEpicOptionsError.value = null
  try {
    releaseEpicOptions.value = await apiRequest('/modules/product-builds/release-epic/options')
    window.localStorage.setItem(releaseEpicOptionsCacheKey, JSON.stringify({ savedAt: Date.now(), data: releaseEpicOptions.value }))
  } catch (err) {
    console.error('Failed to load release options', err)
    releaseEpicOptionsError.value = 'Unable to load release data. Please try again.'
  } finally {
    releaseEpicLoading.value = false
  }
}

function selectCreateProduct() {
  resetFeatureSelection()
  createBranch.value = ''
  createVersion.value = ''
}

function selectCreateBranch() {
  resetFeatureSelection()
  createVersion.value = ''
}

watch([createProduct, createBranch, createVersion], () => {
  resetFeatureSelection()
})

watch([createProduct, createBranch, createVersion, createReleaseType, createAdvisoryType], () => {
  if (releaseEpicState.value.loading) return
  releaseEpicState.value = {
    ...releaseEpicState.value,
    error: null,
    duplicates: [],
    features: [],
    result: null,
    createdKeys: [],
  }
})

async function submitCreateEpic(event) {
  const form = new FormData(event.currentTarget)
  releaseEpicState.value = { ...releaseEpicState.value, loading: true, error: null, result: null, createdKeys: [] }
  const body = {
    product: form.get('product'),
    version: form.get('version'),
    branch: form.get('branch'),
    pmc_sha: releaseEpicOptions.value?.sha || '',
    release_type: form.get('release-type'),
    advisory_type: form.get('advisory-type'),
    exclude: form.get('exclude'),
    feature_mode: createFeatureMode.value,
    feature: createFeatureKey.value,
    feature_summary: createFeatureSummary.value,
    confirm_duplicates: releaseEpicState.value.duplicates.length > 0,
  }
  try {
    const result = await apiRequest('/modules/product-builds/release-epic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    releaseEpicState.value = {
      ...releaseEpicState.value,
      loading: false,
      result,
      error: null,
      duplicates: [],
      features: [],
      createdKeys: result.created_keys || [],
    }
  } catch (err) {
    const data = err.data || {}
    if (data.code === 'stale-pmc') {
      releaseEpicOptions.value = null
      releaseEpicOptionsError.value = 'Release data changed. Reloading the available options...'
      window.localStorage.removeItem(releaseEpicOptionsCacheKey)
    }
    releaseEpicState.value = {
      ...releaseEpicState.value,
      loading: false,
      error: err.message || 'Release Epic creation failed',
      duplicates: data.duplicates || [],
      features: data.features || [],
      createdKeys: data.created_keys || [],
    }
    if (data.feature_key) {
      createFeatureMode.value = 'explicit'
      createFeatureKey.value = data.feature_key
    }
  }
}

function toggleAction(action) {
  activeAction.value = activeAction.value === action ? null : action
  if (action === 'create-epic') loadReleaseEpicOptions()
}

function closeAction() {
  activeAction.value = null
}

onMounted(load)

const LIFECYCLE_STATES = {
  planned: 'planned',
  'not started': 'planned',
  ready: 'ready',
  triggered: 'triggered',
  'in progress': 'triggered',
  released: 'released',
  completed: 'released',
  failed: 'failed',
  skip: 'skipped',
  skipped: 'skipped',
}

const LIFECYCLE_PRECEDENCE = ['planned', 'triggered', 'ready', 'failed', 'released', 'skip']

const STATUS_CLASSES = {
  planned: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  ready: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800',
  triggered: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  released: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800',
  failed: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
  skipped: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700/40 dark:text-gray-300 dark:border-gray-600',
  unknown: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-700/30 dark:text-gray-300 dark:border-gray-600',
}

const STATUS_DOT_CLASSES = {
  planned: 'bg-amber-500',
  ready: 'bg-blue-500',
  triggered: 'bg-emerald-500',
  released: 'bg-green-300',
  failed: 'bg-red-500',
  skipped: 'bg-gray-400',
  unknown: 'bg-gray-400',
}

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ')
}

function lifecycleState(labels) {
  const normalizedLabels = new Set((labels || []).map(normalize))
  for (const label of LIFECYCLE_PRECEDENCE) {
    const state = normalizedLabels.has(label) && LIFECYCLE_STATES[label]
    if (state) return state
  }
  return null
}

function jiraState(status) {
  const name = normalize(status?.name)
  if (['planned', 'not started', 'to do', 'open', 'new'].includes(name)) return 'planned'
  if (name === 'ready') return 'ready'
  if (['triggered', 'in progress'].includes(name)) return 'triggered'
  if (['released', 'completed', 'done', 'closed'].includes(name)) return 'released'
  if (name.includes('fail')) return 'failed'
  if (name.includes('skip')) return 'skipped'

  return {
    new: 'planned',
    indeterminate: 'triggered',
    done: 'released',
  }[normalize(status?.category)] || 'unknown'
}

function statusState(item) {
  return lifecycleState(item?.labels) || jiraState(item?.status)
}

function statusClass(item) {
  return STATUS_CLASSES[statusState(item)]
}

function statusDotClass(item) {
  return STATUS_DOT_CLASSES[statusState(item)]
}

function isCompleted(item) {
  const statusName = normalize(item?.status?.name)
  return ['released', 'completed', 'done', 'closed'].includes(statusName)
    || normalize(item?.status?.category) === 'done'
}

function statusLabel(item) {
  return item.status?.name || 'Unknown'
}

function visibleLabels(labels = []) {
  return labels.filter(label => normalize(label) !== 'release automation')
}

function jiraUrl(key) {
  return `https://redhat.atlassian.net/browse/${key}`
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Release status</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
        Ongoing release epics and readiness cards from Jira
      </p>
      <div aria-label="Status legend" class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-gray-500 dark:text-gray-400">
        <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-amber-500"></span>Planned / not started</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-blue-500"></span>Ready</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-emerald-500"></span>Triggered / in progress</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-green-300"></span>Released / completed</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-red-500"></span>Failed</span>
        <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-gray-400"></span>Skipped</span>
      </div>
    </div>

    <section
      aria-labelledby="release-actions-heading"
      data-release-actions
      class="rounded-lg border border-gray-200 bg-white p-5 text-center dark:border-gray-700 dark:bg-gray-800 sm:p-6"
    >
      <h2 id="release-actions-heading" class="text-center text-lg font-bold text-gray-900 dark:text-gray-100">Release actions</h2>
      <div class="mt-5 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          data-release-action="create-epic"
          :aria-expanded="activeAction === 'create-epic'"
          :aria-pressed="activeAction === 'create-epic'"
          @click="toggleAction('create-epic')"
          class="rounded-lg px-5 py-3 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          :class="!activeAction || activeAction === 'create-epic'
            ? 'bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'"
        >
          Create release epic
        </button>
        <span class="group relative inline-flex" tabindex="0" aria-describedby="trigger-release-tooltip" title="Trigger release is not ready yet. It will be available soon.">
          <button
            type="button"
            data-release-action="trigger-release"
            disabled
            aria-disabled="true"
            :aria-expanded="activeAction === 'trigger-release'"
            :aria-pressed="activeAction === 'trigger-release'"
            @click="toggleAction('trigger-release')"
            class="rounded-lg px-5 py-3 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-gray-900"
            :class="!activeAction || activeAction === 'trigger-release'
              ? 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'"
          >
            Trigger release
          </button>
          <span id="trigger-release-tooltip" role="tooltip" class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-52 -translate-x-1/2 rounded-md bg-gray-900 px-3 py-2 text-center text-xs font-normal text-white opacity-0 shadow-lg transition-opacity group-focus:opacity-100 group-hover:opacity-100 dark:bg-gray-100 dark:text-gray-900">Trigger release is not ready yet. It will be available soon.</span>
        </span>
      </div>

      <Transition name="release-action-form">
        <form
          v-if="activeAction === 'create-epic'"
          data-release-form="create-epic"
          class="mx-auto mt-6 max-w-3xl text-left"
          @submit.prevent="submitCreateEpic"
        >
          <div class="mb-4 flex justify-end">
            <button
              type="button"
              aria-label="Close release action form"
              class="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              @click="closeAction"
            >
              Close
            </button>
          </div>
          <div v-if="releaseEpicLoading" class="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
            Fetching release data. Please wait a moment...
          </div>
          <div v-else-if="releaseEpicOptionsError" class="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {{ releaseEpicOptionsError }}
            <button type="button" class="ml-2 font-semibold underline" @click="loadReleaseEpicOptions">Retry</button>
          </div>
          <fieldset :disabled="releaseEpicLoading || !releaseEpicOptions" class="contents">
            <div class="grid gap-4 sm:grid-cols-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Product <span class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
              <select v-model="createProduct" name="product" required :disabled="!releaseEpicOptions" class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-700" @change="selectCreateProduct">
                <option value="" disabled>Choose a product</option>
                <option v-for="product in products" :key="product" :value="product">{{ product }}</option>
              </select>
            </label>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Branch <span class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
              <select v-model="createBranch" name="branch" required :disabled="!selectedProductMetadata()" class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-700" @change="selectCreateBranch">
                <option value="" disabled>Choose a branch</option>
                <option v-for="branch in (selectedProductMetadata()?.branches || [])" :key="branch.branch" :value="branch.branch">{{ branch.branch }}</option>
              </select>
              <span class="mt-1 block text-xs font-normal text-gray-500 dark:text-gray-400">Available release branches, including EA and fast channels.</span>
            </label>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Version <span class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
              <select v-model="createVersion" name="version" required :disabled="!selectedBranchMetadata()" class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:disabled:bg-gray-700">
                <option value="" disabled>Choose a version</option>
                <option v-for="version in (selectedBranchMetadata()?.configured_versions || [])" :key="version" :value="version">{{ version }}</option>
              </select>
              <span class="mt-1 block text-xs font-normal text-gray-500 dark:text-gray-400">Versions come directly from the selected branch.</span>
            </label>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Release type
              <select v-model="createReleaseType" name="release-type" class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                <option value="">Use the default or infer automatically</option>
                <option value="GA">GA</option>
                <option value="EA">EA</option>
              </select>
              <span class="mt-1 block text-xs font-normal text-gray-500 dark:text-gray-400">Leave blank to use the configured default or infer GA/EA from the branch.</span>
            </label>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Advisory type <span class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
              <select v-model="createAdvisoryType" name="advisory-type" required class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                <option value="RHEA">RHEA</option>
                <option value="RHBA">RHBA</option>
                <option value="RHSA">RHSA</option>
              </select>
            </label>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 sm:col-span-2">
              Exclude components or variants
              <input name="exclude" type="text" placeholder="Comma-separated names, for example rubin,bootc-gaudi-iso-disk-image" class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
              <span class="mt-1 block text-xs font-normal text-gray-500 dark:text-gray-400">Optional exact component or variant names from the product configuration.</span>
            </label>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 sm:col-span-2">
              Parent feature
              <select v-model="createFeatureMode" name="feature-mode" class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                <option value="auto">Auto-find a matching feature (default)</option>
                <option value="explicit">Use an explicit RHAISTRAT Feature key</option>
                <option value="create">Create a new RHAISTRAT Feature</option>
                <option value="none">Skip the parent feature</option>
              </select>
              <span class="mt-1 block text-xs font-normal text-gray-500 dark:text-gray-400">Feature lookup is based on Jira. Choose the explicit option only when you know the key.</span>
            </label>
            <label v-if="createFeatureMode === 'explicit'" class="text-sm font-medium text-gray-700 dark:text-gray-300 sm:col-span-2">
              RHAISTRAT Feature key <span class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
              <input v-model="createFeatureKey" name="feature" type="text" required placeholder="RHAISTRAT-12345" class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
            </label>
            <label v-if="createFeatureMode === 'create'" class="text-sm font-medium text-gray-700 dark:text-gray-300 sm:col-span-2">
              New Feature summary <span class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
              <input v-model="createFeatureSummary" name="feature-summary" type="text" required placeholder="RHEL AI 3.5 GA Release" class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
            </label>
            </div>
          </fieldset>
          <div v-if="releaseEpicState.error" class="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {{ releaseEpicState.error }}
            <span v-if="releaseEpicState.createdKeys.length" class="mt-2 block">
              Created before the failure: {{ releaseEpicState.createdKeys.join(', ') }}
            </span>
          </div>
          <div v-if="releaseEpicState.duplicates.length" class="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            <p class="font-semibold">Matching release Epics require confirmation:</p>
            <a v-for="duplicate in releaseEpicState.duplicates" :key="duplicate.key" :href="jiraUrl(duplicate.key)" target="_blank" rel="noopener" class="mt-1 block underline">{{ duplicate.key }} — {{ duplicate.summary }}</a>
            <p class="mt-2">Submit again to create another Epic.</p>
          </div>
          <div v-if="releaseEpicState.features.length" class="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
            <label class="font-semibold">Choose a parent Feature or skip
              <select v-model="createFeatureKey" class="mt-2 block w-full rounded-md border border-blue-300 bg-white px-3 py-2 font-normal text-gray-900 dark:bg-gray-800 dark:text-gray-100" @change="createFeatureMode = createFeatureKey ? 'explicit' : 'none'">
                <option value="">Skip parent Feature</option>
                <option v-for="feature in releaseEpicState.features" :key="feature.key" :value="feature.key">{{ feature.key }} — {{ feature.summary }}</option>
              </select>
            </label>
          </div>
          <div v-if="releaseEpicState.result" class="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
            Created release Epic <a :href="jiraUrl(releaseEpicState.result.epic.key)" target="_blank" rel="noopener" class="font-semibold underline">{{ releaseEpicState.result.epic.key }}</a>.
            <ul v-if="releaseEpicState.result.cards?.length" class="mt-2 list-disc pl-5">
              <li v-for="card in releaseEpicState.result.cards" :key="card.key">
                <a :href="jiraUrl(card.key)" target="_blank" rel="noopener" class="underline">{{ card.key }}</a> — {{ card.summary }}
              </li>
            </ul>
            <p v-if="releaseEpicState.result.warnings?.length" class="mt-2 font-semibold">{{ releaseEpicState.result.warnings.join(' ') }}</p>
            <p v-if="releaseEpicState.result.not_created?.length" class="mt-2">Not created by rule: {{ releaseEpicState.result.not_created.map(card => card.summary).join('; ') }}</p>
            <p v-if="releaseEpicState.result.failures?.length" class="mt-2 text-red-700 dark:text-red-300">Failed cards: {{ releaseEpicState.result.failures.map(card => card.summary).join('; ') }}</p>
          </div>
          <button type="submit" :disabled="releaseEpicState.loading || releaseEpicLoading || !releaseEpicOptions" class="mt-5 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-wait disabled:opacity-60">
            {{ releaseEpicState.loading ? 'Creating release epic...' : releaseEpicState.duplicates.length ? 'Confirm and create release epic' : 'Create release epic' }}
          </button>
        </form>
      </Transition>

      <Transition name="release-action-form">
        <form
          v-if="activeAction === 'trigger-release'"
          data-release-form="trigger-release"
          class="mx-auto mt-6 max-w-3xl text-left"
          @submit.prevent
        >
          <div class="mb-4 flex justify-end">
            <button
              type="button"
              aria-label="Close release action form"
              class="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              @click="closeAction"
            >
              Close
            </button>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Product <span class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
              <select name="product" required class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                <option value="" disabled>Choose a product</option>
                <option v-for="product in products" :key="product" :value="product">{{ product }}</option>
              </select>
            </label>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Version <span class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
              <input name="version" type="text" required placeholder="Exact release version, for example 3.5.0" class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
            </label>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Target <span class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
              <select name="target" required class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                <option value="" disabled>Choose a target</option>
                <option value="stage-rc">stage-rc</option>
                <option value="prod">prod</option>
              </select>
            </label>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Action
              <select v-model="triggerAction" name="action" class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                <option value="planned">planned</option>
                <option value="ready">ready</option>
                <option value="skip">skip</option>
              </select>
            </label>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 sm:col-span-2">
              Components <span class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
              <textarea name="components" required rows="4" placeholder="One component per line: name or name=pullspec" class="mt-1.5 w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"></textarea>
              <span class="mt-1 block text-xs font-normal text-gray-500 dark:text-gray-400">One per line: name for planned, name=pullspec for ready, or name — reason for skip. Pullspecs are optional for planned and skip.</span>
            </label>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Input type
              <select v-model="triggerInputType" name="input-type" class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                <option value="image-list">image-list</option>
                <option value="git-tag">git-tag</option>
              </select>
            </label>
            <label v-if="triggerInputType === 'git-tag'" class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Git tag <span class="text-red-600 dark:text-red-400" aria-hidden="true">*</span>
              <input name="input-value" type="text" required placeholder="v3.5.0" class="mt-1.5 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" />
            </label>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300 sm:col-span-2">
              Notes <span class="font-normal text-gray-500 dark:text-gray-400">(optional)</span>
              <textarea name="notes" rows="3" placeholder="Optional build or release notes" class="mt-1.5 w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"></textarea>
            </label>
          </div>
          <button type="submit" class="mt-5 rounded-md bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            Trigger release (placeholder)
          </button>
        </form>
      </Transition>
    </section>

    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
        <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4"></div>
        <div class="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>

    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-else-if="!data || data.total === 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-sm text-gray-500 dark:text-gray-400">
      No ongoing release epics found.
    </div>

    <div v-else class="space-y-6">
      <section
        v-for="group in data.groups"
        :key="group.key"
        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <div class="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">{{ group.label }}</h2>
        </div>

        <div v-if="group.epics.length === 0" class="px-4 py-5 text-sm text-gray-500 dark:text-gray-400">
          No ongoing releases.
        </div>

        <div v-for="epic in group.epics" :key="epic.key" class="border-b last:border-b-0 border-gray-200 p-4 sm:p-5 dark:border-gray-700">
          <div
            :data-tree-root="epic.key"
            :data-status-state="statusState(epic)"
            :role="epic.children.length > 0 ? 'button' : undefined"
            :tabindex="epic.children.length > 0 ? 0 : undefined"
            :aria-expanded="epic.children.length > 0 ? isEpicExpanded(epic.key) : undefined"
            :aria-controls="epic.children.length > 0 ? `release-cards-${epic.key}` : undefined"
            class="relative cursor-pointer rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50/80 p-4 shadow-sm transition hover:border-gray-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:from-gray-800 dark:to-gray-900/50 dark:hover:border-gray-600"
            @click="epic.children.length > 0 && toggleEpic(epic.key)"
            @keydown.enter.prevent="epic.children.length > 0 && toggleEpic(epic.key)"
            @keydown.space.prevent="epic.children.length > 0 && toggleEpic(epic.key)"
          >
            <span :class="statusDotClass(epic)" class="absolute -left-1.5 top-5 h-3 w-3 rounded-full ring-4 ring-white dark:ring-gray-800"></span>
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <a :href="jiraUrl(epic.key)" target="_blank" rel="noopener" class="font-semibold text-primary-600 dark:text-blue-400 hover:underline" @click.stop>
                    {{ epic.key }}
                  </a>
                  <span class="text-gray-900 dark:text-gray-100">{{ epic.summary }}</span>
                </div>
                <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                  <span v-if="epic.details.version">Version {{ epic.details.version }}</span>
                  <span v-if="epic.details.target">Target: {{ epic.details.target }}</span>
                  <span>Updated {{ formatDate(epic.updated) }}</span>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-2 self-start">
                <span v-if="epic.children.length > 0" :data-epic-toggle="epic.key" aria-hidden="true" class="text-lg font-semibold leading-none text-gray-400 dark:text-gray-500">
                  {{ isEpicExpanded(epic.key) ? '-' : '+' }}
                </span>
                <span :data-status-badge="epic.key" class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold" :class="statusClass(epic)" :data-status-category="epic.status.category">
                  {{ statusLabel(epic) }}
                </span>
              </div>
            </div>
            <div v-if="visibleLabels(epic.labels).length" class="mt-3 flex flex-wrap gap-1.5">
              <span v-for="label in visibleLabels(epic.labels)" :key="label" class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {{ label }}
              </span>
            </div>
          </div>

          <div v-if="isEpicExpanded(epic.key) && epic.children.length === 0" class="ml-3 mt-4 text-sm text-gray-500 dark:text-gray-400">
            No child cards found.
          </div>
          <div v-show="isEpicExpanded(epic.key) && epic.children.length > 0" :id="`release-cards-${epic.key}`" class="relative ml-3 mt-4 space-y-3 border-l-2 border-gray-200 pl-5 dark:border-gray-700 sm:ml-5 sm:pl-7" data-tree-branch>
            <div
              v-for="child in epic.children"
              :key="child.key"
              :data-tree-child="child.key"
              :data-status-state="statusState(child)"
              :data-completed="isCompleted(child)"
              :class="isCompleted(child) ? 'opacity-70' : ''"
              class="relative rounded-xl border border-gray-200 bg-gray-50/70 p-3 shadow-sm before:absolute before:-left-5 before:top-5 before:w-5 before:border-t-2 before:border-gray-200 dark:border-gray-700 dark:bg-gray-900/30 dark:before:border-gray-700 sm:p-4"
            >
              <span :class="statusDotClass(child)" class="absolute -left-[1.8125rem] top-3.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-800"></span>
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div class="min-w-0 text-sm">
                  <a :href="jiraUrl(child.key)" target="_blank" rel="noopener" class="font-medium text-primary-600 dark:text-blue-400 hover:underline">{{ child.key }}</a>
                   <span class="ml-2 break-words text-gray-700 dark:text-gray-300" :class="isCompleted(child) ? 'line-through' : ''">{{ child.summary }}</span>
                </div>
                <span :data-status-badge="child.key" class="inline-flex shrink-0 items-center self-start rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap" :class="statusClass(child)" :data-status-category="child.status.category">
                  {{ statusLabel(child) }}
                </span>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <div class="flex flex-wrap gap-x-2 gap-y-1">
                  <span v-for="label in visibleLabels(child.labels)" :key="label" class="text-gray-600 dark:text-gray-300">{{ label }}</span>
                  <span v-if="visibleLabels(child.labels).length === 0" class="text-gray-400 dark:text-gray-500">—</span>
                </div>
                <span class="whitespace-nowrap">Updated {{ formatDate(child.updated) }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.release-action-form-enter-active,
.release-action-form-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.release-action-form-enter-from,
.release-action-form-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>
