<script setup>
import { computed, onMounted, ref } from 'vue'
import { useAuth } from '@shared/client/composables/useAuth.js'
import { useFieldDefinitions } from '@shared/client/composables/useFieldDefinitions.js'
import { useModuleLink } from '@shared/client/composables/useModuleLink.js'
import { useManagerDashboard } from '../composables/useManagerDashboard.js'

defineProps({
  size: { type: String, default: 'full' }
})

const { navigateTo: crossNavigate } = useModuleLink()
const { isManager } = useAuth()
const { definitions, fetchDefinitions } = useFieldDefinitions()
const {
  teams: managedTeams,
  loading: managerLoading,
  includeIndirect,
  load: loadManagerDashboard
} = useManagerDashboard()

const managerLoadFailed = ref(false)

const componentTeamFieldId = computed(() => {
  const tf = definitions.value?.teamFields || []
  const comp = tf.find(f => f.optionsRef === 'component' && !f.deleted)
  return comp?.id || null
})

function getTeamComponents(metadata) {
  if (!componentTeamFieldId.value || !metadata) return []
  const val = metadata[componentTeamFieldId.value]
  if (Array.isArray(val)) return val
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean)
  return []
}

onMounted(() => {
  fetchDefinitions()
  if (isManager.value) {
    includeIndirect.value = false
    loadManagerDashboard().catch(() => {
      managerLoadFailed.value = true
    })
  }
})

const loading = computed(() => {
  if (!isManager.value) return false
  return managerLoading.value && !managerLoadFailed.value
})

function handleTeamClick(teamKey) {
  crossNavigate('team-tracker', 'team-detail', { teamKey, from: 'sotu' })
}

function handleMyTeamsClick() {
  crossNavigate('team-tracker', 'manager-dashboard', { from: 'sotu' })
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
    <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Managed Teams</h3>

    <div v-if="!isManager" class="text-sm text-gray-500 dark:text-gray-400">
      This widget is for managers. Visit <button class="text-primary-600 hover:underline" @click="handleMyTeamsClick">My Teams</button> for your team memberships.
    </div>

    <div v-else-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 3" :key="i" class="bg-gray-100 dark:bg-gray-700 rounded-lg p-5 animate-pulse h-24" />
    </div>

    <div v-else-if="managerLoadFailed" class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
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
        class="bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 p-4 text-left cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{{ team.name }}</h4>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {{ team.directReportUids?.length || 0 }} direct reports · {{ team.totalMemberCount || 0 }} total
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
  </div>
</template>
