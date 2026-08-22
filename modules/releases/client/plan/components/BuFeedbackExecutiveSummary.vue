<template>
  <div
    v-if="summary"
    class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden"
    data-testid="bu-feedback-exec-summary"
  >
    <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
      <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Executive Summary</h3>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Process-efficiency metrics across all {{ summary.total }} loaded BU / SSA feedback issues</p>
    </div>

    <div class="px-4 py-4 space-y-4">
      <ul class="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
        <li class="flex items-start gap-2">
          <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0"></span>
          <span>
            <strong>Avg Lead Time:</strong>
            {{ summary.avgLeadTime !== null ? summary.avgLeadTime + ' days' : 'N/A' }}
            <span class="text-xs text-gray-400 dark:text-gray-500">({{ summary.avgLeadTimeSample }} closed issues)</span>
          </span>
        </li>
        <li class="flex items-start gap-2">
          <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0"></span>
          <span>
            <strong>Avg Cycle Time:</strong>
            {{ summary.avgCycleTime !== null ? summary.avgCycleTime + ' days' : 'N/A' }}
            <span class="text-xs text-gray-400 dark:text-gray-500">({{ summary.avgCycleTimeSample }} issues with dev data)</span>
          </span>
        </li>
        <li class="flex items-start gap-2">
          <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0"></span>
          <span>
            <strong>Avg Open Issue Age:</strong>
            {{ summary.avgOpenAge !== null ? summary.avgOpenAge + ' days' : 'N/A' }}
            <span class="text-xs text-gray-400 dark:text-gray-500">({{ summary.avgOpenAgeSample }} open issues)</span>
          </span>
        </li>
        <li class="flex items-start gap-2">
          <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-500 shrink-0"></span>
          <span>
            <strong>Resolution Rate:</strong> {{ summary.resolutionRate }}%
            &middot; <strong>90-day Throughput:</strong> {{ summary.throughput }} closed
          </span>
        </li>
        <li v-if="summary.bottlenecks.length" class="flex items-start gap-2">
          <span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
          <span>
            <strong>Top Bottleneck:</strong> {{ summary.bottlenecks[0].component }}
            ({{ summary.bottlenecks[0].openCount }} open, avg {{ summary.bottlenecks[0].avgAge }}d)
          </span>
        </li>
      </ul>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="overflow-x-auto">
          <table class="w-full text-xs" data-testid="bu-feedback-metrics-table">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="text-left px-2 py-1.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Metric</th>
                <th class="text-right px-2 py-1.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Value</th>
                <th class="text-right px-2 py-1.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sample</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              <tr>
                <td class="px-2 py-1.5 text-gray-700 dark:text-gray-300">Avg Lead Time</td>
                <td class="px-2 py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">{{ fmt(summary.avgLeadTime, 'days') }}</td>
                <td class="px-2 py-1.5 text-right text-gray-500 dark:text-gray-400">{{ summary.avgLeadTimeSample }}</td>
              </tr>
              <tr>
                <td class="px-2 py-1.5 text-gray-700 dark:text-gray-300">Avg Cycle Time</td>
                <td class="px-2 py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">{{ fmt(summary.avgCycleTime, 'days') }}</td>
                <td class="px-2 py-1.5 text-right text-gray-500 dark:text-gray-400">{{ summary.avgCycleTimeSample }}</td>
              </tr>
              <tr>
                <td class="px-2 py-1.5 text-gray-700 dark:text-gray-300">Avg Open Age</td>
                <td class="px-2 py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">{{ fmt(summary.avgOpenAge, 'days') }}</td>
                <td class="px-2 py-1.5 text-right text-gray-500 dark:text-gray-400">{{ summary.avgOpenAgeSample }}</td>
              </tr>
              <tr>
                <td class="px-2 py-1.5 text-gray-700 dark:text-gray-300">Resolution Rate</td>
                <td class="px-2 py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">{{ summary.resolutionRate }}%</td>
                <td class="px-2 py-1.5 text-right text-gray-500 dark:text-gray-400">{{ summary.total }}</td>
              </tr>
              <tr>
                <td class="px-2 py-1.5 text-gray-700 dark:text-gray-300">Throughput ({{ summary.throughputWindowDays }}d)</td>
                <td class="px-2 py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">{{ summary.throughput }}</td>
                <td class="px-2 py-1.5 text-right text-gray-500 dark:text-gray-400">{{ summary.closedCount }}</td>
              </tr>
              <tr>
                <td class="px-2 py-1.5 text-gray-700 dark:text-gray-300">WIP (In Progress)</td>
                <td class="px-2 py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">{{ summary.wipCount }}</td>
                <td class="px-2 py-1.5 text-right text-gray-500 dark:text-gray-400">{{ summary.openCount }}</td>
              </tr>
              <tr>
                <td class="px-2 py-1.5 text-gray-700 dark:text-gray-300">Stale Open (&gt;{{ summary.staleThresholdDays }}d)</td>
                <td class="px-2 py-1.5 text-right font-medium" :class="summary.staleOpenCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'">{{ summary.staleOpenCount }}</td>
                <td class="px-2 py-1.5 text-right text-gray-500 dark:text-gray-400">{{ summary.openCount }}</td>
              </tr>
              <tr>
                <td class="px-2 py-1.5 text-gray-700 dark:text-gray-300">Unassigned Open</td>
                <td class="px-2 py-1.5 text-right font-medium" :class="summary.unassignedOpenCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'">{{ summary.unassignedOpenCount }}</td>
                <td class="px-2 py-1.5 text-right text-gray-500 dark:text-gray-400">{{ summary.openCount }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="summary.bottlenecks.length" class="overflow-x-auto">
          <table class="w-full text-xs" data-testid="bu-feedback-bottleneck-table">
            <thead>
              <tr class="border-b border-gray-200 dark:border-gray-700">
                <th class="text-left px-2 py-1.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Component Bottleneck</th>
                <th class="text-right px-2 py-1.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Open</th>
                <th class="text-right px-2 py-1.5 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Avg Age (d)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              <tr v-for="b in summary.bottlenecks" :key="b.component">
                <td class="px-2 py-1.5 text-gray-700 dark:text-gray-300 truncate max-w-[14rem]" :title="b.component">{{ b.component }}</td>
                <td class="px-2 py-1.5 text-right font-medium text-gray-900 dark:text-gray-100">{{ b.openCount }}</td>
                <td class="px-2 py-1.5 text-right text-gray-500 dark:text-gray-400">{{ b.avgAge }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { buildExecutiveSummary } from '../utils/bu-feedback-summary.js'

var props = defineProps({
  issues: { type: Array, default: function() { return [] } }
})

var summary = computed(function() {
  if (!props.issues || !props.issues.length) return null
  return buildExecutiveSummary(props.issues, new Date())
})

function fmt(value, unit) {
  if (value === null || value === undefined) return 'N/A'
  return value + ' ' + unit
}
</script>
