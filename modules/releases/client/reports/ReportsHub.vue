<template>
  <div>
    <div v-if="reports.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
      <p class="text-sm">No reports registered yet.</p>
    </div>
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="report in reports"
        :key="report.id"
        class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md transition-shadow"
        @click="$emit('select', report)"
      >
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{{ report.label }}</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ report.description }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reports } from './registry'

defineEmits(['select'])
</script>
