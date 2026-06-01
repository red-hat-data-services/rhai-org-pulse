<script setup>
import { ref, computed, inject } from 'vue'
import { useModuleLink } from '@shared/client/composables/useModuleLink'

const { linkTo } = useModuleLink()
const moduleNav = inject('moduleNav')
const releasesAvailable = computed(() => moduleNav?.isModuleAvailable?.('releases') ?? false)

const props = defineProps({
  components: { type: Object, default: () => ({}) },
  featureTitles: { type: Object, default: () => ({}) },
  detailCache: { type: Object, default: () => ({}) },
  jiraHost: { type: String, default: 'https://redhat.atlassian.net' }
})

const emit = defineEmits(['loadDetail'])

// ── Sort state ────────────────────────────────────────────────────────────────
const sortKey = ref('created')
const sortDir = ref('desc')

function setSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'created' ? 'desc' : 'asc'
  }
}

function sortIcon(key) {
  if (sortKey.value !== key) return '↕'
  return sortDir.value === 'asc' ? '↑' : '↓'
}

// ── Search / filter state (local to table) ───────────────────────────────────
const search = ref('')
const completionFilter = ref('all')
const productFilter = ref('all')
// ── Derived list ──────────────────────────────────────────────────────────────
const selectedKey = ref(null)

function daysBetween(start, end) {
  if (!start || !end) return null
  return Math.round((new Date(end) - new Date(start)) / 86400000)
}

// Days from validation to close (the onboarding clock).
// Falls back to created if validationDate is absent.
function onboardingDays(c) {
  const start = c.validationDate || c.created
  const end   = c.completionStatus === 'completed' ? c.resolved : new Date().toISOString()
  return daysBetween(start, end)
}

const componentList = computed(() => {
  const q = search.value.toLowerCase()

  return Object.values(props.components)
    .filter(c => (c.onboardingMethod || 'automated') === 'automated')
    .filter(c => {
      if (completionFilter.value !== 'all' && c.completionStatus !== completionFilter.value) return false
      if (productFilter.value !== 'all' && c.productContext !== productFilter.value) return false
      if (!q) return true
      return (
        c.key.toLowerCase().includes(q) ||
        (c.componentName || '').toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        (c.linkedFeatures || []).some(f => f.toLowerCase().includes(q))
      )
    })
    .sort((a, b) => {
      const dir = sortDir.value === 'asc' ? 1 : -1
      switch (sortKey.value) {
        case 'key':
          return dir * a.key.localeCompare(b.key)
        case 'component':
          return dir * (a.componentName || a.summary).localeCompare(b.componentName || b.summary)
        case 'product':
          return dir * (a.productContext || '').localeCompare(b.productContext || '')
        case 'status':
          return dir * a.completionStatus.localeCompare(b.completionStatus)
        case 'steps': {
          const aSteps = Object.values(a.onboardingSteps || {}).filter(Boolean).length
          const bSteps = Object.values(b.onboardingSteps || {}).filter(Boolean).length
          return dir * (aSteps - bSteps)
        }
        case 'days': {
          const aDays = onboardingDays(a) ?? 0
          const bDays = onboardingDays(b) ?? 0
          return dir * (aDays - bDays)
        }
        case 'created':
        default:
          return dir * (a.created || '').localeCompare(b.created || '')
      }
    })
})

// ── Pipeline steps in order (from skill doc) ─────────────────────────────────
const STEPS = [
  { key: 'yamlValidated',           label: 'YAML',     title: 'YAML Validated',                  product: 'both' },
  { key: 'quayRepoCreated',         label: 'Quay',     title: 'Quay Repo Created',               product: 'both' },
  { key: 'deliveryRepoProvisioned', label: 'Delivery', title: 'Delivery Repo (RHOAI)',            product: 'rhoai' },
  { key: 'konfluxOnboarded',        label: 'KRD',      title: 'Konflux Release Data',            product: 'both' },
  { key: 'pushPipelineConfigured',  label: 'Push',     title: 'Push Pipeline (rkc/tekton)',       product: 'both' },
  { key: 'pullPipelineConfigured',  label: 'Pull',     title: 'Pull Pipeline (RHOAI)',            product: 'rhoai' },
  { key: 'odhKonfluxOnboarded',     label: 'OKC',      title: 'ODH Konflux Central',             product: 'odh' },
  { key: 'operatorIntegrated',      label: 'Op',       title: 'Operator Integrated (if operator)', product: 'operator' },
  { key: 'bundleConfigured',        label: 'Bundle',   title: 'Bundle Configured',               product: 'both' },
  { key: 'productListingUpdated',   label: 'Listing',  title: 'Product Listing (RHOAI)',          product: 'rhoai' },
  { key: 'autoMergeSetup',          label: 'Merge',    title: 'Auto-Merge Setup (RHOAI)',         product: 'rhoai' },
  { key: 'renovateSetup',           label: 'Renovate', title: 'Renovate Setup (RHOAI)',           product: 'rhoai' }
]

// Product badge classes
const PRODUCT_STEP_CLASSES = {
  rhoai:    'text-red-600 dark:text-red-400',
  odh:      'text-blue-600 dark:text-blue-400',
  operator: 'text-purple-600 dark:text-purple-400',
  both:     'text-gray-500 dark:text-gray-400'
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function selectRow(key) {
  selectedKey.value = selectedKey.value === key ? null : key
  if (key && !props.detailCache[key]) emit('loadDetail', key)
}

// Count steps done for a component
function stepsDone(component) {
  return Object.values(component.onboardingSteps || {}).filter(Boolean).length
}
</script>

<template>
  <div class="flex-1 overflow-auto">
    <!-- Table controls -->
    <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-3 bg-white dark:bg-gray-900">
      <!-- Search -->
      <div class="relative">
        <svg class="absolute left-2.5 top-2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="search"
          type="text"
          placeholder="Search key, component, feature…"
          class="pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
        />
      </div>

      <!-- Completion filter -->
      <select
        v-model="completionFilter"
        class="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">All statuses</option>
        <option value="completed">Completed</option>
        <option value="in-progress">In Progress</option>
      </select>

      <!-- Product filter -->
      <select
        v-model="productFilter"
        class="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="all">All products</option>
        <option value="RHOAI">RHOAI</option>
        <option value="ODH">ODH</option>
      </select>

      <span class="ml-auto text-xs text-gray-400 dark:text-gray-500">
        {{ componentList.length }} component{{ componentList.length !== 1 ? 's' : '' }}
      </span>
    </div>

    <!-- Table -->
    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
      <thead class="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
        <tr>
          <th
            class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap"
            @click="setSort('key')"
          >
            Key <span class="ml-1 opacity-60">{{ sortIcon('key') }}</span>
          </th>
          <th
            class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
            @click="setSort('component')"
          >
            Component <span class="ml-1 opacity-60">{{ sortIcon('component') }}</span>
          </th>
          <th
            class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
            @click="setSort('product')"
          >
            Product <span class="ml-1 opacity-60">{{ sortIcon('product') }}</span>
          </th>
          <th
            class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
            @click="setSort('status')"
          >
            Status <span class="ml-1 opacity-60">{{ sortIcon('status') }}</span>
          </th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Features
          </th>
          <th
            class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
            @click="setSort('steps')"
          >
            Steps <span class="ml-1 opacity-60">{{ sortIcon('steps') }}</span>
          </th>
          <th
            class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
            @click="setSort('created')"
          >
            Created <span class="ml-1 opacity-60">{{ sortIcon('created') }}</span>
          </th>
          <th
            class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200"
            @click="setSort('days')"
          >
            Days <span class="ml-1 opacity-60">{{ sortIcon('days') }}</span>
          </th>
        </tr>
      </thead>
      <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <template v-for="component in componentList" :key="component.key">
          <!-- Main row -->
          <tr
            class="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
            :class="{ 'bg-blue-50 dark:bg-blue-900/20': selectedKey === component.key }"
            @click="selectRow(component.key)"
          >
            <td class="px-4 py-3 font-mono text-xs">
              <a
                :href="`${jiraHost}/browse/${component.key}`"
                target="_blank"
                rel="noopener"
                class="text-blue-600 dark:text-blue-400 hover:underline"
                @click.stop
              >{{ component.key }}</a>
            </td>
            <td class="px-4 py-3">
              <span class="font-medium text-gray-900 dark:text-gray-100">{{ component.componentName || component.summary }}</span>
              <p v-if="component.componentName" class="text-xs text-gray-400 dark:text-gray-500 truncate max-w-xs">{{ component.summary }}</p>
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                :class="component.productContext === 'RHOAI'
                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'"
              >{{ component.productContext }}</span>
            </td>
            <td class="px-4 py-3">
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                :class="component.completionStatus === 'completed'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'"
              >
                <span class="h-1.5 w-1.5 rounded-full"
                  :class="component.completionStatus === 'completed' ? 'bg-green-500' : 'bg-amber-500'"
                />
                {{ component.completionStatus === 'completed' ? 'Completed' : 'In Progress' }}
              </span>
            </td>
            <td class="px-4 py-3">
              <div class="flex flex-wrap gap-1">
                <template v-for="feat in (component.linkedFeatures || [])" :key="feat">
                  <a
                    v-if="releasesAvailable"
                    :href="linkTo('releases', 'feature-detail', { key: feat })"
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                    :title="featureTitles[feat] || feat"
                    @click.stop
                  >{{ feat }}</a>
                  <span
                    v-else
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                    :title="featureTitles[feat] || feat"
                  >{{ feat }}</span>
                </template>
                <span v-if="!component.linkedFeatures?.length" class="text-xs text-gray-400">—</span>
              </div>
            </td>
            <td class="px-4 py-3">
              <div class="flex gap-0.5 flex-wrap">
                <span
                  v-for="step in STEPS"
                  :key="step.key"
                  class="h-2.5 w-2.5 rounded-sm"
                  :class="component.onboardingSteps?.[step.key]
                    ? 'bg-green-500'
                    : 'bg-gray-200 dark:bg-gray-700'"
                  :title="`${step.title}: ${component.onboardingSteps?.[step.key] ? 'done' : 'pending'}`"
                />
              </div>
              <span class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 block">
                {{ stepsDone(component) }}/{{ STEPS.length }}
              </span>
            </td>
            <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{{ formatDate(component.created) }}</td>
            <td class="px-4 py-3 text-xs" :title="component.validationDate ? 'From validation to close' : 'From creation to close (no validation date)'">
              <span v-if="component.completionStatus === 'completed'" class="font-medium text-gray-700 dark:text-gray-300">
                {{ onboardingDays(component) ?? '—' }}d
              </span>
              <span v-else class="text-gray-400 dark:text-gray-500">
                {{ onboardingDays(component) ?? '—' }}d+
              </span>
            </td>
          </tr>

          <!-- Expanded detail row -->
          <tr v-if="selectedKey === component.key" class="bg-gray-50 dark:bg-gray-800/50">
            <td colspan="8" class="px-6 py-5">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">

                <!-- Repo & metadata -->
                <div class="space-y-2">
                  <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Component Info</p>
                  <div class="space-y-1 text-xs">
                    <div class="flex gap-2">
                      <span class="text-gray-400 w-20 flex-shrink-0">Product</span>
                      <span class="font-medium"
                        :class="component.productContext === 'RHOAI'
                          ? 'text-red-700 dark:text-red-300'
                          : 'text-blue-700 dark:text-blue-300'"
                      >{{ component.productContext }}</span>
                    </div>
                    <div v-if="component.isOperator || detailCache[component.key]?.latest?.isOperator" class="flex gap-2">
                      <span class="text-gray-400 w-20 flex-shrink-0">Type</span>
                      <span class="text-purple-700 dark:text-purple-300 font-medium">Operator</span>
                    </div>
                    <div v-if="component.repoUrl || detailCache[component.key]?.latest?.repoUrl" class="flex gap-2">
                      <span class="text-gray-400 w-20 flex-shrink-0">Repo</span>
                      <a
                        :href="component.repoUrl || detailCache[component.key]?.latest?.repoUrl"
                        target="_blank" rel="noopener"
                        class="text-blue-600 dark:text-blue-400 hover:underline break-all"
                      >{{ component.repoUrl || detailCache[component.key]?.latest?.repoUrl }}</a>
                    </div>
                    <div v-if="component.branch || detailCache[component.key]?.latest?.branch" class="flex gap-2">
                      <span class="text-gray-400 w-20 flex-shrink-0">Branch</span>
                      <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">{{ component.branch || detailCache[component.key]?.latest?.branch }}</code>
                    </div>
                    <div v-if="component.dockerfilePath || detailCache[component.key]?.latest?.dockerfilePath" class="flex gap-2">
                      <span class="text-gray-400 w-20 flex-shrink-0">Dockerfile</span>
                      <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs break-all">{{ component.dockerfilePath || detailCache[component.key]?.latest?.dockerfilePath }}</code>
                    </div>
                    <div v-if="component.contextPath || detailCache[component.key]?.latest?.contextPath" class="flex gap-2">
                      <span class="text-gray-400 w-20 flex-shrink-0">Context</span>
                      <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs break-all">{{ component.contextPath || detailCache[component.key]?.latest?.contextPath }}</code>
                    </div>
                  </div>
                </div>

                <!-- Pipeline steps with product indicators -->
                <div class="space-y-2">
                  <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pipeline Steps</p>
                  <div class="grid grid-cols-1 gap-y-1">
                    <div v-for="step in STEPS" :key="step.key" class="flex items-center gap-2 text-xs">
                      <span
                        class="h-2 w-2 rounded-full flex-shrink-0"
                        :class="component.onboardingSteps?.[step.key] ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'"
                      />
                      <span :class="component.onboardingSteps?.[step.key] ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'">
                        {{ step.title }}
                      </span>
                      <span class="text-xs ml-auto" :class="PRODUCT_STEP_CLASSES[step.product]">
                        {{ step.product === 'both' ? '' : step.product === 'operator' ? 'if operator' : step.product.toUpperCase() }}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- History -->
                <div v-if="detailCache[component.key]?.history?.length" class="space-y-2">
                  <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">History</p>
                  <div class="space-y-2 max-h-48 overflow-y-auto">
                    <div
                      v-for="h in detailCache[component.key].history"
                      :key="h.syncedAt"
                      class="text-xs"
                    >
                      <div class="flex items-center gap-2">
                        <span class="text-gray-400 dark:text-gray-500">{{ new Date(h.syncedAt).toLocaleDateString() }}</span>
                        <span
                          class="px-1.5 py-0.5 rounded-full"
                          :class="h.completionStatus === 'completed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'"
                        >{{ h.completionStatus }}</span>
                        <span class="text-gray-400">{{ Object.values(h.onboardingSteps || {}).filter(Boolean).length }}/{{ STEPS.length }} steps</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Jira labels -->
                <div v-if="component.labels?.length" class="space-y-2 md:col-span-2 lg:col-span-1">
                  <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Jira Labels</p>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="label in component.labels.filter(l => l !== 'component-onboarding')"
                      :key="label"
                      class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 font-mono"
                    >{{ label }}</span>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>

    <div v-if="!componentList.length" class="py-16 text-center text-gray-400 dark:text-gray-500">
      <svg class="h-10 w-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      No components match the current filters.
    </div>
  </div>
</template>
