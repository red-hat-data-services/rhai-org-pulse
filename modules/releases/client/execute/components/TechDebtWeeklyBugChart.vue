<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Line } from 'vue-chartjs'
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Legend, Tooltip)

const props = defineProps({
  weeks: { type: Array, required: true }
})

const STICKY_AXIS_WIDTH = 64
const chartScroller = ref(null)
let externalTooltipElement = null

function shortWeekLabel(value) {
  const match = String(value || '').match(/W\d{2}$/)
  return match ? match[0] : String(value || '')
}

function formatUtcDate(value) {
  const parsed = new Date(String(value || '') + 'T00:00:00.000Z')
  if (Number.isNaN(parsed.getTime())) return String(value || '')
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  })
}

function weekDateRange(week) {
  const start = new Date(String(week?.startDate || '') + 'T00:00:00.000Z')
  if (Number.isNaN(start.getTime())) return ''
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  return formatUtcDate(week.startDate) + ' – ' + formatUtcDate(end.toISOString().slice(0, 10))
}

function ensureExternalTooltip() {
  if (externalTooltipElement) return externalTooltipElement
  externalTooltipElement = document.createElement('div')
  externalTooltipElement.dataset.techDebtWeeklyTooltip = 'true'
  externalTooltipElement.setAttribute('role', 'tooltip')
  externalTooltipElement.style.cssText = [
    'position:fixed',
    'pointer-events:none',
    'z-index:9999',
    'max-width:min(28rem,calc(100vw - 16px))',
    'border-radius:0.5rem',
    'background:rgba(17,24,39,0.92)',
    'color:#fff',
    'padding:0.625rem 0.75rem',
    'font-size:0.75rem',
    'line-height:1.25rem',
    'white-space:nowrap',
    'opacity:0',
    'transition:opacity 80ms ease'
  ].join(';')
  document.body.appendChild(externalTooltipElement)
  return externalTooltipElement
}

function appendTooltipRow(container, label, value, color, dashed) {
  const row = document.createElement('div')
  row.style.display = 'flex'
  row.style.alignItems = 'center'
  row.style.gap = '0.5rem'

  const key = document.createElement('span')
  key.style.cssText = [
    'display:inline-block',
    'width:1.25rem',
    'height:0',
    'border-top:3px ' + (dashed ? 'dashed' : 'solid') + ' ' + color
  ].join(';')
  row.appendChild(key)

  const text = document.createElement('span')
  text.textContent = label + ': ' + value
  row.appendChild(text)
  container.appendChild(row)
}

function renderExternalTooltip(context) {
  const tooltipElement = ensureExternalTooltip()
  const tooltip = context.tooltip
  if (!tooltip || tooltip.opacity === 0) {
    tooltipElement.style.opacity = '0'
    return
  }

  const dataIndex = tooltip.dataPoints && tooltip.dataPoints[0] && tooltip.dataPoints[0].dataIndex
  const week = props.weeks[dataIndex]
  tooltipElement.replaceChildren()

  const title = document.createElement('div')
  title.style.fontWeight = '700'
  title.style.marginBottom = '0.25rem'
  title.textContent = week ? week.week + ' · ' + weekDateRange(week) : ''
  tooltipElement.appendChild(title)

  for (const point of tooltip.dataPoints || []) {
    const isResolved = point.dataset && point.dataset.label === 'Resolved'
    appendTooltipRow(
      tooltipElement,
      point.dataset && point.dataset.label || '',
      point.formattedValue,
      isResolved ? '#34d399' : '#60a5fa',
      isResolved
    )
  }

  tooltipElement.style.opacity = '1'
  const canvasRect = context.chart.canvas.getBoundingClientRect()
  const desiredLeft = canvasRect.left + tooltip.caretX
  const halfWidth = tooltipElement.offsetWidth / 2
  const viewportPadding = 8
  const clampedLeft = Math.max(
    halfWidth + viewportPadding,
    Math.min(window.innerWidth - halfWidth - viewportPadding, desiredLeft)
  )
  const caretTop = canvasRect.top + tooltip.caretY
  const showBelow = caretTop - tooltipElement.offsetHeight - 12 < viewportPadding
  tooltipElement.style.left = clampedLeft + 'px'
  tooltipElement.style.top = caretTop + 'px'
  tooltipElement.style.transform = showBelow ? 'translate(-50%, 12px)' : 'translate(-50%, calc(-100% - 12px))'
}

function scrollToLatestWeek() {
  nextTick(function () {
    const scroller = chartScroller.value
    if (scroller) scroller.scrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth)
  })
}

function hideExternalTooltip() {
  if (externalTooltipElement) externalTooltipElement.style.opacity = '0'
}

const chartWidth = computed(function () {
  return Math.max(720, props.weeks.length * 48) + 'px'
})

const axisScale = computed(function () {
  const values = props.weeks.flatMap(function (week) {
    return [Number(week.created || 0), Number(week.resolved || 0)]
  })
  const maximum = Math.max(0, ...values)
  if (maximum === 0) return { maximum: 1, step: 1 }
  const roughStep = maximum / 6
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)))
  const fraction = roughStep / magnitude
  let niceFraction
  if (fraction <= 1) niceFraction = 1
  else if (fraction <= 2) niceFraction = 2
  else if (fraction <= 2.5) niceFraction = 2.5
  else if (fraction <= 5) niceFraction = 5
  else niceFraction = 10
  const step = niceFraction * magnitude
  return { maximum: Math.ceil(maximum / step) * step, step }
})

const axisTicks = computed(function () {
  const ticks = []
  for (let value = axisScale.value.maximum; value >= 0; value -= axisScale.value.step) ticks.push(value)
  return ticks
})

function formatAxisTick(value) {
  return new Intl.NumberFormat().format(value)
}

const chartData = computed(function () {
  return {
    labels: props.weeks.map(function (week) { return shortWeekLabel(week.week) }),
    datasets: [
      {
        label: 'Created',
        data: props.weeks.map(function (week) { return Number(week.created || 0) }),
        borderColor: '#2563eb',
        backgroundColor: '#2563eb',
        borderWidth: 3,
        pointBackgroundColor: '#2563eb',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
        tension: 0.25,
        fill: false
      },
      {
        label: 'Resolved',
        data: props.weeks.map(function (week) { return Number(week.resolved || 0) }),
        borderColor: '#059669',
        backgroundColor: '#059669',
        borderWidth: 3,
        borderDash: [7, 5],
        pointBackgroundColor: '#059669',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
        tension: 0.25,
        fill: false
      }
    ]
  }
})

const chartOptions = computed(function () {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { left: STICKY_AXIS_WIDTH } },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: false,
        external: renderExternalTooltip
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { autoSkip: false, maxRotation: 0, minRotation: 0, color: '#64748b' },
        title: { display: true, text: 'ISO week (UTC)', color: '#64748b' }
      },
      y: {
        beginAtZero: true,
        max: axisScale.value.maximum,
        ticks: { precision: 0, display: false, stepSize: axisScale.value.step },
        grid: { color: 'rgba(148, 163, 184, 0.2)' },
        border: { display: false },
        title: { display: false }
      }
    }
  }
})

onMounted(scrollToLatestWeek)
watch(function () { return props.weeks }, scrollToLatestWeek, { deep: true })
onBeforeUnmount(function () {
  if (externalTooltipElement) externalTooltipElement.remove()
  externalTooltipElement = null
})
</script>

<template>
  <div data-testid="tech-debt-weekly-bug-chart">
    <div class="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-gray-600 dark:text-gray-300" aria-label="Chart legend">
      <span class="inline-flex items-center gap-2">
        <span class="inline-block w-8 border-t-[3px] border-solid border-blue-600" aria-hidden="true" />
        Created Bugs
      </span>
      <span class="inline-flex items-center gap-2">
        <span class="inline-block w-8 border-t-[3px] border-dashed border-emerald-600" aria-hidden="true" />
        Resolved Bugs
      </span>
    </div>
    <div ref="chartScroller" class="overflow-x-auto pb-2" data-testid="tech-debt-weekly-chart-scroller" @scroll="hideExternalTooltip">
      <div class="relative h-72" :style="{ minWidth: chartWidth }">
        <div
          class="sticky left-0 top-0 z-10 h-72 w-16 pointer-events-none"
          data-testid="tech-debt-weekly-sticky-axis"
          aria-hidden="true"
        >
          <div class="absolute inset-x-0 top-0 bottom-[50px] border-r border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
            <span class="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-semibold text-gray-500 dark:text-gray-300">Bugs</span>
            <div class="absolute bottom-0 left-6 right-2 top-0 flex flex-col justify-between text-right text-xs text-gray-500 dark:text-gray-300">
              <span v-for="tick in axisTicks" :key="tick">{{ formatAxisTick(tick) }}</span>
            </div>
          </div>
        </div>
        <div class="absolute inset-0">
          <Line :data="chartData" :options="chartOptions" />
        </div>
      </div>
    </div>
    <table class="sr-only" aria-label="Weekly Bug created and resolved counts">
      <caption>AI Engineering weekly Bug trend</caption>
      <thead>
        <tr><th>ISO week</th><th>Created</th><th>Resolved</th></tr>
      </thead>
      <tbody>
        <tr v-for="week in weeks" :key="week.week">
          <th>{{ week.week }}</th><td>{{ week.created }}</td><td>{{ week.resolved }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
