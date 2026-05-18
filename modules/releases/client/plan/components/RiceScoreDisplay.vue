<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  rice: { type: Object, default: null },
  jiraUrl: { type: String, default: '' }
})

const expanded = ref(false)

const hasScore = computed(function() {
  return props.rice && props.rice.score != null
})

const scoreLabel = computed(function() {
  if (!hasScore.value) return 'N/A'
  return String(props.rice.score)
})

function toggle() {
  if (hasScore.value) {
    expanded.value = !expanded.value
  }
}
</script>

<template>
  <div class="inline-block relative">
    <button
      type="button"
      class="text-xs font-mono font-semibold px-1.5 py-0.5 rounded"
      :class="hasScore
        ? 'text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 cursor-pointer'
        : 'text-gray-400 dark:text-gray-500 cursor-default'"
      :title="hasScore ? 'Click to see RICE breakdown' : 'RICE scoring not configured or data incomplete'"
      @click="toggle"
    >
      {{ scoreLabel }}
    </button>

    <!-- Expanded breakdown popover -->
    <div
      v-if="expanded && hasScore"
      class="absolute z-20 mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 w-48"
    >
      <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">RICE Breakdown</div>
      <div class="space-y-1 text-xs">
        <div class="flex justify-between">
          <span class="text-gray-500 dark:text-gray-400">Reach</span>
          <span class="font-mono text-gray-900 dark:text-gray-100">{{ rice.reach != null ? rice.reach : '-' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500 dark:text-gray-400">Impact</span>
          <span class="font-mono text-gray-900 dark:text-gray-100">{{ rice.impact != null ? rice.impact : '-' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500 dark:text-gray-400">Confidence</span>
          <span class="font-mono text-gray-900 dark:text-gray-100">{{ rice.confidence != null ? rice.confidence + '%' : '-' }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500 dark:text-gray-400">Effort</span>
          <span class="font-mono text-gray-900 dark:text-gray-100">{{ rice.effort != null ? rice.effort : '-' }}</span>
        </div>
        <div class="border-t border-gray-200 dark:border-gray-600 pt-1 mt-1 flex justify-between font-semibold">
          <span class="text-gray-700 dark:text-gray-300">Score</span>
          <span class="font-mono text-indigo-700 dark:text-indigo-400">{{ rice.score }}</span>
        </div>
      </div>
      <a
        v-if="jiraUrl"
        :href="jiraUrl"
        target="_blank"
        rel="noopener"
        class="block mt-2 text-[10px] text-primary-600 dark:text-primary-400 hover:underline"
      >View in Jira</a>
    </div>
  </div>
</template>
