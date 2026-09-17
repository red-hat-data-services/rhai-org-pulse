<script setup>
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import PipelineTimeline from './PipelineTimeline.vue'
import FeedbackText from './FeedbackText.vue'
import { getRecommendationClass, getRecommendationLabel, getRecommendationTooltip, getScoreClass, getTotalScoreClass, getReviewStatusClass, getReviewStatusLabel, getReviewStatusTooltip, getMeaningfulDesignReviewStatus } from '../utils/feature-helpers.js'
import { useTestPlans } from '../composables/useTestPlans.js'
import InfoBubble from './InfoBubble.vue'
import MetaChipGroup from './MetaChipGroup.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  feature: { type: Object, default: null },
  phases: { type: Array, required: true },
  jiraHost: { type: String, default: null },
  loadFeatureDetail: { type: Function, default: null }
})

const emit = defineEmits(['close', 'navigateToRFE', 'navigateToTestPlan', 'navigateToFeatureDetail'])

const featureDetail = ref(null)
const detailLoading = ref(false)
const modalRef = ref(null)
let previousActiveElement = null

const { loadTestPlanDetail } = useTestPlans()
const testPlanData = ref(null)

const selectedDimension = ref(null)

function selectDimension(dim) {
  selectedDimension.value = selectedDimension.value === dim ? null : dim
}

const currentData = computed(() => featureDetail.value?.latest || props.feature)

const meaningfulReviewStatus = computed(() => getMeaningfulDesignReviewStatus(props.feature))

watch(
  () => props.feature?.key,
  async (key) => {
    featureDetail.value = null
    testPlanData.value = null
    selectedDimension.value = null
    if (!props.show || !key || !props.loadFeatureDetail) return
    detailLoading.value = true
    try {
      featureDetail.value = await props.loadFeatureDetail(key)
      // Load test plan data for this feature (sourceKey matches feature.key)
      testPlanData.value = await loadTestPlanDetail(key)
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

const DIMENSIONS = ['feasibility', 'testability', 'scope', 'architecture']

const history = computed(() => featureDetail.value?.history || [])
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show && feature" class="fixed inset-0 z-50 flex items-center justify-center p-4" @keydown="handleKeydown">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50" @click="emit('close')" />

        <!-- Modal -->
        <div ref="modalRef" role="dialog" aria-modal="true" class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center gap-3 min-w-0">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Design Details</h2>
              <a
                v-if="jiraHost"
                :href="`${jiraHost}/browse/${feature.key}`"
                target="_blank"
                rel="noopener noreferrer"
                class="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              >
                {{ feature.key }}
              </a>
              <span v-else class="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0">{{ feature.key }}</span>
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
            <h3 class="font-medium text-gray-900 dark:text-gray-200 mb-4">{{ feature.title }}</h3>

            <!-- Metadata grid -->
            <div class="grid grid-cols-3 gap-4 mb-6 text-sm">
              <div>
                <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Review Status</p>
                <span v-if="meaningfulReviewStatus" class="inline-flex items-center">
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                    :class="getReviewStatusClass(meaningfulReviewStatus)"
                  >
                    <svg v-if="meaningfulReviewStatus === 'needs-review'" class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    {{ getReviewStatusLabel(meaningfulReviewStatus) }}
                  </span>
                  <InfoBubble :text="getReviewStatusTooltip(meaningfulReviewStatus)" />
                </span>
                <span v-else class="text-gray-400 dark:text-gray-500">—</span>
              </div>
              <div>
                <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Priority</p>
                <span class="inline-flex items-center px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-xs capitalize dark:text-gray-300">
                  {{ feature.priority }}
                </span>
              </div>
              <div>
                <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Status</p>
                <p class="font-medium dark:text-gray-200">{{ feature.status }}</p>
              </div>
            </div>

            <!-- Component / Fix Version -->
            <div v-if="feature.components?.length || feature.fixVersions?.length" class="grid grid-cols-3 gap-4 mb-6 text-sm">
              <div><MetaChipGroup label="Component" :values="feature.components" /></div>
              <div><MetaChipGroup label="Fix Version" :values="feature.fixVersions" /></div>
            </div>

            <!-- Approval info -->
            <div v-if="meaningfulReviewStatus === 'approved' && (feature.approvedBy || featureDetail?.latest?.approvedBy)" class="mb-6 px-3 py-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div class="flex items-center gap-2 text-sm text-green-800 dark:text-green-300">
                <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>
                  Approved by <span class="font-medium">{{ feature.approvedBy || featureDetail?.latest?.approvedBy }}</span>
                  <span v-if="feature.approvedAt || featureDetail?.latest?.approvedAt" class="text-green-600 dark:text-green-400">
                    on {{ new Date(feature.approvedAt || featureDetail?.latest?.approvedAt).toLocaleDateString() }}
                  </span>
                </span>
              </div>
            </div>

            <!-- Links -->
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <div v-if="feature.designPrStatus == null" class="mb-3 px-3 py-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <div class="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-300">
                  <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <span>No design document. This feature has a PRD only.</span>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <a
                  v-if="currentData?.prdPrUrl"
                  :href="currentData.prdPrUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  title="View PRD pull request on GitHub"
                >
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  PRD PR
                </a>
                <a
                  v-if="currentData?.designPrUrl"
                  :href="currentData.designPrUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                  title="View design PR on GitHub"
                >
                  <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                  Design PR
                </a>
                <button
                  @click="emit('navigateToFeatureDetail', feature.key)"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  title="View full feature detail in Releases"
                >
                  <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                  Releases Execution
                </button>
              </div>
            </div>

            <!-- Quality Assessment -->
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quality Assessment</h4>
              <div class="flex items-start gap-6 mb-3">
                <div>
                  <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Score</p>
                  <p v-if="feature.scores?.total == null" class="font-bold text-gray-400 dark:text-gray-500">—</p>
                  <p v-else class="font-bold" :class="getTotalScoreClass(feature.scores.total)">
                    {{ feature.scores.total }}/8
                  </p>
                </div>
                <div>
                  <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Recommendation</p>
                  <span class="inline-flex items-center">
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                      :class="getRecommendationClass(feature.recommendation)"
                    >
                      {{ getRecommendationLabel(feature.recommendation) }}
                    </span>
                    <InfoBubble :text="getRecommendationTooltip(feature.recommendation)" />
                  </span>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div
                  v-for="dim in DIMENSIONS"
                  :key="dim"
                  class="p-3 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  :class="{ 'bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-500': selectedDimension === dim }"
                  role="button"
                  tabindex="0"
                  @click="selectDimension(dim)"
                  @keydown.enter="selectDimension(dim)"
                  @keydown.space.prevent="selectDimension(dim)"
                >
                  <p class="text-xs text-gray-500 dark:text-gray-400 capitalize mb-1">{{ dim }}</p>
                  <div class="flex items-center justify-between">
                    <span v-if="feature.scores?.[dim] == null" class="text-lg font-bold text-gray-400 dark:text-gray-500">—</span>
                    <span v-else class="text-lg font-bold" :class="getScoreClass(feature.scores[dim])">
                      {{ feature.scores[dim] }}/2
                    </span>
                    <div class="flex items-center gap-1">
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        :class="getRecommendationClass(feature.reviewers?.[dim])"
                      >
                        {{ feature.reviewers?.[dim] === 'approve' ? 'Pass' : feature.reviewers?.[dim] === 'revise' ? 'Revise' : feature.reviewers?.[dim] === 'reject' ? 'Fail' : getRecommendationLabel(feature.reviewers?.[dim]) }}
                      </span>
                      <svg
                        v-if="currentData?.criterionNotes?.[dim]"
                        class="h-4 w-4 text-gray-400 transition-transform"
                        :class="{ 'rotate-180': selectedDimension === dim }"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-if="selectedDimension"
                class="mt-2 p-3 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <p class="font-medium text-sm capitalize dark:text-gray-200 mb-1.5">{{ selectedDimension }}</p>
                <FeedbackText v-if="currentData?.criterionNotes?.[selectedDimension]" :text="currentData.criterionNotes[selectedDimension]" />
                <p v-else class="text-sm text-gray-400 dark:text-gray-500">No notes available.</p>
              </div>
            </div>

            <!-- Verdict -->
            <div v-if="currentData?.verdict" class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Verdict</h4>
              <p class="text-sm font-medium text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-700/50 rounded-md px-3 py-2">
                {{ currentData.verdict }}
              </p>
            </div>

            <!-- Feedback -->
            <div v-if="currentData?.feedback" class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Feedback</h4>
              <div class="bg-gray-50 dark:bg-gray-700/50 rounded-md px-3 py-2">
                <FeedbackText :text="currentData.feedback" />
              </div>
            </div>

            <!-- History -->
            <div v-if="history.length > 0" class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Score History</h4>
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
                    <span class="text-sm font-medium" :class="getTotalScoreClass(entry.scores?.total || 0)">
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
            <div v-else-if="!detailLoading" class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Score History</h4>
              <p class="text-sm text-gray-400 dark:text-gray-500">No prior history available.</p>
            </div>
            <div v-if="detailLoading" class="text-xs text-gray-400 dark:text-gray-500 mb-4">Loading details...</div>

            <!-- Pipeline Progress -->
            <PipelineTimeline :feature="featureDetail?.latest || feature" :testPlan="testPlanData?.latest" :phases="phases" :jiraHost="jiraHost" @navigateToRFE="emit('navigateToRFE', $event)" @navigateToTestPlan="emit('navigateToTestPlan', $event)" />
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
