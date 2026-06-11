<script setup>
import { computed } from 'vue'

const props = defineProps({
  heatmap: { type: Object, required: true },
})

/** Max absolute value across the entire matrix — precomputed once per data change. */
const maxAbsValue = computed(() =>
  Math.max(...(props.heatmap.matrix || []).flat().map(v => Math.abs(v)), 1)
)

/** Map a net-flow value to a CSS background colour (green = burning, red = growing). */
function cellColor(val) {
  if (val === 0) return ''
  const norm = Math.min(Math.abs(val) / maxAbsValue.value, 1)
  const alpha = Math.round(norm * 60 + 10) // 10–70% opacity
  if (val > 0) return `rgba(239, 68, 68, ${alpha / 100})`   // red — growing
  return `rgba(34, 197, 94, ${alpha / 100})`                 // green — burning down
}

function cellText(val) {
  return val === 0 ? '' : (val > 0 ? '+' + val : String(val))
}

const hasData = computed(() =>
  props.heatmap &&
  props.heatmap.components &&
  props.heatmap.components.length > 0
)
</script>

<template>
  <div v-if="hasData" class="overflow-x-auto">
    <table class="min-w-full text-xs border-collapse">
      <thead>
        <tr>
          <th class="sticky left-0 z-[1] bg-white dark:bg-gray-900 px-2 py-1 text-left font-medium text-gray-500 dark:text-gray-400 border-b border-r dark:border-gray-700">
            Component
          </th>
          <th
            v-for="month in heatmap.months"
            :key="month"
            class="px-2 py-1 text-center font-medium text-gray-500 dark:text-gray-400 border-b dark:border-gray-700 whitespace-nowrap"
          >
            {{ month }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(comp, ci) in heatmap.components" :key="comp">
          <td class="sticky left-0 z-[1] bg-white dark:bg-gray-900 px-2 py-1 text-left font-medium text-gray-700 dark:text-gray-300 border-r dark:border-gray-700 whitespace-nowrap truncate max-w-[180px]" :title="comp">
            {{ comp }}
          </td>
          <td
            v-for="(val, mi) in heatmap.matrix[ci]"
            :key="mi"
            class="px-2 py-1 text-center font-mono border-l dark:border-gray-800"
            :style="{ backgroundColor: cellColor(val) }"
            :title="`${comp} / ${heatmap.months[mi]}: net ${val >= 0 ? '+' : ''}${val}`"
          >
            <span :class="{ 'text-white': Math.abs(val) > 3, 'text-gray-800 dark:text-gray-200': Math.abs(val) <= 3 }">
              {{ cellText(val) }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <p v-else class="text-gray-500 dark:text-gray-400 italic text-sm">
    No heatmap data available (requires components with 3+ features).
  </p>
</template>
