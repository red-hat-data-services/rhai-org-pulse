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
import ForYouWizard from './ForYouWizard.vue'
import ForYouSettings from './ForYouSettings.vue'
import ForYouEmptyState from './ForYouEmptyState.vue'
import ForYouActionsTab from './ForYouActionsTab.vue'
import ForYouBoardTab from './ForYouBoardTab.vue'
import { useModuleLink } from '@shared/client/composables/useModuleLink.js'

const { navigateTo: crossNavigate } = useModuleLink()

// Load all data sources in parallel
const { user } = useAuth()
const { rosterData, loadRoster } = useRoster()
const { definitions, fetchDefinitions } = useFieldDefinitions()
const timeWindow = ref('month')
const { rfeData, loading: rfeLoading } = useAIImpact(timeWindow)
const { features, featureLoading, loadFeatures } = useFeatures()
const { assessments, assessmentLoading, loadAssessments } = useAssessments()

loadRoster()
fetchDefinitions()
loadFeatures()
loadAssessments()

// Preferences
const {
  mode,
  manualComponents,
  wizardSeen,
  activeTab,
  setMode,
  setManualComponents,
  markWizardSeen,
  setActiveTab
} = useForYouPreferences()

// Available components from field definitions
const availableComponents = computed(() => {
  const fields = definitions.value?.personFields || []
  const comp = fields.find(f => f.optionsRef === 'component')
  return comp?.allowedValues || []
})

// Sanitize stored components when definitions load
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
  everythingElse,
  boardColumns,
  actionGroups,
  stats,
  stageFilter,
  priorityFilter,
  componentFilter,
  availableItemComponents
} = useForYou(rosterData, user, rfeData, features, assessments, definitions, { mode, manualComponents })

const loading = computed(() => rfeLoading.value || featureLoading.value || assessmentLoading.value)

const showSettings = ref(false)

// Tab definitions
const tabs = [
  { id: 'actions', label: 'Actions' },
  { id: 'board', label: 'Board' }
]

// Wizard handlers
function handleWizardComplete(wizardMode, components) {
  setMode(wizardMode)
  setManualComponents(components)
  markWizardSeen()
}

function handleWizardSkip() {
  markWizardSeen()
}

// Settings handlers
function handleSettingsUpdate(newMode, components) {
  setMode(newMode)
  setManualComponents(components)
  showSettings.value = false
}

// Empty state handler
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
  <div class="max-w-[90rem] mx-auto space-y-6">
    <!-- Wizard (first-time only) -->
    <ForYouWizard
      v-if="!wizardSeen && !loading"
      :availableComponents="availableComponents"
      :componentsLoading="!definitions?.personFields?.length"
      @complete="handleWizardComplete"
      @skip="handleWizardSkip"
    />

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <p v-if="componentSubtitleText" class="text-sm text-gray-500 dark:text-gray-400">
          <span v-if="userDisplayName">{{ userDisplayName }} — </span>
          {{ componentSubtitleText }}
        </p>
        <div v-else-if="showComponentPills" class="flex items-center gap-2 mt-2 flex-wrap">
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

    <!-- Tab bar -->
    <div class="border-b border-gray-200 dark:border-gray-700">
      <nav class="flex gap-6" aria-label="View tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="setActiveTab(tab.id)"
          class="pb-2.5 text-sm font-medium border-b-2 transition-colors"
          :class="activeTab === tab.id
            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
        >{{ tab.label }}</button>
      </nav>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
    </div>

    <template v-else>
      <!-- Empty state: auto mode but no components found -->
      <ForYouEmptyState
        v-if="mode === 'auto' && rosterResolutionState === 'no-components'"
        @switchToManual="handleSwitchToManual"
      />

      <!-- Manual empty banner -->
      <div
        v-if="rosterResolutionState === 'manual-empty'"
        class="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
      >
        No components selected — showing all items. Use the settings gear to choose components.
      </div>

      <!-- Tab content -->
      <ForYouActionsTab
        v-if="activeTab === 'actions'"
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

      <ForYouBoardTab
        v-else-if="activeTab === 'board'"
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

      <!-- Footer timestamps -->
      <div class="text-xs text-gray-400 dark:text-gray-500 pt-4 border-t border-gray-200 dark:border-gray-700">
        <span v-if="rfeData?.fetchedAt">RFEs synced: {{ new Date(rfeData.fetchedAt).toLocaleString() }}</span>
        <span v-if="rfeData?.fetchedAt && features"> | </span>
        <span>Features: {{ Object.keys(features).length }} tracked</span>
      </div>
    </template>
  </div>
</template>
