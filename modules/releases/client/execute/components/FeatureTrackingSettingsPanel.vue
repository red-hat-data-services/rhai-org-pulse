<template>
  <div v-if="open" class="fixed inset-0 z-[100] flex justify-end" @mousedown.self="$emit('close')">
    <div class="w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Feature Tracking Settings</h3>
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
          Configure release version names for each RHAI product and set fallback planning freeze dates.
        </p>

        <div v-for="(entry, idx) in draft" :key="idx" class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <!-- Release header -->
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
              v-model="entry.version"
              class="flex-1 text-sm font-semibold bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
              placeholder="Portfolio version (e.g. 3.7)"
            />
            <span class="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase">
              {{ Object.values(entry.products).filter(function(v) { return v.trim() }).length }} products
            </span>
            <button
              type="button"
              @click="removeRelease(idx)"
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
            <div v-for="product in PRODUCT_KEYS" :key="product" class="flex items-center gap-2">
              <label class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase w-14 flex-shrink-0">{{ product }}</label>
              <input
                v-model="entry.products[product]"
                class="flex-1 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2.5 py-1.5 text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-primary-400 placeholder-gray-300 dark:placeholder-gray-600"
                :placeholder="product.toLowerCase() + '-' + (entry.version || 'x.y')"
              />
            </div>

            <div class="pt-2 border-t border-gray-100 dark:border-gray-700">
              <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">
                Planning Freeze (fallback)
              </label>
              <input
                type="date"
                v-model="entry.planningFreezeOverride"
                class="text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2.5 py-1.5 text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-primary-400"
              />
              <p class="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                Used only when Product Pages returns no planning freeze date
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          @click="addRelease"
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

var PRODUCT_KEYS = ['RHOAI', 'RHELAI', 'RHAII']

var props = defineProps({
  open: { type: Boolean, default: false },
  config: { type: Object, default: function() { return { releases: {} } } }
})

var emit = defineEmits(['close', 'saved'])

var draft = ref([])
var expanded = ref({})
var saving = ref(false)
var saveError = ref(null)
var saveSuccess = ref(false)

function configToArray(config) {
  var releases = (config && config.releases) || {}
  var keys = Object.keys(releases)
  return keys.map(function(key) {
    var entry = releases[key]
    var products = {}
    for (var i = 0; i < PRODUCT_KEYS.length; i++) {
      var pk = PRODUCT_KEYS[i]
      var lower = pk.toLowerCase()
      products[pk] = (entry.products && (entry.products[pk] || entry.products[lower])) || ''
    }
    return {
      version: key,
      products: products,
      planningFreezeOverride: entry.planningFreezeOverride || ''
    }
  })
}

function arrayToConfig(arr) {
  var releases = {}
  for (var i = 0; i < arr.length; i++) {
    var entry = arr[i]
    var version = (entry.version || '').trim()
    if (!version) continue
    var products = {}
    for (var pi = 0; pi < PRODUCT_KEYS.length; pi++) {
      var pk = PRODUCT_KEYS[pi]
      var val = (entry.products[pk] || '').trim()
      if (val) products[pk.toLowerCase()] = val
    }
    releases[version] = {
      products: products,
      planningFreezeOverride: entry.planningFreezeOverride || null
    }
  }
  return { releases: releases }
}

watch(function() { return props.open }, function(isOpen) {
  if (isOpen) {
    draft.value = configToArray(props.config)
    expanded.value = {}
    saveError.value = null
    saveSuccess.value = false
  }
})

function toggleExpand(idx) {
  expanded.value = Object.assign({}, expanded.value, { [idx]: !expanded.value[idx] })
}

function addRelease() {
  var products = {}
  for (var i = 0; i < PRODUCT_KEYS.length; i++) {
    products[PRODUCT_KEYS[i]] = ''
  }
  draft.value.push({ version: '', products: products, planningFreezeOverride: '' })
  expanded.value = Object.assign({}, expanded.value, { [draft.value.length - 1]: true })
}

function removeRelease(idx) {
  draft.value.splice(idx, 1)
}

async function save() {
  saving.value = true
  saveError.value = null
  saveSuccess.value = false

  var payload = arrayToConfig(draft.value)

  try {
    var response = await fetch(getApiBase() + '/modules/releases/execution/tracking/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!response.ok) {
      var errData = await response.json().catch(function() { return {} })
      throw new Error(errData.error || 'HTTP ' + response.status)
    }
    var data = await response.json()
    saveSuccess.value = true
    emit('saved', data)
  } catch (err) {
    saveError.value = err.message
  } finally {
    saving.value = false
  }
}
</script>
