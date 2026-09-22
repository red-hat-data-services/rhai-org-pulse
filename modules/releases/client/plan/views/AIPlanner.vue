<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { useDraftPlans } from '../composables/useDraftPlans'

const { approveFeature, persist, filterDecision } = useDraftPlans()
const moduleNav = inject('moduleNav', null)

const loading = ref(true)
const error = ref(null)
const snapshot = ref(null)
const searchQuery = ref('')
const selectedPlan = ref('3.6 GA')
const currentPage = ref(1)
const PAGE_SIZE = 50

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

function addToDraftPlan(feature) {
  const result = approveFeature(feature.Key, true)
  if (result && result.ok) {
    persist()
    filterDecision.value = 'approved'
    if (moduleNav && moduleNav.updateParams) {
      moduleNav.updateParams({ tab: 'draft-plans' }, { push: false })
    }
  }
}

onMounted(async () => {
  try {
    snapshot.value = await apiRequest('/modules/releases/planning/ai-planner')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
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
      <!-- Bug Queue Panel -->
      <div v-if="snapshot.bugQueue && snapshot.bugQueue.length" class="px-6 py-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
        <h2 class="text-sm font-semibold text-red-900 dark:text-red-300 mb-2">🚨 Bug Queue (Top 6)</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <div v-for="b in snapshot.bugQueue.slice(0, 6)" :key="b.component" class="text-xs">
            <div class="font-mono font-bold">{{ getSeverityIcon(b.component) }} {{ b.component }}</div>
            <div class="text-red-700 dark:text-red-300">🔴 {{ b.blocker }} blocker</div>
            <div class="text-orange-700 dark:text-orange-300">🟠 {{ b.critical }} critical</div>
          </div>
        </div>
      </div>

      <!-- Filters -->
      <div class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex gap-4 items-center">
        <div class="flex gap-2 items-center">
          <label for="plan-select" class="text-sm font-medium dark:text-gray-300">Plan:</label>
          <select v-model="selectedPlan" class="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 text-sm">
            <option>3.6 GA</option>
            <option>3.7 EA1</option>
            <option>3.7 GA</option>
            <option>3.8 EA1</option>
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
                  <span v-for="c in f.Components" :key="c" class="inline-block px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 text-xs">
                    {{ getSeverityIcon(c) }}
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
              <td class="px-4 py-2 text-center text-xs dark:text-gray-300">{{ f.XTeam === 'yes' ? '✓ Yes' : '✓ No' }}</td>
              <td class="px-4 py-2 text-center">
                <button @click="addToDraftPlan(f)" class="px-2 py-1 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white">Add</button>
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
