<script setup>
import { ref, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const config = ref(null)
const loading = ref(true)
const saving = ref(false)
const saveError = ref(null)
const saveSuccess = ref(false)

async function loadConfig() {
  loading.value = true
  try {
    config.value = await apiRequest('/modules/catalyst-showcase/config')
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
    await apiRequest('/modules/catalyst-showcase/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config.value)
    })
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (e) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <div class="space-y-6">
    <div v-if="loading" class="text-gray-500 dark:text-gray-400">Loading configuration...</div>

    <template v-else-if="config">
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
  </div>
</template>
