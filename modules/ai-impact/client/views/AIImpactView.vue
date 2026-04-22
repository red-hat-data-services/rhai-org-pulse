<script setup>
import { ref, computed } from 'vue'
import { useAIImpact } from '../composables/useAIImpact.js'
import { useAutofix } from '../composables/useAutofix.js'
import { useAssessments } from '../composables/useAssessments.js'
import { useFeatures } from '../composables/useFeatures.js'
import PhaseSidebar from '../components/PhaseSidebar.vue'
import PhaseContent from '../components/PhaseContent.vue'
import AutofixContent from '../components/AutofixContent.vue'
import ComingSoonPlaceholder from '../components/ComingSoonPlaceholder.vue'
import RFEDetailPanel from '../components/RFEDetailPanel.vue'
import FeatureReviewContent from '../components/FeatureReviewContent.vue'
import FeatureDetailPanel from '../components/FeatureDetailPanel.vue'

const selectedPhase = ref('rfe-review')
const selectedRFE = ref(null)
const selectedFeature = ref(null)
const timeWindow = ref('week')
const filter = ref('all')
const searchQuery = ref('')
const chartExpanded = ref(true)
const sortBy = ref('default')
const passFailFilter = ref('all')
const priorityFilter = ref('all')
const statusFilter = ref('all')

// Feature review filters
const featureSearchQuery = ref('')
const featureRecommendationFilter = ref('all')
const featurePriorityFilter = ref('all')
const featureHumanReviewFilter = ref('all')
const featureNeedsAttentionFilter = ref('all')
const featureSortBy = ref('default')

const { rfeData, loading, error, load } = useAIImpact(timeWindow)
const { assessments, loadAssessments, loadAssessmentDetail } = useAssessments()
const { features, featureMeta, featureLoading, featureError, loadFeatures, loadFeatureDetail } = useFeatures()

// Load assessments and features alongside RFE data
loadAssessments()
loadFeatures()

const autofixTimeWindow = ref('month')
const { autofixData, loading: autofixLoading, error: autofixError, load: autofixLoad } = useAutofix(autofixTimeWindow)

const metrics = computed(() => rfeData.value?.metrics || null)
const trendData = computed(() => rfeData.value?.trendData || [])
const breakdown = computed(() => rfeData.value?.breakdown || [])

const phases = [
  { id: 'rfe-review', name: 'RFE Review', order: 1, status: 'active' },
  { id: 'feature-review', name: 'Feature Review', order: 2, status: 'active' },
  { id: 'implementation', name: 'Implementation', order: 3, status: 'coming-soon' },
  { id: 'qe-validation', name: 'QE / Validation', order: 4, status: 'coming-soon' },
  { id: 'security', name: 'Security Review', order: 5, status: 'coming-soon' },
  { id: 'documentation', name: 'Documentation', order: 6, status: 'coming-soon' },
  { id: 'build-release', name: 'Build & Release', order: 7, status: 'coming-soon' },
]

const workflows = [
  { id: 'autofix', name: 'Jira AutoFix', status: 'active' }
]

const isPhase = computed(() => phases.some(p => p.id === selectedPhase.value))
const isWorkflow = computed(() => workflows.some(w => w.id === selectedPhase.value))
const activePhase = computed(() => phases.find(p => p.id === selectedPhase.value))

const timeWindowCutoff = computed(() => {
  const days = timeWindow.value === 'week' ? 7 : timeWindow.value === '3months' ? 90 : 30
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
})

const filteredRFEs = computed(() => {
  if (!rfeData.value?.issues) return []
  return rfeData.value.issues.filter(rfe => {
    const matchesTime = new Date(rfe.created) >= timeWindowCutoff.value
    const matchesFilter = filter.value === 'all' || rfe.aiInvolvement === filter.value
    const q = searchQuery.value.toLowerCase()
    const matchesSearch = !q ||
      rfe.summary.toLowerCase().includes(q) ||
      rfe.key.toLowerCase().includes(q) ||
      (rfe.creatorDisplayName && rfe.creatorDisplayName.toLowerCase().includes(q))
    return matchesTime && matchesFilter && matchesSearch
  })
})

// Reverse lookup: sourceRfe → feature key/status for cross-linking
const rfeToFeature = computed(() => {
  const map = {}
  for (const f of Object.values(features.value)) {
    if (f.sourceRfe) {
      map[f.sourceRfe] = { key: f.key, summary: f.title, status: f.status || 'Unknown', fixVersions: [] }
    }
  }
  return map
})

// Enrich selected RFE with linkedFeature from features data when Jira link is missing
const enrichedSelectedRFE = computed(() => {
  const rfe = selectedRFE.value
  if (!rfe) return null
  if (rfe.linkedFeature) return rfe
  const featureLink = rfeToFeature.value[rfe.key]
  if (!featureLink) return rfe
  return { ...rfe, linkedFeature: featureLink }
})

const filteredAssessments = computed(() => {
  const rfeKeys = new Set(filteredRFEs.value.map(r => r.key))
  const result = {}
  for (const [key, assessment] of Object.entries(assessments.value)) {
    if (rfeKeys.has(key)) {
      result[key] = assessment
    }
  }
  return result
})

function handleRetry() {
  load()
  loadAssessments()
}

function handleFeatureRetry() {
  loadFeatures()
}

function handleSelect(id) {
  selectedPhase.value = id
  selectedRFE.value = null
  selectedFeature.value = null
}

function handleNavigateToFeature(featureKey) {
  // Cross-link: switch to Feature Review phase and select the linked feature
  featureSearchQuery.value = ''
  featureRecommendationFilter.value = 'all'
  featurePriorityFilter.value = 'all'
  featureHumanReviewFilter.value = 'all'
  featureNeedsAttentionFilter.value = 'all'
  featureSortBy.value = 'default'

  selectedPhase.value = 'feature-review'
  selectedRFE.value = null

  const featureList = Object.values(features.value)
  const feature = featureList.find(f => f.key === featureKey)
  if (feature) {
    selectedFeature.value = feature
  } else {
    const jiraHost = rfeData.value?.jiraHost
    if (jiraHost) {
      window.open(`${jiraHost}/browse/${featureKey}`, '_blank')
    }
  }
}

function handleNavigateToRFE(rfeKey) {
  // Cross-link: switch to RFE Review phase and select the source RFE
  // Reset filters to maximize chance of finding the RFE
  filter.value = 'all'
  searchQuery.value = ''
  passFailFilter.value = 'all'
  priorityFilter.value = 'all'
  statusFilter.value = 'all'
  timeWindow.value = '3months'

  selectedPhase.value = 'rfe-review'
  selectedFeature.value = null

  // Find the RFE in the full issues array (not filteredRFEs which may exclude it)
  const rfe = rfeData.value?.issues?.find(r => r.key === rfeKey)
  if (rfe) {
    selectedRFE.value = rfe
  } else {
    // Fall back to Jira link
    const jiraHost = rfeData.value?.jiraHost
    if (jiraHost) {
      window.open(`${jiraHost}/browse/${rfeKey}`, '_blank')
    }
  }
}

</script>

<template>
  <div class="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
    <PhaseSidebar
      :phases="phases"
      :workflows="workflows"
      :selectedPhase="selectedPhase"
      @select="handleSelect"
    />

    <!-- RFE Review phase -->
    <template v-if="selectedPhase === 'rfe-review'">
      <PhaseContent
        :phase="activePhase"
        :loading="loading"
        :error="error"
        :rfeData="rfeData"
        :metrics="metrics"
        :trendData="trendData"
        :breakdown="breakdown"
        :filteredRFEs="filteredRFEs"
        :timeWindow="timeWindow"
        :filter="filter"
        :searchQuery="searchQuery"
        :chartExpanded="chartExpanded"
        :assessments="assessments"
        :filteredAssessments="filteredAssessments"
        :sortBy="sortBy"
        :passFailFilter="passFailFilter"
        :priorityFilter="priorityFilter"
        :statusFilter="statusFilter"
        @update:timeWindow="timeWindow = $event"
        @update:filter="filter = $event"
        @update:searchQuery="searchQuery = $event"
        @update:chartExpanded="chartExpanded = $event"
        @update:sortBy="sortBy = $event"
        @update:passFailFilter="passFailFilter = $event"
        @update:priorityFilter="priorityFilter = $event"
        @update:statusFilter="statusFilter = $event"
        @selectRFE="selectedRFE = $event"
        @retry="handleRetry"
      />

      <RFEDetailPanel
        v-if="enrichedSelectedRFE"
        :rfe="enrichedSelectedRFE"
        :phases="phases"
        :jiraHost="rfeData?.jiraHost"
        :assessment="assessments[selectedRFE?.key] || null"
        :loadAssessmentDetail="loadAssessmentDetail"
        @close="selectedRFE = null"
        @navigateToFeature="handleNavigateToFeature"
      />
    </template>

    <!-- Feature Review phase -->
    <template v-else-if="selectedPhase === 'feature-review'">
      <FeatureReviewContent
        :loading="featureLoading"
        :error="featureError"
        :features="features"
        :featureMeta="featureMeta"
        :searchQuery="featureSearchQuery"
        :recommendationFilter="featureRecommendationFilter"
        :priorityFilter="featurePriorityFilter"
        :humanReviewFilter="featureHumanReviewFilter"
        :needsAttentionFilter="featureNeedsAttentionFilter"
        :sortBy="featureSortBy"
        :selectedFeature="selectedFeature"
        @update:searchQuery="featureSearchQuery = $event"
        @update:recommendationFilter="featureRecommendationFilter = $event"
        @update:priorityFilter="featurePriorityFilter = $event"
        @update:humanReviewFilter="featureHumanReviewFilter = $event"
        @update:needsAttentionFilter="featureNeedsAttentionFilter = $event"
        @update:sortBy="featureSortBy = $event"
        @selectFeature="selectedFeature = $event"
        @retry="handleFeatureRetry"
      />

      <FeatureDetailPanel
        v-if="selectedFeature"
        :feature="selectedFeature"
        :phases="phases"
        :jiraHost="rfeData?.jiraHost"
        :loadFeatureDetail="loadFeatureDetail"
        @close="selectedFeature = null"
        @navigateToRFE="handleNavigateToRFE"
      />
    </template>

    <!-- Workflow views -->
    <AutofixContent
      v-else-if="isWorkflow && selectedPhase === 'autofix'"
      :loading="autofixLoading"
      :error="autofixError"
      :autofixData="autofixData"
      :timeWindow="autofixTimeWindow"
      @update:timeWindow="autofixTimeWindow = $event"
      @retry="autofixLoad"
    />

    <!-- Coming soon placeholder for inactive phases -->
    <ComingSoonPlaceholder
      v-else-if="isPhase"
      :phaseName="activePhase?.name || 'this phase'"
    />
  </div>
</template>
