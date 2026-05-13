<template>
  <div class="space-y-6">
    <!-- Data Refresh -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Data Refresh</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Trigger a refresh of allocation sprint data across all configured teams.
      </p>

      <div class="flex items-center gap-4">
        <button
          @click="handleRefresh"
          :disabled="isRefreshing"
          class="px-4 py-2 text-sm bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ isRefreshing ? 'Refreshing...' : 'Refresh Allocation Data' }}
        </button>
        <label class="flex items-center gap-2">
          <input
            v-model="hardRefresh"
            type="checkbox"
            class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-300"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">Hard refresh (re-fetch cached sprints)</span>
        </label>
      </div>

      <div v-if="refreshStatus" class="mt-4 p-3 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
        <div class="text-sm space-y-1">
          <div class="flex items-center gap-2">
            <span class="font-medium text-gray-700 dark:text-gray-300">Status:</span>
            <span :class="refreshStatus.running ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'">
              {{ refreshStatus.running ? 'Running...' : 'Idle' }}
            </span>
            <svg v-if="refreshStatus.running" class="animate-spin h-4 w-4 text-yellow-600 dark:text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          </div>
          <div v-if="refreshStatus.lastRun" class="text-xs text-gray-500 dark:text-gray-400">
            Last run: {{ new Date(refreshStatus.lastRun).toLocaleString() }}
          </div>
          <div v-if="refreshStatus.teamsProcessed != null" class="text-xs text-gray-500 dark:text-gray-400">
            Teams processed: {{ refreshStatus.teamsProcessed }}
          </div>
          <div v-if="refreshStatus.error" class="text-xs text-red-600 dark:text-red-400">
            Error: {{ refreshStatus.error }}
          </div>
        </div>
      </div>
    </div>

    <!-- Classification Pipeline -->
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Activity Type Classification</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Automated classification of Jira issues into 40-40-20 allocation buckets via GitLab pipeline.
      </p>

      <!-- Auto-Classification Schedule -->
      <div class="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
        <h4 class="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">Scheduled Auto-Classification</h4>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Automatically classify issues with empty Activity Type on a schedule.
        </p>

        <div class="space-y-4">
          <label class="flex items-center gap-2">
            <input
              v-model="classificationConfig.enabled"
              type="checkbox"
              class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-300"
            />
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Enable auto-classification</span>
          </label>

          <div v-if="classificationConfig.enabled" class="space-y-4 pl-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Frequency
              </label>
              <select
                v-model="classificationConfig.frequency"
                class="block w-64 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm focus:outline-none focus:ring-primary-300 focus:border-primary-300"
              >
                <option value="hourly">Hourly</option>
                <option value="every-6-hours">Every 6 hours</option>
                <option value="every-12-hours">Every 12 hours</option>
                <option value="daily">Daily</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Lookback Window (hours)
              </label>
              <input
                v-model.number="classificationConfig.lookbackHours"
                type="number"
                min="1"
                max="168"
                class="block w-64 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm focus:outline-none focus:ring-primary-300 focus:border-primary-300"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Classify issues updated in the last N hours (1-168)
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button
              @click="saveClassificationConfig"
              :disabled="savingConfig"
              class="px-4 py-2 text-sm bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {{ savingConfig ? 'Saving...' : 'Save Schedule' }}
            </button>
            <span v-if="configSaved" class="text-sm text-green-600 dark:text-green-400">✓ Saved</span>
          </div>

          <div v-if="scheduleInfo" class="mt-3 p-3 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
            <div class="text-xs space-y-1 text-gray-600 dark:text-gray-400">
              <div><span class="font-medium">Status:</span> {{ scheduleInfo.active ? 'Active' : 'Inactive' }}</div>
              <div v-if="scheduleInfo.nextRun"><span class="font-medium">Next run:</span> {{ new Date(scheduleInfo.nextRun).toLocaleString() }}</div>
              <div><span class="font-medium">Cron:</span> {{ scheduleInfo.cron }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Test Classification -->
      <div class="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
        <h4 class="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">Test Classification</h4>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Test classification on a single issue (dry run).
        </p>

        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Issue Key
            </label>
            <input
              v-model="testIssueKey"
              type="text"
              placeholder="e.g., AIPCC-15430"
              class="block w-64 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm focus:outline-none focus:ring-primary-300 focus:border-primary-300"
            />
          </div>

          <button
            @click="testClassification"
            :disabled="!testIssueKey || testingClassification"
            class="px-4 py-2 text-sm bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ testingClassification ? 'Triggering...' : 'Test Classification' }}
          </button>

          <div v-if="testResult" class="mt-3 p-3 rounded-md border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
            <div class="text-sm space-y-2">
              <div class="font-medium text-blue-900 dark:text-blue-100">🚀 Pipeline Triggered</div>
              <div class="text-xs text-blue-700 dark:text-blue-300">
                <a :href="testResult.pipelineUrl" target="_blank" class="underline hover:text-blue-500">
                  → Open Pipeline #{{ testResult.pipelineId }} in GitLab
                </a>
              </div>
              <div class="text-xs text-blue-600 dark:text-blue-400">
                Check the pipeline for classification results (dry run - no changes will be written).
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bulk Classification -->
      <div>
        <h4 class="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">Bulk Classification</h4>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Bulk classify issues matching a JQL query. Use for one-time backfill of historical issues.
        </p>

        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              JQL Query
            </label>
            <textarea
              v-model="bulkJql"
              rows="2"
              placeholder='e.g., project = AIPCC AND "Activity Type" is EMPTY'
              class="block w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm focus:outline-none focus:ring-primary-300 focus:border-primary-300"
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Limit
            </label>
            <input
              v-model.number="bulkLimit"
              type="number"
              min="1"
              max="10000"
              class="block w-32 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm focus:outline-none focus:ring-primary-300 focus:border-primary-300"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Max issues to process (1-10000)
            </p>
          </div>

          <label class="flex items-center gap-2">
            <input
              v-model="bulkDryRun"
              type="checkbox"
              class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-300"
            />
            <span class="text-sm text-gray-700 dark:text-gray-300">Dry run (preview only, don't write to Jira)</span>
          </label>

          <button
            @click="runBulkClassification"
            :disabled="!bulkJql || runningBulk"
            class="px-4 py-2 text-sm bg-primary-600 text-white rounded-md font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ runningBulk ? 'Triggering...' : 'Run Bulk Classification' }}
          </button>

          <div v-if="bulkResult" class="mt-3 p-3 rounded-md border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
            <div class="text-sm space-y-2">
              <div class="font-medium text-blue-900 dark:text-blue-100">🚀 Pipeline Triggered</div>
              <div class="text-xs text-blue-700 dark:text-blue-300">
                <a :href="bulkResult.pipelineUrl" target="_blank" class="underline hover:text-blue-500">
                  → Open Pipeline #{{ bulkResult.pipelineId }} in GitLab
                </a>
              </div>
              <div class="text-xs text-blue-600 dark:text-blue-400">
                {{ bulkDryRun ? 'Dry run mode - no changes will be written to Jira.' : 'Pipeline will write Activity Type to matching issues.' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import {
  refreshAllocation,
  getRefreshStatus,
  getClassificationConfig,
  saveClassificationConfig as saveConfigApi,
  testClassification as testClassificationApi,
  runBulkClassification as runBulkApi,
  getScheduleInfo
} from '../services/allocation-api.js'

// --- Data Refresh ---
const isRefreshing = ref(false)
const hardRefresh = ref(false)
const refreshStatus = ref(null)
let pollTimer = null

async function handleRefresh() {
  isRefreshing.value = true
  try {
    await refreshAllocation(null, hardRefresh.value)
    startPolling()
  } catch (error) {
    console.error('Failed to start refresh:', error)
    isRefreshing.value = false
  }
}

async function pollStatus() {
  try {
    const status = await getRefreshStatus()
    refreshStatus.value = status
    if (!status.running) {
      stopPolling()
      isRefreshing.value = false
    }
  } catch {
    stopPolling()
    isRefreshing.value = false
  }
}

function startPolling() {
  stopPolling()
  pollStatus()
  pollTimer = setInterval(pollStatus, 3000)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// --- Classification Pipeline ---
const classificationConfig = ref({
  enabled: false,
  frequency: 'every-6-hours',
  lookbackHours: 12
})
const savingConfig = ref(false)
const configSaved = ref(false)
const scheduleInfo = ref(null)

const testIssueKey = ref('')
const testingClassification = ref(false)
const testResult = ref(null)

const bulkJql = ref('')
const bulkLimit = ref(1000)
const bulkDryRun = ref(true)
const runningBulk = ref(false)
const bulkResult = ref(null)

async function loadClassificationConfig() {
  try {
    const config = await getClassificationConfig()
    classificationConfig.value = config

    const schedule = await getScheduleInfo()
    scheduleInfo.value = schedule
  } catch (error) {
    console.error('Failed to load classification config:', error)
  }
}

async function saveClassificationConfig() {
  savingConfig.value = true
  configSaved.value = false
  try {
    const result = await saveConfigApi(classificationConfig.value)
    if (result.schedule) {
      scheduleInfo.value = result.schedule
    }
    configSaved.value = true
    setTimeout(() => {
      configSaved.value = false
    }, 3000)
  } catch (error) {
    console.error('Failed to save classification config:', error)
    alert(`Failed to save configuration: ${error.message}`)
  } finally {
    savingConfig.value = false
  }
}

async function testClassification() {
  testingClassification.value = true
  testResult.value = null
  try {
    const result = await testClassificationApi(testIssueKey.value, true)
    testResult.value = result.pipeline
  } catch (error) {
    console.error('Failed to test classification:', error)
    alert(`Failed to trigger test: ${error.message}`)
  } finally {
    testingClassification.value = false
  }
}

async function runBulkClassification() {
  runningBulk.value = true
  bulkResult.value = null
  try {
    const result = await runBulkApi({
      jql: bulkJql.value,
      dryRun: bulkDryRun.value,
      limit: bulkLimit.value
    })
    bulkResult.value = result.pipeline
  } catch (error) {
    console.error('Failed to run bulk classification:', error)
    alert(`Failed to trigger bulk classification: ${error.message}`)
  } finally {
    runningBulk.value = false
  }
}

onMounted(() => {
  // Check initial refresh status
  getRefreshStatus().then(status => {
    refreshStatus.value = status
    if (status.running) {
      isRefreshing.value = true
      startPolling()
    }
  }).catch(() => {})

  // Load classification config
  loadClassificationConfig()
})

onUnmounted(() => {
  stopPolling()
})
</script>
