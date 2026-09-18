<template>
  <div class="rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
    <h3 class="font-semibold text-gray-900 dark:text-gray-100">Bug Frequency by RHOAI Version</h3>
    <p class="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Average occurrences per run, so releases with more recorded runs remain comparable. Hover for totals and run counts.</p>
    <div v-if="versionRows.length" class="relative mt-4 h-72"><Bar :data="chartData" :options="chartOptions" /></div>
    <div v-else class="py-16 text-center text-sm text-gray-400">No release comparison for these filters</div>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'
import { isVisibleProductBug } from '../utils/product-bugs'
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)
const props = defineProps({ runs: { type: Array, default: () => [] } })

const bugs = (run) => (run.productBugs || []).filter(isVisibleProductBug)
const versionRows = computed(() => {
  const rows = new Map()
  for (const run of props.runs) {
    const version = run.rhoaiVersion || 'Unknown'
    const row = rows.get(version) || { version, runs: 0, newBugs: 0, knownBugs: 0 }
    const findings = bugs(run)
    row.runs += 1
    row.newBugs += findings.filter((bug) => bug.opened === true).length
    row.knownBugs += findings.filter((bug) => bug.opened !== true).length
    rows.set(version, row)
  }
  return [...rows.values()].sort((a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }))
})
const chartData = computed(() => ({ labels: versionRows.value.map((row) => row.version), datasets: [
  { label: 'New bugs per run', data: versionRows.value.map((row) => row.newBugs / row.runs), backgroundColor: '#ef4444', borderRadius: 3 },
  { label: 'Known bugs per run', data: versionRows.value.map((row) => row.knownBugs / row.runs), backgroundColor: '#f59e0b', borderRadius: 3 }
]}))
const chartOptions = computed(() => ({ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 10 } }, tooltip: { callbacks: { label: (context) => { const row = versionRows.value[context.dataIndex]; const total = context.datasetIndex === 0 ? row.newBugs : row.knownBugs; return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} (${total} across ${row.runs} run${row.runs === 1 ? '' : 's'})` } } } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Average occurrences per run' } } } }))
</script>
