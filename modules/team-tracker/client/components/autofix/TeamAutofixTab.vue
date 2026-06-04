<template>
  <!-- Empty state: ai-impact module disabled -->
  <div v-if="!aiImpactEnabled" class="text-center py-16 text-gray-500 dark:text-gray-400">
    <svg class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
    <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">AI Impact module not enabled</h3>
    <p class="text-sm max-w-md mx-auto">The AI Impact module is not enabled. Enable it in Settings to see autofix data.</p>
  </div>

  <!-- Empty state: team has no components -->
  <div v-else-if="!teamComponents.length" class="text-center py-16 text-gray-500 dark:text-gray-400">
    <svg class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
    <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No components configured</h3>
    <p class="text-sm max-w-md mx-auto">This team has no Jira components configured. Add components in team settings to see autofix data.</p>
  </div>

  <!-- Loading state -->
  <div v-else-if="loading" class="flex items-center justify-center py-12">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
  </div>

  <!-- Error state -->
  <div v-else-if="error" class="text-center py-16 text-gray-500 dark:text-gray-400">
    <svg class="mx-auto h-12 w-12 text-red-300 dark:text-red-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
    <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Failed to load autofix data</h3>
    <p class="text-sm max-w-md mx-auto mb-4">{{ error }}</p>
    <button @click="fetchData" class="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors">
      Retry
    </button>
  </div>

  <!-- Empty state: data not yet fetched -->
  <div v-else-if="dataNotFetched" class="text-center py-16 text-gray-500 dark:text-gray-400">
    <svg class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
      <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
    <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">Autofix data not loaded</h3>
    <p class="text-sm max-w-md mx-auto">Autofix data has not been loaded yet. An admin can trigger a refresh from the AI Impact settings.</p>
  </div>

  <!-- Main content -->
  <div v-else>
    <!-- Empty state: no matching issues -->
    <div v-if="teamIssues.length === 0" class="text-center py-16 text-gray-500 dark:text-gray-400">
      <svg class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
      <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No autofix issues</h3>
      <p class="text-sm max-w-md mx-auto">No autofix issues found for this team's components in the selected time window.</p>
    </div>

    <template v-else>
      <!-- Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">Total Issues</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ metrics.windowTotal }}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">Bugs Fixed by AI</p>
          <p class="text-2xl font-bold text-green-600 dark:text-green-400">{{ bugsMerged }}</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <p class="text-sm text-gray-500 dark:text-gray-400">Success Rate</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-gray-100" :title="successRateTooltip">
            {{ successRateDisplay }}
          </p>
        </div>
      </div>

      <!-- Pipeline Breakdown Bar -->
      <div v-if="pipelineSegments.length > 0" class="mb-6">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pipeline Breakdown</h4>
        <div class="flex h-6 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
          <div
            v-for="seg in pipelineSegments"
            :key="seg.state"
            :class="seg.color"
            :style="{ width: seg.pct + '%' }"
            :title="`${seg.label}: ${seg.count}`"
            class="transition-all"
          ></div>
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span v-for="seg in pipelineSegments" :key="seg.state" class="flex items-center gap-1">
            <span :class="seg.color" class="inline-block w-2.5 h-2.5 rounded-full"></span>
            {{ seg.label }}: {{ seg.count }}
          </span>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <div class="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
          <button
            v-for="tw in timeWindows"
            :key="tw.value"
            @click="timeWindow = tw.value"
            class="px-3 py-1.5 text-xs font-medium transition-colors"
            :class="timeWindow === tw.value
              ? 'bg-primary-600 text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'"
          >
            {{ tw.label }}
          </button>
        </div>
        <div class="relative" ref="stateDropdownRef">
          <button
            @click="stateDropdownOpen = !stateDropdownOpen"
            class="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 flex items-center gap-1.5 min-w-[140px]"
          >
            <span>{{ stateFilterLabel }}</span>
            <svg class="w-3.5 h-3.5 ml-auto shrink-0 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          <div
            v-if="stateDropdownOpen"
            class="absolute z-20 mt-1 w-56 max-h-64 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1"
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
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search key, summary, assignee..."
          class="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 w-64"
        />
      </div>

      <!-- Issues Table -->
      <div class="overflow-x-auto mb-6">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
              <th class="pb-2 pr-4 font-medium">Key</th>
              <th class="pb-2 pr-4 font-medium">Summary</th>
              <th class="pb-2 pr-4 font-medium">Type</th>
              <th class="pb-2 pr-4 font-medium">Priority</th>
              <th class="pb-2 pr-4 font-medium">Pipeline State</th>
              <th class="pb-2 pr-4 font-medium">Assignee</th>
              <th class="pb-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="issue in displayedIssues"
              :key="issue.key"
              class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <td class="py-2 pr-4">
                <a
                  :href="`${jiraHost}/browse/${issue.key}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                >{{ issue.key }}</a>
              </td>
              <td class="py-2 pr-4 max-w-xs truncate" :title="issue.summary">{{ issue.summary }}</td>
              <td class="py-2 pr-4">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {{ issue.issueType }}
                </span>
              </td>
              <td class="py-2 pr-4 text-gray-600 dark:text-gray-400">{{ issue.priority }}</td>
              <td class="py-2 pr-4">
                <span
                  :class="getStateColorClass(issue.pipelineState)"
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                >{{ getStateLabel(issue.pipelineState) }}</span>
              </td>
              <td class="py-2 pr-4 text-gray-600 dark:text-gray-400">{{ issue.assignee || '—' }}</td>
              <td class="py-2 text-gray-500 dark:text-gray-400">{{ formatRelativeDate(issue.updated) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="displayedIssues.length === 0" class="text-center text-gray-400 dark:text-gray-500 py-6 text-sm">
          No issues match the current filters.
        </p>
      </div>

      <!-- Trend Chart -->
      <div v-if="trendData.length > 0 && hasTrendActivity" class="mt-6">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Pipeline Funnel Trend</h4>
        <div class="h-64 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <Bar :data="funnelChartData" :options="funnelChartOptions" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Bar } from 'vue-chartjs'
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
import { useModules } from '../../../../../src/composables/useModules'
import { fetchAutofixData } from '../../services/autofix-api.js'
import {
  STATE_OPTIONS,
  PIPELINE_BAR_SEGMENTS,
  stateLabel,
  stateColorClass,
  computeTeamMetrics,
  buildTeamTrendData
} from './autofix-constants.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, BarController, Filler, Tooltip, Legend)

const props = defineProps({
  team: { type: Object, default: null },
  teamDetail: { type: Object, default: null }
})

const { enabledBuiltInSlugs } = useModules()

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

const loading = ref(false)
const error = ref(null)
const rawData = ref(null)
const fetched = ref(false)
const timeWindow = ref('month')
const stateFilter = ref([])
const stateDropdownOpen = ref(false)
const stateDropdownRef = ref(null)
const searchQuery = ref('')

const stateFilterOptions = STATE_OPTIONS.filter(o => o.value !== 'all')
const timeWindows = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: '3months', label: '3 Months' }
]

const aiImpactEnabled = computed(() => {
  const slugs = enabledBuiltInSlugs.value
  if (!slugs) return true // not loaded yet, assume enabled
  return slugs.includes('ai-impact')
})

const teamComponents = computed(() => props.teamDetail?.components || [])

const jiraHost = computed(() => rawData.value?.jiraHost || 'https://redhat.atlassian.net')

const dataNotFetched = computed(() => fetched.value && !rawData.value?.fetchedAt)

const teamComponentSet = computed(() => new Set(teamComponents.value))

const teamIssues = computed(() => {
  if (!rawData.value?.issues || teamComponentSet.value.size === 0) return []
  return rawData.value.issues.filter(issue =>
    (issue.components || []).some(c => teamComponentSet.value.has(c))
  )
})

const metrics = computed(() => computeTeamMetrics(teamIssues.value, timeWindow.value))

const bugsMerged = computed(() => {
  const days = timeWindow.value === 'week' ? 7 : timeWindow.value === 'month' ? 30 : 90
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return teamIssues.value.filter(i =>
    new Date(i.created) >= cutoff &&
    i.pipelineState === 'autofix-merged' &&
    i.issueType === 'Bug'
  ).length
})

const successRateDisplay = computed(() => {
  if (metrics.value.terminalTotal < 3) return '\u2014'
  return metrics.value.successRate + '%'
})

const successRateTooltip = computed(() => {
  if (metrics.value.terminalTotal < 3) return 'Not enough completed issues to calculate a meaningful rate.'
  return `${metrics.value.autofixStates.merged} merged / ${metrics.value.terminalTotal} terminal`
})

const pipelineSegments = computed(() => {
  const total = teamIssues.value.length
  if (total === 0) return []
  const counts = {}
  for (const issue of teamIssues.value) {
    counts[issue.pipelineState] = (counts[issue.pipelineState] || 0) + 1
  }
  return PIPELINE_BAR_SEGMENTS
    .map(seg => ({
      ...seg,
      count: counts[seg.state] || 0,
      pct: ((counts[seg.state] || 0) / total * 100)
    }))
    .filter(seg => seg.count > 0)
})

const timeFilteredIssues = computed(() => {
  const days = timeWindow.value === 'week' ? 7 : timeWindow.value === 'month' ? 30 : 90
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return teamIssues.value.filter(i => new Date(i.created) >= cutoff)
})

const displayedIssues = computed(() => {
  return timeFilteredIssues.value.filter(issue => {
    const matchesState = stateFilter.value.length === 0 || stateFilter.value.includes(issue.pipelineState)
    const q = searchQuery.value.toLowerCase()
    const matchesSearch = !q ||
      issue.key.toLowerCase().includes(q) ||
      issue.summary.toLowerCase().includes(q) ||
      (issue.assignee && issue.assignee.toLowerCase().includes(q))
    return matchesState && matchesSearch
  })
})

const trendData = computed(() => buildTeamTrendData(teamIssues.value, timeWindow.value))

const hasTrendActivity = computed(() => trendData.value.some(p => p.triaged > 0))

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

const stateFilterLabel = computed(() => {
  if (stateFilter.value.length === 0) return 'All States'
  if (stateFilter.value.length === 1) {
    const opt = stateFilterOptions.find(o => o.value === stateFilter.value[0])
    return opt ? opt.label : stateFilter.value[0]
  }
  return `${stateFilter.value.length} states`
})

function toggleStateFilter(value) {
  const idx = stateFilter.value.indexOf(value)
  if (idx >= 0) {
    stateFilter.value = stateFilter.value.filter(v => v !== value)
  } else {
    stateFilter.value = [...stateFilter.value, value]
  }
}

function handleClickOutside(e) {
  if (stateDropdownRef.value && !stateDropdownRef.value.contains(e.target)) {
    stateDropdownOpen.value = false
  }
}

function getStateLabel(state) { return stateLabel(state) }
function getStateColorClass(state) { return stateColorClass(state) }

function formatRelativeDate(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

async function fetchData() {
  loading.value = true
  error.value = null
  try {
    await fetchAutofixData((data) => {
      rawData.value = data
    })
    fetched.value = true
  } catch (err) {
    if (err?.status === 404) {
      error.value = 'The AI Impact module endpoint is unavailable.'
    } else {
      error.value = err?.message || 'An unexpected error occurred.'
    }
    fetched.value = true
  } finally {
    loading.value = false
  }
}

// Defer fetch until teamDetail.components is available
watch(
  () => props.teamDetail?.components,
  (components) => {
    if (components && components.length > 0 && !fetched.value && aiImpactEnabled.value) {
      fetchData()
    }
  },
  { immediate: true }
)
</script>
