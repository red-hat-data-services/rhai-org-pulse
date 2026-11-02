<template>
  <div class="min-w-0 w-full overflow-x-clip">
    <div class="flex flex-col items-stretch gap-3 mb-4 sm:flex-row sm:items-center">
      <div class="flex min-w-0 w-full items-start gap-2 sm:w-auto sm:flex-1 sm:items-center sm:gap-3">
        <button
          type="button"
          aria-label="Back to Reports"
          title="Back to Reports"
          class="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          @click="goBack"
        >
          <ArrowLeft :size="18" />
        </button>
        <div class="min-w-0 flex-1">
          <h2 class="break-words text-xl font-bold text-gray-900 dark:text-gray-100">CVE Upstream Components</h2>
          <p v-if="data?.lastRefreshed" class="break-words text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Last refreshed: {{ formatDate(data.lastRefreshed) }}
          </p>
        </div>
      </div>
      <button
        type="button"
        aria-label="Refresh from Jira"
        :disabled="refreshing"
        class="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap self-start px-3 py-1.5 text-sm font-medium rounded-md border transition-colors sm:self-auto"
        :class="refreshing
          ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'
          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'"
        @click="handleRefresh"
      >
        <RefreshCw :size="14" :class="{ 'animate-spin': refreshing }" />
        {{ refreshing ? 'Refreshing...' : 'Refresh from Jira' }}
      </button>
    </div>

    <div
      v-if="refreshError"
      class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
      role="alert"
    >
      {{ refreshError }}
    </div>

    <div
      v-if="loading"
      class="flex justify-center items-center py-24"
      role="progressbar"
      aria-label="Loading CVE upstream component data"
      aria-busy="true"
    >
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
    </div>

    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-sm text-red-700 dark:text-red-300" role="alert">{{ error }}</p>
      <button type="button" class="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:no-underline" @click="handleRefresh">
        Try refreshing from Jira
      </button>
    </div>

    <div v-else-if="!data" class="text-center py-24">
      <ShieldAlert :size="48" class="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
      <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No CVE data yet</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Refresh from Jira to load CVE data.</p>
      <button
        type="button"
        :disabled="refreshing"
        class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm"
        @click="handleRefresh"
      >
        {{ refreshing ? 'Loading...' : 'Refresh from Jira' }}
      </button>
    </div>

    <div v-else-if="!metadataReady" class="rounded-lg border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-900/20">
      <h3 class="text-sm font-semibold text-amber-900 dark:text-amber-200">Upstream component details are not in this cache</h3>
      <p class="mt-1 text-sm text-amber-800 dark:text-amber-300">
        Refresh from Jira to load upstream component details. Older snapshots do not include upstream component or ecosystem metadata.
      </p>
      <button type="button" class="mt-3 text-sm font-medium underline hover:no-underline text-amber-900 dark:text-amber-200" @click="handleRefresh">
        Refresh from Jira to load upstream component details
      </button>
    </div>

    <div v-else class="space-y-6">
      <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5" aria-labelledby="ecosystem-overview-title">
        <div class="mb-4">
          <h3 id="ecosystem-overview-title" class="text-sm font-semibold text-gray-900 dark:text-gray-100">Open tickets by ecosystem</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            The chart includes all {{ totalOpen.toLocaleString() }} open tickets with an upstream component; ecosystem selection filters only the table.
          </p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-[minmax(180px,260px)_1fr] gap-6 items-center">
          <div v-if="totalOpen > 0" class="mx-auto w-full max-w-[260px]">
            <Doughnut :data="chartData" :options="chartOptions" />
          </div>
          <p v-else class="text-sm text-gray-500 dark:text-gray-400">No open tickets</p>
          <ul aria-label="Ecosystem distribution legend" class="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2 text-sm">
            <li v-for="(item, index) in ecosystemBreakdown" :key="item.ecosystem" class="flex items-center justify-between gap-3 text-gray-700 dark:text-gray-300">
              <span class="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: chartData.datasets[0].backgroundColor[index] }"></span>
                <span class="truncate">{{ item.ecosystem }}</span>
              </span>
              <span class="shrink-0 text-gray-500 dark:text-gray-400">{{ item.count.toLocaleString() }} {{ item.count === 1 ? 'ticket' : 'tickets' }} ({{ formatPercent(item.pct) }})</span>
            </li>
            <li v-if="ecosystemBreakdown.length === 0" class="text-gray-500 dark:text-gray-400">No open tickets</li>
          </ul>
        </div>
      </section>

      <p class="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-200">
        Jira phrase search is not exact equality: component links use Jira text search and may also match similarly named components.
      </p>

      <p v-if="multipleEcosystemCount > 0" class="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        {{ multipleEcosystemCount.toLocaleString() }} open {{ multipleEcosystemCount === 1 ? 'ticket belongs' : 'tickets belong' }} to components associated with multiple ecosystems. Each component appears once with all known ecosystems; the donut counts these tickets once as Multiple ecosystems.
      </p>

      <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" aria-labelledby="component-table-title">
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 id="component-table-title" class="text-sm font-semibold text-gray-900 dark:text-gray-100">Upstream component tickets</h3>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Grouped by upstream component across all release versions.</p>
          </div>
          <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span>Ecosystem</span>
            <select
              v-model="selectedEcosystem"
              aria-label="Filter component rows by ecosystem"
              class="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">All ecosystems</option>
              <option v-for="ecosystem in ecosystems" :key="ecosystem" :value="ecosystem">{{ ecosystem }}</option>
            </select>
          </label>
        </div>

        <div v-if="filteredRows.length === 0 && totalOpen > 0" class="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No named upstream components match this ecosystem.
        </div>
        <div v-else-if="totalOpen === 0" class="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No open CVE upstream components.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-800/80">
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th scope="col" class="text-left py-2.5 px-5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Upstream component</th>
                <th scope="col" class="text-left py-2.5 px-5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ecosystem</th>
                <th scope="col" class="text-right py-2.5 px-5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Open tickets</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in filteredRows" :key="row.component" class="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-700/30">
                <td class="py-2.5 px-5 font-medium text-primary-700 dark:text-primary-300">
                  <a :href="row.jiraUrl" target="_blank" rel="noopener noreferrer" :aria-label="`${row.component} (opens in a new tab)`" class="inline-flex max-w-full items-center gap-1 hover:underline">
                    <span class="break-all">{{ row.component }}</span>
                    <ExternalLink :size="12" class="shrink-0" aria-hidden="true" />
                  </a>
                </td>
                <td class="py-2.5 px-5 text-gray-700 dark:text-gray-300">{{ row.ecosystems.join(', ') }}</td>
                <td class="py-2.5 px-5 text-right tabular-nums text-gray-900 dark:text-gray-100">{{ row.count.toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { ArrowLeft, ExternalLink, RefreshCw, ShieldAlert } from 'lucide-vue-next'
import { Doughnut } from 'vue-chartjs'
import { useCveSustaining } from './composables/useCveSustaining.js'
import { useCveUpstreamComponents } from './composables/useCveUpstreamComponents.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const nav = inject('moduleNav')
const { data, loading, error, refreshError, refreshing, loadData, refresh, cleanup } = useCveSustaining()
const selectedEcosystem = ref('')
const {
  metadataReady,
  totalOpen,
  ecosystems,
  ecosystemBreakdown,
  filteredRows,
  multipleEcosystemCount
} = useCveUpstreamComponents(data, selectedEcosystem)

// Space hues across the entire distribution instead of cycling a fixed palette.
// The legend reads these same values, including Unknown and multi-ecosystem slices.
const chartColors = computed(() => ecosystemBreakdown.value.map((_, index, items) =>
  `hsl(${index * 360 / items.length}, 65%, 45%)`
))

const chartData = computed(() => ({
  labels: ecosystemBreakdown.value.map(item => item.ecosystem),
  datasets: [{
    label: 'Open tickets',
    data: ecosystemBreakdown.value.map(item => item.count),
    backgroundColor: chartColors.value,
    borderColor: '#ffffff',
    borderWidth: 2
  }]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label(context) {
          const item = ecosystemBreakdown.value[context.dataIndex]
          return item ? `${item.ecosystem}: ${item.count} tickets (${formatPercent(item.pct)})` : ''
        }
      }
    }
  }
}

watch(ecosystems, available => {
  if (selectedEcosystem.value && !available.includes(selectedEcosystem.value)) {
    selectedEcosystem.value = ''
  }
})

function formatPercent(value) {
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
}

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function goBack() {
  nav.navigateTo('reports')
}

async function handleRefresh() {
  await refresh()
}

onMounted(() => {
  loadData()
})

onUnmounted(() => {
  cleanup()
})
</script>
