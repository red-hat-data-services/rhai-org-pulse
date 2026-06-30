<template>
  <div class="space-y-6">
    <!-- Breadcrumb -->
    <button
      class="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
      @click="goBack"
    >
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back to Timeline
    </button>

    <!-- Not found -->
    <div v-if="!match" class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 text-center">
      <p class="text-gray-500 dark:text-gray-400">Select an OKR from the Timeline view to see its detail.</p>
    </div>

    <template v-else>
      <!-- Header -->
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              :class="[overallStatus.bg, overallStatus.text]"
            >
              <span class="inline-block w-2 h-2 rounded-full" :class="overallStatus.dot" />
              {{ overallStatus.label }}
            </span>
            <span class="text-xs text-gray-400 dark:text-gray-500 font-medium">{{ match.category }}</span>
          </div>
          <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">{{ obj.name }}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 whitespace-pre-line">{{ obj.measure }}</p>
        </div>
      </div>

      <!-- Quarterly Progress Cards -->
      <div>
        <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Quarterly Progress</h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            v-for="q in quarters"
            :key="q"
            class="rounded-xl border p-4"
            :class="quarterCardClass(obj.quarters[q])"
          >
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-bold text-gray-800 dark:text-gray-200">{{ q }} {{ shortYear }}</span>
              <span
                class="inline-block w-3 h-3 rounded-full"
                :class="statusConfig[obj.quarters[q].status].dot"
              />
            </div>
            <p
              v-if="obj.quarters[q].summary"
              class="text-xs leading-relaxed whitespace-pre-line"
              :class="statusConfig[obj.quarters[q].status].text"
            >{{ obj.quarters[q].summary }}</p>
            <p v-else class="text-xs text-gray-300 dark:text-gray-600 italic">No data yet</p>
          </div>
        </div>
      </div>

      <!-- Key Results -->
      <div>
        <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Key Results</h3>
        <div v-if="obj.keyResults.length > 0" class="space-y-3">
          <div
            v-for="kr in obj.keyResults"
            :key="kr.id"
            class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 flex items-start gap-3"
          >
            <span
              class="inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0 mt-0.5"
              :class="statusConfig[kr.status].bg"
            >
              <span class="inline-block w-2.5 h-2.5 rounded-full" :class="statusConfig[kr.status].dot" />
            </span>
            <div class="min-w-0">
              <span class="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">{{ kr.label }}</span>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{{ kr.description }}</p>
            </div>
          </div>
        </div>
        <div v-else class="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 px-4 py-6 text-center">
          <p class="text-sm text-gray-400 dark:text-gray-500">No key results defined yet. These will be added when data is available.</p>
        </div>
      </div>

      <!-- Detailed Metrics Placeholder -->
      <div>
        <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Detailed Metrics</h3>
        <div class="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 px-4 py-10 text-center">
          <svg class="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <p class="text-sm text-gray-400 dark:text-gray-500">
            Detailed metrics and charts for <strong>{{ obj.name }}</strong> will appear here once data sources are connected.
          </p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { findObjectiveById, STATUS_CONFIG, QUARTERS, OKR_DATA } from '../data/mock-okrs.js'

var nav = inject('moduleNav', null)
var params = inject('routeParams', null)

var statusConfig = STATUS_CONFIG
var quarters = QUARTERS
var shortYear = String(OKR_DATA.year).slice(-2)

var okrId = computed(function() {
  if (params && params.value && params.value.okr) return params.value.okr
  return null
})

var match = computed(function() {
  if (!okrId.value) return null
  return findObjectiveById(okrId.value)
})

var obj = computed(function() {
  return match.value ? match.value.objective : null
})

var overallStatus = computed(function() {
  if (!obj.value) return statusConfig['not-started']
  var latestQ = null
  for (var i = 0; i < quarters.length; i++) {
    var q = obj.value.quarters[quarters[i]]
    if (q && q.status !== 'not-started') latestQ = q
  }
  if (!latestQ) return statusConfig['not-started']
  return statusConfig[latestQ.status]
})

function quarterCardClass(q) {
  if (!q || q.status === 'not-started') return 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
  var cfg = statusConfig[q.status]
  return cfg.bg + ' border-transparent'
}

function goBack() {
  if (nav) nav.navigateTo('timeline')
}
</script>
