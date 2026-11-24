<script setup>
import { computed } from 'vue'
import { buildFpdorTooltip } from '../ai-planner/core.js'

const props = defineProps({
  feature: { type: Object, required: true },
  approval: { type: Object, default: () => ({ pm: false, do: false }) },
  jiraBaseUrl: { type: String, default: 'https://issues.redhat.com/browse' },
  index: { type: Number, default: null }
})

const emit = defineEmits(['toggle-approval'])

const placementClass = computed(() => {
  switch (props.feature._place) {
    case 'EA1': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
    case 'EA2': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200'
    case 'GA': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
    default: return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  }
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
  <tr
    role="row"
    class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
    :class="(approval.pm && approval.do) ? 'bg-green-50/60 dark:bg-green-900/10' : ''"
  >
    <td class="px-2 py-2.5 text-center text-xs tabular-nums text-gray-400 dark:text-gray-600 select-none w-8 shrink-0">
      {{ index != null ? index : '' }}
    </td>

    <td class="px-3 py-2.5 whitespace-nowrap text-center">
      <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" :class="placementClass">
        {{ feature._place || '—' }}
      </span>
    </td>

    <td class="px-3 py-2.5 whitespace-nowrap">
      <a
        :href="jiraBaseUrl + '/' + feature['Key']"
        target="_blank"
        rel="noopener noreferrer"
        class="font-mono text-xs font-medium text-primary-600 dark:text-blue-400 hover:underline"
      >{{ feature['Key'] }}</a>
    </td>

    <td class="px-3 py-2.5 max-w-xs">
      <span class="text-xs text-gray-900 dark:text-gray-100 block truncate" :title="feature['Title']">{{ feature['Title'] || '—' }}</span>
    </td>

    <td class="px-3 py-2.5 max-w-[8rem]">
      <span class="text-xs text-gray-700 dark:text-gray-300 block truncate" :title="feature['Outcome'] || undefined">{{ feature['Outcome'] || '—' }}</span>
    </td>

    <td class="px-3 py-2.5 whitespace-nowrap">
      <span class="font-mono text-xs text-gray-700 dark:text-gray-300">{{ feature['Target Versions'] || '—' }}</span>
    </td>

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

    <td class="px-3 py-2.5 whitespace-nowrap">
      <span class="text-xs text-gray-700 dark:text-gray-300">{{ feature['Priority'] || '—' }}</span>
    </td>

    <td class="px-3 py-2.5 whitespace-nowrap text-center">
      <span class="text-xs font-mono text-gray-700 dark:text-gray-300" :title="fpdorTooltip">{{ feature['FPDoR'] || '—' }}</span>
      <span class="text-xs text-gray-400" :title="fpdorTooltip">(w:{{ feature._wFPDoR }})</span>
    </td>

    <td class="px-3 py-2.5 whitespace-nowrap text-center">
      <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium" :class="riskClass">{{ feature._riskLevel || '—' }}</span>
    </td>

    <td class="px-3 py-2.5 whitespace-nowrap text-center">
      <span class="text-xs font-semibold tabular-nums text-gray-800 dark:text-gray-200">{{ feature._conf != null ? feature._conf + '%' : '—' }}</span>
    </td>

    <td class="px-3 py-2.5 text-center">
      <input
        type="checkbox"
        :checked="approval.pm"
        @change="emit('toggle-approval', feature['Key'], 'pm')"
        :aria-label="'PM approval for ' + feature['Key']"
        class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
        :data-approval-pm="feature['Key']"
      />
    </td>

    <td class="px-3 py-2.5 text-center">
      <input
        type="checkbox"
        :checked="approval.do"
        @change="emit('toggle-approval', feature['Key'], 'do')"
        :aria-label="'Delivery Owner approval for ' + feature['Key']"
        class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
        :data-approval-do="feature['Key']"
      />
    </td>
  </tr>
</template>
