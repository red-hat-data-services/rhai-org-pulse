<template>
  <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 p-3" style="height: 240px;">
    <Doughnut :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps({
  counts: {
    type: Object,
    required: true,
    validator: (val) => 'done' in val && 'doing' in val && 'to_do' in val
  }
})

const chartData = computed(() => ({
  labels: ['Done', 'In Progress', 'To Do'],
  datasets: [{
    data: [props.counts.done, props.counts.doing, props.counts.to_do],
    backgroundColor: [
      'rgba(16, 185, 129, 0.8)',  // emerald-500
      'rgba(59, 130, 246, 0.8)',  // blue-500
      'rgba(156, 163, 175, 0.8)'  // gray-400
    ],
    borderColor: [
      'rgb(16, 185, 129)',
      'rgb(59, 130, 246)',
      'rgb(156, 163, 175)'
    ],
    borderWidth: 2
  }]
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      labels: {
        padding: 12,
        font: { size: 11 },
        color: '#6b7280',
        usePointStyle: true,
        pointStyle: 'circle'
      }
    },
    tooltip: {
      callbacks: {
        label(ctx) {
          const label = ctx.label || ''
          const value = ctx.parsed || 0
          const total = props.counts.done + props.counts.doing + props.counts.to_do
          const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0
          return `${label}: ${value} (${pct}%)`
        }
      }
    }
  }
}))
</script>
