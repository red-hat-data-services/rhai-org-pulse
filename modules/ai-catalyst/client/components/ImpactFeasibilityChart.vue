<script setup>
import { computed, ref } from 'vue'
import { Scatter } from 'vue-chartjs'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
} from 'chart.js'
import { useCategories } from '../composables/useCategories.js'

ChartJS.register(LinearScale, PointElement, Tooltip, Legend)

const props = defineProps({
  candidates: { type: Array, required: true }
})

const emit = defineEmits(['select'])

const { CATEGORY_KEYS, getCategoryMeta } = useCategories()

const CATEGORY_COLORS = {
  'model-inference': '#3b82f6',
  'model-customization': '#a855f7',
  'agentic-ai': '#22c55e',
  'management-observability-security': '#f59e0b'
}

const hiddenCategories = ref(new Set())

function toggleCategory(key) {
  const next = new Set(hiddenCategories.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  hiddenCategories.value = next
}

const validCandidates = computed(() =>
  props.candidates.filter(c => c.impactScore != null && c.feasibilityScore != null && c.impactScore > 0 && c.feasibilityScore > 0)
)

const excludedCount = computed(() => props.candidates.length - validCandidates.value.length)

const dataRange = computed(() => {
  const valid = validCandidates.value
  if (!valid.length) return { xMin: 0, xMax: 10, yMin: 0, yMax: 10 }
  let xMin = 10, xMax = 0, yMin = 10, yMax = 0
  for (const c of valid) {
    if (c.feasibilityScore < xMin) xMin = c.feasibilityScore
    if (c.feasibilityScore > xMax) xMax = c.feasibilityScore
    if (c.impactScore < yMin) yMin = c.impactScore
    if (c.impactScore > yMax) yMax = c.impactScore
  }
  return {
    xMin: Math.max(0, Math.floor(xMin) - 1),
    xMax: Math.min(10, Math.ceil(xMax) + 1),
    yMin: Math.max(0, Math.floor(yMin) - 1),
    yMax: Math.min(10, Math.ceil(yMax) + 1)
  }
})

const chartData = computed(() => {
  const datasetMap = {}
  for (const key of CATEGORY_KEYS) {
    datasetMap[key] = []
  }

  for (let i = 0; i < validCandidates.value.length; i++) {
    const c = validCandidates.value[i]
    const cat = c.category || 'agentic-ai'
    if (!datasetMap[cat]) datasetMap[cat] = []
    const starVal = c.stars || 0
    const radius = starVal > 0 ? Math.max(3, Math.min(12, 3 + Math.log10(starVal + 1) * 2)) : 3

    const jx = ((i * 7 + 3) % 17 - 8) * 0.12
    const jy = ((i * 11 + 5) % 19 - 9) * 0.12

    datasetMap[cat].push({
      x: c.feasibilityScore + jx,
      y: c.impactScore + jy,
      r: radius,
      candidate: c
    })
  }

  return {
    datasets: CATEGORY_KEYS
      .filter(key => !hiddenCategories.value.has(key))
      .map(key => ({
        label: getCategoryMeta(key).shortName,
        data: datasetMap[key] || [],
        backgroundColor: CATEGORY_COLORS[key] + '80',
        borderColor: CATEGORY_COLORS[key],
        borderWidth: 1,
        pointRadius: (ctx) => ctx.raw?.r || 3,
        pointHoverRadius: (ctx) => (ctx.raw?.r || 3) + 3,
        pointStyle: (ctx) => ctx.raw?.candidate?.itemType === 'trend' ? 'triangle' : 'circle'
      }))
  }
})

const quadrantPlugin = {
  id: 'quadrantLabels',
  afterDraw(chart) {
    const { ctx, chartArea: { left, right, top, bottom }, scales: { x, y } } = chart
    const midX = x.getPixelForValue(7)
    const midY = y.getPixelForValue(7)

    ctx.save()
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = 'rgba(156, 163, 175, 0.4)'
    ctx.lineWidth = 1

    ctx.beginPath()
    ctx.moveTo(midX, top)
    ctx.lineTo(midX, bottom)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(left, midY)
    ctx.lineTo(right, midY)
    ctx.stroke()

    ctx.setLineDash([])
    ctx.font = '11px sans-serif'
    ctx.fillStyle = 'rgba(156, 163, 175, 0.6)'

    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText('Needs Investigation', midX - 8, midY - 8)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillText('High Priority', midX + 8, midY - 8)

    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText('Low Priority', midX - 8, midY + 8)

    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('Quick Wins', midX + 8, midY + 8)

    ctx.restore()
  }
}

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  onClick: (_event, elements) => {
    if (!elements.length) return
    const el = elements[0]
    const ds = chartData.value.datasets[el.datasetIndex]
    if (!ds) return
    const point = ds.data[el.index]
    if (point?.candidate) emit('select', point.candidate)
  },
  scales: {
    x: {
      type: 'linear',
      min: dataRange.value.xMin,
      max: dataRange.value.xMax,
      title: { display: true, text: 'Feasibility Score', color: '#9ca3af', font: { size: 12 } },
      grid: { color: 'rgba(156, 163, 175, 0.15)' },
      ticks: { color: '#9ca3af', stepSize: 1 }
    },
    y: {
      type: 'linear',
      min: dataRange.value.yMin,
      max: dataRange.value.yMax,
      title: { display: true, text: 'Impact Score', color: '#9ca3af', font: { size: 12 } },
      grid: { color: 'rgba(156, 163, 175, 0.15)' },
      ticks: { color: '#9ca3af', stepSize: 1 }
    }
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#111827',
      titleFont: { size: 12, weight: 'bold' },
      bodyFont: { size: 11 },
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        title: (items) => items[0]?.raw?.candidate?.title || '',
        label: (ctx) => {
          const c = ctx.raw?.candidate
          if (!c) return ''
          const lines = [
            `Impact: ${c.impactScore}  ·  Feasibility: ${c.feasibilityScore}`,
            `Category: ${getCategoryMeta(c.category).name}`
          ]
          if (c.stars) lines.push(`Stars: ${c.stars.toLocaleString()}`)
          if (c.source) lines.push(`Source: ${c.source}`)
          return lines
        }
      }
    }
  }
}))
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">Impact × Feasibility</h2>
      <p v-if="excludedCount > 0" class="text-xs text-gray-400 dark:text-gray-500">
        {{ excludedCount }} candidate{{ excludedCount > 1 ? 's' : '' }} excluded (missing scores)
      </p>
    </div>

    <!-- Category legend -->
    <div class="flex flex-wrap gap-2 mb-4">
      <button
        v-for="key in CATEGORY_KEYS"
        :key="key"
        class="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-opacity"
        :class="hiddenCategories.has(key) ? 'opacity-40 border-gray-300 dark:border-gray-600' : 'border-transparent'"
        :style="{ backgroundColor: CATEGORY_COLORS[key] + '20', color: CATEGORY_COLORS[key] }"
        @click="toggleCategory(key)"
      >
        <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: CATEGORY_COLORS[key] }"></span>
        {{ getCategoryMeta(key).shortName }}
      </button>
    </div>

    <!-- Chart -->
    <div data-testid="scatter-chart" class="h-96">
      <Scatter :data="chartData" :options="chartOptions" :plugins="[quadrantPlugin]" />
    </div>

    <p class="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
      Dot size reflects GitHub stars (log scale). Click a point to view details.
    </p>
  </div>
</template>
