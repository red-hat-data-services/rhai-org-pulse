<script setup>
import { ref, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const MODULE_API = '/modules/customer-insights'

const config = ref(null)
const configLoading = ref(true)
const saving = ref(false)
const saveError = ref(null)
const saveSuccess = ref(false)

const isDemoMode = ref(false)
const isConfigured = ref(false)

async function loadConfig() {
  configLoading.value = true
  try {
    config.value = await apiRequest(`${MODULE_API}/sheet-config`)
    isConfigured.value = !!(config.value && config.value.sheetId)
  } catch {
    config.value = { sheetId: '' }
  } finally {
    configLoading.value = false
  }
}

async function saveConfig() {
  saving.value = true
  saveError.value = null
  saveSuccess.value = false
  try {
    await apiRequest(`${MODULE_API}/sheet-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config.value)
    })
    saveSuccess.value = true
    isConfigured.value = !!(config.value && config.value.sheetId)
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (e) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  isDemoMode.value = import.meta.env.VITE_DEMO_MODE === 'true'
  loadConfig()
})
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-4">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Central Spreadsheet</h3>

      <div v-if="configLoading" class="text-sm text-gray-500 dark:text-gray-400">Loading...</div>

      <template v-else>
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <span :class="['w-2 h-2 rounded-full', isConfigured ? 'bg-green-500' : 'bg-red-500']"></span>
            <span class="text-sm text-gray-700 dark:text-gray-300">
              {{ isConfigured ? 'Connected to Customer Interactions Sheet' : 'Not configured' }}
            </span>
          </div>

          <div v-if="isDemoMode" class="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1">
            Demo mode — showing fixture data
          </div>
        </div>

        <template v-if="config">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Google Spreadsheet ID</label>
            <input
              v-model="config.sheetId"
              type="text"
              placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              class="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
              The ID from the Google Sheets URL. The sheet must be shared with the Google service account.
            </p>
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
      </template>
    </div>
  </div>
</template>
