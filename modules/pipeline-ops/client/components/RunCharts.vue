<script setup>
import { computed } from 'vue'
import { Line, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Filler
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Filler)

const props = defineProps({
  runs: { type: Array, default: () => [] }
})

const sortedRuns = computed(() =>
  [...props.runs].sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt))
)

const durationChartData = computed(() => {
  const runs = sortedRuns.value.filter(r => r.durationSeconds != null)
  return {
    labels: runs.map(r =>
      new Date(r.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    ),
    datasets: [{
      label: 'Duration (min)',
      data: runs.map(r => Math.round(r.durationSeconds / 60)),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointBackgroundColor: runs.map(r =>
        r.status === 'success' ? '#10b981' : '#ef4444'
      )
    }]
  }
})

const durationChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const run = sortedRuns.value.filter(r => r.durationSeconds != null)[ctx.dataIndex]
          return `${ctx.parsed.y}min — ${run?.status || '?'}`
        }
      }
    }
  },
  scales: {
    x: { ticks: { font: { size: 9 }, maxRotation: 45 } },
    y: { min: 0, title: { display: true, text: 'minutes', font: { size: 9 } }, ticks: { font: { size: 9 } } }
  }
}

const successChartData = computed(() => {
  const runs = sortedRuns.value
  const windowSize = 5
  const labels = []
  const rates = []

  for (let i = windowSize - 1; i < runs.length; i++) {
    const window = runs.slice(i - windowSize + 1, i + 1)
    const successes = window.filter(r => r.status === 'success').length
    const rate = Math.round((successes / windowSize) * 100)
    labels.push(
      new Date(runs[i].startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    )
    rates.push(rate)
  }

  return {
    labels,
    datasets: [{
      label: 'Success Rate %',
      data: rates,
      backgroundColor: rates.map(r =>
        r >= 80 ? 'rgba(16, 185, 129, 0.6)' : r >= 50 ? 'rgba(245, 158, 11, 0.6)' : 'rgba(239, 68, 68, 0.6)'
      ),
      borderRadius: 2,
    }]
  }
})

const successChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => `${ctx.parsed.y}% success (rolling ${5}-run window)`
      }
    }
  },
  scales: {
    x: { ticks: { font: { size: 9 }, maxRotation: 45 } },
    y: { min: 0, max: 100, title: { display: true, text: '%', font: { size: 9 } }, ticks: { font: { size: 9 }, stepSize: 20 } }
  }
}

const hasData = computed(() => sortedRuns.value.length >= 2)
</script>

<template>
  <div v-if="hasData" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Run Duration</h3>
      <div class="h-48">
        <Line :data="durationChartData" :options="durationChartOptions" />
      </div>
      <p class="text-[10px] text-gray-400 mt-2">Green dots = success, red = failed</p>
    </div>

    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Success Rate (rolling 5-run)</h3>
      <div class="h-48">
        <Bar :data="successChartData" :options="successChartOptions" />
      </div>
      <p class="text-[10px] text-gray-400 mt-2">Green >= 80%, amber >= 50%, red &lt; 50%</p>
    </div>
  </div>
</template>
