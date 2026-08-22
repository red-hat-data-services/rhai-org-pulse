<script setup>
import { ref, watch, onBeforeUnmount, nextTick } from 'vue'
import PipelineTimeline from './PipelineTimeline.vue'
import MermaidDiagram from './MermaidDiagram.vue'
import { usePipelineSignals } from '../composables/usePipelineSignals.js'

const props = defineProps({
  show: { type: Boolean, default: false },
  strategy: { type: Object, default: null },
  phases: { type: Array, required: true },
  jiraHost: { type: String, default: null }
})

const emit = defineEmits([
  'close',
  'navigateToRFE',
  'navigateToFeature',
  'navigateToTestPlan',
  'navigateToDocumentation',
  'navigateToBuildRelease'
])

const { loadPipelineSignals } = usePipelineSignals()
const pipelineSignals = ref(null)
const modalRef = ref(null)
let previousActiveElement = null

watch(
  () => props.strategy?.strat_id,
  async (key) => {
    pipelineSignals.value = null
    if (!props.show || !key) return
    pipelineSignals.value = await loadPipelineSignals(key)
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

function recClass(rec) {
  if (rec === 'accept') return 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/40'
  if (rec === 'reject') return 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40'
  return 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40'
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show && strategy" class="fixed inset-0 z-50 flex items-center justify-center p-4" @keydown="handleKeydown">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50" @click="emit('close')" />

        <!-- Modal -->
        <div ref="modalRef" role="dialog" aria-modal="true" class="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center gap-3 min-w-0">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Decomposer Details</h2>
              <a
                v-if="jiraHost"
                :href="`${jiraHost}/browse/${strategy.strat_id}`"
                target="_blank"
                rel="noopener noreferrer"
                class="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              >
                {{ strategy.strat_id }}
              </a>
              <span v-else class="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0">{{ strategy.strat_id }}</span>
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
            <h3 class="font-medium text-gray-900 dark:text-gray-200 mb-4">{{ strategy.title }}</h3>

            <!-- Metadata grid -->
            <div class="grid grid-cols-4 gap-4 mb-6 text-sm">
              <div>
                <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Epics</p>
                <p class="text-lg font-bold dark:text-gray-200">{{ strategy.epic_count }}</p>
              </div>
              <div>
                <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Critical Path</p>
                <p class="text-lg font-bold dark:text-gray-200">{{ strategy.critical_path_length }}</p>
              </div>
              <div>
                <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Score</p>
                <p class="text-lg font-bold dark:text-gray-200">{{ strategy.review?.score ?? '—' }}</p>
              </div>
              <div>
                <p class="text-gray-500 dark:text-gray-400 text-xs mb-1">Review</p>
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  :class="recClass(strategy.review?.recommendation)"
                >
                  {{ strategy.review?.pass ? 'Pass' : 'Fail' }} · {{ strategy.review?.recommendation || '—' }}
                </span>
              </div>
            </div>

            <!-- DAG -->
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Decomposition DAG</h4>
              <div v-if="strategy.mermaid_dag" class="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <MermaidDiagram :chart="strategy.mermaid_dag" />
              </div>
              <p v-else class="text-sm text-gray-400 dark:text-gray-500">No DAG available.</p>
            </div>

            <!-- Epics list -->
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                Epics ({{ strategy.epics?.length || 0 }})
              </h4>
              <div v-if="strategy.epics?.length" class="space-y-2">
                <div
                  v-for="epic in strategy.epics"
                  :key="epic.epic_id"
                  class="flex items-start gap-3 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm"
                >
                  <span class="font-mono text-xs text-gray-400 shrink-0 pt-0.5">{{ epic.epic_id?.split('-').pop() }}</span>
                  <div class="flex-1 min-w-0">
                    <p class="dark:text-gray-200">{{ epic.title }}</p>
                    <div class="flex items-center gap-2 mt-1 text-xs text-gray-400 dark:text-gray-500">
                      <span>{{ epic.type }}</span>
                      <span>·</span>
                      <span>{{ epic.priority }}</span>
                      <span>·</span>
                      <span>{{ epic.component }}</span>
                      <span v-if="epic.ai_implementability" class="px-1 rounded bg-gray-200 dark:bg-gray-700">
                        AI: {{ epic.ai_implementability }}
                      </span>
                      <a
                        v-if="epic.jira_key && jiraHost"
                        :href="`${jiraHost}/browse/${epic.jira_key}`"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-blue-600 dark:text-blue-400 hover:underline"
                      >{{ epic.jira_key }}</a>
                    </div>
                  </div>
                </div>
              </div>
              <p v-else class="text-sm text-gray-400 dark:text-gray-500">No epics in this strategy.</p>
            </div>

            <!-- Pipeline Progress -->
            <PipelineTimeline
              :phases="phases"
              :jiraHost="jiraHost"
              :signals="pipelineSignals"
              @navigateToRFE="emit('navigateToRFE', $event)"
              @navigateToFeature="emit('navigateToFeature', $event)"
              @navigateToTestPlan="emit('navigateToTestPlan', $event)"
              @navigateToDocumentation="emit('navigateToDocumentation', $event)"
              @navigateToBuildRelease="emit('navigateToBuildRelease', $event)"
            />
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
