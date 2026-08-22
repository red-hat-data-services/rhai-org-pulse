<script setup>
import { ref, watch, inject } from 'vue'
import { useDecomposer } from '../composables/useDecomposer.js'
import { useModuleLink } from '@shared/client/composables/useModuleLink.js'
import { PHASES } from '../constants.js'
import DecomposerContent from '../components/DecomposerContent.vue'
import DecomposerDetailPanel from '../components/DecomposerDetailPanel.vue'

const moduleNav = inject('moduleNav')
const { navigateTo: crossNavigate } = useModuleLink()

const { snapshot, loading, error, load } = useDecomposer()

const selectedStrategy = ref(null)

function handleSelectStrategy(strategy) {
  selectedStrategy.value = strategy
  if (strategy) {
    moduleNav.navigateTo('feature-decomposer', { select: strategy.strat_id })
  }
}

function handleCloseModal() {
  selectedStrategy.value = null
  moduleNav.navigateTo('feature-decomposer')
}

function handleNavigateToRFE(rfeKey) {
  moduleNav.navigateTo('rfe-review', { select: rfeKey })
}

function handleNavigateToFeature(featureKey) {
  crossNavigate('releases', 'feature-detail', {
    key: featureKey,
    fromDecomposer: '1'
  })
}

function handleNavigateToTestPlan(sourceKey) {
  moduleNav.navigateTo('test-plan-review', { select: sourceKey })
}

function handleNavigateToDocumentation(featureKey) {
  moduleNav.navigateTo('documentation', { highlight: featureKey })
}

function handleNavigateToBuildRelease(featureKey) {
  moduleNav.navigateTo('build-release', { highlight: featureKey })
}

const jiraHost = () => (snapshot.value?.jiraHost || 'https://redhat.atlassian.net').replace(/\/$/, '')

// Handle incoming select param (cross-link from other views)
watch([() => moduleNav.params.value, snapshot], ([params]) => {
  if (params?.select && snapshot.value?.strategies?.length > 0) {
    const strategy = snapshot.value.strategies.find(s => s.strat_id === params.select)
    if (strategy && selectedStrategy.value?.strat_id !== strategy.strat_id) {
      selectedStrategy.value = strategy
    }
  }
}, { immediate: true })
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
    <DecomposerContent
      :snapshot="snapshot"
      :loading="loading"
      :error="error"
      @retry="load"
      @selectStrategy="handleSelectStrategy"
    />

    <DecomposerDetailPanel
      :show="!!selectedStrategy"
      :strategy="selectedStrategy"
      :phases="PHASES"
      :jiraHost="jiraHost()"
      @close="handleCloseModal"
      @navigateToRFE="handleNavigateToRFE"
      @navigateToFeature="handleNavigateToFeature"
      @navigateToTestPlan="handleNavigateToTestPlan"
      @navigateToDocumentation="handleNavigateToDocumentation"
      @navigateToBuildRelease="handleNavigateToBuildRelease"
    />
  </div>
</template>
