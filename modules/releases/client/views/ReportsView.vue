<template>
  <div class="p-6">
    <div v-if="!selectedReport">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Release Reports</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="report in reports"
          :key="report.id"
          @click="selectReport(report)"
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-primary-500 dark:hover:border-primary-500 hover:shadow-md transition-all cursor-pointer"
        >
          <div class="flex items-start gap-4">
            <div class="flex-shrink-0">
              <component
                :is="iconComponents[report.icon]"
                :size="24"
                class="text-primary-600 dark:text-primary-400"
              />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {{ report.label }}
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {{ report.description }}
              </p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="tag in report.tags"
                  :key="tag"
                  class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <component v-else :is="selectedReportComponent" />
  </div>
</template>

<script setup>
import { ref, defineAsyncComponent } from 'vue'
import { Target } from 'lucide-vue-next'
import { reports } from '../reports/registry.js'

const iconComponents = {
  Target
}

const selectedReport = ref(null)
const selectedReportComponent = ref(null)

function selectReport(report) {
  selectedReport.value = report
  selectedReportComponent.value = defineAsyncComponent(report.component)
}
</script>
