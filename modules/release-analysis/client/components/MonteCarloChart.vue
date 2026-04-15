<template>
  <div class="space-y-4 pt-3">
    <div v-if="!canSimulate" class="text-sm text-gray-400 dark:text-gray-500 italic py-2">
      {{ noSimReason }}
    </div>

    <template v-else>
      <div v-if="!sim" class="flex items-center justify-center py-8">
        <svg class="animate-spin h-5 w-5 text-indigo-400 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span class="text-sm text-gray-400 dark:text-gray-500">Running simulation…</span>
      </div>

      <template v-else>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="rounded-lg border px-4 py-3" :class="pCardClass">
            <p class="text-[11px] font-medium uppercase tracking-wider mb-1" :class="pLabelClass">
              Probability at {{ props.deadlineLabel }}
            </p>
            <p class="text-2xl font-bold tabular-nums" :class="pValueClass">{{ sim.pAtDeadline }}%</p>
            <p class="text-xs mt-0.5" :class="pSubClass">{{ formatDate(props.dueDate) }}</p>
          </div>

          <div class="rounded-lg border border-amber-200 dark:border-amber-700/50 bg-amber-50/60 dark:bg-amber-900/20 px-4 py-3">
            <p class="text-[11px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">85% Confidence</p>
            <p class="text-2xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">{{ formatDate(sim.p85Date) }}</p>
            <p class="text-xs text-amber-500/80 dark:text-amber-500/60 mt-0.5">{{ daysLabel(sim.p85Days) }}</p>
          </div>

          <div class="rounded-lg border border-teal-200 dark:border-teal-700/50 bg-teal-50/60 dark:bg-teal-900/20 px-4 py-3">
            <p class="text-[11px] font-medium uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1">95% Confidence</p>
            <p class="text-2xl font-bold text-teal-700 dark:text-teal-300 tabular-nums">{{ formatDate(sim.p95Date) }}</p>
            <p class="text-xs text-teal-500/80 dark:text-teal-500/60 mt-0.5">{{ daysLabel(sim.p95Days) }}</p>
          </div>
        </div>

        <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 p-3" style="height: 320px;">
          <Bar :data="chartData" :options="chartOptions" :plugins="[markerPlugin]" />
        </div>

        <p class="text-[10px] text-gray-400 dark:text-gray-500 text-center">
          {{ ITERATIONS.toLocaleString() }} Monte Carlo simulations · Throughput: {{ props.velocity }} issues / 14d · Remaining: {{ props.notDoneCount }} issues
        </p>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, shallowRef, watch, onUnmounted } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Title
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Title)

const ITERATIONS = 1000
const MAX_DAYS = 730

const props = defineProps({
  notDoneCount: { type: Number, required: true },
  velocity: { type: Number, required: true },
  dueDate: { type: String, required: true },
  deadlineLabel: { type: String, default: 'Due Date' },
  codeFreezeDate: { type: String, default: null },
  releaseDate: { type: String, default: null }
})

// ── Random sampling ──

function boxMullerNormal() {
  const u1 = Math.random()
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

/**
 * Gamma(shape, scale) via Marsaglia & Tsang.
 * Used to model the waiting time for `shape` Poisson events at rate 1/scale.
 */
function gammaSample(shape, scale) {
  if (shape < 1) {
    return gammaSample(shape + 1, scale) * Math.pow(Math.random(), 1 / shape)
  }
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (let iter = 0; iter < 1000; iter++) {
    let x, v
    do {
      x = boxMullerNormal()
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = Math.random()
    if (u < 1 - 0.0331 * x * x * x * x) return d * v * scale
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale
  }
  return shape * scale
}

// ── Date helpers ──

function getToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function daysBetween(from, to) {
  return Math.ceil((to - from) / (1000 * 60 * 60 * 24))
}

function formatDate(dateOrStr) {
  const d = dateOrStr instanceof Date ? dateOrStr : new Date(dateOrStr + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatShortDate(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysLabel(days) {
  if (days == null) return ''
  if (days <= 0) return 'Today or past'
  if (days === 1) return '1 day from now'
  return `${days} days from now`
}

// ── Simulation ──

const canSimulate = computed(() => props.notDoneCount > 0 && props.velocity > 0 && !!props.dueDate)

const noSimReason = computed(() => {
  if (props.notDoneCount <= 0) return 'All issues are complete — no simulation needed.'
  if (props.velocity <= 0) return 'No historical throughput data available for simulation.'
  return 'Missing release due date.'
})

const sim = shallowRef(null)
let pendingIdleId = null

function runSimulation() {
  if (!canSimulate.value) { sim.value = null; return }

  const scale = 14 / props.velocity
  const n = props.notDoneCount

  const completionDays = new Array(ITERATIONS)
  for (let i = 0; i < ITERATIONS; i++) {
    completionDays[i] = Math.min(Math.ceil(gammaSample(n, scale)), MAX_DAYS)
  }
  completionDays.sort((a, b) => a - b)

  const t = getToday()
  const dueObj = new Date(props.dueDate + 'T00:00:00')
  const daysToDeadline = daysBetween(t, dueObj)

  const completedByDeadline = completionDays.filter(d => d <= daysToDeadline).length
  const pAtDeadline = Math.round((completedByDeadline / ITERATIONS) * 100)

  const p85Days = completionDays[Math.ceil(ITERATIONS * 0.85) - 1]
  const p95Days = completionDays[Math.ceil(ITERATIONS * 0.95) - 1]

  sim.value = {
    completionDays,
    pAtDeadline,
    daysToDeadline,
    p85Days,
    p85Date: addDays(t, p85Days),
    p95Days,
    p95Date: addDays(t, p95Days),
    minDays: completionDays[0],
    maxDays: completionDays[ITERATIONS - 1]
  }
}

const scheduleIdle = typeof requestIdleCallback === 'function'
  ? (fn) => requestIdleCallback(fn)
  : (fn) => setTimeout(fn, 0)
const cancelIdle = typeof cancelIdleCallback === 'function'
  ? (id) => cancelIdleCallback(id)
  : (id) => clearTimeout(id)

watch(
  () => [props.notDoneCount, props.velocity, props.dueDate],
  () => {
    if (pendingIdleId != null) cancelIdle(pendingIdleId)
    pendingIdleId = scheduleIdle(() => { pendingIdleId = null; runSimulation() })
  },
  { immediate: true }
)

onUnmounted(() => { if (pendingIdleId != null) cancelIdle(pendingIdleId) })

// ── Histogram binning ──

const secondaryDates = computed(() => {
  if (!sim.value) return { cfDays: null, relDays: null }
  const t = getToday()
  let cfDays = null
  let relDays = null
  if (props.codeFreezeDate && props.codeFreezeDate !== props.dueDate) {
    const d = new Date(props.codeFreezeDate + 'T00:00:00')
    if (!isNaN(d.getTime())) cfDays = daysBetween(t, d)
  }
  if (props.releaseDate && props.releaseDate !== props.dueDate) {
    const d = new Date(props.releaseDate + 'T00:00:00')
    if (!isNaN(d.getTime())) relDays = daysBetween(t, d)
  }
  return { cfDays, relDays }
})

const histogram = computed(() => {
  if (!sim.value) return null
  const { completionDays, minDays, maxDays, daysToDeadline, p85Days, p95Days } = sim.value
  const { cfDays, relDays } = secondaryDates.value

  const allKeyDays = [minDays, maxDays, daysToDeadline, p85Days, p95Days]
  if (cfDays != null) allKeyDays.push(cfDays)
  if (relDays != null) allKeyDays.push(relDays)
  const effectiveMin = Math.max(0, Math.min(...allKeyDays))
  const effectiveMax = Math.min(MAX_DAYS, Math.max(...allKeyDays))
  const range = effectiveMax - effectiveMin

  let binSize
  if (range <= 30) binSize = 2
  else if (range <= 60) binSize = 3
  else if (range <= 120) binSize = 5
  else if (range <= 240) binSize = 7
  else binSize = 14

  const firstBin = Math.floor(effectiveMin / binSize) * binSize
  const lastBin = Math.ceil((effectiveMax + 1) / binSize) * binSize
  const binCount = Math.max(1, Math.ceil((lastBin - firstBin) / binSize))

  const bins = []
  const today = getToday()
  for (let i = 0; i < binCount; i++) {
    const dayStart = firstBin + i * binSize
    bins.push({
      dayStart,
      dayEnd: dayStart + binSize,
      count: 0,
      label: formatShortDate(addDays(today, dayStart + Math.floor(binSize / 2)))
    })
  }

  for (const d of completionDays) {
    const idx = Math.floor((d - firstBin) / binSize)
    if (idx >= 0 && idx < bins.length) bins[idx].count++
  }

  const toChartIdx = d => (d - firstBin) / binSize - 0.5

  return {
    bins,
    binSize,
    firstBin,
    dueDateIdx: toChartIdx(daysToDeadline),
    p85Idx: toChartIdx(p85Days),
    p95Idx: toChartIdx(p95Days),
    cfIdx: cfDays != null ? toChartIdx(cfDays) : null,
    relIdx: relDays != null ? toChartIdx(relDays) : null
  }
})

// ── Chart data ──

const chartData = computed(() => {
  if (!histogram.value) return { labels: [], datasets: [] }
  const { bins } = histogram.value
  return {
    labels: bins.map(b => b.label),
    datasets: [{
      data: bins.map(b => b.count),
      backgroundColor: 'rgba(99, 102, 241, 0.55)',
      borderColor: 'rgba(99, 102, 241, 0.8)',
      borderWidth: 1,
      borderRadius: 2,
      barPercentage: 0.95,
      categoryPercentage: 1.0
    }]
  }
})

// ── Vertical-line marker plugin ──

const markerPlugin = {
  id: 'monteCarloMarkers',
  afterDraw(chart) {
    if (!histogram.value) return
    const { dueDateIdx, p85Idx, p95Idx, cfIdx, relIdx } = histogram.value
    const { ctx, chartArea } = chart
    if (!chartArea) return

    const xScale = chart.scales.x
    const markers = [
      { idx: dueDateIdx, color: '#ef4444', dash: [6, 3], label: props.deadlineLabel, width: 2.5 },
      { idx: p85Idx, color: '#f59e0b', dash: [4, 4], label: '85%', width: 2 },
      { idx: p95Idx, color: '#14b8a6', dash: [4, 4], label: '95%', width: 2 }
    ]

    if (cfIdx != null) {
      markers.push({ idx: cfIdx, color: '#ec4899', dash: [6, 3], label: 'Code Freeze', width: 2 })
    }
    if (relIdx != null) {
      markers.push({ idx: relIdx, color: '#ef4444', dash: [6, 3], label: 'GA', width: 2 })
    }

    for (const m of markers) {
      const px = xScale.getPixelForValue(m.idx)
      if (px < chartArea.left - 2 || px > chartArea.right + 2) continue

      ctx.save()
      ctx.beginPath()
      ctx.strokeStyle = m.color
      ctx.lineWidth = m.width
      ctx.setLineDash(m.dash)
      ctx.moveTo(px, chartArea.top)
      ctx.lineTo(px, chartArea.bottom)
      ctx.stroke()

      ctx.fillStyle = m.color
      ctx.font = 'bold 10px Inter, system-ui, -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(m.label, px, chartArea.top - 8)
      ctx.restore()
    }
  }
}

// ── Chart options ──

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  layout: {
    padding: { top: 24 }
  },
  plugins: {
    legend: { display: false },
    title: {
      display: true,
      text: 'Monte Carlo Simulation — Completion Date Distribution',
      font: { size: 13, weight: '600' },
      padding: { bottom: 12 },
      color: '#6b7280'
    },
    tooltip: {
      callbacks: {
        title(items) {
          if (!items.length || !histogram.value) return ''
          const bin = histogram.value.bins[items[0].dataIndex]
          if (!bin) return ''
          const from = formatShortDate(addDays(getToday(), bin.dayStart))
          const to = formatShortDate(addDays(getToday(), bin.dayEnd - 1))
          return `${from} – ${to}`
        },
        label(ctx) {
          const count = ctx.parsed.y
          const pct = ((count / ITERATIONS) * 100).toFixed(1)
          return `${count} simulations (${pct}%)`
        }
      }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        maxRotation: 45,
        font: { size: 10 },
        autoSkip: true,
        maxTicksLimit: 20
      }
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0,0,0,0.05)' },
      ticks: { font: { size: 10 } },
      title: {
        display: true,
        text: 'Simulations',
        font: { size: 11 }
      }
    }
  }
}))

// ── Card styling (color-coded by probability) ──

const pCardClass = computed(() => {
  if (!sim.value) return ''
  const p = sim.value.pAtDeadline
  if (p >= 70) return 'border-emerald-200 dark:border-emerald-700/50 bg-emerald-50/60 dark:bg-emerald-900/20'
  if (p >= 40) return 'border-amber-200 dark:border-amber-700/50 bg-amber-50/60 dark:bg-amber-900/20'
  return 'border-red-200 dark:border-red-700/50 bg-red-50/60 dark:bg-red-900/20'
})

const pLabelClass = computed(() => {
  if (!sim.value) return ''
  const p = sim.value.pAtDeadline
  if (p >= 70) return 'text-emerald-600 dark:text-emerald-400'
  if (p >= 40) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
})

const pValueClass = computed(() => {
  if (!sim.value) return ''
  const p = sim.value.pAtDeadline
  if (p >= 70) return 'text-emerald-700 dark:text-emerald-300'
  if (p >= 40) return 'text-amber-700 dark:text-amber-300'
  return 'text-red-700 dark:text-red-300'
})

const pSubClass = computed(() => {
  if (!sim.value) return ''
  const p = sim.value.pAtDeadline
  if (p >= 70) return 'text-emerald-500/80 dark:text-emerald-500/60'
  if (p >= 40) return 'text-amber-500/80 dark:text-amber-500/60'
  return 'text-red-500/80 dark:text-red-500/60'
})
</script>
