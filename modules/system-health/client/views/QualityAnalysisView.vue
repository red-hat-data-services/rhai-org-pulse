<script setup>
import { computed, inject, ref, watch } from 'vue'
import { QUALITY_REPORTS, QUALITY_SAMPLE_META } from '../qualityReports.data.js'

const VIEW_ID = 'quality-analysis'

const nav = inject('moduleNav', null)

const tierFilter = ref('all')
const componentFilter = ref('all')

const tiers = computed(() => [...new Set(QUALITY_REPORTS.map(r => r.tier).filter(Boolean))].sort())
const components = computed(() => [...new Set(QUALITY_REPORTS.map(r => r.component).filter(Boolean))].sort())

const filteredReports = computed(() =>
  QUALITY_REPORTS.filter(r =>
    (tierFilter.value === 'all' || r.tier === tierFilter.value) &&
    (componentFilter.value === 'all' || r.component === componentFilter.value)
  )
)

const selectedId = computed({
  get() {
    const id = nav?.params?.value?.report
    if (!id || typeof id !== 'string') return null
    return QUALITY_REPORTS.some(r => r.id === id) ? id : null
  },
  set(next) {
    if (!nav) return
    if (!next) {
      nav.navigateTo(VIEW_ID, {})
      return
    }
    nav.navigateTo(VIEW_ID, { report: next })
  }
})

const selected = computed(() =>
  selectedId.value ? QUALITY_REPORTS.find(r => r.id === selectedId.value) : null
)

function scoreClass(score) {
  const n = parseFloat(score)
  if (n >= 7) return 'text-green-600 dark:text-green-400'
  if (n >= 4) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function openReport(id) {
  selectedId.value = id
}

function clearSelection() {
  selectedId.value = null
}

watch(
  () => nav?.params?.value?.report,
  (report) => {
    if (report && !QUALITY_REPORTS.some(r => r.id === report)) {
      nav?.navigateTo(VIEW_ID, {})
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Quality analysis
        </h1>
      </div>
      <button
        v-if="selected"
        type="button"
        class="shrink-0 inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
        @click="clearSelection"
      >
        Back to list
      </button>
    </div>

    <div
      v-if="!selected"
      class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-sm"
    >
      <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
              Showing {{ filteredReports.length }} of {{ QUALITY_REPORTS.length }} repos
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Generated {{ QUALITY_SAMPLE_META.generatedAt }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <select
              v-model="tierFilter"
              class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="all">All tiers</option>
              <option v-for="t in tiers" :key="t" :value="t">{{ t }}</option>
            </select>
            <select
              v-model="componentFilter"
              class="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
            >
              <option value="all">All components</option>
              <option v-for="c in components" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
              <th class="px-4 py-3 font-medium">Repository</th>
              <th class="px-4 py-3 font-medium">Tier</th>
              <th class="px-4 py-3 font-medium">Component</th>
              <th class="px-4 py-3 font-medium">Score</th>
              <th class="px-4 py-3 font-medium">Top gaps</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr
              v-for="row in filteredReports"
              :key="row.id"
              class="hover:bg-gray-50/80 dark:hover:bg-gray-900/30"
            >
              <td class="px-4 py-3">
                <button
                  type="button"
                  class="text-left font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  @click="openReport(row.id)"
                >
                  {{ row.label }}
                </button>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="{
                    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300': row.tier === 'upstream',
                    'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300': row.tier === 'midstream',
                    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300': row.tier === 'downstream',
                  }"
                >
                  {{ row.tier }}
                </span>
              </td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                {{ row.component }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span
                  v-if="row.score !== ''"
                  class="font-medium"
                  :class="scoreClass(row.score)"
                >
                  {{ row.score }}
                </span>
                <span
                  v-else
                  class="text-xs text-gray-400 dark:text-gray-500 italic"
                >
                  Pending
                </span>
              </td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
                <template v-if="row.gaps !== ''">{{ row.gaps }}</template>
                <span
                  v-else
                  class="text-xs text-gray-400 dark:text-gray-500 italic"
                >
                  Awaiting scan
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      v-else
      class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900 shadow-sm"
    >
      <p class="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
        {{ selected.label }}
      </p>
      <iframe
        v-if="selected.reportUrl"
        :src="selected.reportUrl"
        :title="`Quality report: ${selected.label}`"
        class="w-full border-0 bg-white block"
        style="min-height: calc(100vh - 11rem)"
      />
      <div
        v-else
        class="flex flex-col items-center justify-center py-20 px-6 text-center"
      >
        <div class="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <svg class="w-7 h-7 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
        </div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          No quality report available
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-6">
          A quality scan has not been generated for
          <span class="font-medium text-gray-700 dark:text-gray-300">{{ selected.label }}</span>
          yet. Reports are produced by a scheduled pipeline that analyzes each repository's CI, testing, and security practices.
        </p>
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 px-5 py-4 text-left text-sm max-w-md w-full">
          <p class="font-medium text-gray-700 dark:text-gray-300 mb-2">Troubleshooting</p>
          <ul class="space-y-1.5 text-gray-500 dark:text-gray-400 list-disc list-inside">
            <li>The repository may have been recently added to the registry</li>
            <li>The scan pipeline may not have run since this repo was added</li>
            <li>The repository could be private or inaccessible to the scanner</li>
          </ul>
        </div>
        <a
          v-if="selected.githubUrl"
          :href="selected.githubUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-4 inline-flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          View repository on GitHub
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
      </div>
    </div>
  </div>
</template>
