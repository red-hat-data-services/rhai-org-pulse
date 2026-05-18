<template>
  <div>
    <!-- Mode toggle (report-specific filter) -->
    <div
      v-if="showModeToggle"
      class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6 flex items-center gap-4"
    >
      <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mode</label>
      <div class="flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
        <button
          @click="compareMode = 'aggregate'"
          :aria-pressed="compareMode === 'aggregate'"
          class="px-3 py-1.5 text-xs font-medium transition-colors"
          :class="compareMode === 'aggregate'
            ? 'bg-primary-600 text-white'
            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'"
        >
          Aggregate
        </button>
        <button
          @click="compareMode = 'compare'"
          :aria-pressed="compareMode === 'compare'"
          class="px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-600"
          :class="compareMode === 'compare'
            ? 'bg-primary-600 text-white'
            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'"
        >
          Compare
        </button>
      </div>
      <div class="text-xs text-gray-400 dark:text-gray-500 italic">
        No selection = overall total
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12" role="status" aria-live="polite">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-700 p-12 text-center" role="alert">
      <p class="text-lg mb-2 text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <!-- No data -->
    <div v-else-if="!trendsData" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-400 dark:text-gray-500" role="status" aria-live="polite">
      <p class="text-lg mb-2">No trend data available</p>
      <p class="text-sm">Click "Refresh Data (365d)" to fetch historical data from Jira, GitHub, and GitLab.</p>
    </div>

    <!-- Charts -->
    <div v-else class="space-y-6">
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <TrendChart
          :labels="displayLabels"
          :datasets="resolvedDatasets"
          title="Issues Resolved"
        />
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <TrendChart
          :labels="displayLabels"
          :datasets="githubDatasets"
          title="GitHub Contributions"
        />
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <TrendChart
          :labels="displayLabels"
          :datasets="gitlabDatasets"
          title="GitLab Contributions"
        />
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <TrendChart
          :labels="displayLabels"
          :datasets="cycleTimeDatasets"
          title="Avg Cycle Time"
          unit="days"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import TrendChart from '../components/TrendChart.vue'
import { useRoster } from '@shared/client/composables/useRoster'
import { getTrends } from '@shared/client/services/api'
import { useReportFilters } from '../composables/useReportFilters'

const { orgs } = useRoster()
const { selectedOrgKeys, selectedTeamKeys } = useReportFilters()

const trendsData = ref(null)
const loading = ref(false)
const error = ref(null)
const compareMode = ref('compare')

const showModeToggle = computed(() => {
  return selectedOrgKeys.value.length > 1 || selectedTeamKeys.value.length > 1
})

// Build series config based on filter selections
const seriesConfig = computed(() => {
  // Teams selected
  if (selectedTeamKeys.value.length > 0) {
    if (compareMode.value === 'aggregate' && selectedTeamKeys.value.length > 1) {
      return [{ key: selectedTeamKeys.value, label: 'Selected Teams', type: 'teams-aggregate' }]
    }
    return selectedTeamKeys.value.map(teamKey => {
      const team = teamDisplayNames.value[teamKey]
      return { key: teamKey, label: team || teamKey, type: 'team' }
    })
  }

  // Orgs selected
  if (selectedOrgKeys.value.length > 0) {
    if (compareMode.value === 'aggregate' && selectedOrgKeys.value.length > 1) {
      return [{ key: selectedOrgKeys.value, label: 'Selected Orgs', type: 'orgs-aggregate' }]
    }
    return selectedOrgKeys.value.map(orgKey => {
      const org = orgs.value.find(o => o.key === orgKey)
      return { key: orgKey, label: org?.displayName || orgKey, type: 'org' }
    })
  }

  // Nothing selected -> overall total
  return [{ key: 'overall', label: 'Overall', type: 'overall' }]
})

// Build team display names, org-prefixed when multiple orgs selected
const teamDisplayNames = computed(() => {
  const lookup = {}
  const multiOrg = selectedOrgKeys.value.length > 1
  for (const org of orgs.value) {
    if (!org.teams) continue
    if (!selectedOrgKeys.value.includes(org.key)) continue
    for (const [name, team] of Object.entries(org.teams)) {
      const key = `${org.key}::${name}`
      lookup[key] = multiOrg
        ? `${org.displayName || org.key} \u2014 ${team.displayName}`
        : team.displayName
    }
  }
  return lookup
})

// Generate sorted month labels for the last 12 months
const monthLabels = computed(() => {
  if (!trendsData.value?.jira) return []
  const allMonths = new Set()

  for (const month of Object.keys(trendsData.value.jira)) {
    allMonths.add(month)
  }

  if (trendsData.value.github?.users) {
    for (const userData of Object.values(trendsData.value.github.users)) {
      if (userData?.months) {
        for (const month of Object.keys(userData.months)) {
          allMonths.add(month)
        }
      }
    }
  }

  if (trendsData.value.gitlab?.users) {
    for (const userData of Object.values(trendsData.value.gitlab.users)) {
      if (userData?.months) {
        for (const month of Object.keys(userData.months)) {
          allMonths.add(month)
        }
      }
    }
  }

  const now = new Date()
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`

  return [...allMonths]
    .filter(m => m >= cutoffKey)
    .sort()
    .map(m => {
      const [y, mo] = m.split('-')
      const date = new Date(parseInt(y), parseInt(mo) - 1)
      return { key: m, label: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) }
    })
})

const displayLabels = computed(() => monthLabels.value.map(m => m.label))

function getJiraValue(monthKey, series, field) {
  const bucket = trendsData.value?.jira?.[monthKey]
  if (!bucket) return 0
  if (series.type === 'overall') return bucket[field] || 0
  if (series.type === 'org') return bucket.byOrg?.[series.key]?.[field] || 0
  if (series.type === 'team') return bucket.byTeam?.[series.key]?.[field] || 0
  if (series.type === 'orgs-aggregate') {
    let total = 0
    for (const orgKey of series.key) {
      total += bucket.byOrg?.[orgKey]?.[field] || 0
    }
    return total
  }
  if (series.type === 'teams-aggregate') {
    let total = 0
    for (const teamKey of series.key) {
      total += bucket.byTeam?.[teamKey]?.[field] || 0
    }
    return total
  }
  return 0
}

const githubUserLookup = computed(() => {
  const lookup = {}
  for (const org of orgs.value) {
    if (!org.teams) continue
    for (const [teamName, team] of Object.entries(org.teams)) {
      for (const member of team.members) {
        if (member.githubUsername) {
          lookup[member.githubUsername] = {
            orgKey: org.key,
            teamKey: `${org.key}::${teamName}`
          }
        }
      }
    }
  }
  return lookup
})

function getGithubValue(monthKey, series) {
  const github = trendsData.value?.github
  if (!github?.users) return 0
  const lookup = githubUserLookup.value

  let total = 0
  for (const [username, userData] of Object.entries(github.users)) {
    if (!userData?.months) continue
    const info = lookup[username]
    if (series.type === 'org' && info?.orgKey !== series.key) continue
    if (series.type === 'team' && info?.teamKey !== series.key) continue
    if (series.type === 'orgs-aggregate' && !series.key.includes(info?.orgKey)) continue
    if (series.type === 'teams-aggregate' && !series.key.includes(info?.teamKey)) continue
    total += userData.months[monthKey] || 0
  }
  return total
}

const gitlabUserLookup = computed(() => {
  const lookup = {}
  for (const org of orgs.value) {
    if (!org.teams) continue
    for (const [teamName, team] of Object.entries(org.teams)) {
      for (const member of team.members) {
        if (member.gitlabUsername) {
          lookup[member.gitlabUsername] = {
            orgKey: org.key,
            teamKey: `${org.key}::${teamName}`
          }
        }
      }
    }
  }
  return lookup
})

function getGitlabValue(monthKey, series) {
  const gitlab = trendsData.value?.gitlab
  if (!gitlab?.users) return 0
  const lookup = gitlabUserLookup.value

  let total = 0
  for (const [username, userData] of Object.entries(gitlab.users)) {
    if (!userData?.months) continue
    const info = lookup[username]
    if (series.type === 'org' && info?.orgKey !== series.key) continue
    if (series.type === 'team' && info?.teamKey !== series.key) continue
    if (series.type === 'orgs-aggregate' && !series.key.includes(info?.orgKey)) continue
    if (series.type === 'teams-aggregate' && !series.key.includes(info?.teamKey)) continue
    total += userData.months[monthKey] || 0
  }
  return total
}

function getAvgCycleTime(monthKey, series) {
  const bucket = trendsData.value?.jira?.[monthKey]
  if (!bucket) return 0
  if (series.type === 'orgs-aggregate') {
    const vals = series.key.map(k => bucket.byOrg?.[k]?.avgCycleTimeDays).filter(v => v != null)
    return vals.length > 0 ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 0
  }
  if (series.type === 'teams-aggregate') {
    const vals = series.key.map(k => bucket.byTeam?.[k]?.avgCycleTimeDays).filter(v => v != null)
    return vals.length > 0 ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 0
  }
  return getJiraValue(monthKey, series, 'avgCycleTimeDays')
}

const resolvedDatasets = computed(() => {
  const labels = monthLabels.value
  if (labels.length === 0) return []
  return seriesConfig.value.map(series => ({
    label: series.label,
    data: labels.map(m => getJiraValue(m.key, series, 'resolved'))
  }))
})

const githubDatasets = computed(() => {
  const labels = monthLabels.value
  if (labels.length === 0) return []
  return seriesConfig.value.map(series => ({
    label: series.label,
    data: labels.map(m => getGithubValue(m.key, series))
  }))
})

const gitlabDatasets = computed(() => {
  const labels = monthLabels.value
  if (labels.length === 0) return []
  return seriesConfig.value.map(series => ({
    label: series.label,
    data: labels.map(m => getGitlabValue(m.key, series))
  }))
})

const cycleTimeDatasets = computed(() => {
  const labels = monthLabels.value
  if (labels.length === 0) return []
  return seriesConfig.value.map(series => ({
    label: series.label,
    data: labels.map(m => getAvgCycleTime(m.key, series))
  }))
})

async function loadTrends() {
  loading.value = true
  error.value = null
  try {
    await getTrends((data) => {
      trendsData.value = data
      loading.value = false
    })
  } catch (err) {
    console.error('Failed to load trends:', err)
    error.value = 'Failed to load trend data. Please try again later.'
  } finally {
    loading.value = false
  }
}

onMounted(loadTrends)
</script>
