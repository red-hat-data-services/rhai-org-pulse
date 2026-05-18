<template>
  <div class="relative" style="height: 300px;">
    <component :is="chartComponent" :data="chartData" :options="chartOptions" />
  </div>
</template>

<script>
const DEFAULT_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
]
</script>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { Bar, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title
} from 'chart.js'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title)

const props = defineProps({
  type: { type: String, required: true },
  labels: { type: Array, required: true },
  data: { type: Array, required: true },
  colors: { type: Array, default: () => DEFAULT_COLORS },
  unit: { type: String, default: '' },
  title: { type: String, default: '' }
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

const chartComponent = computed(() => props.type === 'doughnut' ? Doughnut : Bar)

const chartData = computed(() => ({
  labels: props.labels,
  datasets: [{
    data: props.data,
    backgroundColor: props.labels.map((_, i) => props.colors[i % props.colors.length]),
    borderWidth: props.type === 'doughnut' ? 2 : 0,
    borderColor: props.type === 'doughnut' ? (isDark.value ? '#1f2937' : '#fff') : undefined
  }]
}))

const chartOptions = computed(() => {
  const base = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: props.type === 'doughnut',
        position: 'right',
        labels: {
          font: { size: 12 },
          color: textColor.value,
          padding: 12,
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
            const value = context.parsed?.y ?? context.parsed?.x ?? context.parsed
            const suffix = props.unit ? ` ${props.unit}` : ''
            if (props.type === 'doughnut') {
              const total = context.dataset.data.reduce((sum, v) => sum + v, 0)
              const pct = total > 0 ? Math.round((value / total) * 100) : 0
              return `${context.label}: ${value}${suffix} (${pct}%)`
            }
            return `${context.label}: ${value}${suffix}`
          }
        }
      }
    }
  }

  if (props.type !== 'doughnut') {
    base.indexAxis = props.type === 'horizontalBar' ? 'y' : 'x'
    base.scales = {
      x: {
        beginAtZero: true,
        grid: { color: gridColor.value },
        ticks: { font: { size: 11 }, color: textColor.value }
      },
      y: {
        beginAtZero: true,
        grid: { color: gridColor.value },
        ticks: { font: { size: 11 }, color: textColor.value }
      }
    }
  }

  return base
})
</script>
