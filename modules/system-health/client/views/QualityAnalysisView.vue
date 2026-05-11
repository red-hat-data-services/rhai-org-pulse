<script setup>
import { computed, inject, watch } from 'vue'
import { QUALITY_REPORTS, QUALITY_SAMPLE_META } from '../qualityReports.data.js'

const VIEW_ID = 'quality-analysis'

const nav = inject('moduleNav', null)

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

function openReport(id) {
  selectedId.value = id
}

function clearSelection() {
  selectedId.value = null
}

// Drop unknown ?report= values from the URL so the shell stays consistent
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
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
          Reports are standalone HTML assets. They are bundled with
          <code class="text-xs px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800">?url</code>
          imports and shown in an iframe so their styles stay isolated from Org Pulse.
        </p>
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
        <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
          Sample reports ({{ QUALITY_REPORTS.length }} repos)
        </p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Generated {{ QUALITY_SAMPLE_META.generatedAt }} · Average
          {{ QUALITY_SAMPLE_META.averageScore }} — {{ QUALITY_SAMPLE_META.blurb }}
        </p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
              <th class="px-4 py-3 font-medium">Repository</th>
              <th class="px-4 py-3 font-medium">Source</th>
              <th class="px-4 py-3 font-medium">Overall score</th>
              <th class="px-4 py-3 font-medium">Top gaps</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr
              v-for="row in QUALITY_REPORTS"
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
              <td class="px-4 py-3">
                <a
                  :href="row.githubUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-primary-600 dark:text-primary-400 hover:underline"
                >GitHub</a>
              </td>
              <td class="px-4 py-3 text-gray-800 dark:text-gray-200 whitespace-nowrap">
                {{ row.score }}
              </td>
              <td class="px-4 py-3 text-gray-600 dark:text-gray-300">
                {{ row.gaps }}
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
        :src="selected.reportUrl"
        :title="`Quality report: ${selected.label}`"
        class="w-full border-0 bg-white block"
        style="min-height: calc(100vh - 11rem)"
      />
    </div>
  </div>
</template>
