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
  Title
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Title)

const props = defineProps({
  velocity: {
    type: Number,
    required: true
  }
})

const chartData = computed(() => ({
  labels: ['6-Month Avg'],
  datasets: [{
    label: 'Issues per 14 days',
    data: [props.velocity],
    backgroundColor: 'rgba(99, 102, 241, 0.8)',  // indigo-500
    borderColor: 'rgb(99, 102, 241)',
    borderWidth: 2,
    borderRadius: 4,
    barPercentage: 0.5
  }]
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: {
      display: true,
      text: 'Feature Velocity',
      font: { size: 12, weight: '600' },
      padding: { bottom: 8 },
      color: '#6b7280'
    },
    tooltip: {
      callbacks: {
        label(ctx) {
          return `${ctx.parsed.y.toFixed(1)} issues / 14d`
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
        text: 'Issues / 14 days',
        font: { size: 11 }
      }
    }
  }
}))
</script>
