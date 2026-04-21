<script setup>
import { ref, computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  Filler,
  Tooltip,
  Legend
} from 'chart.js'
import LoadingOverlay from '@shared/client/components/LoadingOverlay.vue'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, BarController, Filler, Tooltip, Legend)

const props = defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  autofixData: { type: Object, default: null },
  timeWindow: { type: String, default: 'month' }
})

const emit = defineEmits(['update:timeWindow', 'retry'])

const searchQuery = ref('')
const stateFilter = ref('all')
const selectedProject = ref('all')
const selectedIssueType = ref('all')
const selectedComponent = ref('all')

const jiraHost = computed(() => props.autofixData?.jiraHost || 'https://redhat.atlassian.net')
const isEmpty = computed(() => !props.autofixData?.fetchedAt)

const availableProjects = computed(() => {
  if (!props.autofixData?.issues) return []
  const projects = new Set()
  for (const issue of props.autofixData.issues) {
    const proj = issue.key.split('-')[0]
    if (proj) projects.add(proj)
  }
  return [...projects].sort()
})

const availableIssueTypes = computed(() => {
  if (!props.autofixData?.issues) return []
  const types = new Set()
  for (const issue of props.autofixData.issues) {
    if (issue.issueType && issue.issueType !== 'Unknown') types.add(issue.issueType)
  }
  return [...types].sort()
})

const availableComponents = computed(() => {
  if (!props.autofixData?.issues) return []
  const comps = new Set()
  for (const issue of props.autofixData.issues) {
    for (const c of (issue.components || [])) {
      comps.add(c)
    }
  }
  return [...comps].sort()
})

const projectFilteredIssues = computed(() => {
  if (!props.autofixData?.issues) return []
  let issues = props.autofixData.issues
  if (selectedProject.value !== 'all') {
    issues = issues.filter(i => i.key.startsWith(selectedProject.value + '-'))
  }
  if (selectedIssueType.value !== 'all') {
    issues = issues.filter(i => i.issueType === selectedIssueType.value)
  }
  if (selectedComponent.value !== 'all') {
    issues = issues.filter(i => (i.components || []).includes(selectedComponent.value))
  }
  return issues
})

const hasActiveFilter = computed(() =>
  selectedProject.value !== 'all' || selectedIssueType.value !== 'all' || selectedComponent.value !== 'all'
)

// Client-side metrics recomputation when filters are active.
// Mirrors computeAutofixMetrics() in autofix-fetcher.js (server).
// Uses startsWith('autofix-') for triageVerdicts.ready which includes
// autofix-needs-info — matches the server's enumerated list in practice
// since both count all autofix-* states as "passed triage."
const metrics = computed(() => {
  if (!props.autofixData?.metrics) return null
  if (!hasActiveFilter.value) return props.autofixData.metrics

  const issues = projectFilteredIssues.value
  const days = props.timeWindow === 'week' ? 7 : props.timeWindow === 'month' ? 30 : 90
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const windowIssues = issues.filter(i => new Date(i.created) >= cutoff)

  const triageTotal = windowIssues.filter(i =>
    i.pipelineState.startsWith('triage-') || i.pipelineState.startsWith('autofix-')
  ).length

  const triageVerdicts = {
    ready: windowIssues.filter(i => i.pipelineState.startsWith('autofix-')).length,
    needsInfo: windowIssues.filter(i => i.pipelineState === 'triage-needs-info').length,
    notFixable: windowIssues.filter(i => i.pipelineState === 'triage-not-fixable').length,
    stale: windowIssues.filter(i => i.pipelineState === 'triage-stale').length,
    pending: windowIssues.filter(i => i.pipelineState === 'triage-pending').length
  }

  const autofixStates = {
    ready: windowIssues.filter(i => i.pipelineState === 'autofix-ready').length,
    pending: windowIssues.filter(i => i.pipelineState === 'autofix-pending').length,
    review: windowIssues.filter(i => i.pipelineState === 'autofix-review').length,
    done: windowIssues.filter(i => i.pipelineState === 'autofix-done').length,
    needsInfo: windowIssues.filter(i => i.pipelineState === 'autofix-needs-info').length
  }

  const terminalTotal = autofixStates.done + autofixStates.needsInfo
  const successRate = terminalTotal > 0 ? Math.round((autofixStates.done / terminalTotal) * 100) : 0

  return { triageTotal, triageVerdicts, autofixStates, autofixTotal: triageVerdicts.ready, successRate, windowTotal: windowIssues.length, totalIssues: issues.length }
})

const trendData = computed(() => {
  if (!hasActiveFilter.value) return props.autofixData?.trendData || []

  const issues = projectFilteredIssues.value
  const weekCounts = props.timeWindow === 'week' ? 4 : props.timeWindow === 'month' ? 8 : 13
  const now = new Date()
  const points = []
  for (let w = weekCounts - 1; w >= 0; w--) {
    const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000)
    const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000)
    const weekIssues = issues.filter(i => { const d = new Date(i.created); return d >= weekStart && d < weekEnd })
    const triaged = weekIssues.filter(i => i.pipelineState.startsWith('triage-') || i.pipelineState.startsWith('autofix-')).length
    const autofixed = weekIssues.filter(i => i.pipelineState.startsWith('autofix-')).length
    const done = weekIssues.filter(i => i.pipelineState === 'autofix-done').length
    points.push({ date: weekEnd.toISOString().slice(0, 10), triaged, autofixed, done, total: weekIssues.length })
  }
  return points
})

const STATE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'triage-pending', label: 'AI Assessing' },
  { value: 'triage-needs-info', label: 'Needs Info' },
  { value: 'triage-not-fixable', label: 'Not AI-Fixable' },
  { value: 'triage-stale', label: 'Stale' },
  { value: 'autofix-ready', label: 'Queued for AI' },
  { value: 'autofix-pending', label: 'AI Working' },
  { value: 'autofix-review', label: 'AI Fix Under Review' },
  { value: 'autofix-done', label: 'AI Completed' },
  { value: 'autofix-needs-info', label: 'AI Blocked' }
]

const timeFilteredIssues = computed(() => {
  if (!projectFilteredIssues.value.length) return []
  const days = props.timeWindow === 'week' ? 7 : props.timeWindow === 'month' ? 30 : 90
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return projectFilteredIssues.value.filter(i => new Date(i.created) >= cutoff)
})

const filteredIssues = computed(() => {
  return timeFilteredIssues.value.filter(issue => {
    const matchesState = stateFilter.value === 'all' || issue.pipelineState === stateFilter.value
    const q = searchQuery.value.toLowerCase()
    const matchesSearch = !q ||
      issue.key.toLowerCase().includes(q) ||
      issue.summary.toLowerCase().includes(q) ||
      (issue.assignee && issue.assignee.toLowerCase().includes(q))
    return matchesState && matchesSearch
  })
})


// Trend status: compare current half vs previous half of the trend window
const trendStatus = computed(() => {
  if (!trendData.value.length || trendData.value.length < 2) return { label: 'New', icon: 'stable' }
  const mid = Math.floor(trendData.value.length / 2)
  const firstHalf = trendData.value.slice(0, mid)
  const secondHalf = trendData.value.slice(mid)
  const firstTotal = firstHalf.reduce((s, p) => s + p.triaged, 0)
  const firstDone = firstHalf.reduce((s, p) => s + p.done, 0)
  const secondTotal = secondHalf.reduce((s, p) => s + p.triaged, 0)
  const secondDone = secondHalf.reduce((s, p) => s + p.done, 0)
  const firstRate = firstTotal > 0 ? firstDone / firstTotal : 0
  const secondRate = secondTotal > 0 ? secondDone / secondTotal : 0
  const diff = secondRate - firstRate
  if (diff > 0.05) return { label: 'Growing', icon: 'up' }
  if (diff < -0.05) return { label: 'Declining', icon: 'down' }
  return { label: 'Stable', icon: 'stable' }
})

// Combo chart: eligibility rate (line) + completed count (bars)
const comboChartData = computed(() => ({
  labels: trendData.value.map(p => p.date),
  datasets: [
    {
      label: 'Eligible for Autofix',
      data: trendData.value.map(p => p.autofixed),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true,
      tension: 0.3,
      type: 'line',
      yAxisID: 'y',
      pointRadius: 3,
      borderWidth: 2
    },
    {
      label: 'Completed',
      data: trendData.value.map(p => p.done),
      backgroundColor: 'rgba(99, 102, 241, 0.5)',
      type: 'bar',
      yAxisID: 'y'
    }
  ]
}))

const comboChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top', labels: { font: { size: 11 } } }
  },
  scales: {
    x: { ticks: { font: { size: 10 }, maxRotation: 0 } },
    y: { beginAtZero: true, ticks: { font: { size: 10 }, precision: 0 }, title: { display: true, text: 'Issues (count)', font: { size: 11 } } }
  }
}

const totalFixesLanded = computed(() => {
  return trendData.value.reduce((s, p) => s + p.done, 0)
})

const hasTrendActivity = computed(() => {
  return trendData.value.some(p => p.triaged > 0)
})

function stateLabel(state) {
  const opt = STATE_OPTIONS.find(o => o.value === state)
  return opt ? opt.label : state
}

function stateColorClass(state) {
  if (state === 'autofix-done') return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
  if (state === 'autofix-review') return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
  if (state === 'autofix-pending' || state === 'autofix-ready') return 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400'
  if (state.includes('needs-info')) return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
  if (state === 'triage-not-fixable') return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
  if (state === 'triage-stale') return 'bg-gray-100 dark:bg-gray-600/20 text-gray-600 dark:text-gray-400'
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString()
}

const triageSegments = computed(() => {
  if (!metrics.value) return []
  const v = metrics.value.triageVerdicts
  return [
    { label: 'Ready for AI', count: v.ready || 0, color: 'bg-green-500', textClass: 'text-green-600 dark:text-green-400', jiraLabels: ['jira-autofix', 'jira-autofix-pending', 'jira-autofix-review', 'jira-autofix-done', 'jira-autofix-needs-info'] },
    { label: 'Needs Info', count: v.needsInfo || 0, color: 'bg-yellow-500', textClass: 'text-yellow-600 dark:text-yellow-400', jiraLabels: ['jira-triage-needs-info'] },
    { label: 'Not AI-Fixable', count: v.notFixable || 0, color: 'bg-red-500', textClass: 'text-red-600 dark:text-red-400', jiraLabels: ['jira-triage-not-fixable'] },
    { label: 'Stale', count: v.stale || 0, color: 'bg-gray-400', textClass: 'text-gray-500 dark:text-gray-400', jiraLabels: ['jira-triage-stale'] },
    { label: 'AI Assessing', count: v.pending || 0, color: 'bg-gray-300 dark:bg-gray-600', textClass: 'text-gray-500 dark:text-gray-400', jiraLabels: ['jira-triage-pending'] }
  ].filter(s => s.count > 0)
})

const triageSegmentTotal = computed(() => triageSegments.value.reduce((s, v) => s + v.count, 0))

const autofixSegments = computed(() => {
  if (!metrics.value) return []
  const a = metrics.value.autofixStates
  return [
    { label: 'AI Completed', count: a.done || 0, color: 'bg-green-500', textClass: 'text-green-600 dark:text-green-400', jiraLabels: ['jira-autofix-done'] },
    { label: 'AI Fix Under Review', count: a.review || 0, color: 'bg-blue-500', textClass: 'text-blue-600 dark:text-blue-400', jiraLabels: ['jira-autofix-review'] },
    { label: 'AI Working', count: a.pending || 0, color: 'bg-indigo-500', textClass: 'text-indigo-600 dark:text-indigo-400', jiraLabels: ['jira-autofix-pending'] },
    { label: 'Queued for AI', count: a.ready || 0, color: 'bg-gray-400', textClass: 'text-gray-500 dark:text-gray-400', jiraLabels: ['jira-autofix'] },
    { label: 'AI Blocked', count: a.needsInfo || 0, color: 'bg-yellow-500', textClass: 'text-yellow-600 dark:text-yellow-400', jiraLabels: ['jira-autofix-needs-info'] }
  ].filter(s => s.count > 0)
})

const autofixSegmentTotal = computed(() => autofixSegments.value.reduce((s, v) => s + v.count, 0))

function buildJiraLabelUrl(jiraLabels) {
  const host = jiraHost.value
  const labels = jiraLabels.map(l => `"${l}"`).join(', ')
  let jql = `labels IN (${labels})`
  if (selectedProject.value !== 'all') {
    jql += ` AND project = "${selectedProject.value}"`
  } else {
    const projects = availableProjects.value.map(p => `"${p}"`).join(', ')
    if (projects) jql += ` AND project IN (${projects})`
  }
  if (selectedIssueType.value !== 'all') {
    jql += ` AND issuetype = "${selectedIssueType.value}"`
  }
  if (selectedComponent.value !== 'all') {
    jql += ` AND component = "${selectedComponent.value}"`
  }
  const days = props.timeWindow === 'week' ? 7 : props.timeWindow === 'month' ? 30 : 90
  const windowCutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const earliestIssue = projectFilteredIssues.value.length > 0
    ? projectFilteredIssues.value.reduce((min, i) => i.created < min ? i.created : min, projectFilteredIssues.value[0].created)
    : null
  const dataCutoff = earliestIssue ? new Date(earliestIssue) : null
  const cutoff = dataCutoff && dataCutoff > windowCutoff ? dataCutoff : windowCutoff
  jql += ` AND created >= "${cutoff.toISOString().slice(0, 10)}"`
  jql += ' ORDER BY created DESC'
  return `${host}/issues/?jql=${encodeURIComponent(jql)}`
}
</script>

<template>
  <div class="flex-1 flex flex-col min-w-0">
    <!-- Top Bar -->
    <header class="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3 flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold dark:text-gray-100">
          Jira AutoFix
          <span class="relative group inline-flex align-middle ml-1">
            <svg class="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="absolute left-0 top-6 z-20 hidden group-hover:block w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 p-4 text-xs text-gray-700 dark:text-gray-300">
              <p class="font-semibold text-gray-900 dark:text-gray-100 mb-3">Pipeline Label Legend</p>
              <table class="w-full">
                <tbody>
                  <tr><td colspan="2" class="font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide text-[10px] pb-1 pt-0">Triage</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">AI Assessing</td><td class="text-gray-400 py-0.5">Bot is evaluating the ticket</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">Needs Info</td><td class="text-gray-400 py-0.5">Ticket incomplete, waiting on reporter</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">Not AI-Fixable</td><td class="text-gray-400 py-0.5">Not suitable for automated fixing</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">Stale</td><td class="text-gray-400 py-0.5">No response for 14+ days</td></tr>
                  <tr><td colspan="2" class="font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide text-[10px] pb-1 pt-3">Autofix</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">Queued for AI</td><td class="text-gray-400 py-0.5">Waiting for bot pickup</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">AI Working</td><td class="text-gray-400 py-0.5">Bot is generating a fix</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">AI Fix Under Review</td><td class="text-gray-400 py-0.5">MR/PR created, iterating on feedback</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">AI Completed</td><td class="text-gray-400 py-0.5">Bot finished (merged, rejected, or max retries)</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">AI Blocked</td><td class="text-gray-400 py-0.5">Bot stuck, needs human intervention</td></tr>
                </tbody>
              </table>
            </div>
          </span>
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          AI-driven issue triage and automated code fixes
          <span v-if="autofixData?.fetchedAt" class="ml-2 text-gray-400 dark:text-gray-500">&middot; {{ new Date(autofixData.fetchedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }} {{ new Date(autofixData.fetchedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) }}</span>
        </p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <select
          v-if="availableIssueTypes.length > 1"
          v-model="selectedIssueType"
          class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="all">All Types</option>
          <option v-for="t in availableIssueTypes" :key="t" :value="t">{{ t }}</option>
        </select>
        <select
          v-if="availableComponents.length > 1"
          v-model="selectedComponent"
          class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 max-w-[180px] truncate"
        >
          <option value="all">All Components</option>
          <option v-for="c in availableComponents" :key="c" :value="c">{{ c }}</option>
        </select>
        <select
          v-if="availableProjects.length > 1"
          v-model="selectedProject"
          class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="all">All Projects</option>
          <option v-for="proj in availableProjects" :key="proj" :value="proj">{{ proj }}</option>
        </select>
        <select
          :value="timeWindow"
          @change="emit('update:timeWindow', $event.target.value)"
          class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="3months">Last 3 Months</option>
        </select>
      </div>
    </header>

    <!-- Content -->
    <div class="flex-1 overflow-auto">
      <LoadingOverlay v-if="loading && !autofixData" />

      <div v-else-if="error" class="p-6">
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 class="text-red-800 dark:text-red-200 font-medium">Failed to load data</h3>
          <p class="text-red-600 dark:text-red-400 text-sm mt-1">{{ error }}</p>
          <button
            @click="emit('retry')"
            class="mt-3 px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
          >Retry</button>
        </div>
      </div>

      <div v-else-if="isEmpty" class="p-6 flex flex-col items-center justify-center h-full">
        <div class="text-center max-w-md">
          <div class="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">No autofix data yet</h3>
          <p class="text-gray-500 dark:text-gray-400 mt-1">
            An admin can trigger a data refresh from Settings &gt; AI Impact.
          </p>
        </div>
      </div>

      <template v-else>
        <!-- Summary Stats -->
        <div class="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center"
            :title="`Total issues with triage or autofix labels${selectedProject !== 'all' ? ' in ' + selectedProject : ''} (${metrics.totalIssues} issues)`"
          >
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ metrics.windowTotal }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">{{ selectedProject !== 'all' ? selectedProject + ' Issues' : 'Total Issues' }}</div>
            <div class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{{ metrics.totalIssues }} all time</div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center"
            :title="`Percentage of triaged bugs that qualified for autofix. ${metrics.triageVerdicts.ready || 0} out of ${metrics.triageTotal} triaged issues were deemed fixable by the AI triage bot.`"
          >
            <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {{ metrics.triageTotal > 0 ? Math.round((metrics.triageVerdicts.ready || 0) / metrics.triageTotal * 100) : 0 }}%
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">Eligibility Rate</div>
            <div class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{{ metrics.triageVerdicts.ready || 0 }} of {{ metrics.triageTotal }} triaged</div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center"
            :title="`Percentage of completed autofixes out of all terminal outcomes. Calculated as: AI Completed / (AI Completed + AI Blocked). In-progress issues are excluded. Note: AI Completed currently includes merged, rejected, and max-retries — accuracy improves once pipeline labels are split. ${metrics.autofixStates.done || 0} completed, ${metrics.autofixStates.needsInfo || 0} blocked.`"
          >
            <div class="text-2xl font-bold" :class="metrics.successRate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'">
              {{ metrics.successRate }}%
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">Success Rate</div>
            <div class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{{ metrics.autofixStates.done || 0 }} of {{ (metrics.autofixStates.done || 0) + (metrics.autofixStates.needsInfo || 0) }} resolved</div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center"
            :title="`Issues where the autofix bot has created an MR/PR and is iterating on review feedback and CI failures. ${metrics.autofixStates.review || 0} issues currently in review.`"
          >
            <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ metrics.autofixStates.review || 0 }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">In Review</div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center"
            :title="`Issues requiring human intervention. Includes tickets with incomplete information (missing info: ${metrics.triageVerdicts.needsInfo || 0}) and autofix attempts that hit a blocker (blocked: ${metrics.autofixStates.needsInfo || 0}).`"
          >
            <div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {{ (metrics.autofixStates.needsInfo || 0) + (metrics.triageVerdicts.needsInfo || 0) }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">Needs Attention</div>
            <div class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{{ metrics.triageVerdicts.needsInfo || 0 }} needs info · {{ metrics.autofixStates.needsInfo || 0 }} AI blocked</div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center"
            title="Trend compares autofix completion rate between the first and second half of the selected time window."
          >
            <div class="flex items-center justify-center gap-1.5">
              <svg v-if="trendStatus.icon === 'up'" class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              <svg v-else-if="trendStatus.icon === 'down'" class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" /></svg>
              <svg v-else class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14" /></svg>
              <span class="text-lg font-bold" :class="{
                'text-green-600 dark:text-green-400': trendStatus.icon === 'up',
                'text-red-600 dark:text-red-400': trendStatus.icon === 'down',
                'text-gray-500 dark:text-gray-400': trendStatus.icon === 'stable'
              }">{{ trendStatus.label }}</span>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">Trend Status</div>
          </div>
        </div>

        <!-- Status Snapshot + Adoption Trend (3-column) -->
        <div class="px-6 pb-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Triage Outcomes -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                Triage Outcomes
                <div class="relative group">
                  <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 top-6 z-20 hidden group-hover:block w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 p-3 text-xs text-gray-700 dark:text-gray-300">
                    <div class="space-y-1">
                      <div class="flex justify-between"><span class="font-medium">Ready for AI</span><span class="text-gray-400">Qualified for autofix</span></div>
                      <div class="flex justify-between"><span class="font-medium">Needs Info</span><span class="text-gray-400">Waiting on reporter</span></div>
                      <div class="flex justify-between"><span class="font-medium">Not AI-Fixable</span><span class="text-gray-400">Not suitable for AI</span></div>
                      <div class="flex justify-between"><span class="font-medium">Stale</span><span class="text-gray-400">No response 14+ days</span></div>
                      <div class="flex justify-between"><span class="font-medium">AI Assessing</span><span class="text-gray-400">Bot is evaluating</span></div>
                    </div>
                  </div>
                </div>
              </h3>
              <span class="text-xs text-gray-400 dark:text-gray-500">{{ triageSegmentTotal }} issues</span>
            </div>

            <!-- Stacked bar -->
            <div class="flex h-6 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 mb-4" v-if="triageSegmentTotal > 0">
              <div
                v-for="seg in triageSegments"
                :key="seg.label"
                class="transition-all duration-500"
                :class="seg.color"
                :style="{ width: (seg.count / triageSegmentTotal * 100) + '%' }"
                :title="`${seg.label}: ${seg.count}`"
              />
            </div>

            <!-- Legend rows -->
            <div class="space-y-2.5">
              <div v-for="seg in triageSegments" :key="seg.label" class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-sm shrink-0" :class="seg.color" />
                  <span class="text-sm text-gray-600 dark:text-gray-300">{{ seg.label }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <a
                    :href="buildJiraLabelUrl(seg.jiraLabels)"
                    target="_blank" rel="noopener"
                    class="text-sm font-semibold hover:underline"
                    :class="seg.textClass"
                  >{{ seg.count }}</a>
                  <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-right">{{ triageSegmentTotal > 0 ? Math.round(seg.count / triageSegmentTotal * 100) : 0 }}%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Autofix Progress -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                Autofix Progress
                <div class="relative group">
                  <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 top-6 z-20 hidden group-hover:block w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 p-3 text-xs text-gray-700 dark:text-gray-300">
                    <div class="space-y-1">
                      <div class="flex justify-between"><span class="font-medium">AI Completed</span><span class="text-gray-400">Bot finished</span></div>
                      <div class="flex justify-between"><span class="font-medium">AI Fix Under Review</span><span class="text-gray-400">MR/PR iterating</span></div>
                      <div class="flex justify-between"><span class="font-medium">AI Working</span><span class="text-gray-400">Generating fix</span></div>
                      <div class="flex justify-between"><span class="font-medium">Queued for AI</span><span class="text-gray-400">Waiting for bot</span></div>
                      <div class="flex justify-between"><span class="font-medium">AI Blocked</span><span class="text-gray-400">Needs human help</span></div>
                    </div>
                  </div>
                </div>
              </h3>
              <span class="text-xs text-gray-400 dark:text-gray-500">{{ autofixSegmentTotal }} issues</span>
            </div>

            <!-- Stacked bar -->
            <div class="flex h-6 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 mb-4" v-if="autofixSegmentTotal > 0">
              <div
                v-for="seg in autofixSegments"
                :key="seg.label"
                class="transition-all duration-500"
                :class="seg.color"
                :style="{ width: (seg.count / autofixSegmentTotal * 100) + '%' }"
                :title="`${seg.label}: ${seg.count}`"
              />
            </div>

            <!-- Legend rows -->
            <div class="space-y-2.5">
              <div v-for="seg in autofixSegments" :key="seg.label" class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-sm shrink-0" :class="seg.color" />
                  <span class="text-sm text-gray-600 dark:text-gray-300">{{ seg.label }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <a
                    :href="buildJiraLabelUrl(seg.jiraLabels)"
                    target="_blank" rel="noopener"
                    class="text-sm font-semibold hover:underline"
                    :class="seg.textClass"
                  >{{ seg.count }}</a>
                  <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-right">{{ autofixSegmentTotal > 0 ? Math.round(seg.count / autofixSegmentTotal * 100) : 0 }}%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Adoption Over Time -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5" v-if="trendData.length > 0">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Adoption Over Time</h3>
                <div class="relative group">
                  <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
                    Line shows the number of bugs that qualified for autofix each week. Bars show completed autofixes. The gap shows work still in progress.
                  </div>
                </div>
              </div>
              <div class="text-right">
                <span class="text-sm font-bold text-green-600 dark:text-green-400">{{ totalFixesLanded }}</span>
                <span class="text-[10px] text-gray-400 dark:text-gray-500 ml-0.5">landed</span>
              </div>
            </div>
            <div class="h-[180px]" v-if="hasTrendActivity">
              <Line :data="comboChartData" :options="comboChartOptions" />
            </div>
            <div v-else class="h-[180px] flex items-center justify-center">
              <p class="text-sm text-gray-400 dark:text-gray-500">No activity in this time period</p>
            </div>
          </div>
        </div>

        <!-- Issue Table -->
        <div class="px-6 pb-6">
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div class="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                Issues
                <div class="relative group">
                  <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 top-6 z-20 hidden group-hover:block w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 p-4 text-xs text-gray-700 dark:text-gray-300">
                    <p class="font-semibold text-gray-900 dark:text-gray-100 mb-2">State Labels</p>
                    <p class="font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide text-[10px]">Triage</p>
                    <div class="space-y-1 mb-3">
                      <div class="flex justify-between"><span>AI Assessing</span><span class="text-gray-400">Bot is evaluating</span></div>
                      <div class="flex justify-between"><span>Needs Info</span><span class="text-gray-400">Waiting on reporter</span></div>
                      <div class="flex justify-between"><span>Not AI-Fixable</span><span class="text-gray-400">Not suitable for AI</span></div>
                      <div class="flex justify-between"><span>Stale</span><span class="text-gray-400">No response 14+ days</span></div>
                    </div>
                    <p class="font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide text-[10px]">Autofix</p>
                    <div class="space-y-1">
                      <div class="flex justify-between"><span>Queued for AI</span><span class="text-gray-400">Waiting for bot</span></div>
                      <div class="flex justify-between"><span>AI Working</span><span class="text-gray-400">Generating fix</span></div>
                      <div class="flex justify-between"><span>AI Fix Under Review</span><span class="text-gray-400">MR/PR iterating</span></div>
                      <div class="flex justify-between"><span>AI Completed</span><span class="text-gray-400">Bot finished</span></div>
                      <div class="flex justify-between"><span>AI Blocked</span><span class="text-gray-400">Needs human help</span></div>
                    </div>
                  </div>
                </div>
              </h3>
              <div class="flex items-center gap-2">
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search issues..."
                  class="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 w-48"
                />
                <select
                  v-model="stateFilter"
                  class="border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300"
                >
                  <option v-for="opt in STATE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-200 dark:border-gray-700">
                    <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Key</th>
                    <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Summary</th>
                    <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">State</th>
                    <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Component</th>
                    <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="issue in filteredIssues"
                    :key="issue.key"
                    class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td class="px-5 py-2">
                      <a
                        :href="`${jiraHost}/browse/${issue.key}`"
                        target="_blank"
                        rel="noopener"
                        class="text-primary-600 dark:text-blue-400 font-mono text-xs hover:underline"
                      >{{ issue.key }}</a>
                    </td>
                    <td class="px-5 py-2 text-gray-900 dark:text-gray-100 max-w-xs truncate">{{ issue.summary }}</td>
                    <td class="px-5 py-2">
                      <span
                        class="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        :class="stateColorClass(issue.pipelineState)"
                      >{{ stateLabel(issue.pipelineState) }}</span>
                    </td>
                    <td class="px-5 py-2 text-gray-600 dark:text-gray-400 text-xs">
                      {{ issue.components.join(', ') || '—' }}
                    </td>
                    <td class="px-5 py-2 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{{ formatDate(issue.created) }}</td>
                  </tr>
                  <tr v-if="filteredIssues.length === 0">
                    <td colspan="5" class="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                      No issues found matching the current filters.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
