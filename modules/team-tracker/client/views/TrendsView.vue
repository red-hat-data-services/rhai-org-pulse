<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Trends</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400">Productivity over time</p>
    </div>

    <!-- Filters -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6 flex flex-wrap items-start gap-6">
      <!-- Orgs -->
      <div>
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Orgs</label>
        <div class="space-y-1 max-h-48 overflow-y-auto">
          <label
            v-for="org in orgs"
            :key="org.key"
            class="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
          >
            <input
              type="checkbox"
              :value="org.key"
              v-model="selectedOrgKeys"
              class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ org.displayName }}</span>
          </label>
        </div>
      </div>

      <!-- Teams -->
      <div v-if="availableTeams.length > 0">
        <div class="flex items-center gap-2 mb-1">
          <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Teams</label>
          <button
            v-if="availableTeams.length > 1"
            @click="toggleAllTeams"
            class="text-xs text-primary-600 hover:text-primary-800 dark:hover:text-primary-400"
          >
            {{ selectedTeamKeys.length === availableTeams.length ? 'Clear' : 'All' }}
          </button>
        </div>
        <div class="space-y-1 max-h-48 overflow-y-auto">
          <label
            v-for="team in availableTeams"
            :key="team.key"
            class="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
          >
            <input
              type="checkbox"
              :value="team.key"
              v-model="selectedTeamKeys"
              class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{{ team.displayName }}</span>
          </label>
        </div>
      </div>

      <!-- Mode toggle -->
      <div v-if="showModeToggle" class="self-center">
        <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">Mode</label>
        <div class="flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
          <button
            @click="compareMode = 'aggregate'"
            class="px-3 py-1.5 text-xs font-medium transition-colors"
            :class="compareMode === 'aggregate'
              ? 'bg-primary-600 text-white'
              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'"
          >
            Aggregate
          </button>
          <button
            @click="compareMode = 'compare'"
            class="px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-300 dark:border-gray-600"
            :class="compareMode === 'compare'
              ? 'bg-primary-600 text-white'
              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'"
          >
            Compare
          </button>
        </div>
      </div>

      <div class="self-end text-xs text-gray-400 dark:text-gray-500 italic">
        No selection = overall total
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- No data -->
    <div v-else-if="!trendsData" class="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center text-gray-400 dark:text-gray-500">
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
import { ref, computed, onMounted, watch } from 'vue'
import TrendChart from '../components/TrendChart.vue'
import { useRoster } from '@shared/client/composables/useRoster'
import { getTrends } from '@shared/client/services/api'

const { orgs } = useRoster()

const trendsData = ref(null)
const loading = ref(false)
const selectedOrgKeys = ref([])
const selectedTeamKeys = ref([])
const compareMode = ref('compare')

const ORG_DISPLAY_NAMES = {
  shgriffi: 'AI Platform',
  crobson: 'AAET',
  tgunders: 'AI Platform Core Components',
  tibrahim: 'Inference Engineering',
  kaixu: 'AI Innovation',
  moromila: 'WatsonX.ai'
}

watch(selectedOrgKeys, () => {
  selectedTeamKeys.value = []
})

const availableTeams = computed(() => {
  if (selectedOrgKeys.value.length === 0) return []
  const teams = []
  for (const orgKey of selectedOrgKeys.value) {
    const org = orgs.value.find(o => o.key === orgKey)
    if (!org?.teams) continue
    for (const [name, team] of Object.entries(org.teams)) {
      teams.push({
        key: `${orgKey}::${name}`,
        displayName: selectedOrgKeys.value.length > 1
          ? `${org.displayName} — ${team.displayName}`
          : team.displayName
      })
    }
  }
  return teams.sort((a, b) => a.displayName.localeCompare(b.displayName))
})

function toggleAllTeams() {
  if (selectedTeamKeys.value.length === availableTeams.value.length) {
    selectedTeamKeys.value = []
  } else {
    selectedTeamKeys.value = availableTeams.value.map(t => t.key)
  }
}

const showModeToggle = computed(() => {
  return selectedOrgKeys.value.length > 1 || selectedTeamKeys.value.length > 1
})

// Determine what series to show based on selections
// Returns array of { key, label, type } where type is 'overall' | 'org' | 'team'
const seriesConfig = computed(() => {
  // Teams selected
  if (selectedTeamKeys.value.length > 0) {
    if (compareMode.value === 'aggregate' && selectedTeamKeys.value.length > 1) {
      return [{ key: selectedTeamKeys.value, label: 'Selected Teams', type: 'teams-aggregate' }]
    }
    return selectedTeamKeys.value.map(teamKey => {
      const team = availableTeams.value.find(t => t.key === teamKey)
      return { key: teamKey, label: team?.displayName || teamKey, type: 'team' }
    })
  }

  // Orgs selected
  if (selectedOrgKeys.value.length > 0) {
    if (compareMode.value === 'aggregate' && selectedOrgKeys.value.length > 1) {
      return [{ key: selectedOrgKeys.value, label: 'Selected Orgs', type: 'orgs-aggregate' }]
    }
    return selectedOrgKeys.value.map(orgKey => ({
      key: orgKey,
      label: ORG_DISPLAY_NAMES[orgKey] || orgKey,
      type: 'org'
    }))
  }

  // Nothing selected -> overall total
  return [{ key: 'overall', label: 'Overall', type: 'overall' }]
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

const gitlabDatasets = computed(() => {
  const labels = monthLabels.value
  if (labels.length === 0) return []
  return seriesConfig.value.map(series => ({
    label: series.label,
    data: labels.map(m => getGitlabValue(m.key, series))
  }))
})

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
  try {
    await getTrends((data) => {
      trendsData.value = data
      loading.value = false
    })
  } catch (err) {
    console.error('Failed to load trends:', err)
  } finally {
    loading.value = false
  }
}

onMounted(loadTrends)
</script>
