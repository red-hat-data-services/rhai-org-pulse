<template>
  <div>
    <!-- Loading state when team not yet resolved from roster -->
    <div v-if="!team" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <template v-else>
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <button
          @click="nav.goBack()"
          class="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          title="Back to Dashboard"
        >
          <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ team.displayName }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ uniqueCount }} members</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button
          v-if="isAdmin"
          @click="showRefreshModal = true"
          :disabled="isRefreshing"
          title="Refresh all metrics for this team"
          class="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          <svg class="h-4 w-4" :class="{ 'animate-spin': isRefreshing }" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {{ isRefreshing ? 'Refreshing...' : 'Refresh Metrics' }}
        </button>
        <ViewToggle v-model="viewPref" />
      </div>
    </div>

    <!-- Team Metrics -->
    <div class="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-2">
      <MetricCard
        label="Issues Resolved"
        :value="teamMetrics?.aggregate?.resolvedCount"
        subtitle="Last 90 days"
        @click="showResolvedIssues = true"
      />
      <MetricCard
        label="Story Points"
        :value="teamMetrics?.aggregate?.resolvedPoints"
        unit="pts"
        subtitle="Last 90 days"
      />
      <MetricCard
        label="In Progress"
        :value="teamMetrics?.aggregate?.inProgressCount"
        :warning="teamMetrics?.aggregate?.inProgressCount != null && teamMetrics.aggregate.inProgressCount > uniqueCount"
      />
      <MetricCard
        label="Avg Cycle Time"
        :value="teamMetrics?.aggregate?.avgCycleTimeDays"
        unit="days"
      />
      <MetricCard
        label="GitHub Contributions"
        :value="teamGithubTotal"
        subtitle="Last year"
      />
      <MetricCard
        label="GitLab Contributions"
        :value="teamGitlabTotal"
        subtitle="Last year"
      />
    </div>

    <div class="mb-4 pl-1">
      <button
        @click="openTeamHistory"
        class="text-xs text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
      >
        View History
      </button>
    </div>

    <!-- Export -->
    <div class="flex justify-end mb-3">
      <button
        @click="exportCsv"
        :disabled="!teamMetrics"
        class="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
      >
        <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Export CSV
      </button>
    </div>

    <!-- Content -->
    <div v-if="viewPref === 'cards'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <PersonCard
        v-for="member in uniqueMembers"
        :key="member.jiraDisplayName"
        :member="member"
        :teamCount="getTeamsForPerson(member.jiraDisplayName).length"
        :metrics="memberMetricsMap.get(member.jiraDisplayName)"
        @select="handleSelectPerson"
      />
    </div>

    <PersonTable
      v-else
      :members="uniqueMembers"
      :multiTeamMembers="multiTeamMembers"
      :getTeamsForPerson="getTeamsForPerson"
      :memberMetrics="memberMetricsMap"
      @select="handleSelectPerson"
      @view-history="openPersonHistory"
    />

    <!-- Resolved Issues Modal -->
    <ResolvedIssuesModal
      v-if="showResolvedIssues"
      :title="`${team.displayName} — Resolved Issues`"
      :issues="teamMetrics?.resolvedIssues || []"
      @close="showResolvedIssues = false"
    />

    <RefreshModal
      v-if="showRefreshModal"
      :scopeLabel="`Refresh data for team &quot;${team.displayName}&quot; (${uniqueCount} members)`"
      @confirm="handleRefreshConfirm"
      @cancel="showRefreshModal = false"
    />

    <SnapshotHistoryModal
      v-if="showSnapshotHistory"
      :title="snapshotHistoryTitle"
      :snapshots="snapshotHistoryData"
      :loading="snapshotHistoryLoading"
      :mode="snapshotHistoryMode"
      @close="showSnapshotHistory = false"
    />
    </template>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, inject, watch } from 'vue'
import PersonCard from '../components/PersonCard.vue'
import PersonTable from '../components/PersonTable.vue'
import ViewToggle from '../components/ViewToggle.vue'
import MetricCard from '../components/MetricCard.vue'
import ResolvedIssuesModal from '../components/ResolvedIssuesModal.vue'
import RefreshModal from '@shared/client/components/RefreshModal.vue'
import SnapshotHistoryModal from '../components/SnapshotHistoryModal.vue'
import { useViewPreference } from '../composables/useViewPreference'
import { useRoster } from '@shared/client/composables/useRoster'
import { useGithubStats } from '@shared/client/composables/useGithubStats'
import { useGitlabStats } from '@shared/client/composables/useGitlabStats'
import { useAuth } from '@shared/client/composables/useAuth'
import { refreshMetrics, getTeamMetrics, getTeamSnapshots, getPersonSnapshots } from '@shared/client/services/api'

const nav = inject('moduleNav')
const { teams: allTeams, selectOrg } = useRoster()

const team = computed(() => {
  const teamKey = nav.params.value?.teamKey
  if (!teamKey) return null
  return allTeams.value.find(t => t.key === teamKey) || null
})

const { viewPreference: viewPref } = useViewPreference()
const { multiTeamMembers, getTeamsForPerson, visibleFields } = useRoster()
const { getContributions } = useGithubStats()
const { getContributions: getGitlabContributions, loadGitlabStats } = useGitlabStats()
const { isAdmin } = useAuth()
const isRefreshing = ref(false)
const teamMetrics = ref(null)
const showResolvedIssues = ref(false)
const showRefreshModal = ref(false)
const showSnapshotHistory = ref(false)
const snapshotHistoryData = ref([])
const snapshotHistoryLoading = ref(false)
const snapshotHistoryTitle = ref('')
const snapshotHistoryMode = ref('team')

async function openTeamHistory() {
  if (!team.value) return
  showSnapshotHistory.value = true
  snapshotHistoryLoading.value = true
  snapshotHistoryTitle.value = `${team.value.displayName} - Metric History`
  snapshotHistoryMode.value = 'team'
  snapshotHistoryData.value = []
  try {
    const result = await getTeamSnapshots(team.value.key)
    snapshotHistoryData.value = result.snapshots || []
  } catch (err) {
    console.error('Failed to load team snapshots:', err)
  } finally {
    snapshotHistoryLoading.value = false
  }
}

async function openPersonHistory(member) {
  if (!team.value) return
  showSnapshotHistory.value = true
  snapshotHistoryLoading.value = true
  snapshotHistoryTitle.value = `${member.jiraDisplayName || member.name} - Metric History`
  snapshotHistoryMode.value = 'person'
  snapshotHistoryData.value = []
  try {
    const result = await getPersonSnapshots(team.value.key, member.jiraDisplayName || member.name)
    snapshotHistoryData.value = result.snapshots || []
  } catch (err) {
    console.error('Failed to load person snapshots:', err)
  } finally {
    snapshotHistoryLoading.value = false
  }
}

function handleSelectPerson(member) {
  nav.navigateTo('person-detail', { teamKey: team.value?.key, person: member.jiraDisplayName || member.name })
}

async function fetchTeamMetrics() {
  if (!team.value) return
  try {
    await getTeamMetrics(team.value.key, (data) => {
      teamMetrics.value = data
    })
  } catch (error) {
    console.error('Failed to fetch team metrics:', error)
  }
}

onMounted(() => {
  fetchTeamMetrics()
  loadGitlabStats()
})

watch(() => nav.params.value?.teamKey, () => {
  fetchTeamMetrics()
})

// Retry loading metrics once team resolves (roster loads async)
watch(team, (newVal, oldVal) => {
  if (newVal && !oldVal && !teamMetrics.value) {
    fetchTeamMetrics()
  }
})

const memberMetricsMap = computed(() => {
  const map = new Map()
  if (teamMetrics.value?.members) {
    for (const m of teamMetrics.value.members) {
      if (m.metrics) {
        map.set(m.jiraDisplayName, m.metrics)
      }
    }
  }
  return map
})

const uniqueMembers = computed(() => {
  if (!team.value) return []
  const seen = new Set()
  return team.value.members.filter(m => {
    if (seen.has(m.jiraDisplayName)) return false
    seen.add(m.jiraDisplayName)
    return true
  })
})

const uniqueCount = computed(() => uniqueMembers.value.length)

const teamGithubTotal = computed(() => {
  return uniqueMembers.value.reduce((sum, m) => {
    const c = m.githubUsername ? getContributions(m.githubUsername) : null
    return sum + (c?.totalContributions ?? 0)
  }, 0)
})

const teamGitlabTotal = computed(() => {
  return uniqueMembers.value.reduce((sum, m) => {
    const c = m.gitlabUsername ? getGitlabContributions(m.gitlabUsername) : null
    return sum + (c?.totalContributions ?? 0)
  }, 0)
})

function exportCsv() {
  const customFieldHeaders = visibleFields.value.map(f => f.label)
  const headers = ['Name', ...customFieldHeaders, 'Issues Resolved', 'Story Points', 'Avg Cycle Time (days)', 'In Progress', 'GitHub Contributions (1yr)', 'GitLab Contributions (1yr)', 'Teams']
  const rows = uniqueMembers.value.map(member => {
    const metrics = memberMetricsMap.value.get(member.jiraDisplayName)
    const teamCount = getTeamsForPerson(member.jiraDisplayName).length
    const ghContribs = getContributions(member.githubUsername)
    const glContribs = getGitlabContributions(member.gitlabUsername)
    const customFieldValues = visibleFields.value.map(f => member.customFields?.[f.key] || '')
    return [
      member.name,
      ...customFieldValues,
      metrics?.resolvedCount ?? '',
      metrics?.resolvedPoints ?? '',
      metrics?.avgCycleTimeDays ?? '',
      metrics?.inProgressCount ?? '',
      ghContribs?.totalContributions ?? '',
      glContribs?.totalContributions ?? '',
      teamCount
    ]
  })

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const teamSlug = team.value.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const date = new Date().toISOString().slice(0, 10)
  a.download = `${teamSlug}-${date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function handleRefreshConfirm({ force, sources }) {
  showRefreshModal.value = false
  isRefreshing.value = true
  try {
    await refreshMetrics({ scope: 'team', teamKey: team.value.key, force, sources })
  } catch (error) {
    console.error('Failed to refresh team metrics:', error)
  } finally {
    // Keep spinning for a few seconds since it's a background job, then re-fetch
    setTimeout(async () => {
      await fetchTeamMetrics()
      isRefreshing.value = false
    }, 3000)
  }
}
</script>
