<template>
  <div class="container mx-auto px-6 py-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <button
          @click="$emit('back')"
          class="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          title="Back to Dashboard"
        >
          <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h2 class="text-xl font-bold text-gray-900">{{ team.displayName }}</h2>
          <p class="text-sm text-gray-500">{{ uniqueCount }} members</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button
          @click="handleRefresh"
          :disabled="isRefreshing"
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
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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
    </div>

    <!-- Export -->
    <div class="flex justify-end mb-3">
      <button
        @click="exportCsv"
        :disabled="!teamMetrics"
        class="px-3 py-1.5 text-sm bg-white text-gray-700 border border-gray-300 rounded-md font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
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
        @select="$emit('select-person', $event)"
      />
    </div>

    <PersonTable
      v-else
      :members="uniqueMembers"
      :multiTeamMembers="multiTeamMembers"
      :getTeamsForPerson="getTeamsForPerson"
      :memberMetrics="memberMetricsMap"
      @select="$emit('select-person', $event)"
    />

    <!-- Resolved Issues Modal -->
    <ResolvedIssuesModal
      v-if="showResolvedIssues"
      :title="`${team.displayName} — Resolved Issues`"
      :issues="teamMetrics?.resolvedIssues || []"
      @close="showResolvedIssues = false"
    />
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import PersonCard from './PersonCard.vue'
import PersonTable from './PersonTable.vue'
import ViewToggle from './ViewToggle.vue'
import MetricCard from './MetricCard.vue'
import ResolvedIssuesModal from './ResolvedIssuesModal.vue'
import { useViewPreference } from '../composables/useViewPreference'
import { useRoster } from '../composables/useRoster'
import { useGithubStats } from '../composables/useGithubStats'
import { refreshTeamMetrics, getTeamMetrics } from '../services/api'

const props = defineProps({
  team: { type: Object, required: true }
})
defineEmits(['back', 'select-person'])

const { viewPreference: viewPref } = useViewPreference()
const { multiTeamMembers, getTeamsForPerson } = useRoster()
const { getContributions } = useGithubStats()
const isRefreshing = ref(false)
const teamMetrics = ref(null)
const showResolvedIssues = ref(false)

async function fetchTeamMetrics() {
  try {
    await getTeamMetrics(props.team.key, (data) => {
      teamMetrics.value = data
    })
  } catch (error) {
    console.error('Failed to fetch team metrics:', error)
  }
}

onMounted(fetchTeamMetrics)

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
  const seen = new Set()
  return props.team.members.filter(m => {
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

function exportCsv() {
  const headers = ['Name', 'Specialty', 'Issues Resolved', 'Story Points', 'Avg Cycle Time (days)', 'In Progress', 'GitHub Contributions (1yr)', 'Teams']
  const rows = uniqueMembers.value.map(member => {
    const metrics = memberMetricsMap.value.get(member.jiraDisplayName)
    const teamCount = getTeamsForPerson(member.jiraDisplayName).length
    const ghContribs = getContributions(member.githubUsername)
    return [
      member.name,
      member.specialty || '',
      metrics?.resolvedCount ?? '',
      metrics?.resolvedPoints ?? '',
      metrics?.avgCycleTimeDays ?? '',
      metrics?.inProgressCount ?? '',
      ghContribs?.totalContributions ?? '',
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
  const teamSlug = props.team.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const date = new Date().toISOString().slice(0, 10)
  a.download = `${teamSlug}-${date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

async function handleRefresh() {
  isRefreshing.value = true
  try {
    await refreshTeamMetrics(props.team.key)
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
