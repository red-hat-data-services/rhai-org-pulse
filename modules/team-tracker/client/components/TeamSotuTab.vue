<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuth } from '@shared/client/composables/useAuth.js'
import { useRoster } from '@shared/client/composables/useRoster.js'
import { usePermissions } from '@shared/client/composables/usePermissions.js'
import { useFieldDefinitions } from '@shared/client/composables/useFieldDefinitions.js'
import { useModuleLink } from '@shared/client/composables/useModuleLink.js'
import { useManagerDashboard } from '../composables/useManagerDashboard.js'

const { navigateTo: crossNavigate } = useModuleLink()

const { user, isManager } = useAuth()
const { userUid } = usePermissions()
const { rosterData, loading: rosterLoading, loadRoster } = useRoster()
const { definitions, loading: defsLoading, fetchDefinitions } = useFieldDefinitions()
const {
  teams: managedTeams,
  loading: managerLoading,
  includeIndirect,
  load: loadManagerDashboard
} = useManagerDashboard()

const managerLoadFailed = ref(false)

onMounted(() => {
  loadRoster()
  fetchDefinitions()
  if (isManager.value) {
    // Reset to direct-only to avoid inheriting toggled state from dashboard view
    includeIndirect.value = false
    loadManagerDashboard().catch(() => {
      managerLoadFailed.value = true
    })
  }
})

// Dynamic field resolution
const engSpecFieldId = computed(() => {
  const pf = definitions.value?.personFields || []
  const primary = pf.find(f => f.primaryDisplay && !f.deleted)
  return primary?.id || null
})

const engSpecLabel = computed(() => {
  const pf = definitions.value?.personFields || []
  const primary = pf.find(f => f.primaryDisplay && !f.deleted)
  return primary?.label || null
})

const componentTeamFieldId = computed(() => {
  const tf = definitions.value?.teamFields || []
  const comp = tf.find(f => f.optionsRef === 'component' && !f.deleted)
  return comp?.id || null
})

// Build unfiltered team list from rosterData (avoids selectedOrgKey filtering)
const allTeams = computed(() => {
  const orgs = rosterData.value?.orgs || []
  const result = []
  for (const org of orgs) {
    if (!org.teams) continue
    for (const [teamName, team] of Object.entries(org.teams)) {
      result.push({
        key: `${org.key}::${teamName}`,
        displayName: team.displayName,
        members: team.members,
        metadata: team.metadata || {}
      })
    }
  }
  return result
})

// Match current user to roster entries via uid (from permissions) or email
function isCurrentUser(member) {
  const uid = userUid.value
  if (uid && member.uid === uid) return true
  const email = user.value?.email?.toLowerCase()
  return email && member.email?.toLowerCase() === email
}

// Find current user's teams
const myTeams = computed(() => {
  if (!user.value?.email) return []
  return allTeams.value.filter(t => t.members.some(isCurrentUser))
})

// For team member view: get user's speciality from a team's member list
function getUserSpeciality(team) {
  if (!engSpecFieldId.value) return null
  const member = team.members.find(isCurrentUser)
  return member?.customFields?.[engSpecFieldId.value] || null
}

// Get team components from metadata
function getTeamComponents(metadata) {
  if (!componentTeamFieldId.value || !metadata) return []
  const val = metadata[componentTeamFieldId.value]
  if (Array.isArray(val)) return val
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean)
  return []
}

const loading = computed(() => {
  if (rosterLoading.value || defsLoading.value) return true
  // Don't block on manager dashboard if it failed (403, network error)
  if (isManager.value && managerLoading.value && !managerLoadFailed.value) return true
  return false
})

function handleTeamClick(teamKey) {
  crossNavigate('team-tracker', 'team-detail', { teamKey, from: 'sotu' })
}

function handleMyTeamsClick() {
  crossNavigate('team-tracker', 'manager-dashboard', { from: 'sotu' })
}
</script>

<template>
  <div class="max-w-[90rem] mx-auto space-y-6">
    <!-- Loading skeleton -->
    <template v-if="loading">
      <div class="space-y-4">
        <div class="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="i in 3" :key="i" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <div class="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-3"></div>
            <div class="h-4 w-24 bg-gray-100 dark:bg-gray-600 rounded animate-pulse mb-3"></div>
            <div class="flex gap-2">
              <div class="h-5 w-20 bg-gray-100 dark:bg-gray-600 rounded-full animate-pulse"></div>
              <div class="h-5 w-16 bg-gray-100 dark:bg-gray-600 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Loaded content -->
    <template v-else>
      <!-- Manager view -->
      <template v-if="isManager">
        <!-- Managed teams section -->
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Managed Teams</h2>

          <div v-if="managerLoadFailed" class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            Unable to load managed teams. Visit the <button class="underline font-medium" @click="handleMyTeamsClick">Manager Dashboard</button> for details.
          </div>

          <div v-else-if="managedTeams.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
            No managed teams found.
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              v-for="team in managedTeams"
              :key="team.id"
              @click="handleTeamClick(`${team.orgKey}::${team.name}`)"
              class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 text-left cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">{{ team.name }}</h3>

              <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {{ team.directReportUids?.length || 0 }} direct reports · {{ team.totalMemberCount || 0 }} total members
              </p>

              <div v-if="getTeamComponents(team.metadata).length > 0" class="flex flex-wrap gap-1.5">
                <span
                  v-for="comp in getTeamComponents(team.metadata)"
                  :key="comp"
                  class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                >
                  {{ comp }}
                </span>
              </div>
            </button>
          </div>
        </div>

        <!-- My Teams link card -->
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Links</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              @click="handleMyTeamsClick"
              class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 text-left cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              <div class="flex items-center gap-3">
                <div class="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg text-primary-600 dark:text-primary-400">
                  <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
                <div>
                  <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">My Teams</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">View your full manager dashboard</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </template>

      <!-- Team member view (non-manager) -->
      <template v-else>
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">My Teams</h2>

          <div v-if="myTeams.length === 0" class="flex flex-col items-center justify-center py-12 text-center">
            <svg class="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p class="text-sm text-gray-500 dark:text-gray-400">You are not assigned to any teams.</p>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              v-for="team in myTeams"
              :key="team.key"
              @click="handleTeamClick(team.key)"
              class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 text-left cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">{{ team.displayName }}</h3>

              <p v-if="getUserSpeciality(team)" class="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {{ engSpecLabel }}: {{ getUserSpeciality(team) }}
              </p>

              <div v-if="getTeamComponents(team.metadata).length > 0" class="flex flex-wrap gap-1.5">
                <span
                  v-for="comp in getTeamComponents(team.metadata)"
                  :key="comp"
                  class="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                >
                  {{ comp }}
                </span>
              </div>
            </button>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
