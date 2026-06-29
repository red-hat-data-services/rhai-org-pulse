<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const props = defineProps({
  candidates: { type: Array, required: true }
})

const SOURCE_META = [
  { key: 'github', label: 'GitHub', color: '#6366f1' },
  { key: 'reddit', label: 'Reddit', color: '#f97316' },
  { key: 'hn', label: 'Hacker News', color: '#eab308' },
  { key: 'hackernews', label: 'Hacker News', color: '#eab308' }
]

const sourceCounts = computed(() => {
  const counts = {}
  for (const c of props.candidates) {
    const src = c.source || 'unknown'
    const normalized = src === 'hackernews' ? 'hn' : src
    counts[normalized] = (counts[normalized] || 0) + 1
  }
  return counts
})

const sortedSources = computed(() => {
  const unique = new Map()
  for (const s of SOURCE_META) {
    const normalized = s.key === 'hackernews' ? 'hn' : s.key
    if (!unique.has(normalized)) {
      unique.set(normalized, { key: normalized, label: s.label, color: s.color })
    }
  }
  return [...unique.values()]
    .filter(s => (sourceCounts.value[s.key] || 0) > 0)
    .sort((a, b) => (sourceCounts.value[b.key] || 0) - (sourceCounts.value[a.key] || 0))
})

const chartData = computed(() => ({
  labels: sortedSources.value.map(s => s.label),
  datasets: [{
    data: sortedSources.value.map(s => sourceCounts.value[s.key] || 0),
    backgroundColor: sortedSources.value.map(s => s.color),
    borderRadius: 4,
    barThickness: 20
  }]
}))

const barLabelPlugin = {
  id: 'sourceBarLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart
    ctx.save()
    ctx.font = '11px sans-serif'
    ctx.fillStyle = '#9ca3af'
    ctx.textBaseline = 'middle'
    for (const meta of chart.getSortedVisibleDatasetMetas()) {
      for (const el of meta.data) {
        const val = el.$context.parsed.x
        if (val > 0) {
          ctx.fillText(val, el.x + 6, el.y)
        }
      }
    }
    ctx.restore()
  }
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y',
  layout: { padding: { right: 30 } },
  scales: {
    x: {
      grid: { color: 'rgba(156, 163, 175, 0.15)' },
      ticks: { display: false }
    },
    y: {
      grid: { display: false },
      ticks: { color: '#9ca3af', font: { size: 11 } }
    }
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#111827',
      bodyFont: { size: 11 },
      padding: 10,
      cornerRadius: 8
    }
  }
}
</script>

<template>
  <div data-testid="source-bar" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
    <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">By Source</h3>
    <div class="h-28">
      <Bar :data="chartData" :options="chartOptions" :plugins="[barLabelPlugin]" />
    </div>
  </div>
</template>
