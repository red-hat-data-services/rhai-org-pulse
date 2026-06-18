<script setup>
import { computed } from 'vue'

var props = defineProps({
  epicCount: { type: Number, default: 0 },
  issueCount: { type: Number, default: 0 },
  rice: { type: [Number, Object], default: null },
  storyPoints: { type: Number, default: null },
  completionPct: { type: Number, default: 0 }
})

var totalItems = computed(function() {
  return props.epicCount + props.issueCount
})

var countLabel = computed(function() {
  var parts = []
  if (props.epicCount > 0) {
    parts.push(props.epicCount + (props.epicCount === 1 ? ' epic' : ' epics'))
  }
  if (props.issueCount > 0) {
    parts.push(props.issueCount + (props.issueCount === 1 ? ' item' : ' items'))
  }
  return parts.join(', ')
})

var riceScore = computed(function() {
  if (props.rice === null || props.rice === undefined) return null
  if (typeof props.rice === 'object' && props.rice.score !== undefined) return props.rice.score
  if (typeof props.rice === 'number') return props.rice
  return null
})

var barWidth = computed(function() {
  // Scale: 0 items = 0%, cap at 100% around 50 items
  var pct = Math.min(100, (totalItems.value / 50) * 100)
  return Math.max(4, pct)
})

function barColor(pct) {
  if (pct >= 80) return 'bg-green-500'
  if (pct >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}
</script>

<template>
  <div v-if="totalItems > 0" class="flex items-center gap-2 text-xs">
    <!-- Mini completion bar -->
    <div class="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex-shrink-0" :title="completionPct + '% complete'">
      <div
        :class="['h-full rounded-full transition-all', barColor(completionPct)]"
        :style="{ width: completionPct + '%' }"
      ></div>
    </div>

    <!-- Counts -->
    <span class="text-gray-500 dark:text-gray-400 whitespace-nowrap">{{ countLabel }}</span>

    <!-- RICE badge -->
    <span
      v-if="riceScore !== null"
      class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400"
      :title="'RICE score: ' + riceScore"
    >
      RICE {{ riceScore }}
    </span>
  </div>
</template>
