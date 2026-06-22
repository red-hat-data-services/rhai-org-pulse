<template>
  <div class="p-6">
    <!-- Header -->
    <div class="mb-6 flex justify-between items-center">
      <div class="flex items-center gap-2">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p class="text-gray-600 mt-1">View aggregated customer insights and trends</p>
        </div>
        <InfoTooltip text="Visual analytics and charts showing customer interaction trends, component distribution, geographic spread, and industry verticals. Filter by component to see specific metrics." />
      </div>

      <!-- Component Selector -->
      <select
        v-model="selectedComponent"
        class="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option v-for="c in components" :key="c.id" :value="c.id">
          {{ c.label }}
        </option>
      </select>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="text-gray-500">Loading analytics...</div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <p class="text-red-800">Error loading analytics: {{ error }}</p>
    </div>

    <!-- No Data State -->
    <div v-else-if="!analytics || !hasAnyData" class="bg-white rounded-lg shadow p-12 text-center">
      <div class="text-gray-500 mb-4">
        <p class="font-medium text-lg mb-2">Coming Soon</p>
        <p class="text-sm">Analytics will appear once customer interactions are imported.</p>
      </div>
    </div>

    <!-- Charts Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- Customers by Geo -->
      <div v-if="geoChartData" class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Customers by Geo</h3>
        <div class="h-64">
          <Doughnut :data="geoChartData" :options="chartOptions" />
        </div>
      </div>

      <!-- Customers by Industry -->
      <div v-if="industryChartData" class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Customers by Industry</h3>
        <div class="h-64">
          <Bar :data="industryChartData" :options="horizontalBarOptions" />
        </div>
      </div>

      <!-- Customers by Environment -->
      <div v-if="environmentChartData" class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Customers by Environment</h3>
        <div class="h-64">
          <Bar :data="environmentChartData" :options="chartOptions" />
        </div>
      </div>

      <!-- Interactions by Status -->
      <div v-if="statusChartData" class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Interactions by Status</h3>
        <div class="h-64">
          <Bar :data="statusChartData" :options="chartOptions" />
        </div>
      </div>

      <!-- SSA vs CAI -->
      <div v-if="customerTypeChartData" class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">SSA vs CAI</h3>
        <div class="h-64">
          <Doughnut :data="customerTypeChartData" :options="chartOptions" />
        </div>
      </div>

      <!-- Top AI Tools -->
      <div v-if="toolsChartData" class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Top AI Tools</h3>
        <div class="h-64">
          <Pie :data="toolsChartData" :options="chartOptions" />
        </div>
      </div>

      <!-- Top Wishlist Items -->
      <div v-if="wishlistChartData" class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Top Wishlist Items</h3>
        <div class="h-64">
          <Bar :data="wishlistChartData" :options="horizontalBarOptions" />
        </div>
      </div>

      <!-- Pain Point Keywords -->
      <div v-if="painPointsChartData" class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Pain Point Keywords</h3>
        <div class="h-64">
          <Bar :data="painPointsChartData" :options="horizontalBarOptions" />
        </div>
      </div>

      <!-- Use Case Categories -->
      <div v-if="useCasesChartData" class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">AI Use Case Categories</h3>
        <div class="h-64">
          <Pie :data="useCasesChartData" :options="chartOptions" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Bar, Doughnut, Pie } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement } from 'chart.js'
import InfoTooltip from '../components/InfoTooltip.vue'
import { useComponentSelector } from '../composables/useComponentSelector'
import { useAnalytics } from '../composables/useAnalytics'

// Register Chart.js components
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ArcElement)

const { components, selectedComponent } = useComponentSelector()
const { analytics, loading, error } = useAnalytics(selectedComponent)

// Check if analytics has any data
const hasAnyData = computed(() => {
  if (!analytics.value) return false
  const hasGeo = analytics.value.byGeo && Object.keys(analytics.value.byGeo).length > 0
  const hasIndustry = analytics.value.byIndustry && Object.keys(analytics.value.byIndustry).length > 0
  const hasStatus = analytics.value.byStatus && Object.keys(analytics.value.byStatus).length > 0
  return hasGeo || hasIndustry || hasStatus
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom'
    }
  }
}

const horizontalBarOptions = {
  ...chartOptions,
  indexAxis: 'y'
}

// Color palette
const colors = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16'
]

const geoChartData = computed(() => {
  if (!analytics.value?.byGeo) return null
  return {
    labels: Object.keys(analytics.value.byGeo),
    datasets: [{
      data: Object.values(analytics.value.byGeo),
      backgroundColor: colors.slice(0, 4)
    }]
  }
})

const industryChartData = computed(() => {
  if (!analytics.value?.byIndustry) return null
  return {
    labels: Object.keys(analytics.value.byIndustry),
    datasets: [{
      label: 'Customers',
      data: Object.values(analytics.value.byIndustry),
      backgroundColor: colors[0]
    }]
  }
})

const environmentChartData = computed(() => {
  if (!analytics.value?.byEnvironment) return null
  return {
    labels: Object.keys(analytics.value.byEnvironment),
    datasets: [{
      label: 'Customers',
      data: Object.values(analytics.value.byEnvironment),
      backgroundColor: colors[1]
    }]
  }
})

const statusChartData = computed(() => {
  if (!analytics.value?.byStatus) return null
  return {
    labels: Object.keys(analytics.value.byStatus),
    datasets: [{
      label: 'Interactions',
      data: Object.values(analytics.value.byStatus),
      backgroundColor: colors[2]
    }]
  }
})

const customerTypeChartData = computed(() => {
  if (!analytics.value?.byCustomerType) return null
  return {
    labels: Object.keys(analytics.value.byCustomerType),
    datasets: [{
      data: Object.values(analytics.value.byCustomerType),
      backgroundColor: [colors[3], colors[4]]
    }]
  }
})

const toolsChartData = computed(() => {
  if (!analytics.value?.topTools) return null
  return {
    labels: Object.keys(analytics.value.topTools),
    datasets: [{
      data: Object.values(analytics.value.topTools),
      backgroundColor: colors
    }]
  }
})

const wishlistChartData = computed(() => {
  if (!analytics.value?.topWishlist) return null
  return {
    labels: Object.keys(analytics.value.topWishlist),
    datasets: [{
      label: 'Mentions',
      data: Object.values(analytics.value.topWishlist),
      backgroundColor: colors[5]
    }]
  }
})

const painPointsChartData = computed(() => {
  if (!analytics.value?.painPointKeywords) return null
  return {
    labels: Object.keys(analytics.value.painPointKeywords),
    datasets: [{
      label: 'Mentions',
      data: Object.values(analytics.value.painPointKeywords),
      backgroundColor: colors[6]
    }]
  }
})

const useCasesChartData = computed(() => {
  if (!analytics.value?.useCaseCategories) return null
  return {
    labels: Object.keys(analytics.value.useCaseCategories),
    datasets: [{
      data: Object.values(analytics.value.useCaseCategories),
      backgroundColor: colors
    }]
  }
})
</script>
