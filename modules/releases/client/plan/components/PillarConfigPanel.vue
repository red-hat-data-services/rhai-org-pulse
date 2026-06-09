<template>
  <div v-if="open" class="fixed inset-0 z-[100] flex justify-end" @mousedown.self="$emit('close')">
    <div class="w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">Pillar Configuration</h3>
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
          Define which Jira components belong to each pillar, along with their PM and Engineering leads.
        </p>

        <div v-for="(pillar, pi) in draft" :key="pi" class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <!-- Pillar header -->
          <div class="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-800">
            <button
              type="button"
              @click="toggleExpand(pi)"
              class="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 transition-colors"
            >
              <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-90': expanded[pi] }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <input
              v-model="pillar.name"
              class="flex-1 text-sm font-semibold bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
              placeholder="Pillar name"
            />
            <span class="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{{ pillar.components.length }}</span>
            <button
              type="button"
              @click="removePillar(pi)"
              class="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
              title="Remove pillar"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          <!-- Components list (expandable) -->
          <div v-if="expanded[pi]" class="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
            <div v-for="(comp, ci) in pillar.components" :key="ci" class="px-3 py-2">
              <div class="flex items-center gap-1.5">
                <input
                  v-model="comp.name"
                  class="flex-1 text-sm font-medium bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2 py-1 text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-primary-400"
                  placeholder="Component name"
                />
                <button
                  type="button"
                  @click="removeComponent(pi, ci)"
                  class="p-0.5 rounded text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                >
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div class="flex items-center gap-2 mt-1.5 ml-0.5">
                <label class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase w-7 flex-shrink-0">PM</label>
                <input
                  v-model="comp.pmLead"
                  class="flex-1 text-xs bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-600 rounded px-2 py-0.5 text-gray-600 dark:text-gray-400 outline-none focus:ring-1 focus:ring-primary-400 placeholder-gray-300 dark:placeholder-gray-600"
                  placeholder="PM Lead"
                />
                <label class="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase w-7 flex-shrink-0">Eng</label>
                <input
                  v-model="comp.engLead"
                  class="flex-1 text-xs bg-white dark:bg-gray-800/60 border border-gray-200 dark:border-gray-600 rounded px-2 py-0.5 text-gray-600 dark:text-gray-400 outline-none focus:ring-1 focus:ring-primary-400 placeholder-gray-300 dark:placeholder-gray-600"
                  placeholder="Engineering Lead"
                />
              </div>
            </div>
            <div class="px-3 py-2">
              <button
                type="button"
                @click="addComponent(pi)"
                class="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
              >
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add component
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          @click="addPillar"
          class="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Pillar
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
  open: { type: Boolean, default: false },
  config: { type: Object, default: function() { return { pillars: [] } } }
})

var emit = defineEmits(['close', 'saved'])

var draft = ref([])
var expanded = ref({})
var saving = ref(false)
var saveError = ref(null)
var saveSuccess = ref(false)

function normalizeComponent(c) {
  if (typeof c === 'string') return { name: c, pmLead: '', engLead: '' }
  return { name: c.name || '', pmLead: c.pmLead || '', engLead: c.engLead || '' }
}

watch(function() { return props.open }, function(isOpen) {
  if (isOpen) {
    draft.value = (props.config.pillars || []).map(function(p) {
      return {
        name: p.name,
        components: (p.components || []).map(normalizeComponent)
      }
    })
    expanded.value = {}
    saveError.value = null
    saveSuccess.value = false
  }
})

function toggleExpand(idx) {
  expanded.value = Object.assign({}, expanded.value, { [idx]: !expanded.value[idx] })
}

function addPillar() {
  draft.value.push({ name: '', components: [] })
  expanded.value = Object.assign({}, expanded.value, { [draft.value.length - 1]: true })
}

function removePillar(idx) {
  draft.value.splice(idx, 1)
}

function addComponent(pillarIdx) {
  draft.value[pillarIdx].components.push({ name: '', pmLead: '', engLead: '' })
}

function removeComponent(pillarIdx, compIdx) {
  draft.value[pillarIdx].components.splice(compIdx, 1)
}

async function save() {
  saving.value = true
  saveError.value = null
  saveSuccess.value = false

  var cleaned = draft.value
    .filter(function(p) { return p.name.trim() })
    .map(function(p) {
      return {
        name: p.name.trim(),
        components: p.components
          .filter(function(c) { return c.name.trim() })
          .map(function(c) {
            return { name: c.name.trim(), pmLead: (c.pmLead || '').trim(), engLead: (c.engLead || '').trim() }
          })
      }
    })

  try {
    var response = await fetch(getApiBase() + '/modules/releases/pm-hub/pillar-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pillars: cleaned })
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
