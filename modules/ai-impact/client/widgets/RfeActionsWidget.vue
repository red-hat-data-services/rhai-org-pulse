<script setup>
import { computed, watch, ref } from 'vue'
import { useAuth } from '@shared/client/composables/useAuth.js'
import { useRoster } from '@shared/client/composables/useRoster.js'
import { useFieldDefinitions } from '@shared/client/composables/useFieldDefinitions.js'
import { useAIImpact } from '../composables/useAIImpact.js'
import { useFeatures } from '../composables/useFeatures.js'
import { useAssessments } from '../composables/useAssessments.js'
import { useForYou } from '../composables/useForYou.js'
import { useForYouPreferences, sanitizeComponents } from '../composables/useForYouPreferences.js'
import ForYouWizard from '../components/ForYouWizard.vue'
import ForYouSettings from '../components/ForYouSettings.vue'
import ForYouEmptyState from '../components/ForYouEmptyState.vue'
import ForYouActionsTab from '../components/ForYouActionsTab.vue'
import { useModuleLink } from '@shared/client/composables/useModuleLink.js'

defineProps({
  size: { type: String, default: 'full' }
})

const { navigateTo: crossNavigate } = useModuleLink()

useAuth()
const { loadRoster } = useRoster()
const { definitions, fetchDefinitions } = useFieldDefinitions()
const { rfeData, loading: rfeLoading } = useAIImpact()
const { features, featureLoading } = useFeatures()
const { assessmentLoading } = useAssessments()

loadRoster()
fetchDefinitions()

const {
  mode,
  manualComponents,
  wizardSeen,
  setMode,
  setManualComponents,
  markWizardSeen
} = useForYouPreferences()

const availableComponents = computed(() => {
  const fields = definitions.value?.personFields || []
  const comp = fields.find(f => f.optionsRef === 'component')
  return comp?.allowedValues || []
})

watch(availableComponents, (allowed) => {
  if (allowed.length > 0 && manualComponents.value.length > 0) {
    const sanitized = sanitizeComponents(manualComponents.value, allowed)
    if (sanitized.length !== manualComponents.value.length) {
      setManualComponents(sanitized)
    }
  }
})

const {
  userComponents,
  userDisplayName,
  rosterResolutionState,
  actionNeeded,
  actionGroups,
  everythingElse,
  stats,
  stageFilter,
  priorityFilter,
  componentFilter,
  availableItemComponents
} = useForYou()

const loading = computed(() => rfeLoading.value || featureLoading.value || assessmentLoading.value)
const showSettings = ref(false)

function handleWizardComplete(wizardMode, components) {
  setMode(wizardMode)
  setManualComponents(components)
  markWizardSeen()
}

function handleWizardSkip() {
  markWizardSeen()
}

function handleSettingsUpdate(newMode, components) {
  setMode(newMode)
  setManualComponents(components)
  showSettings.value = false
}

function handleSwitchToManual() {
  setMode('manual')
  showSettings.value = true
}

const componentSubtitleText = computed(() => {
  if (rosterResolutionState.value === 'manual-empty') return 'No components selected — showing all items'
  if (rosterResolutionState.value === 'not-found') return 'User not found in roster'
  if (rosterResolutionState.value === 'no-components') return 'No components assigned — showing all items'
  return null
})

const showComponentPills = computed(() => userComponents.value.length > 0)
const componentPillsLabel = computed(() => {
  if (rosterResolutionState.value === 'manual') return 'Watching'
  return 'Showing items for'
})

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

function handleNavigate(item) {
  if (item.type === 'rfe') {
    crossNavigate('ai-impact', 'rfe-review', { select: item.key, from: 'sotu' })
  } else {
    crossNavigate('releases', 'feature-detail', { key: item.key, from: 'sotu' })
  }
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
    <!-- Wizard (first-time only) -->
    <ForYouWizard
      v-if="!wizardSeen && !loading"
      :availableComponents="availableComponents"
      :componentsLoading="!definitions?.personFields?.length"
      @complete="handleWizardComplete"
      @skip="handleWizardSkip"
    />

    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">RFE Action Items</h3>
        <p v-if="componentSubtitleText" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          <span v-if="userDisplayName">{{ userDisplayName }} — </span>
          {{ componentSubtitleText }}
        </p>
        <div v-else-if="showComponentPills" class="flex items-center gap-2 mt-1 flex-wrap">
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ componentPillsLabel }}:</span>
          <span
            v-for="comp in userComponents"
            :key="comp"
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
          >{{ comp }}</span>
        </div>
      </div>
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

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
    </div>

    <template v-else>
      <ForYouEmptyState
        v-if="mode === 'auto' && rosterResolutionState === 'no-components'"
        @switchToManual="handleSwitchToManual"
      />

      <div
        v-if="rosterResolutionState === 'manual-empty'"
        class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
      >
        No components selected — showing all items. Use the settings gear to choose components.
      </div>

      <ForYouActionsTab
        :actionNeeded="actionNeeded"
        :actionGroups="actionGroups"
        :everythingElse="everythingElse"
        :stats="stats"
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

      <div class="text-xs text-gray-400 dark:text-gray-500 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
        <span v-if="rfeData?.fetchedAt">RFEs synced: {{ new Date(rfeData.fetchedAt).toLocaleString() }}</span>
        <span v-if="rfeData?.fetchedAt && features"> | </span>
        <span>Features: {{ Object.keys(features).length }} tracked</span>
      </div>
    </template>
  </div>
</template>
