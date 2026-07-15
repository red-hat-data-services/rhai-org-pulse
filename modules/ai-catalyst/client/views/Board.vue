<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import BoardFilters from '../components/BoardFilters.vue'
import CandidateCard from '../components/CandidateCard.vue'

const nav = inject('moduleNav')
const MODULE_API = '/modules/ai-catalyst'

const boards = ref([])
const selectedMonth = ref('')
const candidates = ref([])
const totalCount = ref(0)
const loading = ref(true)
const error = ref(null)

const selectedCategory = ref('')
const selectedStatus = ref('')
const selectedSource = ref('')
const selectedSort = ref('impact')

async function loadBoards() {
  try {
    const data = await apiRequest(`${MODULE_API}/boards`)
    boards.value = data.boards || []
    if (boards.value.length && !selectedMonth.value) {
      selectedMonth.value = boards.value[0].month
    }
  } catch (err) {
    error.value = err.message || 'Failed to load boards'
  }
}

async function loadCandidates() {
  if (!selectedMonth.value) return
  loading.value = true
  error.value = null
  try {
    const params = new URLSearchParams()
    if (selectedCategory.value) params.set('category', selectedCategory.value)
    if (selectedStatus.value) params.set('status', selectedStatus.value)
    if (selectedSource.value) params.set('source', selectedSource.value)
    if (selectedSort.value) params.set('sort', selectedSort.value)
    const qs = params.toString()
    const data = await apiRequest(`${MODULE_API}/boards/${selectedMonth.value}${qs ? '?' + qs : ''}`)
    candidates.value = data.candidates || []
    totalCount.value = data.total || 0
  } catch (err) {
    error.value = err.message || 'Failed to load candidates'
    candidates.value = []
  } finally {
    loading.value = false
  }
}

function onSelectCandidate(candidate) {
  nav.navigateTo('candidate-detail', { id: candidate.uniqueId, month: selectedMonth.value })
}

watch([selectedMonth, selectedCategory, selectedStatus, selectedSource, selectedSort], loadCandidates)

onMounted(async () => {
  await loadBoards()
  if (selectedMonth.value) await loadCandidates()
})

const monthLabel = computed(() => {
  if (!selectedMonth.value) return ''
  const [y, m] = selectedMonth.value.split('-')
  const date = new Date(Number(y), Number(m) - 1)
  return date.toLocaleString('default', { month: 'long', year: 'numeric' })
})

const summaryText = computed(() => {
  if (!candidates.value.length && !loading.value) return 'No candidates match filters'
  const parts = []
  if (candidates.value.length !== totalCount.value) {
    parts.push(`${candidates.value.length} of ${totalCount.value} candidates`)
  } else {
    parts.push(`${totalCount.value} candidates`)
  }
  return parts.join(' ')
})
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Monthly Board</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">AI/ML open-source candidates from the POC Explorer pipeline</p>
      </div>

      <select
        v-if="boards.length"
        v-model="selectedMonth"
        class="text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1.5 text-gray-700 dark:text-gray-300"
      >
        <option v-for="b in boards" :key="b.month" :value="b.month">
          {{ b.month }} ({{ b.candidateCount }})
        </option>
      </select>
    </div>

    <!-- Filters -->
    <BoardFilters
      v-model:selected-category="selectedCategory"
      v-model:selected-status="selectedStatus"
      v-model:selected-source="selectedSource"
      v-model:selected-sort="selectedSort"
    />

    <!-- Summary -->
    <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
      <span>{{ summaryText }}</span>
      <span v-if="monthLabel">{{ monthLabel }}</span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 6" :key="i" class="bg-gray-100 dark:bg-gray-800 rounded-lg h-40 animate-pulse"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="!candidates.length" class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">No candidates found</p>
      <p v-if="selectedCategory || selectedStatus || selectedSource" class="text-sm text-gray-400 dark:text-gray-500 mt-1">Try adjusting your filters</p>
    </div>

    <!-- Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <CandidateCard
        v-for="candidate in candidates"
        :key="candidate.uniqueId || candidate.link"
        :candidate="candidate"
        @select="onSelectCandidate"
      />
    </div>
  </div>
</template>
