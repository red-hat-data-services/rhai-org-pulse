<script setup>
import { computed } from 'vue'
import {
  getReviewStatusClass, getReviewStatusLabel, getReviewStatusTooltip,
  getDesignStatusClass, getDesignStatusLabel, getMeaningfulDesignReviewStatus,
  getInvolvementLabel, getInvolvementClass
} from '../utils/feature-helpers.js'
import InfoBubble from './InfoBubble.vue'

const props = defineProps({
  feature: { type: Object, required: true },
  selected: { type: Boolean, default: false }
})

const emit = defineEmits(['select'])

const reviewStatus = computed(() => getMeaningfulDesignReviewStatus(props.feature))
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
          <span
            v-if="getDesignStatusLabel(feature.designPrStatus)"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            :class="getDesignStatusClass(feature.designPrStatus)"
          >
            {{ getDesignStatusLabel(feature.designPrStatus) }}
          </span>
          <span
            v-else
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            :class="getInvolvementClass(feature.aiInvolvement)"
          >
            {{ getInvolvementLabel(feature.aiInvolvement) }}
          </span>
        </div>
        <h4 class="font-medium text-sm truncate dark:text-gray-200">{{ feature.title }}</h4>
        <div v-if="feature.designPrStatus != null" class="flex items-center flex-wrap gap-2 mt-2">
          <span v-if="reviewStatus" class="inline-flex items-center">
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              :class="getReviewStatusClass(reviewStatus)"
            >
              <svg v-if="reviewStatus === 'needs-review'" class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <span class="font-medium opacity-75">Review</span>
              {{ getReviewStatusLabel(reviewStatus) }}
            </span>
            <InfoBubble :text="getReviewStatusTooltip(reviewStatus)" />
          </span>
          <span v-if="feature.created" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs">
            <span class="font-medium text-gray-500 dark:text-gray-400">Created</span>
            <span class="text-gray-800 dark:text-gray-100">{{ new Date(feature.created).toLocaleDateString() }}</span>
          </span>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs">
            <span class="font-medium text-gray-500 dark:text-gray-400">Score</span>
            <span class="text-gray-800 dark:text-gray-100">{{ feature.scores?.total != null ? `${feature.scores.total}/8` : 'N/A' }}</span>
          </span>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs">
            <span class="font-medium text-gray-500 dark:text-gray-400">Priority</span>
            <span class="text-gray-800 dark:text-gray-100 capitalize">{{ feature.priority }}</span>
          </span>
        </div>
      </div>
      <div class="flex items-center gap-1 shrink-0">
        <a
          v-if="feature.prdPrUrl"
          :href="feature.prdPrUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-blue-500 dark:text-blue-400"
          title="View PRD pull request on GitHub"
          @click.stop
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        <a
          v-if="feature.designPrUrl"
          :href="feature.designPrUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-purple-500 dark:text-purple-400"
          title="View design pull request on GitHub"
          @click.stop
        >
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        <svg class="h-4 w-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  </div>
</template>
