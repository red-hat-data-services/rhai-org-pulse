<template>
  <div>
    <!-- Header with back button -->
    <div class="flex items-center gap-3 mb-4">
      <button
        @click="goBack"
        class="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
        title="Back to Reports"
        aria-label="Back to Reports"
        data-testid="report-shell-back"
      >
        <ArrowLeft :size="18" />
      </button>
      <div>
        <h2 ref="reportHeading" tabindex="-1" class="text-xl font-bold text-gray-900 dark:text-gray-100 outline-none">{{ title }}</h2>
        <p v-if="description" class="text-sm text-gray-500 dark:text-gray-400">{{ description }}</p>
      </div>
    </div>

    <!-- Filter bar -->
    <div
      v-if="hasFilters || $slots.filters"
      class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6 flex flex-wrap items-start gap-6"
    >
      <slot name="filters" />
    </div>

    <!-- Report content -->
    <slot />
  </div>
</template>

<script setup>
import { inject, ref, onMounted, nextTick } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'

defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  hasFilters: { type: Boolean, default: false },
})

const nav = inject('moduleNav')
const reportHeading = ref(null)

onMounted(() => {
  nextTick(() => {
    reportHeading.value?.focus()
  })
})

function goBack() {
  nav.navigateTo('reports')
}
</script>
