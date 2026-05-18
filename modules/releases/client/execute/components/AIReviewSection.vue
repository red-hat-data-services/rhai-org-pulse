<script setup>
import {
  getRecommendationClass,
  getRecommendationLabel,
  getRecommendationTooltip,
  getScoreClass,
  getReviewStatusClass,
  getReviewStatusLabel,
  getReviewStatusTooltip
} from '../utils/ai-review-helpers.js'
import AIInfoBubble from './AIInfoBubble.vue'

defineProps({
  featureReview: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null }
})

const DIMENSIONS = ['feasibility', 'testability', 'scope', 'architecture']
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">AI Review</h2>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
      Loading AI review data...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3 text-red-700 dark:text-red-400 text-sm">
      {{ error }}
    </div>

    <!-- Empty state -->
    <div v-else-if="!featureReview" class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
      <p class="text-sm text-gray-500 dark:text-gray-400">No AI review data available for this feature.</p>
    </div>

    <!-- Feature review data -->
    <template v-else>
      <!-- Metadata grid -->
      <div class="grid grid-cols-3 gap-4 mb-6 text-sm">
        <div>
          <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">AI Recommendation</p>
          <span class="inline-flex items-center">
            <span
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              :class="getRecommendationClass(featureReview.latest?.recommendation)"
            >
              {{ getRecommendationLabel(featureReview.latest?.recommendation) }}
            </span>
            <AIInfoBubble :text="getRecommendationTooltip(featureReview.latest?.recommendation)" />
          </span>
        </div>
        <div>
          <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Review Status</p>
          <span class="inline-flex items-center">
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
              :class="getReviewStatusClass(featureReview.latest?.humanReviewStatus)"
            >
              <svg v-if="featureReview.latest?.humanReviewStatus === 'needs-review'" class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              {{ getReviewStatusLabel(featureReview.latest?.humanReviewStatus) }}
            </span>
            <AIInfoBubble :text="getReviewStatusTooltip(featureReview.latest?.humanReviewStatus)" />
          </span>
        </div>
        <div>
          <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Score</p>
          <p class="font-bold" :class="getScoreClass(Math.round((featureReview.latest?.scores?.total || 0) / 2))">
            {{ featureReview.latest?.scores?.total || 0 }}/8
          </p>
        </div>
        <div>
          <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Priority</p>
          <span class="inline-flex items-center px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-xs capitalize dark:text-gray-300">
            {{ featureReview.latest?.priority || 'N/A' }}
          </span>
        </div>
        <div>
          <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Size</p>
          <p class="font-medium dark:text-gray-200">{{ featureReview.latest?.size || 'N/A' }}</p>
        </div>
        <div>
          <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Status</p>
          <p class="font-medium dark:text-gray-200">{{ featureReview.latest?.status || 'N/A' }}</p>
        </div>
      </div>

      <!-- Approval info -->
      <div v-if="featureReview.latest?.humanReviewStatus === 'approved' && featureReview.latest?.approvedBy" class="mb-6 px-3 py-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
        <div class="flex items-center gap-2 text-sm text-green-800 dark:text-green-300">
          <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span>
            Approved by <span class="font-medium">{{ featureReview.latest.approvedBy }}</span>
            <span v-if="featureReview.latest.approvedAt" class="text-green-600 dark:text-green-400">
              on {{ new Date(featureReview.latest.approvedAt).toLocaleDateString() }}
            </span>
          </span>
        </div>
      </div>

      <!-- Dimension Scores -->
      <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
        <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Dimension Scores</h4>
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="dim in DIMENSIONS"
            :key="dim"
            class="p-3 rounded-lg border border-gray-200 dark:border-gray-600"
          >
            <p class="text-xs text-gray-500 dark:text-gray-400 capitalize mb-1">{{ dim }}</p>
            <div class="flex items-center justify-between">
              <span class="text-lg font-bold" :class="getScoreClass(featureReview.latest?.scores?.[dim])">
                {{ featureReview.latest?.scores?.[dim] ?? 0 }}/2
              </span>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                :class="getRecommendationClass(featureReview.latest?.reviewers?.[dim])"
              >
                {{ featureReview.latest?.reviewers?.[dim] === 'approve' ? 'Pass' : featureReview.latest?.reviewers?.[dim] === 'revise' ? 'Revise' : featureReview.latest?.reviewers?.[dim] === 'reject' ? 'Fail' : getRecommendationLabel(featureReview.latest?.reviewers?.[dim]) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Feature Review History -->
      <div v-if="featureReview.history?.length > 0" class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
        <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Score History</h4>
        <div class="space-y-2">
          <div
            v-for="(entry, idx) in featureReview.history"
            :key="idx"
            class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
          >
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {{ new Date(entry.reviewedAt).toLocaleDateString() }}
            </span>
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium" :class="getScoreClass(Math.round((entry.scores?.total || 0) / 2))">
                {{ entry.scores?.total || 0 }}/8
              </span>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                :class="getRecommendationClass(entry.recommendation)"
              >
                {{ getRecommendationLabel(entry.recommendation) }}
              </span>
            </div>
          </div>
        </div>
      </div>

    </template>
  </div>
</template>
