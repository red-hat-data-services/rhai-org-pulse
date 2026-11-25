<script setup>
import { computed } from 'vue'
import { buildFpdorTooltip } from '../ai-planner/core.js'

const props = defineProps({
  feature: { type: Object, required: true },
  jiraBaseUrl: { type: String, default: 'https://issues.redhat.com/browse' },
  index: { type: Number, default: null }
})

const riskClass = computed(() => {
  switch (props.feature._riskLevel) {
    case 'HIGH':
    case 'CRITICAL': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
    case 'MEDIUM': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
    default: return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
  }
})

const components = computed(() => (props.feature['Components'] || '').split(';').map(s => s.trim()).filter(Boolean))

// index.html used to show the FPDoR tier breakdown as permanent inline pills
// under the w-score; PR #1877 (Nov 10) made it hover-only to declutter the
// table, reusing the same tooltip text already shown on the badge.
const fpdorTooltip = computed(() => buildFpdorTooltip(props.feature))
</script>

<template>
  <!-- Nov 24 2026: Added colored left border and row separators -->
  <tr
    role="row"
    class="border-b-2 bg-white dark:bg-gray-900 border-l-4"
    :class="feature._riskLevel === 'HIGH' || feature._riskLevel === 'CRITICAL' ? 'border-b-red-100 dark:border-b-red-900/40 border-l-red-500' : 'border-b-green-100 dark:border-b-green-900/40 border-l-green-500'"
  >
    <!-- Nov 24 2026: REORDERED to match header layout (FPDOR, Risk, Confidence, Priority, OC#, Feature Key, Title, Outcome, Target Version, Fix Version, Components, Team) -->
    <td class="px-2 py-2.5 text-center text-xs tabular-nums text-gray-400 dark:text-gray-600 select-none w-8 shrink-0">
      {{ index != null ? index : '' }}
    </td>

    <!-- FPDOR cell with hover tooltip -->
    <td class="px-3 py-2.5 whitespace-nowrap text-center relative group">
      <span class="text-xs font-mono text-gray-700 dark:text-gray-300 cursor-help">{{ feature['FPDoR'] || '—' }}</span>
      <span class="text-xs text-gray-400">(w:{{ feature._wFPDoR }})</span>
      <div class="absolute bottom-full mb-2 right-0 hidden group-hover:block bg-gray-900 dark:bg-gray-800 text-white dark:text-gray-100 text-xs rounded px-3 py-2 whitespace-normal z-[9999] pointer-events-none shadow-lg border border-gray-700 w-max max-w-xs">
        {{ fpdorTooltip }}
      </div>
    </td>

    <!-- Risk -->
    <td class="px-3 py-2.5 whitespace-nowrap text-center">
      <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium" :class="riskClass">{{ feature._riskLevel || '—' }}</span>
    </td>

    <!-- Confidence -->
    <td class="px-3 py-2.5 whitespace-nowrap text-center">
      <span class="text-xs font-semibold tabular-nums text-gray-800 dark:text-gray-200">{{ feature._conf != null ? feature._conf + '%' : '—' }}</span>
    </td>

    <!-- Priority -->
    <td class="px-3 py-2.5 whitespace-nowrap">
      <span class="text-xs text-gray-700 dark:text-gray-300">{{ feature['Priority'] || '—' }}</span>
    </td>

    <!-- OC# (Outcome Number) -->
    <td class="px-3 py-2.5 whitespace-nowrap text-center">
      <span class="text-xs text-gray-700 dark:text-gray-300">{{ feature['OutcomeNumber'] || '—' }}</span>
    </td>

    <!-- Feature Key -->
    <td class="px-3 py-2.5 whitespace-nowrap">
      <a
        :href="jiraBaseUrl + '/' + feature['Key']"
        target="_blank"
        rel="noopener noreferrer"
        class="font-mono text-xs font-medium text-primary-600 dark:text-blue-400 hover:underline"
      >{{ feature['Key'] }}</a>
    </td>

    <!-- Title -->
    <td class="px-3 py-2.5 max-w-xs">
      <span class="text-xs text-gray-900 dark:text-gray-100 block truncate" :title="feature['Title']">{{ feature['Title'] || '—' }}</span>
    </td>

    <!-- Outcome -->
    <td class="px-3 py-2.5 max-w-[8rem]">
      <span class="text-xs text-gray-700 dark:text-gray-300 block truncate" :title="feature['Outcome'] || undefined">{{ feature['Outcome'] || '—' }}</span>
    </td>

    <!-- Target Version -->
    <td class="px-3 py-2.5 whitespace-nowrap">
      <span class="font-mono text-xs text-gray-700 dark:text-gray-300">{{ feature['Target Versions'] || '—' }}</span>
    </td>

    <!-- Fix Version -->
    <td class="px-3 py-2.5 whitespace-nowrap">
      <span class="font-mono text-xs text-gray-700 dark:text-gray-300">{{ feature['Fix Version'] || '—' }}</span>
    </td>

    <!-- Components -->
    <td class="px-3 py-2.5">
      <div class="flex flex-wrap gap-1">
        <span
          v-for="c in components.slice(0, 2)"
          :key="c"
          class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
        >{{ c }}</span>
        <span v-if="components.length > 2" class="text-xs text-gray-400 dark:text-gray-500" :title="components.slice(2).join(', ')">+{{ components.length - 2 }}</span>
        <span v-if="!components.length" class="text-xs text-gray-400 dark:text-gray-600">—</span>
      </div>
    </td>

    <!-- Team -->
    <td class="px-3 py-2.5 whitespace-nowrap">
      <span class="text-xs text-gray-700 dark:text-gray-300">{{ feature['Team'] || '—' }}</span>
    </td>
  </tr>
</template>
