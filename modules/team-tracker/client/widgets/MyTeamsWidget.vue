<script setup>
import { computed, onMounted } from 'vue'
import { useAuth } from '@shared/client/composables/useAuth.js'
import { useRoster } from '@shared/client/composables/useRoster.js'
import { usePermissions } from '@shared/client/composables/usePermissions.js'
import { useFieldDefinitions } from '@shared/client/composables/useFieldDefinitions.js'
import { useModuleLink } from '@shared/client/composables/useModuleLink.js'

defineProps({
  size: { type: String, default: 'half' }
})

const { navigateTo: crossNavigate } = useModuleLink()
const { user } = useAuth()
const { userUid } = usePermissions()
const { rosterData, loading: rosterLoading, loadRoster } = useRoster()
const { definitions, loading: defsLoading, fetchDefinitions } = useFieldDefinitions()

onMounted(() => {
  loadRoster()
  fetchDefinitions()
})

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

function isCurrentUser(member) {
  const uid = userUid.value
  if (uid && member.uid === uid) return true
  const email = user.value?.email?.toLowerCase()
  return email && member.email?.toLowerCase() === email
}

const myTeams = computed(() => {
  if (!user.value?.email) return []
  return allTeams.value.filter(t => t.members.some(isCurrentUser))
})

function getUserSpeciality(team) {
  if (!engSpecFieldId.value) return null
  const member = team.members.find(isCurrentUser)
  return member?.customFields?.[engSpecFieldId.value] || null
}

function getTeamComponents(metadata) {
  if (!componentTeamFieldId.value || !metadata) return []
  const val = metadata[componentTeamFieldId.value]
  if (Array.isArray(val)) return val
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean)
  return []
}

const loading = computed(() => rosterLoading.value || defsLoading.value)

function handleTeamClick(teamKey) {
  crossNavigate('team-tracker', 'team-detail', { teamKey, from: 'sotu' })
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
    <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">My Teams</h3>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 2" :key="i" class="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 animate-pulse h-20" />
    </div>

    <template v-else>
      <div v-if="myTeams.length === 0" class="flex flex-col items-center justify-center py-8 text-center">
        <svg class="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p class="text-sm text-gray-500 dark:text-gray-400">You are not assigned to any teams.</p>
      </div>

      <div v-else class="space-y-2">
        <button
          v-for="team in myTeams"
          :key="team.key"
          @click="handleTeamClick(team.key)"
          class="w-full bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 p-3 text-left cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{{ team.displayName }}</h4>
          <p v-if="getUserSpeciality(team)" class="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {{ engSpecLabel }}: {{ getUserSpeciality(team) }}
          </p>
          <div v-if="getTeamComponents(team.metadata).length > 0" class="flex flex-wrap gap-1">
            <span
              v-for="comp in getTeamComponents(team.metadata)"
              :key="comp"
              class="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
            >{{ comp }}</span>
          </div>
        </button>
      </div>
    </template>
  </div>
</template>
