<script setup>
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import PipelineTimeline from './PipelineTimeline.vue'
import AssessmentBreakdown from './AssessmentBreakdown.vue'
import AssessmentHistory from './AssessmentHistory.vue'
import FeedbackText from './FeedbackText.vue'

const props = defineProps({
  show: { type: Boolean, default: false },
  rfe: { type: Object, default: null },
  phases: { type: Array, required: true },
  jiraHost: { type: String, default: null },
  assessment: { type: Object, default: null },
  loadAssessmentDetail: { type: Function, default: null }
})

const emit = defineEmits(['close', 'navigateToFeature'])

const assessmentDetail = ref(null)
const detailLoading = ref(false)
const modalRef = ref(null)
let previousActiveElement = null

watch(
  () => props.rfe?.key,
  async (key) => {
    assessmentDetail.value = null
    if (!props.show || !key || !props.assessment || !props.loadAssessmentDetail) return
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
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show && rfe" class="fixed inset-0 z-50 flex items-center justify-center p-4" @keydown="handleKeydown">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50" @click="emit('close')" />

        <!-- Modal -->
        <div ref="modalRef" role="dialog" aria-modal="true" class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center gap-3 min-w-0">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">RFE Details</h2>
              <a
                v-if="jiraHost"
                :href="`${jiraHost}/browse/${rfe.key}`"
                target="_blank"
                rel="noopener noreferrer"
                class="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              >
                {{ rfe.key }}
              </a>
              <span v-else class="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0">{{ rfe.key }}</span>
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
            <h3 class="font-medium text-gray-900 dark:text-gray-200 mb-4">{{ rfe.summary }}</h3>

            <div class="grid grid-cols-4 gap-4 mb-6 text-sm">
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
