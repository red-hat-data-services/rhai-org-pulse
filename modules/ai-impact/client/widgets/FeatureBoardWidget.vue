<script setup>
import { computed, ref } from 'vue'
import { useAIImpact } from '../composables/useAIImpact.js'
import { useFeatures } from '../composables/useFeatures.js'
import { useAssessments } from '../composables/useAssessments.js'
import { useForYou } from '../composables/useForYou.js'
import { useForYouPreferences } from '../composables/useForYouPreferences.js'
import ForYouSettings from '../components/ForYouSettings.vue'
import ForYouBoardTab from '../components/ForYouBoardTab.vue'
import { useModuleLink } from '@shared/client/composables/useModuleLink.js'
import { useFieldDefinitions } from '@shared/client/composables/useFieldDefinitions.js'

defineProps({
  size: { type: String, default: 'full' }
})

const { navigateTo: crossNavigate } = useModuleLink()

const { rfeData, loading: rfeLoading } = useAIImpact()
const { featureLoading } = useFeatures()
const { assessmentLoading } = useAssessments()
const { definitions, fetchDefinitions } = useFieldDefinitions()
fetchDefinitions()

const {
  mode,
  manualComponents,
  wizardSeen
} = useForYouPreferences()

const {
  boardColumns,
  stageFilter,
  priorityFilter,
  componentFilter,
  availableItemComponents
} = useForYou()

const loading = computed(() => rfeLoading.value || featureLoading.value || assessmentLoading.value)

const showSettings = ref(false)

const stageOptions = [
  { value: 'not-assessed', label: 'Not Yet Assessed' },
  { value: 'needs-revision', label: 'Needs Revision' },
  { value: 'passed-with-caveats', label: 'Passed with Caveats' },
  { value: 'ready-to-advance', label: 'Ready for Feature Creation' },
  { value: 'queued-for-pipeline', label: 'Queued for Feature Creation' },
  { value: 'rejected', label: 'RFE Rejected' },
  { value: 'revise-required', label: 'Revise Required' },
  { value: 'awaiting-signoff', label: 'Awaiting Sign-off' },
  { value: 'signed-off', label: 'Signed Off' }
]

const priorityOptions = [
  { value: 'Blocker', label: 'Blocker' },
  { value: 'Critical', label: 'Critical' },
  { value: 'High', label: 'High' },
  { value: 'Major', label: 'Major' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Normal', label: 'Normal' },
  { value: 'Minor', label: 'Minor' }
]

const availableComponents = computed(() => {
  const fields = definitions.value?.personFields || []
  const comp = fields.find(f => f.optionsRef === 'component')
  return comp?.allowedValues || []
})

function handleNavigate(item) {
  if (item.type === 'rfe') {
    crossNavigate('ai-impact', 'rfe-review', { select: item.key, from: 'sotu' })
  } else {
    crossNavigate('releases', 'feature-detail', { key: item.key, from: 'sotu' })
  }
}

function handleSettingsUpdate(newMode, components) {
  const prefs = useForYouPreferences()
  prefs.setMode(newMode)
  prefs.setManualComponents(components)
  showSettings.value = false
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Feature Board</h3>
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

    <!-- Wizard not seen notice -->
    <div
      v-if="!wizardSeen && !loading"
      class="text-sm text-gray-500 dark:text-gray-400 mb-4"
    >
      Complete setup in <strong>RFE Action Items</strong> widget to personalize this board.
    </div>

    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
    </div>

    <ForYouBoardTab
      v-else
      :boardColumns="boardColumns"
      :stageFilter="stageFilter"
      :priorityFilter="priorityFilter"
      :stageOptions="stageOptions"
      :priorityOptions="priorityOptions"
      :componentFilter="componentFilter"
      :availableItemComponents="availableItemComponents"
      :jiraHost="rfeData?.jiraHost"
      @navigate="handleNavigate"
      @update:stageFilter="stageFilter = $event"
      @update:priorityFilter="priorityFilter = $event"
      @update:componentFilter="componentFilter = $event"
    />
  </div>
</template>
