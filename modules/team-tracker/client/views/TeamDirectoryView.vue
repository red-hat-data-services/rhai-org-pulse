<script setup>
import { ref, onMounted, inject } from 'vue'
import { useOrgRoster } from '../composables/useOrgRoster'
import OrgSelector from '../components/OrgSelector.vue'
import TeamCard from '../components/TeamCard.vue'

const nav = inject('moduleNav')
const { orgs, selectedOrg, loading, searchQuery, sortBy, filteredTeams, unassigned, loadTeams, loadOrgs } = useOrgRoster()
const unassignedExpanded = ref(false)

function openTeam(team) {
  nav.navigateTo('team-detail', { teamKey: `${team.org}::${team.name}` })
}

function selectOrg(org) {
  selectedOrg.value = org
  loadTeams(org)
}

onMounted(async () => {
  const orgParam = nav.params.value?.org || selectedOrg.value
  await Promise.all([loadTeams(orgParam || undefined), loadOrgs()])

  if (nav.params.value?.org) {
    selectedOrg.value = nav.params.value.org
  }
})
</script>

<template>
  <div>
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Team Directory</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ filteredTeams.length }} teams</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search teams..."
            class="w-64 pl-4 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <select v-model="sortBy" class="h-[38px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          <option value="name">A–Z</option>
          <option value="headcount">Headcount</option>
          <option value="rfe">RFE Count</option>
        </select>
      </div>
    </div>

    <OrgSelector
      v-if="orgs.length > 1"
      :orgs="orgs"
      :model-value="selectedOrg"
      @select="selectOrg"
      class="mb-6"
    />

    <!-- Unassigned people banner -->
    <div v-if="unassigned.length > 0 && !loading" class="mb-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg">
      <button
        @click="unassignedExpanded = !unassignedExpanded"
        class="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div class="flex items-center gap-2">
          <svg class="h-4 w-4 text-amber-500 dark:text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm font-medium text-amber-800 dark:text-amber-300">
            {{ unassigned.length }} {{ unassigned.length === 1 ? 'person' : 'people' }} not assigned to any team
          </span>
        </div>
        <svg
          class="h-4 w-4 text-amber-500 dark:text-amber-400 transition-transform"
          :class="{ 'rotate-180': unassignedExpanded }"
          xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div v-if="unassignedExpanded" class="px-4 pb-3">
        <div class="flex flex-wrap gap-2">
          <span
            v-for="person in unassigned"
            :key="person.name"
            class="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800/30 text-gray-700 dark:text-gray-300"
            :title="[person.title, person.org].filter(Boolean).join(' · ')"
          >
            {{ person.name }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <div v-else-if="filteredTeams.length === 0" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
      <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No Teams Found</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400">Try a different search or org filter.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <TeamCard
        v-for="team in filteredTeams"
        :key="`${team.org}::${team.name}`"
        :team="team"
        @click="openTeam(team)"
      />
    </div>
  </div>
</template>
