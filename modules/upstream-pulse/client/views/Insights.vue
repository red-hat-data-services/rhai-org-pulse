<template>
  <div>
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Insights</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Trends and impact analysis for your team's upstream presence</p>
      </div>
      <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        <button
          v-for="opt in periodOptions"
          :key="opt.value"
          @click="selectedDays = opt.value"
          class="px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200"
          :class="selectedDays === opt.value
            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-24">
      <div class="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 dark:border-gray-700 border-t-primary-600 mb-4"></div>
      <p class="text-sm text-gray-500 dark:text-gray-400">Loading insights...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">Error loading insights</h3>
      <p class="text-sm text-red-700 dark:text-red-400">{{ error }}</p>
    </div>

    <!-- Content -->
    <template v-else-if="dashboard">
      <!-- Contribution Trend -->
      <section class="mb-8">
        <ContributionTrendChart
          :daily-breakdown="dashboard.dailyBreakdown || []"
          title="Contribution Trend"
          :height="320"
        />
      </section>

      <!-- Contribution Mix -->
      <section class="mb-8">
        <ContributionMixChart :contributions="dashboard.contributions" />
      </section>

      <!-- Impact Banner -->
      <section>
        <ImpactBanner :contributions="dashboard.contributions" />
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import ContributionTrendChart from '../components/ContributionTrendChart.vue'
import ContributionMixChart from '../components/ContributionMixChart.vue'
import ImpactBanner from '../components/ImpactBanner.vue'

const MODULE_API = '/modules/upstream-pulse'

const periodOptions = [
  { label: '30d', value: '30' },
  { label: '60d', value: '60' },
  { label: '90d', value: '90' },
  { label: 'All', value: '0' },
]

const selectedDays = ref('30')
const loading = ref(true)
const error = ref(null)
const dashboard = ref(null)

async function loadData() {
  loading.value = true
  error.value = null
  try {
    dashboard.value = await apiRequest(`${MODULE_API}/dashboard?days=${selectedDays.value}`)
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

watch(selectedDays, () => loadData())
onMounted(() => loadData())
</script>
