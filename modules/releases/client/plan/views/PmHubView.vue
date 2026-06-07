<template>
  <div>
    <div v-if="!selectedReport">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          v-for="report in reports"
          :key="report.id"
          class="group text-left bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all duration-200"
          :aria-label="report.label"
          @click="selectedReport = report"
        >
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-900/50 transition-colors">
              <svg class="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            </div>
            <div class="min-w-0">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{{ report.label }}</h3>
              <p class="text-xs text-gray-500 dark:text-gray-400">{{ report.description }}</p>
            </div>
          </div>
        </button>
      </div>
    </div>
    <div v-else>
      <button
        class="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1 mb-4"
        @click="selectedReport = null"
      >
        &larr; Back to PM Hub
      </button>
      <component :is="selectedReport.component" />
    </div>
  </div>
</template>

<script setup>
import { ref, defineAsyncComponent } from 'vue'

const reports = [
  {
    id: 'component-release-load',
    label: 'Component Release Load Tracking',
    description: 'Track component workload distribution across releases to identify capacity risks and balance engineering load.',
    component: defineAsyncComponent(() => import('./ComponentReleaseLoadReport.vue'))
  }
]

const selectedReport = ref(null)
</script>
