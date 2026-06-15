<script setup>
import { ref, inject, watch } from 'vue'
import DisconnectedReadinessContent from './DisconnectedReadinessContent.vue'

const COMPONENT_MATURITY_URL = 'https://data-hub.pages.redhat.com/component-maturity/'

const nav = inject('moduleNav')
const activeTab = ref(nav.params.value?.tab || 'maturity')

watch(() => nav.params.value?.tab, (tab) => {
  if (tab) activeTab.value = tab
})
const tabs = [
  { id: 'maturity', label: 'Component maturity' },
  { id: 'disconnected', label: 'Disconnected readiness' }
]
</script>

<template>
  <div class="flex flex-col -mx-6 -my-6 lg:-mx-8" style="min-height: calc(100vh - 4rem)">
    <div class="px-6 lg:px-8 pt-3 bg-white dark:bg-gray-800 shrink-0">
      <div class="flex items-center justify-between gap-4 mb-3">
        <h1 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Component maturity</h1>
        <a
          v-if="activeTab === 'maturity'"
          :href="COMPONENT_MATURITY_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="shrink-0 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
        >Open in new tab</a>
      </div>
      <nav class="flex gap-6 border-b border-gray-200 dark:border-gray-700" aria-label="Component maturity tabs">
        <button
          v-for="tab in tabs" :key="tab.id"
          @click="activeTab = tab.id"
          class="pb-2.5 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === tab.id
            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
        >{{ tab.label }}</button>
      </nav>
    </div>

    <iframe
      v-if="activeTab === 'maturity'"
      :src="COMPONENT_MATURITY_URL"
      title="Component maturity"
      class="w-full flex-1 border-0 bg-white block min-h-0"
      style="height: calc(100vh - 9rem)"
    />
    <div v-else-if="activeTab === 'disconnected'" class="flex-1 px-6 lg:px-8 py-6 overflow-y-auto">
      <DisconnectedReadinessContent />
    </div>
  </div>
</template>
