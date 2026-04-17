<template>
  <div class="space-y-6">
    <!-- Sync Status Panel (above tabs) -->
    <SyncStatusPanel @toast="$emit('toast', $event)" />

    <!-- Sub-tabs for Team Tracker settings -->
    <div class="flex space-x-4 border-b border-gray-200 dark:border-gray-700">
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

    <PeopleAndTeamsSettings v-if="activeTab === 'people-teams'" @config-saved="handleConfigSaved" @toast="$emit('toast', $event)" />
    <JiraSyncSettings v-if="activeTab === 'jira-sync'" />
    <SnapshotSettings v-if="activeTab === 'snapshots'" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import SyncStatusPanel from './SyncStatusPanel.vue'
import PeopleAndTeamsSettings from './PeopleAndTeamsSettings.vue'
import JiraSyncSettings from './JiraSyncSettings.vue'
import SnapshotSettings from './SnapshotSettings.vue'
import { useSyncStatus } from '../composables/useSyncStatus'

defineEmits(['toast'])

const { markConfigDirty } = useSyncStatus()

const tabs = [
  { id: 'people-teams', label: 'People & Teams' },
  { id: 'jira-sync', label: 'Jira Sync' },
  { id: 'snapshots', label: 'Snapshots' }
]

const activeTab = ref('people-teams')

function handleConfigSaved(payload) {
  if (payload?.structureAffecting) {
    markConfigDirty()
  }
}
</script>
