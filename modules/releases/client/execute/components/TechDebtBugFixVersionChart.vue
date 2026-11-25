<script setup>
import { computed, ref } from 'vue'
import { Pie } from 'vue-chartjs'
import { ArcElement, Chart as ChartJS, Tooltip } from 'chart.js'

ChartJS.register(ArcElement, Tooltip)

const props = defineProps({
  fixVersionDistribution: { type: Object, default: null },
  affectsVersionDistribution: { type: Object, default: null }
})

const COLORS = ['#7c83ee', '#f56565', '#f6ad45', '#48bb98', '#5b8def', '#9674e8', '#e85da5', '#4db6ac']
const MAX_VISIBLE_VERSIONS = 8
const selectedField = ref('fixVersions')

const activeConfig = computed(function () {
  if (selectedField.value === 'versions') {
    return {
      distribution: props.affectsVersionDistribution,
      title: 'Bugs by Affects Version',
      singular: 'Affects Version',
      multiple: 'Affects Versions'
    }
  }
  return {
    distribution: props.fixVersionDistribution,
    title: 'Bugs by Fix Version',
    singular: 'Fix Version',
    multiple: 'Fix Versions'
  }
})

const activeDistribution = computed(function () {
  return activeConfig.value.distribution || { total: 0, versions: [] }
})

const slices = computed(function () {
  const rows = Array.isArray(activeDistribution.value.versions) ? activeDistribution.value.versions : []
  if (rows.length <= MAX_VISIBLE_VERSIONS) return rows
  const visible = rows.slice(0, MAX_VISIBLE_VERSIONS - 1)
  const otherCount = rows.slice(MAX_VISIBLE_VERSIONS - 1).reduce(function (sum, row) {
    return sum + Number(row.count || 0)
  }, 0)
  return [...visible, { version: 'Other ' + activeConfig.value.multiple, count: otherCount }]
})

function percentage(count) {
  const total = Number(activeDistribution.value.total || 0)
  return total > 0 ? (Number(count || 0) / total * 100) : 0
}

function percentageLabel(count) {
  const value = percentage(count)
  return value >= 10 ? value.toFixed(1) + '%' : value.toFixed(2) + '%'
}

const chartData = computed(function () {
  return {
    labels: slices.value.map(function (row) { return row.version }),
    datasets: [{
      data: slices.value.map(function (row) { return row.count }),
      backgroundColor: slices.value.map(function (_, index) { return COLORS[index % COLORS.length] }),
      borderColor: '#ffffff',
      borderWidth: 2,
      hoverOffset: 6
    }]
  }
})

const chartOptions = computed(function () {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function (context) {
            return context.label + ': ' + context.formattedValue + ' Bugs (' + percentageLabel(context.raw) + ')'
          }
        }
      }
    }
  }
})
</script>

<template>
  <section class="mt-6 border-t border-gray-200 pt-5 dark:border-gray-700" aria-labelledby="bug-fix-version-chart-title" data-testid="tech-debt-bug-fix-version-chart">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h4 id="bug-fix-version-chart-title" class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ activeConfig.title }}</h4>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Each Bug is counted once; Bugs assigned to multiple {{ activeConfig.multiple }} are grouped separately.
        </p>
      </div>
      <div class="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-gray-700" role="group" aria-label="Bug version field">
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
          :class="selectedField === 'fixVersions' ? 'bg-white text-primary-700 shadow-sm dark:bg-gray-800 dark:text-primary-300' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'"
          :aria-pressed="selectedField === 'fixVersions'"
          data-testid="tech-debt-fix-version-toggle"
          @click="selectedField = 'fixVersions'"
        >
          Fix Version
        </button>
        <button
          type="button"
          class="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
          :class="selectedField === 'versions' ? 'bg-white text-primary-700 shadow-sm dark:bg-gray-800 dark:text-primary-300' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'"
          :aria-pressed="selectedField === 'versions'"
          data-testid="tech-debt-affects-version-toggle"
          @click="selectedField = 'versions'"
        >
          Affects Version
        </button>
      </div>
    </div>
    <div v-if="activeDistribution.total" class="grid items-center gap-6 lg:grid-cols-[minmax(18rem,1fr)_minmax(18rem,1fr)]">
      <div class="h-72 min-w-0">
        <Pie :data="chartData" :options="chartOptions" />
      </div>
      <div class="min-w-0">
        <ul class="space-y-2" :aria-label="`Bug counts by ${activeConfig.singular}`">
          <li v-for="(row, index) in slices" :key="row.version" class="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
            <span class="mt-1 h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: COLORS[index % COLORS.length] }" aria-hidden="true" />
            <span class="min-w-0 break-words">
              <span class="font-medium">{{ row.version }}</span>
              <span> ({{ row.count.toLocaleString() }} · {{ percentageLabel(row.count) }})</span>
            </span>
          </li>
        </ul>
        <p class="mt-5 text-sm font-semibold text-gray-500 dark:text-gray-400">
          {{ activeDistribution.total.toLocaleString() }} Bugs · Issues by {{ activeConfig.singular }}
        </p>
      </div>
    </div>
    <div v-else class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" data-testid="tech-debt-selected-version-unavailable">
      The {{ activeConfig.singular }} breakdown will be available after the next nightly Tech Debt snapshot refresh.
    </div>
    <table v-if="activeDistribution.total" class="sr-only" :aria-label="`Bug counts by ${activeConfig.singular}`">
      <caption>{{ activeConfig.title }}</caption>
      <thead><tr><th>{{ activeConfig.singular }}</th><th>Bugs</th><th>Percentage</th></tr></thead>
      <tbody>
        <tr v-for="row in slices" :key="row.version">
          <th>{{ row.version }}</th><td>{{ row.count }}</td><td>{{ percentageLabel(row.count) }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
