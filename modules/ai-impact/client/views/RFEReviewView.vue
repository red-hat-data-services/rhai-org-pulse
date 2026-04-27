<script setup>
import { ref, computed, watch, inject } from 'vue'
import { useAIImpact } from '../composables/useAIImpact.js'
import { useAssessments } from '../composables/useAssessments.js'
import { useFeatures } from '../composables/useFeatures.js'
import { PHASES } from '../constants.js'
import PhaseContent from '../components/PhaseContent.vue'
import RFEDetailPanel from '../components/RFEDetailPanel.vue'
import AIImpactGuide from '../components/AIImpactGuide.vue'

const moduleNav = inject('moduleNav')

const selectedRFE = ref(null)
const timeWindow = ref('week')
const filter = ref('all')
const searchQuery = ref('')
const chartExpanded = ref(true)
const sortBy = ref('default')
const passFailFilter = ref('all')
const priorityFilter = ref('all')
const statusFilter = ref('all')

const { rfeData, loading, error, load } = useAIImpact(timeWindow)
const { assessments, loadAssessments, loadAssessmentDetail } = useAssessments()
const { features, loadFeatures } = useFeatures()

loadAssessments()
loadFeatures()

const phase = PHASES.find(p => p.id === 'rfe-review')
const metrics = computed(() => rfeData.value?.metrics || null)
const trendData = computed(() => rfeData.value?.trendData || [])
const breakdown = computed(() => rfeData.value?.breakdown || [])

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

// Reverse lookup: sourceRfe -> feature key/status for cross-linking
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

function handleNavigateToFeature(featureKey) {
  moduleNav.navigateTo('feature-review', { select: featureKey })
}

// Handle incoming select param (cross-link from Feature Review)
watch(() => moduleNav.params.value, (params) => {
  if (params?.select && rfeData.value?.issues) {
    const rfe = rfeData.value.issues.find(r => r.key === params.select)
    if (rfe) {
      filter.value = 'all'
      searchQuery.value = ''
      passFailFilter.value = 'all'
      priorityFilter.value = 'all'
      statusFilter.value = 'all'
      selectedRFE.value = rfe
    }
  }
}, { immediate: true })
</script>

<template>
  <div class="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
    <PhaseContent
      :phase="phase"
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
      :phases="PHASES"
      :jiraHost="rfeData?.jiraHost"
      :assessment="assessments[selectedRFE?.key] || null"
      :loadAssessmentDetail="loadAssessmentDetail"
      @close="selectedRFE = null"
      @navigateToFeature="handleNavigateToFeature"
    />

    <AIImpactGuide />
  </div>
</template>
