<script setup>
import { ref } from 'vue'
import { useComponentOnboarding } from '../composables/useComponentOnboarding.js'
import ComponentOnboardingContent from '../components/ComponentOnboardingContent.vue'
import AIImpactGuide from '../components/AIImpactGuide.vue'

const search = ref('')
const completionFilter = ref('all')
const productFilter = ref('all')

const { data, loading, error, load, loadDetail, detailCache } = useComponentOnboarding()
</script>

<template>
  <div class="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
    <ComponentOnboardingContent
      :loading="loading"
      :error="error"
      :data="data"
      :search="search"
      :completionFilter="completionFilter"
      :productFilter="productFilter"
      :detailCache="detailCache"
      @update:search="search = $event"
      @update:completionFilter="completionFilter = $event"
      @update:productFilter="productFilter = $event"
      @loadDetail="loadDetail($event)"
      @retry="load"
    />

    <AIImpactGuide />
  </div>
</template>
