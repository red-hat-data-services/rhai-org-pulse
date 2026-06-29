<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Line, Bar } from 'vue-chartjs'
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

const isDark = ref(false)
let darkObserver = null
onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  darkObserver = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  document.addEventListener('click', handleClickOutside)
})
onBeforeUnmount(() => {
  if (darkObserver) darkObserver.disconnect()
  document.removeEventListener('click', handleClickOutside)
})

const textColor = computed(() => isDark.value ? 'rgba(209, 213, 219, 1)' : 'rgba(107, 114, 128, 1)')
const gridColor = computed(() => isDark.value ? 'rgba(75, 85, 99, 0.5)' : 'rgba(229, 231, 235, 1)')

const props = defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  autofixData: { type: Object, default: null },
  timeWindow: { type: String, default: 'month' }
})

const emit = defineEmits(['update:timeWindow', 'retry'])

const searchQuery = ref('')
const stateFilter = ref([])
const statusFilter = ref([])
const stateDropdownOpen = ref(false)
const stateDropdownRef = ref(null)
const statusDropdownOpen = ref(false)
const statusDropdownRef = ref(null)
const selectedProject = ref('all')
const selectedIssueType = ref('all')
const selectedComponent = ref('all')

const TERMINAL_STATES = new Set([
  'autofix-merged', 'autofix-rejected', 'autofix-max-retries'
])

function getLastWeekBounds() {
  const now = new Date()
  const day = now.getUTCDay()
  const diffToMonday = day === 0 ? 6 : day - 1
  const thisMonday = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday
  ))
  const lastMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000)
  return { start: lastMonday.getTime(), end: thisMonday.getTime() }
}

function issueTimestamp(issue, isLastWeek) {
  if (isLastWeek && TERMINAL_STATES.has(issue.pipelineState) && issue.terminalAt) {
    return new Date(issue.terminalAt).getTime()
  }
  return new Date(issue.created).getTime()
}

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function formatUTCShortDate(d) {
  return SHORT_MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate()
}

const windowDateRange = computed(() => {
  if (props.timeWindow === 'lastWeek') {
    const { start, end } = getLastWeekBounds()
    const s = new Date(start)
    const e = new Date(end - 86400000)
    return 'Mon ' + formatUTCShortDate(s) + ' – Sun ' + formatUTCShortDate(e)
  }
  const days = props.timeWindow === 'week' ? 7 : props.timeWindow === 'month' ? 30 : 90
  const endDate = new Date()
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return formatUTCShortDate(startDate) + ' – ' + formatUTCShortDate(endDate)
})

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

const availableStatuses = computed(() => {
  if (!props.autofixData?.issues) return []
  const statuses = new Set()
  for (const issue of props.autofixData.issues) {
    if (issue.status && issue.status !== 'Unknown') statuses.add(issue.status)
  }
  return [...statuses].sort()
})

const stateFilterLabel = computed(() => {
  if (stateFilter.value.length === 0) return 'All States'
  if (stateFilter.value.length === 1) {
    const opt = stateFilterOptions.find(o => o.value === stateFilter.value[0])
    return opt ? opt.label : stateFilter.value[0]
  }
  return `${stateFilter.value.length} states`
})

const statusFilterLabel = computed(() => {
  if (statusFilter.value.length === 0) return 'All Statuses'
  if (statusFilter.value.length === 1) return statusFilter.value[0]
  return `${statusFilter.value.length} statuses`
})

function toggleStateFilter(value) {
  const idx = stateFilter.value.indexOf(value)
  if (idx >= 0) {
    stateFilter.value = stateFilter.value.filter(v => v !== value)
  } else {
    stateFilter.value = [...stateFilter.value, value]
  }
}

function toggleStatusFilter(value) {
  const idx = statusFilter.value.indexOf(value)
  if (idx >= 0) {
    statusFilter.value = statusFilter.value.filter(v => v !== value)
  } else {
    statusFilter.value = [...statusFilter.value, value]
  }
}

function handleClickOutside(e) {
  if (stateDropdownRef.value && !stateDropdownRef.value.contains(e.target)) {
    stateDropdownOpen.value = false
  }
  if (statusDropdownRef.value && !statusDropdownRef.value.contains(e.target)) {
    statusDropdownOpen.value = false
  }
}

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
const metrics = computed(() => {
  if (!props.autofixData?.metrics) return null
  if (!hasActiveFilter.value) return props.autofixData.metrics

  const issues = projectFilteredIssues.value
  const isLastWeek = props.timeWindow === 'lastWeek'
  let windowStart, windowEnd

  if (isLastWeek) {
    const bounds = getLastWeekBounds()
    windowStart = bounds.start
    windowEnd = bounds.end
  } else {
    const days = props.timeWindow === 'week' ? 7 : props.timeWindow === 'month' ? 30 : 90
    windowEnd = Date.now()
    windowStart = windowEnd - days * 24 * 60 * 60 * 1000
  }

  const windowIssues = issues.filter(i => {
    const ts = issueTimestamp(i, isLastWeek)
    return ts >= windowStart && ts < windowEnd
  })

  const triageTotal = windowIssues.filter(i =>
    i.pipelineState.startsWith('triage-') || i.pipelineState.startsWith('autofix-')
  ).length

  const triageVerdicts = {
    ready: windowIssues.filter(i => i.pipelineState === 'autofix-ready').length,
    missingInfo: windowIssues.filter(i => i.pipelineState === 'triage-missing-info').length,
    notFixable: windowIssues.filter(i => i.pipelineState === 'triage-not-fixable').length,
    stale: windowIssues.filter(i => i.pipelineState === 'triage-stale').length,
    pending: windowIssues.filter(i => i.pipelineState === 'triage-pending').length,
    external: windowIssues.filter(i => i.pipelineState === 'triage-external').length,
    securityReview: windowIssues.filter(i => i.pipelineState === 'triage-security-review').length
  }

  const autofixStates = {
    ready: windowIssues.filter(i => i.pipelineState === 'autofix-ready').length,
    pending: windowIssues.filter(i => i.pipelineState === 'autofix-pending').length,
    review: windowIssues.filter(i => i.pipelineState === 'autofix-review').length,
    ciFailing: windowIssues.filter(i => i.pipelineState === 'autofix-ci-failing').length,
    merged: windowIssues.filter(i => i.pipelineState === 'autofix-merged').length,
    rejected: windowIssues.filter(i => i.pipelineState === 'autofix-rejected').length,
    maxRetries: windowIssues.filter(i => i.pipelineState === 'autofix-max-retries').length,
    blocked: windowIssues.filter(i => i.pipelineState === 'autofix-blocked').length
  }

  const terminalTotal = autofixStates.merged + autofixStates.rejected + autofixStates.maxRetries
  const successRate = terminalTotal > 0 ? Math.round((autofixStates.merged / terminalTotal) * 100) : 0

  return { triageTotal, triageVerdicts, autofixStates, autofixTotal: triageVerdicts.ready, successRate, windowTotal: windowIssues.length, totalIssues: issues.length }
})

const trendData = computed(() => {
  if (!hasActiveFilter.value) return props.autofixData?.trendData || []

  const issues = projectFilteredIssues.value
  const isLW = props.timeWindow === 'lastWeek'
  const weekCounts = (props.timeWindow === 'week' || isLW) ? 4 : props.timeWindow === 'month' ? 8 : 13
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000
  let anchor
  if (isLW) {
    const { end: thisMonday } = getLastWeekBounds()
    anchor = thisMonday
  } else {
    anchor = Date.now()
  }
  const points = []
  for (let w = weekCounts - 1; w >= 0; w--) {
    const weekEnd = new Date(anchor - w * MS_PER_WEEK)
    const weekStart = new Date(weekEnd.getTime() - MS_PER_WEEK)
    const weekIssues = issues.filter(i => {
      const ts = issueTimestamp(i, isLW)
      return ts >= weekStart.getTime() && ts < weekEnd.getTime()
    })
    const triaged = weekIssues.filter(i => i.pipelineState.startsWith('triage-') || i.pipelineState.startsWith('autofix-')).length
    const autofixed = weekIssues.filter(i => i.pipelineState.startsWith('autofix-')).length
    const merged = weekIssues.filter(i => i.pipelineState === 'autofix-merged').length
    const review = weekIssues.filter(i => i.pipelineState === 'autofix-review').length
    const ciFailing = weekIssues.filter(i => i.pipelineState === 'autofix-ci-failing').length
    const blocked = weekIssues.filter(i => i.pipelineState === 'autofix-blocked').length
    const maxRetries = weekIssues.filter(i => i.pipelineState === 'autofix-max-retries').length
    const missingInfo = weekIssues.filter(i => i.pipelineState === 'triage-missing-info').length
    const stale = weekIssues.filter(i => i.pipelineState === 'triage-stale').length
    const external = weekIssues.filter(i => i.pipelineState === 'triage-external').length
    const securityReview = weekIssues.filter(i => i.pipelineState === 'triage-security-review').length
    points.push({
      date: weekEnd.toISOString().slice(0, 10), triaged, autofixed, merged, total: weekIssues.length,
      review, ciFailing, blocked, maxRetries, missingInfo, stale, external, securityReview
    })
  }
  return points
})

const STATE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'triage-pending', label: 'AI Assessing' },
  { value: 'triage-missing-info', label: 'Missing Info' },
  { value: 'triage-not-fixable', label: 'Not AI-Fixable' },
  { value: 'triage-stale', label: 'Stale' },
  { value: 'triage-external', label: 'External Reporter' },
  { value: 'triage-security-review', label: 'Security Review' },
  { value: 'autofix-ready', label: 'Queued for AI' },
  { value: 'autofix-pending', label: 'AI Working' },
  { value: 'autofix-review', label: 'AI Fix Under Review' },
  { value: 'autofix-ci-failing', label: 'AI Fix CI Failing' },
  { value: 'autofix-merged', label: 'AI Fix Merged' },
  { value: 'autofix-rejected', label: 'AI Fix Rejected' },
  { value: 'autofix-max-retries', label: 'AI Max Retries' },
  { value: 'autofix-blocked', label: 'AI Blocked' }
]

const stateFilterOptions = STATE_OPTIONS.filter(o => o.value !== 'all')

const timeFilteredIssues = computed(() => {
  if (!projectFilteredIssues.value.length) return []
  const isLastWeek = props.timeWindow === 'lastWeek'
  let windowStart, windowEnd

  if (isLastWeek) {
    const bounds = getLastWeekBounds()
    windowStart = bounds.start
    windowEnd = bounds.end
  } else {
    const days = props.timeWindow === 'week' ? 7 : props.timeWindow === 'month' ? 30 : 90
    windowEnd = Date.now()
    windowStart = windowEnd - days * 24 * 60 * 60 * 1000
  }

  return projectFilteredIssues.value.filter(i => {
    const ts = issueTimestamp(i, isLastWeek)
    return ts >= windowStart && ts < windowEnd
  })
})

const filteredIssues = computed(() => {
  return timeFilteredIssues.value.filter(issue => {
    const matchesState = stateFilter.value.length === 0 || stateFilter.value.includes(issue.pipelineState)
    const matchesStatus = statusFilter.value.length === 0 || statusFilter.value.includes(issue.status)
    const q = searchQuery.value.toLowerCase()
    const matchesSearch = !q ||
      issue.key.toLowerCase().includes(q) ||
      issue.summary.toLowerCase().includes(q) ||
      (issue.assignee && issue.assignee.toLowerCase().includes(q))
    return matchesState && matchesStatus && matchesSearch
  })
})


// Trend status: compare current half vs previous half of the trend window
const trendStatus = computed(() => {
  if (!trendData.value.length || trendData.value.length < 2) return { label: 'New', icon: 'stable' }
  const mid = Math.floor(trendData.value.length / 2)
  const firstHalf = trendData.value.slice(0, mid)
  const secondHalf = trendData.value.slice(mid)
  const firstTotal = firstHalf.reduce((s, p) => s + p.triaged, 0)
  const firstDone = firstHalf.reduce((s, p) => s + p.merged, 0)
  const secondTotal = secondHalf.reduce((s, p) => s + p.triaged, 0)
  const secondDone = secondHalf.reduce((s, p) => s + p.merged, 0)
  const firstRate = firstTotal > 0 ? firstDone / firstTotal : 0
  const secondRate = secondTotal > 0 ? secondDone / secondTotal : 0
  const diff = secondRate - firstRate
  if (diff > 0.05) return { label: 'Growing', icon: 'up' }
  if (diff < -0.05) return { label: 'Declining', icon: 'down' }
  return { label: 'Stable', icon: 'stable' }
})

const totalFixesLanded = computed(() => {
  return trendData.value.reduce((s, p) => s + p.merged, 0)
})

const hasTrendActivity = computed(() => {
  return trendData.value.some(p => p.triaged > 0)
})

const funnelChartData = computed(() => ({
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
      label: 'Under Review',
      data: trendData.value.map(p => p.review || 0),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.3,
      type: 'line',
      yAxisID: 'y',
      pointRadius: 3,
      borderWidth: 2
    },
    {
      label: 'Merged',
      data: trendData.value.map(p => p.merged),
      backgroundColor: 'rgba(99, 102, 241, 0.5)',
      type: 'bar',
      yAxisID: 'y'
    }
  ]
}))

const funnelChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top', labels: { font: { size: 11 }, color: textColor.value } }
  },
  scales: {
    x: { ticks: { font: { size: 10 }, color: textColor.value, maxRotation: 0 }, grid: { color: gridColor.value } },
    y: { beginAtZero: true, ticks: { font: { size: 10 }, color: textColor.value, precision: 0 }, title: { display: true, text: 'Issues (count)', font: { size: 11 }, color: textColor.value }, grid: { color: gridColor.value } }
  }
}))

const waitingChartData = computed(() => ({
  labels: trendData.value.map(p => p.date),
  datasets: [
    { label: 'Under Review', data: trendData.value.map(p => p.review || 0), backgroundColor: 'rgba(59, 130, 246, 0.6)' },
    { label: 'CI Failing', data: trendData.value.map(p => p.ciFailing || 0), backgroundColor: 'rgba(249, 115, 22, 0.6)' },
    { label: 'Blocked', data: trendData.value.map(p => p.blocked || 0), backgroundColor: 'rgba(234, 179, 8, 0.6)' },
    { label: 'Max Retries', data: trendData.value.map(p => p.maxRetries || 0), backgroundColor: 'rgba(239, 68, 68, 0.6)' }
  ]
}))

const waitingChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top', labels: { font: { size: 10 }, color: textColor.value } }
  },
  scales: {
    x: { stacked: true, ticks: { font: { size: 10 }, color: textColor.value, maxRotation: 0 }, grid: { color: gridColor.value } },
    y: { stacked: true, beginAtZero: true, ticks: { font: { size: 10 }, color: textColor.value, precision: 0 }, title: { display: true, text: 'Issues waiting', font: { size: 11 }, color: textColor.value }, grid: { color: gridColor.value } }
  }
}))

const triageWaitingData = computed(() => ({
  labels: trendData.value.map(p => p.date),
  datasets: [
    { label: 'Missing Info', data: trendData.value.map(p => p.missingInfo || 0), backgroundColor: 'rgba(245, 158, 11, 0.6)' },
    { label: 'External Reporter', data: trendData.value.map(p => p.external || 0), backgroundColor: 'rgba(168, 85, 247, 0.6)' },
    { label: 'Security Review', data: trendData.value.map(p => p.securityReview || 0), backgroundColor: 'rgba(244, 63, 94, 0.6)' },
    { label: 'Stale', data: trendData.value.map(p => p.stale || 0), backgroundColor: 'rgba(156, 163, 175, 0.6)' }
  ]
}))

const triageWaitingOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: 'top', labels: { font: { size: 10 }, color: textColor.value } }
  },
  scales: {
    x: { stacked: true, ticks: { font: { size: 10 }, color: textColor.value, maxRotation: 0 }, grid: { color: gridColor.value } },
    y: { stacked: true, beginAtZero: true, ticks: { font: { size: 10 }, color: textColor.value, precision: 0 }, title: { display: true, text: 'Issues waiting', font: { size: 11 }, color: textColor.value }, grid: { color: gridColor.value } }
  }
}))

function stateLabel(state) {
  const opt = STATE_OPTIONS.find(o => o.value === state)
  return opt ? opt.label : state
}

function stateColorClass(state) {
  if (state === 'autofix-merged') return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400'
  if (state === 'autofix-review') return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400'
  if (state === 'autofix-ci-failing') return 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'
  if (state === 'autofix-pending' || state === 'autofix-ready') return 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400'
  if (state === 'autofix-rejected') return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
  if (state === 'autofix-max-retries') return 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'
  if (state === 'autofix-blocked' || state === 'triage-missing-info') return 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
  if (state === 'triage-not-fixable') return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'
  if (state === 'triage-stale') return 'bg-gray-100 dark:bg-gray-600/20 text-gray-600 dark:text-gray-400'
  if (state === 'triage-external') return 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400'
  if (state === 'triage-security-review') return 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400'
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
    { label: 'Ready for AI', count: v.ready || 0, color: 'bg-green-500', textClass: 'text-green-600 dark:text-green-400', jiraLabels: ['jira-autofix'], excludeLabels: ['jira-autofix-pending', 'jira-autofix-review', 'jira-autofix-ci-failing', 'jira-autofix-merged', 'jira-autofix-rejected', 'jira-autofix-max-retries', 'jira-autofix-researched', 'jira-autofix-blocked'] },
    { label: 'Missing Info', count: v.missingInfo || 0, color: 'bg-yellow-500', textClass: 'text-yellow-600 dark:text-yellow-400', jiraLabels: ['jira-triage-missing-info'] },
    { label: 'Not AI-Fixable', count: v.notFixable || 0, color: 'bg-red-500', textClass: 'text-red-600 dark:text-red-400', jiraLabels: ['jira-triage-not-fixable'] },
    { label: 'External Reporter', count: v.external || 0, color: 'bg-purple-500', textClass: 'text-purple-600 dark:text-purple-400', jiraLabels: ['jira-triage-external'] },
    { label: 'Security Review', count: v.securityReview || 0, color: 'bg-rose-500', textClass: 'text-rose-600 dark:text-rose-400', jiraLabels: ['jira-triage-security-review'] },
    { label: 'Stale', count: v.stale || 0, color: 'bg-gray-400', textClass: 'text-gray-500 dark:text-gray-400', jiraLabels: ['jira-triage-stale'] },
    { label: 'AI Assessing', count: v.pending || 0, color: 'bg-gray-300 dark:bg-gray-600', textClass: 'text-gray-500 dark:text-gray-400', jiraLabels: ['jira-triage-pending'] }
  ].filter(s => s.count > 0)
})

const triageSegmentTotal = computed(() => triageSegments.value.reduce((s, v) => s + v.count, 0))

const autofixSegments = computed(() => {
  if (!metrics.value) return []
  const a = metrics.value.autofixStates
  return [
    { label: 'AI Fix Merged', count: a.merged || 0, color: 'bg-green-500', textClass: 'text-green-600 dark:text-green-400', jiraLabels: ['jira-autofix-merged'] },
    { label: 'AI Fix Under Review', count: a.review || 0, color: 'bg-blue-500', textClass: 'text-blue-600 dark:text-blue-400', jiraLabels: ['jira-autofix-review'] },
    { label: 'AI Fix CI Failing', count: a.ciFailing || 0, color: 'bg-orange-500', textClass: 'text-orange-600 dark:text-orange-400', jiraLabels: ['jira-autofix-ci-failing'] },
    { label: 'AI Working', count: a.pending || 0, color: 'bg-indigo-500', textClass: 'text-indigo-600 dark:text-indigo-400', jiraLabels: ['jira-autofix-pending'], excludeLabels: ['jira-autofix-blocked', 'jira-autofix-ci-failing', 'jira-autofix-review', 'jira-autofix-merged', 'jira-autofix-rejected', 'jira-autofix-max-retries'] },
    { label: 'Queued for AI', count: a.ready || 0, color: 'bg-gray-400', textClass: 'text-gray-500 dark:text-gray-400', jiraLabels: ['jira-autofix'], excludeLabels: ['jira-autofix-pending', 'jira-autofix-review', 'jira-autofix-ci-failing', 'jira-autofix-merged', 'jira-autofix-rejected', 'jira-autofix-max-retries', 'jira-autofix-blocked'] },
    { label: 'AI Fix Rejected', count: a.rejected || 0, color: 'bg-red-500', textClass: 'text-red-600 dark:text-red-400', jiraLabels: ['jira-autofix-rejected'] },
    { label: 'AI Max Retries', count: a.maxRetries || 0, color: 'bg-orange-500', textClass: 'text-orange-600 dark:text-orange-400', jiraLabels: ['jira-autofix-max-retries'] },
    { label: 'AI Blocked', count: a.blocked || 0, color: 'bg-yellow-500', textClass: 'text-yellow-600 dark:text-yellow-400', jiraLabels: ['jira-autofix-blocked'] }
  ].filter(s => s.count > 0)
})

const autofixSegmentTotal = computed(() => autofixSegments.value.reduce((s, v) => s + v.count, 0))

function buildJiraLabelUrl(jiraLabels, excludeLabels) {
  const host = jiraHost.value

  if (props.timeWindow === 'lastWeek') {
    const isTerminalLabel = jiraLabels.some(l =>
      l === 'jira-autofix-merged' || l === 'jira-autofix-rejected' ||
      l === 'jira-autofix-max-retries'
    )
    if (isTerminalLabel) {
      const matchingStates = new Set()
      for (const l of jiraLabels) {
        const state = l.replace('jira-', '')
        if (TERMINAL_STATES.has(state)) matchingStates.add(state)
      }
      const keys = timeFilteredIssues.value
        .filter(i => matchingStates.has(i.pipelineState))
        .map(i => i.key)
      if (keys.length > 0) {
        const jql = `key IN (${keys.map(k => `"${k}"`).join(', ')}) ORDER BY updated DESC`
        return `${host}/issues/?jql=${encodeURIComponent(jql)}`
      }
    }
  }

  const labels = jiraLabels.map(l => `"${l}"`).join(', ')
  let jql = `labels IN (${labels})`
  if (excludeLabels && excludeLabels.length > 0) {
    const excluded = excludeLabels.map(l => `"${l}"`).join(', ')
    jql += ` AND labels NOT IN (${excluded})`
  }
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
  jql += ' AND (component is EMPTY OR component != "Enclave")'
  if (props.timeWindow === 'lastWeek') {
    const { start, end } = getLastWeekBounds()
    jql += ` AND created >= "${new Date(start).toISOString().slice(0, 10)}"`
    jql += ` AND created < "${new Date(end).toISOString().slice(0, 10)}"`
    jql += ' ORDER BY created DESC'
  } else {
    const days = props.timeWindow === 'week' ? 7 : props.timeWindow === 'month' ? 30 : 90
    const windowCutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const earliestIssue = projectFilteredIssues.value.length > 0
      ? projectFilteredIssues.value.reduce((min, i) => i.created < min ? i.created : min, projectFilteredIssues.value[0].created)
      : null
    const dataCutoff = earliestIssue ? new Date(earliestIssue) : null
    const cutoff = dataCutoff && dataCutoff > windowCutoff ? dataCutoff : windowCutoff
    jql += ` AND created >= "${cutoff.toISOString().slice(0, 10)}"`
    jql += ' ORDER BY created DESC'
  }
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
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">Missing Info</td><td class="text-gray-400 py-0.5">Ticket incomplete, waiting on reporter</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">Not AI-Fixable</td><td class="text-gray-400 py-0.5">Not suitable for automated fixing</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">External Reporter</td><td class="text-gray-400 py-0.5">Non-RH reporter, needs RH engineer approval</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">Security Review</td><td class="text-gray-400 py-0.5">Flagged as security-sensitive, needs human review</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">Stale</td><td class="text-gray-400 py-0.5">No response for 14+ days</td></tr>
                  <tr><td colspan="2" class="font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide text-[10px] pb-1 pt-3">Autofix</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">Queued for AI</td><td class="text-gray-400 py-0.5">Waiting for bot pickup</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">AI Working</td><td class="text-gray-400 py-0.5">Bot is generating a fix</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">AI Fix Under Review</td><td class="text-gray-400 py-0.5">MR/PR created, human reviewing</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">AI Fix CI Failing</td><td class="text-gray-400 py-0.5">MR/PR exists, CI is red</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">AI Fix Merged</td><td class="text-gray-400 py-0.5">Fix landed successfully</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">AI Fix Rejected</td><td class="text-gray-400 py-0.5">MR/PR closed without merge</td></tr>
                  <tr><td class="font-medium pr-4 py-0.5 whitespace-nowrap">AI Max Retries</td><td class="text-gray-400 py-0.5">Bot hit iteration limit, needs human</td></tr>
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
          <option value="lastWeek">Last Week</option>
          <option value="month">This Month</option>
          <option value="3months">Last 3 Months</option>
        </select>
      </div>
    </header>

    <!-- Date range banner -->
    <div class="bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/30 px-6 py-2 text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
      <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
      <span>{{ windowDateRange }}</span>
    </div>

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
          <div class="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div class="absolute top-2 right-2 group">
              <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="absolute right-0 top-6 z-20 hidden group-hover:block w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 p-3 text-xs text-gray-700 dark:text-gray-300 text-left">
                Count of all Jira issues carrying triage or autofix pipeline labels{{ selectedProject !== 'all' ? ' in ' + selectedProject : '' }}, created within the selected time window.
              </div>
            </div>
            <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ metrics.windowTotal }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">{{ selectedProject !== 'all' ? selectedProject + ' Issues' : 'Total Issues' }}</div>
            <div v-if="metrics.totalIssues !== metrics.windowTotal" class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{{ metrics.totalIssues }} all time</div>
          </div>
          <div class="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div class="absolute top-2 right-2 group">
              <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="absolute right-0 top-6 z-20 hidden group-hover:block w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 p-3 text-xs text-gray-700 dark:text-gray-300 text-left">
                Percentage of triaged issues that qualified for autofix. Calculated as: <span class="font-medium">eligible ÷ total triaged × 100</span>. The AI triage bot evaluates each issue and labels it as fixable or not.
              </div>
            </div>
            <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {{ metrics.triageTotal > 0 ? Math.round((metrics.triageVerdicts.ready || 0) / metrics.triageTotal * 100) : 0 }}%
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">Eligibility Rate</div>
            <div class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{{ metrics.triageVerdicts.ready || 0 }} of {{ metrics.triageTotal }} triaged</div>
          </div>
          <div class="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div class="absolute top-2 right-2 group">
              <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="absolute right-0 top-6 z-20 hidden group-hover:block w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 p-3 text-xs text-gray-700 dark:text-gray-300 text-left">
                Percentage of successfully merged autofixes out of all terminal outcomes. Calculated as: <span class="font-medium">merged ÷ (merged + rejected + max-retries) × 100</span>. In-progress issues are excluded since they haven't reached a final outcome.
              </div>
            </div>
            <div class="text-2xl font-bold" :class="metrics.successRate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'">
              {{ metrics.successRate }}%
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">Success Rate</div>
            <div class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{{ metrics.autofixStates.merged || 0 }} of {{ (metrics.autofixStates.merged || 0) + (metrics.autofixStates.rejected || 0) + (metrics.autofixStates.maxRetries || 0) }} resolved</div>
          </div>
          <div class="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div class="absolute top-2 right-2 group">
              <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="absolute right-0 top-6 z-20 hidden group-hover:block w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 p-3 text-xs text-gray-700 dark:text-gray-300 text-left">
                Issues where the autofix bot has created an MR/PR and is actively iterating on review feedback and CI failures.
              </div>
            </div>
            <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ metrics.autofixStates.review || 0 }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">In Review</div>
          </div>
          <div class="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div class="absolute top-2 right-2 group">
              <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="absolute right-0 top-6 z-20 hidden group-hover:block w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 p-3 text-xs text-gray-700 dark:text-gray-300 text-left">
                Issues where human action can help unblock progress. Includes:
                <div class="mt-1.5 space-y-0.5">
                  <div><span class="font-medium">Triage:</span> missing info, external reporter, security review, stale</div>
                  <div><span class="font-medium">Autofix:</span> CI failing, blocked, max retries exhausted</div>
                </div>
              </div>
            </div>
            <div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {{ (metrics.triageVerdicts.missingInfo || 0) + (metrics.triageVerdicts.stale || 0) + (metrics.triageVerdicts.external || 0) + (metrics.triageVerdicts.securityReview || 0) + (metrics.autofixStates.ciFailing || 0) + (metrics.autofixStates.blocked || 0) + (metrics.autofixStates.maxRetries || 0) }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-wide">Needs Attention</div>
            <div class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{{ (metrics.triageVerdicts.missingInfo || 0) + (metrics.triageVerdicts.stale || 0) + (metrics.triageVerdicts.external || 0) + (metrics.triageVerdicts.securityReview || 0) }} triage · {{ (metrics.autofixStates.ciFailing || 0) + (metrics.autofixStates.blocked || 0) + (metrics.autofixStates.maxRetries || 0) }} autofix</div>
          </div>
          <div class="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
            <div class="absolute top-2 right-2 group">
              <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="absolute right-0 top-6 z-20 hidden group-hover:block w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50 p-3 text-xs text-gray-700 dark:text-gray-300 text-left">
                Compares the <span class="font-medium">merged ÷ triaged</span> rate between the first and second half of the time window. Growing (&gt;5% increase), Declining (&gt;5% decrease), or Stable.
              </div>
            </div>
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

        <!-- Status Snapshot -->
        <div class="px-6 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      <div class="flex justify-between"><span class="font-medium">Missing Info</span><span class="text-gray-400">Waiting on reporter</span></div>
                      <div class="flex justify-between"><span class="font-medium">Not AI-Fixable</span><span class="text-gray-400">Not suitable for AI</span></div>
                      <div class="flex justify-between"><span class="font-medium">External Reporter</span><span class="text-gray-400">Needs RH approval</span></div>
                      <div class="flex justify-between"><span class="font-medium">Security Review</span><span class="text-gray-400">Needs human review</span></div>
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
                    :href="buildJiraLabelUrl(seg.jiraLabels, seg.excludeLabels)"
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
                      <div class="flex justify-between"><span class="font-medium">AI Fix Merged</span><span class="text-gray-400">Fix landed</span></div>
                      <div class="flex justify-between"><span class="font-medium">AI Fix Under Review</span><span class="text-gray-400">Human reviewing</span></div>
                      <div class="flex justify-between"><span class="font-medium">AI Fix CI Failing</span><span class="text-gray-400">CI is red</span></div>
                      <div class="flex justify-between"><span class="font-medium">AI Working</span><span class="text-gray-400">Generating fix</span></div>
                      <div class="flex justify-between"><span class="font-medium">Queued for AI</span><span class="text-gray-400">Waiting for bot</span></div>
                      <div class="flex justify-between"><span class="font-medium">AI Fix Rejected</span><span class="text-gray-400">MR closed</span></div>
                      <div class="flex justify-between"><span class="font-medium">AI Max Retries</span><span class="text-gray-400">Bot gave up</span></div>
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
                    :href="buildJiraLabelUrl(seg.jiraLabels, seg.excludeLabels)"
                    target="_blank" rel="noopener"
                    class="text-sm font-semibold hover:underline"
                    :class="seg.textClass"
                  >{{ seg.count }}</a>
                  <span class="text-xs text-gray-400 dark:text-gray-500 w-10 text-right">{{ autofixSegmentTotal > 0 ? Math.round(seg.count / autofixSegmentTotal * 100) : 0 }}%</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        <!-- Pipeline Trends -->
        <div class="px-6 pb-6 grid grid-cols-1 lg:grid-cols-3 gap-6" v-if="trendData.length > 0 && hasTrendActivity">
          <!-- Waiting on Humans: Triage -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Waiting on Humans: Triage</h3>
                <div class="relative group">
                  <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute left-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
                    Triage issues where a human can help. Missing Info: reporter hasn't provided details. External Reporter: non-RH reporter, needs RH approval. Security Review: flagged as security-sensitive. Stale: no response for 14+ days.
                  </div>
                </div>
              </div>
            </div>
            <div class="h-[180px]">
              <Bar :data="triageWaitingData" :options="triageWaitingOptions" />
            </div>
          </div>

          <!-- Waiting on Humans: Autofix -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Waiting on Humans: Autofix</h3>
                <div class="relative group">
                  <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-72 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
                    Autofix issues where a human can help. Under Review: MR waiting for code review. CI Failing: MR exists but CI is red. Blocked: AI got stuck. Max Retries: AI exhausted its attempts.
                  </div>
                </div>
              </div>
            </div>
            <div class="h-[180px]">
              <Bar :data="waitingChartData" :options="waitingChartOptions" />
            </div>
          </div>

          <!-- Adoption Over Time (funnel) -->
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Adoption Over Time</h3>
                <div class="relative group">
                  <svg class="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div class="absolute right-0 top-6 z-10 hidden group-hover:block w-64 p-2 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg dark:shadow-gray-900/50">
                    Green line: issues that qualified for autofix. Blue line: AI created an MR waiting for human code review. Bars: fixes that humans approved and merged. The gap between lines shows conversion at each stage.
                  </div>
                </div>
              </div>
              <div class="text-right">
                <span class="text-sm font-bold text-green-600 dark:text-green-400">{{ totalFixesLanded }}</span>
                <span class="text-[10px] text-gray-400 dark:text-gray-500 ml-0.5">landed</span>
              </div>
            </div>
            <div class="h-[180px]">
              <Line :data="funnelChartData" :options="funnelChartOptions" />
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
                      <div class="flex justify-between"><span>Missing Info</span><span class="text-gray-400">Waiting on reporter</span></div>
                      <div class="flex justify-between"><span>Not AI-Fixable</span><span class="text-gray-400">Not suitable for AI</span></div>
                      <div class="flex justify-between"><span>External Reporter</span><span class="text-gray-400">Needs RH approval</span></div>
                      <div class="flex justify-between"><span>Security Review</span><span class="text-gray-400">Needs human review</span></div>
                      <div class="flex justify-between"><span>Stale</span><span class="text-gray-400">No response 14+ days</span></div>
                    </div>
                    <p class="font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide text-[10px]">Autofix</p>
                    <div class="space-y-1">
                      <div class="flex justify-between"><span>Queued for AI</span><span class="text-gray-400">Waiting for bot</span></div>
                      <div class="flex justify-between"><span>AI Working</span><span class="text-gray-400">Generating fix</span></div>
                      <div class="flex justify-between"><span>AI Fix Under Review</span><span class="text-gray-400">Human reviewing</span></div>
                      <div class="flex justify-between"><span>AI Fix CI Failing</span><span class="text-gray-400">CI is red</span></div>
                      <div class="flex justify-between"><span>AI Fix Merged</span><span class="text-gray-400">Fix landed</span></div>
                      <div class="flex justify-between"><span>AI Fix Rejected</span><span class="text-gray-400">MR closed</span></div>
                      <div class="flex justify-between"><span>AI Max Retries</span><span class="text-gray-400">Bot gave up</span></div>
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
                <div class="relative" ref="stateDropdownRef">
                  <button
                    @click="stateDropdownOpen = !stateDropdownOpen"
                    class="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300 flex items-center gap-1.5 min-w-[130px]"
                  >
                    <span>{{ stateFilterLabel }}</span>
                    <svg class="w-3.5 h-3.5 ml-auto shrink-0 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  <div
                    v-if="stateDropdownOpen"
                    class="absolute right-0 z-20 mt-1 w-56 max-h-64 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1"
                  >
                    <label
                      v-for="opt in stateFilterOptions"
                      :key="opt.value"
                      class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        :checked="stateFilter.includes(opt.value)"
                        @change="toggleStateFilter(opt.value)"
                        class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                      />
                      {{ opt.label }}
                    </label>
                  </div>
                </div>
                <div v-if="availableStatuses.length > 1" class="relative" ref="statusDropdownRef">
                  <button
                    @click="statusDropdownOpen = !statusDropdownOpen"
                    class="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300 flex items-center gap-1.5 min-w-[130px]"
                  >
                    <span>{{ statusFilterLabel }}</span>
                    <svg class="w-3.5 h-3.5 ml-auto shrink-0 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  <div
                    v-if="statusDropdownOpen"
                    class="absolute right-0 z-20 mt-1 w-48 max-h-64 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1"
                  >
                    <label
                      v-for="s in availableStatuses"
                      :key="s"
                      class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        :checked="statusFilter.includes(s)"
                        @change="toggleStatusFilter(s)"
                        class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                      />
                      {{ s }}
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-200 dark:border-gray-700">
                    <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Key</th>
                    <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Summary</th>
                    <th class="px-5 py-2 text-left text-gray-500 dark:text-gray-400 font-medium">Status</th>
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
                      <span class="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">{{ issue.status }}</span>
                    </td>
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
                    <td colspan="6" class="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
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
