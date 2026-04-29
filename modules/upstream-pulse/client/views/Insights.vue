<template>
  <div>
    <StickyPageHeader
      v-model="selectedDays"
      title="Insights"
      subtitle="Trends and impact analysis for your team's upstream presence"
      :loading="loading"
    />

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-8">
      <ChartSkeleton height="h-72" />
      <ChartSkeleton height="h-64" />
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6">
        <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-6 w-48 mb-3"></div>
        <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-4 w-full mb-2"></div>
        <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-4 w-3/4"></div>
      </div>
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
import { ChartSkeleton } from '../components/SkeletonLoaders.vue'
import ContributionTrendChart from '../components/ContributionTrendChart.vue'
import ContributionMixChart from '../components/ContributionMixChart.vue'
import ImpactBanner from '../components/ImpactBanner.vue'
import StickyPageHeader from '../components/StickyPageHeader.vue'

const MODULE_API = '/modules/upstream-pulse'

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
