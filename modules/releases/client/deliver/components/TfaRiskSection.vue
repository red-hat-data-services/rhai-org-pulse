<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-1">
      <div>
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Test Sign-Off Risk Assessment</h3>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Click any segment or row to expand details.</p>
      </div>
      <div v-if="overallStats.signoffTotal > 0" class="flex items-center gap-2">
        <span class="text-xs text-gray-400 dark:text-gray-500">
          {{ overallStats.signoffDone }}/{{ overallStats.signoffTotal }} sign-offs
        </span>
        <span v-if="overallStats.failedOpen > 0" class="text-xs text-red-500 dark:text-red-400 font-medium">
          {{ overallStats.failedOpen }} failed open
        </span>
      </div>
    </div>

    <!-- Threshold config tile -->
    <div class="mb-4 mt-2 px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700">
      <div class="flex items-center gap-4 flex-wrap">
        <span class="relative group flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 cursor-help">
          Risk Thresholds
          <svg class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"/><path stroke-width="2" stroke-linecap="round" d="M12 16v-4m0-4h.01"/></svg>
          <span class="hidden group-hover:block absolute left-0 top-full mt-1 w-64 p-2 rounded-md bg-gray-900 text-white text-xs z-20 shadow-lg leading-relaxed">
            Pillars with TFA completion below the Blocker value are flagged as likely release blockers. Those at or above On Track are considered safe. The gap between the two is the At Risk warning zone. On Track must be strictly greater than Blocker.
          </span>
        </span>
        <div class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>
          <span class="text-xs text-gray-500 dark:text-gray-400">Blocker &lt;</span>
          <input
            v-model.number="inputBlocker"
            type="number" min="0" max="100" step="5"
            class="w-12 px-1.5 py-0.5 text-xs text-center rounded border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1"
            :class="thresholdError ? 'border-red-300 dark:border-red-600 focus:border-red-400 focus:ring-red-300' : 'border-gray-300 dark:border-gray-600 focus:border-blue-400 focus:ring-blue-300'"
            @keydown.enter="applyThresholds"
          />
          <span class="text-xs text-gray-500 dark:text-gray-400">%</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
          <span class="text-xs text-gray-500 dark:text-gray-400">On Track &ge;</span>
          <input
            v-model.number="inputOnTrack"
            type="number" min="0" max="100" step="5"
            class="w-12 px-1.5 py-0.5 text-xs text-center rounded border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1"
            :class="thresholdError ? 'border-red-300 dark:border-red-600 focus:border-red-400 focus:ring-red-300' : 'border-gray-300 dark:border-gray-600 focus:border-blue-400 focus:ring-blue-300'"
            @keydown.enter="applyThresholds"
          />
          <span class="text-xs text-gray-500 dark:text-gray-400">%</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0"></span>
          <span class="text-xs text-gray-500 dark:text-gray-400">At Risk</span>
          <span class="text-xs font-medium text-amber-600 dark:text-amber-400">{{ atRiskRange }}</span>
        </div>
        <button
          @click="applyThresholds"
          class="px-3 py-1 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >Apply</button>
      </div>
      <p v-if="thresholdError" class="mt-1.5 text-xs text-red-500 dark:text-red-400">{{ thresholdError }}</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="py-4">
      <p class="text-xs text-red-500 dark:text-red-400">{{ error }}</p>
    </div>

    <!-- No data -->
    <div v-else-if="!pillarRiskData.length" class="py-4 text-center">
      <p class="text-xs text-gray-400 dark:text-gray-500">No TFA sign-off data available for this version.</p>
    </div>

    <!-- Content -->
    <template v-else>
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <!-- Charts (left, col-span-2) -->
        <div class="lg:col-span-2 space-y-3">
          <p class="text-xs font-medium text-gray-500 dark:text-gray-400 px-1">TFA Completion by Pillar</p>
          <p class="text-xs text-gray-400 dark:text-gray-500 px-1">Grouped by product pillar. Outer ring = pillars, inner ring = done vs remaining.</p>
          <TfaRiskChart
            :pillar-data="pillarRiskData"
            :overall-pct="overallStats.signoffPct"
            :overall-done="overallStats.signoffDone"
            :overall-total="overallStats.signoffTotal"
            :selected-pillar="lastClickedPillar"
            @select-pillar="handleChartClick"
            @select-status="handleStatusClick"
          />
          <div>
            <p class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 px-1">Sign-offs vs Failed Tests</p>
            <TfaOutcomeChart
              :signoff-done="overallStats.signoffDone"
              :failed-open="overallStats.failedOpen"
              @select-outcome="handleOutcomeClick"
            />
          </div>
        </div>

        <!-- Pillar summary table (right, col-span-3) -->
        <div class="lg:col-span-3 overflow-y-auto scrollable-table" style="max-height: 520px;">
          <div class="space-y-1">
            <div v-for="pillar in pillarRiskData" :key="pillar.pillarName">
              <!-- Pillar row -->
              <button
                @click="togglePillar(pillar.pillarName)"
                class="w-full flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors group cursor-pointer"
                :class="isExpanded(pillar.pillarName)
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-750'"
              >
                <!-- Risk badge -->
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
                  :class="riskBadgeClass(pillar.riskLevel)"
                >{{ riskLabel(pillar.riskLevel) }}</span>

                <!-- Color dot (matches chart segment) -->
                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ backgroundColor: pillarColorBorder(pillar.pillarName) }"></span>

                <!-- Pillar name -->
                <span class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate" style="width: 130px; flex-shrink: 0;">{{ pillar.pillarName }}</span>

                <!-- Progress bar -->
                <div class="flex-1 min-w-0" style="min-width: 80px;">
                  <div class="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all"
                      :class="riskBarClass(pillar.riskLevel)"
                      :style="{ width: pillar.pct + '%' }"
                    ></div>
                  </div>
                </div>

                <!-- Stats -->
                <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
                  {{ pillar.done }}/{{ pillar.total }} ({{ pillar.pct }}%)
                </span>
                <span v-if="pillar.failedOpen > 0" class="text-xs text-red-500 dark:text-red-400 font-medium whitespace-nowrap">
                  {{ pillar.failedOpen }} failed
                </span>

                <!-- Expand indicator -->
                <span class="flex items-center gap-1 text-xs transition-colors flex-shrink-0" :class="isExpanded(pillar.pillarName) ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'">
                  <span>{{ pillar.componentCount }}</span>
                  <span>{{ isExpanded(pillar.pillarName) ? '▾' : '▸' }}</span>
                </span>
              </button>

              <!-- Expanded component sub-list -->
              <div v-if="isExpanded(pillar.pillarName)" class="ml-4 pl-3 border-l-2 border-blue-200 dark:border-blue-800 space-y-1 pb-1">
                <div
                  v-for="comp in pillar.components"
                  :key="comp.name"
                  class="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
                >
                  <a v-if="comp.signoffJqlUrl" :href="comp.signoffJqlUrl" target="_blank" rel="noopener"
                    class="text-blue-600 dark:text-blue-400 font-medium hover:underline min-w-0 truncate" style="max-width: 160px;">
                    {{ comp.name }}
                  </a>
                  <span v-else class="text-gray-700 dark:text-gray-300 font-medium min-w-0 truncate" style="max-width: 160px;">{{ comp.name }}</span>
                  <span :class="riskTextClass(comp.riskLevel)" class="whitespace-nowrap tabular-nums">
                    {{ comp.signoffs.done }}/{{ comp.signoffs.total }}
                  </span>
                  <span v-if="uniqueAssignees(comp).length" class="text-gray-400 dark:text-gray-500 truncate" style="max-width: 140px;">
                    {{ uniqueAssignees(comp).join(', ') }}
                  </span>
                  <a v-if="comp.failedOpen > 0 && comp.failedJqlUrl" :href="comp.failedJqlUrl" target="_blank" rel="noopener"
                    class="ml-auto text-red-500 dark:text-red-400 font-medium whitespace-nowrap hover:underline">
                    {{ comp.failedOpen }} failed
                  </a>
                  <span v-else-if="comp.failedOpen > 0" class="ml-auto text-red-500 dark:text-red-400 font-medium whitespace-nowrap">
                    {{ comp.failedOpen }} failed
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Risk verdict banner -->
      <button
        v-if="pillarsAtRisk > 0"
        @click="expandAtRiskPillars"
        class="mt-3 w-full px-3 py-2 rounded-md text-xs font-medium text-left cursor-pointer transition-opacity hover:opacity-80"
        :class="verdictClass"
      >{{ verdictText }}</button>
      <div
        v-else-if="pillarRiskData.length"
        class="mt-3 px-3 py-2 rounded-md text-xs font-medium"
        :class="verdictClass"
      >{{ verdictText }}</div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, toRef } from 'vue'
import TfaRiskChart from './TfaRiskChart.vue'
import TfaOutcomeChart from './TfaOutcomeChart.vue'
import { useTfaRiskAssessment } from '../composables/useTfaRiskAssessment.js'
import { getPillarColor } from '../composables/pillarColors.js'

var props = defineProps({
  version: { type: String, required: true }
})

var inputBlocker = ref(50)
var inputOnTrack = ref(80)
var appliedBlocker = ref(50)
var appliedOnTrack = ref(80)
var thresholdError = ref('')

function validateThresholds() {
  var b = parseInt(inputBlocker.value, 10)
  var g = parseInt(inputOnTrack.value, 10)
  if (isNaN(b) || isNaN(g)) return 'Values must be numbers 0–100'
  if (b < 0 || b > 100 || g < 0 || g > 100) return 'Values must be between 0 and 100'
  if (g < b) return 'On Track must be greater than or equal to Blocker'
  if (g === b) return 'On Track must be greater than Blocker to have an At Risk zone'
  return ''
}

function applyThresholds() {
  var err = validateThresholds()
  thresholdError.value = err
  if (err) return
  appliedBlocker.value = parseInt(inputBlocker.value, 10)
  appliedOnTrack.value = parseInt(inputOnTrack.value, 10)
}

var atRiskRange = computed(function () {
  return appliedBlocker.value + '–' + (appliedOnTrack.value - 1) + '%'
})

var thresholdsRef = computed(function () {
  return { green: appliedOnTrack.value, yellow: appliedBlocker.value }
})

var {
  pillarRiskData,
  overallStats,
  pillarsAtRisk,
  expandedPillars,
  loading,
  error
} = useTfaRiskAssessment(toRef(props, 'version'), thresholdsRef)

var lastClickedPillar = ref(null)

function isExpanded(name) {
  return !!expandedPillars.value[name]
}

function togglePillar(name) {
  var copy = Object.assign({}, expandedPillars.value)
  if (copy[name]) {
    delete copy[name]
    lastClickedPillar.value = null
  } else {
    copy[name] = true
    lastClickedPillar.value = name
  }
  expandedPillars.value = copy
}

function handleChartClick(name) {
  togglePillar(name)
}

function toggleGroup(matchFn) {
  var data = pillarRiskData.value
  var targets = []
  for (var i = 0; i < data.length; i++) {
    if (matchFn(data[i])) targets.push(data[i].pillarName)
  }
  var allOpen = targets.every(function (n) { return expandedPillars.value[n] })
  var copy = Object.assign({}, expandedPillars.value)
  for (var j = 0; j < targets.length; j++) {
    if (allOpen) {
      delete copy[targets[j]]
    } else {
      copy[targets[j]] = true
    }
  }
  expandedPillars.value = copy
}

function handleStatusClick(status) {
  toggleGroup(function (p) {
    if (status === 'done') return p.done > 0 && p.done === p.total
    return p.total > p.done || p.failedOpen > 0
  })
}

function handleOutcomeClick(outcome) {
  toggleGroup(function (p) {
    if (outcome === 'done') return p.done > 0
    return p.failedOpen > 0
  })
}

function expandAtRiskPillars() {
  toggleGroup(function (p) {
    return p.riskLevel === 'red' || p.riskLevel === 'yellow'
  })
}

function pillarColorBorder(name) {
  return getPillarColor(name).border
}

function uniqueAssignees(comp) {
  var seen = {}
  var result = []
  var issues = comp.issues || []
  for (var i = 0; i < issues.length; i++) {
    var a = issues[i].assignee
    if (a && !seen[a]) {
      seen[a] = true
      result.push(a)
    }
  }
  return result
}

function riskBadgeClass(level) {
  if (level === 'red') return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
  if (level === 'yellow') return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
  return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
}

function riskBarClass(level) {
  if (level === 'red') return 'bg-red-500'
  if (level === 'yellow') return 'bg-amber-500'
  return 'bg-emerald-500'
}

function riskTextClass(level) {
  if (level === 'red') return 'text-red-600 dark:text-red-400 font-medium'
  if (level === 'yellow') return 'text-amber-600 dark:text-amber-400 font-medium'
  return 'text-emerald-600 dark:text-emerald-400'
}

function riskLabel(level) {
  if (level === 'red') return 'Likely Blocker'
  if (level === 'yellow') return 'At Risk'
  return 'On Track'
}

var hasRedPillars = computed(function () {
  return pillarRiskData.value.some(function (p) { return p.riskLevel === 'red' })
})

var verdictClass = computed(function () {
  if (hasRedPillars.value) {
    return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
  }
  if (pillarsAtRisk.value > 0) {
    return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
  }
  return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
})

var verdictText = computed(function () {
  var redCount = 0
  var yellowCount = 0
  var names = []
  for (var i = 0; i < pillarRiskData.value.length; i++) {
    var p = pillarRiskData.value[i]
    if (p.riskLevel === 'red') { redCount++; names.push(p.pillarName) }
    else if (p.riskLevel === 'yellow') { yellowCount++; names.push(p.pillarName) }
  }
  var total = redCount + yellowCount
  if (total > 0) {
    var summary = names.join(', ')
    if (redCount > 0 && yellowCount > 0) {
      return total + ' pillar(s) at risk: ' + summary + ' — click to expand all'
    }
    if (redCount > 0) return total + ' pillar(s) likely to block release: ' + summary + ' — click to expand'
    return total + ' pillar(s) at risk: ' + summary + ' — click to expand'
  }
  return 'All pillars on track for release'
})
</script>

<style scoped>
.scrollable-table {
  scrollbar-width: thin;
}
.scrollable-table::-webkit-scrollbar {
  width: 6px;
}
.scrollable-table::-webkit-scrollbar-track {
  background: transparent;
}
.scrollable-table::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.4);
  border-radius: 3px;
}
.scrollable-table::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.6);
}
</style>
