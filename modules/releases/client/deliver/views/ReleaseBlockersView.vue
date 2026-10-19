<template>
  <div>
    <p v-if="effectiveReleaseNumbers.length" class="mb-4 text-right text-xs text-gray-500 dark:text-gray-400">
      Combining {{ effectiveReleaseNumbers.length }} selected release{{ effectiveReleaseNumbers.length === 1 ? '' : 's' }}
    </p>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <!-- Empty / no release selected -->
    <div v-else-if="!data && !effectiveReleaseNumbers.length" class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">Enter a release version above or select one from the filter bar to view blockers.</p>
    </div>

    <!-- Content -->
    <div v-else-if="data">
      <!-- Summary Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div
          data-testid="blocker-summary-total"
          class="rounded-lg border border-blue-200 bg-blue-50/50 p-4 text-left dark:border-blue-800 dark:bg-blue-900/10"
        >
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total Blockers</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ awarenessSummary.total }}</p>
        </div>
        <div
          data-testid="blocker-summary-proposed"
          class="rounded-lg border border-amber-200 bg-white p-4 text-left dark:border-amber-800 dark:bg-gray-800"
        >
          <p class="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">Proposed</p>
          <p class="text-2xl font-bold text-amber-700 dark:text-amber-300">{{ awarenessSummary.proposed }}</p>
        </div>
        <div
          data-testid="blocker-summary-approved"
          class="rounded-lg border border-red-200 bg-white p-4 text-left dark:border-red-800 dark:bg-gray-800"
        >
          <p class="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">Approved</p>
          <p class="text-2xl font-bold text-red-700 dark:text-red-300">{{ awarenessSummary.approved }}</p>
        </div>
        <div
          data-testid="blocker-summary-rejected"
          class="rounded-lg border border-emerald-200 bg-white p-4 text-left dark:border-emerald-800 dark:bg-gray-800"
        >
          <p class="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">Rejected</p>
          <p class="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{{ awarenessSummary.rejected }}</p>
        </div>
      </div>

      <!-- Release Blockers Awareness -->
      <section data-testid="blockers-awareness-trends" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Release Blockers Awareness</h3>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Issues with a Proposed, Approved, or Rejected Release blocker value.</p>
            </div>
            <span class="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">{{ visibleAwarenessTrends.length }} of {{ awarenessTrends.length }} issues</span>
          </div>

          <div class="flex items-end gap-2 flex-wrap">
            <label class="block">
              <span class="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Release Blocker</span>
              <select v-model="awarenessReleaseBlockerFilter" class="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All values</option>
                <option v-for="value in awarenessReleaseBlockerOptions" :key="value" :value="value">{{ value }}</option>
              </select>
            </label>
            <label class="block">
              <span class="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Fix Version</span>
              <select v-model="awarenessFixVersionFilter" class="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All fix versions</option>
                <option v-for="value in awarenessFixVersionOptions" :key="value" :value="value">{{ value }}</option>
              </select>
            </label>
            <label class="block">
              <span class="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Status</span>
              <select v-model="awarenessStatusFilter" class="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All statuses</option>
                <option v-for="value in awarenessStatusOptions" :key="value" :value="value">{{ value }}</option>
              </select>
            </label>
            <label class="block">
              <span class="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Team</span>
              <select v-model="awarenessTeamFilter" class="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All teams</option>
                <option v-for="value in awarenessTeamOptions" :key="value" :value="value">{{ value }}</option>
              </select>
            </label>
            <label class="block">
              <span class="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Component</span>
              <select v-model="awarenessComponentFilter" class="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">All components</option>
                <option v-for="value in awarenessComponentOptions" :key="value" :value="value">{{ value }}</option>
              </select>
            </label>
            <button v-if="awarenessHasActiveFilters" @click="clearAwarenessFilters" class="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Clear</button>
          </div>
        </div>

        <div v-if="visibleAwarenessTrends.length" class="overflow-x-auto scrollable-table">
          <table class="w-full text-sm">
            <thead class="sticky top-0 z-10">
              <tr class="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <th v-for="col in blockerColumns" :key="col.key"
                  class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide"
                  :class="col.sortable
                    ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none text-gray-500 dark:text-gray-400'
                    : 'text-gray-500 dark:text-gray-400'"
                  @click="col.sortable && toggleAwarenessSort(col.key)"
                >
                  {{ col.label }}
                  <span v-if="col.sortable" class="ml-0.5 inline-block w-3 text-center"
                    :class="awarenessSortKey === col.key ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'"
                  >{{ awarenessSortKey === col.key ? (awarenessSortDir === 'asc' ? '▲' : '▼') : '⇅' }}</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="issue in visibleAwarenessTrends" :key="issue.key" class="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td class="px-3 py-2"><a :href="issue.link" target="_blank" rel="noopener" class="text-xs text-blue-600 dark:text-blue-400 font-mono hover:underline">{{ issue.key }}</a></td>
                <td class="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 max-w-xs truncate" :title="issue.summary">{{ issue.summary }}</td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ issue.priority || '—' }}</td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ issue.issueType || '—' }}</td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ issue.status || '—' }}</td>
                <td class="px-3 py-2"><span :class="blockerStatusClass(issue.releaseBlockerStatus)" class="text-xs px-2 py-0.5 rounded-full font-medium">{{ issue.releaseBlockerStatus }}</span></td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ issue.isRegression || 'Unknown' }}</td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ issue.assignee || '—' }}</td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ issue.reporter || '—' }}</td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ (issue.fixVersions || []).join(', ') || '—' }}</td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ (issue.affectedVersions || []).join(', ') || '—' }}</td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ (issue.components || []).join(', ') || '—' }}</td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ issue.team || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="px-4 py-6 text-center">
          <p v-if="awarenessTrends.length" class="text-xs text-gray-400 dark:text-gray-500">No issues match the selected table filters.</p>
          <p v-else class="text-xs text-gray-400 dark:text-gray-500">No issues with a Release blocker value were found for this version.</p>
        </div>
      </section>

      <TriageReadinessTable :issues="triageReadinessIssues" />

      <!-- Historical trend charts intentionally use a separate, unfiltered data source. -->
      <BlockerTrendsSection :data="blockerTrendData" :loading="blockerTrendLoading" :error="blockerTrendError" />

      <!-- Continuous-improvement analysis uses the complete historical trend issue set, independently of page filters. -->
      <BlockerAnalysisSection :data="blockerAnalysisData" :loading="blockerAnalysisLoading" :error="blockerAnalysisError" />

      <!-- Test Sign-Off Risk Assessment -->
      <TfaRiskSection v-if="effectiveReleaseNumbers.length" :versions="effectiveReleaseNumbers" />

      <!-- Timing Breakdown + Aging Metrics row -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Code Freeze Timing</h3>
          <div class="space-y-2">
            <div class="w-full flex items-center justify-between px-2 py-1">
              <span class="text-xs text-gray-500 dark:text-gray-400">Before Code Freeze</span>
              <span class="text-sm font-bold text-blue-600 dark:text-blue-400">{{ data.timing.proposedBeforeCodeFreeze }}</span>
            </div>
            <div class="w-full flex items-center justify-between px-2 py-1">
              <span class="text-xs text-gray-500 dark:text-gray-400">After Code Freeze</span>
              <span class="text-sm font-bold text-orange-600 dark:text-orange-400">{{ data.timing.proposedAfterCodeFreeze }}</span>
            </div>
          </div>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Proposal → Decision</h3>
          <div v-if="data.aging.proposalToDecision.count" class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500 dark:text-gray-400">Avg</span>
              <span class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ data.aging.proposalToDecision.avg }}d</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500 dark:text-gray-400">Median</span>
              <span class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ data.aging.proposalToDecision.median }}d</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500 dark:text-gray-400">Max</span>
              <span class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ data.aging.proposalToDecision.max }}d</span>
            </div>
            <div class="text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-700">
              Based on {{ data.aging.proposalToDecision.count }} transition(s)
            </div>
          </div>
          <p v-else class="text-xs text-gray-400 dark:text-gray-500 italic">No transitions yet</p>
        </div>
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Approval → Resolution</h3>
          <div v-if="data.aging.approvalToResolution.count" class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500 dark:text-gray-400">Avg</span>
              <span class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ data.aging.approvalToResolution.avg }}d</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500 dark:text-gray-400">Median</span>
              <span class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ data.aging.approvalToResolution.median }}d</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-500 dark:text-gray-400">Max</span>
              <span class="text-sm font-bold text-gray-900 dark:text-gray-100">{{ data.aging.approvalToResolution.max }}d</span>
            </div>
            <div class="text-xs text-gray-400 dark:text-gray-500 pt-1 border-t border-gray-100 dark:border-gray-700">
              Based on {{ data.aging.approvalToResolution.count }} resolution(s)
            </div>
          </div>
          <p v-else class="text-xs text-gray-400 dark:text-gray-500 italic">No resolutions yet</p>
        </div>
      </div>

      <!-- Time in Status -->
      <div v-if="data.aging.byStatus" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Time in Status</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div v-for="s in statusDurations" :key="s.key" class="rounded-lg border p-3" :class="s.borderClass">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-medium uppercase tracking-wide" :class="s.labelClass">{{ s.label }}</span>
              <span class="text-xs text-gray-400 dark:text-gray-500">{{ s.stats.count }} issue(s)</span>
            </div>
            <div v-if="s.stats.count" class="flex items-baseline gap-4">
              <div class="text-center">
                <p class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ s.stats.avg }}d</p>
                <p class="text-xs text-gray-400 dark:text-gray-500">avg</p>
              </div>
              <div class="text-center">
                <p class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ s.stats.median }}d</p>
                <p class="text-xs text-gray-400 dark:text-gray-500">median</p>
              </div>
              <div class="text-center">
                <p class="text-lg font-bold text-gray-900 dark:text-gray-100">{{ s.stats.max }}d</p>
                <p class="text-xs text-gray-400 dark:text-gray-500">max</p>
              </div>
            </div>
            <p v-else class="text-xs text-gray-400 dark:text-gray-500 italic">No issues in this status</p>
          </div>
        </div>
      </div>

      <!-- Critical / Blocker Monitoring -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-800 overflow-hidden mb-6">
        <div class="px-4 py-3 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-semibold text-amber-700 dark:text-amber-400">Critical / Blocker Monitoring</h3>
            <span class="text-xs text-amber-600 dark:text-amber-500">Issues that may escalate to release blockers</span>
          </div>
          <span class="text-xs text-amber-600 dark:text-amber-500 font-medium">{{ data.criticalMonitoring.length }} issues</span>
        </div>
        <div v-if="data.criticalMonitoring.length" class="overflow-x-auto scrollable-table">
          <table class="w-full text-sm">
            <thead class="sticky top-0 z-10">
              <tr class="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <th v-for="col in criticalColumns" :key="col.key"
                  class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide"
                  :class="col.sortable
                    ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none text-gray-500 dark:text-gray-400'
                    : 'text-gray-500 dark:text-gray-400'"
                  @click="col.sortable && toggleCriticalSort(col.key)"
                >
                  {{ col.label }}
                  <span v-if="col.sortable" class="ml-0.5 inline-block w-3 text-center"
                    :class="criticalSortKey === col.key ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'"
                  >{{ criticalSortKey === col.key ? (criticalSortDir === 'asc' ? '▲' : '▼') : '⇅' }}</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="c in sortedCritical" :key="c.key" class="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td class="px-3 py-2">
                  <a :href="c.link" target="_blank" rel="noopener" class="text-xs text-blue-600 dark:text-blue-400 font-mono hover:underline">{{ c.key }}</a>
                </td>
                <td class="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 max-w-xs truncate">{{ c.summary }}</td>
                <td class="px-3 py-2">
                  <span :class="c.priority === 'Blocker' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'" class="text-xs font-medium">{{ c.priority }}</span>
                </td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ c.components.join(', ') || '—' }}</td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ c.status }}</td>
                <td class="px-3 py-2">
                  <span :class="blockerStatusClass(c.releaseBlockerStatus)" class="text-xs px-2 py-0.5 rounded-full font-medium">
                    {{ c.releaseBlockerStatus || 'None' }}
                  </span>
                </td>
                <td class="px-3 py-2 text-xs font-medium" :class="agingColor(c.daysInCurrentState !== null ? c.daysInCurrentState : c.daysOpen)">
                  {{ c.daysInCurrentState !== null ? c.daysInCurrentState + 'd' : c.daysOpen + 'd' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="px-4 py-6 text-center">
          <p class="text-xs text-amber-500 dark:text-amber-400">No critical or blocker-priority issues outside approved blockers.</p>
        </div>
      </div>

      <!-- Updated timestamp -->
      <div v-if="data.fetchedAt" class="mt-4 flex items-center justify-between">
        <p class="text-xs text-gray-400 dark:text-gray-500">
          Data fetched {{ formatDate(data.fetchedAt) }}
        </p>
        <button @click="refresh" :disabled="loading"
          class="text-xs text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
          Refresh
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, watch } from 'vue'
import { useReleaseBlockers } from '../composables/useReleaseBlockers.js'
import { useBlockerTrends } from '../composables/useBlockerTrends.js'
import { useBlockerAnalysis } from '../composables/useBlockerAnalysis.js'
import TfaRiskSection from '../components/TfaRiskSection.vue'
import BlockerTrendsSection from '../components/BlockerTrendsSection.vue'
import TriageReadinessTable from '../components/TriageReadinessTable.vue'
import BlockerAnalysisSection from '../components/BlockerAnalysisSection.vue'

const filter = inject('releaseFilter')

const filteredReleases = computed(function () {
  return filter.filteredReleases.value || []
})

const releaseRequests = computed(function () {
  var seen = new Set()
  return filteredReleases.value.filter(function (release) {
    if (!release.releaseNumber || seen.has(release.releaseNumber)) return false
    seen.add(release.releaseNumber)
    return true
  }).map(function (release) {
    return {
      releaseNumber: release.releaseNumber,
      codeFreezeDate: release.codeFreezeDate || null
    }
  })
})

const effectiveReleaseNumbers = computed(function () {
  return releaseRequests.value.map(function (release) { return release.releaseNumber })
})

const { data, loading, error, refresh } = useReleaseBlockers(releaseRequests)
const {
  data: blockerTrendData,
  loading: blockerTrendLoading,
  error: blockerTrendError
} = useBlockerTrends()

// Shared issue columns for the awareness table
const blockerColumns = [
  { key: 'key', label: 'Jira Key', sortable: true },
  { key: 'summary', label: 'Summary', sortable: false },
  { key: 'priority', label: 'Priority', sortable: true },
  { key: 'issueType', label: 'Issue type', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'releaseBlockerStatus', label: 'Release blocker', sortable: true },
  { key: 'isRegression', label: 'Is Regression', sortable: true },
  { key: 'assignee', label: 'Assignee', sortable: true },
  { key: 'reporter', label: 'Reporter', sortable: true },
  { key: 'fixVersions', label: 'Fix version', sortable: true },
  { key: 'affectedVersions', label: 'Affects version', sortable: true },
  { key: 'components', label: 'Component', sortable: true },
  { key: 'team', label: 'Team', sortable: true }
]

function sortRows(rows, key, dir) {
  var mult = dir === 'asc' ? 1 : -1
  return rows.sort(function (a, b) {
    var av = Array.isArray(a[key]) ? a[key].join(', ') : a[key]
    var bv = Array.isArray(b[key]) ? b[key].join(', ') : b[key]
    if (av === null && bv === null) return 0
    if (av === null) return mult
    if (bv === null) return -mult
    if (typeof av === 'number') return (av - bv) * mult
    if (typeof av === 'boolean') return ((av ? 1 : 0) - (bv ? 1 : 0)) * mult
    return String(av).localeCompare(String(bv)) * mult
  })
}

// Release Blockers Awareness filters and sorting
const awarenessReleaseBlockerFilter = ref('')
const awarenessFixVersionFilter = ref('')
const awarenessStatusFilter = ref('')
const awarenessTeamFilter = ref('')
const awarenessComponentFilter = ref('')
const awarenessSortKey = ref(null)
const awarenessSortDir = ref('desc')

const awarenessTrends = computed(function () {
  return (data.value && Array.isArray(data.value.awarenessTrends)) ? data.value.awarenessTrends : []
})

const {
  data: blockerAnalysisData,
  loading: blockerAnalysisLoading,
  error: blockerAnalysisError
} = useBlockerAnalysis(blockerTrendData)

const awarenessSummary = computed(function () {
  var summary = {
    proposed: 0,
    approved: 0,
    rejected: 0,
    total: awarenessTrends.value.length
  }

  for (var i = 0; i < awarenessTrends.value.length; i++) {
    var status = awarenessTrends.value[i].releaseBlockerStatus
    if (status === 'Proposed') summary.proposed++
    else if (status === 'Approved') summary.approved++
    else if (status === 'Rejected') summary.rejected++
  }

  return summary
})

function uniqueSortedValues(rows, key) {
  var values = new Set()
  for (var i = 0; i < rows.length; i++) {
    var value = rows[i][key]
    var entries = Array.isArray(value) ? value : [value]
    for (var j = 0; j < entries.length; j++) {
      if (entries[j]) values.add(entries[j])
    }
  }
  return Array.from(values).sort(function (a, b) { return String(a).localeCompare(String(b)) })
}

const awarenessReleaseBlockerOptions = computed(function () {
  var present = new Set(uniqueSortedValues(awarenessTrends.value, 'releaseBlockerStatus'))
  return ['Proposed', 'Approved', 'Rejected'].filter(function (status) { return present.has(status) })
})
const awarenessFixVersionOptions = computed(function () { return uniqueSortedValues(awarenessTrends.value, 'fixVersions') })
const awarenessStatusOptions = computed(function () { return uniqueSortedValues(awarenessTrends.value, 'status') })
const awarenessTeamOptions = computed(function () { return uniqueSortedValues(awarenessTrends.value, 'team') })
const awarenessComponentOptions = computed(function () { return uniqueSortedValues(awarenessTrends.value, 'components') })

const awarenessHasActiveFilters = computed(function () {
  return Boolean(
    awarenessReleaseBlockerFilter.value ||
    awarenessFixVersionFilter.value ||
    awarenessStatusFilter.value ||
    awarenessTeamFilter.value ||
    awarenessComponentFilter.value
  )
})

function clearAwarenessFilters() {
  awarenessReleaseBlockerFilter.value = ''
  awarenessFixVersionFilter.value = ''
  awarenessStatusFilter.value = ''
  awarenessTeamFilter.value = ''
  awarenessComponentFilter.value = ''
}

watch(effectiveReleaseNumbers, function () {
  clearAwarenessFilters()
  awarenessSortKey.value = null
  awarenessSortDir.value = 'desc'
})

function toggleAwarenessSort(key) {
  if (awarenessSortKey.value === key) {
    awarenessSortDir.value = awarenessSortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    awarenessSortKey.value = key
    awarenessSortDir.value = 'desc'
  }
}

function sortAwarenessByDefault(rows) {
  return rows.sort(function (a, b) {
    var aIsProposed = a.releaseBlockerStatus === 'Proposed'
    var bIsProposed = b.releaseBlockerStatus === 'Proposed'
    if (aIsProposed !== bIsProposed) return aIsProposed ? -1 : 1

    var aDate = (aIsProposed && a.latestProposedDate) || a.updated || a.created || ''
    var bDate = (bIsProposed && b.latestProposedDate) || b.updated || b.created || ''
    var dateOrder = String(bDate).localeCompare(String(aDate))
    return dateOrder || String(a.key).localeCompare(String(b.key))
  })
}

const triageReadinessIssues = computed(function () {
  return sortAwarenessByDefault(awarenessTrends.value.filter(function (issue) {
    return issue.releaseBlockerStatus === 'Proposed'
  }))
})

const visibleAwarenessTrends = computed(function () {
  var rows = awarenessTrends.value.slice()
  if (awarenessReleaseBlockerFilter.value) {
    rows = rows.filter(function (issue) { return issue.releaseBlockerStatus === awarenessReleaseBlockerFilter.value })
  }
  if (awarenessFixVersionFilter.value) {
    rows = rows.filter(function (issue) { return (issue.fixVersions || []).includes(awarenessFixVersionFilter.value) })
  }
  if (awarenessStatusFilter.value) {
    rows = rows.filter(function (issue) { return issue.status === awarenessStatusFilter.value })
  }
  if (awarenessTeamFilter.value) {
    rows = rows.filter(function (issue) { return issue.team === awarenessTeamFilter.value })
  }
  if (awarenessComponentFilter.value) {
    rows = rows.filter(function (issue) { return (issue.components || []).includes(awarenessComponentFilter.value) })
  }
  if (awarenessSortKey.value) return sortRows(rows, awarenessSortKey.value, awarenessSortDir.value)
  return sortAwarenessByDefault(rows)
})

// Critical monitoring table sorting
const criticalSortKey = ref('daysOpen')
const criticalSortDir = ref('desc')

const criticalColumns = [
  { key: 'key', label: 'Key', sortable: true },
  { key: 'summary', label: 'Summary', sortable: false },
  { key: 'priority', label: 'Priority', sortable: true },
  { key: 'components', label: 'Component', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'releaseBlockerStatus', label: 'Blocker Status', sortable: true },
  { key: 'daysOpen', label: 'Days Open', sortable: true }
]

function toggleCriticalSort(key) {
  if (criticalSortKey.value === key) {
    criticalSortDir.value = criticalSortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    criticalSortKey.value = key
    criticalSortDir.value = 'desc'
  }
}

const sortedCritical = computed(function () {
  var rows = (data.value && data.value.criticalMonitoring) ? data.value.criticalMonitoring.slice() : []
  return sortRows(rows, criticalSortKey.value, criticalSortDir.value)
})

var emptyStats = { avg: null, median: null, p90: null, max: null, count: 0 }

const statusDurations = computed(function () {
  var byStatus = (data.value && data.value.aging && data.value.aging.byStatus) || {}
  return [
    { key: 'proposed', label: 'Proposed', stats: byStatus.proposed || emptyStats, borderClass: 'border-amber-200 dark:border-amber-800', labelClass: 'text-amber-600 dark:text-amber-400' },
    { key: 'approved', label: 'Approved', stats: byStatus.approved || emptyStats, borderClass: 'border-red-200 dark:border-red-800', labelClass: 'text-red-600 dark:text-red-400' },
    { key: 'rejected', label: 'Rejected', stats: byStatus.rejected || emptyStats, borderClass: 'border-emerald-200 dark:border-emerald-800', labelClass: 'text-emerald-600 dark:text-emerald-400' }
  ]
})

function blockerStatusClass(status) {
  if (status === 'Proposed') return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
  if (status === 'Approved') return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
  if (status === 'Rejected') return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
}

function agingColor(days) {
  if (days === null || days === undefined) return 'text-gray-400 dark:text-gray-500'
  if (days >= 7) return 'text-red-600 dark:text-red-400'
  if (days >= 3) return 'text-amber-600 dark:text-amber-400'
  return 'text-gray-700 dark:text-gray-300'
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString()
}
</script>

<style scoped>
.scrollable-table {
  max-height: 24rem;
  overflow-y: auto;
  scrollbar-width: thin;
}
.scrollable-table::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.scrollable-table::-webkit-scrollbar-track {
  background: transparent;
}
.scrollable-table::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.4);
  border-radius: 4px;
}
.scrollable-table::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.6);
}
</style>
