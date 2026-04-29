<template>
  <div class="space-y-6">
    <!-- Components -->
    <div v-if="components.length > 0" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Components</h3>
      <ComponentList :components="components" :rfeCounts="rfeCounts" :rfeConfig="rfeConfig" />
    </div>

    <!-- RFE Backlog Table -->
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Open RFEs
          <span v-if="rfeIssues.length > 0" class="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
            {{ rfeIssues.length }} issue{{ rfeIssues.length !== 1 ? 's' : '' }}
          </span>
        </h3>
      </div>
      <RfeBacklogTable :issues="rfeIssues" :rfeConfig="rfeConfig" :assessments="assessments" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'
import ComponentList from './ComponentList.vue'
import RfeBacklogTable from './RfeBacklogTable.vue'

const props = defineProps({
  components: { type: Array, default: () => [] },
  rfeIssues: { type: Array, default: () => [] },
  rfeConfig: { type: Object, default: () => ({}) }
})

const assessments = ref({})

async function loadAssessments() {
  try {
    const data = await apiRequest('/modules/ai-impact/assessments')
    assessments.value = data.assessments || {}
  } catch {
    // AI Impact module may be disabled or unavailable — degrade gracefully
    assessments.value = {}
  }
}

// Fetch assessments when RFE issues are available
watch(() => props.rfeIssues, (issues) => {
  if (issues.length > 0) loadAssessments()
}, { immediate: true })

const rfeCounts = computed(() => {
  const counts = {}
  for (const issue of props.rfeIssues) {
    for (const comp of (issue.components || [])) {
      counts[comp] = (counts[comp] || 0) + 1
    }
  }
  return counts
})
</script>
