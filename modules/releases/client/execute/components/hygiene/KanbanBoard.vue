<script setup>
import { computed } from 'vue'
import FeatureCard from './FeatureCard.vue'

const props = defineProps({
  features: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['feature-click'])

const COLUMNS = [
  { id: 'backlog', label: 'Backlog', statuses: ['New', 'Backlog'] },
  { id: 'todo', label: 'To Do', statuses: ['To Do'] },
  { id: 'refinement', label: 'Refinement', statuses: ['Refinement'] },
  { id: 'in-progress', label: 'In Progress', statuses: ['In Progress', 'Review', 'Testing'] },
  { id: 'release-pending', label: 'Release Pending', statuses: ['Release Pending'] },
  { id: 'done', label: 'Done', statuses: ['Resolved', 'Closed'] }
]

const columns = computed(() => {
  const statusMap = {}
  for (const col of COLUMNS) {
    for (const s of col.statuses) {
      statusMap[s] = col.id
    }
  }

  const grouped = {}
  for (const col of COLUMNS) {
    grouped[col.id] = []
  }

  for (const feature of props.features) {
    const colId = statusMap[feature.status] || 'backlog'
    if (grouped[colId]) {
      grouped[colId].push(feature)
    } else {
      grouped.backlog.push(feature)
    }
  }

  return COLUMNS.map(col => ({
    ...col,
    features: grouped[col.id]
  }))
})

function handleCardClick(feature) {
  emit('feature-click', feature)
}
</script>

<template>
  <div class="pb-2">
    <div class="flex gap-3">
      <div
        v-for="col in columns"
        :key="col.id"
        class="flex-1 min-w-0 flex flex-col bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700"
      >
        <!-- Column header -->
        <div class="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">{{ col.label }}</h3>
          <span class="text-xs font-medium px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
            {{ col.features.length }}
          </span>
        </div>

        <!-- Column body (scrollable) -->
        <div class="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-320px)] min-h-[200px]">
          <FeatureCard
            v-for="feature in col.features"
            :key="feature.key"
            :feature="feature"
            @click="handleCardClick(feature)"
          />
          <div
            v-if="col.features.length === 0"
            class="text-center py-6 text-xs text-gray-400 dark:text-gray-600"
          >
            No features
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
