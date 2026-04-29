<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Flow Metrics</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        Lead time, cycle time, and throughput trends for engineering teams
      </p>
    </div>

    <!-- Team Selector -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
        Select Team
      </label>
      <select
        v-model="selectedTeamKey"
        class="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-primary-500 focus:border-primary-500"
      >
        <option value="">-- Choose a team --</option>
        <optgroup v-for="org in orgs" :key="org.key" :label="org.displayName">
          <option
            v-for="[teamName, team] in Object.entries(org.teams)"
            :key="`${org.key}::${teamName}`"
            :value="`${org.key}::${teamName}`"
          >
            {{ team.displayName }}
          </option>
        </optgroup>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-red-700 dark:text-red-400 text-sm">{{ error }}</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="!selectedTeamKey" class="text-center py-12 text-gray-400 dark:text-gray-500">
      Select a team above to view throughput metrics
    </div>

    <!-- Metrics -->
    <div v-else-if="metrics" class="space-y-6">
      <!-- Current Metrics Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="Lead Time"
          :value="metrics.current.leadTimeDays"
          unit="days"
          subtitle="Avg time: created → resolved"
          tooltip="Average time from issue creation to resolution (last 2 weeks)"
        />
        <MetricCard
          label="Cycle Time"
          :value="metrics.current.cycleTimeDays"
          unit="days"
          subtitle="Avg time: started → resolved"
          tooltip="Average time from work start to resolution (last 2 weeks)"
          :colorThresholds="{ good: 3, warn: 7 }"
        />
        <MetricCard
          label="Throughput"
          :value="metrics.current.throughput"
          unit="issues"
          subtitle="Completed (last 2 weeks)"
          tooltip="Number of issues resolved in the last 2-week period"
        />
        <MetricCard
          label="Backlog"
          :value="metrics.current.backlogCount"
          unit="in progress"
          :subtitle="`Avg age: ${metrics.current.backlogAvgAgeDays || '--'} days`"
          tooltip="Current work in progress and average age of in-progress issues"
          :warning="metrics.current.backlogCount > 20"
        />
      </div>

      <!-- Flow Trend Chart -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
          Flow Metrics Trend
        </h3>
        <TrendChart
          :labels="trendLabels"
          :datasets="trendDatasets"
          title=""
          unit="days/issues"
        />
      </div>

      <!-- Metadata -->
      <div class="text-xs text-gray-400 dark:text-gray-500 text-right">
        Generated {{ formatRelativeTime(metrics.generatedAt) }} &middot;
        {{ metrics.memberCount }} team members &middot;
        {{ metrics.periods.length }} periods
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import MetricCard from '../components/MetricCard.vue'
import TrendChart from '../components/TrendChart.vue'
import { useRoster } from '@shared/client/composables/useRoster'
import { getThroughputMetrics } from '@shared/client/services/api'

const { orgs } = useRoster()

const selectedTeamKey = ref('')
const metrics = ref(null)
const loading = ref(false)
const error = ref(null)

const trendLabels = computed(() => {
  if (!metrics.value) return []
  return metrics.value.periods.map(p => {
    const start = new Date(p.periodStart)
    return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })
})

const trendDatasets = computed(() => {
  if (!metrics.value) return []

  return [
    {
      label: 'Lead Time (days)',
      data: metrics.value.periods.map(p => p.leadTimeDays || 0),
      color: '#2563eb'
    },
    {
      label: 'Cycle Time (days)',
      data: metrics.value.periods.map(p => p.cycleTimeDays || 0),
      color: '#16a34a'
    },
    {
      label: 'Throughput (issues)',
      data: metrics.value.periods.map(p => p.throughput || 0),
      color: '#f59e0b'
    }
  ]
})

async function loadMetrics() {
  if (!selectedTeamKey.value) return

  loading.value = true
  error.value = null

  try {
    metrics.value = await getThroughputMetrics(selectedTeamKey.value, { periods: 12 })
  } catch (err) {
    error.value = err.message
    console.error('Failed to load throughput metrics:', err)
  } finally {
    loading.value = false
  }
}

watch(selectedTeamKey, loadMetrics)

function formatRelativeTime(isoString) {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
  return `${Math.floor(diffMins / 1440)}d ago`
}
</script>
