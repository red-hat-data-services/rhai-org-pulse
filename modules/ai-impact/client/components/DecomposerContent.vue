<script setup>
import { ref, computed, watch } from 'vue'
import DecomposerMetricsRow from './DecomposerMetricsRow.vue'
import DecomposerCharts from './DecomposerCharts.vue'

const props = defineProps({
  snapshot: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null }
})

defineEmits(['retry', 'selectStrategy'])

const PAGE_SIZE = 10

const searchQuery = ref('')
const timeWindow = ref('month') // all | week | month | 3months
const currentPage = ref(1)

const WINDOW_DAYS = { week: 7, month: 30, '3months': 90 }

const isFiltered = computed(() => !!searchQuery.value || timeWindow.value !== 'all')

// Cutoff (ms) for the selected window, or null for "all time".
const cutoff = computed(() => {
  const days = WINDOW_DAYS[timeWindow.value]
  return days ? Date.now() - days * 24 * 60 * 60 * 1000 : null
})

// A strategy's decomposition date = its most recent run (run_history run_ids
// are ISO-ish timestamps, e.g. "2026-06-29T14-51-14Z").
function strategyDateMs(s) {
  let latest = 0
  for (const h of s.run_history || []) {
    const d = new Date((h.run_id || '').slice(0, 10)).getTime()
    if (!isNaN(d) && d > latest) latest = d
  }
  return latest
}

// Volume stats for a set of strategies. Unique strategies + submitted epics
// (jira_key set) reconcile exactly to aggregates.unique_strategies/total_epics.
function statsFor(list) {
  const strategies = list.length
  const epics = list.reduce((acc, s) => acc + (s.epics || []).filter(e => e.jira_key).length, 0)
  const passing = list.filter(s => s.review && s.review.pass).length
  const passRate = strategies ? Math.round((passing / strategies) * 100) : 0
  return { strategies, epics, passRate }
}

// Current-vs-prior volume for the selected window (prev period = same length
// immediately before the window). "All time" has no prior period.
const volume = computed(() => {
  const days = WINDOW_DAYS[timeWindow.value]
  if (!days) {
    return { windowed: false, current: statsFor(allStrategies.value), prior: null }
  }
  const now = Date.now()
  const cut = now - days * 24 * 60 * 60 * 1000
  const prevCut = cut - days * 24 * 60 * 60 * 1000
  const inRange = (lo, hi) => allStrategies.value.filter(s => {
    const d = strategyDateMs(s)
    return d && d >= lo && (hi == null || d < hi)
  })
  return { windowed: true, current: statsFor(inRange(cut, null)), prior: statsFor(inRange(prevCut, cut)) }
})

const hasData = computed(() => !!props.snapshot?.aggregates && (props.snapshot?.runs?.length || 0) > 0)
const generatedAt = computed(() => props.snapshot?.generatedAt)
const allStrategies = computed(() => props.snapshot?.strategies || [])
const jiraHost = computed(() => (props.snapshot?.jiraHost || 'https://redhat.atlassian.net').replace(/\/$/, ''))

function browseUrl(key) {
  return `${jiraHost.value}/browse/${key}`
}

const filteredStrategies = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const cut = cutoff.value
  return allStrategies.value.filter(s => {
    if (cut != null) {
      const d = strategyDateMs(s)
      if (!d || d < cut) return false
    }
    if (q && !((s.strat_id || '').toLowerCase().includes(q) || (s.title || '').toLowerCase().includes(q))) return false
    return true
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredStrategies.value.length / PAGE_SIZE)))

const pagedStrategies = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredStrategies.value.slice(start, start + PAGE_SIZE)
})

watch([searchQuery, timeWindow], () => { currentPage.value = 1 })

function goToPage(p) {
  currentPage.value = Math.min(Math.max(1, p), totalPages.value)
}

function recClass(rec) {
  if (rec === 'accept') return 'text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/40'
  if (rec === 'reject') return 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40'
  return 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40'
}
</script>

<template>
  <div class="flex-1 overflow-y-auto">
    <!-- Header / top filter bar -->
    <header class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between gap-4">
      <div>
        <h1 class="text-lg font-semibold dark:text-gray-100">Feature Decomposer</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Epic decomposition pipeline — strategies broken into epics
          <span v-if="generatedAt"> · generated {{ generatedAt.slice(0, 10) }}</span>
        </p>
      </div>
      <div v-if="hasData" class="flex items-center gap-2 shrink-0">
        <label for="decomposer-showing" class="text-sm text-gray-500 dark:text-gray-400">Showing:</label>
        <select
          id="decomposer-showing"
          v-model="timeWindow"
          class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="all">All time</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="3months">Last 3 Months</option>
        </select>
      </div>
    </header>

    <div v-if="loading && !hasData" class="p-12 text-center text-gray-500 dark:text-gray-400">
      Loading decomposer data…
    </div>

    <div v-else-if="error" class="p-12 text-center">
      <p class="text-red-600 dark:text-red-400 mb-3">{{ error }}</p>
      <button @click="$emit('retry')" class="px-4 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 dark:text-gray-200">
        Retry
      </button>
    </div>

    <div v-else-if="!hasData" class="p-12 text-center text-gray-500 dark:text-gray-400">
      Decomposer data will appear here once the epic-decomposer pipeline pushes results.
    </div>

    <template v-else>
      <DecomposerMetricsRow :aggregates="snapshot.aggregates" :counts="snapshot.counts" :volume="volume" />
      <DecomposerCharts
        :runs="snapshot.runs"
        :aggregates="snapshot.aggregates"
        :cutoff="cutoff"
      />

      <!-- Strategy list -->
      <div class="px-6 pb-8">
        <div class="flex items-center justify-between gap-4 mb-3 flex-wrap">
          <h2 class="text-sm font-medium dark:text-gray-300">
            Strategies
            <span class="text-gray-400 dark:text-gray-500">({{ filteredStrategies.length }}<span v-if="isFiltered"> of {{ allStrategies.length }}</span>)</span>
          </h2>
          <div class="relative">
            <svg class="h-4 w-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search strategy or title…"
              class="pl-8 pr-3 py-1.5 w-64 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              <tr>
                <th class="w-8 px-2 py-2"></th>
                <th class="text-left font-medium px-4 py-2">Strategy</th>
                <th class="text-left font-medium px-4 py-2">Title</th>
                <th class="text-right font-medium px-4 py-2">Epics</th>
                <th class="text-right font-medium px-4 py-2">Crit. path</th>
                <th class="text-right font-medium px-4 py-2">Score</th>
                <th class="text-left font-medium px-4 py-2">Review</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              <template v-for="s in pagedStrategies" :key="s.strat_id">
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer" @click="$emit('selectStrategy', s)">
                  <td class="px-2 py-2 text-gray-400">
                    <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </td>
                  <td class="px-4 py-2 font-mono text-xs">
                    <a
                      :href="browseUrl(s.strat_id)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-blue-600 dark:text-blue-400 hover:underline"
                      @click.stop
                    >{{ s.strat_id }}</a>
                  </td>
                  <td class="px-4 py-2 dark:text-gray-200">{{ s.title }}</td>
                  <td class="px-4 py-2 text-right dark:text-gray-300">{{ s.epic_count }}</td>
                  <td class="px-4 py-2 text-right dark:text-gray-300">{{ s.critical_path_length }}</td>
                  <td class="px-4 py-2 text-right dark:text-gray-300">{{ s.review?.score }}</td>
                  <td class="px-4 py-2">
                    <span class="px-2 py-0.5 rounded text-xs font-medium" :class="recClass(s.review?.recommendation)">
                      {{ s.review?.pass ? 'pass' : 'fail' }} · {{ s.review?.recommendation || '—' }}
                    </span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex items-center justify-between mt-3 text-sm">
          <span class="text-gray-500 dark:text-gray-400">Page {{ currentPage }} of {{ totalPages }}</span>
          <div class="flex items-center gap-1">
            <button
              @click="goToPage(currentPage - 1)"
              :disabled="currentPage === 1"
              class="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 dark:text-gray-200 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700"
            >Prev</button>
            <button
              @click="goToPage(currentPage + 1)"
              :disabled="currentPage === totalPages"
              class="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 dark:text-gray-200 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-700"
            >Next</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
