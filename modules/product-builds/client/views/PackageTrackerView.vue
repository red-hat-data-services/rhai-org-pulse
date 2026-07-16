<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePackageTracker } from '../composables/usePackageTracker'
import { useAuth } from '@shared/client/composables/useAuth'

const { isAdmin } = useAuth()
const { loading, refreshing, error, load, refresh, packages, summary } = usePackageTracker()

const JIRA_BASE = 'https://redhat.atlassian.net/browse'

const RISK_CONFIG = {
  overdue:  { label: 'Overdue',  icon: '●', color: '#c42f2f', bg: '#faeae8', border: 'border-red-300 dark:border-red-800', cardBorder: '#c42f2f' },
  at_risk:  { label: 'At Risk',  icon: '▲', color: '#8a6500', bg: '#fdf7e7', border: 'border-amber-300 dark:border-amber-800', cardBorder: '#8a6500' },
  on_track: { label: 'On Track', icon: '✓', color: '#006300', bg: '#f3faf2', border: 'border-green-300 dark:border-green-800', cardBorder: '#006300' },
  no_date:  { label: 'No Date',  icon: '—', color: '#6a6e73', bg: '#f5f5f5', border: 'border-gray-300 dark:border-gray-700', cardBorder: '#6a6e73' },
}

const STATUS_CATEGORY_COLORS = {
  'new':           'bg-gray-500',
  'indeterminate': 'bg-blue-600',
  'done':          'bg-green-600',
  'undefined':     'bg-gray-400',
}

const SUMMARY_CARDS = [
  { key: 'total',   label: 'Total Packages', color: '#2563eb' },
  { key: 'overdue', label: 'Overdue',        color: '#c42f2f', riskFilter: 'overdue' },
  { key: 'at_risk', label: 'At Risk',        color: '#8a6500', riskFilter: 'at_risk' },
  { key: 'on_track',label: 'On Track',       color: '#006300', riskFilter: 'on_track' },
]

const SORTABLE_COLUMNS = [
  { field: 'key',            label: 'EPIC',           width: 'w-[110px]' },
  { field: 'package',        label: 'Package',        width: 'min-w-[140px]' },
  { field: 'status',         label: 'Status',         width: 'w-[100px]' },
  { field: 'assignee',       label: 'Assignee',       width: 'w-[120px]' },
  { field: 'related_ticket', label: 'Related Ticket', width: 'w-[120px]' },
  { field: 'target_date',    label: 'Due Date',       width: 'w-[95px]' },
  { field: 'release',        label: 'Release',        width: 'w-[100px]' },
  { field: 'fix_version',    label: 'Fix Version',    width: 'w-[100px]' },
  { field: 'size',           label: 'Size',           width: 'w-[50px]' },
  { field: 'lead_time',      label: 'Lead Time',      width: 'w-[80px]' },
  { field: 'days_overdue',   label: 'Days',           width: 'w-[60px]' },
]

const RISK_PILLS = [
  { value: 'All', label: 'All' },
  { value: 'overdue', label: 'Overdue', icon: '●', color: '#c42f2f' },
  { value: 'at_risk', label: 'At Risk', icon: '▲', color: '#8a6500' },
  { value: 'on_track', label: 'On Track', icon: '✓', color: '#006300' },
  { value: 'no_date', label: 'No Date', icon: '—', color: '#6a6e73' },
]

// --- State ---
const riskFilter = ref('All')
const releaseFilter = ref('All')
const ticketSearch = ref('')
const sortField = ref('days_overdue')
const sortDir = ref('desc')
const expandedRows = ref(new Set())

// --- Computed ---
const releaseOptions = computed(() => {
  if (!packages.value.length) return []
  const set = new Set()
  for (const p of packages.value) set.add(p.release || 'None')
  return [...set].sort()
})

const filteredPackages = computed(() => {
  let list = packages.value
  if (riskFilter.value !== 'All') {
    list = list.filter(p => p.risk === riskFilter.value)
  }
  if (releaseFilter.value !== 'All') {
    const target = releaseFilter.value === 'None' ? null : releaseFilter.value
    list = list.filter(p => (p.release || null) === target)
  }
  if (ticketSearch.value) {
    const q = ticketSearch.value.toUpperCase()
    list = list.filter(p => p.related_ticket && p.related_ticket.toUpperCase().includes(q))
  }
  return [...list].sort((a, b) => {
    const av = a[sortField.value]
    const bv = b[sortField.value]
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
    return sortDir.value === 'desc' ? -cmp : cmp
  })
})

// --- Methods ---
function toggleSort(field) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDir.value = field === 'days_overdue' ? 'desc' : 'asc'
  }
}

function toggleRow(key) {
  const next = new Set(expandedRows.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedRows.value = next
}

function isJiraKey(str) {
  return str && /^[A-Z]+-\d+$/.test(str)
}

function setRiskFilterFromCard(card) {
  if (!card.riskFilter) {
    riskFilter.value = 'All'
  } else if (riskFilter.value === card.riskFilter) {
    riskFilter.value = 'All'
  } else {
    riskFilter.value = card.riskFilter
  }
}

onMounted(load)
</script>

<template>
  <div>
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
      <div class="mt-4 text-gray-500 dark:text-gray-400">Loading package tracker...</div>
    </div>

    <template v-else-if="summary">
      <!-- Summary cards -->
      <div class="flex gap-4 mb-6 flex-wrap">
        <button
          v-for="card in SUMMARY_CARDS"
          :key="card.key"
          class="flex-1 min-w-[140px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-center py-5 px-4 transition-all hover:shadow-md cursor-pointer"
          :class="card.riskFilter && riskFilter === card.riskFilter ? 'ring-2 ring-offset-1 ring-blue-400' : ''"
          @click="setRiskFilterFromCard(card)"
        >
          <div class="text-[42px] font-bold leading-none" :style="{ color: card.color }">{{ summary[card.key] }}</div>
          <div class="text-[13px] text-gray-500 dark:text-gray-400 mt-2">{{ card.label }}</div>
        </button>
      </div>

      <!-- Filter bar -->
      <div class="space-y-3 mb-4">
        <!-- Row 1: Risk pills -->
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-1">Risk</span>
          <button
            v-for="pill in RISK_PILLS"
            :key="pill.value"
            class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors"
            :class="riskFilter === pill.value
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'"
            @click="riskFilter = riskFilter === pill.value ? 'All' : pill.value"
          >
            <span v-if="pill.icon" class="text-[10px]" :style="riskFilter !== pill.value ? { color: pill.color } : {}">{{ pill.icon }}</span>
            {{ pill.label }}
          </button>
        </div>
        <!-- Row 2: Release pills + ticket search + refresh -->
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-1">Release</span>
          <button
            class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-colors"
            :class="releaseFilter === 'All'
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'"
            @click="releaseFilter = 'All'"
          >All</button>
          <button
            v-for="r in releaseOptions"
            :key="r"
            class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border transition-colors"
            :class="releaseFilter === r
              ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-gray-900 dark:border-gray-100'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'"
            @click="releaseFilter = releaseFilter === r ? 'All' : r"
          >{{ r }}</button>

          <div class="ml-auto flex items-center gap-3">
            <!-- Related ticket search -->
            <div class="relative">
              <input
                v-model="ticketSearch"
                type="text"
                placeholder="Search ticket..."
                class="text-sm border border-gray-300 dark:border-gray-600 rounded-lg pl-3 pr-7 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 w-40 placeholder:text-gray-400"
              />
              <button
                v-if="ticketSearch"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm"
                @click="ticketSearch = ''"
              >×</button>
            </div>
            <span v-if="summary.generated_at" class="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
              Updated {{ summary.generated_at.slice(0, 16).replace('T', ' ') }} UTC
            </span>
            <button
              v-if="isAdmin"
              :disabled="refreshing"
              class="px-3 py-1 text-sm font-medium text-white bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              @click="refresh"
            >
              {{ refreshing ? 'Refreshing...' : 'Refresh' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Count -->
      <div class="text-sm text-gray-500 dark:text-gray-400 mb-2">
        Showing {{ filteredPackages.length }} of {{ packages.length }} packages
      </div>

      <!-- Table -->
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <th class="w-8 py-2.5 px-2"></th>
              <th
                v-for="col in SORTABLE_COLUMNS"
                :key="col.field"
                class="text-left py-2.5 px-2 font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 select-none whitespace-nowrap"
                :class="col.width"
                @click="toggleSort(col.field)"
              >
                {{ col.label }}
                <span v-if="sortField === col.field" class="ml-0.5 text-blue-500">{{ sortDir === 'asc' ? '▲' : '▼' }}</span>
              </th>
              <th class="w-[75px] text-left py-2.5 px-2 font-medium text-gray-600 dark:text-gray-400">Risk</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700/50">
            <template v-for="pkg in filteredPackages" :key="pkg.key">
              <!-- Main row -->
              <tr
                class="transition-colors cursor-pointer"
                :class="pkg.risk === 'overdue' ? 'bg-red-50/50 dark:bg-red-900/5 hover:bg-red-50 dark:hover:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-750'"
                @click="pkg.children.length > 0 && toggleRow(pkg.key)"
              >
                <!-- Expand -->
                <td class="py-2 px-2 text-center text-gray-400">
                  <span v-if="pkg.children.length > 0" class="text-xs">{{ expandedRows.has(pkg.key) ? '▾' : '▸' }}</span>
                </td>
                <!-- EPIC -->
                <td class="py-2 px-2">
                  <a :href="`${JIRA_BASE}/${pkg.key}`" target="_blank" rel="noopener noreferrer" class="font-semibold text-blue-600 hover:underline" @click.stop>{{ pkg.key }}</a>
                </td>
                <!-- Package -->
                <td class="py-2 px-2 text-gray-900 dark:text-gray-200">{{ pkg.package }}</td>
                <!-- Status -->
                <td class="py-2 px-2">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white" :class="STATUS_CATEGORY_COLORS[pkg.status_category] || 'bg-gray-500'">{{ pkg.status }}</span>
                </td>
                <!-- Assignee -->
                <td class="py-2 px-2 text-gray-700 dark:text-gray-300 truncate max-w-[120px]" :title="pkg.assignee">{{ pkg.assignee }}</td>
                <!-- Related Ticket -->
                <td class="py-2 px-2">
                  <a v-if="isJiraKey(pkg.related_ticket)" :href="`${JIRA_BASE}/${pkg.related_ticket}`" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline" @click.stop>{{ pkg.related_ticket }}</a>
                  <span v-else class="text-gray-400">{{ pkg.related_ticket || '—' }}</span>
                </td>
                <!-- Due Date -->
                <td class="py-2 px-2 text-gray-700 dark:text-gray-300 tabular-nums">{{ pkg.target_date || '—' }}</td>
                <!-- Release -->
                <td class="py-2 px-2 text-gray-700 dark:text-gray-300">{{ pkg.release || '—' }}</td>
                <!-- Fix Version -->
                <td class="py-2 px-2 text-gray-700 dark:text-gray-300">{{ pkg.fix_version || '—' }}</td>
                <!-- Size -->
                <td class="py-2 px-2 text-gray-700 dark:text-gray-300">{{ pkg.size || '—' }}</td>
                <!-- Lead Time -->
                <td class="py-2 px-2 tabular-nums">
                  <template v-if="pkg.lead_time != null">
                    <span
                      class="inline-flex items-center gap-1 text-gray-700 dark:text-gray-300"
                      :title="pkg.lead_time_flag === 'critical' ? 'Critical: ≤3 days lead time' : pkg.lead_time_flag === 'tight' ? 'Tight: ≤7 days lead time' : 'Days between creation and due date'"
                    >
                      <span v-if="pkg.lead_time_flag === 'critical'" class="text-[8px]" style="color: #c42f2f">●</span>
                      <span v-else-if="pkg.lead_time_flag === 'tight'" class="text-[8px]" style="color: #8a6500">●</span>
                      {{ pkg.lead_time }}d<span v-if="pkg.lead_time_flag === 'critical'"> !!</span><span v-else-if="pkg.lead_time_flag === 'tight'"> !</span>
                    </span>
                  </template>
                  <span v-else class="text-gray-400">&mdash;</span>
                </td>
                <!-- Days -->
                <td class="py-2 px-2 tabular-nums">
                  <template v-if="pkg.days_overdue != null">
                    <span class="inline-flex items-center gap-1 text-gray-700 dark:text-gray-300">
                      <span v-if="pkg.days_overdue > 0" class="text-[8px]" style="color: #c42f2f">●</span>
                      {{ pkg.days_overdue > 0 ? '+' : '' }}{{ pkg.days_overdue }}
                    </span>
                  </template>
                  <span v-else class="text-gray-400">&mdash;</span>
                </td>
                <!-- Risk -->
                <td class="py-2 px-2">
                  <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                    :class="RISK_CONFIG[pkg.risk]?.border || ''"
                    :style="{ color: RISK_CONFIG[pkg.risk]?.color, backgroundColor: RISK_CONFIG[pkg.risk]?.bg }"
                  ><span class="text-[10px]">{{ RISK_CONFIG[pkg.risk]?.icon }}</span>{{ RISK_CONFIG[pkg.risk]?.label || pkg.risk }}</span>
                </td>
              </tr>
              <!-- Child rows -->
              <template v-if="expandedRows.has(pkg.key)">
                <tr
                  v-for="child in pkg.children"
                  :key="child.key"
                  class="bg-gray-50/70 dark:bg-gray-800/70"
                >
                  <td class="py-1.5 px-2"></td>
                  <td class="py-1.5 px-2 pl-6">
                    <a :href="`${JIRA_BASE}/${child.key}`" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline text-xs">{{ child.key }}</a>
                  </td>
                  <td class="py-1.5 px-2 text-gray-600 dark:text-gray-400 text-xs" colspan="8">{{ child.summary }}</td>
                  <td class="py-1.5 px-2" colspan="2">
                    <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium text-white" :class="STATUS_CATEGORY_COLORS[child.status_category] || 'bg-gray-500'">{{ child.status }}</span>
                  </td>
                  <td></td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>

        <!-- Empty state -->
        <div v-if="filteredPackages.length === 0 && packages.length > 0" class="text-center py-10 text-gray-500 dark:text-gray-400">
          No packages match the current filters.
        </div>
        <div v-if="packages.length === 0 && !loading" class="text-center py-10 text-gray-500 dark:text-gray-400">
          No open package EPICs found.
        </div>
      </div>
    </template>
  </div>
</template>
