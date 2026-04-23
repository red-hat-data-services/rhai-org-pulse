<template>
  <div>
    <!-- Loading state when team not yet resolved from roster -->
    <div v-if="!team && rosterLoading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Team not found after roster loaded -->
    <div v-else-if="!team" class="flex flex-col items-center justify-center py-12 text-center">
      <svg class="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <p class="text-gray-500 dark:text-gray-400 text-sm">This team has no members or could not be found.</p>
      <button
        @click="nav.goBack()"
        class="mt-4 px-4 py-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
      >
        Back to directory
      </button>
    </div>

    <template v-else>
      <!-- Persistent Header -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-2">
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
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ team.org }}<span v-if="uniqueCount"> · {{ uniqueCount }} members</span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <!-- RFE badge -->
            <span
              v-if="teamDetail?.rfeCount > 0"
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400"
            >
              {{ teamDetail.rfeCount }} open RFEs
            </span>
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
              {{ isRefreshing ? 'Refreshing...' : 'Refresh' }}
            </button>
          </div>
        </div>

        <!-- Enriched header details (from org-teams) -->
        <div v-if="teamDetail" class="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div v-if="teamDetail.productManagers?.length > 0" class="flex items-start gap-1.5">
            <span class="text-gray-400 dark:text-gray-500 shrink-0">PM:</span>
            <span>{{ teamDetail.productManagers.join(', ') }}</span>
          </div>
          <div v-if="teamDetail.engLeads?.length > 0" class="flex items-start gap-1.5">
            <span class="text-gray-400 dark:text-gray-500 shrink-0">Eng Lead:</span>
            <span>
              <template v-for="(lead, i) in teamDetail.engLeads" :key="i">
                <template v-if="i > 0">, </template>
                <button
                  v-if="memberUidByName.get(lead)"
                  @click="navigateToPerson(lead)"
                  class="text-primary-600 dark:text-primary-400 hover:underline"
                >{{ lead }}</button>
                <span v-else>{{ lead }}</span>
              </template>
            </span>
          </div>
          <div v-if="boardLinks.length > 0" class="flex items-center gap-1.5">
            <span class="text-gray-400 dark:text-gray-500 shrink-0">Board{{ boardLinks.length > 1 ? 's' : '' }}:</span>
            <div class="flex gap-2">
              <a
                v-for="(board, i) in boardLinks"
                :key="i"
                :href="board.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary-600 hover:underline"
              >
                {{ board.label }}
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab Bar -->
      <div class="border-b-2 border-gray-200 dark:border-gray-700 mb-6">
        <nav class="flex gap-8">
          <button
            v-for="tab in visibleTabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            class="flex items-center gap-2 pb-3 pt-1 text-base font-medium border-b-2 -mb-[2px] transition-colors"
            :class="activeTab === tab.id
              ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
          >
            <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" v-html="tab.icon"></svg>
            {{ tab.label }}
          </button>
        </nav>
      </div>

      <!-- Tab Panels -->

      <!-- Overview Tab -->
      <div v-if="tabActivated.overview" v-show="activeTab === 'overview'">
        <TeamOverviewTab
          :headcount="teamDetail?.headcount"
          :members="uniqueMembers"
          :teamKey="team?.key"
        />
      </div>

      <!-- Delivery Tab -->
      <div v-if="tabActivated.delivery" v-show="activeTab === 'delivery'">
        <TeamDeliveryTab
          :team="team"
          :teamMetrics="teamMetrics"
          :teamDisplayName="team.displayName"
          @select-person="handleSelectPerson"
        />
      </div>

      <!-- Backlog Tab -->
      <div v-if="tabActivated.backlog" v-show="activeTab === 'backlog'">
        <div v-if="teamDetailError" class="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
          <p class="text-gray-500 dark:text-gray-400 text-sm">
            Component and RFE data is not yet available for this team. Run org sync from Settings to populate.
          </p>
        </div>
        <TeamBacklogTab
          v-else
          :components="teamDetail?.components || []"
          :rfeIssues="teamDetail?.rfeIssues || []"
          :rfeConfig="rfeConfig"
        />
      </div>


      <!-- Refresh Modal -->
      <RefreshModal
        v-if="showRefreshModal"
        :scopeLabel="`Refresh data for team &quot;${team.displayName}&quot; (${uniqueCount} members)`"
        @confirm="handleRefreshConfirm"
        @cancel="showRefreshModal = false"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, inject, watch } from 'vue'
import TeamOverviewTab from '../components/TeamOverviewTab.vue'
import TeamDeliveryTab from '../components/TeamDeliveryTab.vue'
import TeamBacklogTab from '../components/TeamBacklogTab.vue'
import RefreshModal from '@shared/client/components/RefreshModal.vue'
import { useRoster } from '@shared/client/composables/useRoster'
import { useGitlabStats } from '@shared/client/composables/useGitlabStats'
import { useAuth } from '@shared/client/composables/useAuth'
import { useOrgRoster } from '../composables/useOrgRoster'
import { refreshMetrics, getTeamMetrics } from '@shared/client/services/api'

const nav = inject('moduleNav')
const { teams: allTeams, loading: rosterLoading } = useRoster()
const { loadTeamDetail, loadRfeConfig } = useOrgRoster()
const { loadGitlabStats } = useGitlabStats()
const { isAdmin } = useAuth()

// --- Team resolution ---
const team = computed(() => {
  const teamKey = nav.params.value?.teamKey
  if (!teamKey) return null
  return allTeams.value.find(t => t.key === teamKey || t.displayKey === teamKey) || null
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

// --- Org-teams detail (enriched data) ---
const teamDetail = ref(null)
const teamDetailError = ref(false)
const rfeConfig = ref({})

async function fetchTeamDetail() {
  if (!team.value) return
  teamDetailError.value = false
  const detailKey = team.value.displayKey || team.value.key
  try {
    await loadTeamDetail(detailKey, (data) => {
      teamDetail.value = data
    })
  } catch {
    teamDetailError.value = true
  }
}

async function fetchRfeConfig() {
  try {
    rfeConfig.value = await loadRfeConfig()
  } catch {
    // RFE config is optional
  }
}

// --- Delivery metrics ---
const teamMetrics = ref(null)
const isRefreshing = ref(false)
const showRefreshModal = ref(false)

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

// --- People lookup (name -> uid) for linking ---
const memberUidByName = computed(() => {
  const map = new Map()
  for (const t of allTeams.value) {
    for (const m of t.members) {
      if (m.name && m.uid) map.set(m.name, m.uid)
    }
  }
  return map
})

function navigateToPerson(name) {
  const uid = memberUidByName.value.get(name)
  if (uid) {
    nav.navigateTo('person-detail', { uid })
  }
}

// --- Board links ---
const boardLinks = computed(() => {
  const boards = teamDetail.value?.boards
  if (!boards?.length) return []
  return boards.map((board, i) => ({
    url: board.url,
    label: board.name || fallbackBoardLabel(board.url, i)
  }))
})

function fallbackBoardLabel(url, index) {
  try {
    const u = new URL(url)
    return `Board ${index + 1} — ${u.hostname}`
  } catch {
    return `Board ${index + 1}`
  }
}

// --- Tabs ---
const activeTab = ref('overview')
const tabActivated = ref({ overview: true, delivery: false, backlog: false })

const TAB_ICONS = {
  overview: '<path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />',
  delivery: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />',
  backlog: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />',
}

const visibleTabs = computed(() => [
  { id: 'overview', label: 'Overview', icon: TAB_ICONS.overview },
  { id: 'delivery', label: 'Delivery', icon: TAB_ICONS.delivery },
  { id: 'backlog', label: 'RFE Backlog', icon: TAB_ICONS.backlog },
])

watch(activeTab, (tab) => {
  tabActivated.value[tab] = true
})

// --- Navigation ---
function handleSelectPerson(member) {
  if (member.uid) {
    nav.navigateTo('person-detail', { uid: member.uid })
  } else {
    nav.navigateTo('person-detail', { teamKey: team.value?.key, person: member.jiraDisplayName || member.name })
  }
}

// --- Refresh ---
async function handleRefreshConfirm({ force, sources }) {
  showRefreshModal.value = false
  isRefreshing.value = true
  try {
    await refreshMetrics({ scope: 'team', teamKey: team.value.key, force, sources })
  } catch (error) {
    console.error('Failed to refresh team metrics:', error)
  } finally {
    setTimeout(async () => {
      await fetchTeamMetrics()
      isRefreshing.value = false
    }, 3000)
  }
}

// --- Lifecycle ---
onMounted(() => {
  fetchTeamMetrics()
  fetchTeamDetail()
  fetchRfeConfig()
  loadGitlabStats()
})

watch(() => nav.params.value?.teamKey, () => {
  fetchTeamMetrics()
  fetchTeamDetail()
  fetchRfeConfig()
})

// Retry loading once team resolves from roster async load
watch(team, (newVal, oldVal) => {
  if (newVal && !oldVal) {
    if (!teamMetrics.value) fetchTeamMetrics()
    if (!teamDetail.value) fetchTeamDetail()
  }
})
</script>
