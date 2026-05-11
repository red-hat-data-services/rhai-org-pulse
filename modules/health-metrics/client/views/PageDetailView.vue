<template>
  <div class="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
    <div class="flex items-center gap-3">
      <button
        @click="moduleNav.goBack()"
        class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        &larr; Back to Dashboard
      </button>
    </div>

    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
      {{ formatPageId(pageId) }}
    </h1>

    <div v-if="loading" class="text-center py-12 text-gray-500 dark:text-gray-400">
      Loading page details...
    </div>

    <template v-else-if="pageData">
      <!-- Summary cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Views</div>
          <div class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{{ pageData.views.toLocaleString() }}</div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div class="text-sm font-medium text-gray-500 dark:text-gray-400">Unique Users</div>
          <div class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{{ pageData.uniqueUsers }}</div>
        </div>
      </div>

      <!-- Daily trend -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Daily Views</h2>
        <UsageTrendChart :daily="pageData.daily || {}" />
      </div>

      <!-- User type breakdown -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">User Type Breakdown</h2>
        <UserTypeBreakdown :user-types="pageData.byUserType || {}" />
      </div>

      <!-- Permission tier breakdown -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Permission Tier Breakdown</h2>
        <div class="space-y-2">
          <div
            v-for="(count, tier) in pageData.byPermissionTier"
            :key="tier"
            class="flex items-center justify-between py-1"
          >
            <span class="text-sm text-gray-600 dark:text-gray-300 capitalize">{{ tier }}</span>
            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ count }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, inject, computed } from 'vue'
import { useMetricsDashboard } from '../composables/useMetricsDashboard.js'
import UsageTrendChart from '../components/UsageTrendChart.vue'
import UserTypeBreakdown from '../components/UserTypeBreakdown.vue'

const moduleNav = inject('moduleNav')
const params = moduleNav.params

const pageId = computed(() => params.value?.pageId || '')
const pageData = ref(null)
const loading = ref(false)

const { fetchPageDetail } = useMetricsDashboard()

function formatPageId(id) {
  const [mod, view] = (id || '').split('::')
  return mod && view ? `${mod} / ${view}` : id
}

onMounted(async () => {
  if (!pageId.value) return
  loading.value = true
  pageData.value = await fetchPageDetail(pageId.value)
  loading.value = false
})
</script>
