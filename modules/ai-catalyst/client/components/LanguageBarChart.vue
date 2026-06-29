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

const MAX_SHOWN = 6

const BLUE_SHADES = ['#1e40af', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#9ca3af']

const languageData = computed(() => {
  const counts = {}
  for (const c of props.candidates) {
    const lang = c.language || ''
    if (!lang) continue
    counts[lang] = (counts[lang] || 0) + 1
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (sorted.length <= MAX_SHOWN) return sorted

  const top = sorted.slice(0, MAX_SHOWN)
  const otherCount = sorted.slice(MAX_SHOWN).reduce((sum, [, c]) => sum + c, 0)
  if (otherCount > 0) top.push(['Other', otherCount])
  return top
})

const chartData = computed(() => ({
  labels: languageData.value.map(([l]) => l),
  datasets: [{
    data: languageData.value.map(([, c]) => c),
    backgroundColor: languageData.value.map((_, i) => BLUE_SHADES[Math.min(i, BLUE_SHADES.length - 1)]),
    borderRadius: 4,
    barThickness: 18
  }]
}))

const barLabelPlugin = {
  id: 'langBarLabels',
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
  <div data-testid="language-bar" class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
    <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">By Language</h3>
    <div v-if="languageData.length" class="h-40">
      <Bar :data="chartData" :options="chartOptions" :plugins="[barLabelPlugin]" />
    </div>
    <p v-else class="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
      No language data available
    </p>
  </div>
</template>
