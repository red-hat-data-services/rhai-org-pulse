<template>
  <div>
    <!-- Report-specific controls -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6 flex flex-wrap items-start gap-6">
      <!-- Metrics -->
      <div>
        <h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Metrics</h3>
        <div class="space-y-1">
          <label
            v-for="metric in METRICS_LIST"
            :key="metric.key"
            class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
          >
            <input
              type="checkbox"
              :value="metric.key"
              v-model="selectedMetrics"
              class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ metric.label }}</span>
          </label>
        </div>
      </div>

      <!-- Chart type -->
      <div>
        <h3 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Chart Type</h3>
        <div class="inline-flex rounded-md shadow-sm">
          <button
            v-for="(option, i) in CHART_TYPES"
            :key="option.value"
            @click="chartType = option.value"
            :aria-pressed="chartType === option.value"
            class="px-3 py-1.5 text-sm font-medium border"
            :class="[
              chartType === option.value
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50',
              i === 0 ? 'rounded-l-md' : '',
              i === CHART_TYPES.length - 1 ? 'rounded-r-md' : '',
              i > 0 ? 'border-l-0' : ''
            ]"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <!-- Run button -->
      <div class="self-end">
        <button
          @click="run"
          :disabled="loading || selectedTeamKeys.length === 0 || selectedMetrics.length === 0"
          :title="selectedTeamKeys.length === 0 || selectedMetrics.length === 0 ? 'Select teams and metrics to run' : undefined"
          class="px-4 py-2 bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <svg v-if="loading" class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {{ loading ? 'Loading...' : 'Run' }}
        </button>
      </div>
    </div>

    <!-- Charts -->
    <div v-if="charts.length === 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-400 dark:text-gray-500">
      <p class="text-lg">Select teams and metrics, then click Run</p>
    </div>
    <div v-else class="space-y-6">
      <div
        v-for="(chart, idx) in charts"
        :key="chart.metricKey + '-' + idx"
        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
      >
        <ReportChart
          :type="chartType"
          :labels="chart.labels"
          :data="chart.data"
          :title="chart.title"
          :unit="chart.unit"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ReportChart from '../components/ReportChart.vue'
import { useGithubStats } from '@shared/client/composables/useGithubStats'
import { useGitlabStats } from '@shared/client/composables/useGitlabStats'
import { getTeamMetrics } from '@shared/client/services/api'
import { useReportFilters } from '../composables/useReportFilters'

const { selectedTeamKeys, availableTeams } = useReportFilters()
const { getContributions } = useGithubStats()
const { getContributions: getGitlabContributions } = useGitlabStats()

const selectedMetrics = ref([])
const chartType = ref('bar')
const loading = ref(false)
// Component-local cache -- resets on navigation (intentional, avoids stale data)
const metricsData = ref({})
const charts = ref([])

const METRICS_LIST = [
  { key: 'teamSize', label: 'Team Size' },
  { key: 'resolvedCount', label: 'Issues Resolved (90d)' },
  { key: 'avgCycleTime', label: 'Avg Cycle Time' },
  { key: 'resolvedPerMember', label: 'Issues Resolved per Member (90d)' },
  { key: 'githubContributions', label: 'GitHub Contributions (1yr)' },
  { key: 'githubPerMember', label: 'Avg GitHub Contributions per Member (1yr)' },
  { key: 'gitlabContributions', label: 'GitLab Contributions (1yr)' },
  { key: 'gitlabPerMember', label: 'Avg GitLab Contributions per Member (1yr)' },
]

const CHART_TYPES = [
  { value: 'bar', label: 'Bar' },
  { value: 'horizontalBar', label: 'Horizontal' },
  { value: 'doughnut', label: 'Doughnut' },
]

const METRIC_DEFS = {
  teamSize: {
    label: 'Team Size',
    unit: '',
    extract: (d) => d.memberCount ?? 0
  },
  resolvedCount: {
    label: 'Issues Resolved (90d)',
    unit: '',
    extract: (d) => d.aggregate?.resolvedCount ?? 0
  },
  avgCycleTime: {
    label: 'Avg Cycle Time',
    unit: 'days',
    extract: (d) => d.aggregate?.avgCycleTimeDays ?? 0
  },
  resolvedPerMember: {
    label: 'Issues Resolved per Member (90d)',
    unit: '',
    extract: (d) => {
      const count = d.aggregate?.resolvedCount ?? 0
      const members = d.memberCount ?? 0
      return members > 0 ? Math.round((count / members) * 10) / 10 : 0
    }
  },
  githubContributions: { label: 'GitHub Contributions (1yr)', unit: '', extract: null },
  githubPerMember: { label: 'Avg GitHub Contributions per Member (1yr)', unit: '', extract: null },
  gitlabContributions: { label: 'GitLab Contributions (1yr)', unit: '', extract: null },
  gitlabPerMember: { label: 'Avg GitLab Contributions per Member (1yr)', unit: '', extract: null },
}

async function run() {
  loading.value = true
  try {
    // Only fetch teams not already cached
    const keysToFetch = selectedTeamKeys.value.filter(k => !metricsData.value[k])
    const results = await Promise.all(
      keysToFetch.map(async (key) => {
        try {
          const data = await getTeamMetrics(key)
          return { key, data }
        } catch (err) {
          console.error(`Failed to fetch metrics for ${key}:`, err)
          return { key, data: null }
        }
      })
    )
    for (const { key, data } of results) {
      if (data) {
        metricsData.value[key] = data
      }
    }

    // Build team lookup from availableTeams (includes members for GitHub/GitLab metrics)
    const teamLookup = {}
    for (const t of availableTeams.value) {
      teamLookup[t.key] = t
    }

    const activeKeys = selectedTeamKeys.value.filter(k => metricsData.value[k])
    const newCharts = []

    for (const metricKey of selectedMetrics.value) {
      const def = METRIC_DEFS[metricKey]

      if (metricKey === 'githubPerMember') {
        newCharts.push({
          metricKey,
          title: def.label,
          unit: '',
          labels: activeKeys.map(k => teamLookup[k]?.displayName ?? k),
          data: activeKeys.map(k => {
            const team = teamLookup[k]
            if (!team?.members?.length) return 0
            const total = team.members.reduce((sum, m) => {
              const c = m.githubUsername ? getContributions(m.githubUsername) : null
              return sum + (c?.totalContributions ?? 0)
            }, 0)
            return Math.round((total / team.members.length) * 10) / 10
          })
        })
      } else if (metricKey === 'githubContributions') {
        newCharts.push({
          metricKey,
          title: def.label,
          unit: def.unit,
          labels: activeKeys.map(k => teamLookup[k]?.displayName ?? k),
          data: activeKeys.map(k => {
            const team = teamLookup[k]
            if (!team?.members) return 0
            return team.members.reduce((sum, m) => {
              const c = m.githubUsername ? getContributions(m.githubUsername) : null
              return sum + (c?.totalContributions ?? 0)
            }, 0)
          })
        })
      } else if (metricKey === 'gitlabPerMember') {
        newCharts.push({
          metricKey,
          title: def.label,
          unit: '',
          labels: activeKeys.map(k => teamLookup[k]?.displayName ?? k),
          data: activeKeys.map(k => {
            const team = teamLookup[k]
            if (!team?.members?.length) return 0
            const configured = team.members.filter(m => m.gitlabUsername)
            if (configured.length === 0) return 0
            const total = configured.reduce((sum, m) => {
              const c = getGitlabContributions(m.gitlabUsername)
              return sum + (c?.totalContributions ?? 0)
            }, 0)
            return Math.round((total / configured.length) * 10) / 10
          })
        })
      } else if (metricKey === 'gitlabContributions') {
        newCharts.push({
          metricKey,
          title: def.label,
          unit: def.unit,
          labels: activeKeys.map(k => teamLookup[k]?.displayName ?? k),
          data: activeKeys.map(k => {
            const team = teamLookup[k]
            if (!team?.members) return 0
            return team.members.reduce((sum, m) => {
              const c = m.gitlabUsername ? getGitlabContributions(m.gitlabUsername) : null
              return sum + (c?.totalContributions ?? 0)
            }, 0)
          })
        })
      } else {
        newCharts.push({
          metricKey,
          title: def.label,
          unit: def.unit,
          labels: activeKeys.map(k => teamLookup[k]?.displayName ?? k),
          data: activeKeys.map(k => def.extract(metricsData.value[k]))
        })
      }
    }

    charts.value = newCharts
  } finally {
    loading.value = false
  }
}
</script>
