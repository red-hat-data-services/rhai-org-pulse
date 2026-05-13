<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100">Conforma Insights</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Policy exceptions approved for each RHOAI release, sourced from Enterprise Contract Policy YAMLs.
        </p>
      </div>
      <div class="flex flex-col items-end gap-2">
        <span v-if="state.fetchedAt" class="text-xs text-gray-400 dark:text-gray-500">
          Updated {{ formatDateTime(state.fetchedAt) }}
        </span>
        <div v-if="allReleases.length" class="flex items-center gap-2">
          <label class="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 whitespace-nowrap">
            Release
          </label>
          <div class="relative">
            <select
              v-model="selectedVersion"
              class="appearance-none pl-4 pr-10 py-2.5 text-sm font-semibold rounded-xl border-2 border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm cursor-pointer min-w-[230px]"
            >
              <option v-for="r in allReleases" :key="r.version" :value="r.version">
                {{ r.version }} (GA: {{ r.gaDate }})
              </option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              <svg class="w-4 h-4 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="state.loading" class="text-sm text-gray-500 dark:text-gray-400">
      Loading conforma data…
    </div>

    <!-- Error / no data -->
    <div v-else-if="state.error" class="rounded-lg border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
      {{ state.error }}
    </div>

    <div v-else-if="selectedRelease" :key="selectedVersion" class="space-y-6">

      <!-- Version banner -->
      <div class="rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 dark:from-blue-700 dark:via-indigo-700 dark:to-violet-700 px-6 py-5 shadow-lg text-white">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="text-xs font-bold uppercase tracking-widest text-blue-200 mb-1">Viewing Release</p>
            <h3 class="text-3xl font-extrabold tracking-tight leading-none">{{ selectedRelease.version }}</h3>
          </div>
          <div class="flex flex-wrap gap-3">
            <div class="flex flex-col items-center bg-white/15 backdrop-blur-sm rounded-xl px-5 py-2.5 min-w-[90px]">
              <span class="text-[10px] font-semibold uppercase tracking-wider text-blue-200 mb-0.5">GA Date</span>
              <span class="text-sm font-bold">{{ selectedRelease.gaDate }}</span>
            </div>
            <div v-if="selectedRelease.codeFreezeDate" class="flex flex-col items-center bg-white/15 backdrop-blur-sm rounded-xl px-5 py-2.5 min-w-[90px]">
              <span class="text-[10px] font-semibold uppercase tracking-wider text-blue-200 mb-0.5">Code Freeze</span>
              <span class="text-sm font-bold">{{ selectedRelease.codeFreezeDate }}</span>
            </div>
            <div class="flex flex-col items-center rounded-xl px-5 py-2.5 min-w-[90px]"
              :class="selectedRelease.gaDate <= todayStr ? 'bg-emerald-500/30' : 'bg-amber-500/30'">
              <span class="text-[10px] font-semibold uppercase tracking-wider text-blue-200 mb-0.5">Status</span>
              <span class="text-sm font-bold">{{ selectedRelease.gaDate <= todayStr ? 'Shipped' : 'Upcoming' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          v-for="card in summaryCards"
          :key="card.label"
          class="rounded-xl border px-4 py-4"
          :class="card.cls"
        >
          <p class="text-[11px] font-semibold uppercase tracking-wider mb-1" :class="card.labelCls">{{ card.label }}</p>
          <p class="text-3xl font-bold tabular-nums" :class="card.valueCls">{{ card.value }}</p>
          <p v-if="card.sub" class="text-xs mt-1 opacity-70" :class="card.labelCls">{{ card.sub }}</p>
        </div>
      </div>

      <!-- Charts row 1 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Horizontal bar: exceptions by category -->
        <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 p-5">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Exceptions by Rule Category</h3>
          <div v-if="categoryChartData" style="height: 300px; position: relative;">
            <Bar :key="`bar-${chartKey}`" :data="categoryChartData" :options="categoryChartOptions" />
          </div>
          <p v-else class="text-sm text-gray-400 py-8 text-center">No exception data</p>
        </div>

        <!-- Donut: FBC vs Registry + volatile vs permanent -->
        <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 p-5">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Exception Distribution</h3>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-center text-gray-500 dark:text-gray-400 mb-2">FBC vs Components</p>
              <div style="height: 180px; position: relative;">
                <Doughnut :key="`policy-donut-${chartKey}`" :data="policyFileDonutData" :options="donutOptions" />
              </div>
            </div>
            <div>
              <p class="text-xs text-center text-gray-500 dark:text-gray-400 mb-2">By Exception Type</p>
              <div style="height: 180px; position: relative;">
                <Doughnut :key="`type-donut-${chartKey}`" :data="typeDonutData" :options="donutOptions" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Charts row 2 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Trend across releases -->
        <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 p-5">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Exception Trend Across Releases</h3>
          <p class="text-xs text-gray-400 dark:text-gray-500 mb-3">All tracked releases, sorted by GA date</p>
          <div v-if="trendChartData" style="height: 240px; position: relative;">
            <Line :key="`line-${chartKey}`" :data="trendChartData" :options="trendChartOptions" />
          </div>
          <p v-else class="text-sm text-gray-400 py-8 text-center">Not enough releases for trend</p>
        </div>

        <!-- Expiry scatter for volatile exceptions -->
        <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 p-5">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Volatile Exception Expiry Timeline</h3>
          <p class="text-xs text-gray-400 dark:text-gray-500 mb-3">
            <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span>Expires &gt;60d after GA</span>
            &nbsp;
            <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>0–60d</span>
            &nbsp;
            <span class="inline-flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-500 inline-block"></span>Before GA</span>
          </p>
          <div v-if="volatileExceptions.length" style="height: 240px; position: relative;">
            <Scatter :key="`scatter-${chartKey}`" :data="scatterChartData" :options="scatterChartOptions" />
          </div>
          <p v-else class="text-sm text-gray-400 py-8 text-center">No volatile exceptions for this release</p>
        </div>
      </div>

      <!-- Detailed exceptions table -->
      <div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 overflow-hidden">
        <!-- Table header + toolbar -->
        <div class="px-5 py-4 border-b border-gray-100 dark:border-gray-700/60 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              All Exceptions for {{ selectedVersion }}
            </h3>
            <span class="text-xs text-gray-400 dark:text-gray-500">
              {{ filteredSortedExceptions.length === flatExceptions.length
                  ? `${flatExceptions.length} total`
                  : `${filteredSortedExceptions.length} of ${flatExceptions.length}` }}
            </span>
          </div>

          <!-- Search + filters -->
          <div class="flex flex-wrap items-center gap-2">
            <!-- Search -->
            <div class="relative flex-1 min-w-[180px]">
              <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
              </svg>
              <input
                v-model="tableSearch"
                type="text"
                placeholder="Search rule value, reference, comment…"
                class="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <!-- Policy filter -->
            <select
              v-model="tableFilterPolicy"
              class="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Policies</option>
              <option value="fbc">FBC</option>
              <option value="registry">Components</option>
            </select>

            <!-- Type filter -->
            <select
              v-model="tableFilterType"
              class="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="volatile">Volatile</option>
              <option value="permanent">Permanent</option>
            </select>

            <!-- Category filter -->
            <select
              v-model="tableFilterCategory"
              class="text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              <option v-for="cat in activeCategories" :key="cat" :value="cat">{{ cat }}</option>
            </select>

            <!-- Clear filters -->
            <button
              v-if="hasActiveFilters"
              class="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              @click="clearTableFilters"
            >
              Clear
            </button>
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                <th
                  v-for="col in TABLE_COLUMNS"
                  :key="col.key"
                  class="px-4 py-3 text-left font-semibold select-none"
                  :class="[col.sortable ? 'cursor-pointer hover:text-gray-700 dark:hover:text-gray-200' : '', col.width || '']"
                  @click="col.sortable && toggleSort(col.key)"
                >
                  <span class="inline-flex items-center gap-1">
                    {{ col.label }}
                    <span v-if="col.sortable" class="text-[10px] leading-none">
                      <template v-if="tableSortKey === col.key">
                        {{ tableSortDir === 'asc' ? '▲' : '▼' }}
                      </template>
                      <template v-else>
                        <span class="text-gray-300 dark:text-gray-600">⇅</span>
                      </template>
                    </span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700/60">
              <tr
                v-for="(ex, idx) in filteredSortedExceptions"
                :key="idx"
                class="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                :class="rowClass(ex)"
              >
                <!-- Policy -->
                <td class="px-4 py-3 whitespace-nowrap">
                  <span
                    class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase"
                    :class="ex.policyFile === 'fbc' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'"
                  >{{ ex.policyFile === 'fbc' ? 'FBC' : 'Components' }}</span>
                </td>
                <!-- Type -->
                <td class="px-4 py-3 whitespace-nowrap">
                  <span
                    class="px-1.5 py-0.5 rounded text-[10px] font-medium"
                    :class="ex.type === 'volatile' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'"
                  >{{ ex.type }}</span>
                </td>
                <!-- Rule Value -->
                <td class="px-4 py-3 font-mono text-gray-700 dark:text-gray-300 max-w-xs">
                  <span class="block truncate" :title="ex.value">{{ ex.value }}</span>
                </td>
                <!-- Category -->
                <td class="px-4 py-3 whitespace-nowrap">
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-medium" :class="categoryBadgeCls(ex.category)">
                    {{ ex.category }}
                  </span>
                </td>
                <!-- Image -->
                <td class="px-4 py-3 font-mono text-gray-500 dark:text-gray-400 max-w-[180px]">
                  <span class="block truncate" :title="ex.imageUrl || ''">
                    {{ ex.imageUrl ? ex.imageUrl.split('/').pop() : '—' }}
                  </span>
                </td>
                <!-- Effective Until -->
                <td class="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                  {{ ex.effectiveUntil ? ex.effectiveUntil.slice(0, 10) : '—' }}
                </td>
                <!-- Days After GA -->
                <td class="px-4 py-3 whitespace-nowrap text-center font-semibold" :class="daysAfterGaCls(ex.daysAfterGa)">
                  {{ ex.daysAfterGa !== null ? ex.daysAfterGa : '—' }}
                </td>
                <!-- Reference -->
                <td class="px-4 py-3">
                  <a
                    v-if="ex.reference"
                    :href="ex.reference"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-blue-600 dark:text-blue-400 hover:underline truncate block max-w-[140px]"
                    :title="ex.reference"
                  >{{ refLabel(ex.reference) }}</a>
                  <span v-else class="text-gray-400">—</span>
                </td>
                <!-- Docs -->
                <td class="px-4 py-3 text-center">
                  <a
                    v-if="CATEGORY_DOCS[ex.category]"
                    :href="CATEGORY_DOCS[ex.category]"
                    target="_blank"
                    rel="noopener noreferrer"
                    :title="`Conforma docs: ${ex.category}`"
                    class="inline-flex items-center justify-center w-6 h-6 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                    </svg>
                  </a>
                  <span v-else class="text-gray-300 dark:text-gray-600">—</span>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Empty state -->
          <div v-if="!filteredSortedExceptions.length" class="px-5 py-8 text-sm text-gray-400 text-center">
            <template v-if="hasActiveFilters">
              No exceptions match the current filters.
              <button class="ml-1 text-blue-500 hover:underline" @click="clearTableFilters">Clear filters</button>
            </template>
            <template v-else>
              No exceptions recorded for this release.
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state when no releases at all -->
    <div v-else-if="!state.loading && !state.error && !allReleases.length" class="rounded-lg border border-gray-200 dark:border-gray-700 px-6 py-10 text-center">
      <p class="text-sm text-gray-500 dark:text-gray-400">No shipped releases found. Run the ingestion pipeline to populate.</p>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { Bar, Doughnut, Line, Scatter } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

import { useConformaExceptions } from '../composables/useConformaExceptions'

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, PointElement, LineElement, ArcElement,
  Tooltip, Legend, Filler
)

// ─── Category definitions ───────────────────────────────────────────────────

// FIPS is first because it is matched by keyword, not by value prefix.
// It must take precedence over categories like 'test' or 'tasks' that share the same prefix.
const KNOWN_CATEGORIES = [
  'fips', 'hermetic_task', 'test', 'tasks', 'schedule',
  'sbom_spdx', 'rpm_signature', 'cve', 'other'
]

const CATEGORY_BADGE = {
  fips:                 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300',
  hermetic_task:        'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  test:                 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  tasks:                'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  schedule:             'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  sbom_spdx:            'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  rpm_signature:        'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  cve:                  'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300',
  source_image:         'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  step_image_registries:'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
  other:                'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
}

const CATEGORY_DOCS = {
  fips:                  'https://conforma.dev/docs/policy/packages/release_test.html',
  hermetic_task:         'https://conforma.dev/docs/policy/packages/release_hermetic_task.html',
  test:                  'https://conforma.dev/docs/policy/packages/release_test.html',
  tasks:                 'https://conforma.dev/docs/policy/packages/release_tasks.html',
  schedule:              'https://conforma.dev/docs/policy/packages/release_schedule.html',
  sbom_spdx:             'https://conforma.dev/docs/policy/packages/release_sbom_spdx.html',
  rpm_signature:         'https://conforma.dev/docs/policy/packages/release_rpm_signature.html',
  cve:                   'https://conforma.dev/docs/policy/packages/release_cve.html',
  source_image:          'https://conforma.dev/docs/policy/packages/release_source_image.html',
  step_image_registries: 'https://conforma.dev/docs/policy/packages/task_step_image_registries.html',
}

// ─── Table column definitions ────────────────────────────────────────────────

const TABLE_COLUMNS = [
  { key: 'policyFile',    label: 'Policy',        sortable: true },
  { key: 'type',          label: 'Type',           sortable: true },
  { key: 'value',         label: 'Rule Value',     sortable: true },
  { key: 'category',      label: 'Category',       sortable: true },
  { key: 'imageUrl',      label: 'Image',          sortable: false },
  { key: 'effectiveUntil',label: 'Effective Until',sortable: true },
  { key: 'daysAfterGa',   label: 'Days After GA',  sortable: true, width: 'w-20' },
  { key: 'reference',     label: 'Reference',      sortable: true },
  { key: 'docs',          label: 'Docs',           sortable: false, width: 'w-12' }
]

// ─── Data ───────────────────────────────────────────────────────────────────

const state = useConformaExceptions()
const selectedVersion = ref(null)
const chartKey = ref(0)
const todayStr = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD in local time

const allReleases = computed(() => {
  const releases = (state.releases || []).filter(r => r.gaDate)
  const shipped = releases
    .filter(r => r.gaDate <= todayStr)
    .sort((a, b) => b.gaDate.localeCompare(a.gaDate))
  const nextUpcoming = releases
    .filter(r => r.gaDate > todayStr)
    .sort((a, b) => a.gaDate.localeCompare(b.gaDate))[0]
  return nextUpcoming ? [nextUpcoming, ...shipped] : shipped
})

watch(allReleases, (list) => {
  if (list.length && !selectedVersion.value) {
    selectedVersion.value = list[0].version
  }
}, { immediate: true })

const selectedRelease = computed(() =>
  allReleases.value.find(r => r.version === selectedVersion.value) || null
)

// ─── Category extraction ─────────────────────────────────────────────────────

function extractCategory(value) {
  if (!value) return 'other'
  // FIPS: keyword match takes priority over prefix-based categorisation
  if (value.toLowerCase().includes('fips')) return 'fips'
  const prefixKnown = ['hermetic_task', 'test', 'tasks', 'schedule', 'sbom_spdx', 'rpm_signature', 'cve', 'source_image', 'step_image_registries']
  const prefix = value.split('.')[0].split(':')[0]
  return prefixKnown.includes(prefix) ? prefix : 'other'
}

// ─── Flat exception list (all, used by charts) ───────────────────────────────

const flatExceptions = computed(() => {
  if (!selectedRelease.value) return []
  const r = selectedRelease.value
  const gaMs = r.gaDate ? new Date(r.gaDate).getTime() : null
  const result = []

  for (const policyFile of ['fbc', 'registry']) {
    const exc = r.exceptions?.[policyFile]
    if (!exc) continue

    for (const v of exc.configExcludes || []) {
      result.push({
        policyFile, type: 'permanent', value: v,
        category: extractCategory(v),
        imageUrl: null, effectiveUntil: null,
        reference: null, comment: null, daysAfterGa: null
      })
    }

    for (const ex of exc.volatileExcludes || []) {
      let daysAfterGa = null
      if (gaMs && ex.effectiveUntil) {
        daysAfterGa = Math.round((new Date(ex.effectiveUntil).getTime() - gaMs) / 86400000)
      }
      result.push({
        policyFile, type: 'volatile',
        value: ex.value,
        category: extractCategory(ex.value),
        imageUrl: ex.imageUrl || null,
        effectiveUntil: ex.effectiveUntil || null,
        reference: ex.reference || null,
        comment: ex.comment || null,
        daysAfterGa
      })
    }
  }
  return result
})

const volatileExceptions = computed(() =>
  flatExceptions.value.filter(e => e.type === 'volatile' && e.effectiveUntil)
)

// ─── Table: search / filter / sort state ────────────────────────────────────

const tableSearch = ref('')
const tableFilterPolicy = ref('')
const tableFilterType = ref('')
const tableFilterCategory = ref('')
const tableSortKey = ref('')
const tableSortDir = ref('asc')

// Reset table controls and force chart remount whenever the selected release changes
watch(selectedVersion, async () => {
  tableSearch.value = ''
  tableFilterPolicy.value = ''
  tableFilterType.value = ''
  tableFilterCategory.value = ''
  tableSortKey.value = ''
  tableSortDir.value = 'asc'
  await nextTick()
  chartKey.value++
})

const hasActiveFilters = computed(() =>
  tableSearch.value.trim() !== '' ||
  tableFilterPolicy.value !== '' ||
  tableFilterType.value !== '' ||
  tableFilterCategory.value !== ''
)

function clearTableFilters() {
  tableSearch.value = ''
  tableFilterPolicy.value = ''
  tableFilterType.value = ''
  tableFilterCategory.value = ''
}

function toggleSort(key) {
  if (tableSortKey.value === key) {
    tableSortDir.value = tableSortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    tableSortKey.value = key
    tableSortDir.value = 'asc'
  }
}

// Categories present in the current release (for the filter dropdown)
const activeCategories = computed(() => {
  const seen = new Set(flatExceptions.value.map(e => e.category))
  return KNOWN_CATEGORIES.filter(c => seen.has(c))
})

const filteredSortedExceptions = computed(() => {
  const needle = tableSearch.value.trim().toLowerCase()
  let rows = flatExceptions.value

  // Filters
  if (tableFilterPolicy.value) rows = rows.filter(e => e.policyFile === tableFilterPolicy.value)
  if (tableFilterType.value)   rows = rows.filter(e => e.type === tableFilterType.value)
  if (tableFilterCategory.value) rows = rows.filter(e => e.category === tableFilterCategory.value)

  if (needle) {
    rows = rows.filter(e =>
      (e.value || '').toLowerCase().includes(needle) ||
      (e.reference || '').toLowerCase().includes(needle) ||
      (e.comment || '').toLowerCase().includes(needle) ||
      (e.imageUrl || '').toLowerCase().includes(needle) ||
      (e.category || '').toLowerCase().includes(needle)
    )
  }

  // Sort
  if (tableSortKey.value) {
    const dir = tableSortDir.value === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      const av = a[tableSortKey.value]
      const bv = b[tableSortKey.value]
      if (av === null && bv === null) return 0
      if (av === null) return dir        // nulls last for asc, first for desc
      if (bv === null) return -dir
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }

  return rows
})

// ─── Summary cards ──────────────────────────────────────────────────────────

const summaryCards = computed(() => {
  const all = flatExceptions.value
  const fbc = all.filter(e => e.policyFile === 'fbc').length
  const registry = all.filter(e => e.policyFile === 'registry').length
  const volatile = all.filter(e => e.type === 'volatile').length
  return [
    {
      label: 'Total Exceptions', value: all.length,
      cls: 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60',
      labelCls: 'text-gray-500 dark:text-gray-400',
      valueCls: 'text-gray-900 dark:text-gray-100'
    },
    {
      label: 'FBC Policy', value: fbc,
      cls: 'border-blue-200 dark:border-blue-700/50 bg-blue-50/60 dark:bg-blue-900/20',
      labelCls: 'text-blue-600 dark:text-blue-400',
      valueCls: 'text-blue-700 dark:text-blue-300'
    },
    {
      label: 'Components Policy', value: registry,
      cls: 'border-emerald-200 dark:border-emerald-700/50 bg-emerald-50/60 dark:bg-emerald-900/20',
      labelCls: 'text-emerald-600 dark:text-emerald-400',
      valueCls: 'text-emerald-700 dark:text-emerald-300'
    },
    {
      label: 'Volatile (Time-bound)', value: volatile,
      sub: `${all.length - volatile} permanent`,
      cls: 'border-amber-200 dark:border-amber-700/50 bg-amber-50/60 dark:bg-amber-900/20',
      labelCls: 'text-amber-600 dark:text-amber-400',
      valueCls: 'text-amber-700 dark:text-amber-300'
    }
  ]
})

// ─── Category horizontal bar chart ──────────────────────────────────────────

const categoryChartData = computed(() => {
  const all = flatExceptions.value
  if (!all.length) return null

  const fbcCounts = {}
  const regCounts = {}
  for (const cat of KNOWN_CATEGORIES) { fbcCounts[cat] = 0; regCounts[cat] = 0 }

  for (const e of all) {
    const cat = KNOWN_CATEGORIES.includes(e.category) ? e.category : 'other'
    if (e.policyFile === 'fbc') fbcCounts[cat]++
    else regCounts[cat]++
  }

  const chartCategories = KNOWN_CATEGORIES.filter(c => (fbcCounts[c] || 0) + (regCounts[c] || 0) > 0)

  return {
    labels: chartCategories,
    datasets: [
      {
        label: 'FBC',
        data: chartCategories.map(c => fbcCounts[c]),
        backgroundColor: 'rgba(59,130,246,0.75)',
        borderColor: 'rgb(59,130,246)',
        borderWidth: 1,
        borderRadius: 3
      },
      {
        label: 'Components',
        data: chartCategories.map(c => regCounts[c]),
        backgroundColor: 'rgba(16,185,129,0.75)',
        borderColor: 'rgb(16,185,129)',
        borderWidth: 1,
        borderRadius: 3
      }
    ]
  }
})

const categoryChartOptions = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12 } }, tooltip: { mode: 'index' } },
  scales: {
    x: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(156,163,175,0.15)' } },
    y: { stacked: true, grid: { display: false } }
  }
}

// ─── Donut charts ────────────────────────────────────────────────────────────

const donutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { boxWidth: 10, padding: 8, font: { size: 10 } } },
    tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}` } }
  },
  cutout: '62%'
}

const policyFileDonutData = computed(() => {
  const all = flatExceptions.value
  const fbc = all.filter(e => e.policyFile === 'fbc').length
  const reg = all.filter(e => e.policyFile === 'registry').length
  return {
    labels: ['FBC', 'Components'],
    datasets: [{
      data: [fbc, reg],
      backgroundColor: ['rgba(59,130,246,0.8)', 'rgba(16,185,129,0.8)'],
      borderColor: ['rgb(59,130,246)', 'rgb(16,185,129)'],
      borderWidth: 2
    }]
  }
})

const typeDonutData = computed(() => {
  const all = flatExceptions.value
  const vol = all.filter(e => e.type === 'volatile').length
  const perm = all.filter(e => e.type === 'permanent').length
  return {
    labels: ['Volatile', 'Permanent'],
    datasets: [{
      data: [vol, perm],
      backgroundColor: ['rgba(245,158,11,0.8)', 'rgba(107,114,128,0.7)'],
      borderColor: ['rgb(245,158,11)', 'rgb(107,114,128)'],
      borderWidth: 2
    }]
  }
})

// ─── Trend line chart ────────────────────────────────────────────────────────

const trendChartData = computed(() => {
  const sorted = [...allReleases.value].sort((a, b) => a.gaDate.localeCompare(b.gaDate))
  if (sorted.length < 2) return null

  const labels = sorted.map(r => r.version.replace('rhoai-', ''))
  function countFor(r, filter) {
    const all = []
    for (const pf of ['fbc', 'registry']) {
      const exc = r.exceptions?.[pf]
      if (!exc) continue
      for (const v of exc.configExcludes || []) all.push({ type: 'permanent', policyFile: pf, value: v, category: extractCategory(v) })
      for (const ex of exc.volatileExcludes || []) all.push({ type: 'volatile', policyFile: pf, value: ex.value, category: extractCategory(ex.value) })
    }
    return filter ? all.filter(filter).length : all.length
  }

  return {
    labels,
    datasets: [
      {
        label: 'Total',
        data: sorted.map(r => countFor(r)),
        borderColor: 'rgb(139,92,246)',
        backgroundColor: 'rgba(139,92,246,0.1)',
        tension: 0.3, fill: false, pointRadius: 4
      },
      {
        label: 'FIPS',
        data: sorted.map(r => countFor(r, e => e.category === 'fips')),
        borderColor: 'rgb(6,182,212)',
        backgroundColor: 'transparent',
        tension: 0.3, fill: false, pointRadius: 3, borderDash: [3, 2]
      },
      {
        label: 'FBC',
        data: sorted.map(r => countFor(r, e => e.policyFile === 'fbc')),
        borderColor: 'rgb(59,130,246)',
        backgroundColor: 'transparent',
        tension: 0.3, fill: false, pointRadius: 3
      },
      {
        label: 'Components',
        data: sorted.map(r => countFor(r, e => e.policyFile === 'registry')),
        borderColor: 'rgb(16,185,129)',
        backgroundColor: 'transparent',
        tension: 0.3, fill: false, pointRadius: 3
      },
      {
        label: 'Volatile',
        data: sorted.map(r => countFor(r, e => e.type === 'volatile')),
        borderColor: 'rgb(245,158,11)',
        backgroundColor: 'transparent',
        tension: 0.3, fill: false, pointRadius: 3, borderDash: [4, 3]
      }
    ]
  }
})

const trendChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10, font: { size: 10 } } }, tooltip: { mode: 'index' } },
  scales: {
    y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: 'rgba(156,163,175,0.15)' } },
    x: { grid: { display: false }, ticks: { maxRotation: 35, font: { size: 9 } } }
  }
}

// ─── Scatter (expiry timeline) ───────────────────────────────────────────────

const scatterChartData = computed(() => {
  if (!selectedRelease.value) return { datasets: [] }
  const gaMs = selectedRelease.value.gaDate ? new Date(selectedRelease.value.gaDate).getTime() : 0
  const catIndex = Object.fromEntries(KNOWN_CATEGORIES.map((c, i) => [c, i]))

  const green = [], orange = [], red = []
  for (const ex of volatileExceptions.value) {
    const expMs = new Date(ex.effectiveUntil).getTime()
    const daysAfter = (expMs - gaMs) / 86400000
    const y = catIndex[ex.category] ?? catIndex['other'] ?? 0
    const point = { x: expMs, y, label: ex.value, ref: ex.reference }
    if (daysAfter < 0) red.push(point)
    else if (daysAfter <= 60) orange.push(point)
    else green.push(point)
  }

  return {
    datasets: [
      { label: '>60d after GA', data: green, backgroundColor: 'rgba(16,185,129,0.85)', pointRadius: 7 },
      { label: '0–60d after GA', data: orange, backgroundColor: 'rgba(245,158,11,0.85)', pointRadius: 7 },
      { label: 'Before GA', data: red, backgroundColor: 'rgba(239,68,68,0.85)', pointRadius: 7 }
    ]
  }
})

const scatterChartOptions = computed(() => {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 10, padding: 8, font: { size: 10 } } },
      tooltip: {
        callbacks: {
          title: () => '',
          label: ctx => {
            const p = ctx.raw
            const date = new Date(p.x).toISOString().slice(0, 10)
            return [`${p.label}`, `Expires: ${date}`]
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        grid: { color: 'rgba(156,163,175,0.15)' },
        ticks: {
          callback: (v) => {
            const d = new Date(v)
            return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
          },
          maxTicksLimit: 8
        }
      },
      y: {
        ticks: { callback: (v) => KNOWN_CATEGORIES[v] || v, stepSize: 1 },
        min: -0.5,
        max: KNOWN_CATEGORIES.length - 0.5,
        grid: { color: 'rgba(156,163,175,0.10)' }
      }
    }
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function refLabel(url) {
  if (!url) return ''
  const m = url.match(/\/browse\/([A-Z]+-\d+)/)
  if (m) return m[1]
  try { return new URL(url).pathname.split('/').filter(Boolean).pop() || url } catch { return url }
}

function rowClass(ex) {
  if (ex.daysAfterGa !== null && ex.daysAfterGa < 0) return 'bg-red-50/60 dark:bg-red-900/10'
  if (ex.daysAfterGa !== null && ex.daysAfterGa < 30) return 'bg-amber-50/40 dark:bg-amber-900/10'
  return ''
}

function daysAfterGaCls(days) {
  if (days === null) return 'text-gray-400'
  if (days < 0) return 'text-red-600 dark:text-red-400'
  if (days < 30) return 'text-amber-600 dark:text-amber-400'
  return 'text-emerald-600 dark:text-emerald-400'
}

function categoryBadgeCls(cat) {
  return CATEGORY_BADGE[cat] || CATEGORY_BADGE.other
}
</script>
