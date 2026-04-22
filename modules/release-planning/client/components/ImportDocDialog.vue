<script setup>
import { ref, computed, watch } from 'vue'
import { apiRequest } from '@shared/client/services/api'

const API_BASE = '/modules/release-planning'

const props = defineProps({
  open: { type: Boolean, default: false },
  version: { type: String, required: true }
})

const emit = defineEmits(['imported', 'close'])

const docUrl = ref('')
const mode = ref('replace')
const previewing = ref(false)
const importing = ref(false)
const previewData = ref(null)
const error = ref(null)

watch(function() { return props.open }, function(isOpen) {
  if (isOpen) {
    docUrl.value = ''
    mode.value = 'replace'
    previewData.value = null
    error.value = null
    previewing.value = false
    importing.value = false
  }
})

const docId = computed(function() {
  const input = docUrl.value.trim()
  const urlMatch = input.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/)
  if (urlMatch) return urlMatch[1]
  if (/^[a-zA-Z0-9_-]{10,}$/.test(input)) return input
  return null
})

async function loadPreview() {
  if (!docId.value) return
  previewing.value = true
  error.value = null
  previewData.value = null

  try {
    const data = await apiRequest(
      `${API_BASE}/releases/${encodeURIComponent(props.version)}/import/doc/preview`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: docId.value })
      }
    )
    previewData.value = data
  } catch (err) {
    error.value = err.message || 'Failed to load preview'
  } finally {
    previewing.value = false
  }
}

async function executeImport() {
  if (!docId.value || !previewData.value) return
  importing.value = true
  error.value = null

  try {
    const data = await apiRequest(
      `${API_BASE}/releases/${encodeURIComponent(props.version)}/import/doc`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: docId.value, mode: mode.value })
      }
    )
    emit('imported', data)
    close()
  } catch (err) {
    error.value = err.message || 'Import failed'
  } finally {
    importing.value = false
  }
}

function close() {
  docUrl.value = ''
  mode.value = 'replace'
  previewData.value = null
  error.value = null
  emit('close')
}

const newCount = computed(function() {
  if (!previewData.value || !previewData.value.bigRocks) return 0
  return previewData.value.bigRocks.filter(function(r) { return r.status === 'new' }).length
})

const duplicateCount = computed(function() {
  if (!previewData.value || !previewData.value.bigRocks) return 0
  return previewData.value.bigRocks.filter(function(r) { return r.status === 'duplicate' }).length
})

const errorCount = computed(function() {
  if (!previewData.value || !previewData.value.bigRocks) return 0
  return previewData.value.bigRocks.filter(function(r) { return r.status === 'validation_error' }).length
})
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/40" @click="close" />

      <!-- Dialog -->
      <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Import Big Rocks from Google Doc
        </h3>

        <!-- Doc URL input -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Google Doc URL or Document ID
          </label>
          <div class="flex gap-2">
            <input
              v-model="docUrl"
              type="text"
              placeholder="https://docs.google.com/document/d/... or document ID"
              class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              :disabled="previewing || importing"
            />
            <button
              @click="loadPreview"
              :disabled="!docId || previewing || importing"
              class="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            >
              <svg v-if="previewing" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {{ previewing ? 'Loading...' : 'Load Preview' }}
            </button>
          </div>
        </div>

        <!-- Error -->
        <div v-if="error" class="mb-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
          {{ error }}
        </div>

        <!-- Preview -->
        <template v-if="previewData">
          <!-- Title and summary -->
          <div class="mb-3">
            <p class="text-sm text-gray-600 dark:text-gray-400">
              <span class="font-medium text-gray-900 dark:text-gray-100">{{ previewData.title }}</span>
              -- {{ previewData.bigRocks.length }} Big Rocks found
            </p>
            <div class="flex gap-3 mt-1 text-xs">
              <span class="text-green-600 dark:text-green-400" v-if="newCount > 0">{{ newCount }} new</span>
              <span class="text-amber-600 dark:text-amber-400" v-if="duplicateCount > 0">{{ duplicateCount }} duplicate</span>
              <span class="text-red-600 dark:text-red-400" v-if="errorCount > 0">{{ errorCount }} validation error</span>
            </div>
          </div>

          <!-- Warnings -->
          <div v-if="previewData.warnings && previewData.warnings.length > 0" class="mb-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400">
            <p v-for="(w, i) in previewData.warnings" :key="i">{{ w }}</p>
          </div>

          <!-- Preview table -->
          <div class="mb-4 overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b border-gray-200 dark:border-gray-700">
                  <th class="text-left py-2 px-2 font-medium text-gray-500 dark:text-gray-400">#</th>
                  <th class="text-left py-2 px-2 font-medium text-gray-500 dark:text-gray-400">Name</th>
                  <th class="text-left py-2 px-2 font-medium text-gray-500 dark:text-gray-400">State</th>
                  <th class="text-left py-2 px-2 font-medium text-gray-500 dark:text-gray-400">Outcome Keys</th>
                  <th class="text-left py-2 px-2 font-medium text-gray-500 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="rock in previewData.bigRocks"
                  :key="rock.priority"
                  class="border-b border-gray-100 dark:border-gray-700/50"
                  :class="{
                    'opacity-50': rock.status === 'duplicate' || rock.status === 'validation_error'
                  }"
                >
                  <td class="py-1.5 px-2 text-gray-500 dark:text-gray-400">{{ rock.priority }}</td>
                  <td class="py-1.5 px-2 text-gray-900 dark:text-gray-100 font-medium">{{ rock.name }}</td>
                  <td class="py-1.5 px-2 text-gray-600 dark:text-gray-400">{{ rock.state || '--' }}</td>
                  <td class="py-1.5 px-2 text-gray-600 dark:text-gray-400">
                    {{ rock.outcomeKeys && rock.outcomeKeys.length > 0 ? rock.outcomeKeys.join(', ') : '--' }}
                  </td>
                  <td class="py-1.5 px-2">
                    <span
                      class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                      :class="{
                        'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400': rock.status === 'new',
                        'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400': rock.status === 'duplicate',
                        'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400': rock.status === 'validation_error'
                      }"
                    >
                      {{ rock.status === 'new' ? 'New' : rock.status === 'duplicate' ? 'Duplicate' : 'Error' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mode selection -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Import Mode</label>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  v-model="mode"
                  type="radio"
                  value="replace"
                  class="text-primary-600 focus:ring-primary-500"
                  :disabled="importing"
                />
                Replace all Big Rocks
              </label>
              <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  v-model="mode"
                  type="radio"
                  value="append"
                  class="text-primary-600 focus:ring-primary-500"
                  :disabled="importing"
                />
                Append to existing
              </label>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              <template v-if="mode === 'replace'">
                All existing Big Rocks for this release will be replaced. A backup is created first.
              </template>
              <template v-else>
                New Big Rocks will be added after existing ones. Duplicates (by name) are skipped.
              </template>
            </p>
          </div>
        </template>

        <!-- Actions -->
        <div class="flex justify-end gap-3">
          <button
            @click="close"
            :disabled="importing"
            class="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            v-if="previewData"
            @click="executeImport"
            :disabled="importing || !previewData"
            class="px-4 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg v-if="importing" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {{ importing ? 'Importing...' : 'Import' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
