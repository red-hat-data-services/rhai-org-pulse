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
      <span v-if="percentages['tech-debt-quality']" class="flex items-center gap-1">
        <span class="inline-block w-2 h-2 rounded-full bg-amber-400"></span>
        Tech Debt {{ Math.round(percentages['tech-debt-quality']) }}%
      </span>
      <span v-if="percentages['new-features']" class="flex items-center gap-1">
        <span class="inline-block w-2 h-2 rounded-full bg-blue-400"></span>
        Features {{ Math.round(percentages['new-features']) }}%
      </span>
      <span v-if="percentages['learning-enablement']" class="flex items-center gap-1">
        <span class="inline-block w-2 h-2 rounded-full bg-green-400"></span>
        Learning {{ Math.round(percentages['learning-enablement']) }}%
      </span>
      <span v-if="percentages['uncategorized']" class="flex items-center gap-1">
        <span class="inline-block w-2 h-2 rounded-full bg-gray-400"></span>
        Uncat. {{ Math.round(percentages['uncategorized']) }}%
      </span>
    </div>

    <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
      <span>{{ metricMode === 'counts' ? totalCount : totalPoints }} {{ metricMode === 'counts' ? 'issues' : 'pts' }}</span>
      <span>{{ boardCount }} {{ boardCount === 1 ? 'board' : 'boards' }}</span>
    </div>
  </div>
</template>

<script setup>
import AllocationBar from './AllocationBar.vue'

defineProps({
  teamName: { type: String, required: true },
  totalPoints: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  boardCount: { type: Number, default: 0 },
  percentages: { type: Object, default: () => ({}) },
  buckets: { type: Object, default: () => ({}) },
  metricMode: { type: String, default: 'points' }
})

defineEmits(['click'])
</script>
