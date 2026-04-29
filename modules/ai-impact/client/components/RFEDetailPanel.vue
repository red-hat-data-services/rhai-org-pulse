<script setup>
import { ref, watch } from 'vue'
import PipelineTimeline from './PipelineTimeline.vue'
import AssessmentBreakdown from './AssessmentBreakdown.vue'
import AssessmentHistory from './AssessmentHistory.vue'
import FeedbackText from './FeedbackText.vue'

const props = defineProps({
  rfe: { type: Object, required: true },
  phases: { type: Array, required: true },
  jiraHost: { type: String, default: null },
  assessment: { type: Object, default: null },
  loadAssessmentDetail: { type: Function, default: null }
})

const assessmentDetail = ref(null)
const detailLoading = ref(false)

// Load full assessment detail when RFE changes and has assessment data
watch(
  () => props.rfe?.key,
  async (key) => {
    assessmentDetail.value = null
    if (!key || !props.assessment || !props.loadAssessmentDetail) return
    detailLoading.value = true
    try {
      assessmentDetail.value = await props.loadAssessmentDetail(key)
    } catch {
      // Silently fail - slim data still shows
    } finally {
      detailLoading.value = false
    }
  },
  { immediate: true }
)

const emit = defineEmits(['close', 'navigateToFeature'])

function getInvolvementLabel(involvement) {
  switch (involvement) {
    case 'both': return 'Created & Revised'
    case 'created': return 'AI Created'
    case 'revised': return 'AI Revised'
    default: return 'No AI'
  }
}

function getInvolvementClass(involvement) {
  switch (involvement) {
    case 'both': return 'bg-blue-500 text-white'
    case 'created': return 'bg-green-500 text-white'
    case 'revised': return 'bg-amber-500 text-white'
    default: return 'bg-gray-200 text-gray-600'
  }
}
</script>

<template>
  <aside class="w-96 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0 flex flex-col transition-transform">
    <header class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
      <h3 class="font-semibold dark:text-gray-100">RFE Details</h3>
      <button @click="emit('close')" class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
        <svg class="h-4 w-4 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </header>

    <div class="flex-1 overflow-auto p-4">
      <div class="mb-4">
        <div class="flex items-center gap-2">
          <a
            v-if="jiraHost"
            :href="`${jiraHost}/browse/${rfe.key}`"
            target="_blank"
            rel="noopener noreferrer"
            class="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {{ rfe.key }}
          </a>
          <span v-else class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ rfe.key }}</span>
        </div>
        <h4 class="font-medium mt-1 dark:text-gray-200">{{ rfe.summary }}</h4>
      </div>

      <div class="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Author</p>
          <p class="font-medium dark:text-gray-200">{{ rfe.creatorDisplayName }}</p>
        </div>
        <div>
          <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Created</p>
          <p class="font-medium dark:text-gray-200">{{ new Date(rfe.created).toLocaleDateString() }}</p>
        </div>
        <div>
          <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Priority</p>
          <span class="inline-flex items-center px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-xs capitalize dark:text-gray-300">
            {{ rfe.priority }}
          </span>
        </div>
        <div>
          <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">AI Involvement</p>
          <span
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            :class="getInvolvementClass(rfe.aiInvolvement)"
          >
            {{ getInvolvementLabel(rfe.aiInvolvement) }}
          </span>
        </div>
      </div>

      <!-- Assessment Section -->
      <template v-if="assessment">
        <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
          <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quality Assessment</h4>
          <AssessmentBreakdown :assessment="assessment" :detail="assessmentDetail" />
        </div>

        <!-- Verdict -->
        <div v-if="assessmentDetail?.latest?.verdict" class="mb-4">
          <h4 class="text-xs text-gray-500 dark:text-gray-400 mb-1">Verdict</h4>
          <p class="text-sm font-medium text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50 rounded-md px-3 py-2">
            {{ assessmentDetail.latest.verdict }}
          </p>
        </div>

        <!-- Feedback -->
        <div v-if="assessmentDetail?.latest?.feedback" class="mb-4">
          <h4 class="text-xs text-gray-500 dark:text-gray-400 mb-1">Feedback</h4>
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-md px-3 py-2">
            <FeedbackText :text="assessmentDetail.latest.feedback" />
          </div>
        </div>

        <!-- History -->
        <div v-if="assessmentDetail?.history?.length > 0" class="mb-4">
          <AssessmentHistory
            :history="assessmentDetail.history"
            :currentTotal="assessment.total"
            :currentAssessedAt="assessment.assessedAt"
            :currentScores="assessment.scores"
          />
        </div>

        <div v-if="detailLoading" class="text-xs text-gray-400 dark:text-gray-500 mb-4">Loading full assessment...</div>
      </template>

      <!-- No assessment placeholder -->
      <div v-else class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quality Assessment</h4>
        <div class="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/30 px-4 py-5 text-center">
          <svg class="mx-auto h-8 w-8 text-gray-300 dark:text-gray-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Not yet assessed</p>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Quality scores will appear here once this RFE has been evaluated by the assessment pipeline.</p>
        </div>
      </div>

      <PipelineTimeline :rfe="rfe" :phases="phases" :jiraHost="jiraHost" @navigateToFeature="emit('navigateToFeature', $event)" />
    </div>
  </aside>
</template>
