<template>
  <div class="space-y-6">
    <div class="flex items-start gap-3">
      <div class="flex-1">
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">CVE Action Report</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">Component-owned open vulnerability work and review outcomes.</p>
      </div>
      <button
        class="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
        :class="refreshing
          ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-500'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'"
        :disabled="loading || refreshing"
        @click="handleRefresh"
      >
        <RefreshCw :size="14" :class="{ 'animate-spin': refreshing }" />
        {{ refreshing ? 'Refreshing...' : 'Refresh from Jira' }}
      </button>
    </div>

    <section class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <label for="cve-action-component" class="mr-3 text-sm font-medium text-gray-700 dark:text-gray-300">Jira component</label>
      <select id="cve-action-component" v-model="selected" :disabled="loading || !availableComponents.length"
        class="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-100">
        <option value="">Select a component</option>
        <option v-for="component in availableComponents" :key="component" :value="component">{{ component }}</option>
      </select>
    </section>

    <div v-if="loading" class="py-20 text-center text-sm text-gray-500">Loading CVE action report…</div>
    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" role="alert">{{ error }}</div>
    <div v-else-if="!selected" class="py-20 text-center text-sm text-gray-500">Choose a component to see its CVE action queue.</div>
    <div v-else-if="!data" class="py-20 text-center text-sm text-gray-500">No cached CVE report is available for this component.</div>
    <template v-else>
      <p class="text-xs text-gray-500 dark:text-gray-400">As of {{ data.asOfDate }} · Window ends {{ data.windowEndDate }} · Last refreshed {{ formatDate(data.lastRefreshed) }}</p>

      <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="All open vulnerabilities" :item="data.summary?.openVulnerabilities" />
        <SummaryCard label="SLA breached" :item="data.summary?.slaBreached" :emphasis="true" />
        <SummaryCard label="No SLA date" :item="data.summary?.noSlaDate" />
      </section>

      <section class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h3 class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Upcoming due dates until {{ data.windowEndDate }}</h3>
        <ul class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600 dark:text-gray-300" aria-label="Due date color legend">
          <li class="inline-flex items-center gap-1.5"><span aria-hidden="true" class="h-3 w-3 rounded-sm border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"></span>Past due</li>
          <li class="inline-flex items-center gap-1.5"><span aria-hidden="true" class="h-3 w-3 rounded-sm border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"></span>Due within 7 days</li>
        </ul>
        <div v-if="!data.timeline?.length" class="py-10 text-center text-sm text-gray-500">No selected-component issues have due dates through {{ data.windowEndDate }}.</div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-[900px] w-full text-left text-sm" :aria-label="`Upcoming due dates until ${data.windowEndDate}`">
            <thead><tr class="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700"><th class="p-2">Due date</th><th v-for="outcome in outcomes" :key="outcome.key" class="p-2">{{ outcome.label }}</th><th class="p-2">Total</th></tr></thead>
            <tbody><tr v-for="row in data.timeline" :key="row.dueDate" class="border-b border-gray-100 dark:border-gray-700/60" :class="{ 'bg-red-50 dark:bg-red-900/20': row.isPastDue, 'bg-amber-50 dark:bg-amber-900/20': !row.isPastDue && row.upcomingDueDate }"><th class="whitespace-nowrap p-2 font-medium text-gray-700 dark:text-gray-300">{{ row.dueDate }}</th><td v-for="outcome in outcomes" :key="outcome.key" class="p-2 align-top"><OutcomeCell :item="row.outcomes?.[outcome.key]" :label="outcome.label" /></td><td class="p-2 align-top"><TimelineTotalCell :item="row" /></td></tr></tbody>
          </table>
        </div>
      </section>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartSection title="Vulnerabilities created and closed weekly" :hasData="Boolean(data.createdWeekly?.length)"><Bar v-if="data.createdWeekly?.length" :data="weeklyChart" :options="weeklyChartOptions" /></ChartSection>
        <ChartSection title="Open action cohort age by outcome" :hasData="Boolean(data.openAgeBuckets?.length)"><Bar v-if="data.openAgeBuckets?.length" :data="ageChart" :options="ageChartOptions" /></ChartSection>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, h, inject, onMounted, ref, watch } from 'vue'
import { ExternalLink, RefreshCw } from 'lucide-vue-next'
import { Bar } from 'vue-chartjs'
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip, Legend } from 'chart.js'
import { useCveActionReport } from './composables/useCveActionReport.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)
const nav = inject('moduleNav', null)
const { data, availableComponents, selectedComponent, loading, error, refreshing, loadComponents, loadReport, refresh } = useCveActionReport()
const selected = ref('')
const outcomes = [
  { key: 'needs-action', label: 'Needs action' }, { key: 'not-found', label: 'Not found' },
  { key: 'needs-review', label: 'Needs review' }, { key: 'possibly-resolved', label: 'Possibly resolved' }
]
const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
const weeklyChartOptions = { ...chartOptions, plugins: { legend: { display: true, position: 'top' } } }
const ageOutcomes = [
  { key: 'needs-action', label: 'Needs action', color: '#2563eb' },
  { key: 'not-found', label: 'Not found', color: '#ef4444' },
  { key: 'needs-review', label: 'Needs review', color: '#f59e0b' },
  { key: 'possibly-resolved', label: 'Possibly resolved', color: '#10b981' }
]
const ageChartOptions = {
  ...chartOptions,
  plugins: { legend: { display: true, position: 'top' } },
  scales: {
    x: { stacked: true },
    y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
  }
}
const weeklyChart = computed(() => ({ labels: (data.value?.createdWeekly || []).map(x => x.label), datasets: [{ label: 'Created', data: (data.value?.createdWeekly || []).map(x => x.count), backgroundColor: '#3b82f6' }, { label: 'Closed', data: (data.value?.createdWeekly || []).map(x => x.closed || 0), backgroundColor: '#10b981' }] }))
const ageChart = computed(() => ({
  labels: (data.value?.openAgeBuckets || []).map(x => x.label),
  datasets: ageOutcomes.map(outcome => ({
    label: outcome.label,
    data: (data.value?.openAgeBuckets || []).map(bucket => bucket.outcomes?.[outcome.key] || 0),
    backgroundColor: outcome.color,
    stack: 'outcomes'
  }))
}))
function formatDate(value) { return value ? new Date(value).toLocaleString() : 'unknown' }
async function handleRefresh() { await refresh() }
onMounted(async () => { await loadComponents(nav?.params?.value?.component || ''); selected.value = selectedComponent.value })
watch(selected, value => { if (value) { nav?.updateParams?.({ component: value }); loadReport(value) } else { nav?.updateParams?.({ component: undefined }) } })

const SummaryCard = (props) => {
  const item = props.item || {}
  const emphasized = props.emphasis && item.count > 0
  const cardTone = emphasized
    ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
    : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
  const dividerTone = emphasized ? 'border-red-200 dark:border-red-800' : 'border-gray-200 dark:border-gray-700'
  const scoreLinks = (item.byCvss || []).map(score => h('a', {
    key: score.score,
    href: score.jql,
    target: '_blank',
    rel: 'noopener noreferrer',
    class: 'inline-flex items-center gap-0.5 font-semibold text-primary-600 underline decoration-primary-300 underline-offset-2 hover:text-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-primary-400 dark:hover:text-primary-200',
    'aria-label': `${props.label}, CVSS ${score.score}: ${score.count} issues`
  }, [`CVSS ${score.score}: ${score.count}`, h(ExternalLink, { size: 11, 'aria-hidden': 'true' })]))
  return h('section', { class: `rounded-lg border p-4 ${cardTone}` }, [
    h('div', { class: 'text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300' }, props.label),
    item.count ? h('a', { href: item.jql, target: '_blank', rel: 'noopener noreferrer', class: 'mt-1 inline-block text-3xl font-extrabold text-primary-700 underline decoration-primary-300 underline-offset-4 hover:text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-primary-300 dark:hover:text-primary-100', 'aria-label': `${props.label}: ${item.count} issues` }, String(item.count)) : h('div', { class: 'mt-1 text-3xl font-extrabold text-gray-900 dark:text-gray-100' }, '0'),
    scoreLinks.length ? h('div', { class: `mt-3 border-t pt-2 text-xs ${dividerTone}` }, [h('div', { class: 'mb-1 font-medium text-gray-600 dark:text-gray-300' }, 'By CVSS score'), h('div', { class: 'flex flex-wrap gap-x-3 gap-y-1' }, scoreLinks)]) : null
  ])
}
const OutcomeCell = (props) => props.item?.count ? h('div', { class: 'space-y-1' }, [h('a', { href: props.item.jql, target: '_blank', rel: 'noopener noreferrer', class: 'font-semibold text-primary-600 underline decoration-primary-300 underline-offset-2 hover:text-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-primary-400 dark:hover:text-primary-200', 'aria-label': `${props.label}: ${props.item.count} issues` }, String(props.item.count)), h('div', { class: 'flex flex-wrap gap-x-3 gap-y-1 text-xs' }, (props.item.byCvss || []).map(score => h('a', { key: score.score, href: score.jql, target: '_blank', rel: 'noopener noreferrer', class: 'inline-flex items-center gap-0.5 font-semibold text-primary-600 underline decoration-primary-300 underline-offset-2 hover:text-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-primary-400 dark:hover:text-primary-200', 'aria-label': `${props.label}, CVSS ${score.score}: ${score.count} issues` }, [`CVSS ${score.score}: ${score.count}`, h(ExternalLink, { size: 11, 'aria-hidden': 'true' })])))]) : h('span', { class: 'text-gray-300 dark:text-gray-600' }, '—')
const TimelineTotalCell = (props) => props.item?.total ? h('a', { href: props.item.total_jql, target: '_blank', rel: 'noopener noreferrer', class: 'font-bold text-primary-600 underline decoration-primary-300 underline-offset-2 hover:text-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:text-primary-400 dark:hover:text-primary-200', 'aria-label': `Total: ${props.item.total} issues` }, String(props.item.total)) : h('span', { class: 'text-gray-300 dark:text-gray-600' }, '—')
const ChartSection = (props, { slots }) => h('section', { class: 'rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4' }, [h('h3', { class: 'mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100' }, props.title), props.hasData ? h('div', { class: 'h-64' }, slots.default?.()) : h('p', { class: 'py-20 text-center text-sm text-gray-500' }, 'No data available for this period.')])
</script>
