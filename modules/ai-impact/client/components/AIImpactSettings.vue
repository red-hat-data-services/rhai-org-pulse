<script setup>
import { ref, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const config = ref(null)
const loading = ref(true)
const saving = ref(false)
const saveError = ref(null)
const saveSuccess = ref(false)
const refreshStatus = ref(null)
const refreshTriggering = ref(false)
const clearingCache = ref(false)
const clearCacheResult = ref(null)
const assessmentStatus = ref(null)
const assessmentStatusLoading = ref(false)
const clearingAssessments = ref(false)
const clearAssessmentsResult = ref(null)
const featureStatus = ref(null)
const featureStatusLoading = ref(false)
const clearingFeatures = ref(false)
const clearFeaturesResult = ref(null)
const syncStatus = ref(null)
const syncTriggering = ref(false)

async function loadConfig() {
  loading.value = true
  try {
    config.value = await apiRequest('/modules/ai-impact/config')
  } catch {
    config.value = null
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  saving.value = true
  saveError.value = null
  saveSuccess.value = false
  try {
    // Parse excludedStatuses from comma-separated string
    const toSave = { ...config.value }
    if (typeof toSave.excludedStatuses === 'string') {
      toSave.excludedStatuses = toSave.excludedStatuses
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)
    }
    await apiRequest('/modules/ai-impact/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSave)
    })
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (e) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}

async function triggerRefresh() {
  refreshTriggering.value = true
  try {
    const result = await apiRequest('/modules/ai-impact/refresh', { method: 'POST' })
    refreshStatus.value = result
    // Poll for completion
    if (result.status === 'started') {
      pollRefreshStatus()
    }
  } catch (e) {
    refreshStatus.value = { status: 'error', message: e.message }
  } finally {
    refreshTriggering.value = false
  }
}

async function pollRefreshStatus() {
  const poll = async () => {
    try {
      const status = await apiRequest('/modules/ai-impact/refresh/status')
      refreshStatus.value = status
      if (status.running) {
        setTimeout(poll, 3000)
      }
    } catch {
      // ignore polling errors
    }
  }
  setTimeout(poll, 2000)
}

async function triggerFeatureSync() {
  syncTriggering.value = true
  try {
    const result = await apiRequest('/modules/ai-impact/features/sync', { method: 'POST' })
    syncStatus.value = result
    if (result.status === 'started') {
      pollSyncStatus()
    }
  } catch (e) {
    syncStatus.value = { status: 'error', message: e.message }
  } finally {
    syncTriggering.value = false
  }
}

async function pollSyncStatus() {
  const poll = async () => {
    try {
      const status = await apiRequest('/modules/ai-impact/features/sync/status')
      syncStatus.value = status
      if (status.running) {
        setTimeout(poll, 3000)
      } else {
        // Reload feature status after sync completes
        loadFeatureStatus()
      }
    } catch {
      // ignore polling errors
    }
  }
  setTimeout(poll, 2000)
}

async function clearCache() {
  clearingCache.value = true
  clearCacheResult.value = null
  try {
    await apiRequest('/modules/ai-impact/cache', { method: 'DELETE' })
    clearCacheResult.value = { status: 'success', message: 'Cached data cleared' }
    setTimeout(() => { clearCacheResult.value = null }, 3000)
  } catch (e) {
    clearCacheResult.value = { status: 'error', message: e.message }
  } finally {
    clearingCache.value = false
  }
}

async function checkRefreshStatus() {
  try {
    refreshStatus.value = await apiRequest('/modules/ai-impact/refresh/status')
  } catch {
    // ignore
  }
}

async function checkSyncStatus() {
  try {
    syncStatus.value = await apiRequest('/modules/ai-impact/features/sync/status')
  } catch {
    // ignore
  }
}

async function loadAssessmentStatus() {
  assessmentStatusLoading.value = true
  try {
    assessmentStatus.value = await apiRequest('/modules/ai-impact/assessments/status')
  } catch {
    assessmentStatus.value = null
  } finally {
    assessmentStatusLoading.value = false
  }
}

async function clearAssessments() {
  clearingAssessments.value = true
  clearAssessmentsResult.value = null
  try {
    await apiRequest('/modules/ai-impact/assessments', { method: 'DELETE' })
    clearAssessmentsResult.value = { status: 'success', message: 'Assessment data cleared' }
    loadAssessmentStatus()
    setTimeout(() => { clearAssessmentsResult.value = null }, 3000)
  } catch (e) {
    clearAssessmentsResult.value = { status: 'error', message: e.message }
  } finally {
    clearingAssessments.value = false
  }
}

async function loadFeatureStatus() {
  featureStatusLoading.value = true
  try {
    featureStatus.value = await apiRequest('/modules/ai-impact/features/status')
  } catch {
    featureStatus.value = null
  } finally {
    featureStatusLoading.value = false
  }
}

async function clearFeatures() {
  clearingFeatures.value = true
  clearFeaturesResult.value = null
  try {
    await apiRequest('/modules/ai-impact/features', { method: 'DELETE' })
    clearFeaturesResult.value = { status: 'success', message: 'Feature data cleared' }
    loadFeatureStatus()
    setTimeout(() => { clearFeaturesResult.value = null }, 3000)
  } catch (e) {
    clearFeaturesResult.value = { status: 'error', message: e.message }
  } finally {
    clearingFeatures.value = false
  }
}

onMounted(() => {
  loadConfig()
  checkRefreshStatus()
  checkSyncStatus()
  loadAssessmentStatus()
  loadFeatureStatus()
})

// Format excludedStatuses for display
function getExcludedStatusesDisplay() {
  if (!config.value) return ''
  if (Array.isArray(config.value.excludedStatuses)) {
    return config.value.excludedStatuses.join(', ')
  }
  return config.value.excludedStatuses || ''
}

function getAutofixProjectsDisplay() {
  if (!config.value) return ''
  if (Array.isArray(config.value.autofixProjects)) {
    return config.value.autofixProjects.join(', ')
  }
  return config.value.autofixProjects || ''
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="loading" class="text-gray-500 dark:text-gray-400">Loading configuration...</div>

    <template v-else-if="config">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jira Project</label>
          <input
            v-model="config.jiraProject"
            type="text"
            class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Linked Project</label>
          <input
            v-model="config.linkedProject"
            type="text"
            class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Created Label</label>
          <input
            v-model="config.createdLabel"
            type="text"
            class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Revised Label</label>
          <input
            v-model="config.revisedLabel"
            type="text"
            class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Test Exclusion Label</label>
          <input
            v-model="config.testExclusionLabel"
            type="text"
            class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link Type Name</label>
          <input
            v-model="config.linkTypeName"
            type="text"
            class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Excluded Statuses</label>
          <input
            :value="getExcludedStatusesDisplay()"
            @input="config.excludedStatuses = $event.target.value"
            type="text"
            placeholder="Comma-separated, e.g. Closed, Done"
            class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Comma-separated list of Jira statuses to exclude</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lookback (months)</label>
          <input
            v-model.number="config.lookbackMonths"
            type="number"
            min="1"
            max="120"
            class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trend Threshold (pp)</label>
          <input
            v-model.number="config.trendThresholdPp"
            type="number"
            min="0"
            max="50"
            class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
          />
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Percentage-point change needed to classify trend as growing/declining</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button
          @click="saveConfig"
          :disabled="saving"
          class="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50"
        >
          {{ saving ? 'Saving...' : 'Save Configuration' }}
        </button>
        <span v-if="saveSuccess" class="text-green-600 dark:text-green-400 text-sm">Saved successfully</span>
        <span v-if="saveError" class="text-red-600 dark:text-red-400 text-sm">{{ saveError }}</span>
      </div>
    </template>

    <!-- Autofix Configuration -->
    <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Jira AutoFix</h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4" v-if="config">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jira Projects</label>
          <input
            :value="getAutofixProjectsDisplay()"
            @input="config.autofixProjects = $event.target.value.split(',').map(s => s.trim()).filter(Boolean)"
            type="text"
            placeholder="AIPCC, RHOAIENG"
            class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Comma-separated Jira project keys to scan for autofix labels</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Created After</label>
          <input
            v-model="config.autofixCreatedAfter"
            type="text"
            placeholder="2026-04-15"
            class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Only include issues created on or after this date (YYYY-MM-DD)</p>
        </div>
      </div>
    </div>

    <!-- Data Refresh -->
    <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Data Refresh</h4>
      <div class="space-y-4">
        <!-- RFE & AutoFix refresh -->
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="flex items-center justify-between mb-2">
            <div>
              <h5 class="text-sm font-medium text-gray-800 dark:text-gray-200">RFE & AutoFix Data</h5>
              <p class="text-xs text-gray-500 dark:text-gray-400">Fetches RFE issues and AutoFix pipeline data from Jira</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="triggerRefresh"
                :disabled="refreshTriggering || refreshStatus?.running"
                class="px-3 py-1.5 bg-gray-800 dark:bg-gray-600 text-white rounded-md text-sm hover:bg-gray-900 dark:hover:bg-gray-500 disabled:opacity-50"
              >
                {{ refreshStatus?.running ? 'Refreshing...' : 'Refresh' }}
              </button>
              <button
                @click="clearCache"
                :disabled="clearingCache"
                class="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                {{ clearingCache ? 'Clearing...' : 'Clear Cache' }}
              </button>
            </div>
          </div>
          <div v-if="clearCacheResult" class="text-sm mb-1" :class="clearCacheResult.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
            {{ clearCacheResult.message }}
          </div>
          <div v-if="refreshStatus?.lastResult" class="text-xs text-gray-500 dark:text-gray-400">
            Last refresh:
            <span :class="refreshStatus.lastResult.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
              {{ refreshStatus.lastResult.status }}
            </span>
            <span v-if="refreshStatus.lastResult.message"> &mdash; {{ refreshStatus.lastResult.message }}</span>
            <span v-if="refreshStatus.lastResult.completedAt">
              at {{ new Date(refreshStatus.lastResult.completedAt).toLocaleString() }}
            </span>
          </div>
        </div>

        <!-- Feature Jira Sync -->
        <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div class="flex items-center justify-between mb-2">
            <div>
              <h5 class="text-sm font-medium text-gray-800 dark:text-gray-200">Feature Jira Sync</h5>
              <p class="text-xs text-gray-500 dark:text-gray-400">Syncs title, status, priority, and labels (including human sign-off) from Jira for all tracked features</p>
            </div>
            <button
              @click="triggerFeatureSync"
              :disabled="syncTriggering || syncStatus?.running"
              class="px-3 py-1.5 bg-gray-800 dark:bg-gray-600 text-white rounded-md text-sm hover:bg-gray-900 dark:hover:bg-gray-500 disabled:opacity-50"
            >
              {{ syncStatus?.running ? 'Syncing...' : 'Sync Now' }}
            </button>
          </div>
          <div v-if="syncStatus?.lastResult" class="text-xs text-gray-500 dark:text-gray-400">
            Last sync:
            <span :class="{
              'text-green-600 dark:text-green-400': syncStatus.lastResult.status === 'success',
              'text-amber-600 dark:text-amber-400': syncStatus.lastResult.status === 'partial',
              'text-red-600 dark:text-red-400': syncStatus.lastResult.status === 'error'
            }">
              {{ syncStatus.lastResult.status }}
            </span>
            <span v-if="syncStatus.lastResult.message"> &mdash; {{ syncStatus.lastResult.message }}</span>
            <span v-if="syncStatus.lastResult.completedAt">
              at {{ new Date(syncStatus.lastResult.completedAt).toLocaleString() }}
            </span>
            <div v-if="syncStatus.lastResult.errors" class="mt-1 text-red-500 dark:text-red-400">
              <div v-for="(err, i) in syncStatus.lastResult.errors" :key="i">{{ err }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Assessment Data -->
    <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Assessment Data</h4>
      <div v-if="assessmentStatusLoading" class="text-sm text-gray-500 dark:text-gray-400">Loading assessment status...</div>
      <template v-else-if="assessmentStatus">
        <div class="grid grid-cols-3 gap-4 mb-3">
          <div class="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">Total Assessed</p>
            <p class="text-lg font-semibold dark:text-gray-200">{{ assessmentStatus.totalAssessed }}</p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">History Entries</p>
            <p class="text-lg font-semibold dark:text-gray-200">{{ assessmentStatus.totalHistoryEntries }}</p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">Last Synced</p>
            <p class="text-sm font-medium dark:text-gray-200">
              {{ assessmentStatus.lastSyncedAt ? new Date(assessmentStatus.lastSyncedAt).toLocaleString() : 'Never' }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="clearAssessments"
            :disabled="clearingAssessments || assessmentStatus.totalAssessed === 0"
            class="px-4 py-2 border border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 rounded-md text-sm hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
          >
            {{ clearingAssessments ? 'Clearing...' : 'Clear Assessment Data' }}
          </button>
          <span v-if="clearAssessmentsResult" class="text-sm" :class="clearAssessmentsResult.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
            {{ clearAssessmentsResult.message }}
          </span>
        </div>
      </template>
      <div v-else class="text-sm text-gray-500 dark:text-gray-400">No assessment data available</div>
    </div>

    <!-- Feature Review Data -->
    <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
      <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Feature Reviews</h4>
      <div v-if="featureStatusLoading" class="text-sm text-gray-500 dark:text-gray-400">Loading feature status...</div>
      <template v-else-if="featureStatus">
        <div class="grid grid-cols-4 gap-4 mb-3">
          <div class="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">Total Features</p>
            <p class="text-lg font-semibold dark:text-gray-200">{{ featureStatus.totalFeatures }}</p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">History Entries</p>
            <p class="text-lg font-semibold dark:text-gray-200">{{ featureStatus.totalHistoryEntries }}</p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">Last Pipeline Sync</p>
            <p class="text-sm font-medium dark:text-gray-200">
              {{ featureStatus.lastSyncedAt ? new Date(featureStatus.lastSyncedAt).toLocaleString() : 'Never' }}
            </p>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">Last Jira Sync</p>
            <p class="text-sm font-medium dark:text-gray-200">
              {{ featureStatus.lastJiraSyncAt ? new Date(featureStatus.lastJiraSyncAt).toLocaleString() : 'Never' }}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="clearFeatures"
            :disabled="clearingFeatures || featureStatus.totalFeatures === 0"
            class="px-4 py-2 border border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 rounded-md text-sm hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
          >
            {{ clearingFeatures ? 'Clearing...' : 'Clear Feature Data' }}
          </button>
          <span v-if="clearFeaturesResult" class="text-sm" :class="clearFeaturesResult.status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
            {{ clearFeaturesResult.message }}
          </span>
        </div>
      </template>
      <div v-else class="text-sm text-gray-500 dark:text-gray-400">No feature data available</div>
    </div>
  </div>
</template>
