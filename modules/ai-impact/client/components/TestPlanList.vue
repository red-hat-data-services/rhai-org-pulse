<script setup>
import { computed } from 'vue'
import TestPlanListItem from './TestPlanListItem.vue'

const props = defineProps({
  testPlans: { type: Object, default: () => ({}) },
  selectedPlan: { type: Object, default: null },
  searchQuery: { type: String, default: '' },
  verdictFilter: { type: String, default: 'all' },
  sortBy: { type: String, default: 'default' }
})

const emit = defineEmits([
  'update:searchQuery',
  'update:verdictFilter',
  'update:sortBy',
  'selectPlan'
])

const planList = computed(() => Object.values(props.testPlans))

const sortedAndFilteredPlans = computed(() => {
  let items = [...planList.value]

  // Search filter
  const q = props.searchQuery.toLowerCase()
  if (q) {
    items = items.filter(p =>
      (p.sourceKey || '').toLowerCase().includes(q) ||
      (p.featureName || p.title || '').toLowerCase().includes(q) ||
      (p.components || []).some(c => c.toLowerCase().includes(q))
    )
  }

  // Verdict filter
  if (props.verdictFilter !== 'all') {
    items = items.filter(p => p.verdict === props.verdictFilter)
  }

  // Sort
  if (props.sortBy === 'score-low') {
    items.sort((a, b) => (a.score || 0) - (b.score || 0))
  } else if (props.sortBy === 'score-high') {
    items.sort((a, b) => (b.score || 0) - (a.score || 0))
  }
  // default: by key (natural order from Object.values)

  return items
})
</script>

<template>
  <div class="p-6">
    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-4">
      <input
        :value="searchQuery"
        @input="emit('update:searchQuery', $event.target.value)"
        type="text"
        placeholder="Search by key, feature name, or component..."
        class="flex-1 min-w-[200px] border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
      />

      <select
        :value="verdictFilter"
        @change="emit('update:verdictFilter', $event.target.value)"
        class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
      >
        <option value="all">All AI Recommendations</option>
        <option value="Ready">AI Recommendation: Ready</option>
        <option value="Revise">AI Recommendation: Revise</option>
        <option value="Rework">AI Recommendation: Rework</option>
      </select>

      <select
        :value="sortBy"
        @change="emit('update:sortBy', $event.target.value)"
        class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
      >
        <option value="default">Sort: Default</option>
        <option value="score-low">Score: Low to High</option>
        <option value="score-high">Score: High to Low</option>
      </select>
    </div>

    <!-- Results count -->
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
      {{ sortedAndFilteredPlans.length }} test plan{{ sortedAndFilteredPlans.length !== 1 ? 's' : '' }}
    </p>

    <!-- Plan list -->
    <div class="space-y-2">
      <TestPlanListItem
        v-for="plan in sortedAndFilteredPlans"
        :key="plan.sourceKey"
        :plan="plan"
        :selected="selectedPlan?.sourceKey === plan.sourceKey"
        @select="emit('selectPlan', $event)"
      />
      <div v-if="sortedAndFilteredPlans.length === 0" class="text-center text-gray-400 dark:text-gray-500 py-8">
        No test plans match the current filters.
      </div>
    </div>
  </div>
</template>
