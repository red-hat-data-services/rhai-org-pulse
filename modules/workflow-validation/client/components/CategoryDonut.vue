<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/60 p-6">
    <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">{{ title }}</h3>
    <div v-if="items.length" class="flex items-center gap-6 flex-wrap">
      <div class="relative shrink-0" style="width: 150px; height: 150px">
        <Doughnut :data="chartData" :options="chartOptions" />
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span class="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">{{ total }}</span>
          <span class="text-[0.65rem] uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ centerLabel }}</span>
        </div>
      </div>
      <div class="flex-1 min-w-[160px] space-y-2">
        <div v-for="(it, i) in items" :key="it.label" class="flex items-center gap-2 text-sm">
          <span class="w-3 h-3 rounded-sm shrink-0" :style="{ background: colors[i] }"></span>
          <span class="flex-1 text-gray-700 dark:text-gray-300 capitalize">{{ prettify(it.label) }}</span>
          <span class="font-mono text-xs text-gray-500 dark:text-gray-400">{{ it.count }}</span>
        </div>
      </div>
    </div>
    <div v-else class="flex items-center justify-center py-12 text-sm text-gray-400 dark:text-gray-500">
      No data for the current filters
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps({
  title: { type: String, default: 'Breakdown' },
  centerLabel: { type: String, default: 'total' },
  items: { type: Array, default: () => [] } // [{ label, count }]
})

// Palette echoing the report's category hues.
const PALETTE = ['#ef4444', '#f59e0b', '#eab308', '#a855f7', '#f43f5e', '#3b82f6', '#14b8a6', '#6b7280']
const colors = computed(() => props.items.map((_, i) => PALETTE[i % PALETTE.length]))
const total = computed(() => props.items.reduce((s, i) => s + i.count, 0))

function prettify(s) { return String(s || '').replace(/_/g, ' ').toLowerCase() }

const chartData = computed(() => ({
  labels: props.items.map((i) => prettify(i.label)),
  datasets: [{
    data: props.items.map((i) => i.count),
    backgroundColor: colors.value,
    borderWidth: 0,
    cutout: '68%'
  }]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: '#111827', padding: 10, cornerRadius: 8 }
  }
}
</script>
