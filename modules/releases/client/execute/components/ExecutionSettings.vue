<script setup>
import { ref, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const config = ref(null)
const loading = ref(true)
const saving = ref(false)
const saveError = ref(null)
const saveSuccess = ref(false)
const statusData = ref(null)

async function loadConfig() {
  loading.value = true
  try {
    config.value = await apiRequest('/modules/releases/execution/config')
  } catch {
    config.value = null
  } finally {
    loading.value = false
  }
}

async function loadStatus() {
  try {
    statusData.value = await apiRequest('/modules/releases/execution/status')
  } catch {
    // ignore
  }
}

async function saveConfig() {
  saving.value = true
  saveError.value = null
  saveSuccess.value = false
  try {
    const toSave = {
      gitlabBaseUrl: config.value.gitlabBaseUrl,
      projectPath: config.value.projectPath,
      jobName: config.value.jobName,
      branch: config.value.branch,
      artifactPath: config.value.artifactPath,
      refreshIntervalHours: config.value.refreshIntervalHours,
      enabled: config.value.enabled
    }
    const result = await apiRequest('/modules/releases/execution/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSave)
    })
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
    // Reload status if fetch was triggered
    if (result.status === 'success' || result.status === 'error') {
      loadStatus()
    }
  } catch (e) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadConfig()
  loadStatus()
})
</script>

<template>
  <div class="space-y-6">
    <div v-if="loading" class="text-gray-500 dark:text-gray-400">Loading configuration...</div>

    <template v-else-if="config">
      <!-- Connection Status -->
      <div class="rounded-md p-3" :class="config.tokenConfigured ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'">
        <p class="text-sm" :class="config.tokenConfigured ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'">
          <template v-if="config.tokenConfigured">
            GitLab token configured (source: <code class="font-mono text-xs">{{ config.tokenSource }}</code>)
          </template>
          <template v-else>
            No GitLab token found. Set <code class="font-mono text-xs">FEATURE_TRAFFIC_GITLAB_TOKEN</code> or <code class="font-mono text-xs">GITLAB_TOKEN</code> environment variable.
          </template>
        </p>
      </div>

      <!-- Stale Warning -->
      <div v-if="statusData?.staleWarning" class="rounded-md p-3 bg-yellow-50 dark:bg-yellow-900/20">
        <p class="text-sm text-yellow-700 dark:text-yellow-300">
          Data is stale ({{ statusData.dataAge }} old). Last fetch status: {{ statusData.lastFetch?.status || 'unknown' }}
        </p>
      </div>

      <!-- Config Form -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="md:col-span-2 flex items-center gap-2">
          <input
            id="ft-enabled"
            v-model="config.enabled"
            type="checkbox"
            class="rounded border-gray-300 dark:border-gray-600"
          />
          <label for="ft-enabled" class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enable automatic fetching
          </label>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GitLab Base URL</label>
          <input
            v-model="config.gitlabBaseUrl"
            type="text"
            class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Path</label>
          <input
            v-model="config.projectPath"
            type="text"
            placeholder="e.g. redhat/rhel-ai/agentic-ci/feature-traffic"
            class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Branch</label>
          <input
            v-model="config.branch"
            type="text"
            class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Job Name</label>
          <input
            v-model="config.jobName"
            type="text"
            class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Artifact Path Prefix</label>
          <input
            v-model="config.artifactPath"
            type="text"
            placeholder="e.g. output"
            class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">Directory prefix to strip from artifact paths</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Refresh Interval (hours)</label>
          <input
            v-model.number="config.refreshIntervalHours"
            type="number"
            min="1"
            max="168"
            class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300"
          />
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

  </div>
</template>
