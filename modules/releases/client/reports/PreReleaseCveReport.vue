<template>
  <div>
    <!-- Header -->
    <div class="flex items-center gap-3 mb-4">
      <button
        @click="goBack"
        class="p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
        title="Back to Reports"
      >
        <ArrowLeft :size="18" />
      </button>
      <div class="flex-1">
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Pre-Release CVE Report</h2>
        <p v-if="data?.fetchedAt" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Last refreshed: {{ formatDate(data.fetchedAt) }}
          <span v-if="data.cacheStatus === 'stale'" class="text-amber-500 ml-1">(stale — using cached data)</span>
        </p>
      </div>
      <a
        v-if="data?.source?.url"
        :href="data.source.url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/50"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></svg>
        View Spreadsheet
      </a>
      <button
        @click="handleRefresh"
        :disabled="refreshing"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors"
        :class="refreshing
          ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'
          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'"
      >
        <RefreshCw :size="14" :class="{ 'animate-spin': refreshing }" />
        {{ refreshing ? 'Refreshing...' : 'Refresh from Sheets' }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center items-center py-24">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
      <button @click="handleRefresh" class="mt-2 text-sm text-red-600 dark:text-red-400 underline hover:no-underline">
        Try refreshing from Google Sheets
      </button>
    </div>

    <!-- Empty state -->
    <div v-else-if="!data" class="text-center py-24">
      <ShieldAlert :size="48" class="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
      <h3 class="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">No pre-release CVE data yet</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Click "Refresh from Sheets" to load data from the Google Sheets source of truth.</p>
      <button
        @click="handleRefresh"
        :disabled="refreshing"
        class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm"
      >
        {{ refreshing ? 'Loading...' : 'Refresh from Sheets' }}
      </button>
    </div>

    <!-- Data -->
    <div v-else class="space-y-6">
      <!-- Version selector -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-5 py-3 flex items-center gap-4">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Release Version:</label>
        <select
          v-model="selectedVersion"
          class="text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option v-for="v in data.availableVersions" :key="v" :value="v">{{ v }}</option>
        </select>
        <span class="text-xs text-gray-500 dark:text-gray-400">
          {{ currentRelease?.records?.length || 0 }} CVE records in this version
        </span>
      </div>

      <!-- Summary banner -->
      <div class="bg-gradient-to-r from-orange-600 to-red-600 dark:from-orange-700 dark:to-red-700 rounded-lg px-6 py-4 text-white shadow">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-orange-200">Total Records</p>
            <p class="text-3xl font-extrabold">{{ agg.totalRecords.toLocaleString() }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-orange-200">Unique CVEs</p>
            <p class="text-3xl font-extrabold">{{ agg.totalUniqueCves.toLocaleString() }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-orange-200">Fix Available</p>
            <p class="text-3xl font-extrabold">{{ agg.uniqueCvesFixAvailable.toLocaleString() }}</p>
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-orange-200">Fix Not Available</p>
            <p class="text-3xl font-extrabold">{{ agg.uniqueCvesFixNotAvailable.toLocaleString() }}</p>
          </div>
        </div>
      </div>

      <!-- Severity breakdown cards -->
      <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">CVEs by Severity</h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            v-for="item in sortedSeverities"
            :key="item.severity"
            class="rounded-lg border p-4 text-center"
            :class="severityCardClass(item.severity)"
          >
            <p class="text-3xl font-extrabold">{{ item.count }}</p>
            <p class="text-[10px] font-semibold uppercase tracking-wide mt-1 opacity-80">{{ item.severity }}</p>
            <p class="text-xs mt-1 opacity-60">{{ item.pct }}%</p>
          </div>
        </div>
      </section>

      <!-- Status breakdown cards -->
      <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">CVEs by Status</h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div
            v-for="item in agg.byStatus"
            :key="item.status"
            class="rounded-lg border p-4 text-center"
            :class="statusCardClass(item.status)"
          >
            <p class="text-3xl font-extrabold">{{ item.count }}</p>
            <p class="text-[10px] font-semibold uppercase tracking-wide mt-1 opacity-80">{{ item.status }}</p>
            <p class="text-xs mt-1 opacity-60">{{ item.pct }}%</p>
          </div>
        </div>
      </section>

      <!-- Fix Status pie + Severity pie -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Fix Availability</h3>
          <div style="height: 300px;">
            <Doughnut :data="fixStatusChartData" :options="pieOptions" />
          </div>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
            {{ agg.totalRecords }} records &middot; by Fix Status
          </p>
        </section>

        <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Severity Distribution</h3>
          <div style="height: 300px;">
            <Pie :data="severityChartData" :options="pieOptions" />
          </div>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
            {{ agg.totalRecords }} records &middot; by Severity
          </p>
        </section>
      </div>

      <!-- Top Packages bar chart -->
      <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Top Affected Packages</h3>
        <div style="height: 340px;">
          <Bar :data="packagesChartData" :options="barOptions" />
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
          {{ agg.byPackage.length }} packages &middot; Top 20 shown
        </p>
      </section>

      <!-- Top Components bar chart -->
      <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Top Affected Components</h3>
        <div style="height: 340px;">
          <Bar :data="componentsChartData" :options="barOptions" />
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
          {{ agg.byComponent.length }} components &middot; Top 20 shown
        </p>
      </section>

      <!-- GitHub Repos breakdown -->
      <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Affected GitHub Repositories</h3>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="text-left py-2 pr-3 font-semibold text-gray-700 dark:text-gray-300">Repository</th>
                <th class="text-right py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Records</th>
                <th class="text-right py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">%</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in agg.byGithubRepo" :key="item.repo"
                class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td class="py-1.5 pr-3 text-gray-800 dark:text-gray-200">
                  <a v-if="item.repo" :href="item.repo" target="_blank" rel="noopener noreferrer"
                    class="text-blue-600 dark:text-blue-400 hover:underline">
                    {{ repoShortName(item.repo) }}
                  </a>
                  <span v-else class="text-gray-400">—</span>
                </td>
                <td class="text-right py-1.5 px-2 tabular-nums font-semibold">{{ item.count }}</td>
                <td class="text-right py-1.5 px-2 tabular-nums text-gray-500 dark:text-gray-400">{{ item.pct }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Full records table with search -->
      <section class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">All CVE Records</h3>
          <div class="flex items-center gap-2">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search packages, components, CVEs..."
              class="text-xs border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 w-64 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <select
              v-model="filterSeverity"
              class="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Severities</option>
              <option v-for="s in severityOptions" :key="s" :value="s">{{ s }}</option>
            </select>
            <select
              v-model="filterStatus"
              class="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              <option v-for="s in statusOptions" :key="s" :value="s">{{ s }}</option>
            </select>
            <select
              v-model="filterFixStatus"
              class="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">All Fix Status</option>
              <option v-for="s in fixStatusOptions" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
        </div>
        <div class="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table class="w-full text-xs">
            <thead class="sticky top-0 bg-white dark:bg-gray-800 z-10">
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="text-left py-2 pr-2 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none hover:text-gray-900" @click="toggleSort('package')">
                  Package {{ sortIcon('package') }}
                </th>
                <th class="text-left py-2 px-2 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none hover:text-gray-900" @click="toggleSort('component')">
                  Component {{ sortIcon('component') }}
                </th>
                <th class="text-center py-2 px-2 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none hover:text-gray-900" @click="toggleSort('severity')">
                  Severity {{ sortIcon('severity') }}
                </th>
                <th class="text-center py-2 px-2 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none hover:text-gray-900" @click="toggleSort('status')">
                  Status {{ sortIcon('status') }}
                </th>
                <th class="text-center py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Fix Status</th>
                <th class="text-left py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">CVEs (Fix Available)</th>
                <th class="text-left py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">CVEs (No Fix)</th>
                <th class="text-left py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Current Version</th>
                <th class="text-left py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">Fixed In</th>
                <th class="text-center py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">JIRA</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(record, idx) in paginatedRecords" :key="idx"
                class="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td class="py-1.5 pr-2 text-gray-800 dark:text-gray-200 font-medium whitespace-nowrap">{{ record.package }}</td>
                <td class="py-1.5 px-2 text-gray-700 dark:text-gray-300 max-w-[200px] truncate" :title="record.component">{{ record.component }}</td>
                <td class="py-1.5 px-2 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide" :class="severityBadgeClass(record.severity)">
                    {{ record.severity }}
                  </span>
                </td>
                <td class="py-1.5 px-2 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide" :class="statusBadgeClass(record.status)">
                    {{ record.status }}
                  </span>
                </td>
                <td class="py-1.5 px-2 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="fixStatusBadgeClass(record.fixStatus)">
                    {{ record.fixStatus }}
                  </span>
                </td>
                <td class="py-1.5 px-2 text-gray-600 dark:text-gray-400 max-w-[200px]">
                  <span v-if="record.cvesFixAvailable.length" class="break-all">{{ record.cvesFixAvailable.join(', ') }}</span>
                  <span v-else class="text-gray-400">—</span>
                </td>
                <td class="py-1.5 px-2 text-gray-600 dark:text-gray-400 max-w-[200px]">
                  <span v-if="record.cvesFixNotAvailable.length" class="break-all">{{ record.cvesFixNotAvailable.join(', ') }}</span>
                  <span v-else class="text-gray-400">—</span>
                </td>
                <td class="py-1.5 px-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{{ record.currentVersion || '—' }}</td>
                <td class="py-1.5 px-2 text-gray-600 dark:text-gray-400 whitespace-nowrap max-w-[150px] truncate" :title="record.fixedIn">{{ record.fixedIn || '—' }}</td>
                <td class="py-1.5 px-2 text-center">
                  <a v-if="record.jiraUrl" :href="record.jiraUrl" target="_blank" rel="noopener noreferrer"
                    class="text-blue-600 dark:text-blue-400 hover:underline text-[10px] font-medium">
                    {{ jiraKeyFromUrl(record.jiraUrl) }}
                  </a>
                  <span v-else class="text-gray-400">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between mt-3">
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Showing {{ paginationStart + 1 }}–{{ Math.min(paginationStart + pageSize, filteredRecords.length) }}
            of {{ filteredRecords.length }} records
            <span v-if="filteredRecords.length !== currentRecords.length" class="text-amber-600 dark:text-amber-400">
              (filtered from {{ currentRecords.length }})
            </span>
          </p>
          <div class="flex items-center gap-2">
            <button @click="currentPage--" :disabled="currentPage <= 1"
              class="px-2 py-1 text-xs border rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 text-gray-700 dark:text-gray-300">
              ← Prev
            </button>
            <span class="text-xs text-gray-500 dark:text-gray-400">Page {{ currentPage }} / {{ totalPages }}</span>
            <button @click="currentPage++" :disabled="currentPage >= totalPages"
              class="px-2 py-1 text-xs border rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600 text-gray-700 dark:text-gray-300">
              Next →
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject, watch } from 'vue'
import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-vue-next'
import { Bar, Pie, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'
import { usePreReleaseCve } from './composables/usePreReleaseCve'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend)

const nav = inject('moduleNav')
const { data, loading, error, refreshing, loadData, refresh } = usePreReleaseCve()

const selectedVersion = ref(null)
const searchQuery = ref('')
const filterSeverity = ref('')
const filterStatus = ref('')
const filterFixStatus = ref('')
const currentPage = ref(1)
const pageSize = 50
const tableSort = ref({ column: 'package', direction: 'asc' })

watch(() => data.value, (newData) => {
  if (newData?.availableVersions?.length && !selectedVersion.value) {
    selectedVersion.value = newData.availableVersions[0]
  }
})

watch(selectedVersion, () => {
  currentPage.value = 1
  searchQuery.value = ''
  filterSeverity.value = ''
  filterStatus.value = ''
  filterFixStatus.value = ''
})

const currentRelease = computed(() => {
  if (!data.value?.releases || !selectedVersion.value) return null
  return data.value.releases.find(r => r.version === selectedVersion.value) || null
})

const agg = computed(() => {
  if (!currentRelease.value?.aggregation) {
    return {
      totalRecords: 0, uniqueCvesFixAvailable: 0, uniqueCvesFixNotAvailable: 0,
      totalUniqueCves: 0, byPackage: [], byComponent: [], bySeverity: [],
      byStatus: [], byFixStatus: [], byGithubRepo: []
    }
  }
  return currentRelease.value.aggregation
})

const currentRecords = computed(() => currentRelease.value?.records || [])

const SEVERITY_ORDER = ['Critical', 'High', 'Medium', 'Low']

const sortedSeverities = computed(() => {
  const items = agg.value.bySeverity
  return [...items].sort((a, b) => {
    const ai = SEVERITY_ORDER.indexOf(a.severity)
    const bi = SEVERITY_ORDER.indexOf(b.severity)
    if (ai === -1 && bi === -1) return b.count - a.count
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
})

const severityOptions = computed(() => [...new Set(currentRecords.value.map(r => r.severity))].sort())
const statusOptions = computed(() => [...new Set(currentRecords.value.map(r => r.status))].sort())
const fixStatusOptions = computed(() => [...new Set(currentRecords.value.map(r => r.fixStatus))].sort())

const filteredRecords = computed(() => {
  let records = currentRecords.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    records = records.filter(r =>
      r.package.toLowerCase().includes(q) ||
      r.component.toLowerCase().includes(q) ||
      r.cvesFixAvailable.some(c => c.toLowerCase().includes(q)) ||
      r.cvesFixNotAvailable.some(c => c.toLowerCase().includes(q))
    )
  }
  if (filterSeverity.value) records = records.filter(r => r.severity === filterSeverity.value)
  if (filterStatus.value) records = records.filter(r => r.status === filterStatus.value)
  if (filterFixStatus.value) records = records.filter(r => r.fixStatus === filterFixStatus.value)

  const { column, direction } = tableSort.value
  const dir = direction === 'asc' ? 1 : -1
  records = [...records].sort((a, b) => {
    const av = a[column] || ''
    const bv = b[column] || ''
    return dir * av.localeCompare(bv)
  })

  return records
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRecords.value.length / pageSize)))
const paginationStart = computed(() => (currentPage.value - 1) * pageSize)
const paginatedRecords = computed(() => filteredRecords.value.slice(paginationStart.value, paginationStart.value + pageSize))

watch([searchQuery, filterSeverity, filterStatus, filterFixStatus], () => { currentPage.value = 1 })

function toggleSort(column) {
  if (tableSort.value.column === column) {
    tableSort.value.direction = tableSort.value.direction === 'asc' ? 'desc' : 'asc'
  } else {
    tableSort.value = { column, direction: 'asc' }
  }
}

function sortIcon(column) {
  if (tableSort.value.column !== column) return '▲▼'
  return tableSort.value.direction === 'asc' ? '▲' : '▼'
}

// ─── Chart data ─────────────────────────────────────────────────────────────

const CHART_COLORS = [
  'rgba(239, 68, 68, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(59, 130, 246, 0.8)',
  'rgba(16, 185, 129, 0.8)', 'rgba(139, 92, 246, 0.8)', 'rgba(236, 72, 153, 0.8)',
  'rgba(20, 184, 166, 0.8)', 'rgba(249, 115, 22, 0.8)', 'rgba(107, 114, 128, 0.8)',
  'rgba(99, 102, 241, 0.8)'
]

const SEVERITY_COLORS = {
  Critical: 'rgba(220, 38, 38, 0.85)',
  High: 'rgba(239, 68, 68, 0.8)',
  Medium: 'rgba(245, 158, 11, 0.8)',
  Low: 'rgba(59, 130, 246, 0.8)',
  Unknown: 'rgba(156, 163, 175, 0.8)'
}

const fixStatusChartData = computed(() => {
  const items = agg.value.byFixStatus
  return {
    labels: items.map(i => `${i.fixStatus} (${i.count})`),
    datasets: [{
      data: items.map(i => i.count),
      backgroundColor: items.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length]),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  }
})

const severityChartData = computed(() => {
  const items = agg.value.bySeverity
  return {
    labels: items.map(i => `${i.severity} (${i.count})`),
    datasets: [{
      data: items.map(i => i.count),
      backgroundColor: items.map(i => SEVERITY_COLORS[i.severity] || 'rgba(156, 163, 175, 0.8)'),
      borderWidth: 2,
      borderColor: '#fff'
    }]
  }
})

const packagesChartData = computed(() => {
  const items = agg.value.byPackage.slice(0, 20)
  return {
    labels: items.map(i => truncateLabel(i.package, 20)),
    datasets: [{
      label: 'Records',
      data: items.map(i => i.count),
      backgroundColor: items.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length]),
      borderWidth: 0,
      borderRadius: 3
    }]
  }
})

const componentsChartData = computed(() => {
  const items = agg.value.byComponent.slice(0, 20)
  return {
    labels: items.map(i => truncateLabel(i.component, 25)),
    datasets: [{
      label: 'Records',
      data: items.map(i => i.count),
      backgroundColor: items.map((_, idx) => CHART_COLORS[idx % CHART_COLORS.length]),
      borderWidth: 0,
      borderRadius: 3
    }]
  }
})

const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'right',
      labels: { padding: 8, font: { size: 10 }, color: '#6b7280', usePointStyle: true, pointStyle: 'circle', boxWidth: 8 }
    }
  }
}

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'x',
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => `${ctx.raw} records`
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { color: '#9ca3af', font: { size: 11 } },
      grid: { color: 'rgba(156, 163, 175, 0.15)' },
      title: { display: true, text: 'Record Count', color: '#9ca3af', font: { size: 11 } }
    },
    x: {
      ticks: { color: '#9ca3af', font: { size: 10 }, maxRotation: 45, minRotation: 30 },
      grid: { display: false }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function goBack() {
  nav.navigateTo('reports')
}

async function handleRefresh() {
  await refresh()
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function truncateLabel(str, max) {
  if (!str || str.length <= max) return str
  return str.slice(0, max) + '...'
}

function repoShortName(url) {
  if (!url) return '—'
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    return parts.slice(-2).join('/') || url
  } catch {
    return url
  }
}

function jiraKeyFromUrl(url) {
  if (!url) return ''
  const match = url.match(/browse\/([A-Z]+-\d+)/)
  return match ? match[1] : 'View'
}

function severityCardClass(severity) {
  const s = (severity || '').toLowerCase()
  if (s === 'critical') return 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
  if (s === 'high') return 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
  if (s === 'medium') return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
  if (s === 'low') return 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
  return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
}

function severityBadgeClass(severity) {
  const s = (severity || '').toLowerCase()
  if (s === 'critical') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
  if (s === 'high') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
  if (s === 'medium') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
  if (s === 'low') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}

function statusBadgeClass(status) {
  const s = (status || '').toLowerCase()
  if (s === 'new') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
  if (s === 'resolved') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  if (s === 'in progress') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}

function statusCardClass(status) {
  const s = (status || '').toLowerCase()
  if (s === 'new') return 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
  if (s === 'resolved') return 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
  if (s === 'in progress') return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
  return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
}

function fixStatusBadgeClass(fixStatus) {
  const s = (fixStatus || '').toLowerCase()
  if (s === 'fix available') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
  if (s === 'not available') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}

onMounted(() => {
  loadData()
})
</script>
