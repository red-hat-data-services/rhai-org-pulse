<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Releases Metadata</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Discover releases from Jira and configure product names and dates
        </p>
      </div>
      <button
        @click="discoverReleases"
        :disabled="discovering"
        class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
      >
        {{ discovering ? 'Discovering...' : 'Discover from Jira' }}
      </button>
    </div>

    <div v-if="error" class="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-red-700 dark:text-red-400 text-sm">
      {{ error }}
    </div>

    <div v-if="success" class="rounded-lg border border-green-200 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 p-4 text-green-700 dark:text-green-400 text-sm">
      Metadata saved successfully
    </div>

    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <div v-else-if="releases.length > 0" class="space-y-2">
      <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">
        Found {{ releases.length }} releases in Jira
      </div>

      <div class="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Release Version
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Features
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Product Name
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Due Date
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Code Freeze
              </th>
            </tr>
          </thead>
          <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            <tr v-for="release in releases" :key="release.releaseNumber">
              <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                {{ release.releaseNumber }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                {{ release.featureCount }}
              </td>
              <td class="px-4 py-3">
                <select
                  v-model="metadata[release.releaseNumber].productName"
                  class="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Auto ({{ release.productName }})</option>
                  <option value="Red Hat OpenShift AI">Red Hat OpenShift AI</option>
                  <option value="Red Hat Enterprise Linux AI">Red Hat Enterprise Linux AI</option>
                  <option value="RHAII">RHAII</option>
                </select>
              </td>
              <td class="px-4 py-3">
                <input
                  type="date"
                  v-model="metadata[release.releaseNumber].dueDate"
                  class="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </td>
              <td class="px-4 py-3">
                <input
                  type="date"
                  v-model="metadata[release.releaseNumber].codeFreezeDate"
                  class="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex justify-end pt-4">
        <button
          @click="saveMetadata"
          :disabled="saving"
          class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {{ saving ? 'Saving...' : 'Save Metadata' }}
        </button>
      </div>
    </div>

    <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
      Click "Discover from Jira" to load releases
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { apiRequest } from '@shared/client/services/api.js'

const releases = ref([])
const metadata = reactive({})
const loading = ref(false)
const discovering = ref(false)
const saving = ref(false)
const error = ref(null)
const success = ref(false)

async function discoverReleases() {
  discovering.value = true
  error.value = null
  try {
    const result = await apiRequest('/modules/releases/delivery/discover-releases', { method: 'POST' })
    releases.value = result.releases || []

    // Initialize metadata for each release
    for (const release of releases.value) {
      if (!metadata[release.releaseNumber]) {
        metadata[release.releaseNumber] = {
          productName: release.productName || '',
          dueDate: release.dueDate || '',
          codeFreezeDate: release.codeFreezeDate || ''
        }
      }
    }
  } catch (err) {
    error.value = err.message || 'Failed to discover releases'
  } finally {
    discovering.value = false
  }
}

async function saveMetadata() {
  saving.value = true
  error.value = null
  success.value = false
  try {
    // Filter out empty values
    const cleanMetadata = {}
    for (const [releaseNumber, meta] of Object.entries(metadata)) {
      cleanMetadata[releaseNumber] = {
        productName: meta.productName || undefined,
        dueDate: meta.dueDate || undefined,
        codeFreezeDate: meta.codeFreezeDate || undefined
      }
      // Remove undefined values
      Object.keys(cleanMetadata[releaseNumber]).forEach(key => {
        if (cleanMetadata[releaseNumber][key] === undefined) {
          delete cleanMetadata[releaseNumber][key]
        }
      })
    }

    await apiRequest('/modules/releases/delivery/releases-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanMetadata)
    })
    success.value = true
    setTimeout(() => { success.value = false }, 3000)
  } catch (err) {
    error.value = err.message || 'Failed to save metadata'
  } finally {
    saving.value = false
  }
}

async function loadExistingMetadata() {
  loading.value = true
  try {
    const existingMetadata = await apiRequest('/modules/releases/delivery/releases-metadata')
    Object.assign(metadata, existingMetadata)
  } catch {
    // Ignore - metadata might not exist yet
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadExistingMetadata()
})
</script>
