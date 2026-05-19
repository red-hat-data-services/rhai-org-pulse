<script setup>
import { ref, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const config = ref({ baseUrl: '' })
const loading = ref(true)
const saving = ref(false)
const saveError = ref(null)
const saveSuccess = ref(false)
const healthStatus = ref(null)
const checkingHealth = ref(false)

async function loadConfig() {
  loading.value = true
  try {
    config.value = await apiRequest('/modules/product-builds/config')
  } catch {
    config.value = { baseUrl: '' }
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  saving.value = true
  saveError.value = null
  saveSuccess.value = false
  try {
    await apiRequest('/modules/product-builds/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl: config.value.baseUrl })
    })
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (e) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}

async function checkHealth() {
  checkingHealth.value = true
  healthStatus.value = null
  try {
    const data = await apiRequest('/healthz')
    const fastapi = data.dependencies?.['aipcc-dashboard-api']
    healthStatus.value = fastapi || { status: 'unknown' }
  } catch {
    healthStatus.value = { status: 'unavailable' }
  } finally {
    checkingHealth.value = false
  }
}

onMounted(loadConfig)
</script>

<template>
  <div class="space-y-6">
    <div v-if="loading" class="text-gray-500 dark:text-gray-400">Loading configuration...</div>

    <template v-else>
      <!-- API URL -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Product Builds API URL
        </label>
        <input
          v-model="config.baseUrl"
          type="url"
          placeholder="https://dashboard.example.com"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Base URL of the FastAPI dashboard server. Can also be set via <code class="font-mono">PRODUCT_BUILDS_API_URL</code> env var.
        </p>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3">
        <button
          @click="saveConfig"
          :disabled="saving"
          class="px-4 py-2 text-sm font-medium text-white bg-gray-900 dark:bg-gray-100 dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
        <button
          @click="checkHealth"
          :disabled="checkingHealth || !config.baseUrl"
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {{ checkingHealth ? 'Checking...' : 'Test Connection' }}
        </button>
      </div>

      <!-- Save feedback -->
      <div v-if="saveSuccess" class="rounded-md bg-green-50 dark:bg-green-900/20 p-3">
        <p class="text-sm text-green-700 dark:text-green-300">Configuration saved.</p>
      </div>
      <div v-if="saveError" class="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
        <p class="text-sm text-red-700 dark:text-red-300">{{ saveError }}</p>
      </div>

      <!-- Health status -->
      <div v-if="healthStatus" class="rounded-md p-3" :class="healthStatus.status === 'ok' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'">
        <p class="text-sm" :class="healthStatus.status === 'ok' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'">
          <template v-if="healthStatus.status === 'ok'">
            Connected successfully
            <span v-if="healthStatus.latency" class="text-xs ml-1">({{ healthStatus.latency }}ms)</span>
          </template>
          <template v-else>
            Unable to reach Product Builds API
          </template>
        </p>
      </div>
    </template>
  </div>
</template>
