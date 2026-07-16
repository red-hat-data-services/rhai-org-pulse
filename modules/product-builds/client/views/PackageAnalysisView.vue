<script setup>
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { apiRequest } from '@shared/client/services/api'
import { useAuth } from '@shared/client/composables/useAuth'

const PackageSearchView = defineAsyncComponent(() => import('./PackageSearchView.vue'))
const NightlyAnalysisView = defineAsyncComponent(() => import('./NightlyAnalysisView.vue'))
const VersionMapView = defineAsyncComponent(() => import('./VersionMapView.vue'))
const PackageTrackerView = defineAsyncComponent(() => import('./PackageTrackerView.vue'))

const { isAdmin } = useAuth()

const JIRA_BASE = 'https://redhat.atlassian.net/browse'

const CATEGORY_CONFIG = {
  all_children_closed: {
    title: 'Immediate Action: All Children Closed',
    description: 'These EPICs should be closed or moved to final review.',
  },
  critical: {
    title: 'Critical (30+ days)',
    description: 'No activity for 30+ days with children still open.',
  },
  moderate: {
    title: 'Moderate (5-30 days)',
    description: 'No activity for 5-30 days with children still open.',
  },
  active: {
    title: 'Active',
    description: 'Activity within the last 5 days.',
  },
}

const STATUS_COLORS = {
  'In Progress': 'bg-blue-600',
  'To Do': 'bg-gray-500',
  'Review': 'bg-purple-500',
  'Refinement': 'bg-amber-500',
  'Closed': 'bg-green-600',
  'Done': 'bg-green-600',
}

const TREND_CHARTS = [
  { key: 'all_children_closed', label: 'Immediate Action', color: '#dc2626' },
  { key: 'critical', label: 'Critical', color: '#ea580c' },
  { key: 'moderate', label: 'Moderate', color: '#d97706' },
]

const BIG_NUMBERS = [
  { key: 'open_epics', label: 'Open EPICs', color: '#2563eb' },
  { key: 'all_children_closed', label: 'Immediate Action', color: '#dc2626' },
  { key: 'critical', label: 'Critical', color: '#ea580c' },
  { key: 'moderate', label: 'Moderate', color: '#d97706' },
  { key: 'active', label: 'Active', color: '#16a34a' },
]

const MIN_DAYS = 1
const MAX_DAYS = 90

// --- Shared state ---
function getInitialTab() {
  const hash = window.location.hash || ''
  const qIdx = hash.indexOf('?')
  if (qIdx !== -1) {
    const params = new URLSearchParams(hash.slice(qIdx + 1))
    const tab = params.get('tab')
    if (tab === 'search' || tab === 'nightly' || tab === 'versions' || tab === 'tracker') return tab
  }
  return 'onboarded'
}
const activeTab = ref(getInitialTab())
const reports = ref([])
const loading = ref(true)
const error = ref(null)

const latest = computed(() => reports.value.length > 0 ? reports.value[0].summary : null)
const previous = computed(() => reports.value.length > 1 ? reports.value[1].summary : null)
const lastReportDate = computed(() => reports.value.length > 0 ? reports.value[0].report_date : null)

function delta(key) {
  if (!latest.value || !previous.value) return null
  return latest.value[key] - previous.value[key]
}

// --- Onboarded tab state ---
const onboardedDays = ref(7)
const onboardedInput = ref(7)
const onboarded = ref(null)
const onboardedLoading = ref(false)

const dailyOnboarded = computed(() => {
  if (!onboarded.value || !onboarded.value.epics) return []
  const byDate = {}
  for (const epic of onboarded.value.epics) {
    const date = epic.resolved_date || 'Unknown'
    if (!byDate[date]) byDate[date] = []
    byDate[date].push(epic)
  }
  const days = Object.entries(byDate)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, epics]) => ({ date, count: epics.length, epics }))
  return days
})

const onboardedChartData = computed(() => {
  const days = dailyOnboarded.value
  if (!days.length) return null
  const maxVal = Math.max(...days.map(d => d.count), 1)
  const width = 600, height = 200
  const padLeft = 36, padRight = 16, padTop = 20, padBottom = 40
  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom
  const barGap = 4
  const barWidth = Math.max(8, Math.min(40, (chartW - barGap * (days.length - 1)) / days.length))
  const totalBarsWidth = days.length * barWidth + (days.length - 1) * barGap
  const offsetX = padLeft + (chartW - totalBarsWidth) / 2

  const gridLines = []
  const gridCount = Math.min(maxVal, 4)
  for (let i = 0; i <= gridCount; i++) {
    const val = Math.round((maxVal / gridCount) * i)
    const y = padTop + chartH - (val / maxVal) * chartH
    gridLines.push({ y, val })
  }

  const bars = days.map((d, i) => {
    const barH = (d.count / maxVal) * chartH
    const x = offsetX + i * (barWidth + barGap)
    const y = padTop + chartH - barH
    const labelDate = new Date(d.date + 'T00:00:00')
    const label = labelDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return { x, y, width: barWidth, height: barH, count: d.count, label, date: d.date }
  })

  return { width, height, padLeft, padRight, padTop, padBottom, chartH, gridLines, bars }
})

// --- Daily report tab state ---
const generating = ref(false)
const expandedCards = ref(new Set())
const expandedEpics = ref(new Set())
const cardData = ref({})
const cardLoading = ref(new Set())
const collapsedSections = ref({})

function isEpicExpanded(key) {
  return expandedEpics.value.has(key)
}

function toggleEpic(key) {
  const next = new Set(expandedEpics.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedEpics.value = next
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: '2-digit' })
}

function borderColorForSummary(summary) {
  const actionNeeded = (summary.all_children_closed || 0) + (summary.critical || 0)
  if (actionNeeded > 0) return 'border-l-red-500'
  if ((summary.moderate || 0) > 0) return 'border-l-amber-500'
  return 'border-l-green-500'
}

function isSectionOpen(date, cat) {
  const key = `${date}:${cat}`
  if (collapsedSections.value[key] === undefined) return cat !== 'active'
  return !collapsedSections.value[key]
}

function toggleSection(date, cat) {
  const key = `${date}:${cat}`
  collapsedSections.value = { ...collapsedSections.value, [key]: isSectionOpen(date, cat) }
}

// --- SVG trend chart ---
function computeChartData(dataKey, sorted) {
  const values = sorted.map(r => r.summary[dataKey])
  const maxVal = Math.max(...values, 1)
  const width = 340, height = 160
  const padLeft = 36, padRight = 16, padTop = 28, padBottom = 32
  const chartW = width - padLeft - padRight
  const chartH = height - padTop - padBottom
  const xStep = sorted.length > 1 ? chartW / (sorted.length - 1) : chartW
  const yScale = v => padTop + chartH - (v / maxVal) * chartH
  const xPos = i => padLeft + i * xStep

  const gridLines = []
  for (let i = 0; i <= 3; i++) {
    const val = Math.round((maxVal / 3) * i)
    gridLines.push({ y: yScale(val), val })
  }

  const points = sorted.map((r, i) => ({ x: xPos(i), y: yScale(r.summary[dataKey]), val: r.summary[dataKey] }))
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')
  const area = `${padLeft},${padTop + chartH} ${polyline} ${xPos(sorted.length - 1)},${padTop + chartH}`
  const xLabels = sorted.map((r, i) => {
    const d = new Date(r.report_date + 'T00:00:00')
    return { x: xPos(i), label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
  })

  return { width, height, padLeft, padRight, gridLines, points, polyline, area, xLabels }
}

const trendChartsData = computed(() => {
  const sorted = [...reports.value].reverse()
  if (sorted.length < 2) return {}
  const result = {}
  for (const chart of TREND_CHARTS) {
    result[chart.key] = computeChartData(chart.key, sorted)
  }
  return result
})

// --- Data fetching ---
async function fetchReports() {
  loading.value = true
  error.value = null
  try {
    reports.value = await apiRequest('/modules/product-builds/package-reports')
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

async function fetchOnboarded() {
  onboardedLoading.value = true
  try {
    onboarded.value = await apiRequest(`/modules/product-builds/package-reports/onboarded?days=${onboardedDays.value}`)
  } catch (err) {
    onboarded.value = null
    error.value = err.message
  } finally {
    onboardedLoading.value = false
  }
}

function submitDays() {
  const val = Math.min(Math.max(Number(onboardedInput.value) || 7, MIN_DAYS), MAX_DAYS)
  onboardedInput.value = val
  onboardedDays.value = val
  fetchOnboarded()
}

async function generateReport() {
  generating.value = true
  error.value = null
  try {
    await apiRequest('/modules/product-builds/package-reports/generate', { method: 'POST' })
    await fetchReports()
  } catch (err) {
    error.value = err.message
  } finally {
    generating.value = false
  }
}

async function toggleCard(date) {
  if (expandedCards.value.has(date)) {
    const next = new Set(expandedCards.value)
    next.delete(date)
    expandedCards.value = next
    return
  }
  const next = new Set(expandedCards.value)
  next.add(date)
  expandedCards.value = next

  if (!cardData.value[date]) {
    const loadingSet = new Set(cardLoading.value)
    loadingSet.add(date)
    cardLoading.value = loadingSet
    try {
      const data = await apiRequest(`/modules/product-builds/package-reports/${date}`)
      cardData.value = { ...cardData.value, [date]: data }
    } catch {
      const collapse = new Set(expandedCards.value)
      collapse.delete(date)
      expandedCards.value = collapse
    } finally {
      const done = new Set(cardLoading.value)
      done.delete(date)
      cardLoading.value = done
    }
  }
}

onMounted(() => {
  fetchReports()
  fetchOnboarded()
})
</script>

<template>
  <div class="max-w-[1200px]">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Package Analysis</h1>
      <div class="flex items-center gap-3 mt-1">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          AIPCC package EPIC analysis — tracks open EPICs with labels <code class="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">dashboard-filed</code> and <code class="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">package</code>
        </p>
        <span v-if="lastReportDate" class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
          Last report: {{ lastReportDate }}
        </span>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
      {{ error }}
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-24">
      <svg class="animate-spin h-10 w-10 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <div class="mt-4 text-gray-500 dark:text-gray-400">Loading reports...</div>
    </div>

    <template v-else>
      <!-- Tabs -->
      <div class="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav class="flex gap-4">
          <button
            @click="activeTab = 'onboarded'"
            class="py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2"
            :class="activeTab === 'onboarded'
              ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
          >
            Packages Onboarded
            <span
              v-if="onboarded && onboarded.count > 0"
              class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium"
              :class="activeTab === 'onboarded' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'"
            >{{ onboarded.count }}</span>
          </button>
          <button
            @click="activeTab = 'daily'"
            class="py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2"
            :class="activeTab === 'daily'
              ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
          >
            Daily Report
            <span
              v-if="reports.length > 0"
              class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium"
              :class="activeTab === 'daily' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'"
            >{{ reports.length }}</span>
          </button>
          <button
            @click="activeTab = 'search'"
            class="py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2"
            :class="activeTab === 'search'
              ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
          >
            Package Search
          </button>
          <button
            @click="activeTab = 'nightly'"
            class="py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2"
            :class="activeTab === 'nightly'
              ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
          >
            Nightly Analysis
          </button>
          <button
            @click="activeTab = 'versions'"
            class="py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2"
            :class="activeTab === 'versions'
              ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
          >
            Version Map
          </button>
          <button
            @click="activeTab = 'tracker'"
            class="py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2"
            :class="activeTab === 'tracker'
              ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
          >
            Tracker
          </button>
        </nav>
      </div>

      <!-- ==================== PACKAGES ONBOARDED TAB ==================== -->
      <div v-if="activeTab === 'onboarded'">
        <!-- Time window selector -->
        <div class="flex items-center gap-2 mb-5">
          <span class="text-sm text-gray-500 dark:text-gray-400">Show packages onboarded in the last</span>
          <form class="inline-flex items-center gap-2" @submit.prevent="submitDays">
            <input
              type="number"
              v-model.number="onboardedInput"
              :min="MIN_DAYS"
              :max="MAX_DAYS"
              placeholder="Enter number of days"
              class="w-20 text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <button
              type="submit"
              class="px-3 py-1.5 text-sm font-medium text-white bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 rounded-lg transition-colors"
            >Go</button>
          </form>
          <span class="text-sm text-gray-500 dark:text-gray-400">days</span>
        </div>

        <!-- Loading -->
        <div v-if="onboardedLoading" class="text-center py-12">
          <svg class="animate-spin h-8 w-8 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>

        <!-- Empty state -->
        <div v-else-if="!onboarded || onboarded.count === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
          No packages onboarded in the last {{ onboardedDays }} days.
        </div>

        <!-- Onboarded results -->
        <div v-else>
          <!-- Success banner -->
          <div class="mb-4 p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/40 rounded-lg flex items-center gap-3">
            <div class="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg class="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div class="text-lg font-bold text-green-800 dark:text-green-300">
                {{ onboarded.count }} package{{ onboarded.count !== 1 ? 's' : '' }} successfully onboarded
              </div>
              <div class="text-sm text-green-600 dark:text-green-400/80">
                In the last {{ onboarded.days }} day{{ onboarded.days !== 1 ? 's' : '' }}
              </div>
            </div>
          </div>

          <!-- Daily onboarding chart -->
          <div v-if="dailyOnboarded.length > 0" class="mb-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Daily Onboarding</div>
            <svg
              v-if="onboardedChartData"
              width="100%"
              :height="onboardedChartData.height"
              :viewBox="`0 0 ${onboardedChartData.width} ${onboardedChartData.height}`"
              preserveAspectRatio="xMidYMid meet"
            >
              <!-- Grid lines -->
              <g v-for="g in onboardedChartData.gridLines" :key="'g' + g.val">
                <line :x1="onboardedChartData.padLeft" :y1="g.y" :x2="onboardedChartData.width - onboardedChartData.padRight" :y2="g.y" stroke="#e8e8e8" stroke-dasharray="3,3" />
                <text :x="onboardedChartData.padLeft - 6" :y="g.y + 4" text-anchor="end" font-size="10" fill="#6a6e73">{{ g.val }}</text>
              </g>
              <!-- Bars -->
              <g v-for="bar in onboardedChartData.bars" :key="bar.date">
                <rect :x="bar.x" :y="bar.y" :width="bar.width" :height="bar.height" rx="2" fill="#16a34a" opacity="0.8" />
                <text v-if="bar.count > 0" :x="bar.x + bar.width / 2" :y="bar.y - 4" text-anchor="middle" font-size="11" font-weight="600" fill="#16a34a">{{ bar.count }}</text>
                <text :x="bar.x + bar.width / 2" :y="onboardedChartData.height - 8" text-anchor="middle" font-size="9" fill="#6a6e73" :transform="`rotate(-45, ${bar.x + bar.width / 2}, ${onboardedChartData.height - 8})`">{{ bar.label }}</text>
              </g>
              <!-- Baseline -->
              <line :x1="onboardedChartData.padLeft" :y1="onboardedChartData.padTop + onboardedChartData.chartH" :x2="onboardedChartData.width - onboardedChartData.padRight" :y2="onboardedChartData.padTop + onboardedChartData.chartH" stroke="#d1d5db" stroke-width="1" />
            </svg>
          </div>

          <!-- Onboarded list -->
          <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <th class="text-left py-2.5 px-4 font-medium text-gray-600 dark:text-gray-400 w-12">#</th>
                  <th class="text-left py-2.5 px-4 font-medium text-gray-600 dark:text-gray-400">EPIC</th>
                  <th class="text-left py-2.5 px-4 font-medium text-gray-600 dark:text-gray-400">Package</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-700/50">
                <tr v-for="(epic, i) in onboarded.epics" :key="epic.key" class="hover:bg-green-50/50 dark:hover:bg-green-900/5 transition-colors">
                  <td class="py-2.5 px-4 text-gray-400 dark:text-gray-500 tabular-nums">{{ i + 1 }}</td>
                  <td class="py-2.5 px-4">
                    <div class="flex items-center gap-2">
                      <svg class="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <a :href="`${JIRA_BASE}/${epic.key}`" target="_blank" rel="noopener noreferrer" class="font-semibold text-blue-600 hover:underline">{{ epic.key }}</a>
                    </div>
                  </td>
                  <td class="py-2.5 px-4 text-gray-900 dark:text-gray-200">{{ epic.summary }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ==================== PACKAGE SEARCH TAB ==================== -->
      <div v-if="activeTab === 'search'">
        <PackageSearchView />
      </div>

      <!-- ==================== NIGHTLY ANALYSIS TAB ==================== -->
      <div v-if="activeTab === 'nightly'">
        <NightlyAnalysisView />
      </div>

      <!-- ==================== VERSION MAP TAB ==================== -->
      <div v-if="activeTab === 'versions'">
        <VersionMapView />
      </div>

      <!-- ==================== PACKAGE TRACKER TAB ==================== -->
      <div v-if="activeTab === 'tracker'">
        <PackageTrackerView />
      </div>

      <!-- ==================== DAILY REPORT TAB ==================== -->
      <div v-if="activeTab === 'daily'">
        <!-- Generate button -->
        <div v-if="isAdmin" class="flex justify-end mb-4">
          <button
            :disabled="generating"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            @click="generateReport"
          >
            {{ generating ? 'Generating...' : "Generate Today's Report" }}
          </button>
        </div>

        <!-- Summary cards -->
        <div v-if="latest" class="flex gap-4 mb-6 flex-wrap">
          <div
            v-for="bn in BIG_NUMBERS"
            :key="bn.key"
            class="flex-1 min-w-[140px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-center py-5 px-4"
          >
            <div class="text-[42px] font-bold leading-none" :style="{ color: bn.color }">{{ latest[bn.key] }}</div>
            <div class="text-[13px] text-gray-500 dark:text-gray-400 mt-2">{{ bn.label }}</div>
            <div
              v-if="delta(bn.key) !== null"
              class="text-xs mt-1"
              :class="delta(bn.key) > 0 ? 'text-red-500' : delta(bn.key) < 0 ? 'text-green-500' : 'text-gray-400'"
            >{{ delta(bn.key) > 0 ? '+' : '' }}{{ delta(bn.key) }} vs prev</div>
          </div>
        </div>

        <!-- Trend charts -->
        <div v-if="reports.length >= 2" class="flex gap-4 mb-6 flex-wrap">
          <div
            v-for="chart in TREND_CHARTS"
            :key="chart.key"
            class="flex-1 min-w-[300px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <div class="text-[13px] font-semibold mb-1" :style="{ color: chart.color }">{{ chart.label }}</div>
            <svg
              v-if="trendChartsData[chart.key]"
              width="100%"
              :height="trendChartsData[chart.key].height"
              :viewBox="`0 0 ${trendChartsData[chart.key].width} ${trendChartsData[chart.key].height}`"
              preserveAspectRatio="xMidYMid meet"
            >
              <g v-for="g in trendChartsData[chart.key].gridLines" :key="g.val">
                <line :x1="trendChartsData[chart.key].padLeft" :y1="g.y" :x2="trendChartsData[chart.key].width - trendChartsData[chart.key].padRight" :y2="g.y" stroke="#e8e8e8" stroke-dasharray="3,3" />
                <text :x="trendChartsData[chart.key].padLeft - 6" :y="g.y + 4" text-anchor="end" font-size="10" fill="#6a6e73">{{ g.val }}</text>
              </g>
              <polygon :points="trendChartsData[chart.key].area" :fill="chart.color" opacity="0.1" />
              <polyline :points="trendChartsData[chart.key].polyline" fill="none" :stroke="chart.color" stroke-width="2.5" stroke-linejoin="round" />
              <g v-for="(p, i) in trendChartsData[chart.key].points" :key="'pt' + i">
                <circle :cx="p.x" :cy="p.y" r="4" :fill="chart.color" stroke="white" stroke-width="1.5" />
                <text :x="p.x" :y="p.y - 10" text-anchor="middle" font-size="11" font-weight="600" :fill="chart.color">{{ p.val }}</text>
              </g>
              <text v-for="(xl, i) in trendChartsData[chart.key].xLabels" :key="'xl' + i" :x="xl.x" :y="trendChartsData[chart.key].height - 6" text-anchor="middle" font-size="10" fill="#6a6e73">{{ xl.label }}</text>
            </svg>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="reports.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
          No reports generated yet. Click "Generate Today's Report" to create the first one.
        </div>

        <!-- Daily report cards -->
        <div v-for="(r, idx) in reports" :key="r.report_date" class="mb-4">
          <div
            class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg border-l-4 overflow-hidden"
            :class="borderColorForSummary(r.summary)"
          >
            <div
              class="px-5 py-4 cursor-pointer flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              :class="expandedCards.has(r.report_date) ? 'border-b border-gray-200 dark:border-gray-700' : ''"
              @click="toggleCard(r.report_date)"
            >
              <div class="flex items-center gap-3 flex-wrap">
                <span class="font-bold text-lg text-gray-900 dark:text-white">{{ formatDate(r.report_date) }}</span>
                <span v-if="idx === 0" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Latest</span>
                <span class="text-sm text-gray-500 dark:text-gray-400">{{ r.summary.open_epics }} open EPICs</span>
                <div class="flex gap-1.5">
                  <span v-if="r.summary.all_children_closed > 0" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">{{ r.summary.all_children_closed }} ready to close</span>
                  <span v-if="r.summary.critical > 0" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400">{{ r.summary.critical }} critical</span>
                  <span v-if="r.summary.moderate > 0" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">{{ r.summary.moderate }} moderate</span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">{{ r.summary.active }} active</span>
                </div>
              </div>
              <span class="text-gray-400 text-sm">{{ expandedCards.has(r.report_date) ? '▾' : '▸' }}</span>
            </div>

            <div v-if="expandedCards.has(r.report_date)" class="p-5">
              <div v-if="cardLoading.has(r.report_date)" class="text-center py-10">
                <svg class="animate-spin h-8 w-8 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <div class="mt-2 text-gray-500 text-sm">Loading report...</div>
              </div>

              <template v-if="cardData[r.report_date]">
                <div v-if="r.summary.top_assignee" class="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  Top assignee: <strong>{{ r.summary.top_assignee[0] }}</strong> ({{ r.summary.top_assignee[1] }} EPICs)
                  <span v-if="r.summary.status_distribution" class="ml-4">
                    <span v-for="(count, status) in r.summary.status_distribution" :key="status" class="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 ml-1">{{ status }}: {{ count }}</span>
                  </span>
                </div>

                <div v-for="cat in ['all_children_closed', 'critical', 'moderate', 'active']" :key="cat" class="mb-3">
                  <template v-if="cardData[r.report_date].categories[cat] && cardData[r.report_date].categories[cat].length > 0">
                    <div class="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors" @click="toggleSection(r.report_date, cat)">
                      <span class="text-blue-600 text-sm">{{ isSectionOpen(r.report_date, cat) ? '▾' : '▸' }}</span>
                      <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ CATEGORY_CONFIG[cat].title }} ({{ cardData[r.report_date].categories[cat].length }})</h4>
                    </div>

                    <div v-if="isSectionOpen(r.report_date, cat)" class="mt-2 pl-2">
                      <div class="mb-2 text-gray-500 dark:text-gray-400 text-[13px]">{{ CATEGORY_CONFIG[cat].description }}</div>
                      <div v-for="epic in cardData[r.report_date].categories[cat]" :key="epic.key" class="border border-gray-200 dark:border-gray-700 rounded mb-2 bg-white dark:bg-gray-800">
                        <div class="flex items-center px-3.5 py-2.5 cursor-pointer gap-3 flex-wrap" @click="toggleEpic(epic.key)">
                          <span class="text-gray-400 text-xs w-4">{{ isEpicExpanded(epic.key) ? '▾' : '▸' }}</span>
                          <a :href="`${JIRA_BASE}/${epic.key}`" target="_blank" rel="noopener noreferrer" class="font-semibold text-blue-600 hover:underline min-w-[120px]" @click.stop>{{ epic.key }}</a>
                          <span class="flex-1 min-w-[200px] text-gray-900 dark:text-gray-200">{{ epic.summary_short }}</span>
                          <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white" :class="STATUS_COLORS[epic.status] || 'bg-gray-500'">{{ epic.status }}</span>
                          <span class="text-gray-500 text-[13px] min-w-[120px]">{{ epic.assignee }}</span>
                          <span class="text-[13px] min-w-[100px] text-gray-700 dark:text-gray-300">{{ epic.classification.child_summary }}</span>
                          <span v-if="epic.classification.days_since !== null" class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium" :class="epic.classification.days_since > 30 ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' : epic.classification.days_since > 5 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'">{{ epic.classification.days_since }}d ago</span>
                        </div>
                        <div v-if="isEpicExpanded(epic.key)" class="px-3.5 pb-3.5 pt-0 ml-[42px] border-t border-gray-100 dark:border-gray-700">
                          <div class="mt-2.5"><strong class="text-gray-700 dark:text-gray-300">Insight:</strong><span class="text-gray-600 dark:text-gray-400"> {{ epic.insight }}</span></div>
                          <div v-if="epic.last_comment.text" class="mt-2 text-[13px] text-gray-600 dark:text-gray-400">
                            <strong>Last comment</strong> by {{ epic.last_comment.by }} ({{ epic.last_comment.date_str }}):
                            <div class="mt-1 p-2 bg-gray-50 dark:bg-gray-750 rounded italic">{{ epic.last_comment.text }}</div>
                          </div>
                          <div v-if="epic.children.length > 0" class="mt-2.5">
                            <strong class="text-gray-700 dark:text-gray-300">Children:</strong>
                            <table class="w-full mt-1.5 text-[13px] border-collapse">
                              <thead><tr class="text-left border-b border-gray-200 dark:border-gray-700"><th class="py-1 px-2 font-medium text-gray-600 dark:text-gray-400">Key</th><th class="py-1 px-2 font-medium text-gray-600 dark:text-gray-400">Summary</th><th class="py-1 px-2 font-medium text-gray-600 dark:text-gray-400">Status</th></tr></thead>
                              <tbody>
                                <tr v-for="child in epic.children" :key="child.key" class="border-b border-gray-100 dark:border-gray-700/50">
                                  <td class="py-1 px-2"><a :href="`${JIRA_BASE}/${child.key}`" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">{{ child.key }}</a></td>
                                  <td class="py-1 px-2 text-gray-700 dark:text-gray-300">{{ child.summary }}</td>
                                  <td class="py-1 px-2"><span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white" :class="STATUS_COLORS[child.status] || 'bg-gray-500'">{{ child.status }}</span></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  </template>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
