<script setup>
import { computed, ref } from 'vue'
import { useAIImpact } from '../composables/useAIImpact.js'
import { useFeatures } from '../composables/useFeatures.js'
import { useAssessments } from '../composables/useAssessments.js'
import { useForYou } from '../composables/useForYou.js'
import { useForYouPreferences } from '../composables/useForYouPreferences.js'
import { useFieldDefinitions } from '@shared/client/composables/useFieldDefinitions.js'
import ForYouSettings from '../components/ForYouSettings.vue'

defineProps({
  size: { type: String, default: 'half' }
})

const { loading: rfeLoading } = useAIImpact()
const { featureLoading } = useFeatures()
const { assessmentLoading } = useAssessments()
const { stats } = useForYou()
const { definitions, fetchDefinitions } = useFieldDefinitions()
fetchDefinitions()
const { mode, manualComponents } = useForYouPreferences()

const loading = computed(() => rfeLoading.value || featureLoading.value || assessmentLoading.value)
const showSettings = ref(false)

const availableComponents = computed(() => {
  const fields = definitions.value?.personFields || []
  const comp = fields.find(f => f.optionsRef === 'component')
  return comp?.allowedValues || []
})

function handleSettingsUpdate(newMode, components) {
  const prefs = useForYouPreferences()
  prefs.setMode(newMode)
  prefs.setManualComponents(components)
  showSettings.value = false
}

const statCards = computed(() => [
  { label: 'RFEs to Revise', value: stats.value.reviseRfes, color: 'red' },
  { label: 'Features to Review', value: stats.value.reviewFeatures, color: 'amber' },
  { label: 'Ready for Strategy', value: stats.value.queuedForStrat, color: 'blue' },
  { label: 'Signed Off', value: stats.value.signedOffFeatures, color: 'green' }
])

const colorClasses = {
  red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Pipeline Stats</h3>
      <div class="relative">
        <button
          @click="showSettings = !showSettings"
          class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Component settings"
        >
          <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <ForYouSettings
          v-if="showSettings"
          :mode="mode"
          :manualComponents="manualComponents"
          :availableComponents="availableComponents"
          :componentsLoading="!definitions?.personFields?.length"
          @update="handleSettingsUpdate"
          @close="showSettings = false"
        />
      </div>
    </div>

    <div v-if="loading" class="grid grid-cols-2 gap-3">
      <div v-for="i in 4" :key="i" class="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
    </div>

    <div v-else class="grid grid-cols-2 gap-3">
      <div
        v-for="card in statCards"
        :key="card.label"
        class="rounded-lg border p-3"
        :class="colorClasses[card.color]"
      >
        <div class="text-2xl font-bold">{{ card.value }}</div>
        <div class="text-xs mt-0.5">{{ card.label }}</div>
      </div>
    </div>
  </div>
</template>
