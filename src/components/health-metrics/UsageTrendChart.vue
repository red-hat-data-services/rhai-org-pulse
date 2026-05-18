<template>
  <div>
    <div v-if="!sortedDays.length" class="text-center py-8 text-gray-400 dark:text-gray-500">
      No trend data available
    </div>
    <Line v-else :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const props = defineProps({
  daily: { type: Object, default: () => ({}) },
})

const sortedDays = computed(() =>
  Object.entries(props.daily)
    .sort(([a], [b]) => a.localeCompare(b))
)

const chartData = computed(() => ({
  labels: sortedDays.value.map(([day]) => day),
  datasets: [
    {
      label: 'Views',
      data: sortedDays.value.map(([, d]) => d.views),
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.3,
    },
    {
      label: 'Unique Users',
      data: sortedDays.value.map(([, d]) => d.uniqueUsers),
      borderColor: 'rgb(16, 185, 129)',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: false,
      tension: 0.3,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top' },
  },
  scales: {
    y: { beginAtZero: true },
  },
}
</script>

<style scoped>
div :deep(canvas) {
  min-height: 200px;
  max-height: 350px;
}
</style>
