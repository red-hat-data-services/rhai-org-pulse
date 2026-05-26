<template>
  <div>
    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="flex -mb-px px-4" aria-label="Execute sub-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="px-4 py-3 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === tab.id
            ? 'border-primary-500 text-primary-600 dark:text-primary-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
        >
          {{ tab.label }}
        </button>
      </nav>
    </div>
    <div class="p-6">
      <OverviewView v-if="activeTab === 'feature-list'" />
      <HygieneView v-else-if="activeTab === 'feature-status'" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, inject } from 'vue'
import OverviewView from '../execute/views/OverviewView.vue'
import HygieneView from '../execute/views/HygieneView.vue'

const nav = inject('moduleNav')

const tabs = [
  { id: 'feature-list', label: 'Feature List' },
  { id: 'feature-status', label: 'Feature Status' },
]

const VALID_TABS = tabs.map(t => t.id)
const DEFAULT_TAB = 'feature-list'

const activeTab = ref(DEFAULT_TAB)

let updatingFromUrl = false

watch(activeTab, (tab) => {
  if (!updatingFromUrl) {
    nav.updateParams({ tab: tab === DEFAULT_TAB ? undefined : tab })
  }
})

watch(() => nav.params.value?.tab, (tabParam) => {
  const tab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : DEFAULT_TAB
  if (activeTab.value !== tab) {
    updatingFromUrl = true
    activeTab.value = tab
    nextTick(() => { updatingFromUrl = false })
  }
}, { immediate: true })
</script>
