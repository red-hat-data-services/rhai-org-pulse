<template>
  <div v-if="open" class="fixed inset-0 z-[100] flex justify-end" @mousedown.self="$emit('close')">
    <div class="w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Release Settings</h3>
        <button
          @click="$emit('close')"
          class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Manage the releases shown on the Risk Dashboard. Each entry maps a Jira release number
          to a portfolio name and optional schedule dates that override Product Pages.
        </p>

        <div v-for="(entry, idx) in draft" :key="idx" class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <!-- Release header row -->
          <div class="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-800">
            <button
              type="button"
              @click="toggleExpand(idx)"
              class="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors"
            >
              <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-90': expanded[idx] }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <input
              v-model="entry.releaseNumber"
              class="flex-1 text-sm font-semibold bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
              placeholder="Release number (e.g. rhoai-3.7)"
            />
            <span
              v-if="entry.productName"
              class="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase truncate max-w-[100px]"
            >{{ entry.productName }}</span>
            <button
              type="button"
              @click="removeEntry(idx)"
              class="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
              title="Remove release"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          <!-- Release details (expandable) -->
          <div v-if="expanded[idx]" class="border-t border-gray-100 dark:border-gray-700 px-4 py-3 space-y-3">
            <div>
              <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">
                Portfolio / Product Name
              </label>
              <input
                v-model="entry.productName"
                class="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2.5 py-1.5 text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-primary-400 placeholder-gray-300 dark:placeholder-gray-600"
                placeholder="e.g. RHOAI"
              />
            </div>

            <div class="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">
                  Due / GA Date
                </label>
                <input
                  type="date"
                  v-model="entry.dueDate"
                  class="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2.5 py-1.5 text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-primary-400"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">
                  Code Freeze Date
                </label>
                <input
                  type="date"
                  v-model="entry.codeFreezeDate"
                  class="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2.5 py-1.5 text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-primary-400"
                />
              </div>
            </div>
            <p class="text-[10px] text-gray-400 dark:text-gray-500">
              Dates override Product Pages values when set
            </p>
          </div>
        </div>

        <button
          type="button"
          @click="addEntry"
          class="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Release
        </button>
      </div>

      <!-- Footer -->
      <div class="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <span v-if="saveError" class="text-xs text-red-500">{{ saveError }}</span>
        <span v-else-if="saveSuccess" class="text-xs text-emerald-600 dark:text-emerald-400">Saved</span>
        <span v-else />
        <div class="flex items-center gap-2">
          <button
            @click="$emit('close')"
            class="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >Cancel</button>
          <button
            @click="save"
            :disabled="saving"
            class="px-4 py-1.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors disabled:opacity-50"
          >{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { getApiBase } from '@shared/client/services/api'

var props = defineProps({
  open: { type: Boolean, default: false }
})

var emit = defineEmits(['close', 'saved'])

var draft = ref([])
var expanded = ref({})
var saving = ref(false)
var saveError = ref(null)
var saveSuccess = ref(false)

function metadataToArray(metadata) {
  var keys = Object.keys(metadata || {})
  var entries = []
  for (var i = 0; i < keys.length; i++) {
    var releaseNumber = keys[i]
    var meta = metadata[releaseNumber] || {}
    entries.push({
      releaseNumber: releaseNumber,
      productName: meta.productName || '',
      dueDate: meta.dueDate || '',
      codeFreezeDate: meta.codeFreezeDate || ''
    })
  }
  entries.sort(function(a, b) { return a.releaseNumber.localeCompare(b.releaseNumber) })
  return entries
}

function arrayToMetadata(arr) {
  var metadata = {}
  for (var i = 0; i < arr.length; i++) {
    var entry = arr[i]
    var releaseNumber = (entry.releaseNumber || '').trim()
    if (!releaseNumber) continue
    metadata[releaseNumber] = {
      productName: (entry.productName || '').trim() || null,
      dueDate: entry.dueDate || null,
      codeFreezeDate: entry.codeFreezeDate || null
    }
  }
  return metadata
}

async function loadMetadata() {
  try {
    var response = await fetch(getApiBase() + '/modules/releases/delivery/releases-metadata')
    if (!response.ok) throw new Error('HTTP ' + response.status)
    var data = await response.json()
    draft.value = metadataToArray(data)
  } catch {
    draft.value = []
  }
}

watch(function() { return props.open }, function(isOpen) {
  if (isOpen) {
    expanded.value = {}
    saveError.value = null
    saveSuccess.value = false
    loadMetadata()
  }
})

function toggleExpand(idx) {
  expanded.value = Object.assign({}, expanded.value, { [idx]: !expanded.value[idx] })
}

function addEntry() {
  draft.value.push({ releaseNumber: '', productName: '', dueDate: '', codeFreezeDate: '' })
  expanded.value = Object.assign({}, expanded.value, { [draft.value.length - 1]: true })
}

function removeEntry(idx) {
  draft.value.splice(idx, 1)
}

async function save() {
  saving.value = true
  saveError.value = null
  saveSuccess.value = false

  var payload = arrayToMetadata(draft.value)

  try {
    var response = await fetch(getApiBase() + '/modules/releases/delivery/releases-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!response.ok) {
      var errData = await response.json().catch(function() { return {} })
      throw new Error(errData.error || 'HTTP ' + response.status)
    }
    saveSuccess.value = true
    emit('saved')
  } catch (err) {
    saveError.value = err.message
  } finally {
    saving.value = false
  }
}
</script>
