<script setup>
import { ref, computed, watch } from 'vue'
import PipelineTimeline from './PipelineTimeline.vue'
import { getRecommendationClass, getRecommendationLabel, getScoreClass, getHumanReviewClass, getHumanReviewLabel } from '../utils/feature-helpers.js'

const props = defineProps({
  feature: { type: Object, required: true },
  phases: { type: Array, required: true },
  jiraHost: { type: String, default: null },
  loadFeatureDetail: { type: Function, default: null }
})

const emit = defineEmits(['close', 'navigateToRFE'])

const featureDetail = ref(null)
const detailLoading = ref(false)

watch(
  () => props.feature?.key,
  async (key) => {
    featureDetail.value = null
    if (!key || !props.loadFeatureDetail) return
    detailLoading.value = true
    try {
      featureDetail.value = await props.loadFeatureDetail(key)
    } catch {
      // Silently fail - slim data still shows
    } finally {
      detailLoading.value = false
    }
  },
  { immediate: true }
)

const DIMENSIONS = ['feasibility', 'testability', 'scope', 'architecture']

const history = computed(() => featureDetail.value?.history || [])
</script>

<template>
  <aside class="w-96 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 flex flex-col transition-transform">
    <header class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <h3 class="font-semibold dark:text-gray-100">Feature Details</h3>
      <button @click="emit('close')" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
        <svg class="h-4 w-4 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </header>

    <div class="flex-1 overflow-auto p-4">
      <!-- Header -->
      <div class="mb-4">
        <div class="flex items-center gap-2">
          <a
            v-if="jiraHost"
            :href="`${jiraHost}/browse/${feature.key}`"
            target="_blank"
            rel="noopener noreferrer"
            class="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {{ feature.key }}
          </a>
          <span v-else class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ feature.key }}</span>
          <span
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            :class="getRecommendationClass(feature.recommendation)"
          >
            AI Recommendation: {{ getRecommendationLabel(feature.recommendation) }}
          </span>
        </div>
        <h4 class="text-lg font-semibold mt-1 dark:text-gray-100">{{ feature.title }}</h4>
      </div>

      <!-- Metadata grid -->
      <div class="grid grid-cols-2 gap-3 mb-6">
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400">Priority</p>
          <p class="text-sm font-medium dark:text-gray-200">{{ feature.priority }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400">Status</p>
          <p class="text-sm font-medium dark:text-gray-200">{{ feature.status }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400">Size</p>
          <p class="text-sm font-medium dark:text-gray-200">{{ feature.size || 'N/A' }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400">Human Review</p>
          <span
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            :class="getHumanReviewClass(feature.humanReviewStatus)"
          >
            {{ getHumanReviewLabel(feature.humanReviewStatus) }}
          </span>
        </div>
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400">Needs Attention</p>
          <span
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            :class="feature.needsAttention ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
          >
            {{ feature.needsAttention ? 'Yes' : 'No' }}
          </span>
        </div>
        <div>
          <p class="text-xs text-gray-500 dark:text-gray-400">Score</p>
          <p class="text-sm font-bold" :class="getScoreClass(Math.round((feature.scores?.total || 0) / 2))">
            {{ feature.scores?.total || 0 }}/8
          </p>
        </div>
      </div>

      <!-- Source RFE -->
      <div class="mb-6">
        <h5 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Source RFE</h5>
        <div class="flex items-center gap-2">
          <button
            @click="emit('navigateToRFE', feature.sourceRfe)"
            class="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {{ feature.sourceRfe }}
          </button>
          <a
            v-if="jiraHost"
            :href="`${jiraHost}/browse/${feature.sourceRfe}`"
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            title="View in Jira"
          >
            <svg class="inline h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      <!-- Dimension Scores -->
      <div class="mb-6">
        <h5 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Dimension Scores</h5>
        <div class="grid grid-cols-2 gap-2">
          <div
            v-for="dim in DIMENSIONS"
            :key="dim"
            class="p-3 rounded-lg border border-gray-200 dark:border-gray-600"
          >
            <p class="text-xs text-gray-500 dark:text-gray-400 capitalize mb-1">{{ dim }}</p>
            <div class="flex items-center justify-between">
              <span class="text-lg font-bold" :class="getScoreClass(feature.scores?.[dim])">
                {{ feature.scores?.[dim] ?? 0 }}/2
              </span>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                :class="getRecommendationClass(feature.reviewers?.[dim])"
              >
                {{ feature.reviewers?.[dim] === 'approve' ? 'Pass' : feature.reviewers?.[dim] === 'revise' ? 'Revise' : feature.reviewers?.[dim] === 'reject' ? 'Fail' : getRecommendationLabel(feature.reviewers?.[dim]) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- History -->
      <div v-if="history.length > 0" class="mb-6">
        <h5 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Score History</h5>
        <div class="space-y-2">
          <div
            v-for="(entry, idx) in history"
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
      <div v-else-if="!detailLoading" class="text-sm text-gray-400 dark:text-gray-500">
        No prior history available.
      </div>
      <div v-if="detailLoading" class="text-sm text-gray-400 dark:text-gray-500">Loading details...</div>

      <!-- Pipeline Progress -->
      <div class="mt-6">
        <PipelineTimeline :feature="featureDetail?.latest || feature" :phases="phases" :jiraHost="jiraHost" @navigateToRFE="emit('navigateToRFE', $event)" />
      </div>
    </div>
  </aside>
</template>
