<script setup>
import { ref, inject } from 'vue'
import { useAutofix } from '../composables/useAutofix.js'
import AutofixContent from '../components/AutofixContent.vue'
import AIImpactGuide from '../components/AIImpactGuide.vue'

const tracker = inject('usageTracker', null)
const timeWindow = ref('month')
const { autofixData, loading, error, load } = useAutofix(timeWindow)
</script>

<template>
  <div class="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
    <AutofixContent
      :loading="loading"
      :error="error"
      :autofixData="autofixData"
      :timeWindow="timeWindow"
      @update:timeWindow="timeWindow = $event; tracker?.trackInteraction('ai-impact', 'autofix', 'filter', `timeWindow:${$event}`)"
      @retry="load"
    />

    <AIImpactGuide />
  </div>
</template>
