<script setup>
import { computed } from 'vue'
import RubricScoreBadge from '@shared/client/components/RubricScoreBadge.vue'
import FPDoRPopover from './FPDoRPopover.vue'

var props = defineProps({
  feature: { type: Object, required: true },
  jiraBaseUrl: { type: String, default: 'https://issues.redhat.com/browse' },
  index: { type: Number, default: null }
})

var emit = defineEmits(['select', 'navigate'])

var isHealthPipeline = computed(function() { return props.feature.dataSource === 'health-pipeline' })

function recommendationClass(rec) {
  switch (rec) {
    case 'approve': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
    case 'revise':  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
    case 'reject':  return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
    default:        return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  }
}

function recommendationLabel(rec) {
  switch (rec) {
    case 'approve': return 'Approve'
    case 'revise':  return 'Needs Revision'
    case 'reject':  return 'Reject'
    default:        return rec || '—'
  }
}

var priorityDisplay = computed(function() {
  var score = props.feature.effectivePriorityScore
  if (score == null) return '—'
  return String(score)
})

var scoreBreakdown = computed(function() {
  var bd = props.feature.priorityScoreBreakdown
  if (!bd) return null
  return bd
})

var confidenceTooltip = computed(function() {
  switch (props.feature.confidence) {
    case 'committed': return 'Committed — fix version assigned to a release'
    case 'ready':     return 'Ready — passes readiness gates, not yet committed'
    case 'not-ready': return 'Not Ready — does not pass readiness gates'
    default:          return ''
  }
})
</script>

<template>
  <tr
    role="row"
    class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
    @click="emit('select', feature)"
  >
    <!-- Row number -->
    <td class="px-2 py-2.5 text-center text-xs tabular-nums text-gray-400 dark:text-gray-600 select-none w-8 shrink-0">
      {{ index != null ? index : '' }}
    </td>

    <!-- Score -->
    <td class="px-3 py-2.5 whitespace-nowrap text-center">
      <span class="relative group inline-flex items-center">
        <span
          class="text-xs font-semibold tabular-nums cursor-help text-gray-800 dark:text-gray-200"
        >{{ priorityDisplay }}</span>
        <div
          v-if="scoreBreakdown"
          class="absolute z-50 top-full mt-1 left-0 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 text-xs text-left font-normal hidden group-hover:block"
        >
          <p class="font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
            Score: {{ feature.effectivePriorityScore }} / 100
          </p>
          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">RICE</span>
              <span class="text-gray-400 dark:text-gray-500 tabular-nums">{{ scoreBreakdown.rice }}% &times; 30w</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">Big Rock</span>
              <span class="text-gray-400 dark:text-gray-500 tabular-nums">{{ scoreBreakdown.bigRock }}% &times; 30w</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">Target Version</span>
              <span class="text-gray-400 dark:text-gray-500 tabular-nums">{{ scoreBreakdown.targetVersion }}% &times; 25w</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-gray-600 dark:text-gray-300">Priority</span>
              <span class="text-gray-400 dark:text-gray-500 tabular-nums">{{ scoreBreakdown.priority }}% &times; 15w</span>
            </div>
          </div>
        </div>
      </span>
    </td>

    <!-- Readiness (FPDoR popover) -->
    <td class="px-3 py-2.5 whitespace-nowrap">
      <FPDoRPopover
        :fpdor="feature.fpdor"
        :confidence="feature.confidence"
        :title="confidenceTooltip"
      />
    </td>

    <!-- Key -->
    <td class="px-3 py-2.5 whitespace-nowrap">
      <span class="inline-flex items-center gap-1">
        <button
          type="button"
          :aria-label="'View feature details for ' + feature.key"
          class="font-mono text-xs font-medium text-primary-600 dark:text-blue-400 hover:underline hover:text-primary-700 dark:hover:text-blue-300 transition-colors"
          @click.stop="emit('navigate', feature.key)"
        >{{ feature.key }}</button>
        <a
          :href="jiraBaseUrl + '/' + feature.key"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="'Open ' + feature.key + ' in Jira'"
          class="text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-blue-400 transition-colors"
          @click.stop
        >
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </span>
    </td>

    <!-- Title -->
    <td class="px-3 py-2.5 max-w-xs">
      <span
        class="text-xs text-gray-900 dark:text-gray-100 block truncate"
        :title="feature.title"
      >{{ feature.title || '—' }}</span>
    </td>

    <!-- Outcome (Big Rock) -->
    <td class="px-3 py-2.5 max-w-[8rem]">
      <span
        class="text-xs text-gray-700 dark:text-gray-300 block truncate"
        :title="feature.bigRock || undefined"
      >{{ feature.bigRock || '—' }}</span>
    </td>

    <!-- Target Version -->
    <td class="px-3 py-2.5">
      <div class="flex flex-wrap gap-1">
        <span
          v-for="tv in (feature.targetVersions || [])"
          :key="tv"
          class="inline-flex items-center px-1.5 py-0.5 rounded-full font-mono text-xs font-medium"
          :class="(feature.targetVersions || []).length > 1
            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700'
            : 'bg-gray-100 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'"
          :title="(feature.targetVersions || []).length > 1 ? 'Multiple target versions — Jira hygiene issue' : undefined"
        >{{ tv }}</span>
        <span v-if="!(feature.targetVersions || []).length" class="text-xs text-gray-400 dark:text-gray-600">—</span>
      </div>
    </td>

    <!-- Fix Version -->
    <td class="px-3 py-2.5 whitespace-nowrap">
      <span class="font-mono text-xs text-gray-700 dark:text-gray-300">{{ feature.fixVersion || '—' }}</span>
    </td>

    <!-- Components -->
    <td class="px-3 py-2.5">
      <div class="flex flex-wrap gap-1">
        <span
          v-for="comp in (feature.components || []).slice(0, 2)"
          :key="comp"
          class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
        >{{ comp }}</span>
        <span
          v-if="(feature.components || []).length > 2"
          class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800"
          :title="feature.components.slice(2).join(', ')"
        >+{{ feature.components.length - 2 }}</span>
        <span v-if="!(feature.components || []).length" class="text-xs text-gray-400 dark:text-gray-600">—</span>
      </div>
    </td>

    <!-- Team -->
    <td class="px-3 py-2.5 whitespace-nowrap max-w-[10rem]">
      <span class="text-xs text-gray-700 dark:text-gray-300 block truncate" :title="feature.team || undefined">{{ feature.team || '—' }}</span>
    </td>

    <!-- Rubric (compact dots) -->
    <td class="px-3 py-2.5">
      <span v-if="isHealthPipeline" class="text-xs text-gray-400 dark:text-gray-500 italic">no rubric</span>
      <RubricScoreBadge v-else :scores="feature.scores" :show-total="false" />
    </td>

    <!-- Recommendation -->
    <td class="px-3 py-2.5 whitespace-nowrap">
      <span
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
        :class="recommendationClass(feature.recommendation)"
      >{{ recommendationLabel(feature.recommendation) }}</span>
    </td>

    <!-- Status (Jira workflow status) -->
    <td class="px-3 py-2.5 whitespace-nowrap">
      <span class="text-xs text-gray-700 dark:text-gray-300">{{ feature.status || '—' }}</span>
    </td>

    <!-- Priority -->
    <td class="px-3 py-2.5 whitespace-nowrap">
      <span class="text-xs text-gray-700 dark:text-gray-300">{{ feature.priority || '—' }}</span>
    </td>

    <!-- Needs Attention -->
    <td class="px-3 py-2.5 text-center">
      <span
        v-if="feature.needsAttention"
        class="text-amber-500 dark:text-amber-400 text-sm leading-none"
        title="Needs attention"
        aria-label="Needs attention"
      >⚠</span>
    </td>
  </tr>
</template>
