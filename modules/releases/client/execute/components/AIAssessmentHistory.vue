<script setup>
import { ref, computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip)

const props = defineProps({
  history: { type: Array, default: () => [] },
  currentTotal: { type: Number, default: 0 },
  currentAssessedAt: { type: String, default: '' },
  currentScores: { type: Object, default: null }
})

const expanded = ref(false)

// Combine current + history for the sparkline, sorted oldest-first
const allEntries = computed(() => {
  const current = { total: props.currentTotal, assessedAt: props.currentAssessedAt, scores: props.currentScores }
  const entries = [current, ...props.history]
  return entries.sort((a, b) => new Date(a.assessedAt) - new Date(b.assessedAt))
})

const chartData = computed(() => ({
  labels: allEntries.value.map(e =>
    new Date(e.assessedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  ),
  datasets: [{
    data: allEntries.value.map(e => e.total),
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    fill: true,
    tension: 0.3,
    pointRadius: 3,
    pointBackgroundColor: allEntries.value.map(e =>
      e.total >= 5 ? '#10b981' : '#ef4444'
    )
  }]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => `Score: ${ctx.parsed.y}/10`
      }
    }
  },
  scales: {
    x: { ticks: { font: { size: 9 } } },
    y: { min: 0, max: 10, ticks: { font: { size: 9 }, stepSize: 2 } }
  }
}

const CRITERIA = ['what', 'why', 'how', 'task', 'size']

// Compute diffs between consecutive entries (newest-first for display)
const diffs = computed(() => {
  if (allEntries.value.length < 2) return []
  const result = []
  // Iterate newest to oldest
  const reversed = [...allEntries.value].reverse()
  for (let i = 0; i < reversed.length - 1; i++) {
    const newer = reversed[i]
    const older = reversed[i + 1]
    if (!newer.scores || !older.scores) continue
    const changes = {}
    for (const c of CRITERIA) {
      const diff = (newer.scores[c] || 0) - (older.scores[c] || 0)
      if (diff !== 0) changes[c] = diff
    }
    result.push({
      date: new Date(newer.assessedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      totalDiff: newer.total - older.total,
      changes
    })
  }
  return result
})
</script>

<template>
  <div v-if="history.length > 0">
    <button
      @click="expanded = !expanded"
      class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
    >
      <svg
        class="h-3.5 w-3.5 transition-transform"
        :class="{ 'rotate-90': expanded }"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
      Score History ({{ history.length }} prior {{ history.length === 1 ? 'assessment' : 'assessments' }})
    </button>

    <div v-if="expanded" class="mt-3 space-y-3">
      <!-- Sparkline -->
      <div class="h-[100px] bg-gray-50 dark:bg-gray-700/50 rounded-md p-2">
        <Line :data="chartData" :options="chartOptions" />
      </div>

      <!-- Diff details -->
      <div v-if="diffs.length > 0" class="space-y-2">
        <div
          v-for="(diff, i) in diffs"
          :key="i"
          class="text-xs text-gray-600 dark:text-gray-400"
        >
          <span class="font-medium">{{ diff.date }}:</span>
          <span
            class="ml-1"
            :class="diff.totalDiff > 0 ? 'text-green-600 dark:text-green-400' : diff.totalDiff < 0 ? 'text-red-600 dark:text-red-400' : ''"
          >
            {{ diff.totalDiff > 0 ? '+' : '' }}{{ diff.totalDiff }} total
          </span>
          <template v-if="Object.keys(diff.changes).length > 0">
            <span class="mx-1">&mdash;</span>
            <span
              v-for="(change, criterion) in diff.changes"
              :key="criterion"
              class="mr-2"
              :class="change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
            >
              {{ criterion }}: {{ change > 0 ? '+' : '' }}{{ change }}
            </span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
