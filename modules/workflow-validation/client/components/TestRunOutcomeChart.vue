<template><div class="rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700/60 dark:bg-gray-800"><h3 class="font-semibold text-gray-900 dark:text-gray-100">Pass Rate and Test Volume</h3><p class="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">Each date is one run. The dark line shows pass rate; bar height shows test count, and bar color identifies the RHOAI version. Select a point to open that run.</p><div v-if="runs.length" class="relative mt-4 h-72"><Line :data="chartData" :options="chartOptions" /></div><div v-else class="py-16 text-center text-sm text-gray-400">No outcome history for these filters</div></div></template>
<script setup>
import { computed } from 'vue'; import { Line } from 'vue-chartjs'; import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js'; import { versionColor } from '../composables/useWorkflowValidation'
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend)
const props = defineProps({ runs: { type: Array, default: () => [] } }); const emit = defineEmits(['select'])
const versions = computed(() => [...new Set(props.runs.map((run) => run.rhoaiVersion || 'Unknown'))].sort())
const labels = computed(() => props.runs.map((run) => new Date(run.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })))
const chartData = computed(() => ({ labels: labels.value, datasets: [
  ...versions.value.map((version) => ({
    type: 'bar', label: version, data: props.runs.map((run) => (run.rhoaiVersion || 'Unknown') === version ? run.tests : null),
    backgroundColor: versionColor(version, versions.value), yAxisID: 'count', order: 2, stack: 'volume'
  })),
  { type: 'line', label: 'Pass rate', data: props.runs.map((run) => run.passRate == null ? null : Math.round(run.passRate * 100)), borderColor: '#fb7185', backgroundColor: '#fb7185', pointBackgroundColor: '#fb7185', pointBorderColor: '#ffffff', pointBorderWidth: 1, borderWidth: 3, tension: .25, yAxisID: 'rate', order: 1 }
]}))
const chartOptions = computed(() => ({ responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, onClick: (_event, elements) => { if (elements[0]) emit('select', props.runs[elements[0].index]) }, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 10 } } }, scales: { x: { stacked: true }, rate: { position: 'left', min: 0, max: 100, ticks: { callback: (value) => `${value}%` } }, count: { position: 'right', beginAtZero: true, stacked: true, grid: { display: false }, ticks: { precision: 0 } } } }))
</script>
