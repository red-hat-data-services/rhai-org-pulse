<script setup>
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import PipelineTimeline from './PipelineTimeline.vue'
import FeedbackText from './FeedbackText.vue'
import GapAnalysisText from './GapAnalysisText.vue'
import InfoBubble from './InfoBubble.vue'
import { getVerdictBgClass, getVerdictLabel, getCriterionLabel, getCriterionScoreClass, getCriterionScoreBgClass, getCriterionScoreLabel, getScoreColorClass, CRITERIA } from '../utils/test-plan-helpers.js'
import { getReviewStatusClass } from '../utils/feature-helpers.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  plan: { type: Object, default: null },
  phases: { type: Array, default: () => [] },
  jiraHost: { type: String, default: null },
  loadTestPlanDetail: { type: Function, default: null }
})

const emit = defineEmits(['close', 'navigateToFeature', 'navigateToRFE'])

const planDetail = ref(null)
const detailLoading = ref(false)
const modalRef = ref(null)
const expandedCriteria = ref({})
let previousActiveElement = null

watch(
  () => props.plan?.sourceKey,
  async (key) => {
    planDetail.value = null
    expandedCriteria.value = {}
    if (!props.show || !key || !props.loadTestPlanDetail) return
    detailLoading.value = true
    try {
      planDetail.value = await props.loadTestPlanDetail(key)
    } catch {
      // Silently fail - slim data still shows
    } finally {
      detailLoading.value = false
    }
  },
  { immediate: true }
)

watch(() => props.show, (visible) => {
  if (visible) {
    previousActiveElement = document.activeElement
    document.body.style.overflow = 'hidden'
    nextTick(() => {
      const focusable = modalRef.value?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      focusable?.focus()
    })
  } else {
    document.body.style.overflow = ''
    previousActiveElement?.focus()
    previousActiveElement = null
  }
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
})

function handleKeydown(e) {
  if (e.key === 'Escape') {
    emit('close')
    return
  }
  if (e.key === 'Tab' && modalRef.value) {
    const focusables = modalRef.value.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

function toggleCriterion(criterion) {
  expandedCriteria.value = { ...expandedCriteria.value, [criterion]: !expandedCriteria.value[criterion] }
}

function getReviewStatusLabel(status) {
  if (status === 'approved') return 'Approved'
  if (status === 'needs-review') return 'Needs Review'
  return 'Awaiting Sign-off'
}

const history = computed(() => planDetail.value?.history || [])
const currentPlan = computed(() => planDetail.value?.latest || props.plan)
const allHistoryEntries = computed(() => {
  const entries = []
  if (currentPlan.value?.reviewedAt) {
    entries.push(currentPlan.value)
  }
  entries.push(...history.value)
  return entries
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show && plan" class="fixed inset-0 z-50 flex items-center justify-center p-4" @keydown="handleKeydown">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50" @click="emit('close')" />

        <!-- Modal -->
        <div ref="modalRef" role="dialog" aria-modal="true" class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center gap-3 min-w-0">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Test Plan Details</h2>
            </div>
            <button
              @click="emit('close')"
              aria-label="Close"
              class="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content (scrollable) -->
          <div class="flex-1 overflow-auto px-6 py-5">
            <h3 class="font-medium text-gray-900 dark:text-gray-200 mb-4">{{ plan.feature || plan.featureName || plan.title }}</h3>

            <!-- Metadata grid (matches Feature Details layout) -->
            <div class="grid grid-cols-3 gap-4 mb-2 text-sm">
              <div>
                <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">AI Recommendation</p>
                <span class="inline-flex items-center">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                    :class="getVerdictBgClass(plan.verdict)"
                  >
                    {{ getVerdictLabel(plan.verdict) }}
                  </span>
                  <InfoBubble :text="plan.verdict === 'Ready' ? 'All criteria passed — proceed to test case generation' : plan.verdict === 'Revise' ? 'Some criteria need improvement — auto-revision may fix' : 'Significant gaps — provide additional source documents'" />
                </span>
              </div>
              <div>
                <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Review Status</p>
                <span class="inline-flex items-center">
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                    :class="getReviewStatusClass(currentPlan?.humanReviewStatus)"
                  >
                    <svg v-if="currentPlan?.humanReviewStatus === 'needs-review'" class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    {{ getReviewStatusLabel(currentPlan?.humanReviewStatus) }}
                  </span>
                  <InfoBubble :text="currentPlan?.humanReviewStatus === 'approved' ? 'A human engineer has signed off on this test plan' : currentPlan?.humanReviewStatus === 'needs-review' ? 'The rubric flagged issues — review needed' : 'Awaiting human sign-off via test-plan-human-sign-off label'" />
                </span>
              </div>
              <div>
                <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Score</p>
                <p class="font-bold" :class="getScoreColorClass(plan.score || 0)">
                  {{ plan.score || 0 }}/10
                </p>
              </div>
            </div>

            <!-- Approval info -->
            <div v-if="currentPlan?.humanReviewStatus === 'approved' && (currentPlan?.approvedBy)" class="mb-6 px-3 py-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div class="flex items-center gap-2 text-sm text-green-800 dark:text-green-300">
                <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>
                  Approved by <span class="font-medium">{{ currentPlan.approvedBy }}</span>
                  <span v-if="currentPlan.approvedAt" class="text-green-600 dark:text-green-400">
                    on {{ new Date(currentPlan.approvedAt).toLocaleDateString() }}
                  </span>
                </span>
              </div>
            </div>

            <!-- Source STRAT -->
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Source Strategy</h4>
              <div class="flex items-center gap-2">
                <button
                  @click="emit('navigateToFeature', plan.sourceKey)"
                  class="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {{ plan.sourceKey }}
                </button>
                <a
                  v-if="jiraHost"
                  :href="`${jiraHost}/browse/${plan.sourceKey}`"
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

            <!-- Dimension Scores (2-column grid matching Feature Details) -->
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Dimension Scores</h4>
              <div class="grid grid-cols-2 gap-2">
                <div
                  v-for="criterion in CRITERIA"
                  :key="criterion"
                  class="p-3 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer"
                  @click="toggleCriterion(criterion)"
                >
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">{{ getCriterionLabel(criterion) }}</p>
                  <div class="flex items-center justify-between">
                    <span class="text-lg font-bold" :class="getCriterionScoreClass(currentPlan?.scores?.[criterion])">
                      {{ currentPlan?.scores?.[criterion] ?? 0 }}/2
                    </span>
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                      :class="getCriterionScoreBgClass(currentPlan?.scores?.[criterion] ?? 0)"
                    >
                      {{ getCriterionScoreLabel(currentPlan?.scores?.[criterion] ?? 0) }}
                    </span>
                  </div>
                  <div v-if="expandedCriteria[criterion] && currentPlan?.criterionNotes?.[criterion]" class="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <FeedbackText :text="currentPlan.criterionNotes[criterion]" />
                  </div>
                  <div v-else-if="expandedCriteria[criterion]" class="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <p class="text-sm text-gray-400 dark:text-gray-500">No notes available.</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- History (current + prior) -->
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Score History</h4>
              <div class="space-y-2">
                <div
                  v-for="(entry, idx) in allHistoryEntries"
                  :key="entry.reviewedAt || idx"
                  class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{ new Date(entry.reviewedAt).toLocaleDateString() }}
                  </span>
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-medium" :class="getScoreColorClass(entry.score || 0)">
                      {{ entry.score || 0 }}/10
                    </span>
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                      :class="getVerdictBgClass(entry.verdict)"
                    >
                      {{ getVerdictLabel(entry.verdict) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Feedback -->
            <div v-if="currentPlan?.feedback" class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Feedback</h4>
              <FeedbackText :text="currentPlan.feedback" />
            </div>

            <!-- Gap Analysis -->
            <div v-if="currentPlan?.gapAnalysis" class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Gap Analysis</h4>
              <GapAnalysisText :text="currentPlan.gapAnalysis" />
            </div>

            <!-- Auto-revised indicator -->
            <div v-if="plan.autoRevised" class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <div class="px-3 py-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                <div class="flex items-center gap-2 text-sm text-purple-800 dark:text-purple-300">
                  <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>
                    Auto-revised
                    <template v-if="plan.beforeScore != null">
                      from <span class="font-medium">{{ plan.beforeScore }}/10</span>
                      to <span class="font-medium">{{ plan.score || 0 }}/10</span>
                    </template>
                  </span>
                </div>
              </div>
            </div>

            <!-- Labels -->
            <div v-if="currentPlan?.labels?.length" class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Labels</h4>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="label in currentPlan.labels"
                  :key="label"
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs"
                  :class="label.startsWith('test-plan-')
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 font-medium'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'"
                >
                  {{ label }}
                </span>
              </div>
            </div>

            <!-- Components -->
            <div v-if="(plan.components || []).length > 0" class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Components</h4>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="comp in plan.components"
                  :key="comp"
                  class="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium"
                >
                  {{ comp }}
                </span>
              </div>
            </div>

            <!-- Related Reviews -->
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Related Reviews</h4>
              <div class="flex flex-wrap gap-2">
                <button
                  @click="emit('navigateToFeature', plan.sourceKey)"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                >
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Feature Review
                </button>
                <button
                  @click="emit('navigateToRFE', plan.sourceKey)"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                >
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  RFE Review
                </button>
                <a
                  v-if="jiraHost"
                  :href="`${jiraHost}/browse/${plan.sourceKey}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View in Jira
                </a>

                <!-- GitLab link (test plan artifacts) -->
                <a
                  v-if="currentPlan.gitlabPath"
                  :href="`https://gitlab.com/redhat/rhel-ai/agentic-ci/test-plans-data/-/tree/main/${currentPlan.gitlabPath}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  title="View test plan artifacts in GitLab"
                >
                  <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z"/>
                  </svg>
                  View in GitLab
                </a>
              </div>
            </div>

            <div v-if="detailLoading" class="text-xs text-gray-400 dark:text-gray-500 mb-4">Loading details...</div>

            <!-- Pipeline Progress -->
            <PipelineTimeline :testPlan="currentPlan" :phases="phases" :jiraHost="jiraHost" @navigateToFeature="emit('navigateToFeature', $event)" @navigateToRFE="emit('navigateToRFE', $event)" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .relative {
  transform: scale(0.95);
}
</style>
