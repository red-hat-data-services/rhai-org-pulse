<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useReleaseHealth } from '../composables/useReleaseHealth'
import { useDorChecklist } from '../composables/useDorChecklist'
import { useReleases } from '../composables/useReleasePlanning'
import { useAuth } from '@shared/client'
import { passesPhaseFilter } from '../utils/phase-filter'
import { exportHealthMarkdown, exportHealthCsv } from '../utils/health-export'
import ReleaseSelector from '../components/ReleaseSelector.vue'
import MilestoneTimeline from '../components/MilestoneTimeline.vue'
import HealthFilterBar from '../components/HealthFilterBar.vue'
import FeatureHealthTable from '../components/FeatureHealthTable.vue'
import RiceFieldConfig from '../components/RiceFieldConfig.vue'

var {
  healthData, healthLoading, healthError, healthRefreshing, healthCacheStale,
  loadHealth, triggerHealthRefresh, checkHealthRefreshStatus,
  removeRiskOverride: removeRiskOverrideApi,
  createSnapshot
} = useReleaseHealth()

var { toggleItem, updateNotes, cancelAll: cancelDorPending } = useDorChecklist()
var { releases, loadReleases } = useReleases()
var { isAdmin } = useAuth()

var selectedVersion = ref('')

// Phase tabs
var activePhase = ref('EA1')

// Admin settings
var showRiceConfig = ref(false)

// Filter state
var bigRockFilter = ref('')
var selectedComponents = ref([])
var searchQuery = ref('')

// Refresh polling
var refreshPollTimer = null

// ─── Permissions ───

var canEdit = computed(function() {
  if (healthData.value && healthData.value.demoMode) return false
  return isAdmin.value
})

var demoMode = computed(function() {
  return healthData.value ? !!healthData.value.demoMode : false
})

// ─── Derived data ───

var features = computed(function() {
  return healthData.value ? healthData.value.features || [] : []
})

var milestones = computed(function() {
  return healthData.value ? healthData.value.milestones : null
})

var planningFreezes = computed(function() {
  return healthData.value ? healthData.value.planningFreezes : null
})

var warning = computed(function() {
  return healthData.value ? healthData.value.warning : null
})

var jiraBaseUrl = computed(function() {
  return 'https://redhat.atlassian.net/browse'
})

var enrichmentStatus = computed(function() {
  return healthData.value ? healthData.value.enrichmentStatus : null
})

// ─── Phase tabs ───

function isPhaseCommitted(phaseId) {
  var pf = planningFreezes.value
  if (!pf) return false
  var freezeDate = pf[phaseId.toLowerCase()]
  if (!freezeDate) return false
  var today = new Date().toISOString().split('T')[0]
  return today >= freezeDate
}

var phaseTabs = computed(function() {
  var tabs = []
  var ms = milestones.value
  if (!ms) return tabs
  if (ms.ea1Freeze || ms.ea1Target) {
    tabs.push({ id: 'EA1', label: isPhaseCommitted('EA1') ? 'EA1 Committed' : 'EA1' })
  }
  if (ms.ea2Freeze || ms.ea2Target) {
    tabs.push({ id: 'EA2', label: isPhaseCommitted('EA2') ? 'EA2 Committed' : 'EA2' })
  }
  if (ms.gaFreeze || ms.gaTarget) {
    tabs.push({ id: 'GA', label: isPhaseCommitted('GA') ? 'GA Committed' : 'GA' })
  }
  return tabs
})

// ─── Phase-filtered features ───

var phasedFeatures = computed(function() {
  var strict = isPhaseCommitted(activePhase.value)
  return features.value.filter(function(f) {
    return passesPhaseFilter(f, selectedVersion.value, activePhase.value, strict)
  })
})

// ─── Committed snapshot + visual diff ───

var showChanges = ref(true)

var committedSnapshot = computed(function() {
  if (!healthData.value || !healthData.value.committedSnapshots) return null
  return healthData.value.committedSnapshots[activePhase.value] || null
})

var addedFeatureKeys = computed(function() {
  var snap = committedSnapshot.value
  if (!snap || !isPhaseCommitted(activePhase.value)) return new Set()
  var snapKeys = new Set(snap.featureKeys)
  var added = new Set()
  for (var i = 0; i < phasedFeatures.value.length; i++) {
    if (!snapKeys.has(phasedFeatures.value[i].key)) {
      added.add(phasedFeatures.value[i].key)
    }
  }
  return added
})

var removedFeatures = computed(function() {
  var snap = committedSnapshot.value
  if (!snap || !isPhaseCommitted(activePhase.value)) return []
  if (!snap.features) return []
  var currentKeys = new Set(phasedFeatures.value.map(function(f) { return f.key }))
  return snap.features.filter(function(f) { return !currentKeys.has(f.key) })
})

function handleResnapshot() {
  if (!selectedVersion.value || !activePhase.value) return
  createSnapshot(selectedVersion.value, activePhase.value).then(function() {
    loadHealth(selectedVersion.value)
  }).catch(function(err) {
    healthError.value = err.message || 'Failed to create snapshot'
  })
}

// ─── Tab feature counts ───

function phaseFeatureCount(tabId) {
  var strict = isPhaseCommitted(tabId)
  return features.value.filter(function(f) {
    return passesPhaseFilter(f, selectedVersion.value, tabId, strict)
  }).length
}

// ─── Filter options ───

var bigRockOptions = computed(function() {
  var rocks = {}
  for (var i = 0; i < features.value.length; i++) {
    var rock = features.value[i].bigRock
    if (rock) rocks[rock] = true
  }
  return Object.keys(rocks).sort()
})

var componentOptions = computed(function() {
  var set = new Set()
  var feats = features.value || []
  for (var i = 0; i < feats.length; i++) {
    if (feats[i].components) {
      var parts = feats[i].components.split(/\s*,\s*/).filter(Boolean)
      for (var j = 0; j < parts.length; j++) {
        set.add(parts[j])
      }
    }
  }
  return Array.from(set).sort()
})

// ─── Filtered features (applied on top of phasedFeatures) ───

var filteredFeatures = computed(function() {
  var list = phasedFeatures.value
  if (!list || list.length === 0) return []

  return list.filter(function(f) {
    // Big Rock filter
    if (bigRockFilter.value && f.bigRock !== bigRockFilter.value) return false

    // Component filter (multi-select with comma split)
    if (selectedComponents.value.length > 0) {
      var featureComps = f.components
        ? f.components.split(/\s*,\s*/).filter(Boolean)
        : []
      var hasMatch = selectedComponents.value.some(function(comp) {
        return featureComps.includes(comp)
      })
      if (!hasMatch) return false
    }

    // Search
    if (searchQuery.value) {
      var q = searchQuery.value.toLowerCase()
      var searchFields = [f.key, f.summary, f.status, f.pm, f.deliveryOwner, f.components, f.bigRock].join(' ').toLowerCase()
      if (searchFields.indexOf(q) === -1) return false
    }

    return true
  })
})

var hasActiveFilters = computed(function() {
  return !!(bigRockFilter.value || selectedComponents.value.length > 0 || searchQuery.value)
})

function clearFilters() {
  bigRockFilter.value = ''
  selectedComponents.value = []
  searchQuery.value = ''
}

// ─── Export menu ───

var exportMenuOpen = ref(false)

function toggleExportMenu() {
  exportMenuOpen.value = !exportMenuOpen.value
}

function closeExportMenu() {
  exportMenuOpen.value = false
}

function handleExportMarkdown() {
  closeExportMenu()
  exportHealthMarkdown({
    version: selectedVersion.value,
    phase: activePhase.value,
    features: phasedFeatures.value,
    milestones: milestones.value,
    planningFreezes: planningFreezes.value,
    cachedAt: healthData.value.cachedAt
  })
}

function handleExportCsv() {
  closeExportMenu()
  exportHealthCsv({
    version: selectedVersion.value,
    phase: activePhase.value,
    features: phasedFeatures.value,
    cachedAt: healthData.value.cachedAt
  })
}

function handleClickOutside() {
  exportMenuOpen.value = false
}

// ─── Data refresh ───

function startRefreshPolling() {
  stopRefreshPolling()
  refreshPollTimer = setInterval(async function() {
    try {
      var status = await checkHealthRefreshStatus(selectedVersion.value)
      if (!status.running) {
        stopRefreshPolling()
        if (selectedVersion.value) {
          loadHealth(selectedVersion.value)
        }
      }
    } catch {
      stopRefreshPolling()
    }
  }, 3000)
}

function stopRefreshPolling() {
  if (refreshPollTimer) {
    clearInterval(refreshPollTimer)
    refreshPollTimer = null
  }
}

watch(healthRefreshing, function(isRefreshing) {
  if (isRefreshing) {
    startRefreshPolling()
  }
})

function handleRefresh() {
  if (selectedVersion.value && !demoMode.value) {
    triggerHealthRefresh(selectedVersion.value)
  }
}

// ─── DoR interactions ───

function handleDorToggle(featureKey, itemId, checked) {
  // Optimistic UI update
  if (healthData.value && healthData.value.features) {
    for (var i = 0; i < healthData.value.features.length; i++) {
      if (healthData.value.features[i].key === featureKey && healthData.value.features[i].dor) {
        var items = healthData.value.features[i].dor.items
        for (var j = 0; j < items.length; j++) {
          if (items[j].id === itemId) {
            items[j].checked = checked
            break
          }
        }
        // Recount
        var checkedCount = 0
        for (var k = 0; k < items.length; k++) {
          if (items[k].checked) checkedCount++
        }
        healthData.value.features[i].dor.checkedCount = checkedCount
        healthData.value.features[i].dor.completionPct = items.length > 0
          ? Math.round((checkedCount / items.length) * 100) : 0
        break
      }
    }
  }

  // Debounced save
  toggleItem(selectedVersion.value, featureKey, itemId, checked)
}

function handleNotesUpdate(featureKey, notes) {
  updateNotes(selectedVersion.value, featureKey, notes)
}

function handleRemoveOverride(featureKey) {
  removeRiskOverrideApi(selectedVersion.value, featureKey).then(function() {
    loadHealth(selectedVersion.value)
  }).catch(function(err) {
    healthError.value = err.message || 'Failed to remove override'
  })
}

// ─── Format helpers ───

function formatDate(iso) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString()
}

// ─── Lifecycle ───

watch(selectedVersion, function(newVersion) {
  healthError.value = null
  activePhase.value = 'EA1'
  clearFilters()
  if (newVersion) {
    loadHealth(newVersion)
  }
})

onMounted(async function() {
  document.addEventListener('click', handleClickOutside)
  await loadReleases()
  if (releases.value.length > 0) {
    selectedVersion.value = releases.value[0].version
  }
})

onUnmounted(function() {
  document.removeEventListener('click', handleClickOutside)
  stopRefreshPolling()
  cancelDorPending()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-gray-100">Release Plan Health</h1>
        <p v-if="healthData && healthData.cachedAt" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Data from {{ formatDate(healthData.cachedAt) }}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <ReleaseSelector
          v-if="releases.length > 0"
          :releases="releases"
          v-model="selectedVersion"
        />
        <button
          v-if="selectedVersion && !demoMode"
          @click="handleRefresh"
          :disabled="healthRefreshing"
          class="px-3 py-1.5 text-xs font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ healthRefreshing ? 'Refreshing...' : 'Refresh' }}
        </button>
        <button
          v-if="canEdit"
          @click="showRiceConfig = !showRiceConfig"
          :title="showRiceConfig ? 'Hide RICE settings' : 'RICE settings'"
          class="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </div>

    <!-- RICE Configuration (admin only) -->
    <div v-if="showRiceConfig && canEdit" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">RICE Configuration</h3>
      <RiceFieldConfig />
    </div>

    <!-- Demo mode banner -->
    <div v-if="demoMode" class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
      Demo mode -- displaying sample health data. Configure Jira credentials and run a health refresh for live data.
    </div>

    <!-- Warning -->
    <div v-if="warning" class="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg px-4 py-2 text-sm text-yellow-700 dark:text-yellow-400">
      {{ warning }}
    </div>

    <!-- Cache stale / refreshing indicator -->
    <div v-if="healthCacheStale && healthRefreshing" role="status" class="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg px-4 py-2 text-sm text-blue-700 dark:text-blue-400">
      Refreshing health data in the background...
    </div>

    <!-- Enrichment status -->
    <details v-if="enrichmentStatus && enrichmentStatus.warnings && enrichmentStatus.warnings.length > 0" class="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg text-sm text-amber-700 dark:text-amber-400">
      <summary class="px-4 py-2 cursor-pointer select-none">
        {{ enrichmentStatus.warnings.length }} enrichment warning{{ enrichmentStatus.warnings.length !== 1 ? 's' : '' }} -- data may be incomplete
      </summary>
      <ul class="px-4 pb-2 ml-4 list-disc space-y-0.5">
        <li v-for="(w, i) in enrichmentStatus.warnings" :key="i">{{ w }}</li>
      </ul>
    </details>

    <!-- Error -->
    <div v-if="healthError" role="alert" class="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-lg p-4 text-red-700 dark:text-red-400 text-sm">
      {{ healthError }}
    </div>

    <!-- Loading -->
    <div v-if="healthLoading && !healthData" class="text-center py-12 text-gray-500">
      Loading release health data...
    </div>

    <template v-else-if="healthData && features.length > 0">
      <!-- Milestone Timeline -->
      <MilestoneTimeline :milestones="milestones" :planningFreezes="planningFreezes" />

      <!-- Phase Tabs -->
      <div>
        <div class="flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <div role="tablist" aria-label="Release phase views" class="flex items-center gap-0 -mb-px">
            <button
              v-for="tab in phaseTabs"
              :key="tab.id"
              role="tab"
              :id="'tab-' + tab.id"
              :aria-selected="activePhase === tab.id"
              :aria-controls="'panel-' + tab.id"
              :tabindex="activePhase === tab.id ? 0 : -1"
              @click="activePhase = tab.id"
              class="px-4 py-2.5 text-xs font-medium transition-colors flex items-center gap-1.5 border-b-2"
              :class="activePhase === tab.id
                ? 'border-primary-600 dark:border-primary-400 text-primary-700 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'"
            >
              {{ tab.label }}
              <span
                class="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold"
                :class="activePhase === tab.id
                  ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'"
              >{{ phaseFeatureCount(tab.id) }}</span>
            </button>
          </div>
          <div v-if="isPhaseCommitted(activePhase)" class="relative pb-2" @click.stop @keydown.escape="closeExportMenu">
            <button
              @click="toggleExportMenu"
              :disabled="phasedFeatures.length === 0"
              :aria-expanded="exportMenuOpen"
              aria-haspopup="menu"
              aria-label="Download health report"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div
              v-if="exportMenuOpen"
              role="menu"
              class="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-10"
            >
              <button
                role="menuitem"
                @click="handleExportMarkdown"
                class="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >Markdown (.md)</button>
              <button
                role="menuitem"
                @click="handleExportCsv"
                class="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >CSV (.csv)</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Committed snapshot info -->
      <div v-if="committedSnapshot && isPhaseCommitted(activePhase)" class="flex items-center gap-3 flex-wrap">
        <span class="text-xs text-gray-500 dark:text-gray-400">
          Committed {{ committedSnapshot.featureCount }} features on {{ formatDate(committedSnapshot.snapshotAt) }}
        </span>
        <label class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
          <input type="checkbox" v-model="showChanges" class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" />
          Show changes since commit
        </label>
        <button v-if="canEdit" @click="handleResnapshot" class="text-xs text-primary-600 dark:text-primary-400 hover:underline">
          Re-snapshot
        </button>
      </div>

      <!-- Changes since commitment summary -->
      <div v-if="committedSnapshot && isPhaseCommitted(activePhase) && showChanges && (addedFeatureKeys.size > 0 || removedFeatures.length > 0)"
           class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Changes Since Commitment
        </h3>
        <div class="flex gap-6 text-sm">
          <div v-if="addedFeatureKeys.size > 0" class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-green-500"></span>
            <span class="text-gray-600 dark:text-gray-400">{{ addedFeatureKeys.size }} added</span>
          </div>
          <div v-if="removedFeatures.length > 0" class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-red-500"></span>
            <span class="text-gray-600 dark:text-gray-400">{{ removedFeatures.length }} removed</span>
          </div>
          <div class="text-gray-500 dark:text-gray-400">
            {{ phasedFeatures.length }} current (was {{ committedSnapshot.featureCount }})
          </div>
        </div>
      </div>

      <!-- Filters -->
      <HealthFilterBar
        v-model:bigRockFilter="bigRockFilter"
        v-model:selectedComponents="selectedComponents"
        v-model:searchQuery="searchQuery"
        :bigRocks="bigRockOptions"
        :components="componentOptions"
        :hasActiveFilters="hasActiveFilters"
        @clearFilters="clearFilters"
      />

      <!-- Feature Health Table -->
      <FeatureHealthTable
        :features="filteredFeatures"
        :canEdit="canEdit"
        :jiraBaseUrl="jiraBaseUrl"
        :addedKeys="addedFeatureKeys"
        :removedFeatures="removedFeatures"
        :showChanges="showChanges"
        @toggleDorItem="handleDorToggle"
        @updateNotes="handleNotesUpdate"
        @removeOverride="handleRemoveOverride"
      />
    </template>

    <!-- Empty state: data exists but no features -->
    <template v-else-if="healthData && features.length === 0 && !healthData._noCache">
      <div class="text-center py-12">
        <p class="text-gray-500 dark:text-gray-400">No features found in the health data for this release.</p>
        <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">This may mean the Big Rocks candidates cache is empty. Try running a Big Rocks refresh first.</p>
      </div>
    </template>

    <!-- No cache state: first load -->
    <template v-else-if="healthData && healthData._noCache">
      <div class="text-center py-12">
        <div class="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-4">
          <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Health pipeline is running...</span>
        </div>
        <p class="text-sm text-gray-400 dark:text-gray-500">This may take several minutes on the first run. The page will update automatically when ready.</p>
      </div>
    </template>

    <!-- No releases configured -->
    <div v-else-if="!healthLoading && releases.length === 0" class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">No releases configured.</p>
      <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Configure releases in the Big Rocks Planning view first.</p>
    </div>

    <!-- No data yet, not loading -->
    <div v-else-if="!healthLoading && selectedVersion && !healthData" class="text-center py-12">
      <p class="text-gray-500 dark:text-gray-400">No health data available for this release.</p>
      <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Click "Refresh" to generate a health assessment.</p>
    </div>
  </div>
</template>
