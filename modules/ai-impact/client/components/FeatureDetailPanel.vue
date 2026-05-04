<script setup>
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import PipelineTimeline from './PipelineTimeline.vue'
import { getRecommendationClass, getRecommendationLabel, getRecommendationTooltip, getScoreClass, getReviewStatusClass, getReviewStatusLabel, getReviewStatusTooltip } from '../utils/feature-helpers.js'
import InfoBubble from './InfoBubble.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  feature: { type: Object, default: null },
  phases: { type: Array, required: true },
  jiraHost: { type: String, default: null },
  loadFeatureDetail: { type: Function, default: null }
})

const emit = defineEmits(['close', 'navigateToRFE'])

const featureDetail = ref(null)
const detailLoading = ref(false)
const modalRef = ref(null)
let previousActiveElement = null

watch(
  () => props.feature?.key,
  async (key) => {
    featureDetail.value = null
    if (!props.show || !key || !props.loadFeatureDetail) return
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
              <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Feature Details</h2>
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
                <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">AI Recommendation</p>
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
              <div>
                <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Review Status</p>
                <span class="inline-flex items-center">
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                    :class="getReviewStatusClass(feature.humanReviewStatus)"
                  >
                    <svg v-if="feature.humanReviewStatus === 'needs-review'" class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    {{ getReviewStatusLabel(feature.humanReviewStatus) }}
                  </span>
                  <InfoBubble :text="getReviewStatusTooltip(feature.humanReviewStatus)" />
                </span>
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
              <div>
                <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Size</p>
                <p class="font-medium dark:text-gray-200">{{ feature.size || 'N/A' }}</p>
              </div>
              <div>
                <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Score</p>
                <p class="font-bold" :class="getScoreClass(Math.round((feature.scores?.total || 0) / 2))">
                  {{ feature.scores?.total || 0 }}/8
                </p>
              </div>
            </div>

            <!-- Approval info -->
            <div v-if="feature.humanReviewStatus === 'approved' && (feature.approvedBy || featureDetail?.latest?.approvedBy)" class="mb-6 px-3 py-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
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

            <!-- Source RFE -->
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Source RFE</h4>
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
            <div v-else-if="!detailLoading" class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Score History</h4>
              <p class="text-sm text-gray-400 dark:text-gray-500">No prior history available.</p>
            </div>
            <div v-if="detailLoading" class="text-xs text-gray-400 dark:text-gray-500 mb-4">Loading details...</div>

            <!-- Pipeline Progress -->
            <PipelineTimeline :feature="featureDetail?.latest || feature" :phases="phases" :jiraHost="jiraHost" @navigateToRFE="emit('navigateToRFE', $event)" />
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
