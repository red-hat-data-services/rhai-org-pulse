<template>
  <div class="container mx-auto px-6 py-6">
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-xl font-bold text-gray-900">Organization Teams</h2>
      <p class="text-sm text-gray-500">{{ teams.length }} teams &middot; {{ uniqueMemberCount }} unique members</p>
    </div>

    <!-- Org Selector -->
    <div v-if="orgs.length > 0" class="flex flex-wrap gap-2 mb-6">
      <button
        v-for="org in orgs"
        :key="org.key"
        @click="selectOrg(org.key)"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
        :class="selectedOrgKey === org.key
          ? 'bg-primary-600 text-white border-primary-600'
          : 'bg-white text-gray-700 border-gray-300 hover:border-primary-300 hover:bg-primary-50'"
      >
        {{ org.displayName }}
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <p class="text-red-700 text-sm">{{ error }}</p>
    </div>

    <!-- Empty state -->
    <div v-else-if="teams.length === 0" class="text-center py-12">
      <svg class="h-12 w-12 mx-auto text-gray-300 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <p class="text-gray-500">No teams found. Configure roster sync in Settings to populate the team roster.</p>
    </div>

    <!-- Team grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <OrgTeamCard
        v-for="team in teams"
        :key="team.key"
        :team="team"
        @select="$emit('select-team', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import OrgTeamCard from './OrgTeamCard.vue'
import { useRoster } from '../composables/useRoster'

const { orgs, teams, loading, error, uniqueMemberCount, selectedOrgKey, selectOrg } = useRoster()

defineEmits(['select-team'])
</script>
