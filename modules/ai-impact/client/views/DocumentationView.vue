<script setup>
import { useDocumentation } from '../composables/useDocumentation.js'
import { useDocMrKpi } from '../composables/useDocMrKpi.js'
import DocumentationContent from '../components/DocumentationContent.vue'
import AIImpactGuide from '../components/AIImpactGuide.vue'

const { docData, loading, error, load } = useDocumentation()
const { mrKpiData } = useDocMrKpi()
</script>

<template>
  <div class="flex h-full overflow-hidden bg-gray-50 dark:bg-gray-900">
    <DocumentationContent
      :loading="loading"
      :error="error"
      :docData="docData"
      :mrKpiData="mrKpiData"
      @retry="load"
    />
    <AIImpactGuide defaultTab="enablement" />
  </div>
</template>
