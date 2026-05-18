<template>
  <div>
    <div v-if="!pages.length" class="text-center py-8 text-gray-400 dark:text-gray-500">
      No page data available
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
  pages: { type: Array, default: () => [] },
})

function formatLabel(pageId) {
  const [mod, view] = pageId.split('::')
  return `${mod} / ${view}`
}

const chartData = computed(() => ({
  labels: props.pages.map(p => formatLabel(p.pageId)),
  datasets: [
    {
      label: 'Views',
      data: props.pages.map(p => p.views),
      backgroundColor: 'rgba(59, 130, 246, 0.7)',
      borderRadius: 4,
    },
  ],
}))

const chartOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    x: { beginAtZero: true },
  },
}
</script>

<style scoped>
div :deep(canvas) {
  min-height: 200px;
  max-height: 400px;
}
</style>
