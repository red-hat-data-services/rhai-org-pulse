<template>
  <div
    @click="$emit('click')"
    class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md hover:border-primary-300 dark:hover:border-primary-600 transition-all"
    data-testid="allocation-team-card"
  >
    <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate mb-3" :title="teamName">
      {{ teamName }}
    </h3>

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
import { useAllocationStrategy } from '../../composables/useAllocationStrategy'

const { categories } = useAllocationStrategy()

const props = defineProps({
  teamName: { type: String, required: true },
  totalPoints: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  boardCount: { type: Number, default: 0 },
  percentages: { type: Object, default: () => ({}) },
  buckets: { type: Object, default: () => ({}) },
  metricMode: { type: String, default: 'points' }
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
