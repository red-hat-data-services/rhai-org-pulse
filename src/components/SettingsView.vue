<template>
  <div class="max-w-3xl">
    <h2 class="text-2xl font-bold text-gray-900 mb-6">Settings</h2>

    <!-- Tab bar -->
    <div class="flex border-b border-gray-200 mb-6">
      <button
        @click="activeTab = 'roster'"
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
        :class="activeTab === 'roster'
          ? 'border-primary-600 text-primary-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
      >
        Roster Sync
      </button>
      <button
        @click="activeTab = 'jira'"
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px"
        :class="activeTab === 'jira'
          ? 'border-primary-600 text-primary-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
      >
        Jira Sync
      </button>
    </div>

    <RosterSyncSettings v-if="activeTab === 'roster'" @toast="(t) => $emit('toast', t)" />
    <JiraSyncSettings v-if="activeTab === 'jira'" @toast="(t) => $emit('toast', t)" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import RosterSyncSettings from './RosterSyncSettings.vue'
import JiraSyncSettings from './JiraSyncSettings.vue'

defineEmits(['toast'])

const activeTab = ref('roster')
</script>
