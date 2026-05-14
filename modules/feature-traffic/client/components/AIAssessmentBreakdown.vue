<script setup>
import { ref } from 'vue'

defineProps({
  assessment: { type: Object, required: true },
  detail: { type: Object, default: null }
})

const expandedCriteria = ref({})

function toggleCriterion(name) {
  expandedCriteria.value[name] = !expandedCriteria.value[name]
}

const CRITERIA_LABELS = {
  what: 'What',
  why: 'Why',
  how: 'How',
  task: 'Task',
  size: 'Size'
}

function getScoreClass(score) {
  if (score === 2) return 'bg-green-500'
  if (score === 1) return 'bg-amber-500'
  return 'bg-red-500'
}

function getPassFailClass(passFail) {
  return passFail === 'PASS'
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-300 dark:border-green-700'
    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-700'
}
</script>

<template>
  <div class="space-y-4">
    <!-- Total Score Badge -->
    <div class="flex items-center gap-3">
      <div
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold"
        :class="getPassFailClass(assessment.passFail)"
      >
        <span class="text-lg">{{ assessment.total }}</span>
        <span class="text-xs font-normal">/10</span>
        <span class="ml-1 text-xs font-medium uppercase">{{ assessment.passFail }}</span>
      </div>
    </div>

    <!-- Criterion Rows -->
    <div class="space-y-1">
      <div
        v-for="(label, key) in CRITERIA_LABELS"
        :key="key"
        class="rounded-md"
      >
        <button
          class="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
          :class="{ 'cursor-default': !detail?.latest?.criterionNotes?.[key] }"
          @click="detail?.latest?.criterionNotes?.[key] ? toggleCriterion(key) : null"
        >
          <span class="flex items-center gap-3">
            <span class="font-medium dark:text-gray-200 w-12">{{ label }}</span>
            <!-- Score dots -->
            <span class="flex gap-1">
              <span
                v-for="i in 2"
                :key="i"
                class="w-3 h-3 rounded-full"
                :class="i <= assessment.scores[key] ? getScoreClass(assessment.scores[key]) : 'bg-gray-200 dark:bg-gray-600'"
              />
            </span>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ assessment.scores[key] }}/2</span>
          </span>
          <svg
            v-if="detail?.latest?.criterionNotes?.[key]"
            class="h-3.5 w-3.5 text-gray-400 transition-transform"
            :class="{ 'rotate-180': expandedCriteria[key] }"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <!-- Expandable justification -->
        <div
          v-if="expandedCriteria[key] && detail?.latest?.criterionNotes?.[key]"
          class="px-3 pb-2 pl-8 text-xs text-gray-600 dark:text-gray-400"
        >
          {{ detail.latest.criterionNotes[key] }}
        </div>
      </div>
    </div>

    <!-- Anti-patterns -->
    <div v-if="assessment.antiPatterns && assessment.antiPatterns.length > 0" class="pt-1">
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-1.5">Anti-patterns detected</p>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="pattern in assessment.antiPatterns"
          :key="pattern"
          class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
        >
          {{ pattern }}
        </span>
      </div>
    </div>
  </div>
</template>
