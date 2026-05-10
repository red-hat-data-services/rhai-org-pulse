<script setup>
import { useComponentOnboarding } from '../composables/useComponentOnboarding.js'
import ComponentOnboardingContent from '../components/ComponentOnboardingContent.vue'
import AIImpactGuide from '../components/AIImpactGuide.vue'

const { data, loading, error, load, loadDetail, detailCache } = useComponentOnboarding()
</script>

<template>
  <div class="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
    <ComponentOnboardingContent
      :loading="loading"
      :error="error"
      :data="data"
      :detailCache="detailCache"
      @loadDetail="loadDetail($event)"
      @retry="load"
    />

    <AIImpactGuide />
  </div>
</template>
