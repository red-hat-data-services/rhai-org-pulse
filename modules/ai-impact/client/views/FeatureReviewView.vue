<script setup>
import { ref, watch, inject } from 'vue'
import { useFeatures } from '../composables/useFeatures.js'
import { useAIImpact } from '../composables/useAIImpact.js'
import { useModuleLink } from '@shared/client/composables/useModuleLink.js'
import { PHASES } from '../constants.js'
import FeatureReviewContent from '../components/FeatureReviewContent.vue'
import FeatureDetailPanel from '../components/FeatureDetailPanel.vue'
import AIImpactGuide from '../components/AIImpactGuide.vue'

const moduleNav = inject('moduleNav')
const { navigateTo: crossNavigate } = useModuleLink()

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

function handleSelectFeature(feature) {
  if (feature) {
    // Navigate to the consolidated Feature Traffic Feature page
    crossNavigate('releases', 'feature-detail', {
      key: feature.key,
      fromFeatureReview: '1'
    })
  }
}

function handleCloseModal() {
  selectedFeature.value = null
  moduleNav.navigateTo('feature-review')
}

function handleNavigateToRFE(rfeKey) {
  moduleNav.navigateTo('rfe-review', { select: rfeKey })
}

function handleNavigateToTestPlan(sourceKey) {
  moduleNav.navigateTo('test-plan-review', { select: sourceKey })
}

// Handle incoming select param (cross-link from RFE Review)
watch(() => moduleNav.params.value, (params) => {
  if (params?.select && Object.keys(features.value).length > 0) {
    const feature = Object.values(features.value).find(f => f.key === params.select)
    if (feature && selectedFeature.value?.key !== feature.key) {
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
      @selectFeature="handleSelectFeature"
      @retry="handleRetry"
    />

    <FeatureDetailPanel
      :show="!!selectedFeature"
      :feature="selectedFeature"
      :phases="PHASES"
      :jiraHost="rfeData?.jiraHost"
      :loadFeatureDetail="loadFeatureDetail"
      @close="handleCloseModal"
      @navigateToRFE="handleNavigateToRFE"
      @navigateToTestPlan="handleNavigateToTestPlan"
    />

    <AIImpactGuide />
  </div>
</template>
