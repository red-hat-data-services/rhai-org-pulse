<script setup>
import { computed } from 'vue'

const props = defineProps({
  violations: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  featureKey: { type: String, default: null },
  jiraBaseUrl: { type: String, default: 'https://issues.redhat.com/browse' }
})

const jiraUrl = computed(() => {
  if (!props.featureKey) return null
  return `${props.jiraBaseUrl}/${props.featureKey}`
})

const CATEGORY_COLORS = {
  ownership: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  timeliness: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  metadata: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  lifecycle: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
}

const CATEGORY_BORDER = {
  ownership: 'border-blue-200 dark:border-blue-500/30',
  timeliness: 'border-amber-200 dark:border-amber-500/30',
  metadata: 'border-purple-200 dark:border-purple-500/30',
  lifecycle: 'border-orange-200 dark:border-orange-500/30',
}

function categoryLabel(cat) {
  if (!cat) return 'Unknown'
  return cat.charAt(0).toUpperCase() + cat.slice(1)
}

function categoryBadgeClass(cat) {
  return CATEGORY_COLORS[cat] || 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
}

function categoryBorderClass(cat) {
  return CATEGORY_BORDER[cat] || 'border-gray-200 dark:border-gray-700'
}

const grouped = computed(() => {
  const groups = {}
  for (const v of props.violations) {
    const cat = v.category || 'unknown'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(v)
  }
  // Sort categories in a stable order
  const order = ['ownership', 'timeliness', 'metadata', 'lifecycle']
  const sorted = []
  for (const cat of order) {
    if (groups[cat]) sorted.push({ category: cat, items: groups[cat] })
  }
  // Any remaining categories not in the predefined order
  for (const cat of Object.keys(groups)) {
    if (!order.includes(cat)) sorted.push({ category: cat, items: groups[cat] })
  }
  return sorted
})
</script>

<template>
  <!-- Loading state -->
  <div v-if="loading" class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-2">
    <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
    Checking hygiene rules...
  </div>

  <!-- All clear -->
  <div
    v-else-if="!violations.length"
    class="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 py-1"
  >
    <svg class="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    All checks passing
  </div>

  <!-- Violations grouped by category -->
  <div v-else class="space-y-4">
    <div v-for="group in grouped" :key="group.category">
      <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        {{ categoryLabel(group.category) }}
      </div>
      <div class="space-y-2">
        <div
          v-for="v in group.items"
          :key="v.id"
          class="border rounded-lg px-3 py-2"
          :class="categoryBorderClass(group.category)"
        >
          <div class="flex items-center gap-2 mb-1">
            <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ v.name }}</span>
            <span
              class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
              :class="categoryBadgeClass(group.category)"
            >{{ categoryLabel(group.category) }}</span>
            <a
              v-if="jiraUrl"
              :href="jiraUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 dark:text-blue-400 hover:text-primary-700 dark:hover:text-blue-300 hover:underline transition-colors shrink-0"
              :aria-label="'Fix ' + v.name + ' in Jira'"
            >Fix in Jira
              <svg class="h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          </div>
          <p class="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{{ v.message }}</p>
          <p v-if="v.remediation" class="text-xs text-gray-500 dark:text-gray-500 leading-relaxed mt-1 italic">{{ v.remediation }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
