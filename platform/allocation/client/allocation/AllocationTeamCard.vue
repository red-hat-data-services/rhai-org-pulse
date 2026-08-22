<template>
  <div
    @click="$emit('click')"
    class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 transition-all"
    data-testid="allocation-team-card"
  >
    <div class="flex items-start justify-between gap-2 mb-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate" :title="teamName">
        {{ teamName }}
      </h3>
      <span
        v-if="!configured"
        data-testid="allocation-unconfigured-badge"
        class="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 px-2 py-0.5 text-xs font-medium"
        title="This team hasn't chosen story points vs issue count"
      >
        <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        Not configured
      </span>
    </div>

    <AllocationBar
      :buckets="buckets"
      :totalPoints="totalPoints"
      :totalCount="totalCount"
      :metricMode="metricMode"
      class="mb-3"
    />

    <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400 mb-3">
      <span
        v-for="cat in visibleCategories"
        :key="cat.key"
        class="flex items-center gap-1"
      >
        <span class="inline-block w-2 h-2 rounded-full" :class="`bg-${cat.color}-400`"></span>
        {{ cat.name }} {{ Math.round(percentages[cat.key]) }}%
      </span>
    </div>

    <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
      <span>{{ metricMode === 'counts' ? totalCount : totalPoints }} {{ metricMode === 'counts' ? 'issues' : 'pts' }}</span>
      <span>{{ boardCount }} {{ boardCount === 1 ? 'board' : 'boards' }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AllocationBar from './AllocationBar.vue'
import { useAllocationStrategy } from '../composables/useAllocationStrategy'

const { categories } = useAllocationStrategy()

const props = defineProps({
  teamName: { type: String, required: true },
  totalPoints: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  boardCount: { type: Number, default: 0 },
  percentages: { type: Object, default: () => ({}) },
  buckets: { type: Object, default: () => ({}) },
  metricMode: { type: String, default: 'points' },
  configured: { type: Boolean, default: true }
})

defineEmits(['click'])

const allCategories = computed(() => [
  ...categories.value,
  { key: 'uncategorized', name: 'Uncat.', color: 'gray' }
])

const visibleCategories = computed(() =>
  allCategories.value.filter(cat => props.percentages[cat.key])
)
</script>
