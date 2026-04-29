<script setup>
import { computed } from 'vue'
import FeatureListItem from './FeatureListItem.vue'

const props = defineProps({
  features: { type: Object, default: () => ({}) },
  selectedFeature: { type: Object, default: null },
  searchQuery: { type: String, default: '' },
  recommendationFilter: { type: String, default: 'all' },
  priorityFilter: { type: String, default: 'all' },
  humanReviewFilter: { type: String, default: 'all' },
  sortBy: { type: String, default: 'default' }
})

const emit = defineEmits([
  'update:searchQuery',
  'update:recommendationFilter',
  'update:priorityFilter',
  'update:humanReviewFilter',
  'update:sortBy',
  'selectFeature'
])

const featureList = computed(() => Object.values(props.features))

const availablePriorities = computed(() => {
  const values = new Set()
  for (const f of featureList.value) {
    if (f.priority) values.add(f.priority)
  }
  return [...values].sort()
})

const sortedAndFilteredFeatures = computed(() => {
  let items = [...featureList.value]

  // Search filter
  const q = props.searchQuery.toLowerCase()
  if (q) {
    items = items.filter(f =>
      f.key.toLowerCase().includes(q) ||
      f.title.toLowerCase().includes(q) ||
      f.sourceRfe.toLowerCase().includes(q)
    )
  }

  // Recommendation filter
  if (props.recommendationFilter !== 'all') {
    items = items.filter(f => f.recommendation === props.recommendationFilter)
  }

  // Priority filter
  if (props.priorityFilter !== 'all') {
    items = items.filter(f => f.priority === props.priorityFilter)
  }

  // Review status filter
  if (props.humanReviewFilter !== 'all') {
    items = items.filter(f => f.humanReviewStatus === props.humanReviewFilter)
  }

  // Sort
  if (props.sortBy === 'score-low') {
    items.sort((a, b) => (a.scores?.total || 0) - (b.scores?.total || 0))
  } else if (props.sortBy === 'score-high') {
    items.sort((a, b) => (b.scores?.total || 0) - (a.scores?.total || 0))
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
        placeholder="Search by key, title, or source RFE..."
        class="flex-1 min-w-[200px] border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
      />

      <select
        :value="recommendationFilter"
        @change="emit('update:recommendationFilter', $event.target.value)"
        class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
      >
        <option value="all">All AI Recommendations</option>
        <option value="approve">AI Recommendation: Approve</option>
        <option value="revise">AI Recommendation: Needs Revision</option>
        <option value="reject">AI Recommendation: Reject</option>
      </select>

      <select
        :value="priorityFilter"
        @change="emit('update:priorityFilter', $event.target.value)"
        class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
      >
        <option value="all">All Priorities</option>
        <option v-for="p in availablePriorities" :key="p" :value="p">{{ p }}</option>
      </select>

      <select
        :value="humanReviewFilter"
        @change="emit('update:humanReviewFilter', $event.target.value)"
        class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
      >
        <option value="all">All Review Status</option>
        <option value="needs-review">Flagged</option>
        <option value="awaiting-review">Awaiting Sign-off</option>
        <option value="approved">Approved</option>
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
      {{ sortedAndFilteredFeatures.length }} feature{{ sortedAndFilteredFeatures.length !== 1 ? 's' : '' }}
    </p>

    <!-- Feature list -->
    <div class="space-y-2">
      <FeatureListItem
        v-for="feature in sortedAndFilteredFeatures"
        :key="feature.key"
        :feature="feature"
        :selected="selectedFeature?.key === feature.key"
        @select="emit('selectFeature', $event)"
      />
      <div v-if="sortedAndFilteredFeatures.length === 0" class="text-center text-gray-400 dark:text-gray-500 py-8">
        No features match the current filters.
      </div>
    </div>
  </div>
</template>
