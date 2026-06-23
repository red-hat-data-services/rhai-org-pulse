<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import { useOrgRoster } from '../composables/useOrgRoster'
import { useAllocationStrategy } from '../composables/useAllocationStrategy'
import { getOrgAllocationSummary, getGlobalAllocationSummary } from '../services/allocation-api'
import OrgSelector from '../components/OrgSelector.vue'
import AllocationBar from '../components/allocation/AllocationBar.vue'
import AllocationTeamCard from '../components/allocation/AllocationTeamCard.vue'
import MetricToggle from '../components/allocation/MetricToggle.vue'

const nav = inject('moduleNav')
const { orgs, loadOrgs } = useOrgRoster()
const { categories } = useAllocationStrategy()

const selectedOrg = ref(null)
const metricMode = ref('points')
const loading = ref(false)
const summary = ref(null)

async function fetchSummary() {
  loading.value = true
  try {
    if (selectedOrg.value) {
      summary.value = await getOrgAllocationSummary(selectedOrg.value)
    } else {
      summary.value = await getGlobalAllocationSummary()
    }
  } catch (err) {
    console.error('Failed to fetch allocation summary:', err)
    summary.value = null
  } finally {
    loading.value = false
  }
}

function selectOrg(org) {
  selectedOrg.value = org
}

function openTeam(team) {
  const orgKey = team.orgKey || summary.value?.orgKey || selectedOrg.value
  if (orgKey) {
    nav.navigateTo('team-detail', { teamKey: `${orgKey}::${team.teamName}`, tab: 'allocation' })
  }
}

const hasData = computed(() => {
  if (!summary.value) return false
  return summary.value.totalPoints > 0 || summary.value.totalCount > 0
})

const teams = computed(() => summary.value?.teams || [])

const statCards = computed(() => {
  if (!summary.value) return []
  const s = summary.value
  const items = [
    { label: metricMode.value === 'counts' ? 'Total Issues' : 'Total Points', value: metricMode.value === 'counts' ? s.totalCount : s.totalPoints },
    { label: 'Teams', value: s.teamCount || teams.value.length },
    { label: 'Boards', value: s.boardCount || 0 },
  ]
  if (s.estimatedIssueCount != null) {
    items.push({ label: 'Estimated', value: s.estimatedIssueCount })
    items.push({ label: 'Unestimated', value: s.unestimatedIssueCount || 0 })
  }
  return items
})

// Reconstruct bucket data from percentages when team.buckets is missing
function teamBuckets(team) {
  if (team.buckets) return team.buckets
  const buckets = {}
  const p = team.percentages || {}
  const keys = [...categories.value.map(c => c.key), 'uncategorized']
  for (const key of keys) {
    const pct = p[key] || 0
    buckets[key] = {
      points: Math.round((pct / 100) * (team.totalPoints || 0)),
      count: Math.round((pct / 100) * (team.totalCount || 0))
    }
  }
  return buckets
}

watch(selectedOrg, fetchSummary)

onMounted(() => {
  loadOrgs()
  fetchSummary()
})
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <div>
        <p v-if="hasData" class="text-sm text-gray-500 dark:text-gray-400">
          {{ teams.length }} {{ teams.length === 1 ? 'team' : 'teams' }} across {{ summary?.boardCount || 0 }} boards
        </p>
      </div>
      <MetricToggle v-model="metricMode" />
    </div>

    <OrgSelector
      v-if="orgs.length > 1"
      :orgs="orgs"
      :model-value="selectedOrg"
      @select="selectOrg"
      class="mb-6"
    />

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12" role="status" aria-live="polite">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- No data -->
    <template v-else-if="!hasData">
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No allocation data available</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">Run an allocation refresh from Settings to populate.</p>
      </div>
    </template>

    <template v-else>
      <!-- Aggregate allocation bar -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <AllocationBar
          :buckets="summary.buckets"
          :totalPoints="summary.totalPoints"
          :totalCount="summary.totalCount"
          :metricMode="metricMode"
        />
      </div>

      <!-- Summary stats -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <div
          v-for="stat in statCards"
          :key="stat.label"
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center"
        >
          <div class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ stat.value }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400">{{ stat.label }}</div>
        </div>
      </div>

      <!-- No teams in this org -->
      <div v-if="teams.length === 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <p class="text-sm text-gray-500 dark:text-gray-400">No teams with allocation data in this org.</p>
      </div>

      <!-- Team cards grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AllocationTeamCard
          v-for="team in teams"
          :key="team.teamId"
          :teamName="team.teamName"
          :totalPoints="team.totalPoints || 0"
          :totalCount="team.totalCount || 0"
          :boardCount="team.boardCount || 0"
          :percentages="team.percentages || {}"
          :buckets="teamBuckets(team)"
          :metricMode="metricMode"
          @click="openTeam(team)"
        />
      </div>
    </template>
  </div>
</template>
