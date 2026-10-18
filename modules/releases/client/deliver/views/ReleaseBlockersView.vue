<template>
  <div>
    <!-- Version input + chip bar navigation -->
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <label class="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Version:</label>
      <input
        v-model="manualVersion"
        type="text"
        :placeholder="effectiveReleaseNumber || 'e.g. rhoai-3.5.EA1'"
        class="max-w-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        @keydown.enter="applyManualVersion"
      />
      <button
        @click="applyManualVersion"
        :disabled="!manualVersion.trim()"
        class="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >Load</button>
      <span v-if="appliedManualVersion" class="text-xs text-gray-400 dark:text-gray-500">
        Showing: <strong class="text-gray-600 dark:text-gray-300">{{ appliedManualVersion }}</strong>
        <button @click="clearManualVersion" class="ml-1 text-blue-500 hover:underline">&times; clear</button>
      </span>
      <!-- Chip bar navigation (when no manual override) -->
      <div v-if="!appliedManualVersion && filteredReleases.length > 1" class="flex items-center gap-2 ml-auto">
        <button :disabled="releaseIndex <= 0" @click="releaseIndex--" class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-30">&larr;</button>
        <span class="text-xs text-gray-500 dark:text-gray-400">{{ selectedRelease?.releaseNumber }} ({{ releaseIndex + 1 }}/{{ filteredReleases.length }})</span>
        <button :disabled="releaseIndex >= filteredReleases.length - 1" @click="releaseIndex++" class="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-30">&rarr;</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <!-- Empty / no release selected -->
    <div v-else-if="!data && !effectiveReleaseNumber" class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">Enter a release version above or select one from the filter bar to view blockers.</p>
    </div>

    <!-- Content -->
    <div v-else-if="data">
      <!-- Summary Cards (clickable as filters) -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <button
          @click="toggleStatusFilter(null)"
          class="text-left rounded-lg border p-4 transition-all"
          :class="activeStatusFilter === null
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 ring-2 ring-blue-300 dark:ring-blue-700'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'"
        >
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total Blockers</p>
          <p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ data.summary.total }}</p>
        </button>
        <button
          @click="toggleStatusFilter('Proposed')"
          class="text-left rounded-lg border p-4 transition-all"
          :class="activeStatusFilter === 'Proposed'
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-600 ring-2 ring-amber-300 dark:ring-amber-700'
            : 'bg-white dark:bg-gray-800 border-amber-200 dark:border-amber-800 hover:border-amber-300 dark:hover:border-amber-700'"
        >
          <p class="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">Proposed</p>
          <p class="text-2xl font-bold text-amber-700 dark:text-amber-300">{{ data.summary.proposed }}</p>
        </button>
        <button
          @click="toggleStatusFilter('Approved')"
          class="text-left rounded-lg border p-4 transition-all"
          :class="activeStatusFilter === 'Approved'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-400 dark:border-red-600 ring-2 ring-red-300 dark:ring-red-700'
            : 'bg-white dark:bg-gray-800 border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700'"
        >
          <p class="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide mb-1">Approved</p>
          <p class="text-2xl font-bold text-red-700 dark:text-red-300">{{ data.summary.approved }}</p>
        </button>
        <button
          @click="toggleStatusFilter('Rejected')"
          class="text-left rounded-lg border p-4 transition-all"
          :class="activeStatusFilter === 'Rejected'
            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-300 dark:ring-emerald-700'
            : 'bg-white dark:bg-gray-800 border-emerald-200 dark:border-emerald-800 hover:border-emerald-300 dark:hover:border-emerald-700'"
        >
          <p class="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">Rejected</p>
          <p class="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{{ data.summary.rejected }}</p>
        </button>
        <button
          @click="toggleStatusFilter('None')"
          class="text-left rounded-lg border p-4 transition-all"
          :class="activeStatusFilter === 'None'
            ? 'bg-gray-100 dark:bg-gray-700 border-gray-400 dark:border-gray-500 ring-2 ring-gray-300 dark:ring-gray-600'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'"
        >
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">No Status</p>
          <p class="text-2xl font-bold text-gray-600 dark:text-gray-400">{{ data.summary.noStatus }}</p>
        </button>
      </div>

      <!-- Blockers Awareness and Trends -->
      <section data-testid="blockers-awareness-trends" class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Blockers Awareness and Trends</h3>
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

      <!-- Test Sign-Off Risk Assessment -->
      <TfaRiskSection v-if="effectiveReleaseNumber" :version="effectiveReleaseNumber" />

      <!-- Timing Breakdown + Aging Metrics row -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Code Freeze Timing</h3>
          <div class="space-y-2">
            <button @click="toggleTimingFilter(true)" class="w-full flex items-center justify-between rounded px-2 py-1 transition-colors"
              :class="activeTimingFilter === true ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-750'">
              <span class="text-xs" :class="activeTimingFilter === true ? 'text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-500 dark:text-gray-400'">Before Code Freeze</span>
              <span class="text-sm font-bold text-blue-600 dark:text-blue-400">{{ data.timing.proposedBeforeCodeFreeze }}</span>
            </button>
            <button @click="toggleTimingFilter(false)" class="w-full flex items-center justify-between rounded px-2 py-1 transition-colors"
              :class="activeTimingFilter === false ? 'bg-orange-50 dark:bg-orange-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-750'">
              <span class="text-xs" :class="activeTimingFilter === false ? 'text-orange-700 dark:text-orange-300 font-medium' : 'text-gray-500 dark:text-gray-400'">After Code Freeze</span>
              <span class="text-sm font-bold text-orange-600 dark:text-orange-400">{{ data.timing.proposedAfterCodeFreeze }}</span>
            </button>
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

      <!-- Blockers Table -->
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Release Blockers</h3>
            <span class="text-xs text-gray-400 dark:text-gray-500">{{ visibleBlockers.length }} of {{ data.blockers.length }} issues</span>
          </div>
          <div v-if="activeStatusFilter !== null || activeTimingFilter !== null" class="flex items-center gap-2 flex-wrap">
            <span class="text-xs text-gray-500 dark:text-gray-400">Filters:</span>
            <button v-if="activeStatusFilter !== null" @click="activeStatusFilter = null"
              class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
              :class="blockerStatusClass(activeStatusFilter === 'None' ? null : activeStatusFilter)">
              {{ activeStatusFilter }} &times;
            </button>
            <button v-if="activeTimingFilter !== null" @click="activeTimingFilter = null"
              class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
              :class="activeTimingFilter ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'">
              {{ activeTimingFilter ? 'Pre-CF' : 'Post-CF' }} &times;
            </button>
            <button @click="clearFilters" class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline">Clear all</button>
          </div>
        </div>
        <div v-if="visibleBlockers.length" class="overflow-x-auto scrollable-table">
          <table class="w-full text-sm">
            <thead class="sticky top-0 z-10">
              <tr class="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <th v-for="col in blockerColumns" :key="col.key"
                  class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide"
                  :class="col.sortable
                    ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none text-gray-500 dark:text-gray-400'
                    : 'text-gray-500 dark:text-gray-400'"
                  @click="col.sortable && toggleSort(col.key)"
                >
                  {{ col.label }}
                  <span v-if="col.sortable" class="ml-0.5 inline-block w-3 text-center"
                    :class="sortKey === col.key ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'"
                  >{{ sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅' }}</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr v-for="b in visibleBlockers" :key="b.key" class="hover:bg-gray-50 dark:hover:bg-gray-750">
                <td class="px-3 py-2">
                  <a :href="b.link" target="_blank" rel="noopener" class="text-xs text-blue-600 dark:text-blue-400 font-mono hover:underline">{{ b.key }}</a>
                </td>
                <td class="px-3 py-2 text-xs text-gray-700 dark:text-gray-300 max-w-xs truncate">{{ b.summary }}</td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ b.priority || '—' }}</td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ b.issueType || '—' }}</td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ b.status }}</td>
                <td class="px-3 py-2">
                  <span :class="blockerStatusClass(b.releaseBlockerStatus)" class="text-xs px-2 py-0.5 rounded-full font-medium">
                    {{ b.releaseBlockerStatus || 'None' }}
                  </span>
                </td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ b.assignee || '—' }}</td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ b.reporter || '—' }}</td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ (b.fixVersions || []).join(', ') || '—' }}</td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ (b.affectedVersions || []).join(', ') || '—' }}</td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ b.components.join(', ') || '—' }}</td>
                <td class="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{{ b.team || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="px-4 py-6 text-center">
          <p v-if="data.blockers.length" class="text-xs text-gray-400 dark:text-gray-500">No blockers match the active filters.</p>
          <p v-else class="text-xs text-gray-400 dark:text-gray-500">No release blockers found for this version.</p>
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
import TfaRiskSection from '../components/TfaRiskSection.vue'

const filter = inject('releaseFilter')
const moduleNav = inject('moduleNav', null)

const filteredReleases = computed(function () {
  return filter.filteredReleases.value || []
})

const releaseIndex = ref(0)

watch(filteredReleases, function () {
  releaseIndex.value = 0
})

const selectedRelease = computed(function () {
  var releases = filteredReleases.value
  if (!releases.length) return null
  var idx = Math.min(releaseIndex.value, releases.length - 1)
  return releases[idx] || null
})

// Restore manual version from URL params on mount
function getParam(key) {
  var params = moduleNav && moduleNav.params ? moduleNav.params.value : {}
  return params[key] || null
}

function updateParams(updates) {
  if (moduleNav && moduleNav.updateParams) {
    moduleNav.updateParams(updates, { push: false })
  }
}

const manualVersion = ref(getParam('version') || '')
const appliedManualVersion = ref(getParam('version') || '')

function applyManualVersion() {
  var v = manualVersion.value.trim()
  if (v) {
    appliedManualVersion.value = v
    updateParams({ version: v })
  }
}

function clearManualVersion() {
  appliedManualVersion.value = ''
  manualVersion.value = ''
  updateParams({ version: '' })
}

const effectiveReleaseNumber = computed(function () {
  if (appliedManualVersion.value) return appliedManualVersion.value
  if (selectedRelease.value) return selectedRelease.value.releaseNumber
  return null
})

const codeFreezeDate = computed(function () {
  return selectedRelease.value ? (selectedRelease.value.codeFreezeDate || null) : null
})

const { data, loading, error, refresh } = useReleaseBlockers(effectiveReleaseNumber, codeFreezeDate)

// Filters — restore from URL params
var savedStatus = getParam('blockerStatus')
var savedTiming = getParam('timing')
const activeStatusFilter = ref(savedStatus || null)
const activeTimingFilter = ref(savedTiming === 'pre' ? true : savedTiming === 'post' ? false : null)

watch(data, function () {
  if (!getParam('blockerStatus')) activeStatusFilter.value = null
  if (!getParam('timing')) activeTimingFilter.value = null
})

function toggleStatusFilter(status) {
  activeStatusFilter.value = activeStatusFilter.value === status ? null : status
  updateParams({ blockerStatus: activeStatusFilter.value || '' })
}

function toggleTimingFilter(isBeforeCF) {
  activeTimingFilter.value = activeTimingFilter.value === isBeforeCF ? null : isBeforeCF
  var val = activeTimingFilter.value === true ? 'pre' : activeTimingFilter.value === false ? 'post' : ''
  updateParams({ timing: val })
}

function clearFilters() {
  activeStatusFilter.value = null
  activeTimingFilter.value = null
  updateParams({ blockerStatus: '', timing: '' })
}

// Blocker table sorting
const sortKey = ref('daysInCurrentState')
const sortDir = ref('desc')

const blockerColumns = [
  { key: 'key', label: 'Jira Key', sortable: true },
  { key: 'summary', label: 'Summary', sortable: false },
  { key: 'priority', label: 'Priority', sortable: true },
  { key: 'issueType', label: 'Issue type', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'releaseBlockerStatus', label: 'Release blocker', sortable: true },
  { key: 'assignee', label: 'Assignee', sortable: true },
  { key: 'reporter', label: 'Reporter', sortable: true },
  { key: 'fixVersions', label: 'Fix version', sortable: true },
  { key: 'affectedVersions', label: 'Affects version', sortable: true },
  { key: 'components', label: 'Component', sortable: true },
  { key: 'team', label: 'Team', sortable: true }
]

function toggleSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'desc'
  }
}

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

// Blockers Awareness and Trends filters and sorting
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

watch(effectiveReleaseNumber, function () {
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

const visibleBlockers = computed(function () {
  var rows = (data.value && data.value.blockers) ? data.value.blockers.slice() : []
  if (activeStatusFilter.value !== null) {
    if (activeStatusFilter.value === 'None') {
      rows = rows.filter(function (b) { return !b.releaseBlockerStatus })
    } else {
      rows = rows.filter(function (b) { return b.releaseBlockerStatus === activeStatusFilter.value })
    }
  }
  if (activeTimingFilter.value !== null) {
    rows = rows.filter(function (b) { return b.proposedBeforeCodeFreeze === activeTimingFilter.value })
  }
  return sortRows(rows, sortKey.value, sortDir.value)
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
