<template>
  <div class="min-w-0">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Recent Runs</h2>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Up to 20 recent runs across all test suites and versions.</p>
      </div>
      <button type="button" :disabled="loading" class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700" @click="load">Refresh</button>
    </div>

    <div v-if="error" role="alert" class="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-900/20">
      <p class="text-sm text-gray-800 dark:text-gray-200">{{ error }}</p>
      <button type="button" :disabled="loading" class="mt-2 text-sm font-semibold text-primary-700 dark:text-primary-300" @click="load">Retry</button>
    </div>
    <p v-if="loading" role="status" class="mb-4 text-sm text-gray-500 dark:text-gray-400">{{ hasLoaded ? 'Updating recent runs…' : 'Loading recent runs…' }}</p>

    <div v-if="hasLoaded" :aria-busy="loading" class="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
      <div class="relative overflow-x-auto">
        <table class="w-full text-left text-sm">
          <caption class="sr-only">Recent Workflow Validation runs</caption>
          <thead class="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700/60 dark:text-gray-400">
            <tr>
              <th scope="col" class="px-5 py-3">Test suite</th>
              <th scope="col" class="px-5 py-3">Version</th>
              <th scope="col" class="px-5 py-3">Build date and time (UTC)</th>
              <th scope="col" class="px-5 py-3"><span class="sr-only">Run details</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="run in runs" :key="JSON.stringify([run.suite, run.invocationId])" class="border-b border-gray-50 dark:border-gray-700/40">
              <td class="px-5 py-4">
                <div class="font-medium text-gray-900 dark:text-gray-100">{{ run.suite ? formatSuiteName(run.suite) : 'Test suite unavailable' }}</div>
                <div class="mt-1 break-all font-mono text-xs text-gray-500 dark:text-gray-400">{{ run.invocationId }}</div>
              </td>
              <td class="px-5 py-4 font-mono text-xs text-gray-600 dark:text-gray-300">{{ run.rhoaiVersion || 'Version unavailable' }}</td>
              <td class="whitespace-nowrap px-5 py-4 text-gray-600 dark:text-gray-300">
                <time v-if="validBuildTime(run.buildTimestamp)" :datetime="run.buildTimestamp">{{ formatBuildTime(run.buildTimestamp) }}</time>
                <span v-else>{{ buildMetadataEnabled ? 'Unavailable' : 'Not available yet' }}</span>
              </td>
              <td class="px-5 py-4 text-right">
                <a v-if="run.suite && run.invocationId" :href="runLink(run)" :aria-label="`View run ${run.invocationId}`" class="whitespace-nowrap font-medium text-primary-700 underline hover:text-primary-900 dark:text-primary-300">View run</a>
                <span v-else class="text-xs text-gray-500 dark:text-gray-400">Run details unavailable</span>
              </td>
            </tr>
            <tr v-if="!runs.length">
              <td colspan="4" class="px-5 py-12 text-center text-gray-500 dark:text-gray-400">No runs are available.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { formatSuiteName, useWorkflowValidation } from '../composables/useWorkflowValidation'

const { getRecentRuns } = useWorkflowValidation()
const runs = ref([])
const buildMetadataEnabled = ref(false)
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC'
})
const validBuildTime = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
const formatBuildTime = value => dateFormatter.format(new Date(value))
const loading = ref(false)
const hasLoaded = ref(false)
const error = ref('')
let active = true

function runLink(run) {
  const params = new URLSearchParams({
    exactRun: '1', version: run.rhoaiVersion || '',
    testSuite: run.suite, invocationId: run.invocationId,
    datePreset: 'all', dateFrom: '', dateTo: ''
  })
  return `#/workflow-validation/overview?${params}`
}

async function load() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const data = await getRecentRuns()
    if (!active) return
    runs.value = data.rows.slice(0, 20)
    buildMetadataEnabled.value = data.buildMetadataEnabled === true
    hasLoaded.value = true
  } catch (err) {
    if (!active) return
    error.value = err.message || 'Failed to load recent runs.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
onBeforeUnmount(() => { active = false })
</script>
