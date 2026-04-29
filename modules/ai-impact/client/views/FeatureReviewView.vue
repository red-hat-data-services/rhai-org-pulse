<script setup>
import { ref, watch, inject } from 'vue'
import { useFeatures } from '../composables/useFeatures.js'
import { useAIImpact } from '../composables/useAIImpact.js'
import { PHASES } from '../constants.js'
import FeatureReviewContent from '../components/FeatureReviewContent.vue'
import FeatureDetailPanel from '../components/FeatureDetailPanel.vue'
import AIImpactGuide from '../components/AIImpactGuide.vue'

const moduleNav = inject('moduleNav')

const selectedFeature = ref(null)
const searchQuery = ref('')
const recommendationFilter = ref('all')
const priorityFilter = ref('all')
const humanReviewFilter = ref('all')
const sortBy = ref('default')

const { features, featureMeta, featureLoading, featureError, loadFeatures, loadFeatureDetail } = useFeatures()

loadFeatures()

// Load RFE data only for jiraHost (used by detail panel links)
const timeWindow = ref('month')
const { rfeData } = useAIImpact(timeWindow)

function handleRetry() {
  loadFeatures()
}

function handleNavigateToRFE(rfeKey) {
  moduleNav.navigateTo('rfe-review', { select: rfeKey })
}

// Handle incoming select param (cross-link from RFE Review)
watch(() => moduleNav.params.value, (params) => {
  if (params?.select && Object.keys(features.value).length > 0) {
    const feature = Object.values(features.value).find(f => f.key === params.select)
    if (feature) {
      searchQuery.value = ''
      recommendationFilter.value = 'all'
      priorityFilter.value = 'all'
      humanReviewFilter.value = 'all'
      sortBy.value = 'default'
      selectedFeature.value = feature
    }
  }
}, { immediate: true })

// Also watch for features loading (select param may arrive before data)
watch(() => Object.keys(features.value).length, () => {
  const params = moduleNav.params.value
  if (params?.select && !selectedFeature.value) {
    const feature = Object.values(features.value).find(f => f.key === params.select)
    if (feature) {
      selectedFeature.value = feature
    }
  }
})
</script>

<template>
  <div class="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
    <FeatureReviewContent
      :loading="featureLoading"
      :error="featureError"
      :features="features"
      :featureMeta="featureMeta"
      :searchQuery="searchQuery"
      :recommendationFilter="recommendationFilter"
      :priorityFilter="priorityFilter"
      :humanReviewFilter="humanReviewFilter"
      :sortBy="sortBy"
      :selectedFeature="selectedFeature"
      @update:searchQuery="searchQuery = $event"
      @update:recommendationFilter="recommendationFilter = $event"
      @update:priorityFilter="priorityFilter = $event"
      @update:humanReviewFilter="humanReviewFilter = $event"
      @update:sortBy="sortBy = $event"
      @selectFeature="selectedFeature = $event"
      @retry="handleRetry"
    />

    <FeatureDetailPanel
      v-if="selectedFeature"
      :feature="selectedFeature"
      :phases="PHASES"
      :jiraHost="rfeData?.jiraHost"
      :loadFeatureDetail="loadFeatureDetail"
      @close="selectedFeature = null"
      @navigateToRFE="handleNavigateToRFE"
    />

    <AIImpactGuide />
  </div>
</template>
