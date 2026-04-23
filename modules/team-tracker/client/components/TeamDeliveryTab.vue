<template>
  <div>
    <!-- Team Metrics -->
    <div class="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-2">
      <MetricCard
        label="Issues Resolved"
        :value="teamMetrics?.aggregate?.resolvedCount"
        subtitle="Last year"
        clickable
        @click="showResolvedIssues = true"
      />
      <MetricCard
        label="Story Points"
        :value="teamMetrics?.aggregate?.resolvedPoints"
        unit="pts"
        subtitle="Last year"
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
        :subtitle="gitlabConfiguredCount < uniqueCount ? `${gitlabConfiguredCount}/${uniqueCount} members configured` : 'Last year'"
      >
        <template v-if="Object.keys(teamGitlabByInstance).length > 1" #footer>
          <div class="mt-1 space-y-0.5">
            <div
              v-for="(count, baseUrl) in teamGitlabByInstance"
              :key="baseUrl"
              class="flex justify-between text-xs text-gray-400 dark:text-gray-500"
            >
              <span class="truncate mr-2">{{ baseUrl.replace(/^https?:\/\//, '') }}</span>
              <span class="font-medium tabular-nums">{{ count }}</span>
            </div>
          </div>
        </template>
      </MetricCard>
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
    <PersonTable
      :members="uniqueMembers"
      :multiTeamMembers="multiTeamMembers"
      :getTeamsForPerson="getTeamsForPerson"
      :memberMetrics="memberMetricsMap"
      :teamKey="team?.key"
      @select="$emit('select-person', $event)"
      @view-history="openPersonHistory"
    />

    <!-- Resolved Issues Modal -->
    <ResolvedIssuesModal
      v-if="showResolvedIssues"
      :title="`${teamDisplayName} — Resolved Issues`"
      :issues="teamMetrics?.resolvedIssues || []"
      @close="showResolvedIssues = false"
    />

    <SnapshotHistoryModal
      v-if="showSnapshotHistory"
      :title="snapshotHistoryTitle"
      :snapshots="snapshotHistoryData"
      :loading="snapshotHistoryLoading"
      :mode="snapshotHistoryMode"
      @close="showSnapshotHistory = false"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import PersonTable from './PersonTable.vue'
import MetricCard from './MetricCard.vue'
import ResolvedIssuesModal from './ResolvedIssuesModal.vue'
import SnapshotHistoryModal from './SnapshotHistoryModal.vue'
import { useRoster } from '@shared/client/composables/useRoster'
import { useGithubStats } from '@shared/client/composables/useGithubStats'
import { useGitlabStats } from '@shared/client/composables/useGitlabStats'
import { getTeamSnapshots, getPersonSnapshots } from '@shared/client/services/api'

const props = defineProps({
  team: { type: Object, required: true },
  teamMetrics: { type: Object, default: null },
  teamDisplayName: { type: String, default: '' }
})

defineEmits(['select-person'])

const { multiTeamMembers, getTeamsForPerson, visibleFields } = useRoster()
const { getContributions } = useGithubStats()
const { getContributions: getGitlabContributions } = useGitlabStats()

const showResolvedIssues = ref(false)
const showSnapshotHistory = ref(false)
const snapshotHistoryData = ref([])
const snapshotHistoryLoading = ref(false)
const snapshotHistoryTitle = ref('')
const snapshotHistoryMode = ref('team')

const uniqueMembers = computed(() => {
  if (!props.team) return []
  const seen = new Set()
  return props.team.members.filter(m => {
    if (seen.has(m.jiraDisplayName)) return false
    seen.add(m.jiraDisplayName)
    return true
  })
})

const uniqueCount = computed(() => uniqueMembers.value.length)

const memberMetricsMap = computed(() => {
  const map = new Map()
  if (props.teamMetrics?.members) {
    for (const m of props.teamMetrics.members) {
      if (m.metrics) {
        map.set(m.jiraDisplayName, m.metrics)
      }
    }
  }
  return map
})

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

const gitlabConfiguredCount = computed(() => uniqueMembers.value.filter(m => m.gitlabUsername).length)

const teamGitlabByInstance = computed(() => {
  const totals = {}
  for (const m of uniqueMembers.value) {
    if (!m.gitlabUsername) continue
    const instances = getGitlabContributions(m.gitlabUsername)?.instances || {}
    for (const [baseUrl, data] of Object.entries(instances)) {
      totals[baseUrl] = (totals[baseUrl] || 0) + (data.totalContributions || 0)
    }
  }
  return totals
})

async function openPersonHistory(member) {
  showSnapshotHistory.value = true
  snapshotHistoryLoading.value = true
  snapshotHistoryTitle.value = `${member.jiraDisplayName || member.name} - Metric History`
  snapshotHistoryMode.value = 'person'
  snapshotHistoryData.value = []
  try {
    const result = await getPersonSnapshots(props.team.key, member.jiraDisplayName || member.name)
    snapshotHistoryData.value = result.snapshots || []
  } catch (err) {
    console.error('Failed to load person snapshots:', err)
  } finally {
    snapshotHistoryLoading.value = false
  }
}

async function openTeamHistory() {
  showSnapshotHistory.value = true
  snapshotHistoryLoading.value = true
  snapshotHistoryTitle.value = `${props.teamDisplayName} - Metric History`
  snapshotHistoryMode.value = 'team'
  snapshotHistoryData.value = []
  try {
    const result = await getTeamSnapshots(props.team.key)
    snapshotHistoryData.value = result.snapshots || []
  } catch (err) {
    console.error('Failed to load team snapshots:', err)
  } finally {
    snapshotHistoryLoading.value = false
  }
}

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
  const teamSlug = props.teamDisplayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const date = new Date().toISOString().slice(0, 10)
  a.download = `${teamSlug}-${date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>
