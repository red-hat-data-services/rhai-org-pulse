<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import { useAuth } from '@shared/client/composables/useAuth'
import { useOrgList } from '../composables/useOrgList'
import { useAllocationStrategy } from '../composables/useAllocationStrategy'
import { getOrgAllocationSummary, getGlobalAllocationSummary } from '../services/allocation-api'
import { useAllocationRefresh } from '../composables/useAllocationRefresh'
import OrgSelector from '../allocation/OrgSelector.vue'
import AllocationBar from '../allocation/AllocationBar.vue'
import AllocationTeamCard from '../allocation/AllocationTeamCard.vue'
import MetricToggle from '../allocation/MetricToggle.vue'
import AllocationRefreshPanel from '../allocation/AllocationRefreshPanel.vue'

const nav = inject('moduleNav')
const { isAdmin } = useAuth()
const { orgs, loadOrgs } = useOrgList()
const { categories } = useAllocationStrategy()
const { refreshing, message: refreshMessage, triggerRefresh } = useAllocationRefresh()

function handleFullRefresh() {
  triggerRefresh({ onComplete: fetchSummary })
}

const selectedOrg = ref(null)
const metricMode = ref('points')
const loading = ref(false)
const summary = ref(null)
const teamSearch = ref('')

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

function isUnconfigured(team) {
  return team.allocationConfigured === false
}

const unconfiguredCount = computed(() => teams.value.filter(isUnconfigured).length)

const filteredTeams = computed(() => {
  const q = teamSearch.value.trim().toLowerCase()
  const base = q ? teams.value.filter(t => (t.teamName || '').toLowerCase().includes(q)) : teams.value
  // Surface unconfigured teams first so they're impossible to miss.
  return [...base].sort((a, b) => (isUnconfigured(a) ? 0 : 1) - (isUnconfigured(b) ? 0 : 1))
})

// Search is only meaningful once there are teams to search.
const showTeamSearch = computed(() => hasData.value && teams.value.length > 0)

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

watch(selectedOrg, () => {
  teamSearch.value = ''
  fetchSummary()
})

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
          <template v-if="teamSearch.trim()">
            {{ filteredTeams.length }} of {{ teams.length }} {{ teams.length === 1 ? 'team' : 'teams' }} match
          </template>
          <template v-else>
            {{ teams.length }} {{ teams.length === 1 ? 'team' : 'teams' }} across {{ summary?.boardCount || 0 }} boards
          </template>
        </p>
      </div>
      <MetricToggle v-model="metricMode" />
    </div>

    <div
      v-if="orgs.length > 1 || showTeamSearch"
      class="flex flex-col sm:flex-row sm:items-center gap-3 mb-6"
    >
      <OrgSelector
        v-if="orgs.length > 1"
        :orgs="orgs"
        :model-value="selectedOrg"
        @select="selectOrg"
      />

      <!-- Team search — aligned to the right of the org toggle bar -->
      <div v-if="showTeamSearch" class="relative w-full sm:w-64 sm:ml-auto">
        <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          v-model="teamSearch"
          type="text"
          placeholder="Search teams…"
          aria-label="Search teams"
          data-testid="team-search"
          class="w-full border border-gray-300 dark:border-gray-600 rounded-md pl-9 pr-9 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <button
          v-if="teamSearch"
          type="button"
          aria-label="Clear search"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none"
          @click="teamSearch = ''"
        >
          <svg class="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12" role="status" aria-live="polite">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- No data -->
    <template v-else-if="!hasData">
      <AllocationRefreshPanel
        title="No allocation data available"
        :description="isAdmin
          ? 'Allocation data is pulled from Jira on a schedule. Run a full refresh to fetch and classify sprint data across all configured teams. This can take a few minutes.'
          : 'Allocation data is pulled from Jira on a schedule and hasn\'t been populated yet.'"
        button-label="Refresh allocation data"
        :can-refresh="isAdmin"
        :refreshing="refreshing"
        :message="refreshMessage"
        hint="Open a specific team's Allocation tab to refresh just that team, or ask an admin to run a full refresh."
        @refresh="handleFullRefresh"
      />
    </template>

    <template v-else>
      <!-- Blatant call-out: teams that haven't chosen a reporting basis -->
      <div
        v-if="unconfiguredCount > 0"
        data-testid="allocation-unconfigured-callout"
        class="mb-6 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-4 flex items-start gap-3"
      >
        <svg class="h-5 w-5 flex-shrink-0 text-amber-500 dark:text-amber-400 mt-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div>
          <h3 class="text-sm font-semibold text-amber-900 dark:text-amber-100">
            {{ unconfiguredCount }} of {{ teams.length }} {{ teams.length === 1 ? 'team' : 'teams' }} haven't configured allocation reporting
          </h3>
          <p class="text-sm text-amber-800 dark:text-amber-200 mt-0.5">
            These teams haven't chosen whether allocation is measured by story points or issue count, so their
            numbers here fall back to story points. They're tagged <span class="font-medium">Not configured</span> below.
          </p>
        </div>
      </div>

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

      <template v-else>
        <!-- No teams match the search -->
        <div v-if="filteredTeams.length === 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p class="text-sm text-gray-500 dark:text-gray-400">No teams match "{{ teamSearch }}".</p>
        </div>

        <!-- Team cards grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AllocationTeamCard
            v-for="team in filteredTeams"
            :key="team.teamId"
            :teamName="team.teamName"
            :totalPoints="team.totalPoints || 0"
            :totalCount="team.totalCount || 0"
            :boardCount="team.boardCount || 0"
            :percentages="team.percentages || {}"
            :buckets="teamBuckets(team)"
            :metricMode="metricMode"
            :configured="team.allocationConfigured !== false"
            @click="openTeam(team)"
          />
        </div>
      </template>
    </template>
  </div>
</template>
