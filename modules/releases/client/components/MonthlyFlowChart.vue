<script setup>
import { computed } from 'vue'
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
  monthlyFlow: { type: Array, required: true },
})

const chartData = computed(() => ({
  labels: props.monthlyFlow.map(m => m.month),
  datasets: [
    {
      label: 'Created',
      data: props.monthlyFlow.map(m => m.created),
      backgroundColor: 'rgba(239, 68, 68, 0.7)',
      borderColor: 'rgba(239, 68, 68, 1)',
      borderWidth: 1,
    },
    {
      label: 'Resolved',
      data: props.monthlyFlow.map(m => m.resolved),
      backgroundColor: 'rgba(34, 197, 94, 0.7)',
      borderColor: 'rgba(34, 197, 94, 1)',
      borderWidth: 1,
    },
  ],
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' },
    tooltip: {
      callbacks: {
        afterBody(items) {
          const idx = items[0]?.dataIndex
          if (idx == null) return ''
          const row = props.monthlyFlow[idx]
          return `Net: ${row.net > 0 ? '+' : ''}${row.net}\nCumulative: ${row.cumulative > 0 ? '+' : ''}${row.cumulative}`
        },
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      title: { display: true, text: 'Count' },
    },
    x: {
      title: { display: true, text: 'Month' },
    },
  },
}))
</script>

<template>
  <div class="w-full" style="height: 320px">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>
