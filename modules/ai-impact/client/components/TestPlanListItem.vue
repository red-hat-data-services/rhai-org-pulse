<script setup>
import { getVerdictBgClass, getVerdictLabel, getScoreColorClass } from '../utils/test-plan-helpers.js'

defineProps({
  plan: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})

const emit = defineEmits(['select'])
</script>

<template>
  <div
    @click="emit('select', plan)"
    class="p-4 rounded-lg border cursor-pointer transition-all"
    :class="{
      'border-primary-500 bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-500': selected,
      'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700': !selected
    }"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ plan.sourceKey }}</span>
        </div>
        <h4 class="font-medium text-sm truncate dark:text-gray-200">{{ plan.featureName || plan.title }}</h4>
        <div class="flex items-center flex-wrap gap-2 mt-2">
          <span
            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
            :class="getVerdictBgClass(plan.verdict)"
          >
            {{ getVerdictLabel(plan.verdict) }}
          </span>

          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs">
            <span class="font-medium text-gray-500 dark:text-gray-400">Score</span>
            <span :class="getScoreColorClass(plan.score || 0)">{{ plan.score || 0 }}/10</span>
          </span>

          <span v-if="plan.testCaseCount != null" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs">
            <span class="font-medium text-gray-500 dark:text-gray-400">Tests</span>
            <span class="text-gray-800 dark:text-gray-100">{{ plan.testCaseCount }}</span>
          </span>

          <span
            v-for="comp in (plan.components || []).slice(0, 3)"
            :key="comp"
            class="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs"
          >
            {{ comp }}
          </span>
          <span
            v-if="(plan.components || []).length > 3"
            class="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400"
          >
            +{{ plan.components.length - 3 }}
          </span>

          <span
            v-if="plan.autoRevised"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs"
          >
            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Auto-revised
          </span>
        </div>
      </div>
      <div class="flex items-center shrink-0">
        <svg class="h-4 w-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  </div>
</template>
