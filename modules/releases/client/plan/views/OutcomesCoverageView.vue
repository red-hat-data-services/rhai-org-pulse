<script setup>
import { ref, computed, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import Toast from '@shared/client/components/Toast.vue'

const outcomes = ref([])
const loading = ref(false)
const error = ref(null)
const selectedVersion = ref('')
const toastMessage = ref('')
const toastType = ref('success')
const showToast = ref(false)

const availableVersions = computed(() => {
  const versions = new Set()
  outcomes.value.forEach(outcome => {
    if (outcome.linkedVersions) {
      outcome.linkedVersions.forEach(v => versions.add(v))
    }
  })
  return Array.from(versions).sort()
})

const filteredOutcomes = computed(() => {
  if (!selectedVersion.value) return outcomes.value
  return outcomes.value.filter(outcome =>
    outcome.linkedVersions && outcome.linkedVersions.includes(selectedVersion.value)
  )
})

function formatVersions(versions) {
  if (!versions || versions.length === 0) return '—'
  return versions.join(', ')
}

function getConfidenceColor(confidence) {
  if (confidence >= 80) return 'text-green-600 dark:text-green-400'
  if (confidence >= 60) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function getStatusColor(status) {
  if (status === 'Confident') return 'text-green-600 dark:text-green-400'
  if (status === 'Lagging') return 'text-amber-600 dark:text-amber-400'
  return 'text-gray-500 dark:text-gray-400'
}

function getCompletionBarColor(percentComplete) {
  if (percentComplete >= 75) return 'bg-green-500'
  if (percentComplete >= 50) return 'bg-yellow-500'
  return 'bg-orange-500'
}

async function loadOutcomes() {
  loading.value = true
  error.value = null
  try {
    const response = await apiRequest('/modules/releases/planning/ai-planner/outcomes')
    outcomes.value = response.outcomes || []
  } catch (err) {
    error.value = `Failed to load outcomes: ${err.message}`
    toastMessage.value = error.value
    toastType.value = 'error'
    showToast.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadOutcomes()
})
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Outcomes Coverage</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">12 priority outcomes with feature coverage and linked versions</p>
      </div>
      <div class="flex items-center gap-3">
        <label v-if="availableVersions.length > 0" class="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          Filter by Version
          <select
            v-model="selectedVersion"
            class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          >
            <option value="">All versions</option>
            <option v-for="version in availableVersions" :key="version" :value="version">
              {{ version }}
            </option>
          </select>
        </label>
        <button
          @click="loadOutcomes"
          :disabled="loading"
          class="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          {{ loading ? 'Loading...' : 'Refresh' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="rounded-lg border border-red-300 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400">
      {{ error }}
    </div>

    <div v-if="loading && !outcomes.length" class="text-center py-12 text-gray-500 dark:text-gray-400">
      Loading outcomes...
    </div>

    <div v-else-if="filteredOutcomes.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
      {{ selectedVersion ? 'No outcomes found for this version' : 'No outcomes available' }}
    </div>

    <div v-else class="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900">
      <table class="w-full text-xs">
        <thead class="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th class="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap uppercase tracking-wide">Outcome</th>
            <th class="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap uppercase tracking-wide">In Plan</th>
            <th class="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap uppercase tracking-wide">% Complete</th>
            <th class="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap uppercase tracking-wide">Confidence</th>
            <th class="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap uppercase tracking-wide">Status</th>
            <th class="px-3 py-2 text-left font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap uppercase tracking-wide">Linked Versions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
          <tr
            v-for="outcome in filteredOutcomes"
            :key="outcome.key"
            class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <td class="px-3 py-2 text-gray-900 dark:text-gray-100">
              <a
                :href="`https://issues.redhat.com/browse/${outcome.key}`"
                target="_blank"
                rel="noopener noreferrer"
                class="font-semibold text-primary-600 dark:text-primary-400 hover:underline"
              >
                {{ outcome.key }}
              </a>
              <div class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                {{ outcome.title }}
              </div>
            </td>
            <td class="px-3 py-2 text-center text-gray-900 dark:text-gray-100 font-semibold">
              {{ outcome.inPlan }}/{{ outcome.total }}
            </td>
            <td class="px-3 py-2 text-center">
              <div class="flex items-center justify-center gap-1">
                <div class="w-16 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    :class="getCompletionBarColor(outcome.percentComplete)"
                    :style="{ width: outcome.percentComplete + '%' }"
                    class="h-full transition-all"
                  />
                </div>
                <span class="font-semibold text-gray-900 dark:text-gray-100 tabular-nums w-8 text-right">
                  {{ outcome.percentComplete }}%
                </span>
              </div>
            </td>
            <td class="px-3 py-2 text-center">
              <span :class="getConfidenceColor(outcome.confidence)" class="font-semibold">
                {{ outcome.confidence }}%
              </span>
            </td>
            <td class="px-3 py-2 text-center">
              <span :class="getStatusColor(outcome.status)" class="font-medium text-xs">
                {{ outcome.status }}
              </span>
            </td>
            <td class="px-3 py-2 text-gray-700 dark:text-gray-300 font-medium">
              <span v-if="outcome.linkedVersions && outcome.linkedVersions.length > 0">
                {{ formatVersions(outcome.linkedVersions) }}
              </span>
              <span v-else class="text-gray-400">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Toast
      v-if="showToast"
      :message="toastMessage"
      :type="toastType"
      @close="showToast = false"
    />
  </div>
</template>
