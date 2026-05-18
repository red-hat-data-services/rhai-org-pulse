<template>
  <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 p-3" style="height: 240px;">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Title,
  Legend
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Title, Legend)

const props = defineProps({
  forecast: {
    type: Object,
    required: true,
    validator: (val) => 'remaining' in val && 'totalCapacity' in val && 'delta' in val
  }
})

const chartData = computed(() => ({
  labels: ['Capacity vs Demand'],
  datasets: [
    {
      label: 'Remaining Issues',
      data: [props.forecast.remaining],
      backgroundColor: 'rgba(239, 68, 68, 0.8)',  // red-500
      borderColor: 'rgb(239, 68, 68)',
      borderWidth: 2,
      borderRadius: 4
    },
    {
      label: 'Projected Capacity',
      data: [props.forecast.totalCapacity],
      backgroundColor: props.forecast.delta >= 0
        ? 'rgba(16, 185, 129, 0.8)'   // emerald-500 (on track)
        : 'rgba(251, 146, 60, 0.8)',  // orange-400 (at risk)
      borderColor: props.forecast.delta >= 0
        ? 'rgb(16, 185, 129)'
        : 'rgb(251, 146, 60)',
      borderWidth: 2,
      borderRadius: 4
    }
  ]
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
        pointStyle: 'rect'
      }
    },
    title: {
      display: true,
      text: 'Backlog Health',
      font: { size: 12, weight: '600' },
      padding: { bottom: 8 },
      color: '#6b7280'
    },
    tooltip: {
      callbacks: {
        afterBody() {
          const delta = props.forecast.delta
          const status = delta >= 0 ? `Surplus: +${delta.toFixed(1)}` : `Deficit: ${delta.toFixed(1)}`
          return `\n${status} issues`
        }
      }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { font: { size: 10 } }
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0,0,0,0.05)' },
      ticks: { font: { size: 10 } },
      title: {
        display: true,
        text: 'Issues',
        font: { size: 11 }
      }
    }
  }
}))
</script>
