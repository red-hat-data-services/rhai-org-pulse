<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import ImpactFeasibilityChart from '../components/ImpactFeasibilityChart.vue'
import ReportHighlightCards from '../components/ReportHighlightCards.vue'
import CategoryDonutChart from '../components/CategoryDonutChart.vue'
import SourceBarChart from '../components/SourceBarChart.vue'
import LanguageBarChart from '../components/LanguageBarChart.vue'

const nav = inject('moduleNav')
const MODULE_API = '/modules/ai-catalyst'

const boards = ref([])
const selectedMonth = ref('')
const candidates = ref([])
const loading = ref(true)
const error = ref(null)

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
    const data = await apiRequest(`${MODULE_API}/boards/${selectedMonth.value}`)
    candidates.value = data.candidates || []
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

watch(selectedMonth, loadCandidates)

onMounted(async () => {
  await loadBoards()
  if (selectedMonth.value) await loadCandidates()
})

const _monthLabel = computed(() => {
  if (!selectedMonth.value) return ''
  const [y, m] = selectedMonth.value.split('-')
  const date = new Date(Number(y), Number(m) - 1)
  return date.toLocaleString('default', { month: 'long', year: 'numeric' })
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Monthly Report</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">Visual overview of AI/ML candidate evaluation</p>
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

    <!-- Loading -->
    <div v-if="loading" class="space-y-4">
      <div class="bg-gray-100 dark:bg-gray-800 rounded-lg h-96 animate-pulse"></div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="bg-gray-100 dark:bg-gray-800 rounded-lg h-24 animate-pulse"></div>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="!candidates.length" class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">No candidates for this month</p>
    </div>

    <!-- Report content -->
    <template v-else>
      <ImpactFeasibilityChart
        :candidates="candidates"
        @select="onSelectCandidate"
      />

      <ReportHighlightCards
        :candidates="candidates"
        @select="onSelectCandidate"
      />

      <!-- Distribution charts -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CategoryDonutChart :candidates="candidates" />
        <SourceBarChart :candidates="candidates" />
        <LanguageBarChart :candidates="candidates" />
      </div>
    </template>
  </div>
</template>
