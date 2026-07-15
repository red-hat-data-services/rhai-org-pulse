<script setup>
import { ref, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const MODULE_API = '/modules/ai-catalyst'

const config = ref(null)
const loading = ref(true)
const error = ref(null)

const boardConfig = ref(null)
const boardConfigLoading = ref(true)
const boardSaving = ref(false)
const boardSaveError = ref(null)
const boardSaveSuccess = ref(false)

const showcaseConfig = ref(null)
const showcaseLoading = ref(true)
const showcaseSaving = ref(false)
const showcaseSaveError = ref(null)
const showcaseSaveSuccess = ref(false)

async function loadConfig() {
  loading.value = true
  error.value = null
  try {
    config.value = await apiRequest(`${MODULE_API}/config`)
  } catch (err) {
    error.value = err.message || 'Failed to load configuration'
  } finally {
    loading.value = false
  }
}

async function loadBoardConfig() {
  boardConfigLoading.value = true
  try {
    boardConfig.value = await apiRequest(`${MODULE_API}/board-config`)
  } catch {
    boardConfig.value = null
  } finally {
    boardConfigLoading.value = false
  }
}

async function saveBoardConfig() {
  boardSaving.value = true
  boardSaveError.value = null
  boardSaveSuccess.value = false
  try {
    await apiRequest(`${MODULE_API}/board-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(boardConfig.value)
    })
    boardSaveSuccess.value = true
    setTimeout(() => { boardSaveSuccess.value = false }, 3000)
    loadConfig()
  } catch (e) {
    boardSaveError.value = e.message
  } finally {
    boardSaving.value = false
  }
}

async function loadShowcaseConfig() {
  showcaseLoading.value = true
  try {
    showcaseConfig.value = await apiRequest(`${MODULE_API}/showcase/config`)
  } catch {
    showcaseConfig.value = null
  } finally {
    showcaseLoading.value = false
  }
}

async function saveShowcaseConfig() {
  showcaseSaving.value = true
  showcaseSaveError.value = null
  showcaseSaveSuccess.value = false
  try {
    await apiRequest(`${MODULE_API}/showcase/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(showcaseConfig.value)
    })
    showcaseSaveSuccess.value = true
    setTimeout(() => { showcaseSaveSuccess.value = false }, 3000)
  } catch (e) {
    showcaseSaveError.value = e.message
  } finally {
    showcaseSaving.value = false
  }
}

onMounted(() => {
  loadConfig()
  loadBoardConfig()
  loadShowcaseConfig()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Monthly Board section -->
    <div class="space-y-4">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Monthly Board</h3>

      <div v-if="loading || boardConfigLoading" class="text-sm text-gray-500 dark:text-gray-400">Loading...</div>

      <template v-else>
        <div v-if="config" class="space-y-3">
          <div class="flex items-center gap-2">
            <span :class="['w-2 h-2 rounded-full', config.configured ? 'bg-green-500' : 'bg-red-500']"></span>
            <span class="text-sm text-gray-700 dark:text-gray-300">
              {{ config.configured ? 'Connected to POC Explorer Sheet' : 'Not configured' }}
            </span>
          </div>

          <div v-if="config.demoMode" class="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1">
            Demo mode — showing fixture data
          </div>

          <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <div v-if="config.lastSyncTime">Last sync: {{ new Date(config.lastSyncTime).toLocaleString() }}</div>
            <div>Available boards: {{ config.boardCount }}</div>
          </div>
        </div>

        <div v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</div>

        <template v-if="boardConfig">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Google Spreadsheet ID</label>
            <input
              v-model="boardConfig.sheetId"
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
              @click="saveBoardConfig"
              :disabled="boardSaving"
              class="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50"
            >
              {{ boardSaving ? 'Saving...' : 'Save Configuration' }}
            </button>
            <span v-if="boardSaveSuccess" class="text-green-600 dark:text-green-400 text-sm">Saved successfully</span>
            <span v-if="boardSaveError" class="text-red-600 dark:text-red-400 text-sm">{{ boardSaveError }}</span>
          </div>
        </template>
      </template>
    </div>

    <hr class="border-gray-200 dark:border-gray-700" />

    <!-- Showcase section -->
    <div class="space-y-4">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Showcase</h3>

      <div v-if="showcaseLoading" class="text-sm text-gray-500 dark:text-gray-400">Loading...</div>

      <template v-else-if="showcaseConfig">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Google Spreadsheet ID</label>
          <input
            v-model="showcaseConfig.sheetId"
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
            @click="saveShowcaseConfig"
            :disabled="showcaseSaving"
            class="px-4 py-2 bg-primary-600 text-white rounded-md text-sm hover:bg-primary-700 disabled:opacity-50"
          >
            {{ showcaseSaving ? 'Saving...' : 'Save Configuration' }}
          </button>
          <span v-if="showcaseSaveSuccess" class="text-green-600 dark:text-green-400 text-sm">Saved successfully</span>
          <span v-if="showcaseSaveError" class="text-red-600 dark:text-red-400 text-sm">{{ showcaseSaveError }}</span>
        </div>
      </template>
    </div>
  </div>
</template>
