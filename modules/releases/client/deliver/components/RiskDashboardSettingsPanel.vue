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
      <div class="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        <!-- Portfolio Releases Section -->
        <div class="space-y-4">
          <div>
            <h4 class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Portfolio Releases</h4>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Define portfolio release groups with exactly 3 FixVersion identifiers, a shared code freeze date, and GA date.
            </p>
          </div>

          <div v-for="(pf, pi) in portfolioDraft" :key="pf.id" class="rounded-lg border border-indigo-200 dark:border-indigo-700/50 overflow-hidden">
            <div class="flex items-center gap-2 px-3 py-2.5 bg-indigo-50/50 dark:bg-indigo-900/20">
              <button
                type="button"
                @click="togglePortfolioExpand(pi)"
                class="p-0.5 rounded hover:bg-indigo-100 dark:hover:bg-indigo-800/40 text-gray-400 transition-colors"
              >
                <svg class="w-4 h-4 transition-transform" :class="{ 'rotate-90': portfolioExpanded[pi] }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <span class="flex-1 text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {{ pf.name || 'Untitled Portfolio' }}
              </span>
              <label class="relative inline-flex items-center cursor-pointer" @click.stop>
                <input type="checkbox" v-model="pf.enabled" class="sr-only peer" />
                <div class="w-8 h-[18px] bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:bg-primary-600 transition-colors">
                  <div class="absolute top-[2px] left-[2px] bg-white rounded-full h-3.5 w-3.5 transition-transform peer-checked:translate-x-3.5 shadow" />
                </div>
              </label>
              <button
                type="button"
                @click="removePortfolio(pi)"
                class="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
                title="Remove portfolio"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>

            <div v-if="portfolioExpanded[pi]" class="border-t border-indigo-100 dark:border-indigo-800/50 px-4 py-3 space-y-3">
              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">
                  Portfolio Name
                </label>
                <input
                  v-model="pf.name"
                  class="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2.5 py-1.5 text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-primary-400 placeholder-gray-300 dark:placeholder-gray-600"
                  placeholder="e.g. RHAI 3.5"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">
                  FixVersions (exactly 3)
                </label>
                <div class="space-y-2">
                  <input
                    v-for="ri in 3"
                    :key="ri"
                    v-model="pf.releases[ri - 1]"
                    type="text"
                    class="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2.5 py-1.5 text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-primary-400 placeholder-gray-300 dark:placeholder-gray-600"
                    :placeholder="'FixVersion ' + ri + ' (e.g. rhoai-3.7)'"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3 pt-2 border-t border-indigo-100 dark:border-indigo-800/50">
                <div>
                  <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">
                    Code Freeze Date
                  </label>
                  <input
                    type="date"
                    v-model="pf.codeFreezeDate"
                    class="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2.5 py-1.5 text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-primary-400"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">
                    GA Date
                  </label>
                  <input
                    type="date"
                    v-model="pf.dueDate"
                    class="w-full text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded px-2.5 py-1.5 text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-primary-400"
                  />
                </div>
              </div>
              <p class="text-[10px] text-gray-400 dark:text-gray-500">
                Dates are shared across all releases in this portfolio and override Product Pages values when set.
              </p>

              <div v-if="portfolioValidationError(pf)" class="text-xs text-red-500">
                {{ portfolioValidationError(pf) }}
              </div>
            </div>
          </div>

          <button
            type="button"
            @click="addPortfolio"
            class="w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Portfolio Release
          </button>
        </div>
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
import { useRiskDashboardConfig } from '../composables/useRiskDashboardConfig'

var props = defineProps({
  open: { type: Boolean, default: false }
})

var emit = defineEmits(['close', 'saved'])

var portfolioDraft = ref([])
var portfolioExpanded = ref({})
var saving = ref(false)
var saveError = ref(null)
var saveSuccess = ref(false)

var { saveConfig } = useRiskDashboardConfig()

function portfolioValidationError(pf) {
  if (!pf.name || !pf.name.trim()) return 'Name is required'
  var filled = pf.releases.filter(function (r) { return r && r.trim() })
  if (filled.length < 3) return 'Enter exactly 3 FixVersions'
  return null
}

var nextPortfolioId = 1

function makePortfolioId() {
  return 'pf-' + Date.now() + '-' + (nextPortfolioId++)
}

async function loadPortfolioConfig() {
  try {
    var response = await fetch(getApiBase() + '/modules/releases/delivery/risk-dashboard-config')
    if (!response.ok) throw new Error('HTTP ' + response.status)
    var data = await response.json()
    var portfolios = (data && data.portfolioReleases) || []
    portfolioDraft.value = portfolios.map(function (p) {
      return {
        id: p.id || makePortfolioId(),
        name: p.name || '',
        releases: [p.releases[0] || '', p.releases[1] || '', p.releases[2] || ''],
        codeFreezeDate: p.codeFreezeDate || '',
        dueDate: p.dueDate || '',
        enabled: p.enabled !== false
      }
    })
  } catch {
    portfolioDraft.value = []
  }
}

watch(function() { return props.open }, function(isOpen) {
  if (isOpen) {
    portfolioExpanded.value = {}
    saveError.value = null
    saveSuccess.value = false
    loadPortfolioConfig()
  }
})

function togglePortfolioExpand(idx) {
  portfolioExpanded.value = Object.assign({}, portfolioExpanded.value, { [idx]: !portfolioExpanded.value[idx] })
}

function addPortfolio() {
  var newPf = {
    id: makePortfolioId(),
    name: '',
    releases: ['', '', ''],
    codeFreezeDate: '',
    dueDate: '',
    enabled: true
  }
  portfolioDraft.value.push(newPf)
  portfolioExpanded.value = Object.assign({}, portfolioExpanded.value, { [portfolioDraft.value.length - 1]: true })
}

function removePortfolio(idx) {
  portfolioDraft.value.splice(idx, 1)
}

function buildMetadataFromPortfolios(portfolios) {
  var metadata = {}
  for (var i = 0; i < portfolios.length; i++) {
    var pf = portfolios[i]
    for (var j = 0; j < pf.releases.length; j++) {
      var releaseNumber = (pf.releases[j] || '').trim()
      if (!releaseNumber) continue
      metadata[releaseNumber] = {
        productName: pf.name.trim() || null,
        dueDate: pf.dueDate || null,
        codeFreezeDate: pf.codeFreezeDate || null
      }
    }
  }
  return metadata
}

async function save() {
  saving.value = true
  saveError.value = null
  saveSuccess.value = false

  var validPortfolios = []
  for (var i = 0; i < portfolioDraft.value.length; i++) {
    var pf = portfolioDraft.value[i]
    var err = portfolioValidationError(pf)
    if (err) {
      saving.value = false
      saveError.value = 'Portfolio "' + (pf.name || 'Untitled') + '": ' + err
      return
    }
    validPortfolios.push({
      id: pf.id,
      name: pf.name.trim(),
      releases: [pf.releases[0].trim(), pf.releases[1].trim(), pf.releases[2].trim()],
      codeFreezeDate: pf.codeFreezeDate || null,
      dueDate: pf.dueDate || null,
      enabled: pf.enabled
    })
  }

  try {
    await saveConfig({ portfolioReleases: validPortfolios })

    var metadataPayload = buildMetadataFromPortfolios(validPortfolios)
    var metaResponse = await fetch(getApiBase() + '/modules/releases/delivery/releases-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadataPayload)
    })
    if (!metaResponse.ok) {
      var metaErr = await metaResponse.json().catch(function() { return {} })
      throw new Error(metaErr.error || 'HTTP ' + metaResponse.status)
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
