<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const props = defineProps({
  drops: { type: Array, required: true },
  metrics: { type: Object, required: true },
  productColors: { type: Object, required: true },
})

const isDark = ref(false)
let observer
onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  observer = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})
onUnmounted(() => { observer?.disconnect() })

const textColor = computed(() => isDark.value ? 'rgba(209, 213, 219, 1)' : 'rgba(107, 114, 128, 1)')
const gridColor = computed(() => isDark.value ? 'rgba(75, 85, 99, 0.5)' : 'rgba(229, 231, 235, 1)')

const chartItems = computed(() =>
  props.drops
    .filter(d => props.metrics[d.drop.key]?.timeline?.days_to_production != null)
    .slice(0, 10)
)

const legendProducts = computed(() => {
  const seen = new Set()
  const items = []
  for (const d of chartItems.value) {
    if (seen.has(d.productKey)) continue
    seen.add(d.productKey)
    const colors = props.productColors[d.productKey]
    if (colors) items.push({ key: d.productKey, label: colors.label, color: colors.border })
  }
  return items
})

const chartData = computed(() => ({
  labels: chartItems.value.map(d => {
    const label = props.productColors[d.productKey]?.label || d.productKey
    return `${label} — ${d.drop.name}`
  }),
  datasets: [{
    data: chartItems.value.map(d => props.metrics[d.drop.key].timeline.days_to_production),
    backgroundColor: chartItems.value.map(d => (props.productColors[d.productKey]?.border || '#6b7280') + '80'),
    borderColor: chartItems.value.map(d => props.productColors[d.productKey]?.border || '#6b7280'),
    borderWidth: 1,
    borderRadius: 4,
  }],
}))

const chartOptions = computed(() => ({
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label(context) {
          return `${context.parsed.x} days to production`
        },
        afterLabel(context) {
          const item = chartItems.value[context.dataIndex]
          return item ? (props.productColors[item.productKey]?.label || item.productKey) : ''
        },
      },
    },
  },
  scales: {
    x: {
      grid: { color: gridColor.value },
      ticks: { font: { size: 11 }, color: textColor.value },
      title: {
        display: true,
        text: 'Days',
        color: textColor.value,
        font: { size: 12 },
      },
    },
    y: {
      grid: { display: false },
      ticks: { font: { size: 11 }, color: textColor.value },
    },
  },
}))
</script>

<template>
  <div v-if="drops.length === 0 || chartItems.length === 0" class="h-48 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
    <p class="text-sm text-gray-500 dark:text-gray-400">No production metrics available</p>
  </div>
  <template v-else>
    <div v-if="legendProducts.length > 1" class="flex flex-wrap gap-3 mb-3">
      <div v-for="p in legendProducts" :key="p.key" class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
        <span class="inline-block w-3 h-3 rounded-sm" :style="{ backgroundColor: p.color }"></span>
        {{ p.label }}
      </div>
    </div>
    <div class="relative" :style="{ height: Math.max(200, chartItems.length * 40 + 60) + 'px' }">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </template>
</template>
