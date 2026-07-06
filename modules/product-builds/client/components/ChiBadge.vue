<script setup>
import { chiGradeBadgeClass, formatDate } from '../utils/formatting'

defineProps({
  healthIndex: { type: Object, default: null },
  showDetails: { type: Boolean, default: false },
})
</script>

<template>
  <div v-if="healthIndex" class="flex items-center gap-2">
    <span
      class="inline-flex items-center px-2.5 py-1 rounded text-sm font-bold"
      :class="chiGradeBadgeClass(healthIndex.grade)"
      :title="healthIndex.grade !== 'Unknown' && healthIndex.vulnerability_count != null
        ? `${healthIndex.vulnerability_count} vulnerabilities`
        : ''"
    >{{ healthIndex.grade }}</span>
    <template v-if="showDetails && healthIndex.grade !== 'Unknown'">
      <span
        v-if="healthIndex.vulnerability_count != null"
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
      >{{ healthIndex.vulnerability_count }} vulnerabilities</span>
      <span v-if="healthIndex.grade_date" class="text-xs text-gray-400 dark:text-gray-500">
        · {{ formatDate(healthIndex.grade_date) }}
      </span>
    </template>
  </div>
</template>
