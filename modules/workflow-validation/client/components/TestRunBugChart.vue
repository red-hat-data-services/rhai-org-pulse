<template>
  <div class="rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
    <h3 class="font-semibold text-gray-900 dark:text-gray-100">Bug Occurrences Over Time</h3>
    <p class="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Each group is one run. Red bars are new bugs opened; amber bars are known bugs encountered. The release appears beneath each date.</p>
    <div v-if="runs.length" class="relative mt-4 h-72"><Bar :data="chartData" :options="chartOptions" /></div>
    <div v-else class="py-16 text-center text-sm text-gray-400">No product-bug history for these filters</div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)
const props = defineProps({ runs: { type: Array, default: () => [] } })
const emit = defineEmits(['select'])
const bugs = (run) => (run.productBugs || []).filter((bug) => bug.category === 'PRODUCT_BUG')
const labels = computed(() => props.runs.map((run) => [
  new Date(run.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' }),
  run.rhoaiVersion || 'Unknown'
]))
const chartData = computed(() => ({ labels: labels.value, datasets: [
  { label: 'New bugs opened', data: props.runs.map((run) => bugs(run).filter((bug) => bug.opened === true).length), backgroundColor: '#ef4444', borderRadius: 2 },
  { label: 'Known bugs encountered', data: props.runs.map((run) => bugs(run).filter((bug) => bug.opened !== true).length), backgroundColor: '#f59e0b', borderRadius: 2 }
]}))
const chartOptions = computed(() => ({ responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, onClick: (_event, elements) => { if (elements[0]) emit('select', props.runs[elements[0].index]) }, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 10 } } }, scales: { x: { stacked: false, ticks: { autoSkip: true, maxRotation: 0 } }, y: { beginAtZero: true, ticks: { precision: 0 } } } }))
</script>
