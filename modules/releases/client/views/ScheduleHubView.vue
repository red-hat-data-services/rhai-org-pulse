<template>
  <div>
    <div class="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <nav class="mx-auto flex max-w-[1400px] gap-1 px-4 lg:px-8" aria-label="Release schedule views">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="relative px-4 py-3 text-sm font-semibold transition-colors"
          :class="activeTab === tab.id
            ? 'text-primary-600 dark:text-primary-400'
            : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'"
          :aria-current="activeTab === tab.id ? 'page' : undefined"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
          <span
            v-if="activeTab === tab.id"
            class="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-primary-600 dark:bg-primary-400"
          />
        </button>
      </nav>
    </div>

    <ScheduleView v-if="activeTab === 'release-schedule'" @show-aipcc="activeTab = 'aipcc-milestones'" />
    <AipccMilestonesView v-else />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ScheduleView from './ScheduleView.vue'
import AipccMilestonesView from './AipccMilestonesView.vue'

const tabs = [
  { id: 'release-schedule', label: 'Release Schedule' },
  { id: 'aipcc-milestones', label: 'AIPCC Milestones' }
]

const activeTab = ref('release-schedule')
</script>
