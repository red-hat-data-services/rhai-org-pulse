<script setup>
import { getRecommendationClass, getRecommendationLabel, getRecommendationTooltip, getReviewStatusClass, getReviewStatusLabel, getReviewStatusTooltip } from '../utils/feature-helpers.js'
import InfoBubble from './InfoBubble.vue'

defineProps({
  feature: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})

const emit = defineEmits(['select'])
</script>

<template>
  <div
    @click="emit('select', feature)"
    class="p-4 rounded-lg border cursor-pointer transition-all"
    :class="{
      'border-primary-500 bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-500': selected,
      'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700': !selected
    }"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ feature.key }}</span>
        </div>
        <h4 class="font-medium text-sm truncate dark:text-gray-200">{{ feature.title }}</h4>
        <div class="flex items-center flex-wrap gap-2 mt-2">
          <span class="inline-flex items-center">
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              :class="getRecommendationClass(feature.recommendation)"
            >
              <span class="font-medium opacity-75">AI</span>
              {{ getRecommendationLabel(feature.recommendation) }}
            </span>
            <InfoBubble :text="getRecommendationTooltip(feature.recommendation)" />
          </span>
          <span class="inline-flex items-center">
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              :class="getReviewStatusClass(feature.humanReviewStatus)"
            >
              <svg v-if="feature.humanReviewStatus === 'needs-review'" class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span class="font-medium opacity-75">Review</span>
              {{ getReviewStatusLabel(feature.humanReviewStatus) }}
            </span>
            <InfoBubble :text="getReviewStatusTooltip(feature.humanReviewStatus)" />
          </span>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs">
            <span class="font-medium text-gray-500 dark:text-gray-400">Score</span>
            <span class="text-gray-800 dark:text-gray-100">{{ feature.scores?.total || 0 }}/8</span>
          </span>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs">
            <span class="font-medium text-gray-500 dark:text-gray-400">Priority</span>
            <span class="text-gray-800 dark:text-gray-100">{{ feature.priority }}</span>
          </span>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs">
            <span class="font-medium text-gray-500 dark:text-gray-400">Source</span>
            <span class="text-gray-800 dark:text-gray-100">{{ feature.sourceRfe }}</span>
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
