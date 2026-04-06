<template>
  <div>
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <button
        @click="$emit('back')"
        class="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
        title="Back to Dashboard"
      >
        <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>
      <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Reports</h2>
    </div>

    <div class="flex gap-6">
      <!-- Sidebar -->
      <aside class="w-72 shrink-0 space-y-6">
        <div v-if="orgs.length > 1" class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">Organization</h3>
          <select
            :value="selectedOrgKey"
            @change="handleOrgChange($event.target.value)"
            class="w-full text-sm border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-md focus:ring-primary-500 focus:border-primary-500"
          >
            <option v-for="org in orgs" :key="org.key" :value="org.key">
              {{ org.displayName }}
            </option>
          </select>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <ReportsTeamSelector :teams="teams" v-model="selectedTeamKeys" />
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <ReportsMetricSelector v-model="selectedMetrics" />
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <ReportsChartTypeSelector v-model="chartType" />
        </div>
        <button
          @click="generate"
          :disabled="loading || selectedTeamKeys.length === 0 || selectedMetrics.length === 0"
          class="w-full px-4 py-2 bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <svg v-if="loading" class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {{ loading ? 'Loading...' : 'Generate' }}
        </button>
      </aside>

      <!-- Main content -->
      <div class="flex-1 space-y-6">
        <div v-if="charts.length === 0" class="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center text-gray-400 dark:text-gray-500">
          <p class="text-lg">Select teams and metrics, then click Generate</p>
        </div>
        <div
          v-for="(chart, idx) in charts"
          :key="chart.metricKey + '-' + idx"
          class="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
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
  </div>
</template>

<script setup>
import { ref, inject } from 'vue'
import ReportChart from '../components/ReportChart.vue'
import ReportsTeamSelector from '../components/ReportsTeamSelector.vue'
import ReportsMetricSelector from '../components/ReportsMetricSelector.vue'
import ReportsChartTypeSelector from '../components/ReportsChartTypeSelector.vue'
import { useRoster } from '@shared/client/composables/useRoster'
import { useGithubStats } from '@shared/client/composables/useGithubStats'
import { useGitlabStats } from '@shared/client/composables/useGitlabStats'
import { getTeamMetrics } from '@shared/client/services/api'

const _nav = inject('moduleNav')

const { orgs, teams, selectedOrgKey, selectOrg } = useRoster()
const { getContributions } = useGithubStats()
const { getContributions: getGitlabContributions } = useGitlabStats()

const selectedTeamKeys = ref([])
const selectedMetrics = ref([])
const chartType = ref('bar')
const loading = ref(false)
const metricsData = ref({})
const charts = ref([])

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
  githubContributions: {
    label: 'GitHub Contributions (1yr)',
    unit: '',
    extract: null // handled specially in generate()
  },
  githubPerMember: {
    label: 'Avg GitHub Contributions per Member (1yr)',
    unit: '',
    extract: null // handled specially in generate()
  },
  gitlabContributions: {
    label: 'GitLab Contributions (1yr)',
    unit: '',
    extract: null // handled specially in generate()
  },
  gitlabPerMember: {
    label: 'Avg GitLab Contributions per Member (1yr)',
    unit: '',
    extract: null // handled specially in generate()
  }
}

function handleOrgChange(orgKey) {
  selectOrg(orgKey)
  selectedTeamKeys.value = []
  charts.value = []
}

async function generate() {
  loading.value = true
  try {
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

    const teamLookup = {}
    for (const t of teams.value) {
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
