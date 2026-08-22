<template>
  <div
    data-testid="board-type-info"
    class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
  >
    <div class="flex items-start gap-3">
      <!-- Info icon -->
      <svg class="h-5 w-5 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>

      <div class="flex-1 min-w-0">
        <!-- Always-visible summary line -->
        <p class="text-sm text-gray-800 dark:text-gray-200">
          This team's board was detected as a
          <span class="font-semibold" data-testid="board-type-label">{{ boardTypeLabel }} board</span>.
          {{ summaryLine }}
        </p>

        <!-- Toggle for the detailed explanation -->
        <button
          type="button"
          class="mt-1 inline-flex items-center gap-1 text-sm font-medium text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 focus:outline-none focus:underline"
          :aria-expanded="expanded"
          data-testid="board-type-info-toggle"
          @click="expanded = !expanded"
        >
          {{ expanded ? 'Hide details' : 'How is this calculated?' }}
          <svg
            class="h-4 w-4 transition-transform"
            :class="{ 'rotate-180': expanded }"
            xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <!-- Expandable detail -->
        <div v-if="expanded" data-testid="board-type-info-detail" class="mt-3 space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <p>{{ methodExplanation }}</p>
          <p>
            Each issue is sorted into one of the allocation categories, and the bar below shows how
            that work is split. By default, percentages are weighted by
            <span class="font-medium">story points</span>, so a 5-point issue counts more than a
            1-point one. Use the <span class="font-medium">Points / Issues</span> toggle to weight
            every issue equally instead.
          </p>
          <p class="text-gray-500 dark:text-gray-400">
            Only Bug, Task, Story, Spike, Vulnerability, and Weakness issues are counted. Issues
            without an estimate are excluded from points-based percentages (see the unestimated
            work panel below).
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  // 'scrum' or 'kanban'
  boardType: { type: String, default: 'scrum' }
})

const expanded = ref(false)

const isKanban = computed(() => props.boardType === 'kanban')

const boardTypeLabel = computed(() => (isKanban.value ? 'Kanban' : 'Scrum'))

const summaryLine = computed(() =>
  isKanban.value
    ? "Kanban boards don't have sprints, so allocation is measured over the work completed in the last 2 weeks."
    : 'Allocation is measured across the issues in the selected sprint.'
)

const methodExplanation = computed(() =>
  isKanban.value
    ? 'Because a Kanban board has no sprints, allocation looks at every issue on the board that was resolved in the past 14 days. This is a rolling window that always reflects the most recent two weeks and updates as work is completed.'
    : 'Allocation looks at the issues in the sprint selected above — that could be the active sprint or any recent one. Pick a different sprint from the selector to see how the split changed over time.'
)
</script>
