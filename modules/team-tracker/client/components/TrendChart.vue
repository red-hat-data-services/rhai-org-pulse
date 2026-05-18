<template>
  <div class="relative" style="height: 350px;">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<script>
const COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
]
</script>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title,
  Filler
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Title, Filler)

const props = defineProps({
  labels: { type: Array, required: true },
  datasets: { type: Array, required: true },
  title: { type: String, default: '' },
  unit: { type: String, default: '' }
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

const chartData = computed(() => ({
  labels: props.labels,
  datasets: props.datasets.map((ds, i) => ({
    label: ds.label,
    data: ds.data,
    borderColor: ds.color || COLORS[i % COLORS.length],
    backgroundColor: (ds.color || COLORS[i % COLORS.length]) + '20',
    borderWidth: 2,
    pointRadius: 3,
    tension: 0.3,
    fill: props.datasets.length === 1
  }))
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false
  },
  plugins: {
    legend: {
      display: props.datasets.length > 1,
      position: 'top',
      labels: {
        font: { size: 12 },
        color: textColor.value,
        usePointStyle: true,
        pointStyle: 'circle'
      }
    },
    title: {
      display: !!props.title,
      text: props.title,
      color: textColor.value,
      font: { size: 14, weight: 'bold' },
      padding: { bottom: 12 }
    },
    tooltip: {
      callbacks: {
        label(context) {
          const suffix = props.unit ? ` ${props.unit}` : ''
          return `${context.dataset.label}: ${context.parsed.y}${suffix}`
        }
      }
    }
  },
  scales: {
    x: {
      grid: { color: gridColor.value },
      ticks: { font: { size: 11 }, color: textColor.value }
    },
    y: {
      beginAtZero: true,
      grid: { color: gridColor.value },
      ticks: { font: { size: 11 }, color: textColor.value }
    }
  }
}))
</script>
