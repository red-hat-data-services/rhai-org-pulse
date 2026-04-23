<script setup>
import { ref, computed, onMounted } from 'vue'
import RFEListItem from './RFEListItem.vue'

const props = defineProps({
  rfes: { type: Array, default: () => [] },
  filter: { type: String, default: 'all' },
  searchQuery: { type: String, default: '' },
  jiraHost: { type: String, default: null },
  selectedRFE: { type: Object, default: null },
  assessments: { type: Object, default: () => ({}) },
  sortBy: { type: String, default: 'default' },
  passFailFilter: { type: String, default: 'all' },
  priorityFilter: { type: String, default: 'all' },
  statusFilter: { type: String, default: 'all' }
})

const emit = defineEmits(['update:filter', 'update:searchQuery', 'update:sortBy', 'update:passFailFilter', 'update:priorityFilter', 'update:statusFilter', 'selectRFE'])

// Compute unique priorities and statuses from data for dropdown options
const availablePriorities = computed(() => {
  const values = new Set()
  for (const rfe of props.rfes) {
    if (rfe.priority) values.add(rfe.priority)
  }
  return [...values].sort()
})

const availableStatuses = computed(() => {
  const values = new Set()
  for (const rfe of props.rfes) {
    if (rfe.status) values.add(rfe.status)
  }
  return [...values].sort()
})

const sortedAndFilteredRFEs = computed(() => {
  let rfes = [...props.rfes]

  // Apply pass/fail filter
  if (props.passFailFilter !== 'all') {
    rfes = rfes.filter(rfe => {
      const a = props.assessments[rfe.key]
      if (props.passFailFilter === 'pass') return a && a.passFail === 'PASS'
      if (props.passFailFilter === 'fail') return a && a.passFail === 'FAIL'
      if (props.passFailFilter === 'unassessed') return !a
      return true
    })
  }

  // Apply priority filter
  if (props.priorityFilter !== 'all') {
    rfes = rfes.filter(rfe => rfe.priority === props.priorityFilter)
  }

  // Apply status filter
  if (props.statusFilter !== 'all') {
    rfes = rfes.filter(rfe => rfe.status === props.statusFilter)
  }

  // Apply sort
  if (props.sortBy === 'score-asc') {
    rfes.sort((a, b) => {
      const sa = props.assessments[a.key]
      const sb = props.assessments[b.key]
      if (!sa && !sb) return 0
      if (!sa) return 1
      if (!sb) return -1
      return sa.total - sb.total
    })
  } else if (props.sortBy === 'score-desc') {
    rfes.sort((a, b) => {
      const sa = props.assessments[a.key]
      const sb = props.assessments[b.key]
      if (!sa && !sb) return 0
      if (!sa) return 1
      if (!sb) return -1
      return sb.total - sa.total
    })
  }

  return rfes
})

const HINT_KEY = 'ai-impact:rfe-hint-dismissed'
const showHint = ref(false)

onMounted(() => {
  showHint.value = !localStorage.getItem(HINT_KEY)
})

function dismissHint() {
  showHint.value = false
  localStorage.setItem(HINT_KEY, '1')
}

function handleSelectRFE(rfe) {
  dismissHint()
  emit('selectRFE', rfe)
}
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-medium dark:text-gray-200 flex items-center gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        RFE List
        <span class="text-sm font-normal text-gray-500 dark:text-gray-400">({{ sortedAndFilteredRFEs.length }})</span>
      </h3>
      <div class="flex gap-2">
        <div class="relative">
          <svg class="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            :value="searchQuery"
            @input="emit('update:searchQuery', $event.target.value)"
            placeholder="Search by key, summary, reporter..."
            class="pl-8 w-[280px] h-9 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
        <select
          :value="filter"
          @change="emit('update:filter', $event.target.value)"
          class="h-9 border border-gray-300 dark:border-gray-600 rounded-md text-sm px-2 bg-white dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="all">All AI</option>
          <option value="both">Both AI</option>
          <option value="created">Created</option>
          <option value="revised">Revised</option>
          <option value="none">No AI</option>
        </select>
        <select
          :value="passFailFilter"
          @change="emit('update:passFailFilter', $event.target.value)"
          class="h-9 border border-gray-300 dark:border-gray-600 rounded-md text-sm px-2 bg-white dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="all">All Quality</option>
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
          <option value="unassessed">Not Assessed</option>
        </select>
        <select
          :value="priorityFilter"
          @change="emit('update:priorityFilter', $event.target.value)"
          class="h-9 border border-gray-300 dark:border-gray-600 rounded-md text-sm px-2 bg-white dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="all">All Priorities</option>
          <option v-for="p in availablePriorities" :key="p" :value="p">{{ p }}</option>
        </select>
        <select
          :value="statusFilter"
          @change="emit('update:statusFilter', $event.target.value)"
          class="h-9 border border-gray-300 dark:border-gray-600 rounded-md text-sm px-2 bg-white dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="all">All Statuses</option>
          <option v-for="s in availableStatuses" :key="s" :value="s">{{ s }}</option>
        </select>
        <select
          :value="sortBy"
          @change="emit('update:sortBy', $event.target.value)"
          class="h-9 border border-gray-300 dark:border-gray-600 rounded-md text-sm px-2 bg-white dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="default">Sort: Default</option>
          <option value="score-asc">Score: Low to High</option>
          <option value="score-desc">Score: High to Low</option>
        </select>
      </div>
    </div>

    <div
      v-if="showHint && rfes.length > 0"
      class="mb-3 flex items-center justify-between gap-2 rounded-md bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 px-3 py-2 text-sm text-primary-700 dark:text-primary-300"
    >
      <div class="flex items-center gap-2">
        <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Click any RFE to view its full delivery lifecycle</span>
      </div>
      <button @click="dismissHint" class="p-0.5 hover:bg-primary-100 dark:hover:bg-primary-800 rounded">
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div v-if="sortedAndFilteredRFEs.length === 0" class="py-8 text-center text-gray-500 dark:text-gray-400">
      No RFEs match your filters
    </div>

    <div v-else class="space-y-2">
      <RFEListItem
        v-for="rfe in sortedAndFilteredRFEs"
        :key="rfe.key"
        :rfe="rfe"
        :selected="selectedRFE?.key === rfe.key"
        :assessment="assessments[rfe.key] || null"
        @select="handleSelectRFE"
      />
    </div>
  </div>
</template>
