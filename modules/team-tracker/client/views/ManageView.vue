<template>
  <div class="max-w-5xl mx-auto px-4 py-6">
    <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Manage Teams & Fields</h2>

    <div v-if="!hasAccess" class="text-center py-12 text-gray-500 dark:text-gray-400">
      You do not have permission to access this page.
    </div>

    <template v-else>
      <div class="flex space-x-4 border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="pb-2 px-1 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === tab.id
            ? 'border-primary-600 text-primary-600'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
        >
          {{ tab.label }}
        </button>
      </div>

      <TeamManagement v-if="activeTab === 'teams'" />
      <FieldDefinitionManager v-if="activeTab === 'fields'" />
      <FieldOptionsManager v-if="activeTab === 'field-options'" />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject } from 'vue'
import { usePermissions } from '@shared/client/composables/usePermissions'
import TeamManagement from '../components/TeamManagement.vue'
import FieldDefinitionManager from '../components/FieldDefinitionManager.vue'
import FieldOptionsManager from '../components/FieldOptionsManager.vue'

const { isAdmin, isTeamAdmin, loading } = usePermissions()
const moduleNav = inject('moduleNav')

const tabs = [
  { id: 'teams', label: 'Teams' },
  { id: 'fields', label: 'Fields' },
  { id: 'field-options', label: 'Field Options' }
]

const activeTab = ref('teams')

const hasAccess = computed(() => isAdmin.value || isTeamAdmin.value)

watch(loading, (isLoading) => {
  if (!isLoading && !hasAccess.value && moduleNav) {
    moduleNav.navigateTo('home')
  }
}, { immediate: true })
</script>
