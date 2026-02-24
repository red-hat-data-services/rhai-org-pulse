<template>
  <div class="relative" style="height: 250px;">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const props = defineProps({
  labels: { type: Array, required: true },
  datasets: { type: Array, required: true },
  suggestedMin: { type: Number, default: undefined },
  suggestedMax: { type: Number, default: undefined },
  scales: { type: Object, default: null }
})

const chartData = computed(() => ({
  labels: props.labels,
  datasets: props.datasets.map(ds => ({
    ...ds,
    fill: true,
    tension: 0.3,
    pointRadius: 4,
    pointHoverRadius: 6,
    borderWidth: 2
  }))
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: props.datasets.length > 1,
      position: 'bottom',
      labels: { font: { size: 11 } }
    },
    tooltip: {
      mode: 'index',
      intersect: false
    }
  },
  scales: props.scales || {
    x: {
      grid: { display: false },
      ticks: { font: { size: 11 } }
    },
    y: {
      beginAtZero: true,
      suggestedMin: props.suggestedMin,
      suggestedMax: props.suggestedMax,
      grid: { color: 'rgba(0,0,0,0.05)' },
      ticks: { font: { size: 11 } }
    }
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
  }
}))
</script>
