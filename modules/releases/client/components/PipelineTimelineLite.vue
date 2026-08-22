<script setup>
import { ref, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const props = defineProps({
  featureKey: { type: String, default: null }
})

const emit = defineEmits(['navigate'])

const signals = ref(null)
const loading = ref(false)
const error = ref(false)

const PHASES = [
  { id: 'rfe-review', name: 'RFE Review' },
  { id: 'feature-review', name: 'Feature Review' },
  { id: 'decomposer', name: 'Feature Decomposer' },
  { id: 'test-plan-review', name: 'Test Plan Review' },
  { id: 'implementation', name: 'Implementation', comingSoon: true },
  { id: 'security', name: 'Security Review', comingSoon: true },
  { id: 'documentation', name: 'Documentation' },
  { id: 'build-release', name: 'Build & Release' },
]

const cache = {}

watch(() => props.featureKey, async (key) => {
  signals.value = null
  error.value = false
  if (!key) return

  if (cache[key]) {
    signals.value = cache[key]
    return
  }

  loading.value = true
  try {
    const data = await apiRequest(`/modules/ai-impact/pipeline-signals/${encodeURIComponent(key)}`)
    cache[key] = data
    signals.value = data
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}, { immediate: true })

function getPhase(phaseId) {
  if (!signals.value?.phases?.[phaseId]) {
    return { completed: false, current: false, aiUsed: null, detail: null }
  }
  return signals.value.phases[phaseId]
}

function handleClick(phaseId, signal) {
  if (!signal.linkedKey) return
  emit('navigate', { phase: phaseId, key: signal.linkedKey })
}

const hasAnySignal = () => {
  if (!signals.value?.phases) return false
  return Object.values(signals.value.phases).some(p => p.completed || p.current || p.detail)
}
</script>

<template>
  <div v-if="loading" class="text-xs text-gray-400 dark:text-gray-500 py-2">
    Loading pipeline signals...
  </div>
  <div v-else-if="error" class="text-xs text-gray-400 dark:text-gray-500 py-2">
    Pipeline signals unavailable
  </div>
  <div v-else-if="signals && hasAnySignal()">
    <div class="relative">
      <div class="absolute left-3 top-4 bottom-4 w-px bg-gray-200 dark:bg-gray-700" />
      <div class="space-y-2.5">
        <div
          v-for="phase in PHASES"
          :key="phase.id"
          class="flex items-center gap-3 relative"
        >
          <div
            class="w-6 h-6 rounded-full flex items-center justify-center z-10 shrink-0"
            :class="{
              'bg-green-500 text-white': getPhase(phase.id).completed,
              'bg-blue-500 text-white': getPhase(phase.id).current && !getPhase(phase.id).completed,
              'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-600': !getPhase(phase.id).completed && !getPhase(phase.id).current
            }"
          >
            <svg v-if="getPhase(phase.id).completed" class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <svg v-else-if="getPhase(phase.id).current" class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke-width="2" />
            </svg>
            <svg v-else-if="phase.comingSoon" class="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <svg v-else class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="4" stroke-width="2" />
            </svg>
          </div>

          <div class="flex items-center gap-2 min-w-0">
            <span
              class="text-xs font-medium dark:text-gray-200"
              :class="{ 'text-gray-300 dark:text-gray-600': phase.comingSoon }"
            >{{ phase.name }}</span>
            <svg
              v-if="getPhase(phase.id).aiUsed"
              class="h-3 w-3 text-blue-500 dark:text-blue-400 shrink-0"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <button
              v-if="getPhase(phase.id).linkedKey && !phase.comingSoon"
              class="text-[11px] text-blue-600 dark:text-blue-400 hover:underline truncate"
              @click="handleClick(phase.id, getPhase(phase.id))"
            >{{ getPhase(phase.id).linkedKey }}</button>
            <span v-else-if="getPhase(phase.id).detail && !phase.comingSoon" class="text-[11px] text-gray-400 dark:text-gray-500 truncate">
              {{ getPhase(phase.id).detail }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
