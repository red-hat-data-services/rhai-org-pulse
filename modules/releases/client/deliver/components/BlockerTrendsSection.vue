<template>
  <section data-testid="blocker-trends" class="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <div class="grid items-start gap-4 border-b border-gray-100 px-5 py-5 sm:grid-cols-[minmax(0,1fr)_auto] dark:border-gray-700">
      <div>
        <h3 class="text-base font-semibold text-gray-800 dark:text-gray-100">Release Blocker Trends</h3>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Historical Approved and Rejected blocker volume across all releases, independent of page filters.</p>
      </div>

      <div class="inline-flex items-center justify-self-end rounded-xl bg-gray-100 p-1 shadow-inner dark:bg-gray-900/70" role="group" aria-label="Blocker trend view">
        <button
          type="button"
          :aria-pressed="view === 'release'"
          class="rounded-lg px-4 py-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-1 dark:focus:ring-offset-gray-800"
          :class="view === 'release' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
          @click="view = 'release'"
        >
          Trend by Release
        </button>
        <button
          data-testid="blocker-trends-toggle"
          type="button"
          :aria-pressed="view === 'component'"
          class="rounded-lg px-4 py-2 text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-1 dark:focus:ring-offset-gray-800"
          :class="view === 'component' ? 'bg-orange-500 text-white shadow-md' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'"
          @click="view = 'component'"
        >
          Trend by Component
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="animate-spin rounded-full h-7 w-7 border-b-2 border-orange-500"></div>
    </div>
    <div v-else-if="error" class="m-5 rounded-lg bg-red-50 p-5 text-center dark:bg-red-900/20">
      <p class="text-xs text-red-600 dark:text-red-400">{{ error }}</p>
    </div>
    <div v-else-if="!activeRows.length" class="py-20 text-center">
      <p class="text-xs text-gray-400 dark:text-gray-500">No Approved or Rejected blocker trend data is available.</p>
    </div>
    <template v-else>
      <div class="p-5">
        <div class="overflow-hidden rounded-xl border border-gray-200 bg-gray-50/70 dark:border-gray-700 dark:bg-gray-900/30">
          <div class="flex flex-wrap items-center gap-5 border-b border-gray-200 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
            <span class="inline-flex items-center gap-2"><span class="h-3 w-3 rounded-sm bg-emerald-500 shadow-sm"></span>Approved</span>
            <span class="inline-flex items-center gap-2"><span class="h-3 w-3 rounded-sm bg-red-500 shadow-sm"></span>Rejected</span>
            <span class="ml-auto rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-400 shadow-sm ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:ring-gray-700">Raw historical totals</span>
          </div>

          <div class="overflow-x-auto px-4 pb-4 pt-2">
            <div :style="{ minWidth: chartMinWidth }">
              <div class="flex h-72 items-stretch gap-4 border-b border-gray-300 px-2 dark:border-gray-600">
                <div v-for="row in activeRows" :key="row.label" class="flex h-full min-w-[80px] flex-1 flex-col">
                  <div class="flex min-h-0 flex-1 items-end justify-center gap-2 pt-8">
                    <div class="relative flex h-full w-7 items-end justify-center">
                      <div class="relative w-full rounded-t-md bg-emerald-500 shadow-sm ring-1 ring-emerald-600/20 transition-all" :style="{ height: barHeight(row.approved) }" :title="`${row.label}: ${row.approved} Approved`">
                        <span v-if="row.approved" class="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-emerald-600 dark:text-emerald-400">{{ row.approved }}</span>
                      </div>
                    </div>
                    <div class="relative flex h-full w-7 items-end justify-center">
                      <div class="relative w-full rounded-t-md bg-red-500 shadow-sm ring-1 ring-red-600/20 transition-all" :style="{ height: barHeight(row.rejected) }" :title="`${row.label}: ${row.rejected} Rejected`">
                        <span v-if="row.rejected" class="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-red-600 dark:text-red-400">{{ row.rejected }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="flex h-16 items-start justify-center border-t border-gray-200 px-1 pt-3 dark:border-gray-700">
                    <span class="line-clamp-2 w-full text-center text-xs font-medium leading-4 text-gray-600 dark:text-gray-400" :title="row.label">{{ row.label }}</span>
                  </div>
                </div>
              </div>
              <div class="mt-3 flex items-center justify-between px-2 text-xs text-gray-400 dark:text-gray-500">
                <span>0</span>
                <span class="font-medium">Total blockers by {{ view === 'release' ? 'release version' : 'component' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'

var props = defineProps({
  data: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' }
})

var view = ref('release')

var activeRows = computed(function () {
  if (!props.data) return []
  return view.value === 'release' ? (props.data.releases || []) : (props.data.components || [])
})

var maxValue = computed(function () {
  return Math.max.apply(null, activeRows.value.map(function (row) {
    return Math.max(row.approved || 0, row.rejected || 0)
  }).concat([1]))
})

var chartMinWidth = computed(function () {
  return Math.max(720, activeRows.value.length * 96) + 'px'
})

function barHeight(value) {
  if (!value) return '0%'
  return Math.max(5, Math.round((value / maxValue.value) * 100)) + '%'
}
</script>
