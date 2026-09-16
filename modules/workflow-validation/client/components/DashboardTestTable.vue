<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700/60">
          <th class="px-5 py-3 font-semibold"><button @click="setSort('verdict')">Verdict {{ sortMark('verdict') }}</button></th>
          <th class="px-4 py-3 font-semibold"><button @click="setSort('workflow')">Test {{ sortMark('workflow') }}</button></th>
          <th class="px-4 py-3 font-semibold"><button @click="setSort('rhoai_version')">Version {{ sortMark('rhoai_version') }}</button></th>
          <th class="px-4 py-3 font-semibold"><button @click="setSort('tasks_passed')">Task results {{ sortMark('tasks_passed') }}</button></th>
          <th class="px-4 py-3 font-semibold min-w-72">Product bug</th>
          <th v-if="costsVisible" class="px-4 py-3 font-semibold text-right">AI Cost</th>
          <th class="px-4 py-3 font-semibold"><button @click="setSort('timestamp')">When {{ sortMark('timestamp') }}</button></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="test in sortedTests"
          :key="test.id"
          class="border-b border-gray-50 dark:border-gray-700/40 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
          @click="$emit('select', test)"
        >
          <td class="px-5 py-3"><StatusBadge :value="displayedTestOutcome(test)" /></td>
          <td class="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{{ test.workflow_label || test.workflow || 'Unknown test' }}</td>
          <td class="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-300">{{ test.rhoai_version || '—' }}</td>
          <td class="px-4 py-3 whitespace-nowrap text-xs font-medium">
            <span class="text-green-700 dark:text-green-400">{{ test.tasks_passed ?? '—' }} tasks passed</span>
            <span class="mx-1.5 text-gray-300 dark:text-gray-600">·</span>
            <span class="text-red-700 dark:text-red-400">{{ test.tasks_failed ?? '—' }} tasks failed</span>
          </td>
          <td class="px-4 py-3 text-xs">
            <ProductBugStatus :findings="test.productBugs" :verdict="test.verdict" />
          </td>
          <td v-if="costsVisible" class="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">{{ formatUsd(test.cost_usd) }}</td>
          <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ formatDate(test.timestamp) }}</td>
        </tr>
        <tr v-if="!loading && !tests.length">
          <td :colspan="costsVisible ? 7 : 6" class="px-5 py-10 text-center text-gray-400 dark:text-gray-500">{{ emptyMessage }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import StatusBadge from './StatusBadge.vue'
import ProductBugStatus from './ProductBugStatus.vue'
import { compareTableValues, displayedTestOutcome, formatDate, formatUsd } from '../composables/useWorkflowValidation'

const props = defineProps({
  tests: { type: Array, default: () => [] },
  loading: Boolean,
  costsVisible: Boolean,
  emptyMessage: { type: String, default: 'No tests match the current filters' }
})

defineEmits(['select'])
const sortBy = ref('timestamp')
const sortDir = ref('desc')
const sortedTests = computed(() => [...props.tests].sort((a, b) => {
  const value = (test) => sortBy.value === 'verdict' ? displayedTestOutcome(test) : test[sortBy.value] ?? test.workflow_label
  return compareTableValues(value(a), value(b), sortDir.value)
}))
function setSort(column) {
  sortDir.value = sortBy.value === column && sortDir.value === 'desc' ? 'asc' : 'desc'
  sortBy.value = column
}
function sortMark(column) { return sortBy.value === column ? (sortDir.value === 'desc' ? '↓' : '↑') : '' }
</script>
