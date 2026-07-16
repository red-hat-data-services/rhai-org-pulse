<script setup>
import { ref, watch, inject } from 'vue'
import { useTestPlans } from '../composables/useTestPlans.js'
import { useAIImpact } from '../composables/useAIImpact.js'
import { PHASES } from '../constants.js'
import TestPlanReviewContent from '../components/TestPlanReviewContent.vue'
import TestPlanDetailPanel from '../components/TestPlanDetailPanel.vue'
import AIImpactGuide from '../components/AIImpactGuide.vue'

const moduleNav = inject('moduleNav')

const selectedPlan = ref(null)
const searchQuery = ref('')
const verdictFilter = ref('all')
const sortBy = ref('default')
const chartExpanded = ref(true)
const timeWindow = ref('month')

const {
  testPlans, testPlanMeta, metrics, trendData, breakdown, reviewStatus,
  testPlanLoading, testPlanError, loadTestPlans, loadTestPlanDetail
} = useTestPlans(timeWindow)

// Load RFE data only for jiraHost (used by detail panel links)
const rfeTimeWindow = ref('month')
const { rfeData } = useAIImpact(rfeTimeWindow)

function handleRetry() {
  loadTestPlans()
}

function handleSelectPlan(plan) {
  selectedPlan.value = plan
  if (plan) {
    moduleNav.navigateTo('test-plan-review', { select: plan.key })
  }
}

function handleCloseModal() {
  selectedPlan.value = null
  moduleNav.navigateTo('test-plan-review')
}

function handleNavigateToFeature(featureKey) {
  moduleNav.navigateTo('feature-review', { select: featureKey })
}

function handleNavigateToRFE(rfeKey) {
  moduleNav.navigateTo('rfe-review', { select: rfeKey })
}

// Handle incoming select param (cross-link from other views)
watch(() => moduleNav.params.value, (params) => {
  if (params?.select && Object.keys(testPlans.value).length > 0) {
    const plan = Object.values(testPlans.value).find(p => p.key === params.select)
    if (plan && selectedPlan.value?.key !== plan.key) {
      searchQuery.value = ''
      verdictFilter.value = 'all'
      sortBy.value = 'default'
      selectedPlan.value = plan
    }
  }
}, { immediate: true })

// Also watch for test plans loading (select param may arrive before data)
watch(() => Object.keys(testPlans.value).length, () => {
  const params = moduleNav.params.value
  if (params?.select && !selectedPlan.value) {
    const plan = Object.values(testPlans.value).find(p => p.key === params.select)
    if (plan) {
      selectedPlan.value = plan
    }
  }
})
</script>

<template>
  <div class="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
    <TestPlanReviewContent
      :loading="testPlanLoading"
      :error="testPlanError"
      :testPlans="testPlans"
      :testPlanMeta="testPlanMeta"
      :metrics="metrics"
      :trendData="trendData"
      :breakdown="breakdown"
      :reviewStatus="reviewStatus"
      :timeWindow="timeWindow"
      :chartExpanded="chartExpanded"
      :searchQuery="searchQuery"
      :verdictFilter="verdictFilter"
      :sortBy="sortBy"
      :selectedPlan="selectedPlan"
      @update:timeWindow="timeWindow = $event"
      @update:chartExpanded="chartExpanded = $event"
      @update:searchQuery="searchQuery = $event"
      @update:verdictFilter="verdictFilter = $event"
      @update:sortBy="sortBy = $event"
      @selectPlan="handleSelectPlan"
      @retry="handleRetry"
    />

    <TestPlanDetailPanel
      :show="!!selectedPlan"
      :plan="selectedPlan"
      :phases="PHASES"
      :jiraHost="rfeData?.jiraHost"
      :loadTestPlanDetail="loadTestPlanDetail"
      @close="handleCloseModal"
      @navigateToFeature="handleNavigateToFeature"
      @navigateToRFE="handleNavigateToRFE"
    />

    <AIImpactGuide defaultTab="testplans" />
  </div>
</template>
