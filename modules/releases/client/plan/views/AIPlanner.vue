<script setup>
import { ref, computed, inject, watch, onMounted, onBeforeUnmount } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { useDraftPlans } from '../composables/useDraftPlans'

const {
  draft,
  selectedVersion,
  filterEvent,
  loadCycles,
  loadEditor,
  approveFeature,
  persist
} = useDraftPlans()
const moduleNav = inject('moduleNav', null)

const iframeRef = ref(null)
const DEMO_URL = '/ai-first-scheduler/index.html'

const loading = ref(true)
const error = ref(null)
const actionError = ref(null)
const snapshot = ref(null)
const searchQuery = ref('')
const selectedPlan = ref('3.6 GA')
const currentPage = ref(1)
const PAGE_SIZE = 50
const selectedBugComponent = ref(null)
const showBugModal = ref(false)

const bugComponentMap = computed(() => {
  const map = {}
  if (snapshot.value && snapshot.value.bugQueue) {
    snapshot.value.bugQueue.forEach(b => {
      map[b.component] = { blocker: b.blocker, critical: b.critical, total: b.total }
    })
  }
  return map
})

const plannedFeatures = computed(() => {
  if (!snapshot.value || !snapshot.value.features) return []
  return snapshot.value.features.filter(f => f.PlannedFor === selectedPlan.value)
})

const filteredFeatures = computed(() => {
  const q = searchQuery.value.toLowerCase()
  return plannedFeatures.value.filter(f => {
    return !q || f.Key.toLowerCase().includes(q) || f.Summary.toLowerCase().includes(q)
  })
})

watch([selectedPlan, searchQuery], () => { currentPage.value = 1 })

const totalPages = computed(() => Math.ceil(filteredFeatures.value.length / PAGE_SIZE))
const pagedFeatures = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredFeatures.value.slice(start, start + PAGE_SIZE)
})

function getSeverityIcon(component) {
  const bugs = bugComponentMap.value[component]
  if (!bugs) return '⚪'
  const urgent = bugs.blocker + bugs.critical
  if (urgent >= 10) return '🔴'
  if (urgent >= 5) return '🟠'
  return '🟡'
}

function getConfidenceBg(confidence) {
  const map = {
    'ready': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    'likely': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    'likely-plus': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    'not-ready': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
  }
  return map[confidence] || 'bg-gray-100 dark:bg-gray-700'
}

async function ensureDraftPlanLoaded() {
  if (draft.value && draft.value.version === selectedVersion.value) return true

  try {
    await loadCycles('RHOAI')
    await loadEditor(selectedVersion.value)
  } catch {
    return false
  }

  return !!draft.value
}

async function addToDraftPlan(feature) {
  actionError.value = null

  if (!await ensureDraftPlanLoaded()) {
    actionError.value = 'Plan Approval data is unavailable. Please try again.'
    return
  }

  const result = approveFeature(feature.Key, true)
  if (!result || !result.ok) {
    actionError.value = 'Feature is not available in the current Plan Approval candidate set.'
    return
  }

  try {
    await persist()
    filterEvent.value = '__approved__'
    if (moduleNav && moduleNav.updateParams) {
      moduleNav.updateParams({ tab: 'draft-plans' }, { push: false })
    }
  } catch (e) {
    actionError.value = 'Failed to save draft plan: ' + e.message
  }
}

function showBugBreakdown(component) {
  selectedBugComponent.value = component
  showBugModal.value = true
}

const featuresInComponent = computed(() => {
  if (!selectedBugComponent.value || !snapshot.value?.features) return []
  return snapshot.value.features.filter(f =>
    (f.Components || []).includes(selectedBugComponent.value)
  ).slice(0, 10)
})

function sendDataToIframe() {
  const iframe = iframeRef.value
  if (iframe && iframe.contentWindow && snapshot.value) {
    // `snapshot` is wrapped by Vue's ref and nested values may be reactive
    // proxies. The structured-clone algorithm used by postMessage rejects
    // those proxies, so send a plain JSON-compatible snapshot to the iframe.
    const cloneForIframe = (value, fallback) => {
      try {
        return JSON.parse(JSON.stringify(value ?? fallback))
      } catch {
        return fallback
      }
    }
    iframe.contentWindow.postMessage({
      type: 'ai-planner-data',
      features: cloneForIframe(snapshot.value.features, []),
      bugQueue: cloneForIframe(snapshot.value.bugQueue, []),
      capacity: cloneForIframe(snapshot.value.capacity, {}),
      cveReserve: cloneForIframe(snapshot.value.cveReserve, {}),
      lastSyncedAt: snapshot.value.lastSyncedAt || new Date().toISOString()
    }, window.location.origin)
  }
}

async function handleIframeMessage(e) {
  if (e.origin !== window.location.origin) return
  if (e.data?.type === 'add-to-draft-plan' && e.data?.features) {
    actionError.value = null
    if (!await ensureDraftPlanLoaded()) {
      actionError.value = 'Plan Approval data is unavailable. Please try again.'
      return
    }
    const features = e.data.features
    const failedFeatures = []
    features.forEach(f => {
      const result = approveFeature(f.key, true)
      if (!result || !result.ok) failedFeatures.push(f.key)
    })
    if (failedFeatures.length) {
      actionError.value = 'Some selected features are not available in the current Plan Approval candidate set.'
      return
    }
    try {
      await persist()
      filterEvent.value = '__approved__'
      if (moduleNav && moduleNav.updateParams) {
        moduleNav.updateParams({ tab: 'draft-plans' }, { push: false })
      }
    } catch (err) {
      actionError.value = 'Failed to save draft plan: ' + err.message
    }
  }
}

onMounted(async () => {
  window.addEventListener('message', handleIframeMessage)
  try {
    snapshot.value = await apiRequest('/modules/releases/planning/ai-planner')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleIframeMessage)
})
</script>

<template>
  <!-- IFRAME MODE: Shows complete demo with live data from backend -->
  <div v-if="!loading && !error" class="h-full w-full bg-gray-50 dark:bg-gray-900">
    <iframe
      ref="iframeRef"
      :src="DEMO_URL"
      class="w-full h-full border-none rounded"
      title="AI-First Release Planner"
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      @load="sendDataToIframe"
    />
  </div>

  <!-- FALLBACK: Show loading/error while iframe starts -->
  <div v-else class="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
    <!-- Header -->
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <h1 class="text-xl font-semibold dark:text-gray-100">AI-First Release Planner</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ snapshot?.featureCount || 0 }} features · Last updated {{ snapshot?.lastSyncedAt?.split('T')[0] }}</p>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <p class="text-gray-500 dark:text-gray-400">Loading planner data...</p>
    </div>

    <div v-else-if="error" class="flex-1 flex items-center justify-center">
      <p class="text-red-600 dark:text-red-400">Error loading planner: {{ error }}</p>
    </div>

    <div v-else class="flex-1 overflow-y-auto">
      <div
        v-if="actionError"
        role="alert"
        class="mx-6 mt-4 rounded-lg border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400"
      >
        {{ actionError }}
      </div>

      <!-- Bug Queue Panel -->
      <div v-if="snapshot.bugQueue && snapshot.bugQueue.length" class="px-6 py-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
        <h2 class="text-sm font-semibold text-red-900 dark:text-red-300 mb-2">🚨 Bug Queue (Top 6)</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <div v-for="b in snapshot.bugQueue.slice(0, 6)" :key="b.component"
            @click="showBugBreakdown(b.component)"
            class="cursor-pointer p-3 bg-white rounded-lg border border-red-300 hover:shadow-md transition-all hover:scale-105 text-xs">
            <div class="font-mono font-bold">{{ getSeverityIcon(b.component) }} {{ b.component }}</div>
            <div class="text-red-700 dark:text-red-300">🔴 {{ b.blocker }} blocker</div>
            <div class="text-orange-700 dark:text-orange-300">🟠 {{ b.critical }} critical</div>
            <div class="text-gray-500 text-xs mt-2">click for details →</div>
          </div>
        </div>
      </div>

      <!-- Bug Detail Modal -->
      <div v-if="showBugModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showBugModal = false">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg max-h-[80vh] overflow-y-auto shadow-xl">
          <h3 class="text-lg font-bold mb-4 text-gray-900 dark:text-gray-100">{{ selectedBugComponent }}</h3>
          <div v-if="selectedBugComponent && snapshot.bugQueue" class="mb-4">
            <div class="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg">
              <div class="text-sm mb-2"><span class="font-bold">🔴 Blocker:</span> {{ snapshot.bugQueue.find(b => b.component === selectedBugComponent)?.blocker || 0 }} issues</div>
              <div class="text-sm mb-2"><span class="font-bold">🟠 Critical:</span> {{ snapshot.bugQueue.find(b => b.component === selectedBugComponent)?.critical || 0 }} issues</div>
              <div class="text-sm"><span class="font-bold">📊 Total:</span> {{ snapshot.bugQueue.find(b => b.component === selectedBugComponent)?.total || 0 }} issues</div>
            </div>
          </div>

          <div class="mb-4">
            <div class="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">Features in this component:</div>
            <div class="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded p-2 bg-gray-50 dark:bg-gray-900">
              <div v-if="featuresInComponent.length === 0" class="text-xs text-gray-500">No features found</div>
              <div v-for="f in featuresInComponent" :key="f.Key" class="mb-2 text-xs">
                <a :href="`https://redhat.atlassian.net/browse/${f.Key}`" target="_blank" class="text-blue-600 dark:text-blue-400 font-semibold hover:underline">{{ f.Key }}</a>
                <div class="text-gray-600 dark:text-gray-400 text-xs">{{ (f.Summary || f.Title || '').slice(0, 50) }}{{ (f.Summary || f.Title || '').length > 50 ? '...' : '' }}</div>
              </div>
            </div>
          </div>

          <div class="text-xs text-gray-600 dark:text-gray-400 mb-4 p-2 bg-gray-100 dark:bg-gray-700 rounded">
            <strong>Impact:</strong> Features lose confidence due to bug load.<br>
            <strong>Action:</strong> Prioritize bug fixes or add team capacity.
          </div>

          <button @click="showBugModal = false" class="w-full py-2 bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded font-semibold hover:bg-gray-300 dark:hover:bg-gray-500">Close</button>
        </div>
      </div>

      <!-- Filters -->
      <div class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex gap-4 items-center">
        <div class="flex gap-2 items-center">
          <label for="plan-select" class="text-sm font-medium dark:text-gray-300">Plan:</label>
          <select id="plan-select" v-model="selectedPlan" class="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 text-sm">
            <option>3.6 GA</option>
            <option>3.7 EA</option>
            <option>3.7 GA</option>
            <option>3.8 EA</option>
          </select>
        </div>
        <div class="flex-1 relative">
          <input v-model="searchQuery" type="text" placeholder="Search by Key or Summary..." class="w-full px-3 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 text-sm" />
        </div>
        <div class="text-xs text-gray-500 dark:text-gray-400">{{ filteredFeatures.length }} features</div>
      </div>

      <!-- Features Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead class="bg-gray-100 dark:bg-gray-800 sticky top-0">
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Key</th>
              <th class="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400">Summary</th>
              <th class="px-4 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400">Components</th>
              <th class="px-4 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-400">RICE</th>
              <th class="px-4 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400">FPDoR</th>
              <th class="px-4 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400">Confidence</th>
              <th class="px-4 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400">X-Team</th>
              <th class="px-4 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in pagedFeatures" :key="f.Key" class="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
              <td class="px-4 py-2 font-mono text-xs text-blue-600 dark:text-blue-400">{{ f.Key }}</td>
              <td class="px-4 py-2 text-xs dark:text-gray-300">{{ f.Summary }}</td>
              <td class="px-4 py-2 text-xs dark:text-gray-400">
                <div class="flex flex-wrap gap-1">
                  <span v-for="c in f.Components" :key="c" class="inline-block px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 text-xs" :title="c">
                    {{ getSeverityIcon(c) }} {{ c }}
                  </span>
                </div>
              </td>
              <td class="px-4 py-2 text-right text-xs dark:text-gray-300">{{ f.RICE }}</td>
              <td class="px-4 py-2 text-center text-xs dark:text-gray-300">{{ f.FPDoR }}</td>
              <td class="px-4 py-2 text-center">
                <span class="inline-block px-2 py-1 rounded text-xs font-medium" :class="getConfidenceBg(f.Confidence)">
                  {{ f.Confidence }}
                </span>
              </td>
              <td class="px-4 py-2 text-center text-xs dark:text-gray-300">{{ f.XTeam === 'yes' ? '✓ Yes' : '— No' }}</td>
              <td class="px-4 py-2 text-center">
                <button @click="addToDraftPlan(f)" class="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white">Add to Plan</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between">
        <span class="text-xs text-gray-600 dark:text-gray-400">Page {{ currentPage }} of {{ totalPages }}</span>
        <div class="flex gap-2">
          <button @click="currentPage = Math.max(1, currentPage - 1)" :disabled="currentPage === 1" class="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700">Prev</button>
          <button @click="currentPage = Math.min(totalPages, currentPage + 1)" :disabled="currentPage === totalPages" class="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 text-xs disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700">Next</button>
        </div>
      </div>
    </div>
  </div>
</template>
