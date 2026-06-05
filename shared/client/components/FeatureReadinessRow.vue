<script setup>
import { computed } from 'vue'
import RubricScoreBadge from './RubricScoreBadge.vue'

const props = defineProps({
  feature: { type: Object, required: true },
  jiraBaseUrl: { type: String, default: 'https://issues.redhat.com/browse' },
  index: { type: Number, default: null }
})

const emit = defineEmits(['select'])

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

function reviewStatusClass(status) {
  switch (status) {
    case 'approved':        return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
    case 'needs-review':    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
    case 'awaiting-review': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
    default:                return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
  }
}

function reviewStatusLabel(status) {
  switch (status) {
    case 'approved':        return 'Approved'
    case 'needs-review':    return 'Flagged'
    case 'awaiting-review': return 'Awaiting Sign-off'
    default:                return 'Awaiting Sign-off'
  }
}

function tierClass(tier) {
  switch (tier) {
    case 'T1': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    case 'T2': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
    case 'T3': return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
    default:   return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
  }
}

const priorityDisplay = computed(() => {
  const score = props.feature.effectivePriorityScore
  if (score == null) return '—'
  return props.feature.priorityScoreFallback ? `~${score}` : String(score)
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
      <span
        class="text-xs font-semibold tabular-nums"
        :class="feature.priorityScoreFallback
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-gray-800 dark:text-gray-200'"
        :title="feature.priorityScoreFallback ? 'Estimated score (fallback)' : 'Computed priority score'"
      >{{ priorityDisplay }}</span>
    </td>

    <!-- Key -->
    <td class="px-3 py-2.5 whitespace-nowrap">
      <a
        :href="`${jiraBaseUrl}/${feature.key}`"
        target="_blank"
        rel="noopener noreferrer"
        :aria-label="`Open Jira issue ${feature.key} in new tab`"
        class="font-mono text-xs font-medium text-primary-600 dark:text-blue-400 hover:underline hover:text-primary-700 dark:hover:text-blue-300 transition-colors"
        @click.stop
      >{{ feature.key }}</a>
    </td>

    <!-- Title -->
    <td class="px-3 py-2.5 max-w-xs">
      <span
        class="text-xs text-gray-900 dark:text-gray-100 block truncate"
        :title="feature.title"
      >{{ feature.title || '—' }}</span>
    </td>

    <!-- Tier -->
    <td class="px-3 py-2.5 whitespace-nowrap">
      <span
        v-if="feature.tier"
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
        :class="tierClass(feature.tier)"
      >{{ feature.tier }}</span>
      <span v-else class="text-xs text-gray-400 dark:text-gray-600">—</span>
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
    <td class="px-3 py-2.5 whitespace-nowrap">
      <span class="text-xs text-gray-700 dark:text-gray-300">{{ feature.team || '—' }}</span>
    </td>

    <!-- Rubric (compact dots) -->
    <td class="px-3 py-2.5">
      <RubricScoreBadge :scores="feature.scores" :show-total="false" />
    </td>

    <!-- Recommendation -->
    <td class="px-3 py-2.5 whitespace-nowrap">
      <span
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
        :class="recommendationClass(feature.recommendation)"
      >{{ recommendationLabel(feature.recommendation) }}</span>
    </td>

    <!-- Status -->
    <td class="px-3 py-2.5 whitespace-nowrap">
      <span
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
        :class="reviewStatusClass(feature.humanReviewStatus)"
      >{{ reviewStatusLabel(feature.humanReviewStatus) }}</span>
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
