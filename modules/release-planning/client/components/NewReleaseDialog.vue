<script setup>
import { ref, computed, watch } from 'vue'
import { useReleasePlanning } from '../composables/useReleasePlanning'

const props = defineProps({
  open: { type: Boolean, default: false },
  releases: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'created'])

const { createRelease, fetchSmartSheetReleases, previewDocImport, executeDocImport } = useReleasePlanning()

const version = ref('')
const mode = ref('blank')
const cloneFrom = ref('')
const creating = ref(false)
const errorMsg = ref('')

// Google Doc import state
const docUrl = ref('')
const previewLoading = ref(false)
const previewData = ref(null)
const previewError = ref(null)
const releaseCreated = ref(false)

// SmartSheet state
const smartSheetReleases = ref([])
const smartSheetLoading = ref(false)
const smartSheetAvailable = ref(false)

const unconfiguredSmartSheetReleases = computed(function() {
  return smartSheetReleases.value.filter(function(r) { return !r.alreadyConfigured })
})

const docId = computed(function() {
  var input = docUrl.value.trim()
  var urlMatch = input.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/)
  if (urlMatch) return urlMatch[1]
  if (/^[a-zA-Z0-9_-]{10,}$/.test(input)) return input
  return null
})

const newCount = computed(function() {
  if (!previewData.value || !previewData.value.bigRocks) return 0
  return previewData.value.bigRocks.filter(function(r) { return r.status === 'new' }).length
})

const errorCount = computed(function() {
  if (!previewData.value || !previewData.value.bigRocks) return 0
  return previewData.value.bigRocks.filter(function(r) { return r.status === 'validation_error' }).length
})

const canCreate = computed(function() {
  if (!version.value.trim()) return false
  if (mode.value === 'clone' && !cloneFrom.value) return false
  if (mode.value === 'import' && !previewData.value) return false
  return true
})

watch(function() { return props.open }, function(isOpen) {
  if (isOpen) {
    version.value = ''
    mode.value = 'blank'
    cloneFrom.value = props.releases.length > 0 ? props.releases[0].version : ''
    creating.value = false
    errorMsg.value = ''
    docUrl.value = ''
    previewData.value = null
    previewError.value = null
    previewLoading.value = false
    releaseCreated.value = false
    loadSmartSheetReleases()
  }
})

watch(mode, function(newMode) {
  if (newMode !== 'import') {
    docUrl.value = ''
    previewData.value = null
    previewError.value = null
  }
})

async function loadSmartSheetReleases() {
  smartSheetLoading.value = true
  try {
    var data = await fetchSmartSheetReleases()
    if (data && data.available && data.available.length > 0) {
      smartSheetReleases.value = data.available
      smartSheetAvailable.value = true
    } else {
      smartSheetReleases.value = []
      smartSheetAvailable.value = false
    }
  } catch {
    smartSheetReleases.value = []
    smartSheetAvailable.value = false
  } finally {
    smartSheetLoading.value = false
  }
}

function selectSmartSheetRelease(rel) {
  version.value = rel.version
}

function formatDate(dateStr) {
  if (!dateStr) return '--'
  return dateStr
}

async function loadPreview() {
  if (!docId.value || !version.value.trim()) return
  previewLoading.value = true
  previewError.value = null
  previewData.value = null

  try {
    var data = await previewDocImport(version.value.trim(), docId.value)
    previewData.value = data
  } catch (err) {
    previewError.value = err.message || 'Failed to load preview'
  } finally {
    previewLoading.value = false
  }
}

async function handleCreate() {
  if (!canCreate.value) return
  creating.value = true
  errorMsg.value = ''

  try {
    var result
    if (!releaseCreated.value) {
      var cloneSource = mode.value === 'clone' ? cloneFrom.value : null
      result = await createRelease(version.value.trim(), cloneSource)

      if (result.status === 'skipped') {
        emit('close')
        return
      }
      releaseCreated.value = true
    }

    if (mode.value === 'import' && docId.value) {
      await executeDocImport(version.value.trim(), docId.value, 'replace')
    }

    emit('created', result || { version: version.value.trim() })
    emit('close')
  } catch (err) {
    errorMsg.value = err.message || 'Failed to create release'
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50" @click="$emit('close')"></div>

      <!-- Dialog -->
      <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto"
           :class="mode === 'import' ? 'max-w-2xl' : 'max-w-md'">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">New Release</h2>

        <!-- Version input -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Release Version</label>
          <input
            v-model="version"
            type="text"
            placeholder="e.g., 3.6"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <!-- SmartSheet suggestions -->
        <div v-if="smartSheetAvailable && unconfiguredSmartSheetReleases.length > 0" class="mb-4">
          <div class="border-t border-gray-200 dark:border-gray-700 pt-3 mt-2">
            <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Available from SmartSheet</label>
            <div class="space-y-1 max-h-32 overflow-y-auto">
              <button
                v-for="rel in unconfiguredSmartSheetReleases"
                :key="rel.version"
                @click="selectSmartSheetRelease(rel)"
                class="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                :class="version === rel.version ? 'bg-primary-50 dark:bg-primary-500/10 ring-1 ring-primary-300 dark:ring-primary-500/30' : ''"
              >
                <span class="font-medium text-gray-800 dark:text-gray-200">{{ rel.version }}</span>
                <span class="text-gray-500 dark:text-gray-400 ml-2">
                  EA1: {{ formatDate(rel.ea1Target) }} | GA: {{ formatDate(rel.gaTarget) }}
                </span>
              </button>
            </div>
            <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Dates from RHOAI GA SmartSheet schedule</p>
          </div>
        </div>

        <!-- Mode selection -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Initial Big Rocks</label>
          <div class="space-y-2">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="mode" value="blank" class="text-primary-600 focus:ring-primary-500" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Start blank</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="mode" value="clone" class="text-primary-600 focus:ring-primary-500" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Clone from existing release</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="mode" value="import" class="text-primary-600 focus:ring-primary-500" />
              <span class="text-sm text-gray-700 dark:text-gray-300">Import from Google Doc</span>
            </label>
          </div>
        </div>

        <!-- Clone source dropdown -->
        <div v-if="mode === 'clone'" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Clone from</label>
          <select
            v-model="cloneFrom"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option v-for="r in releases" :key="r.version" :value="r.version">
              {{ r.version }} ({{ r.bigRockCount }} Big Rocks)
            </option>
          </select>
        </div>

        <!-- Google Doc import section -->
        <div v-if="mode === 'import'" class="mb-4 space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Google Doc URL or Document ID</label>
            <div class="flex gap-2">
              <input
                v-model="docUrl"
                type="text"
                placeholder="https://docs.google.com/document/d/... or document ID"
                class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                :disabled="previewLoading || creating"
              />
              <button
                @click="loadPreview"
                :disabled="!docId || !version.trim() || previewLoading || creating"
                class="px-3 py-2 text-sm font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap border border-gray-300 dark:border-gray-600"
              >
                <svg v-if="previewLoading" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {{ previewLoading ? 'Loading...' : 'Load Preview' }}
              </button>
            </div>
          </div>

          <!-- Preview error -->
          <div v-if="previewError" class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-3 text-sm text-red-700 dark:text-red-400">
            {{ previewError }}
          </div>

          <!-- Preview results -->
          <template v-if="previewData">
            <div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                <span class="font-medium text-gray-900 dark:text-gray-100">{{ previewData.title }}</span>
                &mdash; {{ previewData.bigRocks.length }} Big Rocks found
              </p>
              <div class="flex gap-3 mt-1 text-xs">
                <span class="text-green-600 dark:text-green-400" v-if="newCount > 0">{{ newCount }} new</span>
                <span class="text-red-600 dark:text-red-400" v-if="errorCount > 0">{{ errorCount }} validation error</span>
              </div>
            </div>

            <!-- Warnings -->
            <div v-if="previewData.warnings && previewData.warnings.length > 0" class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400">
              <p v-for="(w, i) in previewData.warnings" :key="i">{{ w }}</p>
            </div>

            <!-- Preview table -->
            <div class="overflow-x-auto">
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
                    :class="{ 'opacity-50': rock.status === 'validation_error' }"
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
                          'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400': rock.status === 'validation_error'
                        }"
                      >
                        {{ rock.status === 'new' ? 'New' : 'Error' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>

        <!-- Error -->
        <div v-if="errorMsg" class="mb-4 p-2 rounded bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-sm text-red-700 dark:text-red-400">
          {{ errorMsg }}
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-2">
          <button
            @click="$emit('close')"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            @click="handleCreate"
            :disabled="!canCreate || creating"
            class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ creating ? 'Creating...' : mode === 'import' ? 'Create & Import' : 'Create' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
