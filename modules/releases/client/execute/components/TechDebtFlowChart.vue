<script setup>
import { computed } from 'vue'
import { Bar, Line } from 'vue-chartjs'
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip)

const props = defineProps({
  panel: { type: Object, required: true },
  categories: { type: Array, required: true },
  showIssueTypes: { type: Boolean, default: false }
})

function monthLabel(month) {
  const date = new Date(month + '-01T00:00:00.000Z')
  return Number.isNaN(date.getTime())
    ? month
    : date.toLocaleDateString(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

function translucent(hex) {
  const value = String(hex || '').replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(value)) return 'rgba(100, 116, 139, 0.28)'
  const red = parseInt(value.slice(0, 2), 16)
  const green = parseInt(value.slice(2, 4), 16)
  const blue = parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, 0.3)`
}

const hasActivity = computed(function () {
  return Number(props.panel?.totals?.received || 0) + Number(props.panel?.totals?.resolved || 0) > 0
})

const chartData = computed(function () {
  const months = Array.isArray(props.panel?.months) ? props.panel.months : []
  if (!props.showIssueTypes) {
    return {
      labels: months.map(function (month) { return monthLabel(month.month) }),
      datasets: [
        {
          label: 'Received',
          state: 'Received',
          data: months.map(function (month) { return Number(month.received?.total || 0) }),
          borderColor: '#2563eb',
          backgroundColor: '#2563eb',
          borderWidth: 3,
          pointBackgroundColor: '#2563eb',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.25,
          fill: false
        },
        {
          label: 'Closed',
          state: 'Closed',
          data: months.map(function (month) { return Number(month.resolved?.total || 0) }),
          borderColor: '#059669',
          backgroundColor: '#059669',
          borderWidth: 3,
          borderDash: [7, 5],
          pointBackgroundColor: '#059669',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.25,
          fill: false
        }
      ]
    }
  }

  const datasets = []
  for (const category of props.categories) {
    datasets.push({
      label: category.label + ' · Received',
      state: 'Received',
      stack: 'received',
      data: months.map(function (month) { return Number(month.received?.categories?.[category.code] || 0) }),
      backgroundColor: category.color,
      borderColor: category.color,
      borderWidth: 1,
      borderRadius: 2
    })
    datasets.push({
      label: category.label + ' · Closed',
      state: 'Closed',
      stack: 'closed',
      data: months.map(function (month) { return Number(month.resolved?.categories?.[category.code] || 0) }),
      backgroundColor: translucent(category.color),
      borderColor: category.color,
      borderWidth: 1,
      borderRadius: 2
    })
  }
  return {
    labels: months.map(function (month) { return monthLabel(month.month) }),
    datasets
  }
})

const chartOptions = computed(function () {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        filter: function (item) { return item.raw > 0 },
        callbacks: {
          label: function (item) { return `${item.dataset.label}: ${item.formattedValue}` },
          footer: function (items) {
            const totals = { Received: 0, Closed: 0 }
            for (const item of items) totals[item.dataset.state] += Number(item.raw || 0)
            return `Received: ${totals.Received} · Closed: ${totals.Closed}`
          }
        }
      }
    },
    scales: {
      x: {
        stacked: props.showIssueTypes,
        grid: { display: false },
        ticks: { color: '#64748b' }
      },
      y: {
        stacked: props.showIssueTypes,
        beginAtZero: true,
        ticks: { precision: 0, color: '#64748b' },
        grid: { color: 'rgba(148, 163, 184, 0.2)' },
        title: { display: true, text: 'Issues', color: '#64748b' }
      }
    }
  }
})
</script>

<template>
  <article class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800" :data-testid="`tech-debt-trend-${panel.component}`">
    <header class="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div>
        <h4 class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ panel.component }}</h4>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {{ panel.totals.received }} received · {{ panel.totals.resolved }} closed
        </p>
      </div>
    </header>
    <div v-if="hasActivity" class="h-64" data-testid="tech-debt-trend-chart">
      <Bar v-if="showIssueTypes" :data="chartData" :options="chartOptions" />
      <Line v-else :data="chartData" :options="chartOptions" />
    </div>
    <div v-else class="flex h-48 items-center justify-center rounded-lg border border-dashed border-gray-200 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
      No received or closed issues in this six-month window.
    </div>
  </article>
</template>
