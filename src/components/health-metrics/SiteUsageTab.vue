<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Site Usage</h2>
      <div class="flex items-center gap-3">
        <input
          type="date"
          v-model="fromDate"
          class="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        />
        <span class="text-gray-500 dark:text-gray-400">to</span>
        <input
          type="date"
          v-model="toDate"
          class="px-3 py-1.5 text-sm border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        />
      </div>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div class="text-sm font-medium text-gray-500 dark:text-gray-400">Unique Users</div>
        <div class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{{ uniqueUsers.toLocaleString() }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Views</div>
        <div class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{{ totalViews.toLocaleString() }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div class="text-sm font-medium text-gray-500 dark:text-gray-400">Active Pages</div>
        <div class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{{ activePages }}</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div class="text-sm font-medium text-gray-500 dark:text-gray-400">User Types</div>
        <div class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{{ Object.keys(userTypes).length }}</div>
      </div>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-500 dark:text-gray-400">
      Loading metrics...
    </div>

    <div v-else-if="error" class="text-center py-12 text-red-500">
      {{ error }}
    </div>

    <template v-else-if="dashboardData">
      <!-- Top Pages Chart -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Pages</h3>
        <TopPagesChart :pages="topPages" />
      </div>

      <!-- Usage Trend -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Usage Trend</h3>
        <UsageTrendChart :daily="daily" />
      </div>

      <!-- User Type Breakdown -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">User Type Breakdown</h3>
        <UserTypeBreakdown :user-types="userTypes" />
      </div>

      <!-- Pages Table -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">All Pages</h3>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700">
              <th class="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Page</th>
              <th class="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Views</th>
              <th class="text-right py-2 px-3 font-medium text-gray-500 dark:text-gray-400">Unique Users</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="page in topPages"
              :key="page.pageId"
              class="border-b border-gray-100 dark:border-gray-700/50"
            >
              <td class="py-2 px-3 text-gray-900 dark:text-white">{{ formatPageId(page.pageId) }}</td>
              <td class="py-2 px-3 text-right text-gray-600 dark:text-gray-300">{{ page.views.toLocaleString() }}</td>
              <td class="py-2 px-3 text-right text-gray-600 dark:text-gray-300">{{ page.uniqueUsers }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { useMetricsDashboard } from './useMetricsDashboard.js'
import TopPagesChart from './TopPagesChart.vue'
import UsageTrendChart from './UsageTrendChart.vue'
import UserTypeBreakdown from './UserTypeBreakdown.vue'

const {
  dashboardData,
  loading,
  error,
  fetchDashboard,
  totalViews,
  uniqueUsers,
  activePages,
  topPages,
  userTypes,
  daily,
} = useMetricsDashboard()

const today = new Date().toISOString().slice(0, 10)
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
const fromDate = ref(thirtyDaysAgo)
const toDate = ref(today)

function formatPageId(pageId) {
  const [mod, view] = pageId.split('::')
  return `${mod} / ${view}`
}

watch([fromDate, toDate], () => {
  fetchDashboard(fromDate.value, toDate.value)
})

onMounted(() => {
  fetchDashboard(fromDate.value, toDate.value)
})
</script>
