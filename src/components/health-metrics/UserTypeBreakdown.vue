<template>
  <div>
    <div v-if="!entries.length" class="text-center py-8 text-gray-400 dark:text-gray-500">
      No user type data available
    </div>
    <Bar v-else :data="chartData" :options="chartOptions" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const props = defineProps({
  userTypes: { type: Object, default: () => ({}) },
})

const COLORS = [
  'rgba(59, 130, 246, 0.7)',
  'rgba(16, 185, 129, 0.7)',
  'rgba(245, 158, 11, 0.7)',
  'rgba(239, 68, 68, 0.7)',
  'rgba(139, 92, 246, 0.7)',
  'rgba(236, 72, 153, 0.7)',
  'rgba(20, 184, 166, 0.7)',
  'rgba(249, 115, 22, 0.7)',
]

const entries = computed(() =>
  Object.entries(props.userTypes).sort((a, b) => b[1] - a[1])
)

const chartData = computed(() => ({
  labels: entries.value.map(([type]) => type),
  datasets: [
    {
      label: 'Views',
      data: entries.value.map(([, count]) => count),
      backgroundColor: entries.value.map((_, i) => COLORS[i % COLORS.length]),
      borderRadius: 4,
    },
  ],
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    y: { beginAtZero: true },
  },
}
</script>

<style scoped>
div :deep(canvas) {
  min-height: 200px;
  max-height: 300px;
}
</style>
