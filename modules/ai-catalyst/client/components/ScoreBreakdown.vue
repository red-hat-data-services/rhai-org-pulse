<script setup>
import { computed } from 'vue'
import { useCategories } from '../composables/useCategories.js'

const props = defineProps({
  candidate: { type: Object, required: true }
})

const { getScoreColor } = useCategories()

const impactDimensions = computed(() => [
  { key: 'audienceValue', label: 'Audience Value' },
  { key: 'strategicAlignment', label: 'Strategic Alignment' },
  { key: 'strategyFit', label: 'Strategy Fit' },
  { key: 'platformLeverage', label: 'Platform Leverage' },
  { key: 'demoPotential', label: 'Demo Potential' }
].map(d => ({ ...d, score: props.candidate[d.key] })))

const feasibilityDimensions = computed(() => [
  { key: 'containerReadiness', label: 'Container Readiness' },
  { key: 'dependencyProfile', label: 'Dependency Profile' },
  { key: 'reproductionConfidence', label: 'Reproduction Confidence' },
  { key: 'complexitySweetSpot', label: 'Complexity Sweet Spot' }
].map(d => ({ ...d, score: props.candidate[d.key] })))

function barWidth(score) {
  if (score == null) return '0%'
  return Math.max(0, Math.min(100, score * 10)) + '%'
}

function barColorClass(score) {
  const color = getScoreColor(score)
  const map = {
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    gray: 'bg-gray-300 dark:bg-gray-600'
  }
  return map[color]
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
    <!-- Impact -->
    <div>
      <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Impact</h4>
      <div class="space-y-2">
        <div v-for="dim in impactDimensions" :key="dim.key" class="flex items-center gap-2">
          <span class="text-xs text-gray-600 dark:text-gray-400 w-32 shrink-0 truncate">{{ dim.label }}</span>
          <div class="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div :class="['h-full rounded-full transition-all', barColorClass(dim.score)]" :style="{ width: barWidth(dim.score) }"></div>
          </div>
          <span class="text-xs font-mono text-gray-600 dark:text-gray-400 w-6 text-right">{{ dim.score ?? '—' }}</span>
        </div>
      </div>
    </div>

    <!-- Feasibility -->
    <div>
      <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Feasibility</h4>
      <div class="space-y-2">
        <div v-for="dim in feasibilityDimensions" :key="dim.key" class="flex items-center gap-2">
          <span class="text-xs text-gray-600 dark:text-gray-400 w-32 shrink-0 truncate">{{ dim.label }}</span>
          <div class="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div :class="['h-full rounded-full transition-all', barColorClass(dim.score)]" :style="{ width: barWidth(dim.score) }"></div>
          </div>
          <span class="text-xs font-mono text-gray-600 dark:text-gray-400 w-6 text-right">{{ dim.score ?? '—' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
