<script setup>
import { ref, watch } from 'vue'
import PipelineTimeline from './PipelineTimeline.vue'

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

function getRecommendationClass(rec) {
  switch (rec) {
    case 'approve': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
    case 'revise': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
    case 'reject': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function getScoreClass(score) {
  if (score === 2) return 'text-green-600 dark:text-green-400'
  if (score === 1) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function getHumanReviewLabel(status) {
  switch (status) {
    case 'reviewed': return 'Reviewed'
    case 'pending': return 'Pending'
    default: return 'Not Required'
  }
}

function getHumanReviewClass(status) {
  switch (status) {
    case 'reviewed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
    case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  }
}

// Get history from detail fetch, or empty array
function getHistory() {
  return featureDetail.value?.history || []
}
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
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize"
            :class="getRecommendationClass(feature.recommendation)"
          >
            {{ feature.recommendation }}
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
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize"
                :class="getRecommendationClass(feature.reviewers?.[dim])"
              >
                {{ feature.reviewers?.[dim] || 'N/A' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Labels -->
      <div v-if="featureDetail?.latest?.labels?.length" class="mb-6">
        <h5 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Labels</h5>
        <div class="flex flex-wrap gap-1">
          <span
            v-for="label in featureDetail.latest.labels"
            :key="label"
            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            {{ label }}
          </span>
        </div>
      </div>

      <!-- History -->
      <div v-if="getHistory().length > 0" class="mb-6">
        <h5 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Score History</h5>
        <div class="space-y-2">
          <div
            v-for="(entry, idx) in getHistory()"
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
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize"
                :class="getRecommendationClass(entry.recommendation)"
              >
                {{ entry.recommendation }}
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
